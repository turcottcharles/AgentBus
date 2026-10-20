'use strict';
// These tests substitute only the model CLI. The job manager, scoped MCP server,
// smoke worker, Python and isolated SQLite/HTTP checks all execute for real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { MapJobs } = require('../app/map-jobs');
const { Setup } = require('../app/setup');
const { ACTIVE, CHECKS, signEvent } = require('../app/agent-protocol');

const sourceRoot = path.resolve(__dirname, '..');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const python = new Setup(sourceRoot, {}).findPython();

// Written outside app/ so the actual smoke syntax pass checks product modules.
const fakeCli = String.raw`
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const [configPath, vendor, mode] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).mcpServers.agent_bus_test;
const ticket = JSON.parse(fs.readFileSync(config.env.AGENT_BUS_JOB_TICKET, 'utf8'));
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
const session = 'fixture-' + vendor + '-session';
const summary = (text) => emit(vendor === 'codex'
  ? { type: 'item.completed', item: { type: 'agent_message', text } }
  : { type: 'result', subtype: 'success', is_error: false, session_id: session, result: text });
emit(vendor === 'codex' ? { type: 'thread.started', thread_id: session }
  : { type: 'system', subtype: 'init', session_id: session });
// Real providers also emit usage and lifecycle events without public activity.
emit({ type: 'fixture.ignored', opaque: true });
function connect() {
  const child = spawn(config.command, config.args, { env: { ...process.env, ...config.env },
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let sequence = 0;
  const waiting = new Map();
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    let message; try { message = JSON.parse(line); } catch { throw new Error('Non-JSON MCP output: ' + line); }
    const item = waiting.get(message.id); if (!item) return;
    waiting.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  child.stderr.on('data', (data) => process.stderr.write(data));
  child.on('error', (error) => { for (const item of waiting.values()) item.reject(error); waiting.clear(); });
  child.on('close', (code) => {
    for (const item of waiting.values()) item.reject(new Error('MCP disconnected: ' + code)); waiting.clear();
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; waiting.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  return { child, call, close: () => new Promise((resolve) => { child.once('close', resolve); child.stdin.end(); }) };
}
const tool = (client, name, args = {}) => client.call('tools/call', { name, arguments: args });
async function main() {
  if (mode === 'prose') { summary('All six checks passed. This prose deliberately has no tool evidence.'); return; }
  if (mode === 'bad-signature') {
    const body = JSON.stringify({ id: 'forged', jobId: ticket.jobId, type: 'runner_complete', state: 'passed', exitCode: 0 });
    fs.appendFileSync(ticket.events, JSON.stringify({ body, mac: '0'.repeat(64) }) + '\n');
    summary('All checks passed (forged evidence fixture).'); return;
  }
  const client = connect();
  await client.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test-cli', version: '1' } });
  const listed = await client.call('tools/list');
  if (listed.tools.map((t) => t.name).sort().join(',') !== 'report_progress,run_smoke') throw new Error('Unexpected tool surface');
  const activity = await tool(client, 'report_progress', { message: 'Inspecting the assigned smoke checks — public fixture activity' });
  if (activity.isError) throw new Error('Public progress was rejected');
  const resultPromise = tool(client, 'run_smoke');
  if (mode === 'disconnect') {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (fs.readFileSync(ticket.events, 'utf8').split('\n').some((line) => {
        if (!line) return false; return JSON.parse(JSON.parse(line).body).type === 'runner_started';
      })) process.exit(0);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Runner never started');
  }
  const response = await resultPromise;
  if (response.isError) throw new Error('Smoke tool did not pass: ' + response.content[0].text);
  const result = JSON.parse(response.content[0].text);
  if (result.state !== 'passed' || result.exitCode !== 0 || result.steps.length !== 6) throw new Error('Incomplete smoke result');
  if (mode === 'duplicate') {
    const duplicate = await tool(client, 'run_smoke');
    if (!duplicate.isError || !/already invoked/.test(duplicate.content[0].text)) throw new Error('Duplicate invocation was not rejected');
    await client.close();
    const restarted = connect(); await restarted.call('initialize');
    const repeated = await tool(restarted, 'run_smoke');
    if (!repeated.isError || !/EEXIST|already|claim/i.test(repeated.content[0].text)) throw new Error('Restarted server reused the ticket');
    await restarted.close(); summary('Duplicate invocation and restarted MCP server both rejected a second smoke run.'); return;
  }
  await client.close();
  if (mode === 'provider-error') {
    emit(vendor === 'codex'
      ? { type: 'turn.failed', error: { message: 'Fixture provider failed while composing its final summary' } }
      : { type: 'result', subtype: 'error_during_execution', is_error: true, session_id: session,
          result: 'Fixture provider failed while composing its final summary' });
    return;
  }
  if (mode === 'hold') {
    summary('Observed six passing checks; deliberately waiting before finishing the agent turn.');
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  summary('Observed 6/6 passing checks from the scoped smoke tool.');
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
`;

