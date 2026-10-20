'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { DistrictRuntime } = require('../app/district/runtime');
const { DistrictBridge } = require('../app/district/bridge');
const { runRecipe, CHECK_NAMES } = require('../app/district/recipes');
const { request } = require('../app/district/client');
const { main, parseArgs, buildCommand } = require('../bin/district.cjs');
const { callTool, TOOLS } = require('../bin/district-mcp.cjs');
const { TYPES } = require('../app/district/contracts');
const world = require('../app/district-world-state');

const repo = path.resolve(__dirname, '..');
const cli = path.join(repo, 'bin/district.cjs');
const mcp = path.join(repo, 'bin/district-mcp.cjs');
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }
function childRun(file, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: repo, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', ended = false;
    const timer = setTimeout(() => { child.kill(); finish(new Error('Isolated CLI child exceeded 10 seconds.')); }, 10000);
    function finish(error, result) { if (ended) return; ended = true; clearTimeout(timer); error ? reject(error) : resolve(result); }
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > 1024 * 1024) { child.kill(); finish(new Error('CLI output exceeded bound.')); } });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => finish(error));
    child.once('close', (code) => finish(null, { code, stdout, stderr }));
    child.stdin.end(input);
  });
}
async function runtimeFixture(t, overrides = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-showcase-cli-'));
  const db = new DatabaseSync(':memory:');
  const connectionFile = path.join(temp, 'connection.json');
  const runtime = new DistrictRuntime({ db, appRoot: repo, workRoot: path.join(temp, 'projects'), providerList: async () => [],
    agentStart: async () => { throw new Error('Live providers are forbidden in this acceptance.'); }, ...overrides });
  const bridge = new DistrictBridge({ runtime, connectionFile });
  await bridge.start();
  t.after(async () => { await bridge.close(); await runtime.close(); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });
  async function command(args) {
    const result = await childRun(cli, [...args, '--json', '--connection', connectionFile]);
    return { ...result, value: JSON.parse(result.stdout) };
  }
  return { runtime, bridge, connectionFile, command };
}
async function httpFixture(t, handler) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-showcase-transport-'));
  const token = crypto.randomBytes(32).toString('hex');
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ method: req.method, url: req.url, body });
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    await handler(req, res, body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const connectionFile = path.join(temp, 'connection.json');
  fs.writeFileSync(connectionFile, JSON.stringify({ version: 1, pid: process.pid, created: Date.now(), token,
    url: `http://127.0.0.1:${server.address().port}` }));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); });
  return { connectionFile, calls, token };
}

test('lost CLI receipt is recoverable with its generated id; GUI snapshot observes one real local run without dragging', async (t) => {
  const release = deferred(); let recipes = 0, providers = 0;
  const f = await runtimeFixture(t, { recipeRun: async (options) => { recipes++; await release.promise; return runRecipe(options); },
    agentStart: async () => { providers++; throw new Error('Unexpected provider'); } });
  t.after(() => release.resolve());
  const created = await f.command(['create', 'CLI automatic district', '--id', 'showcase-create']);
  assert.equal(created.code, 0, created.stdout);
  const projectId = created.value.projectId;
  const original = f.bridge._json.bind(f.bridge); let dropReceipt = true;
  f.bridge._json = (res, status, value, close) => {
    if (dropReceipt && value?.type === 'run_checks' && value.status === 'accepted') { dropReceipt = false; res.destroy(); return; }
    return original(res, status, value, close);
  };
  const lost = await f.command(['check', projectId]);
  assert.equal(lost.code, 1); assert.equal(lost.value.code, 'DISCONNECTED');
  assert.equal(lost.value.outcomeUnknown, true); assert.match(lost.value.commandId, /^[a-zA-Z0-9:_-]+$/);
  const afterLoss = await f.runtime.snapshot(); // The same method backs desktop/GUI snapshots.
  assert.equal(afterLoss.projects.length, 1); assert.equal(afterLoss.runs.length, 1);
  assert.equal(afterLoss.runs[0].commandId, lost.value.commandId); assert.equal(afterLoss.runs[0].projectId, projectId);
  assert.equal(afterLoss.runs[0].origin, 'cli'); assert.notEqual(afterLoss.runs[0].state, 'passed');
  assert(world.project(afterLoss, projectId).some((worker) => worker.id === 'local'), 'CLI-created work appears in the common map projection without assignment gestures');
  const eventCount = f.runtime.store.events(0, 1000).length;
  const retry = await f.command(['check', projectId, '--id', lost.value.commandId]);
  assert.equal(retry.code, 0, retry.stdout); assert.equal(retry.value.status, 'accepted');
  assert.equal(retry.value.runId, afterLoss.runs[0].id);
  for (let i = 0; i < 3; i++) {
    assert.equal((await f.command(['status'])).value.runs.length, 1);
    assert.equal((await callTool('district_snapshot', {}, f.connectionFile)).runs.length, 1);
  }
  assert.equal(recipes, 1); assert.equal(providers, 0); assert.equal(f.runtime.store.events(0, 1000).length, eventCount);
  release.resolve();
  const finished = await f.runtime.waitForRun(retry.value.runId);
  assert.equal(finished.state, 'passed', finished.detail); assert.equal(finished.exitCode, 0);
  assert.deepEqual(finished.checks.map((check) => check.name), CHECK_NAMES);
  assert(finished.checks.every((check) => check.state === 'passed'));
  const final = await callTool('district_snapshot', {}, f.connectionFile);
  assert.equal(final.runs.length, 1); assert.equal(final.previews.length, 1);
  assert.equal(final.previews[0].runId, finished.id); assert.equal(final.previews[0].candidateHash, final.projects[0].manifest.hash);
  assert.equal(recipes, 1); assert.equal(providers, 0);
});

