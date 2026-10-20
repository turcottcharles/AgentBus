'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const client = require('../app/district/client');
const { parseArgs, buildCommand, formatReceipt } = require('../bin/district.cjs');
const { callTool } = require('../bin/district-mcp.cjs');

const repo = path.resolve(__dirname, '..');
const cli = path.join(repo, 'bin', 'district.cjs');
const mcp = path.join(repo, 'bin', 'district-mcp.cjs');

async function fixture(t, handler = () => ({})) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-cli-'));
  const connectionFile = path.join(temp, 'connection.json');
  const token = crypto.randomBytes(32).toString('hex');
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString('utf8');
    const call = { method: req.method, url: req.url, authorization: req.headers.authorization,
      origin: req.headers.origin, body: raw ? JSON.parse(raw) : undefined };
    calls.push(call);
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Authentication required.' })); return;
    }
    try {
      const result = await handler(call, res);
      if (res.writableEnded || res.destroyed || result === null) return;
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Fixture failed.' }));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const descriptor = { version: 1, url: `http://127.0.0.1:${server.address().port}`, token, pid: process.pid, created: Date.now() };
  fs.writeFileSync(connectionFile, JSON.stringify(descriptor), { mode: 0o600 });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  return { temp, server, descriptor, connectionFile, calls };
}

function childRun(file, args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: repo,
      env: { ...process.env, ...env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', done = false;
    const timer = setTimeout(() => { child.kill(); finish(new Error('Fixture child exceeded 8 seconds.')); }, 8000);
    function finish(error, result) {
      if (done) return; done = true; clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    }
    child.stdout.on('data', (data) => { stdout += data; if (stdout.length > 1024 * 1024) { child.kill(); finish(new Error('Fixture child output exceeded its bound.')); } });
    child.stderr.on('data', (data) => { stderr += data; });
    child.once('error', (error) => finish(error));
    child.once('close', (code) => finish(null, { code, stdout, stderr }));
    child.stdin.end(input || '');
  });
}

test('district client authenticates loopback requests and returns bridge state unchanged', async (t) => {
  const snapshot = { version: 1, projects: [{ id: 'p1', name: 'Fixture' }], runs: [{ id: 'r1', state: 'running' }], activities: [], providers: [], checkpoints: [], previews: [], seq: 14 };
  const f = await fixture(t, (call) => call.url === '/snapshot' ? snapshot : { id: call.body.id, status: 'accepted', runId: 'r2' });
  assert.deepEqual(await client.request(f.connectionFile, '/snapshot'), snapshot);
  const command = { id: 'stable', type: 'run_checks', origin: 'cli', projectId: 'p1' };
  assert.deepEqual(await client.request(f.connectionFile, '/command', command), { id: 'stable', status: 'accepted', runId: 'r2' });
  assert.equal(f.calls[0].method, 'GET'); assert.equal(f.calls[1].method, 'POST');
  assert.equal(f.calls[0].authorization, `Bearer ${f.descriptor.token}`);
  assert.equal(f.calls[0].origin, undefined);
  assert.deepEqual(f.calls[1].body, command);
});

test('connection file resolution has explicit then environment then repository precedence', () => {
  assert.equal(client.resolveConnectionFile('explicit.json', { AGENT_BUS_DISTRICT_CONNECTION: 'env.json' }), path.resolve('explicit.json'));
  assert.equal(client.resolveConnectionFile(undefined, { AGENT_BUS_DISTRICT_CONNECTION: 'env.json' }), path.resolve('env.json'));
  assert.equal(client.resolveConnectionFile(undefined, {}), path.join(repo, 'district-connection.json'));
});

test('descriptor rejects remote URLs, credentials, alternate routes and invalid tokens before connecting', async (t) => {
  const f = await fixture(t);
  for (const url of ['https://127.0.0.1:1234', 'http://example.com:1234', 'http://localhost:1234',
    'http://127.0.0.1', 'http://user:pass@127.0.0.1:1234', 'http://127.0.0.1:1234/command', 'http://127.0.0.1:1234/?x=1']) {
    fs.writeFileSync(f.connectionFile, JSON.stringify({ ...f.descriptor, url }));
    await assert.rejects(client.request(f.connectionFile, '/snapshot'), { code: 'INVALID_CONNECTION' });
  }
  fs.writeFileSync(f.connectionFile, JSON.stringify({ ...f.descriptor, token: 'line\r\nbreak' }));
  await assert.rejects(client.request(f.connectionFile, '/snapshot'), { code: 'INVALID_CONNECTION' });
  assert.equal(f.calls.length, 0);
});