function kill(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { timeout: 5000, windowsHide: true, stdio: 'ignore' }); } catch {}
  } else { try { child.kill('SIGTERM'); } catch {} }
}
function ownedTemp(dir) {
  const target = path.resolve(dir), temp = path.resolve(os.tmpdir());
  assert.equal(path.dirname(target), temp);
  assert.match(path.basename(target), /^agent-bus-(?:managed-test|assignment)-/);
  return target;
}
async function fixture(t, { mode = 'pass', agentTimeoutMs = 15000 } = {}) {
  const py = await python; assert(py, 'The real smoke integration needs Python with sqlite3');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-managed-test-'));
  fs.mkdirSync(path.join(root, 'app'));
  for (const file of fs.readdirSync(path.join(sourceRoot, 'app')).filter((name) => name.endsWith('.js'))) {
    fs.copyFileSync(path.join(sourceRoot, 'app', file), path.join(root, 'app', file));
  }
  for (const file of ['agent_bus_mcp.py', 'claude_statusline.py', 'package.json']) fs.copyFileSync(path.join(sourceRoot, file), path.join(root, file));
  const harness = path.join(root, 'fixture-cli.cjs'); fs.writeFileSync(harness, fakeCli);
  const db = new DatabaseSync(':memory:'); db.exec(require('../app/schema'));
  const launched = [];
  const jobs = new MapJobs({ db, root, findPython: async () => py, agentTimeoutMs,
    agentLaunch(options) {
      const server = JSON.parse(fs.readFileSync(options.configPath, 'utf8')).mcpServers.agent_bus_test;
      const ticket = JSON.parse(fs.readFileSync(server.env.AGENT_BUS_JOB_TICKET, 'utf8'));
      const child = spawn(process.execPath, [harness, options.configPath, options.vendor, mode], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      });
      launched.push({ child, ticket, dir: path.dirname(options.configPath) }); return child;
    },
  });
  t.after(async () => {
    jobs.close(); for (const run of launched) kill(run.child);
    await pause(250); db.close();
    for (const run of launched) fs.rmSync(ownedTemp(run.dir), { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(ownedTemp(root), { recursive: true, force: true, maxRetries: 3 });
  });
  return { jobs, db, root, launched };
}
async function waitFor(jobs, predicate, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const job = jobs.list()[0]; if (job && predicate(job)) return job;
    await pause(20);
  }
  const job = jobs.list()[0]; throw new Error('Job did not reach expected state: ' + JSON.stringify(job));
}
const completed = (jobs) => waitFor(jobs, (job) => !ACTIVE.includes(job.state));
function lateSuccess(ticket) {
  fs.appendFileSync(ticket.events, JSON.stringify(signEvent(ticket, { type: 'runner_complete', state: 'passed', exitCode: 0 })) + '\n');
}
function events(ticket) {
  return fs.readFileSync(ticket.events, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(JSON.parse(line).body));
}

for (const vendor of ['claude', 'codex']) {
  test(`managed ${vendor} consumes the real scoped MCP smoke result and public progress`, { timeout: 25000 }, async (t) => {
    const { jobs, db, root, launched } = await fixture(t);
    jobs.start({ agent: `@${vendor}-worker`, building: 'test' });
    const job = await completed(jobs);
    assert.equal(job.state, 'passed', job.agent_output + '\n' + job.output);
    assert.equal(job.executor, vendor); assert.equal(job.session_id, `fixture-${vendor}-session`);
    assert.equal(job.exit_code, 0); assert.equal(job.agent_exit_code, 0);
    assert.deepEqual(job.steps.map((step) => step.name), [...CHECKS]);
    assert(job.steps.every((step) => step.state === 'passed'));
    assert.match(job.agent_detail, /public fixture activity/); assert.match(job.agent_output, /Observed 6\/6/);
    assert.match(job.output, /6\/6 smoke checks passed/); assert.equal(job.root, root);
    assert.match(job.manifest['app/agent-test-mcp.js'], /^[a-f0-9]{64}$/);
    assert.equal(db.prepare('SELECT count(*) AS count FROM messages').get().count, 0);
    assert.equal(events(launched[0].ticket).filter((event) => event.type === 'runner_complete').length, 1);
  });
}

test('agent prose and exit zero cannot claim a smoke pass without execution', { timeout: 10000 }, async (t) => {
  const { jobs } = await fixture(t, { mode: 'prose' });
  jobs.start({ agent: '@codex-worker', building: 'test' }); const job = await completed(jobs);
  assert.equal(job.state, 'failed'); assert.equal(job.agent_exit_code, 0); assert.equal(job.exit_code, null);
  assert.equal(job.steps.length, 0); assert.match(job.detail, /without a verified smoke result/);
  assert.match(job.agent_output, /deliberately has no tool evidence/);
});