test('CLI and MCP retain exact report linkage and retries without upgrading reports or dispatching another agent', async (t) => {
  const finish = deferred(); let starts = 0, launch;
  const f = await runtimeFixture(t, { agentStart: async (options) => {
    starts++; launch = options; options.onEvent({ type: 'session', sessionId: 'fixture-native-session' });
    return { finished: finish.promise, cancel: async () => { finish.resolve({ exitCode: 1, error: 'Fixture cancelled' }); } };
  } });
  t.after(() => finish.resolve({ exitCode: 1, error: 'Fixture cleanup' }));
  const projectA = (await f.command(['create', 'First isolated project', '--id', 'scope-a'])).value.projectId;
  const projectB = (await f.command(['create', 'Second isolated project', '--id', 'scope-b'])).value.projectId;
  const started = await f.command(['run', projectA, '--agent', 'codex', '--instruction', 'Fixture assignment',
    '--model', 'explicit-model', '--effort', 'high', '--id', 'one-owned-agent']);
  assert.equal(started.code, 0, started.stdout); assert.equal(started.value.status, 'accepted'); assert.equal(starts, 1);
  assert.equal(launch.model, 'explicit-model'); assert.equal(launch.effort, 'high');
  const runId = started.value.runId;
  const args = ['activity', projectA, '--worker', 'codex', '--phase', 'research', '--message', 'Examining project source',
    '--run', runId, '--attempt', runId, '--session', 'fixture-native-session', '--seq', '0', '--id', 'linked-cli-report'];
  const reported = await f.command(args);
  assert.equal(reported.code, 0, reported.stdout); assert.equal(reported.value.result.runId, runId);
  assert.equal(reported.value.result.attemptId, runId); assert.equal(reported.value.result.sessionId, 'fixture-native-session');
  assert.equal(reported.value.result.sourceSeq, 0); assert.equal(reported.value.result.basis, 'reported');
  const events = f.runtime.store.events(0, 1000).length;
  assert.deepEqual((await f.command(args)).value, reported.value);
  assert.equal(f.runtime.store.events(0, 1000).length, events);
  const mcpReport = { id: 'linked-mcp-report', projectId: projectA, workerId: 'codex', phase: 'test', message: 'Claims a successful scan',
    runId, attemptId: runId, sessionId: 'fixture-native-session', sourceSeq: 1 };
  const receipt = await callTool('district_activity', mcpReport, f.connectionFile);
  assert.equal(receipt.result.basis, 'reported'); assert.equal(receipt.result.terminal, false);
  assert.deepEqual(await callTool('district_activity', mcpReport, f.connectionFile), receipt);
  await callTool('district_command', { id: 'forged-outcome', type: 'report_activity', projectId: projectA,
    payload: { workerId: 'codex', phase: 'review', message: 'All checks passed', runId, attemptId: runId,
      basis: 'observed', status: 'completed', terminal: true, at: 1e15, evidence: { passed: true } } }, f.connectionFile);
  const standalone = await f.command(['activity', projectB, '--worker', 'external-helper', '--phase', 'research', '--message', 'Unlinked source reading', '--id', 'standalone-report']);
  assert.equal(standalone.code, 0, standalone.stdout); assert.equal(standalone.value.result.runId, undefined);
  const snapshot = await f.runtime.snapshot();
  assert.equal(snapshot.runs.length, 1); assert.equal(snapshot.runs[0].sessionId, 'fixture-native-session');
  assert.notEqual(snapshot.runs[0].state, 'passed'); assert.deepEqual(snapshot.runs[0].checks, []);
  const forgery = snapshot.activities.find((activity) => activity.message === 'All checks passed');
  assert.equal(forgery.basis, 'reported'); assert.equal(forgery.terminal, false); assert.equal(forgery.evidence, undefined);
  assert(world.project(snapshot, projectB).some((worker) => worker.id === 'external-helper' && worker.basis === 'reported'));
  assert(!world.project(snapshot, projectA).some((worker) => worker.id === 'external-helper'));
  assert.equal(starts, 1);
  finish.resolve({ exitCode: 0, sessionId: 'fixture-native-session', output: 'Report only; no files changed' });
  assert.equal((await f.runtime.waitForRun(runId)).state, 'failed', 'A successful provider exit and report cannot qualify an unsaved edit');
});

