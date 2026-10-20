'use strict';
// Gated Windows listener: Agent Bus SSE -> Codex Desktop composer.
// Queue, skip, pause, persist, and idle/rollout checks live here so Editor
// can review tracking without driving the UI. Does not stop ChatGPT.exe.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const DEFAULT_MAP = {
  mailbox: 'editor-agent-bus',
  threadId: '01a14ba6-220d-7df3-9e4c-ec3296a8ced5',
  chatTitle: 'Editor agent-bus',
  skipSenders: ['editor-agent-bus', 'hub-47801-probe'],
  idleMs: 8000,
};

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function paths(root, home) {
  const dir = path.join(root, 'var');
  return {
    map: path.join(root, 'codex-desktop-bridge.json'),
    state: path.join(dir, 'codex-desktop-bridge-state.json'),
    pid: path.join(dir, 'codex-desktop-bridge.pid'),
    stop: path.join(dir, 'codex-desktop-bridge.stop'),
    homeState: path.join(home || process.env.USERPROFILE || root, '.agent-bus', 'codex-desktop-bridge.json'),
  };
}

function loadMap(root) {
  return { ...DEFAULT_MAP, ...loadJson(path.join(root, 'codex-desktop-bridge.json'), {}) };
}

function emptyState() {
  return {
    after: 0,
    delivered: [],
    skipped: [],
    pending: [],
    paused: false,
    pauseReason: null,
    lastDelivery: null,
    queue: [],
  };
}

function loadState(file) {
  const st = { ...emptyState(), ...loadJson(file, {}) };
  st.delivered = Array.isArray(st.delivered) ? st.delivered.map(Number) : [];
  st.skipped = Array.isArray(st.skipped) ? st.skipped.map(Number) : [];
  st.pending = Array.isArray(st.pending) ? st.pending.map(Number) : [];
  st.queue = Array.isArray(st.queue) ? st.queue : [];
  st.after = Number(st.after) || 0;
  st.paused = !!st.paused;
  return st;
}

function parseSse(buffer) {
  const frames = [];
  let rest = buffer;
  let split;
  while ((split = rest.indexOf('\n\n')) >= 0) {
    const raw = rest.slice(0, split); rest = rest.slice(split + 2);
    const id = /^id: (\d+)$/m.exec(raw), data = /^data: (.*)$/m.exec(raw);
    if (id && data) frames.push({ id: Number(id[1]), row: JSON.parse(data[1]) });
  }
  return { frames, rest };
}

function shouldSkip(row, map) {
  if (!row || row.id == null) return 'malformed';
  if (row.sender === map.mailbox) return 'loop-self';
  if ((map.skipSenders || []).includes(row.sender)) return 'skip-sender';
  if (row.recipient && row.recipient !== map.mailbox && row.recipient !== 'all') return 'not-for-mailbox';
  const body = String(row.body || '');
  if (/\[Agent Bus .+ → .+ #\d+\]/.test(body) && row.sender === map.mailbox) return 'loop-wrapped';
  return null;
}

function alreadyHandled(id, st) {
  const n = Number(id);
  return (st.delivered || []).includes(n) || (st.skipped || []).includes(n);
}

function noteSkip(st, id, reason) {
  const n = Number(id);
  if (!st.skipped.includes(n)) st.skipped.push(n);
  st.after = Math.max(st.after || 0, n);
  st.queue = (st.queue || []).filter((q) => q.id !== n);
  return { action: 'skip', id: n, reason };
}

function enqueue(st, row) {
  const n = Number(row.id);
  st.after = Math.max(st.after || 0, n);
  if (alreadyHandled(n, st) || (st.pending || []).includes(n) || (st.queue || []).some((q) => q.id === n)) {
    return { action: 'duplicate', id: n };
  }
  st.queue = [...(st.queue || []), { id: n, sender: row.sender, recipient: row.recipient, body: row.body }];
  return { action: 'queued', id: n };
}

function ingestFrame(st, frame, map, mode) {
  const row = frame.row || frame;
  const id = Number(frame.id || row.id);
  st.after = Math.max(st.after || 0, id);
  if (alreadyHandled(id, st)) return { action: 'duplicate', id };
  if (mode === 'catch-up') return noteSkip(st, id, 'catch-up');
  const skip = shouldSkip(row, map);
  if (skip) return noteSkip(st, id, skip);
  return enqueue(st, { ...row, id });
}

function needsCatchUp(st) {
  return (st.after === 0 && (st.delivered || []).length === 0);
}

function markDelivered(st, id, detail) {
  const n = Number(id);
  if (!st.delivered.includes(n)) st.delivered.push(n);
  st.pending = (st.pending || []).filter((x) => x !== n);
  st.queue = (st.queue || []).filter((q) => q.id !== n);
  st.paused = false;
  st.pauseReason = null;
  st.lastDelivery = { id: n, at: new Date().toISOString(), ...detail };
  st.delivered = st.delivered.slice(-400);
  st.skipped = (st.skipped || []).slice(-400);
  return { action: 'delivered', id: n };
}

function pauseUncertain(st, id, reason, extra) {
  const n = Number(id);
  if (!st.pending.includes(n)) st.pending.push(n);
  st.paused = true;
  st.pauseReason = reason;
  st.lastUncertain = { id: n, reason, at: new Date().toISOString(), ...extra };
  return { action: 'pause', id: n, reason };
}

function composePrompt(row) {
  return `[Agent Bus ${row.sender} → ${row.recipient} #${row.id}]\n${row.body}`;
}

function tailText(file, bytes = 65536) {
  const stat = fs.statSync(file);
  const size = Math.min(stat.size, bytes);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, stat.size - size);
    return buf.toString('utf8');
  } finally { fs.closeSync(fd); }
}

