'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Workspaces } = require('../app/district/workspaces');
const { makeTicket, revokeTicket, createJournalReader, _startWithDependencies } = require('../app/district/agent-session');
const { loadTicket, createTools, signEvent, verifyEvent } = require('../app/district/project-agent-mcp');
const control = require('../app/district/process-control');
const mcpScript = path.resolve(__dirname, '../app/district/project-agent-mcp.js');

function removeOwned(directory, prefix) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith(prefix));
  fs.rmSync(resolved, { recursive: true, force: true });
}
function fixture(t, contractId = 'checklist') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'district-session-test-'));
  t.after(() => removeOwned(directory, 'district-session-test-'));
  const records = new Map();
  const store = { get: (kind, id) => records.get(kind + ':' + id), put: (kind, record) => records.set(kind + ':' + record.id, record), list: (kind) => [...records.entries()].filter(([key]) => key.startsWith(kind + ':')).map(([, value]) => value) };
  const workspaces = new Workspaces({ root: path.join(directory, 'projects'), store });
  const project = workspaces.create({ name: 'Session fixture', starterId: contractId });
  const ticket = makeTicket({ root: project.root, runId: crypto.randomUUID(), timeoutMs: 30000, contractId });
  t.after(() => removeOwned(ticket.directory, 'agent-bus-project-'));
  return { directory, project, ticket, workspaces };
}
async function mcpClient(t, ticket) {
  const child = spawn(process.execPath, [mcpScript, '--ticket', ticket.ticketPath], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let nextId = 0, stderr = '';
  const pending = new Map();
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const response = JSON.parse(line);
    const listener = pending.get(response.id);
    if (listener) { pending.delete(response.id); clearTimeout(listener.timer); listener.resolve(response); }
  });
  child.stderr.on('data', (data) => { stderr = control.boundedAppend(stderr, data, 8000); });
  child.on('close', () => {
    for (const listener of pending.values()) { clearTimeout(listener.timer); listener.reject(new Error('MCP exited: ' + stderr)); }
    pending.clear();
  });
  t.after(async () => {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) await control.stopProcessTree(child, { graceMs: 100 });
  });
  return {
    child,
    request(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP response timed out.')); }, 5000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    async call(name, args = {}) { return this.request('tools/call', { name, arguments: args }); },
  };
}

test('actual scoped MCP writes real public bytes, labels reports, rejects escapes and deduplicates writes', { timeout: 20000 }, async (t) => {
  const { ticket, project } = fixture(t);
  const client = await mcpClient(t, ticket);
  assert.equal((await client.request('initialize')).result.serverInfo.name, 'agent-bus-project');
  const listed = await client.request('tools/list');
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), ['project_list_files', 'project_read_file', 'project_write_file', 'report_activity']);
  const publicFiles = await client.call('project_list_files');
  assert.ok(JSON.parse(publicFiles.result.content[0].text).files.includes('index.html'));
  const content = 'body { color: #8cf; }';
  const first = await client.call('project_write_file', { path: 'styles.css', content, request_id: 'write-one' });
  assert.equal(first.result.isError, false);
  assert.equal(fs.readFileSync(path.join(project.root, 'styles.css'), 'utf8'), content);
  const repeat = await client.call('project_write_file', { path: 'styles.css', content, request_id: 'write-one' });
  assert.equal(JSON.parse(repeat.result.content[0].text).repeated, true);
  const conflict = await client.call('project_write_file', { path: 'styles.css', content: 'different', request_id: 'write-one' });
  assert.equal(conflict.result.isError, true);
  for (const relative of ['../escape.txt', '.agent-bus/workspace.json', '.git/config', 'secret.txt:token', 'CON.txt']) {
    assert.equal((await client.call('project_write_file', { path: relative, content: 'forbidden' })).result.isError, true);
  }
  assert.equal((await client.call('project_read_file', { path: '.agent-bus/workspace.json' })).result.isError, true);
  assert.equal((await client.call('report_activity', { phase: 'test', message: 'Claim pass', basis: 'observed', state: 'passed' })).result.isError, true);
  assert.equal((await client.call('report_activity', { phase: 'research', message: 'Reading the actual starter.' })).result.isError, false);
  const events = [];
  createJournalReader(ticket, (event) => events.push(event))(true);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'file_changed');
  assert.equal(events[0].basis, 'observed');
  assert.equal(events[0].hash, crypto.createHash('sha256').update(content).digest('hex'));
  assert.equal(events[1].basis, 'reported');
  assert.equal(fs.readFileSync(path.join(project.root, 'styles.css'), 'utf8'), content);
});

