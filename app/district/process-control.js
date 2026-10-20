'use strict';

const path = require('node:path');
const { ChildProcess, spawn } = require('node:child_process');

const stopping = new WeakMap();

// Limits count UTF-16 code units. Keep the diagnostic tail without first
// allocating an unbounded concatenation or leaving a split surrogate pair.
function boundedAppend(current, text, max = 100000) {
  if (!Number.isSafeInteger(max) || max < 0) throw new RangeError('Output limit must be a non-negative safe integer.');
  if (max === 0) return '';
  const incoming = text == null ? '' : String(text);
  const previous = current == null ? '' : String(current);
  let result = incoming.length >= max ? incoming.slice(-max) : previous.slice(-(max - incoming.length)) + incoming;
  if (result.length && /[\uDC00-\uDFFF]/.test(result[0])) result = result.slice(1);
  return result;
}

// Categories are labels only: the caller retains the original diagnostic and
// must never infer success, quota availability or authority from this result.
function classifyProviderError(text) {
  const value = boundedAppend('', text, 100000).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
  if (/\b(?:insufficient[_ -]quota|quota|usage[_ -]limit(?:[_ -](?:error|exceeded|reached))?|rate[_ -]limit(?:ed)?(?:[_ -](?:error|exceeded|reached))?|credit balance|too many requests|429)\b|you(?:'ve| have) (?:hit|reached) (?:your |the )?limit/i.test(value)) return 'quota';
  if (/\b(?:unauthenticated|unauthorized|401|403|authentication[_ -](?:error|failed)|invalid[_ -]api[_ -]key)\b|not (?:logged|signed) in|(?:log|sign) in (?:first|again)|(?:auth|access) token (?:has )?expired/i.test(value)) return 'auth';
  if (/\b(?:ENOENT|command not found)\b|not recognized as (?:an? )?(?:internal|external) command|(?:cli|command|executable) (?:is )?(?:unavailable|not installed)|cannot find module/i.test(value)) return 'unavailable';
  if (/\b(?:ETIMEDOUT|timeout|timed out|deadline exceeded)\b/i.test(value)) return 'timeout';
  if (/\b(?:cancelled|canceled|AbortError|aborted)\b|interrupted by (?:the )?user/i.test(value)) return 'cancelled';
  if (/\b(?:ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|network error|socket hang up|failed to fetch)\b/i.test(value)) return 'network';
  return 'unknown';
}

function exited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForExit(child, timeoutMs) {
  if (exited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer;
    const finish = (value) => {
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      resolve(value);
    };
    const onExit = () => finish(true);
    const onError = () => finish(exited(child));
    child.once('exit', onExit);
    child.once('error', onError);
    timer = setTimeout(() => finish(exited(child)), timeoutMs);
    if (exited(child)) finish(true);
  });
}

function runHelper(command, args, timeoutMs) {
  return new Promise((resolve) => {
    let helper;
    let output = '', errorOutput = '', timer, settled = false, outputTruncated = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, output, errorOutput, outputTruncated });
    };
    try {
      helper = spawn(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      finish({ ok: false, code: null, error: error.message });
      return;
    }
    helper.stdout.on('data', (data) => {
      const text = String(data);
      if (output.length + text.length > 12000) outputTruncated = true;
      output = boundedAppend(output, text, 12000);
    });
    helper.stderr.on('data', (data) => { errorOutput = boundedAppend(errorOutput, data, 12000); });
    helper.once('error', (error) => finish({ ok: false, code: null, error: error.message }));
    helper.once('close', (code, signal) => finish({ ok: code === 0 && signal === null, code, signal, error: null }));
    timer = setTimeout(() => {
      // This helper was spawned here. Never stop it by a process-name match.
      try { helper.kill('SIGKILL'); } catch {}
      finish({ ok: false, code: null, error: 'Process-control helper timed out.' });
    }, timeoutMs);
  });
}

function processRows(output) {
  const rows = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)/.exec(line);
    if (match) rows.set(Number(match[1]), { pid: Number(match[1]), parent: Number(match[2]), state: match[3] });
  }
  return rows;
}

function descendants(rows, rootPid) {
  const result = [], owned = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows.values()) {
      if (!owned.has(row.pid) && owned.has(row.parent)) {
        owned.add(row.pid);
        result.push(row.pid);
        changed = true;
      }
    }
  }
  return result;
}

function signalPid(pid, signal) {
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) return 'Invalid owned PID.';
  try { process.kill(pid, signal); return null; } catch (error) { return error.code === 'ESRCH' ? null : error.message; }
}

