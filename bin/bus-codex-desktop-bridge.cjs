'use strict';
// Gated Windows listener: SSE -> exact Editor chat composer.
// Does not stop Codex Desktop or its app-server. Stop only this process.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const core = require('../app/codex-desktop-bridge');

const ROOT = path.resolve(__dirname, '..');
const files = core.paths(ROOT);
function injectPath() {
  return path.join(__dirname, 'codex-desktop-uia-inject.ps1');
}

function ui(mode, text, map, needle) {
  const args = [
    '-STA', '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', injectPath(),
    '-Mode', mode,
    '-TargetChat', map.chatTitle || 'Editor agent-bus',
  ];
  if (text) args.push('-Text', text);
  if (needle) args.push('-Needle', needle);
  const r = spawnSync('powershell', args, { encoding: 'utf8', timeout: 25000, windowsHide: true });
  const lines = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  let parsed = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try { parsed = JSON.parse(lines[i]); break; } catch { /* banner */ }
  }
  if (!parsed) {
    return { ok: false, reason: 'ui-unparsed', uncertain: true, status: r.status, stderr: (r.stderr || '').slice(-400) };
  }
  return parsed;
}

function persist(st) {
  core.writeJson(files.state, st);
}

function gates(map) {
  const rollout = core.findRollout(path.join(process.env.USERPROFILE || '', '.codex'), map.threadId);
  const idle = core.rolloutIdle(rollout, map.idleMs || 8000);
  if (!idle.idle) return { ok: false, reason: idle.reason, idle };
  const probe = ui('probe', '', map);
  if (!probe.ok) return { ok: false, reason: probe.reason || 'probe-failed', probe, idle };
  return { ok: true, idle, probe, rollout };
}

function deliverUi(map, row, rollout) {
  const text = core.composePrompt(row);
  const needle = '#' + row.id;
  const sent = ui('send', text, map, needle);
  if (!sent.ok) {
    return { ok: false, uncertain: !!sent.uncertain, detail: sent };
  }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (core.rolloutContains(rollout, needle) || core.rolloutContains(rollout, text.slice(0, 48))) {
      return { ok: true, mode: 'desktop-ui', detail: sent };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  return { ok: false, uncertain: true, reason: 'rollout-unconfirmed', detail: sent };
}

async function listen() {
  const map = core.loadMap(ROOT);
  core.clearStop(files.stop);
  let st = core.loadState(files.state);
  core.writePid(files.pid, process.pid);
  persist(st);
  const desc = core.loadJson(path.join(ROOT, 'bus-connection.json'), null);
  if (!desc?.url || !desc.token) throw new Error('bus-connection.json missing; start Agent Bus on 47801');
  const { req, res } = await core.connectSse(desc.url, desc.token, map.mailbox, st.after || 0);
  process.stdout.write(JSON.stringify({
    listening: map.mailbox, threadId: map.threadId, chatTitle: map.chatTitle,
    after: st.after, state: files.state, pid: process.pid, stop: 'node bin/bus-codex-desktop-bridge.cjs stop',
  }) + '\n');

  let buf = '';
  let chain = Promise.resolve();
  let catchUp = core.needsCatchUp(st);
  let catchTimer = null;
  const stopTimer = setInterval(() => {
    if (core.stopRequested(files.stop)) {
      process.stdout.write(JSON.stringify({ stopping: true }) + '\n');
      try { req.destroy(); } catch { /* */ }
      try { res.destroy(); } catch { /* */ }
      clearInterval(stopTimer);
    }
  }, 500);

  async function pump() {
    if (core.stopRequested(files.stop)) return;
    if (st.paused) {
      process.stdout.write(JSON.stringify({ paused: true, reason: st.pauseReason, pending: st.pending }) + '\n');
      return;
    }
    while (st.queue.length && !st.paused && !core.stopRequested(files.stop)) {
      const row = st.queue[0];
      const g = gates(map);
      if (!g.ok) {
        persist(st);
        process.stdout.write(JSON.stringify({ waiting: row.id, reason: g.reason }) + '\n');
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const result = deliverUi(map, row, g.rollout);
      if (result.ok) {
        core.markDelivered(st, row.id, { mode: result.mode });
        persist(st);
        process.stdout.write(JSON.stringify({ messageId: row.id, result }) + '\n');
      } else if (result.uncertain) {
        core.pauseUncertain(st, row.id, result.reason || result.detail?.reason || 'uncertain-submit', result.detail);
        persist(st);
        process.stdout.write(JSON.stringify({ paused: true, messageId: row.id, result }) + '\n');
        return;
      } else {
        persist(st);
        process.stdout.write(JSON.stringify({ waiting: row.id, result }) + '\n');
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    buf += chunk;
    const parsed = core.parseSse(buf); buf = parsed.rest;
    for (const frame of parsed.frames) {
      const decision = core.ingestFrame(st, frame, map, catchUp ? 'catch-up' : undefined);
      persist(st);
      process.stdout.write(JSON.stringify(decision) + '\n');
    }
    if (catchUp && parsed.frames.length) {
      if (catchTimer) clearTimeout(catchTimer);
      catchTimer = setTimeout(() => {
        catchUp = false;
        persist(st);
        process.stdout.write(JSON.stringify({ catchUpComplete: true, after: st.after }) + '\n');
      }, 400);
    }
    chain = chain.then(pump).catch((err) => {
      process.stderr.write(String(err) + '\n');
    });
  });
  res.on('end', () => { persist(st); clearInterval(stopTimer); });
  process.on('SIGINT', () => { core.requestStop(files.stop); });
  chain = chain.then(pump).catch((err) => { process.stderr.write(String(err) + '\n'); });
}

function stop() {
  core.requestStop(files.stop);
  const pid = Number((fs.existsSync(files.pid) && fs.readFileSync(files.pid, 'utf8')) || 0);
  if (pid && pid !== process.pid) {
    try {
      const { execSync } = require('node:child_process');
      const cl = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`, { encoding: 'utf8' });
      if (cl.includes('bus-codex-desktop-bridge')) process.kill(pid);
    } catch { /* already gone */ }
  }
  process.stdout.write(JSON.stringify({ stop: true, pid: pid || null }) + '\n');
}

function status() {
  const st = core.loadState(files.state);
  process.stdout.write(JSON.stringify({
    state: files.state, ...st, stopFile: fs.existsSync(files.stop),
    pidFile: fs.existsSync(files.pid) ? fs.readFileSync(files.pid, 'utf8').trim() : null,
  }, null, 2) + '\n');
}

const cmd = process.argv[2] || 'listen';
if (cmd === 'listen') listen().catch((e) => {
  if (core.stopRequested(files.stop)) process.exit(0);
  console.error(e);
  process.exit(1);
});
else if (cmd === 'stop') stop();
else if (cmd === 'status') status();
else if (cmd === 'probe') {
  const map = core.loadMap(ROOT);
  process.stdout.write(JSON.stringify(gates(map), null, 2) + '\n');
}
else {
  console.error('Usage: node bin/bus-codex-desktop-bridge.cjs listen|stop|status|probe');
  process.exit(2);
}