function findRollout(codexHome, threadId) {
  const root = path.join(codexHome, 'sessions');
  if (!fs.existsSync(root)) return null;
  const needle = '-' + threadId + '.jsonl';
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.name.endsWith(needle)) return full;
    }
  }
  return null;
}

function rolloutIdle(file, idleMs, now = Date.now()) {
  if (!file || !fs.existsSync(file)) return { idle: false, reason: 'rollout-missing' };
  const stat = fs.statSync(file);
  const age = now - stat.mtimeMs;
  if (age < idleMs) return { idle: false, reason: 'rollout-writing', ageMs: age };
  const lines = tailText(file).trim().split('\n').slice(-40);
  let last = null;
  for (const line of lines) {
    try { last = JSON.parse(line); } catch { /* ignore truncated head */ }
  }
  const kind = last?.payload?.type || last?.type;
  const busy = new Set(['reasoning', 'custom_tool_call', 'custom_tool_call_output', 'function_call', 'CommandExecution', 'McpToolCall']);
  if (kind === 'task_complete' || last?.payload?.type === 'task_complete') return { idle: true, reason: 'task_complete', ageMs: age };
  if (busy.has(kind) || busy.has(last?.payload?.item?.type)) {
    return { idle: false, reason: 'turn-active', kind, ageMs: age };
  }
  return { idle: true, reason: 'quiet', kind, ageMs: age };
}

function rolloutContains(file, needle) {
  if (!file || !fs.existsSync(file) || !needle) return false;
  return tailText(file, 256000).includes(needle);
}

function stopRequested(stopFile) {
  return !!(stopFile && fs.existsSync(stopFile));
}

function writePid(pidFile, pid) {
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(pid));
}

function requestStop(stopFile) {
  fs.mkdirSync(path.dirname(stopFile), { recursive: true });
  fs.writeFileSync(stopFile, new Date().toISOString());
}

function clearStop(stopFile) {
  try { fs.unlinkSync(stopFile); } catch { /* absent */ }
}

function connectSse(url, token, mailbox, after) {
  const target = new URL(`/events?as=${encodeURIComponent(mailbox)}&after=${after}`, url);
  return new Promise((resolve, reject) => {
    const req = http.get(target, { headers: { Authorization: 'Bearer ' + token, Accept: 'text/event-stream' }, agent: false }, (res) => {
      if (res.statusCode !== 200) { reject(new Error('SSE ' + res.statusCode)); res.resume(); return; }
      resolve({ req, res });
    });
    req.on('error', reject);
  });
}

module.exports = {
  DEFAULT_MAP, paths, loadMap, emptyState, loadState, writeJson, loadJson,
  parseSse, shouldSkip, alreadyHandled, ingestFrame, needsCatchUp, markDelivered, pauseUncertain,
  composePrompt, findRollout, rolloutIdle, rolloutContains, tailText,
  stopRequested, writePid, requestStop, clearStop, connectSse,
};
