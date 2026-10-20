'use strict';
// Desktop-owned assignments. Model workers receive a scoped tool; prose cannot produce a pass.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const crypto = require('node:crypto');
const os = require('node:os');
const { CHECKS, ACTIVE, verifyEvent, validResult } = require('./agent-protocol');
const { discoverAgents, launchAgent, parseAgentEvent } = require('./map-agents');

function manifest(root) {
  const paths = ['agent_bus_mcp.py', 'claude_statusline.py', 'package.json',
    ...fs.readdirSync(path.join(root, 'app')).filter((f) => f.endsWith('.js')).map((f) => `app/${f}`)];
  return Object.fromEntries(paths.sort().map((p) => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
}

class MapJobs {
  constructor({ db, root, findPython, executable = process.execPath, timeoutMs = 90000,
    agentTimeoutMs = 180000, agentLaunch = launchAgent, agentDiscovery = discoverAgents }) {
    Object.assign(this, { db, root, findPython, executable, timeoutMs, agentTimeoutMs, agentLaunch, agentDiscovery });
    this.active = null;
    db.exec(`CREATE TABLE IF NOT EXISTS map_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT, building TEXT, state TEXT, created REAL, started REAL, finished REAL,
      sha TEXT, dirty INTEGER, root TEXT, exit_code INTEGER, detail TEXT, steps TEXT, output TEXT, manifest TEXT)`);
    try { db.exec('ALTER TABLE map_jobs ADD COLUMN manifest TEXT'); } catch {}
    for (const [name, type] of [['executor', 'TEXT'], ['session_id', 'TEXT'], ['agent_detail', 'TEXT'], ['agent_output', 'TEXT'], ['agent_exit_code', 'INTEGER'], ['command', 'TEXT']]) {
      try { db.exec(`ALTER TABLE map_jobs ADD COLUMN ${name} ${type}`); } catch {}
    }
    // A previous process cannot still report progress to this instance.
    db.prepare(`UPDATE map_jobs SET state='interrupted', finished=?, detail='App stopped before the result was recorded. Run again to verify.' WHERE state IN (${ACTIVE.map(() => '?').join(',')})`).run(Date.now(), ...ACTIVE);
  }
  async workers() {
    const agents = await this.agentDiscovery();
    return [{ id: '@smoke-runner', name: 'Smoke runner', vendor: 'local', available: true, detail: 'Built-in · no model calls' }, ...agents];
  }
  list() {
    return this.db.prepare('SELECT * FROM map_jobs ORDER BY id DESC LIMIT 30').all()
      .map((r) => ({ ...r, steps: JSON.parse(r.steps || '[]'), manifest: JSON.parse(r.manifest || '{}') }));
  }
  write(id, patch) {
    const keys = Object.keys(patch);
    this.db.prepare(`UPDATE map_jobs SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`)
      .run(...keys.map((k) => patch[k]), id);
  }
  start({ agent, building }) {
    if (building !== 'test') throw new Error('Only the Test building runs jobs in this first district.');
    if (this.active) throw new Error('Test is occupied. Wait for the current run or cancel it.');
    const vendor = agent === '@claude-worker' ? 'claude' : agent === '@codex-worker' ? 'codex' : agent === '@smoke-runner' ? 'local' : null;
    if (!vendor) throw new Error('Choose Smoke runner, Claude test agent, or Codex test agent. A bus registration alone cannot execute a map job.');
    let sha = 'unversioned', dirty = 1;
    try {
      const opts = { cwd: this.root, encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: 'pipe' };
      sha = execFileSync('git', ['rev-parse', 'HEAD'], opts).trim();
      dirty = execFileSync('git', ['status', '--porcelain'], opts).trim() ? 1 : 0;
    } catch { /* Keep the provenance explicitly unversioned. */ }
    const sourceManifest = JSON.stringify(manifest(this.root));
    const r = this.db.prepare(`INSERT INTO map_jobs(agent,building,state,created,sha,dirty,root,detail,steps,output,manifest,executor)
      VALUES(?,?,'assigned',?,?,?,?,?,'[]','',?,?)`).run(agent, building, Date.now(), sha, dirty, this.root,
        vendor === 'local' ? 'Preparing the local smoke-test runner' : `Preparing a real ${vendor} test agent`, sourceManifest, vendor);
    const id = Number(r.lastInsertRowid);
    const run = this.active = { id, vendor, child: null, stopped: false, timer: null, sourceManifest };
    run.timer = setTimeout(() => this.stop(run, 'timed_out', 'Assignment exceeded its time limit. No pass was recorded.'), vendor === 'local' ? this.timeoutMs : this.agentTimeoutMs);
    (vendor === 'local' ? this.execute(run) : this.executeAgent(run)).catch((e) => this.stop(run, 'failed', e.message));
    return { id };
  }
  async executeAgent(run) {
    const python = await this.findPython();
    if (run.stopped) return;
    if (!python) throw new Error('Python 3 with sqlite3 is required. Open Setup to configure Python.');
    const dir = run.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-assignment-'));
    const ticket = run.ticket = { jobId: run.id, key: crypto.randomBytes(32).toString('hex'), root: this.root,
      python, executable: this.executable, events: path.join(dir, 'events.jsonl') };
    fs.writeFileSync(ticket.events, '', { flag: 'wx', mode: 0o600 });
    const ticketPath = path.join(dir, 'ticket.json'), configPath = path.join(dir, 'mcp.json');
    fs.writeFileSync(ticketPath, JSON.stringify(ticket), { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { agent_bus_test: {
      command: this.executable, args: [path.join(this.root, 'app', 'agent-test-mcp.js')],
      env: { AGENT_BUS_JOB_TICKET: ticketPath, ELECTRON_RUN_AS_NODE: '1' },
    } } }), { flag: 'wx', mode: 0o600 });
    const prompt = `You are the ${run.vendor} test worker assigned to the Test building in Agent Bus, job #${run.id}. `
      + 'Perform this task using ONLY the agent_bus_test MCP tools already provided. First report_progress with a brief public activity message. '
      + 'Then call run_smoke exactly once with no arguments, wait for its actual result, and summarize which checks passed or failed in one short paragraph. '
      + 'Do not run a shell, edit files, search documentation, contact other agents, use a keyring, or infer a pass without the run_smoke result. '
      + 'If the tool is unavailable, report that failure and stop. This assignment does not require reading project instructions or any other files. '
      + `The assigned checkout is ${this.root}; the tool fixes its command and uses disposable databases.`;
    const child = run.child = this.agentLaunch({ vendor: run.vendor, root: this.root, executable: this.executable, configPath, prompt });
    this.write(run.id, { state: 'starting_agent', started: Date.now(), detail: `Starting ${run.vendor}; waiting for its smoke-tool invocation`, command: `${run.vendor} scoped headless session → agent_bus_test.run_smoke` });
    let offset = 0, pending = '', steps = [], summary = null, result = null, output = '', agentOutput = '', cliPending = '', agentError = '';
    const seen = new Set(), decoder = new StringDecoder('utf8'), cliDecoder = new StringDecoder('utf8');
    const consume = () => {
      if (run.stopped) return;
      const size = fs.statSync(ticket.events).size;
      if (size > 1024 * 1024 || size < offset) throw new Error('Agent event log exceeded its limit or was replaced');
      if (size > offset) {
        const fd = fs.openSync(ticket.events, 'r'); const buf = Buffer.alloc(size - offset);
        try { fs.readSync(fd, buf, 0, buf.length, offset); } finally { fs.closeSync(fd); }
        offset = size; pending += decoder.write(buf);
      }
      const lines = pending.split('\n'); pending = lines.pop();
      if (pending.length > 60000) throw new Error('Oversized agent event');
      for (const line of lines) {
        if (!line.trim()) continue;
        const e = verifyEvent(ticket, JSON.parse(line));
        if (seen.has(e.id)) continue; seen.add(e.id);
        if (e.type === 'agent_progress') {
          const text = String(e.text || '').slice(0, 1200);
          this.write(run.id, { agent_detail: text, ...(steps.length ? {} : { state: 'agent_working', detail: 'Agent accepted the assignment; awaiting observed test execution' }) });
          agentOutput = (agentOutput + `Agent report: ${text}\n`).slice(-24000);
        } else if (e.type === 'runner_started') {
          this.write(run.id, { state: 'running', detail: `${run.vendor} invoked the smoke tool; observing actual checks` });
        } else if (e.type === 'runner_event') {
          const event = e.event;
          if (event.type === 'step') {
            if (!CHECKS.includes(event.name) || !['running', 'passed', 'failed'].includes(event.state)) throw new Error('Invalid observed check');
            const idx = steps.findIndex((s) => s.name === event.name);
            if (idx < 0) steps.push(event); else steps[idx] = event;
          }
          if (event.type === 'summary') summary = event;
          output = (output + String(event.text || event.name || '').slice(0, 16000) + '\n').slice(-60000);
          this.write(run.id, { output, steps: JSON.stringify(steps), detail: event.type === 'step' ? `${event.state}: ${event.name}` : 'Collecting runner evidence' });
        } else if (e.type === 'runner_stderr') {
          output = (output + String(e.text).slice(0, 8000)).slice(-60000);
          this.write(run.id, { output });
        } else if (e.type === 'runner_complete') {
          result = e;
          this.write(run.id, { state: 'agent_review', exit_code: e.exitCode, detail: 'Smoke runner finished; waiting for the agent summary' });
        } else throw new Error('Unknown agent event type');
        this.write(run.id, { agent_output: agentOutput });
      }
    };
    run.poll = setInterval(() => { try { consume(); } catch (e) { this.stop(run, 'failed', e.message); } }, 200);
    const agentLine = (line) => {
      if (run.stopped || !line.trim()) return;
      const event = parseAgentEvent(run.vendor, line);
      if (!event) return;
      if (event.sessionId) this.write(run.id, { session_id: event.sessionId });
      if (event.detail || event.error) {
        if (event.error) agentError = event.error;
        agentOutput = (agentOutput + (event.error ? `Agent error: ${event.error}` : event.detail) + '\n').slice(-24000);
        this.write(run.id, { agent_output: agentOutput });
      }
    };
    child.stdout.on('data', (data) => {
      cliPending += cliDecoder.write(data); const lines = cliPending.split('\n'); cliPending = lines.pop();
      if (cliPending.length > 1000000) return this.stop(run, 'failed', 'Agent emitted an oversized stream event');
      for (const line of lines) agentLine(line);
    });
    child.stderr.on('data', (data) => {
      if (run.stopped) return;
      agentOutput = (agentOutput + data.toString('utf8').slice(0, 8000)).slice(-24000);
      this.write(run.id, { agent_output: agentOutput });
    });
    child.once('error', (e) => this.stop(run, 'failed', `Could not start ${run.vendor}: ${e.message}`));
    child.once('close', (code) => {
      if (run.stopped) return;
      try { consume(); } catch (e) { this.stop(run, 'failed', e.message); return; }
      cliPending += cliDecoder.end(); agentLine(cliPending);
      this.write(run.id, { agent_exit_code: code });
      let unchanged = false;
      try { unchanged = JSON.stringify(manifest(this.root)) === run.sourceManifest; } catch {}
      const passed = unchanged && !agentError && code === 0 && result?.state === 'passed' && validResult(steps, summary, result.exitCode);
      const detail = !unchanged ? 'Source files changed during assignment; run again to verify.' :
        !result ? agentError ? `${run.vendor}: ${agentError.slice(0, 400)}` : `${run.vendor} ended without a verified smoke result. Inspect agent output for permissions, login or quota errors.` :
          code !== 0 ? `Smoke execution ended, but ${run.vendor} exited with code ${code}. No completed agent pass was recorded.` :
            agentError ? `${run.vendor} reported an error after the smoke run: ${agentError.slice(0, 400)}` :
            passed ? `6/6 checks passed; ${run.vendor} completed the assignment` : 'The agent ran the smoke suite; one or more checks failed. Inspect execution evidence.';
      this.finish(run, passed ? 'passed' : 'failed', result?.exitCode ?? null, detail);
    });
  }
  async execute(run) {
    const python = await this.findPython();
    if (run.stopped) return;
    if (!python) throw new Error('Python 3 with sqlite3 is required. Open Setup to install/configure Python.');
    const worker = path.join(this.root, 'app', 'smoke-worker.js');
    const child = run.child = spawn(this.executable, [worker, '--root', this.root, '--python', python], {
      cwd: this.root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    this.write(run.id, { state: 'running', started: Date.now(), detail: 'Running real checks in a disposable bus' });
    let pending = '', output = '', steps = [], summary = null;
    const decoder = new StringDecoder('utf8');
    const record = (line) => {
      if (run.stopped || !line.trim()) return;
      let event;
      try { event = JSON.parse(line); } catch { event = { type: 'log', text: line }; }
      if (event.type === 'step') {
        const idx = steps.findIndex((s) => s.name === event.name);
        if (idx < 0) steps.push(event); else steps[idx] = event;
      }
      if (event.type === 'summary') summary = event;
      output = (output + (event.text || `${event.name || event.type}: ${event.state || ''}`) + '\n').slice(-60000);
      this.write(run.id, { steps: JSON.stringify(steps), output, detail: event.text || event.name || 'Running' });
    };
    child.stdout.on('data', (data) => {
      pending += decoder.write(data);
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) record(line);
    });
    child.stderr.on('data', (data) => {
      if (run.stopped) return;
      output = (output + data.toString('utf8')).slice(-60000);
      this.write(run.id, { output });
    });
    child.once('error', (e) => this.finish(run, 'failed', null, `Could not start runner: ${e.message}`));
    child.once('close', (code) => {
      pending += decoder.end(); record(pending);
      if (run.stopped) return;
      let unchanged = false;
      try { unchanged = JSON.stringify(manifest(this.root)) === run.sourceManifest; } catch {}
      const passed = unchanged && validResult(steps, summary, code);
      this.finish(run, passed ? 'passed' : 'failed', code,
        !unchanged ? 'Source files changed during this run. Run again to verify the new checkout.' :
          passed ? `${steps.length}/${steps.length} smoke checks passed` : steps.some((s) => s.state === 'failed') ?
            `${steps.find((s) => s.state === 'failed').name} failed. Open execution evidence for the error.` :
            `Runner exited with code ${code} without a complete pass result; see output.`);
    });
  }
  finish(run, state, code, detail) {
    if (run.stopped) return;
    run.stopped = true; clearTimeout(run.timer); clearInterval(run.poll);
    if (run.dir) {
      try { fs.writeFileSync(path.join(run.dir, 'cancelled'), state, { mode: 0o600 }); } catch {}
      // Revoke the secret; retained event logs contain evidence, not reusable capabilities.
      for (const file of ['ticket.json', 'mcp.json']) { try { fs.unlinkSync(path.join(run.dir, file)); } catch {} }
    }
    this.write(run.id, { state, exit_code: code, finished: Date.now(), detail });
    if (this.active === run) this.active = null;
  }
  stop(run, state, detail) {
    if (!run || run.stopped) return;
    const child = run.child;
    this.finish(run, state, null, detail);
    // The worker owns bounded synchronous probes; kill its exact process tree on Windows.
    if (child?.pid && child.exitCode == null && child.signalCode == null) {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, timeout: 5000, stdio: 'ignore' }); } catch {}
      } else child.kill('SIGTERM');
    }
  }
  cancel(id) {
    if (!this.active || this.active.id !== Number(id)) throw new Error('That job is no longer running.');
    this.stop(this.active, 'cancelled', 'Cancelled by the owner. No pass result was recorded.');
  }
  close() { this.stop(this.active, 'interrupted', 'App closed during the smoke test. Run again to verify.'); }
}
module.exports = { MapJobs };