test('missing and malformed connection files produce useful errors without leaking tokens', async (t) => {
  const f = await fixture(t);
  await assert.rejects(client.readConnection(path.join(f.temp, 'missing.json')), { code: 'NOT_CONNECTED' });
  fs.writeFileSync(f.connectionFile, `{\"token\":\"${f.descriptor.token}`);
  await assert.rejects(client.readConnection(f.connectionFile), (error) => {
    assert.equal(error.code, 'INVALID_CONNECTION'); assert(!error.message.includes(f.descriptor.token)); return true;
  });
});

test('client bounds commands, refuses alternate endpoints and does not follow redirects', async (t) => {
  const f = await fixture(t, (_call, res) => { res.writeHead(302, { Location: 'http://example.com/', 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unexpected redirect.' })); return null; });
  await assert.rejects(client.request(f.connectionFile, '/command', { text: 'x'.repeat(65536) }), { code: 'COMMAND_TOO_LARGE' });
  await assert.rejects(client.request(f.connectionFile, 'http://example.com/', {}), { code: 'INVALID_REQUEST' });
  await assert.rejects(client.request(f.connectionFile, '/snapshot', {}), { code: 'INVALID_REQUEST' });
  await assert.rejects(client.request(f.connectionFile, '/snapshot'), { code: 'HTTP_ERROR', statusCode: 302 });
  assert.equal(f.calls.length, 1);
});

test('client reports authentication failures, invalid responses and bounded timeout honestly', async (t) => {
  let mode = 'auth';
  const f = await fixture(t, (_call, res) => {
    if (mode === 'auth') { res.writeHead(401); res.end(JSON.stringify({ error: `Do not echo ${f.descriptor.token}` })); }
    if (mode === 'invalid') { res.writeHead(200); res.end('broken-json'); }
    return null;
  });
  await assert.rejects(client.request(f.connectionFile, '/snapshot'), (error) => {
    assert.equal(error.statusCode, 401); assert(!error.message.includes(f.descriptor.token)); return true;
  });
  mode = 'invalid'; await assert.rejects(client.request(f.connectionFile, '/snapshot'), { code: 'INVALID_RESPONSE' });
  mode = 'timeout'; await assert.rejects(client.request(f.connectionFile, '/snapshot', undefined, { timeoutMs: 40 }), (error) => {
    assert.equal(error.code, 'TIMEOUT'); assert.match(error.message, /may have been accepted/); return true;
  });
});

test('CLI maps every supported operation to the normalized bridge command', () => {
  const cases = [
    [['create', 'Checklist'], 'create_project', undefined],
    [['create', 'Rally', '--starter', 'neon-rally'], 'create_project', undefined],
    [['run', 'p1', '--agent', 'codex', '--instruction', 'Change the heading', '--model', 'chosen-model', '--effort', 'high'], 'start_task', 'p1'],
    [['check', 'p1'], 'run_checks', 'p1'],
    [['activity', 'p1', '--worker', 'worker1', '--phase', 'research', '--message', 'Reading files'], 'report_activity', 'p1'],
    [['checkpoint', 'p1', '--label', 'Baseline'], 'create_checkpoint', 'p1'],
    [['restore', 'p1', 'cp1'], 'restore_checkpoint', 'p1'],
    [['diff', 'p1', 'cp1'], 'inspect_diff', 'p1'],
    [['cancel', 'r1'], 'cancel_run', undefined],
    [['preview', 'p1', '--run', 'r1'], 'preview_start', 'p1'],
    [['preview', 'p1', '--stop'], 'preview_stop', 'p1'],
    [['display', 'p1', '--monitor', '3242010503', '--area', 'top-left'], 'set_project_preferences', 'p1'],
    [['display', 'p1', '--monitor', '3242010503', '--area', 'custom', '--bounds', '0.1,0.2,0.5,0.5'], 'set_project_preferences', 'p1'],
    [['visual-check', 'p1', '--run', 'r1'], 'run_visual_checks', 'p1'],
    [['window', 'p1', '--run', 'r1'], 'open_preview_window', 'p1'],
  ];
  for (const [args, type, projectId] of cases) {
    const command = buildCommand(parseArgs([...args, '--id', 'stable']));
    assert.equal(command.type, type); assert.equal(command.projectId, projectId);
    assert.equal(command.id, 'stable'); assert.equal(command.origin, 'cli');
    if (type === 'start_task') { assert.equal(command.model, 'chosen-model'); assert.equal(command.effort, 'high'); }
    if (type === 'report_activity') { assert.equal(command.payload.basis, 'reported'); assert.equal(command.payload.workerId, 'worker1'); }
    if (type === 'set_project_preferences') {
      assert.equal(command.payload.testDisplayId, '3242010503');
      assert.deepEqual(command.payload.testBounds, command.payload.testRegion === 'custom' ? { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } : null);
    }
    if (type === 'run_visual_checks' || type === 'open_preview_window') assert.equal(command.payload.runId, 'r1');
  }
  assert.throws(() => buildCommand(parseArgs(['run', 'p1', '--agent', 'local', '--instruction', 'hello'])), /codex or claude/);
  assert.throws(() => parseArgs(['check', 'p1', '--model', 'invalid']), /not valid/);
  assert.throws(() => parseArgs(['run', 'p1', '--agent']), /requires a value/);
  assert.throws(() => parseArgs(['check', 'p1', '--json', '--json']), /twice/);
  assert.deepEqual(buildCommand(parseArgs(['create', 'Checklist', '--id', 'default-starter'])).payload, { name: 'Checklist' });
  assert.deepEqual(buildCommand(parseArgs(['create', 'Rally', '--starter', 'neon-rally', '--id', 'rally-starter'])).payload, { name: 'Rally', starterId: 'neon-rally' });
  assert.throws(() => buildCommand(parseArgs(['create', 'Wrong', '--starter', 'invented'])), /Unknown starter/);
});

test('actual CLI child preserves accepted-versus-completed and stable command ids', async (t) => {
  const receipts = new Map(); let executions = 0;
  const f = await fixture(t, (call) => {
    if (call.url === '/snapshot') return { version: 1, projects: [], runs: [{ id: 'r1', state: 'running' }], activities: [], providers: [], checkpoints: [], previews: [], seq: 9 };
    if (!receipts.has(call.body.id)) { executions++; receipts.set(call.body.id, { id: call.body.id, status: 'accepted', runId: 'r1', projectId: 'p1' }); }
    return receipts.get(call.body.id);
  });
  const args = ['run', 'p1', '--agent', 'codex', '--instruction', 'Actual request text', '--id', 'retry-id', '--connection', f.connectionFile];
  const first = await childRun(cli, args);
  assert.equal(first.code, 0, first.stderr); assert.match(first.stdout, /Accepted command retry-id/);
  assert.match(first.stdout, /not yet completed/); assert.doesNotMatch(first.stdout, /passed|checks succeeded/i);
  const second = await childRun(cli, [...args, '--json']);
  assert.equal(second.code, 0); assert.equal(JSON.parse(second.stdout).status, 'accepted'); assert.equal(executions, 1);
  const state = await childRun(cli, ['status', '--json'], { env: { AGENT_BUS_DISTRICT_CONNECTION: f.connectionFile } });
  assert.equal(state.code, 0); assert.equal(JSON.parse(state.stdout).runs[0].state, 'running'); assert.equal(JSON.parse(state.stdout).seq, 9);
  assert(!first.stdout.includes(f.descriptor.token));
});

test('actual CLI and MCP activity retries preserve receipts and server time through the real runtime', async (t) => {
  const { DatabaseSync } = require('node:sqlite');
  const { DistrictRuntime } = require('../app/district/runtime');
  const { DistrictBridge } = require('../app/district/bridge');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'district-cli-activity-retry-'));
  const connectionFile = path.join(temp, 'connection.json');
  const db = new DatabaseSync(':memory:');
  let clock = 1000, providerStarts = 0;
  const runtime = new DistrictRuntime({ db, appRoot: repo, workRoot: path.join(temp, 'projects'), now: () => clock,
    providerList: async () => [], agentStart: () => { providerStarts++; throw new Error('This check must not start a provider'); } });
  const bridge = new DistrictBridge({ runtime, connectionFile });
  t.after(async () => { await bridge.close(); await runtime.close(); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });
  await bridge.start();
  const created = await runtime.command({ id: 'activity-project', type: 'create_project', origin: 'cli', payload: { name: 'Retry fixture' } });
  clock = 2000;
  const args = ['activity', created.projectId, '--worker', 'cli-reporter', '--phase', 'research', '--message', 'Reading source',
    '--id', 'same-activity-request', '--connection', connectionFile, '--json'];
  const first = await childRun(cli, args);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  const receipt = JSON.parse(first.stdout), eventCount = runtime.store.events(0, 1000).length;
  assert.equal(receipt.result.at, 2000, 'The authority supplies observed receipt time, not each retrying client');
  clock = 3000;
  const second = await childRun(cli, args);
  assert.equal(second.code, 0, second.stdout + second.stderr);
  assert.deepEqual(JSON.parse(second.stdout), receipt);
  assert.equal(runtime.activity.list().length, 1);
  assert.equal(runtime.store.events(0, 1000).length, eventCount, 'Retry must append no command/activity event');
  assert.equal(providerStarts, 0);
  const changed = await childRun(cli, args.map((arg) => arg === 'Reading source' ? 'Different instruction' : arg));
  assert.equal(changed.code, 1, 'The same ID still rejects genuinely different content');
  assert.equal(runtime.activity.list().length, 1);
  const mcpInput = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'district_activity',
    arguments: { id: 'same-mcp-activity', projectId: created.projectId, workerId: 'mcp-reporter', phase: 'research', message: 'Reading from MCP' } } }) + '\n';
  clock = 4000;
  const mcpFirst = await childRun(mcp, ['--connection', connectionFile], { input: mcpInput });
  assert.equal(mcpFirst.code, 0, mcpFirst.stderr);
  const mcpReply = JSON.parse(mcpFirst.stdout).result;
  assert.equal(mcpReply.isError, false); assert.equal(mcpReply.structuredContent.result.at, 4000);
  const beforeMcpRetry = runtime.store.events(0, 1000).length;
  clock = 5000;
  const mcpSecond = await childRun(mcp, ['--connection', connectionFile], { input: mcpInput });
  assert.equal(mcpSecond.code, 0, mcpSecond.stderr);
  assert.deepEqual(JSON.parse(mcpSecond.stdout).result, mcpReply);
  assert.equal(runtime.store.events(0, 1000).length, beforeMcpRetry);
  assert.equal(runtime.activity.list().length, 2); assert.equal(providerStarts, 0);
});