test('scoped activity rejects wrong projects, workers, attempts and sessions instead of borrowing another run', async (t) => {
  const finish = deferred();
  const f = await runtimeFixture(t, { agentStart: async ({ onEvent }) => {
    onEvent({ type: 'session', sessionId: 'right-session' });
    return { finished: finish.promise, cancel: async () => finish.resolve({ exitCode: 1 }) };
  } });
  t.after(() => finish.resolve({ exitCode: 1 }));
  const a = (await f.command(['create', 'Scope A', '--id', 'isolation-a'])).value.projectId;
  const b = (await f.command(['create', 'Scope B', '--id', 'isolation-b'])).value.projectId;
  const runId = (await f.command(['run', a, '--agent', 'claude', '--instruction', 'Fixture only', '--id', 'isolation-start'])).value.runId;
  const base = { id: 'mismatched-report', projectId: a, workerId: 'claude', phase: 'research', message: 'Must remain scoped',
    runId, attemptId: runId, sessionId: 'right-session' };
  const before = f.runtime.activity.list().length;
  for (const patch of [{ projectId: b }, { workerId: 'codex' }, { attemptId: 'other-attempt' }, { sessionId: 'other-session' }]) {
    await assert.rejects(callTool('district_activity', { ...base, ...patch }, f.connectionFile), { code: 'HTTP_ERROR' });
  }
  assert.equal(f.runtime.activity.list().length, before);
  finish.resolve({ exitCode: 1 }); await f.runtime.waitForRun(runId);
});

test('MCP advertises the authoritative command catalog and preserves display/candidate command payloads', async (t) => {
  const f = await httpFixture(t, (_req, res, body) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: body.id, status: 'accepted', projectId: body.projectId, runId: 'candidate-check' }));
  });
  const advertised = TOOLS.find((tool) => tool.name === 'district_command').inputSchema.properties.type.enum;
  assert.deepEqual(advertised, TYPES);
  const commands = [
    { id: 'mcp-display', type: 'set_project_preferences', projectId: 'explicit-project', payload: { testDisplayId: '4k-fixture', testRegion: 'right-half', testBounds: null } },
    { id: 'mcp-window', type: 'open_preview_window', projectId: 'explicit-project', payload: { runId: 'exact-candidate' } },
    { id: 'mcp-visual', type: 'run_visual_checks', projectId: 'explicit-project', payload: { runId: 'exact-candidate' } },
  ];
  for (const command of commands) {
    const result = await callTool('district_command', command, f.connectionFile);
    assert.equal(result.status, 'accepted');
    assert.deepEqual(f.calls.at(-1).body, { ...command, origin: 'mcp' });
  }
  await assert.rejects(callTool('district_command', { id: 'missing-scope', type: 'run_checks' }, f.connectionFile), /explicit projectId/);
  assert.equal(f.calls.length, 3, 'Schema checks and snapshots never dispatch native windows or additional work');
});

test('report input validation is bounded, preserves sequence zero, and refuses fabricated observation fields', async (t) => {
  const f = await httpFixture(t, (_req, res, body) => { res.end(JSON.stringify({ id: body.id, status: 'completed', result: body.payload })); });
  for (const seq of ['-1', '0.5', 'NaN', '9007199254740992', '1e3']) {
    assert.throws(() => buildCommand(parseArgs(['activity', 'p', '--worker', 'w', '--phase', 'research', '--message', 'Reading', '--seq', seq])), /--seq/);
  }
  await assert.rejects(callTool('district_activity', { id: 'forged', projectId: 'p', workerId: 'w', phase: 'research', message: 'Reading', basis: 'observed' }, f.connectionFile), /Unknown tool argument/);
  await assert.rejects(callTool('district_activity', { id: 'bad-sequence', projectId: 'p', workerId: 'w', phase: 'research', message: 'Reading', sourceSeq: -1 }, f.connectionFile), /sourceSeq/);
  await assert.rejects(callTool('district_command', { id: 'nested-bad-sequence', type: 'report_activity', projectId: 'p',
    payload: { workerId: 'w', phase: 'research', message: 'Reading', sourceSeq: '0' } }, f.connectionFile), /sourceSeq/);
  assert.equal(f.calls.length, 0);
  const longId = 'a'.repeat(160);
  const receipt = await callTool('district_activity', { id: longId, projectId: 'p', workerId: 'w', phase: 'research', message: 'Reading', sourceSeq: 0 }, f.connectionFile);
  assert.equal(receipt.result.sourceSeq, 0); assert(receipt.result.id.length <= 160);
  assert.equal(receipt.result.at, undefined); assert.equal(receipt.result.basis, 'reported');
});