test('private journal rejects planted forged MAC, replay and wrong assignment', (t) => {
  const { ticket } = fixture(t);
  const body = { id: crypto.randomUUID(), runId: ticket.runId, at: Date.now(), seq: 1, previousMac: '', type: 'activity', phase: 'research', basis: 'reported', message: 'Fixture' };
  const forged = signEvent(ticket, body);
  forged.mac = '0'.repeat(64);
  fs.writeFileSync(ticket.events, JSON.stringify(forged) + '\n');
  assert.throws(() => createJournalReader(ticket, () => {})(true), /signature/);
  const valid = signEvent(ticket, body);
  fs.writeFileSync(ticket.events, JSON.stringify(valid) + '\n');
  const observed = [];
  const reader = createJournalReader(ticket, (event) => observed.push(event));
  reader();
  assert.equal(observed.length, 1);
  fs.appendFileSync(ticket.events, JSON.stringify(valid) + '\n');
  assert.throws(() => reader(true), /order or replay/);
  fs.writeFileSync(ticket.events, JSON.stringify(signEvent(ticket, { ...body, runId: 'other-run' })) + '\n');
  assert.throws(() => createJournalReader(ticket, () => {})(true), /identity/);
});

test('revocation blocks an already-running MCP and restart preserves idempotent receipts', { timeout: 20000 }, async (t) => {
  const { ticket, project } = fixture(t);
  const client = await mcpClient(t, ticket);
  assert.equal((await client.call('project_write_file', { path: 'notes.txt', content: 'one', request_id: 'once' })).result.isError, false);
  client.child.stdin.end();
  await new Promise((resolve) => client.child.once('close', resolve));
  const restarted = await mcpClient(t, ticket);
  const repeated = await restarted.call('project_write_file', { path: 'notes.txt', content: 'one', request_id: 'once' });
  assert.equal(JSON.parse(repeated.result.content[0].text).repeated, true);
  await revokeTicket(ticket, 'Fixture cancellation');
  const denied = await restarted.call('project_write_file', { path: 'notes.txt', content: 'late' });
  assert.equal(denied.result.isError, true);
  assert.match(denied.result.content[0].text, /revoked/);
  assert.equal(fs.readFileSync(path.join(project.root, 'notes.txt'), 'utf8'), 'one');
});

test('write budget rejects the 65th actual write without changing bytes or emitting an event', (t) => {
  const { ticket, project } = fixture(t);
  const call = createTools(loadTicket(ticket.ticketPath));
  for (let index = 0; index < 64; index++) call('project_write_file', { path: 'notes.txt', content: String(index) });
  assert.throws(() => call('project_write_file', { path: 'notes.txt', content: 'overflow' }), /64-write limit/);
  assert.equal(fs.readFileSync(path.join(project.root, 'notes.txt'), 'utf8'), '63');
  const events = [];
  createJournalReader(ticket, (event) => events.push(event))(true);
  assert.equal(events.length, 64);
});

function fakeProviders(t, directory, script, launchObserver = () => {}) {
  const scriptPath = path.join(directory, `fake-provider-${crypto.randomUUID()}.cjs`);
  fs.writeFileSync(scriptPath, script);
  return {
    createLaunch(vendor, options) {
      launchObserver(options);
      const config = JSON.parse(fs.readFileSync(options.configPath, 'utf8'));
      t.after(() => removeOwned(path.dirname(config.mcpServers.agent_bus_project.args[2]), 'agent-bus-project-'));
      return { command: process.execPath, args: [scriptPath, options.configPath], cwd: options.root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdin: options.prompt };
    },
    parseLine(vendor, line) { try { return JSON.parse(line); } catch { return null; } },
  };
}
const EDITING_PROVIDER = `
const fs=require('node:fs'); const {spawn}=require('node:child_process'); const readline=require('node:readline');
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).mcpServers.agent_bus_project;
const child=spawn(config.command,config.args,{env:{...process.env,...config.env},stdio:['pipe','pipe','pipe'],windowsHide:true});
let id=0; const waiters=new Map(); const lines=readline.createInterface({input:child.stdout});
lines.on('line',line=>{const r=JSON.parse(line); const w=waiters.get(r.id); if(w){waiters.delete(r.id);w(r);}});
child.stderr.pipe(process.stderr);
const call=(name,args)=>new Promise(resolve=>{const n=++id;waiters.set(n,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method:'tools/call',params:{name,arguments:args}})+'\\n');});
(async()=>{for(const [name,args] of [['report_activity',{phase:'research',message:'Inspecting starter in the fixture.'}],['project_read_file',{path:'styles.css'}],['project_write_file',{path:'styles.css',content:'body { background: #123; }',request_id:'edit'}]]){const r=await call(name,args);if(r.result.isError)throw new Error(r.result.content[0].text);} child.stdin.end(); child.once('close',()=>{process.stdout.write(JSON.stringify({sessionId:'fixture-session',detail:'Actual scoped tool edit completed.'})+'\\n');});})().catch(e=>{process.stderr.write(e.message);child.kill();process.exitCode=1;});
`;