test('forged runner events fail signature validation instead of granting a pass', { timeout: 10000 }, async (t) => {
  const { jobs } = await fixture(t, { mode: 'bad-signature' });
  jobs.start({ agent: '@claude-worker', building: 'test' }); const job = await completed(jobs);
  assert.equal(job.state, 'failed'); assert.equal(job.steps.length, 0);
  assert.match(job.detail, /signature/); assert.equal(job.exit_code, null);
});

test('the scoped ticket runs smoke once across duplicate calls and MCP restarts', { timeout: 25000 }, async (t) => {
  const { jobs, launched } = await fixture(t, { mode: 'duplicate' });
  jobs.start({ agent: '@codex-worker', building: 'test' }); const job = await completed(jobs);
  assert.equal(job.state, 'passed', job.agent_output + '\n' + job.output);
  assert.match(job.agent_output, /restarted MCP server both rejected/);
  const observed = events(launched[0].ticket);
  assert.equal(observed.filter((event) => event.type === 'runner_started').length, 1);
  assert.equal(observed.filter((event) => event.type === 'runner_complete').length, 1);
});

for (const vendor of ['claude', 'codex']) {
  test(`a ${vendor} error event after passing checks prevents a completed agent pass despite CLI exit zero`, { timeout: 25000 }, async (t) => {
    const { jobs } = await fixture(t, { mode: 'provider-error' });
    jobs.start({ agent: `@${vendor}-worker`, building: 'test' }); const job = await completed(jobs);
    assert.equal(job.state, 'failed', job.agent_output);
    assert.equal(job.exit_code, 0, 'Observed passing checks remain inspectable separately from agent failure');
    assert.equal(job.agent_exit_code, 0, 'Provider stream failure takes precedence over exit zero');
    assert.equal(job.steps.length, 6); assert(job.steps.every((step) => step.state === 'passed'));
    assert.match(job.agent_output, /Fixture provider failed/); assert.match(job.detail, /Fixture provider failed|agent.*fail/i);
  });
}

test('owner cancellation remains terminal after observed success and a late signed event', { timeout: 25000 }, async (t) => {
  const { jobs, launched } = await fixture(t, { mode: 'hold' });
  const { id } = jobs.start({ agent: '@claude-worker', building: 'test' });
  const reviewing = await waitFor(jobs, (job) => job.state === 'agent_review');
  assert.equal(reviewing.steps.length, 6); assert.equal(reviewing.exit_code, 0);
  jobs.cancel(id); lateSuccess(launched[0].ticket); await pause(400);
  const job = jobs.list()[0]; assert.equal(job.state, 'cancelled'); assert.equal(job.exit_code, null);
  assert.equal(jobs.active, null); assert.match(job.detail, /Cancelled by the owner/);
});

test('deadline remains terminal when smoke passed but the agent did not finish', { timeout: 45000 }, async (t) => {
  const { jobs, launched } = await fixture(t, { mode: 'hold', agentTimeoutMs: 6000 });
  jobs.start({ agent: '@codex-worker', building: 'test' });
  const deadline = jobs.active.timer;
  // This case starts its real deadline after the real smoke prerequisite.
  // Separate short-deadline cases cover timing from assignment acceptance.
  const holdDeadline = setInterval(() => deadline.refresh(), 1000);
  t.after(() => clearInterval(holdDeadline));
  try {
    const reviewing = await waitFor(jobs, (job) => job.state === 'agent_review', 30000);
    assert.equal(reviewing.exit_code, 0);
    assert.equal(reviewing.steps.length, 6);
    assert(reviewing.steps.every((step) => step.state === 'passed'));
    clearInterval(holdDeadline);
    deadline.refresh();
    assert.equal((await completed(jobs)).state, 'timed_out');
    lateSuccess(launched[0].ticket); await pause(400);
    const job = jobs.list()[0]; assert.equal(job.state, 'timed_out'); assert.equal(job.exit_code, null);
    assert.equal(jobs.active, null);
  } finally { clearInterval(holdDeadline); }
});

test('a CLI disconnect while smoke starts fails the job and revokes the orphaned runner', { timeout: 15000 }, async (t) => {
  const { jobs, launched } = await fixture(t, { mode: 'disconnect' });
  jobs.start({ agent: '@codex-worker', building: 'test' }); const job = await completed(jobs);
  assert.equal(job.state, 'failed'); assert.match(job.detail, /without a verified smoke result/);
  const started = events(launched[0].ticket).find((event) => event.type === 'runner_started');
  assert(Number.isInteger(started?.pid), 'The disconnect happened after an actual child started');
  const deadline = Date.now() + 4000;
  let alive = true;
  while (Date.now() < deadline) {
    try { process.kill(started.pid, 0); } catch { alive = false; break; }
    await pause(30);
  }
  assert.equal(alive, false, 'The exact smoke subprocess must stop after the CLI disconnects');
  assert.equal(jobs.list()[0].state, 'failed');
});
