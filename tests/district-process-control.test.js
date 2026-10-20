'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { spawn, ChildProcess } = require('node:child_process');
const { once } = require('node:events');
const { stopProcessTree, boundedAppend, classifyProviderError } = require('../app/district/process-control');

function fixture(t, { descendant = false, ignoreTerm = false } = {}) {
  const code = `
    const { spawn } = require('node:child_process');
    ${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''}
    const leaf = ${descendant ? "spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio:'ignore'})" : 'null'};
    process.stdout.write(JSON.stringify({pid:process.pid, descendantPid:leaf?.pid || null}) + '\\n');
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ['-e', code], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.resume();
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) await stopProcessTree(child, { graceMs: 30 }); });
  return { child, ready: new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error('Owned fixture did not become ready.')), 5000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', (data) => {
      text += data;
      if (text.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(text.split('\n')[0])); }
    });
  }) };
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

test('bounded diagnostic tails never grow past the configured bound', () => {
  assert.equal(boundedAppend('abcdef', 'ghi', 5), 'efghi');
  assert.equal(boundedAppend('old', '0123456789', 3), '789');
  assert.equal(boundedAppend('old', '', 2), 'ld');
  assert.equal(boundedAppend(null, null), '');
  assert.equal(boundedAppend('old', 'new', 0), '');
  assert.equal(boundedAppend('prefix', 'x'.repeat(200000)).length, 100000);
  assert.equal(boundedAppend('', 'A😀B', 2), 'B', 'do not return a dangling low surrogate');
  assert.throws(() => boundedAppend('', 'text', -1), RangeError);
});

test('provider diagnostics categorize actual failures without claiming availability', () => {
  const cases = [
    ['You have hit your usage limit. Try again later.', 'quota'],
    ['HTTP 429 too many requests', 'quota'],
    ['rate_limit_error: retry later', 'quota'],
    ['usage_limit_reached', 'quota'],
    ['credit balance is too low', 'quota'],
    ['Not logged in. Run codex login.', 'auth'],
    ['invalid_api_key: 401', 'auth'],
    ['spawn codex ENOENT', 'unavailable'],
    ['Operation timed out after 240000 ms', 'timeout'],
    ['AbortError: cancelled by owner', 'cancelled'],
    ['connect ECONNREFUSED 127.0.0.1', 'network'],
    ['Provider returned an unfamiliar failure.', 'unknown'],
    ['', 'unknown'],
    ['Successfully completed a task.', 'unknown'],
  ];
  for (const [text, expected] of cases) assert.equal(classifyProviderError(text), expected, text);
});

test('refuses bare PID objects, invalid handles and the current process', async () => {
  for (const input of [null, process.pid, { pid: process.pid }, { pid: 99999999 }, new ChildProcess()]) {
    const result = await stopProcessTree(input);
    assert.equal(result.confirmed, false);
    assert.equal(result.requested, false);
    assert.equal(result.method, 'refused');
  }
  assert.equal(alive(process.pid), true);
});

test('stops only the owned tree and confirms exit, preserving an unrelated owned fixture', { timeout: 15000 }, async (t) => {
  const target = fixture(t, { descendant: true });
  const unrelated = fixture(t);
  const [targetInfo, unrelatedInfo] = await Promise.all([target.ready, unrelated.ready]);
  assert(targetInfo.descendantPid > 1);
  assert(alive(targetInfo.descendantPid));
  const result = await stopProcessTree(target.child, { graceMs: 100 });
  assert.equal(result.pid, targetInfo.pid);
  assert.equal(result.requested, true);
  assert.equal(result.rootExited, true, JSON.stringify(result));
  assert.equal(result.treeConfirmed, true, JSON.stringify(result));
  assert.equal(result.confirmed, true, JSON.stringify(result));
  assert.equal(result.error, null);
  assert.equal(alive(unrelatedInfo.pid), true, 'a similar process remains alive');
  if (process.platform === 'win32') assert.equal(alive(targetInfo.descendantPid), false, 'taskkill confirmed the descendant exited');
});

test('duplicate stop requests share one result and cannot re-signal a later PID owner', { timeout: 10000 }, async (t) => {
  const target = fixture(t);
  await target.ready;
  const first = stopProcessTree(target.child, { graceMs: 50 });
  const second = stopProcessTree(target.child, { graceMs: 50 });
  assert.equal(first, second);
  const result = await first;
  assert.equal(result.confirmed, true, JSON.stringify(result));
  assert.equal(await stopProcessTree(target.child), result);
});

test('already exited handles are not treated as proof that all descendants stopped', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(7)'], { windowsHide: true, stdio: 'ignore' });
  await once(child, 'exit');
  const result = await stopProcessTree(child, { graceMs: 0 });
  assert.equal(result.rootExited, true);
  assert.equal(result.exitCode, 7);
  assert.equal(result.requested, false);
  assert.equal(result.confirmed, false);
  assert.equal(result.treeConfirmed, false);
  assert.equal(result.method, 'already-exited');
  assert.match(result.error, /unknown/);
});

test('a process ignoring TERM is forced to exit within the bounded stop operation', { timeout: 10000 }, async (t) => {
  const target = fixture(t, { ignoreTerm: true });
  await target.ready;
  const result = await stopProcessTree(target.child, { graceMs: 40 });
  assert.equal(result.confirmed, true, JSON.stringify(result));
  assert.equal(result.rootExited, true);
  if (process.platform !== 'win32') assert.equal(result.signal, 'SIGKILL');
});

test('failed tree helper and ineffective kill never confirm exit, and the same live handle can be retried',
  { timeout: 15000, skip: process.platform !== 'win32' }, async (t) => {
    const target = fixture(t);
    const { pid } = await target.ready;
    const previousRoot = process.env.SystemRoot;
    const originalKill = target.child.kill;
    let result;
    try {
      process.env.SystemRoot = path.join(os.tmpdir(), `agent-bus-no-native-tools-${process.pid}`);
      // A stop request returning true is not an exit notification. Exercise
      // precisely this failure without signalling any other process.
      target.child.kill = () => true;
      result = await stopProcessTree(target.child, { graceMs: 0 });
      assert.equal(result.requested, true);
      assert.equal(result.rootExited, false);
      assert.equal(result.treeConfirmed, false);
      assert.equal(result.confirmed, false);
      assert.match(result.error, /exit was not confirmed/);
      assert.equal(alive(pid), true);
    } finally {
      if (previousRoot === undefined) delete process.env.SystemRoot;
      else process.env.SystemRoot = previousRoot;
      target.child.kill = originalKill;
    }
    const retry = await stopProcessTree(target.child, { graceMs: 100 });
    assert.equal(retry.confirmed, true, JSON.stringify(retry));
  });