test('CLI reported activity without a run always projects a boolean nonterminal worker state', () => {
  const vm = require('node:vm'), window = {};
  vm.runInNewContext(fs.readFileSync(path.join(repo, 'app/district-scene.js'), 'utf8'), { window }, { timeout: 1000 });
  const scene = Object.create(window.DistrictScene.prototype);
  const worker = { id: 'cli-reporter', passive: true };
  const report = { id: 'report', workerId: worker.id, projectId: 'p1', phase: 'research', basis: 'reported', at: 2000 };
  for (let i = 0; i < 4; i++) {
    const projection = scene._workerState(worker, [report], []);
    assert.equal(projection.terminal, false, 'Undefined forces DOMTokenList.toggle to toggle on every snapshot');
    assert.equal(projection.phase, 'research'); assert.equal(projection.basis, 'reported');
  }
  const completed = scene._workerState(worker, [], [{ id: 'run', worker: worker.id, state: 'passed', at: 3000 }]);
  assert.equal(completed.terminal, true, 'Actual terminal runs retain their terminal projection');
});

test('CLI surfaces rejected receipts and transport errors with nonzero exit', async (t) => {
  const f = await fixture(t, (call) => ({ id: call.body.id, status: 'rejected', error: 'Project is busy.' }));
  const rejected = await childRun(cli, ['check', 'p1', '--connection', f.connectionFile, '--json']);
  assert.equal(rejected.code, 1); assert.equal(JSON.parse(rejected.stdout).status, 'rejected');
  const missing = await childRun(cli, ['status', '--connection', path.join(f.temp, 'missing.json'), '--json']);
  assert.equal(missing.code, 1); assert.equal(JSON.parse(missing.stdout).code, 'NOT_CONNECTED');
  assert.match(formatReceipt({ id: 'done', status: 'completed', result: { state: 'failed' } }), /"failed"/);
});

