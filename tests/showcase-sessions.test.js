'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { Workspaces } = require('../app/district/workspaces');
const { _startWithDependencies, makeTicket, revokeTicket, createJournalReader } = require('../app/district/agent-session');
const { loadTicket, createTools } = require('../app/district/project-agent-mcp');
const control = require('../app/district/process-control');
const serverPath = path.resolve(__dirname, '../app/district/project-agent-mcp.js');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-session-'));
  const cleanups = [];
  const ownedDirectories = [directory];
  const tickets = [];
  t.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    for (const owned of ownedDirectories.reverse()) {
      const resolved = path.resolve(owned);
      assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
      assert.match(path.basename(resolved), /^(?:showcase-session-|agent-bus-project-)/);
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  });
  const rows = new Map();
  const store = { get: (kind, id) => rows.get(kind + ':' + id), put: (kind, row) => rows.set(kind + ':' + row.id, row),
    list: (kind) => [...rows.entries()].filter(([key]) => key.startsWith(kind + ':')).map(([, row]) => row) };
  const workspaces = new Workspaces({ root: path.join(directory, 'projects'), store });
  const project = workspaces.create({ name: 'Showcase scoped fixture', starterId: 'neon-rally' });
  const options = { vendor: 'codex', root: project.root, instruction: 'Apply a scoped fixture edit.', contractId: 'neon-rally',
    runId: 'showcase-session-' + crypto.randomUUID(), timeoutMs: 10000 };
  const trackTicket = (ticket) => {
    if (!ownedDirectories.includes(ticket.directory)) ownedDirectories.push(ticket.directory);
    tickets.push(ticket);
    return ticket;
  };
  const ownProcess = (child) => cleanups.push(async () => {
    if (child.exitCode === null && child.signalCode === null) await control.stopProcessTree(child, { graceMs: 100 });
  });
  const providers = (body, launchDelay = 0) => ({
    async createLaunch(vendor, launch) {
      const config = JSON.parse(fs.readFileSync(launch.configPath, 'utf8')).mcpServers.agent_bus_project;
      const ticket = trackTicket(loadTicket(config.args[2]));
      const script = path.join(directory, crypto.randomUUID() + '.cjs');
      fs.writeFileSync(script, `const fs=require('node:fs');const {loadTicket,createTools}=require(${JSON.stringify(serverPath)});const ticket=loadTicket(process.argv[2]);const call=createTools(ticket);\n` + body);
      if (launchDelay) await new Promise((resolve) => setTimeout(resolve, launchDelay));
      return { command: process.execPath, args: [script, ticket.ticketPath], cwd: project.root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } };
    },
    parseLine(vendor, line) { return JSON.parse(line); },
  });
  const start = async (body, extra = {}, dependencies = {}) => {
    const handle = await _startWithDependencies({ ...options, ...extra }, { providers: providers(body), ...dependencies });
    if (handle.child) ownProcess(handle.child);
    return handle;
  };
  return { directory, project, options, start, providers, ownProcess, trackTicket, tickets, cleanup: (action) => cleanups.push(action) };
}

async function mcp(t, f, ticket) {
  const child = spawn(process.execPath, [serverPath, '--ticket', ticket.ticketPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  f.ownProcess(child);
  const closed = once(child, 'close');
  let id = 0;
  const waiting = new Map();
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const reply = JSON.parse(line), waiter = waiting.get(reply.id);
    if (waiter) { waiting.delete(reply.id); clearTimeout(waiter.timer); waiter.resolve(reply); }
  });
  t.after(() => { for (const waiter of waiting.values()) clearTimeout(waiter.timer); });
  return { child, closed, request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => { waiting.delete(current); reject(new Error('Fixture MCP response timed out.')); }, 3000);
      waiting.set(current, { resolve, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: current, method, params }) + '\n');
    });
  } };
}

