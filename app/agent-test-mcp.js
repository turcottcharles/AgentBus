'use strict';
// The model can request a fixed smoke run or describe its activity. It cannot author test evidence.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, execFileSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { CHECKS, emitEvent, validResult } = require('./agent-protocol');
let currentRunner = null;

function loadTicket(file) {
  const t = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isInteger(t.jobId) || !/^[a-f0-9]{64}$/.test(t.key || '') || !path.isAbsolute(t.root) || !path.isAbsolute(t.events)) throw new Error('Invalid job ticket');
  return t;
}
function kill(child) {
  if (!child?.pid || child.exitCode != null || child.signalCode != null) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, timeout: 5000, stdio: 'ignore' }); } catch {}
  } else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
}
function runSmoke(ticket) {
  // Survives MCP reconnect/restart: one ticket can start the actual test only once.
  const claim = path.join(path.dirname(ticket.events), 'smoke.claim');
  const fd = fs.openSync(claim, 'wx', 0o600); fs.closeSync(fd);
  return new Promise((resolve) => {
    let steps = [], summary = null, pending = '', output = '', done = false;
    const decoder = new StringDecoder('utf8');
    const child = spawn(ticket.executable, [path.join(ticket.root, 'app', 'smoke-worker.js'), '--root', ticket.root, '--python', ticket.python], {
      cwd: ticket.root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    currentRunner = child;
    emitEvent(ticket, { type: 'runner_started', pid: child.pid || null });
    const finish = (code, error) => {
      if (done) return; done = true; clearTimeout(timer); clearInterval(cancelPoll);
      if (currentRunner === child) currentRunner = null;
      const passed = !error && validResult(steps, summary, code);
      emitEvent(ticket, { type: 'runner_complete', exitCode: code, state: passed ? 'passed' : 'failed', text: error || (passed ? '6/6 checks passed' : 'Smoke runner failed; inspect the observed check output.') });
      resolve({ state: passed ? 'passed' : 'failed', exitCode: code, steps, output: output.slice(-24000) });
    };
    const record = (line) => {
      if (done || !line.trim()) return;
      let event;
      try { event = JSON.parse(line); } catch { event = { type: 'log', text: line.slice(0, 16000) }; }
      if (event.type === 'step') {
        if (!CHECKS.includes(event.name) || !['running', 'passed', 'failed'].includes(event.state)) return;
        const idx = steps.findIndex((s) => s.name === event.name);
        const step = { name: event.name, state: event.state };
        if (idx < 0) steps.push(step); else steps[idx] = step;
      }
      if (event.type === 'summary') summary = event;
      if (['step', 'summary', 'log'].includes(event.type)) {
        event.text = String(event.text || '').slice(0, 16000);
        output = (output + event.text + '\n').slice(-24000);
        emitEvent(ticket, { type: 'runner_event', event });
      }
    };
    child.stdout.on('data', (data) => {
      pending += decoder.write(data); const lines = pending.split('\n'); pending = lines.pop();
      if (pending.length > 50000) { kill(child); finish(null, 'Runner emitted an oversized event'); return; }
      for (const line of lines) record(line);
    });
    child.stderr.on('data', (data) => emitEvent(ticket, { type: 'runner_stderr', text: data.toString('utf8').slice(0, 8000) }));
    child.once('error', (e) => finish(null, e.message));
    child.once('close', (code) => { pending += decoder.end(); record(pending); finish(code); });
    const timer = setTimeout(() => { kill(child); finish(null, 'Smoke runner exceeded 90 seconds'); }, 90000);
    // The app revokes the ticket on cancel, timeout or shutdown, including after an orphaned CLI exits.
    const cancelPoll = setInterval(() => {
      if (fs.existsSync(path.join(path.dirname(ticket.events), 'cancelled'))) { kill(child); finish(null, 'Assignment revoked by Agent Bus'); }
    }, 200);
    process.once('SIGTERM', () => { kill(child); process.exit(1); });
  });
}

function serve(ticket) {
  let invoked = false;
  const reply = (id, result, error) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...(error ? { error } : { result }) }) + '\n');
  const content = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });
  const input = readline.createInterface({ input: process.stdin });
  input.once('close', () => kill(currentRunner));
  process.stdout.on('error', () => { kill(currentRunner); process.exit(1); });
  input.on('line', async (line) => {
    let req;
    try { req = JSON.parse(line); } catch { return reply(null, null, { code: -32700, message: 'Invalid JSON' }); }
    if (req.id == null) return;
    try {
      if (req.method === 'initialize') return reply(req.id, { protocolVersion: req.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'agent-bus-test', version: '1.0.0' }, instructions: 'Report your activity, invoke run_smoke once, and summarize only its observed results.' });
      if (req.method === 'ping') return reply(req.id, {});
      if (req.method === 'tools/list') return reply(req.id, { tools: [
        { name: 'run_smoke', description: 'Execute this assigned Agent Bus smoke suite once. Reads the assigned source and writes only disposable fixtures and job telemetry; no project edits or external services. Streams actual check progress to the district.', annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true }, inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
        { name: 'report_progress', description: 'Tell the owner what you are doing. Updates this job telemetry only. This is agent-reported activity, never test pass/fail evidence.', annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false }, inputSchema: { type: 'object', properties: { message: { type: 'string', maxLength: 1200 } }, required: ['message'], additionalProperties: false } },
      ] });
      if (req.method !== 'tools/call') return reply(req.id, null, { code: -32601, message: 'Unknown method' });
      const args = req.params?.arguments || {};
      if (req.params.name === 'report_progress') {
        if (Object.keys(args).some((key) => key !== 'message') || typeof args.message !== 'string' || !args.message.trim() || args.message.length > 1200) throw new Error('Use only message (1–1200 characters)');
        emitEvent(ticket, { type: 'agent_progress', text: args.message.trim() });
        return reply(req.id, content('Activity shown on the map. Test status remains based on runner evidence.'));
      }
      if (req.params.name !== 'run_smoke') throw new Error('Unknown tool');
      if (Object.keys(args).length) throw new Error('run_smoke accepts no arguments; the assignment fixes checkout and command');
      if (invoked) throw new Error('This assignment already invoked run_smoke. Summarize its result.');
      invoked = true;
      const result = await runSmoke(ticket);
      return reply(req.id, content(JSON.stringify(result), result.state !== 'passed'));
    } catch (e) { reply(req.id, content(e.message, true)); }
  });
}
if (require.main === module) {
  try { serve(loadTicket(process.env.AGENT_BUS_JOB_TICKET)); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; }
}
module.exports = { loadTicket, runSmoke, serve };