test('MCP command and activity share the authenticated client and strip fabricated observed evidence', async (t) => {
  const f = await fixture(t, (call) => ({ id: call.body.id, status: 'completed', result: call.body.payload }));
  const result = await callTool('district_command', { id: 'reported', type: 'report_activity', projectId: 'p1',
    payload: { workerId: 'worker1', phase: 'build', message: 'Reported only', basis: 'observed', evidence: { passed: true }, at: 1 } }, f.connectionFile);
  assert.equal(result.result.basis, 'reported'); assert.equal(result.result.origin, 'mcp');
  assert.equal(result.result.evidence, undefined); assert.equal(result.result.at, undefined, 'Only the authority stamps received activity time.');
  await assert.rejects(callTool('district_command', { id: 'x', type: 'start_task', origin: 'observed' }, f.connectionFile), /Unknown tool argument/);
  await assert.rejects(callTool('district_activity', { id: 'x', projectId: 'p1', workerId: 'w', phase: 'passed', message: 'fake' }, f.connectionFile), /Activity requires/);
});

test('actual stdio MCP process exposes tools and accepted receipts without stdout chatter', async (t) => {
  const f = await fixture(t, (call) => call.url === '/snapshot' ? { version: 1, projects: [], runs: [], activities: [], providers: [], checkpoints: [], previews: [], seq: 23 } : { id: call.body.id, status: 'accepted', runId: 'r1' });
  const messages = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'district_snapshot', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'district_command', arguments: { id: 'mcp-start', type: 'run_checks', projectId: 'p1' } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'district_activity', arguments: { id: 'mcp-report', projectId: 'p1', workerId: 'w1', phase: 'research', message: 'Inspecting source' } } },
    { jsonrpc: '2.0', id: 6, method: 'unknown' },
  ];
  const child = await childRun(mcp, ['--connection', f.connectionFile], { input: messages.map((value) => JSON.stringify(value)).join('\n') + '\n' });
  assert.equal(child.code, 0, child.stderr); assert.equal(child.stderr, '');
  const replies = child.stdout.trim().split('\n').map((line) => JSON.parse(line));
  const byId = new Map(replies.map((reply) => [reply.id, reply]));
  assert.equal(replies.length, 6);
  assert.equal(byId.get(1).result.protocolVersion, '2025-06-18');
  assert.deepEqual(byId.get(2).result.tools.map((tool) => tool.name), ['district_snapshot', 'district_command', 'district_activity']);
  assert.equal(byId.get(3).result.structuredContent.seq, 23);
  assert.equal(byId.get(4).result.structuredContent.status, 'accepted');
  assert.match(byId.get(4).result.content[1].text, /not yet completed/);
  assert.equal(byId.get(6).error.code, -32601);
  const report = f.calls.find((call) => call.body?.id === 'mcp-report').body;
  assert.equal(report.payload.basis, 'reported'); assert.equal(report.origin, 'mcp');
  assert(!child.stdout.includes(f.descriptor.token));
});