test('terminal provider failure revokes tools before the owned process is stopped; reported pass is not evidence', { timeout: 15000 }, async (t) => {
  const f = fixture(t), events = [];
  let stopObserved = false;
  const handle = await f.start(`
call('report_activity',{phase:'test',message:'All checks passed (provider report only).'});
call('project_write_file',{path:'notes.txt',content:'scoped actual bytes',request_id:'edit'});
process.stdout.write(JSON.stringify({error:'Forbidden unscoped provider operation.'})+'\\n');
setTimeout(()=>call('project_write_file',{path:'late.txt',content:'must never write'}),4000);
setInterval(()=>{},1000);`, { onEvent: (event) => events.push(event) }, { processControl: {
    ...control, async stopProcessTree(child, options) {
      const ticket = f.tickets.find((item) => item.runId === f.options.runId);
      assert.ok(ticket);
      assert.throws(() => createTools(ticket)('project_list_files'), /revoked/);
      stopObserved = true;
      return control.stopProcessTree(child, options);
    },
  } });
  const result = await handle.finished;
  assert.match(result.error, /Forbidden unscoped/);
  assert.equal(result.termination.confirmed, true);
  assert.equal(stopObserved, true);
  assert.equal(fs.existsSync(path.join(f.project.root, 'late.txt')), false);
  assert.equal(fs.readFileSync(path.join(f.project.root, 'notes.txt'), 'utf8'), 'scoped actual bytes');
  assert.deepEqual(events.filter((event) => event.type === 'activity' || event.type === 'file_changed').map((event) => [event.type, event.basis, event.contractId]),
    [['activity', 'reported', 'neon-rally'], ['file_changed', 'observed', 'neon-rally']]);
  assert.ok(events.every((event) => event.runId === f.options.runId));
  assert.equal(events.some((event) => event.state === 'passed' || event.checks || event.artifact), false);
});

test('cancel coalesces and cannot be overwritten by buffered terminal prose or a late child error', { timeout: 15000 }, async (t) => {
  const f = fixture(t), events = [];
  let stops = 0;
  const handle = await f.start(`process.stdout.write(JSON.stringify({error:'Late quota result',sessionId:'wrong-late-session'}));setInterval(()=>{},1000);`,
    { onEvent: (event) => events.push(event) }, { processControl: { ...control, stopProcessTree(child, options) { stops++; return control.stopProcessTree(child, options); } } });
  await once(handle.child.stdout, 'data');
  const first = handle.cancel(), second = handle.cancel();
  handle.child.emit('error', new Error('late child transport error'));
  assert.equal(first, second);
  assert.equal((await first).confirmed, true);
  const result = await handle.finished;
  assert.match(result.error, /assignment cancelled/);
  assert.doesNotMatch(result.error, /Late quota|late child/);
  assert.equal(result.sessionId, null);
  assert.equal(stops, 1);
  assert.equal(events.filter((event) => event.type === 'session').length, 0);
});

test('natural completion flushes final metadata once, while a changed session identity fails closed', { timeout: 15000 }, async (t) => {
  const f = fixture(t), events = [];
  const complete = await f.start(`
call('project_write_file',{path:'notes.txt',content:'Finished fixture bytes'});
process.stdout.write(JSON.stringify({sessionId:'bound-session',detail:'Actual edit finished.'}));`, { onEvent: (event) => events.push(event) });
  const result = await complete.finished;
  assert.equal(result.error, null);
  assert.equal(result.exitCode, 0);
  assert.equal(result.sessionId, 'bound-session');
  assert.equal(events.filter((event) => event.type === 'session').length, 1);
  assert.equal(events.filter((event) => event.type === 'file_changed').length, 1);
  assert.equal(events.some((event) => event.artifact || event.state === 'passed'), false);
  const changedEvents = [];
  const changed = await f.start(`
process.stdout.write(JSON.stringify({sessionId:'first-session'})+'\\n'+JSON.stringify({sessionId:'foreign-session'})+'\\n');
setInterval(()=>{},1000);`, { runId: 'changed-session-fixture', onEvent: (event) => changedEvents.push(event) });
  const failure = await changed.finished;
  assert.match(failure.error, /session identity changed/);
  assert.equal(failure.sessionId, 'first-session');
  assert.equal(failure.termination.confirmed, true);
  assert.deepEqual(changedEvents.filter((event) => event.type === 'session').map((event) => event.sessionId), ['first-session']);
});