test('transport rejects mismatched or malformed receipts and returns retry identity without exposing credentials', async (t) => {
  let mode = 'wrong-id';
  const f = await httpFixture(t, (_req, res, body) => {
    if (mode === 'timeout') return;
    if (mode === 'error') { res.writeHead(409); res.end(JSON.stringify({ error: `Conflict ${f.token}` })); return; }
    res.end(JSON.stringify(mode === 'wrong-id' ? { id: 'different-command', status: 'accepted' } : { id: body.id }));
  });
  const command = { id: 'recoverable-id', type: 'run_checks', origin: 'cli', projectId: 'project' };
  for (mode of ['wrong-id', 'missing-status']) {
    await assert.rejects(request(f.connectionFile, '/command', command), { code: 'INVALID_RESPONSE', commandId: command.id, outcomeUnknown: true });
  }
  mode = 'timeout';
  await assert.rejects(request(f.connectionFile, '/command', command, { timeoutMs: 30 }), (error) => {
    assert.equal(error.commandId, command.id); assert.equal(error.outcomeUnknown, true);
    assert.match(error.message, /same command id/); assert.doesNotMatch(error.message, /new id/); return true;
  });
  mode = 'error';
  const result = await childRun(cli, ['check', 'project', '--id', command.id, '--json', '--connection', f.connectionFile]);
  assert.equal(result.code, 1); const detail = JSON.parse(result.stdout);
  assert.equal(detail.commandId, command.id); assert.equal(detail.code, 'HTTP_ERROR'); assert.equal(detail.statusCode, 409);
  assert(!result.stdout.includes(f.token)); assert.match(detail.error, /\[redacted\]/);
  const input = JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'district_command',
    arguments: { id: 'mcp-recoverable', type: 'run_checks', projectId: 'project' } } }) + '\n';
  const stdio = await childRun(mcp, ['--connection', f.connectionFile], input);
  const reply = JSON.parse(stdio.stdout).result;
  assert.equal(reply.isError, true); assert.equal(reply.structuredContent.commandId, 'mcp-recoverable');
  assert.equal(reply.structuredContent.statusCode, 409); assert(!stdio.stdout.includes(f.token));
});

test('CLI preserves a generated durable command id even when no district connection exists', async () => {
  let stdout = '', stderr = '';
  const code = await main(['check', 'explicit-project', '--connection', path.join(os.tmpdir(), crypto.randomUUID(), 'missing.json'), '--json'],
    { stdout: { write: (value) => { stdout += value; } }, stderr: { write: (value) => { stderr += value; } } });
  assert.equal(code, 1); assert.equal(stderr, ''); const detail = JSON.parse(stdout);
  assert.equal(detail.code, 'NOT_CONNECTED'); assert.match(detail.commandId, /^[a-f0-9-]{36}$/);
});

test('a planted receipt-correlation break is detected through the actual CLI and passes again after restoration', async (t) => {
  const f = await httpFixture(t, (_req, res) => res.end(JSON.stringify({ id: 'unrelated-command', status: 'accepted', runId: 'unrelated-run' })));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-showcase-receipt-break-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const relative of ['bin/district.cjs', 'app/district/client.js', 'app/district/contracts.js', 'app/district/regions.js']) {
    const target = path.join(temp, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repo, relative), target);
  }
  const copiedCli = path.join(temp, 'bin/district.cjs'), copiedClient = path.join(temp, 'app/district/client.js');
  const source = fs.readFileSync(copiedClient, 'utf8');
  const args = ['check', 'project', '--id', 'expected-command', '--json', '--connection', f.connectionFile];
  const assertGuard = (result) => { assert.equal(result.code, 1); assert.equal(JSON.parse(result.stdout).code, 'INVALID_RESPONSE'); };
  assertGuard(await childRun(copiedCli, args));
  const broken = source.replace('value.id !== commandId', 'false');
  assert.notEqual(broken, source); fs.writeFileSync(copiedClient, broken);
  // Fresh Node loads the mutated implementation; no production source is changed.
  const mutant = await childRun(copiedCli, args);
  assert.equal(mutant.code, 0, mutant.stdout);
  assert.throws(() => assertGuard(mutant), assert.AssertionError, 'The behavioral gate must reject a client that accepts another command receipt');
  fs.writeFileSync(copiedClient, source);
  assertGuard(await childRun(copiedCli, args));
});