test('CLI and MCP traverse the actual DistrictBridge and see one runtime snapshot', async (t) => {
  const { DistrictBridge } = require('../app/district/bridge');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-bridge-client-'));
  const connectionFile = path.join(temp, 'connection.json');
  const commands = [];
  const snapshot = { version: 1, projects: [{ id: 'p1', name: 'Bridge fixture' }], runs: [], activities: [], providers: [], checkpoints: [], previews: [], seq: 7 };
  const runtime = { snapshot: async () => snapshot, command: async (command) => {
    commands.push(command);
    return { id: command.id, status: 'accepted', projectId: command.projectId, runId: 'r-bridge' };
  } };
  const bridge = new DistrictBridge({ runtime, connectionFile });
  t.after(async () => { await bridge.close(); fs.rmSync(temp, { recursive: true, force: true }); });
  await bridge.start();
  const status = await childRun(cli, ['status', '--json', '--connection', connectionFile]);
  assert.equal(status.code, 0, status.stderr); assert.deepEqual(JSON.parse(status.stdout), snapshot);
  const check = await childRun(cli, ['check', 'p1', '--id', 'real-bridge-command', '--connection', connectionFile]);
  assert.equal(check.code, 0, check.stderr); assert.match(check.stdout, /not yet completed/);
  assert.deepEqual(commands[0], { id: 'real-bridge-command', type: 'run_checks', origin: 'cli', projectId: 'p1' });
  assert.deepEqual(await callTool('district_snapshot', {}, connectionFile), snapshot);
  await callTool('district_activity', { id: 'bridge-report', projectId: 'p1', workerId: 'w1', phase: 'research', message: 'Reading the project' }, connectionFile);
  assert.equal(commands[1].origin, 'mcp'); assert.equal(commands[1].payload.basis, 'reported');
  assert.equal(commands[1].type, 'report_activity');
  const rally = await childRun(cli, ['create', 'My Rally', '--starter', 'neon-rally', '--id', 'real-rally-create', '--connection', connectionFile, '--json']);
  assert.equal(rally.code, 0, rally.stdout + rally.stderr);
  assert.deepEqual(commands[2], { id: 'real-rally-create', type: 'create_project', origin: 'cli', payload: { name: 'My Rally', starterId: 'neon-rally' } });
  const beforeInvalid = commands.length;
  const invalid = await childRun(cli, ['create', 'Wrong', '--starter', 'invented', '--connection', connectionFile, '--json']);
  assert.equal(invalid.code, 1); assert.match(JSON.parse(invalid.stdout).error, /Unknown starter/);
  assert.equal(commands.length, beforeInvalid, 'Invalid starter is rejected before the real bridge dispatches.');
  await bridge.close(); assert.equal(fs.existsSync(connectionFile), false);
});