test('timeout preserves unconfirmed termination and never upgrades a stop request to success', { timeout: 15000 }, async (t) => {
  const f = fixture(t);
  const handle = await f.start('setInterval(()=>{},1000);', { timeoutMs: 100 }, { processControl: {
    ...control, async stopProcessTree() { return { confirmed: false, requested: true, treeConfirmed: false, error: 'Fixture could not establish tree exit.' }; },
  } });
  const result = await handle.finished;
  assert.match(result.error, /time limit.*termination could not be confirmed/);
  assert.equal(result.termination.confirmed, false);
  assert.equal(result.exitCode, null);
});

test('expired launch configuration is revoked and never starts a provider process', { timeout: 5000 }, async (t) => {
  const f = fixture(t);
  let spawns = 0;
  await assert.rejects(_startWithDependencies({ ...f.options, timeoutMs: 50 }, {
    providers: f.providers('', 100), spawn() { spawns++; throw new Error('Unexpected process spawn.'); },
  }), /time limit expired before process launch/);
  assert.equal(spawns, 0);
});

test('idle actual MCP process retires on revocation or expiry even when its stdin stays open', { timeout: 10000 }, async (t) => {
  const f = fixture(t);
  for (const cause of ['revoke', 'expire']) {
    const ticket = f.trackTicket(makeTicket({ root: f.project.root, runId: cause + '-fixture', timeoutMs: cause === 'expire' ? 1200 : 10000, contractId: 'neon-rally' }));
    const client = await mcp(t, f, ticket);
    assert.equal((await client.request('ping')).result !== undefined, true);
    assert.equal(client.child.stdin.writableEnded, false);
    if (cause === 'revoke') await revokeTicket(ticket, 'Owner stopped the fixture.');
    const [code, signal] = await client.closed;
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.throws(() => createTools(ticket)('project_write_file', { path: 'late.txt', content: 'late' }), /revoked|expired/);
  }
  assert.equal(fs.existsSync(path.join(f.project.root, 'late.txt')), false);
});

test('actual MCP reconnect retains write identity and advances one signed journal without granting check authority', { timeout: 10000 }, async (t) => {
  const f = fixture(t);
  const ticket = f.trackTicket(makeTicket({ root: f.project.root, runId: 'reconnect-fixture', timeoutMs: 10000, contractId: 'neon-rally' }));
  const args = { path: 'notes.txt', content: 'First real edit', request_id: 'stable-write' };
  const first = await mcp(t, f, ticket);
  const call = (client, name, arguments_) => client.request('tools/call', { name, arguments: arguments_ });
  assert.equal((await call(first, 'project_write_file', args)).result.isError, false);
  first.child.stdin.end();
  await first.closed;
  const next = await mcp(t, f, ticket);
  const repeat = await call(next, 'project_write_file', args);
  assert.equal(JSON.parse(repeat.result.content[0].text).repeated, true);
  assert.equal((await call(next, 'project_write_file', { ...args, content: 'Conflicting retry' })).result.isError, true);
  assert.equal((await call(next, 'report_activity', { phase: 'test', message: 'Reported result', state: 'passed', basis: 'observed' })).result.isError, true);
  assert.equal((await call(next, 'report_activity', { phase: 'review', message: 'Reviewed saved bytes.' })).result.isError, false);
  const events = [];
  createJournalReader(ticket, (event) => events.push(event))(true);
  assert.deepEqual(events.map((event) => [event.seq, event.type, event.basis]), [[1, 'file_changed', 'observed'], [2, 'activity', 'reported']]);
  assert.equal(events[0].hash, crypto.createHash('sha256').update(fs.readFileSync(path.join(f.project.root, args.path))).digest('hex'));
  assert.ok(events.every((event) => event.runId === ticket.runId && event.contractId === 'neon-rally'));
  next.child.stdin.end();
  await next.closed;
});