async function stopOwned(child, graceMs) {
  const pid = child.pid;
  const result = { confirmed: false, rootExited: false, treeConfirmed: false, pid, requested: false,
    method: process.platform === 'win32' ? 'taskkill-owned-pid-tree' : 'owned-descendant-snapshot',
    exitCode: null, signal: null, error: null, descendantPids: [] };
  const finish = () => {
    result.rootExited = exited(child);
    result.exitCode = child.exitCode;
    result.signal = child.signalCode;
    result.confirmed = result.rootExited && result.treeConfirmed;
    if (!result.rootExited) result.error = boundedAppend(result.error ? result.error + '\n' : '',
      'Stop was requested, but process exit was not confirmed before the deadline.', 2000);
    return result;
  };
  if (exited(child)) {
    result.method = 'already-exited';
    result.error = 'Owned process already exited; descendant state is unknown. No PID was signalled.';
    return finish();
  }
  // Windows taskkill can spend several seconds obtaining the process tree.
  // Its fixed ceiling is separate from the caller's post-signal grace period.
  const helperTimeout = 5000;
  if (process.platform === 'win32') {
    // Node's Windows kill is not a graceful tree stop. Ask the native tool to
    // stop precisely this owned root and its descendants, then observe exit.
    const systemRoot = process.env.SystemRoot || process.env.WINDIR;
    const command = systemRoot ? path.join(systemRoot, 'System32', 'taskkill.exe') : 'taskkill.exe';
    result.requested = true;
    const killed = await runHelper(command, ['/pid', String(pid), '/t', '/f'], helperTimeout);
    result.treeConfirmed = killed.ok;
    if (!killed.ok) {
      result.error = killed.error || boundedAppend('', killed.errorOutput || killed.output || `taskkill exited ${killed.code}.`, 2000).trim();
      // A failed tree stop must still attempt the original process handle.
      // Keep treeConfirmed false even if this root-only fallback succeeds.
      if (!exited(child)) { try { child.kill('SIGKILL'); } catch {} }
    }
    await waitForExit(child, Math.max(250, graceMs));
    return finish();
  }

  const inventory = await runHelper('/bin/ps', ['-eo', 'pid=,ppid=,stat='], helperTimeout);
  if (exited(child)) {
    result.method = 'exited-before-stop';
    result.error = 'Owned process exited before its tree could be stopped; descendant state is unknown.';
    return finish();
  }
  const completeInventory = inventory.ok && !inventory.outputTruncated;
  if (completeInventory) result.descendantPids = descendants(processRows(inventory.output), pid);
  else result.error = inventory.error || 'Could not inspect descendants of the owned process.';
  const errors = [];
  for (const ownedPid of [...result.descendantPids].reverse()) {
    const error = signalPid(ownedPid, 'SIGTERM');
    if (error) errors.push(error);
  }
  result.requested = true;
  try { child.kill('SIGTERM'); } catch (error) { errors.push(error.message); }
  await waitForExit(child, graceMs);
  // Descendants can outlive their root. The pre-stop snapshot is the only set
  // we may signal after reparenting; never discover ownership by name.
  for (const ownedPid of [...result.descendantPids].reverse()) {
    const error = signalPid(ownedPid, 'SIGKILL');
    if (error) errors.push(error);
  }
  if (!exited(child)) { try { child.kill('SIGKILL'); } catch (error) { errors.push(error.message); } }
  await waitForExit(child, Math.max(250, graceMs));
  if (completeInventory) {
    const check = await runHelper('/bin/ps', ['-eo', 'pid=,ppid=,stat='], helperTimeout);
    if (check.ok && !check.outputTruncated) {
      const rows = processRows(check.output);
      // A zombie is terminated and cannot execute code; its parent still owns
      // reaping it. This is not a claim that a kernel PID record disappeared.
      const live = result.descendantPids.filter((ownedPid) => rows.has(ownedPid) && !/^Z/.test(rows.get(ownedPid).state));
      result.treeConfirmed = live.length === 0 && errors.length === 0;
      if (live.length) result.error = `Owned descendants did not exit before the deadline: ${live.join(', ')}.`;
    } else result.error = check.error || 'Could not confirm owned descendant termination.';
  }
  if (errors.length) result.error = boundedAppend(result.error || '', errors.join('\n'), 2000);
  return finish();
}

// Only an actual ChildProcess returned to this caller is accepted. A PID or
// an object with a pid field is not evidence that the caller owns that process.
function stopProcessTree(child, { graceMs = 1000 } = {}) {
  if (!(child instanceof ChildProcess) || !Number.isSafeInteger(child.pid) || child.pid <= 1 || child.pid === process.pid) {
    return Promise.resolve({ confirmed: false, rootExited: false, treeConfirmed: false, pid: null, requested: false,
      method: 'refused', exitCode: null, signal: null, error: 'An owned, successfully spawned ChildProcess is required.', descendantPids: [] });
  }
  if (stopping.has(child)) return stopping.get(child);
  const boundedGrace = Number.isFinite(graceMs) ? Math.max(0, Math.min(10000, Math.floor(graceMs))) : 1000;
  const pending = stopOwned(child, boundedGrace).catch((error) => ({ confirmed: false, rootExited: exited(child),
    treeConfirmed: false, pid: child.pid, requested: true, method: 'stop-error', exitCode: child.exitCode,
    signal: child.signalCode, error: boundedAppend('', error.message || error, 2000), descendantPids: [] }));
  stopping.set(child, pending);
  // Coalesce in-flight requests and retain a confirmed receipt. A failed stop
  // of a still-live child must permit an explicit retry of that same handle.
  pending.then((result) => { if (!result.confirmed && stopping.get(child) === pending) stopping.delete(child); });
  return pending;
}

module.exports = { stopProcessTree, boundedAppend, classifyProviderError };