test('display controls reject malformed, outside and ambiguous custom arguments without dispatch', async (t) => {
  const invalid = [
    ['--area', 'custom'],
    ['--area', 'custom', '--bounds', '0,0,0.5'],
    ['--area', 'custom', '--bounds', '0,,0.5,0.5'],
    ['--area', 'custom', '--bounds', '0,0,0.5,0.5,1'],
    ['--area', 'custom', '--bounds', 'NaN,0,0.5,0.5'],
    ['--area', 'custom', '--bounds', '0,Infinity,0.5,0.5'],
    ['--area', 'custom', '--bounds', '0x0,0,0.5,0.5'],
    ['--area', 'custom', '--bounds', '0,0,0.5oops,0.5'],
    ['--area', 'custom', '--bounds', '-0.1,0,0.5,0.5'],
    ['--area', 'custom', '--bounds', '0.8,0,0.5,0.5'],
    ['--area', 'custom', '--bounds', '0,0,0,0.5'],
    ['--area', 'full', '--bounds', '0,0,0.5,0.5'],
    ['--area', 'virtual-monitor-3'],
  ];
  for (const args of invalid) {
    assert.throws(() => buildCommand(parseArgs(['display', 'p1', '--monitor', '3242010503', ...args])), undefined, args.join(' '));
  }
  assert.throws(() => buildCommand(parseArgs(['display', 'p1', '--area', 'full'])), /requires --monitor/);
  assert.throws(() => parseArgs(['display', 'p1', '--monitor', 'x'.repeat(129), '--area', 'full']), /at most 128/);
  assert.throws(() => parseArgs(['visual-check', 'p1', '--run', 'x'.repeat(129)]), /at most 128/);
  assert.throws(() => buildCommand(parseArgs(['window', 'p1', '--id', 'bad id'])), /Command id/);
  assert.throws(() => parseArgs(['display', 'p1', '--monitor', '1', '--area', 'custom', '--bounds', '0'.repeat(257)]), /at most 256/);
  const f = await fixture(t);
  const child = await childRun(cli, ['display', 'p1', '--monitor', '3242010503', '--area', 'custom', '--bounds', '0,0,wrong,1', '--connection', f.connectionFile, '--json']);
  assert.equal(child.code, 1); assert.match(JSON.parse(child.stdout).error, /four finite decimal fractions/);
  assert.equal(f.calls.length, 0, 'Invalid custom input must not fall back or reach the command endpoint.');
});