test('runtime quarantines unconfirmed ownership across restart while another project can still run checks', { timeout: 15000 }, async (t) => {
  const { DatabaseSync } = require('node:sqlite');
  const { DistrictRuntime } = require('../app/district/runtime');
  const f = fixture(t);
  const database = path.join(f.directory, 'quarantine.sqlite');
  let db = new DatabaseSync(database), runtime, agentStarts = 0;
  const makeRuntime = () => new DistrictRuntime({ db, appRoot: path.resolve(__dirname, '..'), workRoot: path.join(f.directory, 'runtime-projects'),
    providerList: async () => [],
    // This fixture never starts a provider; it tests how the real runtime
    // stores and gates a session's unconfirmed-stop receipt.
    agentStart: async () => {
      agentStarts++;
      return { finished: Promise.resolve({ exitCode: null, error: 'Fixture timeout; native stop unconfirmed.',
        termination: { confirmed: false, requested: true, treeConfirmed: false } }), cancel: async () => ({ confirmed: false }) };
    },
    previewManager: { list: () => [], close: async () => {}, stop: async () => {},
      start: async (candidate) => ({ id: 'fixture-preview-' + candidate.runId, ...candidate, url: 'http://127.0.0.1:1/' }) },
  });
  f.cleanup(async () => { if (runtime) await runtime.close(); db.close(); });
  runtime = makeRuntime();
  const created = await runtime.command({ id: 'quarantine-create', type: 'create_project', payload: { name: 'Unknown owner project' } });
  const other = await runtime.command({ id: 'quarantine-other', type: 'create_project', payload: { name: 'Independent project' } });
  const checkpointId = created.result.baseline.id, projectId = created.projectId;
  const accepted = await runtime.command({ id: 'quarantine-agent', type: 'start_task', projectId, worker: 'codex', instruction: 'Fixture only; do not launch a provider.' });
  assert.equal(accepted.status, 'accepted');
  const unknown = await runtime.waitForRun(accepted.runId);
  assert.equal(unknown.state, 'termination_unknown');
  assert.equal(unknown.termination.confirmed, false);
  assert.equal(runtime.active.has(unknown.id), false, 'The persisted quarantine must remain after the active entry ends.');
  const beforeHash = runtime.workspaces.manifest(projectId).hash;
  const blocked = async (prefix) => {
    const beforeRuns = runtime.store.list('run').length;
    for (const [type, fields] of [
      ['start_task', { worker: 'claude', instruction: 'Must remain blocked.' }],
      ['run_checks', {}],
      ['create_checkpoint', { payload: { label: 'Must remain blocked' } }],
      ['restore_checkpoint', { payload: { checkpointId } }],
    ]) {
      await assert.rejects(runtime.command({ id: prefix + '-' + type, type, projectId, ...fields }), /active work|termination|ownership/i, type);
    }
    assert.equal(runtime.store.list('run').length, beforeRuns, 'Rejected commands cannot create accepted runs.');
    assert.equal(runtime.workspaces.manifest(projectId).hash, beforeHash, 'Rejected restore cannot change candidate bytes.');
    assert.equal(agentStarts, 1, 'No blocked command can dispatch another provider.');
  };
  assert.equal(runtime.busy(other.projectId), false);
  await blocked('before-restart');
  const localChecks = await runtime.command({ id: 'other-checks', type: 'run_checks', projectId: other.projectId });
  assert.equal(localChecks.status, 'accepted');
  const checked = await runtime.waitForRun(localChecks.runId);
  assert.equal(checked.state, 'passed', checked.detail);
  assert.equal(checked.artifact.candidateHash, runtime.workspaces.manifest(other.projectId).hash);
  assert.ok(checked.checks.length > 0 && checked.checks.every((check) => check.state === 'passed'));
  await runtime.close();
  db.close();
  db = new DatabaseSync(database);
  runtime = makeRuntime();
  assert.equal(runtime.run(unknown.id).state, 'termination_unknown');
  assert.equal(runtime.run(unknown.id).termination.confirmed, false);
  await blocked('after-restart');
  assert.equal(runtime.busy(other.projectId), false);
  const otherSaved = await runtime.command({ id: 'other-still-usable', type: 'create_checkpoint', projectId: other.projectId, payload: { label: 'Independent saved source' } });
  assert.equal(otherSaved.status, 'completed');
});