test('owned fake CLI drives real scoped MCP edits and all verified events arrive before finished', { timeout: 20000 }, async (t) => {
  const { directory, project } = fixture(t);
  const events = [];
  let launchOptions;
  const providers = fakeProviders(t, directory, EDITING_PROVIDER, (options) => { launchOptions = options; });
  const handle = await _startWithDependencies({ vendor: 'codex', root: project.root, instruction: 'Set the background to #123.', model: 'fixture-model', effort: 'high', runId: 'fixture-real-mcp', onEvent: (event) => events.push(event), timeoutMs: 10000 }, { providers });
  const result = await handle.finished;
  assert.equal(result.exitCode, 0);
  assert.equal(result.error, null);
  assert.equal(result.sessionId, 'fixture-session');
  assert.equal(launchOptions.model, 'fixture-model');
  assert.equal(launchOptions.effort, 'high');
  assert.match(launchOptions.prompt, /data-testid selectors task-input, add-task and task-list/);
  assert.equal(fs.readFileSync(path.join(project.root, 'styles.css'), 'utf8'), 'body { background: #123; }');
  assert.ok(events.some((event) => event.type === 'activity' && event.basis === 'reported'));
  assert.ok(events.some((event) => event.type === 'file_changed' && event.basis === 'observed'));
  const count = events.length;
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(events.length, count);
  const config = JSON.parse(fs.readFileSync(launchOptions.configPath, 'utf8'));
  const ticket = loadTicket(config.mcpServers.agent_bus_project.args[2]);
  assert.throws(() => createTools(ticket)('project_write_file', { path: 'late.txt', content: 'late' }), /revoked/);
});

test('Neon Rally launch and real scoped MCP initialization preserve its verified scoreboard contract', { timeout: 20000 }, async (t) => {
  const { directory, project, ticket } = fixture(t, 'neon-rally');
  const client = await mcpClient(t, ticket);
  const initialized = await client.request('initialize');
  const instructions = initialized.result.instructions;
  assert.match(instructions, /Application contract: neon-rally/);
  for (const selector of ['neon-add-comets', 'neon-add-bolts', 'neon-score-comets', 'neon-score-bolts', 'neon-theme', 'neon-reset', 'neon-status', 'data-neon-rally-app']) assert.ok(instructions.includes(selector));
  assert.doesNotMatch(instructions, /checklist|task-input|add-task|task-list/);
  assert.equal((await client.call('report_activity', { phase: 'research', message: 'Inspecting the scoreboard.', contractId: 'checklist' })).result.isError, true);
  const events = [];
  let launchOptions;
  const providers = fakeProviders(t, directory, EDITING_PROVIDER, (options) => { launchOptions = options; });
  const handle = await _startWithDependencies({ vendor: 'codex', root: project.root, contractId: 'neon-rally', instruction: 'Set the background to #123.', runId: 'rally-contract-fixture', onEvent: (event) => events.push(event), timeoutMs: 10000 }, { providers });
  const result = await handle.finished;
  assert.equal(result.error, null);
  assert.match(launchOptions.prompt, /Application contract: neon-rally/);
  assert.match(launchOptions.prompt, /both teams can gain points, theme can change, and reset clears both scores/);
  assert.doesNotMatch(launchOptions.prompt, /checklist|task-input|add-task|task-list/);
  const config = JSON.parse(fs.readFileSync(launchOptions.configPath, 'utf8'));
  const scopedTicket = loadTicket(config.mcpServers.agent_bus_project.args[2]);
  assert.equal(scopedTicket.contractId, 'neon-rally');
  assert.throws(() => { scopedTicket.contractId = 'checklist'; }, TypeError);
  const observed = events.filter((event) => ['activity', 'file_changed'].includes(event.type));
  assert.equal(observed.length, 2);
  assert.ok(observed.every((event) => event.contractId === 'neon-rally'));
});