test('new display, visual-check and window CLI commands traverse the real bridge without live windows', async (t) => {
  const { DistrictBridge } = require('../app/district/bridge');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-visual-cli-'));
  const connectionFile = path.join(temp, 'connection.json');
  const commands = [];
  const snapshot = { version: 1, projects: [{ id: 'p1', name: 'Display fixture' }], runs: [], activities: [], providers: [], checkpoints: [], previews: [], seq: 31,
    displays: [{ id: '3242010503', name: 'Monitor 1 — 3840×2160 px (1536×864 logical, 2.5×)', primary: false,
      workArea: { x: -1536, y: 0, width: 1536, height: 824 }, scaleFactor: 2.5 }] };
  const runtime = { snapshot: async () => snapshot, command: async (command) => {
    commands.push(JSON.parse(JSON.stringify(command)));
    return command.type === 'run_visual_checks' ? { id: command.id, status: 'accepted', projectId: command.projectId, runId: 'visual-fixture' }
      : { id: command.id, status: 'completed', projectId: command.projectId, result: { fixtureOnly: true } };
  } };
  const bridge = new DistrictBridge({ runtime, connectionFile });
  t.after(async () => { await bridge.close(); fs.rmSync(temp, { recursive: true, force: true }); });
  await bridge.start();
  const common = ['--connection', connectionFile];
  const custom = await childRun(cli, ['display', 'p1', '--monitor', '3242010503', '--area', 'custom', '--bounds', '0.1, 0.2, 0.5, 0.5', '--id', 'display-custom', '--json', ...common]);
  assert.equal(custom.code, 0, custom.stdout + custom.stderr);
  assert.deepEqual(commands[0], { id: 'display-custom', type: 'set_project_preferences', origin: 'cli', projectId: 'p1',
    payload: { testDisplayId: '3242010503', testRegion: 'custom', testBounds: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } } });
  const preset = await childRun(cli, ['display', 'p1', '--monitor', '3242010503', '--area', 'bottom-right', '--id', 'display-quarter', '--json', ...common]);
  assert.equal(preset.code, 0, preset.stdout + preset.stderr);
  assert.deepEqual(commands[1].payload, { testDisplayId: '3242010503', testRegion: 'bottom-right', testBounds: null });
  const visual = await childRun(cli, ['visual-check', 'p1', '--run', 'candidate-1', '--id', 'visual-stable', ...common]);
  assert.equal(visual.code, 0, visual.stdout + visual.stderr); assert.match(visual.stdout, /Accepted command visual-stable/);
  assert.match(visual.stdout, /not yet completed/); assert.doesNotMatch(visual.stdout, /checks passed|visual check passed/i);
  assert.deepEqual(commands[2], { id: 'visual-stable', type: 'run_visual_checks', origin: 'cli', projectId: 'p1', payload: { runId: 'candidate-1' } });
  const window = await childRun(cli, ['window', 'p1', '--run', 'candidate-1', '--id', 'window-stable', '--json', ...common]);
  assert.equal(window.code, 0, window.stdout + window.stderr);
  assert.deepEqual(commands[3], { id: 'window-stable', type: 'open_preview_window', origin: 'cli', projectId: 'p1', payload: { runId: 'candidate-1' } });
  const status = await childRun(cli, ['status', ...common]);
  assert.equal(status.code, 0); assert.match(status.stdout, /OS monitor 3242010503/); assert.match(status.stdout, /3840×2160 px/);
  assert.match(status.stdout, /1536×864 logical/);
  assert.equal(commands.length, 4, 'Fixtures record commands only; no Electron window or visual checks are started.');
});

test('accepted-output check detects a planted false-completion break and passes after restoration', async (t) => {
  const f = await fixture(t, (call) => ({ id: call.body.id, status: 'accepted', runId: 'fixture-run' }));
  const copyCli = path.join(f.temp, 'bin', 'district.cjs');
  fs.mkdirSync(path.dirname(copyCli), { recursive: true });
  fs.mkdirSync(path.join(f.temp, 'app', 'district'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'app', 'district', 'client.js'), path.join(f.temp, 'app', 'district', 'client.js'));
  fs.copyFileSync(path.join(repo, 'app', 'district', 'regions.js'), path.join(f.temp, 'app', 'district', 'regions.js'));
  fs.copyFileSync(path.join(repo, 'app', 'district', 'contracts.js'), path.join(f.temp, 'app', 'district', 'contracts.js'));
  const source = fs.readFileSync(cli, 'utf8');
  const broken = source.replace('Execution is not yet completed. Use status --json to inspect the real run state and evidence.', 'Execution completed successfully.');
  assert.notEqual(broken, source, 'The planted break must change the actual formatter.');
  // JavaScript is compiled by each fresh Node process. The broken copy is never
  // loaded into the real app or another agent's checkout.
  fs.writeFileSync(copyCli, broken);
  const args = ['check', 'p1', '--connection', f.connectionFile];
  const failed = await childRun(copyCli, args);
  assert.equal(failed.code, 0);
  assert.throws(() => assert.match(failed.stdout, /Execution is not yet completed/), assert.AssertionError,
    'The truthful-acceptance check must fail on the planted false completion.');
  fs.writeFileSync(copyCli, source);
  const restored = await childRun(copyCli, args);
  assert.equal(restored.code, 0); assert.match(restored.stdout, /Execution is not yet completed/);
});