test('unknown contracts fail before provider launch and legacy tickets/events default only to checklist', async (t) => {
  const { project, ticket } = fixture(t);
  let launched = false;
  const providers = { createLaunch() { launched = true; throw new Error('Must not launch.'); } };
  for (const contractId of ['unknown-app', null, 1, {}]) {
    await assert.rejects(_startWithDependencies({ vendor: 'codex', root: project.root, contractId, instruction: 'Edit.', runId: 'bad-contract-fixture' }, { providers }), /Unknown application contract/);
  }
  assert.equal(launched, false);
  const legacyTicket = JSON.parse(fs.readFileSync(ticket.ticketPath, 'utf8'));
  delete legacyTicket.contractId;
  fs.writeFileSync(ticket.ticketPath, JSON.stringify(legacyTicket));
  assert.equal(loadTicket(ticket.ticketPath).contractId, 'checklist');
  const event = { id: crypto.randomUUID(), runId: ticket.runId, at: Date.now(), seq: 1, previousMac: '', type: 'activity', phase: 'research', basis: 'reported', message: 'Legacy activity' };
  const legacyBody = JSON.stringify(event);
  const legacyEnvelope = { body: legacyBody, mac: crypto.createHmac('sha256', ticket.key).update(legacyBody).digest('hex') };
  assert.equal(verifyEvent(ticket, legacyEnvelope).runId, ticket.runId);
  assert.throws(() => verifyEvent({ ...ticket, contractId: 'neon-rally' }, legacyEnvelope), /identity/);
  const rally = signEvent({ ...ticket, contractId: 'neon-rally' }, event);
  assert.equal(JSON.parse(rally.body).contractId, 'neon-rally');
  const changedBody = JSON.stringify({ ...JSON.parse(rally.body), contractId: 'checklist' });
  assert.throws(() => verifyEvent({ ...ticket, contractId: 'neon-rally' }, { ...rally, body: changedBody }), /signature/);
  const resignedWrongContract = { body: changedBody, mac: crypto.createHmac('sha256', ticket.key).update(changedBody).digest('hex') };
  assert.throws(() => verifyEvent({ ...ticket, contractId: 'neon-rally' }, resignedWrongContract), /identity/);
  fs.writeFileSync(ticket.ticketPath, JSON.stringify({ ...legacyTicket, contractId: 'unrecognized' }));
  assert.throws(() => loadTicket(ticket.ticketPath), /Unknown application contract/);
});

test('provider error survives exit zero and prose-only exit cannot pretend scoped tools ran', { timeout: 15000 }, async (t) => {
  const { directory, project } = fixture(t);
  const providers = fakeProviders(t, directory, `process.stdout.write(JSON.stringify({error:'Quota limit fixture diagnostic'})+'\\n');`);
  const failed = await _startWithDependencies({ vendor: 'claude', root: project.root, instruction: 'Edit the starter.', runId: 'quota-fixture' }, { providers });
  assert.match((await failed.finished).error, /Quota limit fixture diagnostic/);
  const prose = fakeProviders(t, directory, `process.stdout.write(JSON.stringify({detail:'Everything passed without a tool'})+'\\n');`);
  const noTools = await _startWithDependencies({ vendor: 'codex', root: project.root, instruction: 'Edit the starter.', runId: 'no-tools-fixture' }, { providers: prose });
  assert.match((await noTools.finished).error, /without signed scoped-tool/);
});

test('cancellation revokes scope before stopping the exact owned CLI process', { timeout: 20000 }, async (t) => {
  const { directory, project } = fixture(t);
  let options;
  const providers = fakeProviders(t, directory, 'setInterval(()=>{},1000);', (value) => { options = value; });
  const handle = await _startWithDependencies({ vendor: 'codex', root: project.root, instruction: 'Wait.', runId: 'cancel-fixture', timeoutMs: 10000 }, { providers });
  const termination = await handle.cancel();
  const result = await handle.finished;
  assert.match(result.error, /cancelled/);
  assert.equal(termination.confirmed, true);
  assert.equal(result.termination.confirmed, true);
  const config = JSON.parse(fs.readFileSync(options.configPath, 'utf8'));
  assert.throws(() => createTools(loadTicket(config.mcpServers.agent_bus_project.args[2]))('project_list_files'), /revoked/);
});

test('timeout is a failed assignment with confirmed owned-process stop', { timeout: 20000 }, async (t) => {
  const { directory, project } = fixture(t);
  const providers = fakeProviders(t, directory, 'setInterval(()=>{},1000);');
  const handle = await _startWithDependencies({ vendor: 'claude', root: project.root, instruction: 'Wait.', runId: 'timeout-fixture', timeoutMs: 100 }, { providers });
  const result = await handle.finished;
  assert.match(result.error, /time limit/);
  assert.equal(result.termination.confirmed, true);
});
