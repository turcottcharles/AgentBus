'use strict';
// Negative boundary checks use owned disposable projects, never user workspaces
// or live providers. Browser sandbox execution is qualified by the root UI pass.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { DistrictStore } = require('../app/district/store');
const { Workspaces, LIMITS } = require('../app/district/workspaces');
const { DistrictBridge } = require('../app/district/bridge');
const { makeTicket, revokeTicket, createJournalReader } = require('../app/district/agent-session');
const { createTools, signEvent } = require('../app/district/project-agent-mcp');
const { PreviewManager } = require('../app/district/preview');
const { DistrictRuntime } = require('../app/district/runtime');
const { resolveBounds } = require('../app/district/regions');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function removeOwned(directory) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.match(path.basename(resolved), /^agent-bus-district-security-/);
  assert.equal(fs.lstatSync(resolved).isSymbolicLink(), false);
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
}
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-security-'));
  const root = path.join(directory, 'projects');
  const outside = path.join(directory, 'outside'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'sentinel.txt'), 'OUTSIDE-BOUNDARY-SENTINEL');
  const db = new DatabaseSync(':memory:'), store = new DistrictStore({ db });
  const cleanups = [];
  const workspaces = new Workspaces({ root, store });
  const project = workspaces.create({ name: 'Security fixture' });
  t.after(async () => { for (const close of cleanups.reverse()) await close(); db.close(); removeOwned(directory); });
  return { directory, root, outside, db, store, workspaces, project, cleanup: (close) => cleanups.push(close) };
}
function rawRequest(url, requestPath, { method = 'GET', headers = {}, body } = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: target.hostname, port: target.port,
      path: requestPath, method, headers, timeout: 3000 }, (response) => {
      const chunks = []; response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject); request.on('timeout', () => request.destroy(new Error('Security fixture HTTP deadline')));
    request.end(body);
  });
}
function ticketFixture(t, project) {
  const ticket = makeTicket({ root: project.root, runId: 'run-security-' + crypto.randomUUID(), timeoutMs: 10000 });
  t.after(async () => {
    await revokeTicket(ticket, 'Security fixture completed');
    const directory = path.resolve(ticket.directory);
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.match(path.basename(directory), /^agent-bus-project-/);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  return ticket;
}

test('workspace capabilities reject traversal, Windows aliases and private paths before any write', (t) => {
  const { workspaces, project, outside } = fixture(t);
  const before = workspaces.manifest(project.id);
  const unsafe = ['../outside/sentinel.txt', '..\\outside\\sentinel.txt', '/outside.txt',
    'C:\\outside\\sentinel.txt', '\\\\host\\share\\sentinel.txt', 'index.html:secret',
    'CON.txt', 'aux.json', 'COM1.js', 'LPT9.txt', 'NUL.css', 'index.html.', 'index.html ',
    '.agent-bus/workspace.json', '.AGENT-BUS/secret.txt', '.git/config.txt', 'nested/../index.html',
    'nested//file.txt', 'file.exe', 'bad\u0000name.txt'];
  for (const relative of unsafe) {
    assert.throws(() => workspaces.write(project.id, relative, 'ATTACK'), undefined, relative);
    assert.throws(() => workspaces.resolve(project.id, relative), undefined, relative);
  }
  assert.equal(workspaces.manifest(project.id).hash, before.hash);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'OUTSIDE-BOUNDARY-SENTINEL');
  const valid = workspaces.write(project.id, 'notes/readme.txt', 'Real bounded write');
  assert.equal(valid.hash, hash('Real bounded write'));
  assert.equal(workspaces.read(project.id, 'notes/readme.txt'), 'Real bounded write');
});

test('workspace reads, writes and enumeration reject junction escapes and hardlinked public files', (t) => {
  const { workspaces, project, outside } = fixture(t);
  const link = path.join(project.root, 'linked');
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => workspaces.resolve(project.id, 'linked/sentinel.txt'), /link|unsafe/i);
  assert.throws(() => workspaces.read(project.id, 'linked/sentinel.txt'), /link|unsafe/i);
  assert.throws(() => workspaces.write(project.id, 'linked/sentinel.txt', 'ATTACK'), /link|unsafe/i);
  assert.throws(() => workspaces.files(project.id), /link|unsafe/i);
  assert.throws(() => workspaces.manifest(project.id), /link|unsafe/i);
  fs.unlinkSync(link);
  const hardlink = path.join(project.root, 'hardlink.txt');
  fs.linkSync(path.join(outside, 'sentinel.txt'), hardlink);
  assert.throws(() => workspaces.read(project.id, 'hardlink.txt'), /link|unsafe/i);
  assert.throws(() => workspaces.write(project.id, 'hardlink.txt', 'ATTACK'), /link|unsafe/i);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'OUTSIDE-BOUNDARY-SENTINEL');
});

test('workspace ownership rejects forged store roots and replaced project-root junctions', (t) => {
  const { root, store, workspaces, project, outside } = fixture(t);
  store.put('project', { ...project, root: outside });
  assert.throws(() => workspaces.write(project.id, 'sentinel.txt', 'ATTACK'), /outside|ownership/i);
  store.put('project', project);
  const saved = path.join(root, project.id + '-original');
  assert.equal(path.dirname(path.resolve(saved)), path.resolve(root));
  assert.equal(path.dirname(path.resolve(project.root)), path.resolve(root));
  fs.renameSync(project.root, saved);
  fs.symlinkSync(outside, project.root, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => workspaces.read(project.id, 'sentinel.txt'), /unsafe|link/i);
  assert.throws(() => workspaces.write(project.id, 'sentinel.txt', 'ATTACK'), /unsafe|link/i);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'OUTSIDE-BOUNDARY-SENTINEL');
});

test('workspace file and total byte limits fail without partial writes', (t) => {
  const { workspaces, project } = fixture(t);
  const before = workspaces.read(project.id, 'script.js');
  assert.throws(() => workspaces.write(project.id, 'script.js', 'x'.repeat(LIMITS.maxFileBytes + 1)), /limit/i);
  assert.equal(workspaces.read(project.id, 'script.js'), before);
  for (let index = 0; index < 3; index++) workspaces.write(project.id, `large-${index}.txt`, 'x'.repeat(LIMITS.maxFileBytes));
  assert.throws(() => workspaces.write(project.id, 'too-much.txt', 'x'.repeat(LIMITS.maxFileBytes)), /limit/i);
  assert.equal(fs.existsSync(path.join(project.root, 'too-much.txt')), false);
});

test('workspace public file-count cap cannot be bypassed with nested paths', (t) => {
  const { workspaces, project } = fixture(t);
  const initial = workspaces.files(project.id).length;
  for (let index = initial; index < LIMITS.maxFiles; index++) workspaces.write(project.id, `nested/item-${index}.txt`, 'bounded');
  assert.equal(workspaces.files(project.id).length, LIMITS.maxFiles);
  assert.throws(() => workspaces.write(project.id, 'nested/extra.txt', 'ATTACK'), /limit/i);
  assert.equal(fs.existsSync(path.join(project.root, 'nested/extra.txt')), false);
});

test('scoped project tools cannot turn reports or blocked writes into observed edits or outcomes', (t) => {
  const { project, workspaces } = fixture(t), ticket = ticketFixture(t, project);
  const call = createTools(ticket), observed = [];
  const consume = createJournalReader(ticket, (event) => observed.push(event));
  assert.throws(() => call('project_write_file', { path: '../escape.txt', content: 'ATTACK' }), /relative|path/i);
  assert.throws(() => call('project_read_file', { path: '.agent-bus/workspace.json' }), /internal|path/i);
  assert.throws(() => call('report_activity', { phase: 'test', message: 'Passed', basis: 'observed', terminal: true }), /arguments/i);
  assert.throws(() => call('run_shell', { command: 'echo forged' }), /Unknown project tool/i);
  consume(); assert.equal(observed.length, 0);
  call('report_activity', { phase: 'test', message: 'I claim every check passed; this is only a report.' });
  const written = call('project_write_file', { path: 'notes.txt', content: 'Actual saved bytes', request_id: 'write-one' });
  const repeated = call('project_write_file', { path: 'notes.txt', content: 'Actual saved bytes', request_id: 'write-one' });
  assert.equal(repeated.repeated, true);
  assert.throws(() => call('project_write_file', { path: 'notes.txt', content: 'Different bytes', request_id: 'write-one' }), /different write/i);
  consume();
  assert.deepEqual(observed.map((event) => [event.type, event.basis]), [['activity', 'reported'], ['file_changed', 'observed']]);
  assert.equal(observed.some((event) => event.terminal || event.state === 'passed' || event.type === 'result'), false);
  assert.equal(written.hash, hash(workspaces.read(project.id, 'notes.txt')));
  assert.equal(observed[1].hash, written.hash);
});

test('signed project journal rejects a forged signature, replay and fabricated outcome event', (t) => {
  const { project } = fixture(t);
  for (const attack of ['signature', 'replay', 'outcome']) {
    const ticket = ticketFixture(t, project), call = createTools(ticket), projected = [];
    call('report_activity', { phase: 'research', message: 'Legitimate report' });
    const consume = createJournalReader(ticket, (event) => projected.push(event)); consume();
    const first = JSON.parse(fs.readFileSync(ticket.events, 'utf8').trim());
    let envelope;
    if (attack === 'signature') envelope = { body: first.body, mac: '0'.repeat(64) };
    else if (attack === 'replay') envelope = first;
    else envelope = signEvent(ticket, { id: crypto.randomUUID(), runId: ticket.runId, seq: 2,
      previousMac: first.mac, at: Date.now(), type: 'runner_complete', state: 'passed', basis: 'observed' });
    fs.appendFileSync(ticket.events, JSON.stringify(envelope) + '\n');
    assert.throws(() => consume(), /signature|replay|order|Unknown project event/i, attack);
    assert.equal(projected.length, 1, 'Only the real preceding activity is projected');
  }
});

test('revoked and expired project tickets cannot read, write or report activity', async (t) => {
  const { project, workspaces } = fixture(t), ticket = ticketFixture(t, project);
  const call = createTools(ticket), before = workspaces.manifest(project.id).hash;
  await revokeTicket(ticket, 'Owner cancelled');
  for (const [name, args] of [['project_list_files', {}], ['project_read_file', { path: 'index.html' }],
    ['project_write_file', { path: 'index.html', content: 'ATTACK' }], ['report_activity', { phase: 'edit', message: 'Late report' }]]) {
    assert.throws(() => call(name, args), /revoked/i);
  }
  const expired = ticketFixture(t, project);
  const expiredCall = createTools({ ...expired, expiresAt: Date.now() - 1 });
  assert.throws(() => expiredCall('project_write_file', { path: 'index.html', content: 'ATTACK' }), /expired/i);
  assert.equal(workspaces.manifest(project.id).hash, before);
});

test('local bridge rejects browser origins, missing credentials and oversized bodies before dispatch', async (t) => {
  const { directory } = fixture(t); let commands = 0, snapshots = 0;
  const connectionFile = path.join(directory, 'connection.json');
  const bridge = new DistrictBridge({ connectionFile, runtime: {
    snapshot: async () => { snapshots++; return { projects: [{ root: 'PRIVATE-FIXTURE-PATH' }] }; },
    command: async (command) => { commands++; return { id: command.id, status: 'accepted' }; },
  } });
  t.after(() => bridge.close());
  const { url } = await bridge.start();
  const descriptor = JSON.parse(fs.readFileSync(connectionFile, 'utf8'));
  assert.equal(new URL(url).hostname, '127.0.0.1');
  const health = await rawRequest(url, '/health');
  assert.equal(health.status, 200); assert.doesNotMatch(health.text, /PRIVATE|token|root|connectionFile/);
  assert.equal((await rawRequest(url, '/snapshot')).status, 401);
  assert.equal((await rawRequest(url, '/snapshot', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const authorization = { Authorization: 'Bearer ' + descriptor.token };
  for (const origin of ['null', '', 'http://127.0.0.1:43210', 'https://attacker.invalid']) {
    assert.equal((await rawRequest(url, '/snapshot', { headers: { ...authorization, Origin: origin } })).status, 403);
    assert.equal((await rawRequest(url, '/command', { method: 'POST', headers: { ...authorization,
      Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'blocked', type: 'create_project', payload: { name: 'blocked' } }) })).status, 403);
  }
  assert.equal((await rawRequest(url, '/snapshot', { headers: { ...authorization, Host: 'attacker.invalid' } })).status, 403);
  const large = JSON.stringify({ id: 'oversized', type: 'report_activity', payload: { message: 'x'.repeat(65536) } });
  assert.equal((await rawRequest(url, '/command', { method: 'POST', headers: { ...authorization,
    'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(large) }, body: large })).status, 413);
  assert.equal(commands, 0); assert.equal(snapshots, 0);
  assert.equal((await rawRequest(url, '/snapshot', { headers: authorization })).status, 200);
  const accepted = await rawRequest(url, '/command', { method: 'POST', headers: { ...authorization,
    'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'legitimate', type: 'create_project', payload: { name: 'legitimate' } }) });
  assert.equal(accepted.status, 200); assert.equal(commands, 1); assert.equal(snapshots, 1);
});

test('external runtime activity cannot forge observed outcomes, cross project identity or dispatch work', async (t) => {
  const f = fixture(t); let agentStarts = 0, recipeStarts = 0;
  const runtime = new DistrictRuntime({ db: f.db, appRoot: path.resolve(__dirname, '..'), workRoot: f.root,
    providerList: async () => [], agentStart: () => { agentStarts++; throw new Error('Must not dispatch'); },
    recipeRun: () => { recipeStarts++; throw new Error('Must not execute'); } });
  f.cleanup(() => runtime.close());
  const run = { id: 'run-security-owned', projectId: f.project.id, worker: 'codex', state: 'working', created: Date.now() };
  runtime.store.put('run', run);
  const receipt = await runtime.command({ id: 'forged-outcome', type: 'report_activity', origin: 'cli', projectId: f.project.id,
    worker: 'codex', payload: { runId: run.id, phase: 'test', message: 'I claim all tests passed',
      basis: 'observed', terminal: true, status: 'completed', state: 'passed', evidence: { exitCode: 0 } } });
  assert.equal(receipt.result.basis, 'reported'); assert.equal(receipt.result.status, 'active');
  assert.equal(receipt.result.terminal, false); assert.equal(receipt.result.evidence, undefined);
  assert.equal(runtime.store.get('run', run.id).state, 'working');
  const other = runtime.workspaces.create({ name: 'Other identity' });
  await assert.rejects(runtime.command({ id: 'wrong-project', type: 'report_activity', origin: 'cli',
    projectId: other.id, worker: 'codex', payload: { runId: run.id, phase: 'review', message: 'Wrong project' } }), /different project/i);
  runtime.store.put('run', { ...run, state: 'passed' });
  const late = await runtime.command({ id: 'late-report', type: 'report_activity', origin: 'cli', projectId: f.project.id,
    worker: 'codex', payload: { runId: run.id, phase: 'edit', message: 'Resume work after terminal result' } });
  assert.equal(late.result, null); assert.equal(runtime.store.get('run', run.id).state, 'passed');
  assert.equal(agentStarts, 0); assert.equal(recipeStarts, 0);
});

test('runtime cancellation preserves unknown subprocess termination instead of claiming confirmed stop', { timeout: 15000 }, async (t) => {
  const f = fixture(t); let finishAgent;
  const runtime = new DistrictRuntime({ db: f.db, appRoot: path.resolve(__dirname, '..'), workRoot: f.root,
    providerList: async () => [], agentStart: async () => ({
      finished: new Promise((resolve) => { finishAgent = resolve; }),
      cancel: async () => { finishAgent({ exitCode: null, error: 'Fixture stop unconfirmed', termination: { confirmed: false } }); return { confirmed: false }; },
    }), recipeRun: () => { throw new Error('Cancelled agent must not start checks'); } });
  f.cleanup(() => runtime.close());
  const accepted = await runtime.command({ id: 'uncertain-agent', type: 'start_task', projectId: f.project.id,
    worker: 'codex', instruction: 'Fixture only; no provider process' });
  const deadline = Date.now() + 2000;
  while (!runtime.active.get(accepted.runId)?.handle && Date.now() < deadline) await pause(10);
  assert(runtime.active.get(accepted.runId)?.handle, 'The owned fixture session must reach cancellable state');
  await runtime.command({ id: 'cancel-uncertain', type: 'cancel_run', payload: { runId: accepted.runId } });
  const result = await runtime.waitForRun(accepted.runId);
  assert.equal(result.state, 'termination_unknown'); assert.match(result.detail, /unconfirmed/i);
});

test('preview serves only bound immutable bytes and refuses traversal, private files, writes and wrong hosts', { timeout: 10000 }, async (t) => {
  const f = fixture(t), preview = new PreviewManager(); f.cleanup(() => preview.close());
  const artifact = path.join(f.directory, 'artifact'); fs.mkdirSync(artifact);
  for (const relative of f.workspaces.files(f.project.id)) fs.copyFileSync(path.join(f.project.root, relative), path.join(artifact, relative));
  const candidateHash = f.workspaces.manifest(f.project.id).hash;
  const binding = await preview.start({ projectId: f.project.id, runId: 'run-preview-security', artifactRoot: artifact, candidateHash });
  const parsed = new URL(binding.url), prefix = parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1);
  const original = await rawRequest(binding.url, parsed.pathname);
  assert.equal(original.status, 200); assert.match(original.text, /My checklist/);
  const csp = original.headers['content-security-policy'];
  for (const directive of ["connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'", 'sandbox allow-scripts allow-same-origin']) assert(csp.includes(directive), directive);
  assert.equal(original.headers['x-content-type-options'], 'nosniff');
  fs.writeFileSync(path.join(artifact, 'index.html'), 'MUTATED-AFTER-PREVIEW-START');
  const retained = await rawRequest(binding.url, parsed.pathname);
  assert.equal(retained.text, original.text, 'A live artifact mutation cannot change the identified preview');
  const identity = await rawRequest(binding.url, prefix + '__district/identity.json');
  assert.equal(identity.status, 200); const data = JSON.parse(identity.text);
  assert.equal(data.projectId, f.project.id); assert.equal(data.runId, binding.runId); assert.equal(data.candidateHash, candidateHash);
  assert.doesNotMatch(identity.text, /artifactRoot|OUTSIDE-BOUNDARY-SENTINEL/);
  for (const suffix of ['../outside/sentinel.txt', '%2e%2e/outside/sentinel.txt', '%2e%2e%5coutside%5csentinel.txt',
    '.agent-bus/workspace.json', '.git/config', 'index.html:secret', '%00index.html', '%E0%A4%A']) {
    const response = await rawRequest(binding.url, prefix + suffix);
    assert(response.status >= 400, suffix); assert.doesNotMatch(response.text, /OUTSIDE-BOUNDARY-SENTINEL|Security fixture/);
  }
  assert.equal((await rawRequest(binding.url, parsed.pathname, { method: 'POST', body: 'ATTACK' })).status, 405);
  assert.equal((await rawRequest(binding.url, parsed.pathname, { headers: { Host: 'attacker.invalid' } })).status, 400);
});

test('preview rejects mismatched candidates and linked artifact roots or contents', { timeout: 10000 }, async (t) => {
  const f = fixture(t), preview = new PreviewManager(); f.cleanup(() => preview.close());
  const artifact = path.join(f.directory, 'artifact'); fs.mkdirSync(artifact);
  for (const relative of f.workspaces.files(f.project.id)) fs.copyFileSync(path.join(f.project.root, relative), path.join(artifact, relative));
  const candidateHash = f.workspaces.manifest(f.project.id).hash;
  const input = { projectId: f.project.id, runId: 'run-linked-security', artifactRoot: artifact, candidateHash };
  await assert.rejects(preview.start({ ...input, candidateHash: '0'.repeat(64) }), /candidate hash/i);
  const alias = path.join(f.directory, 'artifact-alias'); fs.symlinkSync(artifact, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(preview.start({ ...input, artifactRoot: alias }), /real directory|symlink|junction/i);
  fs.symlinkSync(f.outside, path.join(artifact, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(preview.start(input), /symlink|junction/i);
  assert.equal(preview.list().length, 0);
});

test('runtime preview commands resolve a real checked run and ignore caller supplied roots, URLs and candidate claims', { timeout: 25000 }, async (t) => {
  const f = fixture(t);
  const runtime = new DistrictRuntime({ db: f.db, appRoot: path.resolve(__dirname, '..'), workRoot: f.root,
    providerList: async () => [], agentStart: () => { throw new Error('Checks must not invoke a provider'); } });
  f.cleanup(() => runtime.close());
  const accepted = await runtime.command({ id: 'real-security-checks', type: 'run_checks', projectId: f.project.id, origin: 'cli' });
  const run = await runtime.waitForRun(accepted.runId);
  assert.equal(run.state, 'passed', run.detail + '\n' + run.output);
  const receipt = await runtime.command({ id: 'preview-forged-payload', type: 'preview_start', projectId: f.project.id,
    payload: { runId: run.id, artifactRoot: f.outside, url: 'https://attacker.invalid/', candidateHash: '0'.repeat(64) } });
  assert.equal(receipt.result.runId, run.id); assert.equal(receipt.result.candidateHash, run.artifact.candidateHash);
  assert.equal(new URL(receipt.result.url).hostname, '127.0.0.1');
  const other = runtime.workspaces.create({ name: 'Unrelated preview project' });
  await assert.rejects(runtime.command({ id: 'preview-cross-project', type: 'preview_start', projectId: other.id,
    payload: { runId: run.id } }), /Build and check|project/i);
  const forged = { ...run, id: 'run-forged-artifact', artifact: { ...run.artifact, root: f.outside } };
  runtime.store.put('run', forged);
  await assert.rejects(runtime.command({ id: 'preview-foreign-disk-root', type: 'preview_start', projectId: f.project.id,
    payload: { runId: forged.id } }), /outside.*owned|output directory/i);
  runtime.workspaces.write(f.project.id, 'styles.css', runtime.workspaces.read(f.project.id, 'styles.css') + '\n/* source changed after build */\n');
  await assert.rejects(runtime.command({ id: 'stale-element-change', type: 'start_task', projectId: f.project.id,
    worker: 'codex', instruction: 'This must be rejected before reaching any provider', payload: { selection: {
      projectId: f.project.id, runId: run.id, candidateHash: run.artifact.candidateHash,
      selector: '[data-testid="add-task"]', tag: 'button', text: 'Add task',
    } } }), /stale|different project/i);
  const snapshot = await runtime.snapshot();
  const shown = snapshot.previews.find((item) => item.projectId === f.project.id);
  assert.equal(shown.stale, true); assert.equal(shown.candidateHash, run.artifact.candidateHash);
});

test('display preferences normalize fractions without granting raw geometry or opening a window', async (t) => {
  const f = fixture(t), monitorId = '3242010503'; let opens = 0;
  const workArea = { x: -1537, y: 11, width: 1537, height: 823 };
  const displayManager = { list: () => [{ id: monitorId, workArea }], close() {},
    open: async (options) => {
      opens++;
      const bounds = resolveBounds(workArea, options.region, options.regionBounds);
      return { id: 1, getBounds: () => bounds, districtDisplay: { effectiveBounds: bounds } };
    } };
  const runtime = new DistrictRuntime({ db: f.db, appRoot: path.resolve(__dirname, '..'), workRoot: f.root,
    displayManager, providerList: async () => [] }); f.cleanup(() => runtime.close());
  const valid = { x: 0.25, y: 0.25, width: 0.5, height: 0.5, rawX: 90000, displayId: 'foreign' };
  await runtime.command({ id: 'safe-fractions', type: 'set_project_preferences', projectId: f.project.id,
    payload: { testDisplayId: monitorId, testRegion: 'custom', testBounds: valid,
      bounds: { x: 90000, y: 90000, width: 90000, height: 90000 }, url: 'https://attacker.invalid/' } });
  const stored = runtime.project(f.project.id).preferences;
  assert.deepEqual(stored, { testDisplayId: monitorId, testRegion: 'custom', testBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } });
  assert.equal(opens, 0, 'Choosing area preferences alone cannot dispatch or open windows');
  for (const [index, bad] of [null, [], { x: -0.1, y: 0, width: 0.5, height: 0.5 },
    { x: 0.8, y: 0, width: 0.5, height: 0.5 }, { x: 0, y: 0, width: 0, height: 0.5 },
    { x: '0', y: 0, width: 0.5, height: 0.5 }, { x: 0, y: 0, width: Infinity, height: 0.5 }].entries()) {
    await assert.rejects(runtime.command({ id: `bad-region-${index}`, type: 'set_project_preferences', projectId: f.project.id,
      payload: { testRegion: 'custom', testBounds: bad } }), /custom area|fractions|inside|positive/i);
  }
  await assert.rejects(runtime.command({ id: 'disconnected-display', type: 'set_project_preferences', projectId: f.project.id,
    payload: { testDisplayId: 'not-connected' } }), /not connected/i);
  assert.deepEqual(runtime.project(f.project.id).preferences, stored);
  const accepted = await runtime.command({ id: 'display-build-source', type: 'run_checks', projectId: f.project.id });
  const candidate = await runtime.waitForRun(accepted.runId); assert.equal(candidate.state, 'passed', candidate.detail);
  const receipt = await runtime.command({ id: 'open-using-host-bounds', type: 'open_preview_window', projectId: f.project.id,
    payload: { runId: candidate.id, displayId: 'not-connected', region: 'full', bounds: { x: 90000, y: 0, width: 50, height: 50 } } });
  assert.equal(opens, 1); assert.equal(receipt.result.displayId, monitorId);
  assert.deepEqual(receipt.result.bounds, resolveBounds(workArea, 'custom', stored.testBounds));
});

test('visual run authority rejects contradictory candidate identity and arbitrary passing check names', { timeout: 25000 }, async (t) => {
  const f = fixture(t); let corruption = null;
  const names = ['Preview load', 'Target display', 'Add two tasks', 'Complete a task', 'Remove a task'];
  const display = { id: '3242010503', workArea: { x: -1537, y: 11, width: 1537, height: 823 } };
  const displayManager = { list: () => [display], close() {},
    async runChecks({ preview }) {
      const result = { state: 'passed', exitCode: 0, previewId: preview.id, runId: preview.runId,
        candidateHash: preview.candidateHash, display: { ...display }, effectiveBounds: resolveBounds(display.workArea),
        checks: names.map((name) => ({ name, state: 'passed', detail: 'Fixture control' })) };
      if (corruption === 'candidateHash') result.candidateHash = '0'.repeat(64);
      if (corruption === 'runId') result.runId = 'run-unrelated-candidate';
      if (corruption === 'previewId') result.previewId = 'preview-unrelated-window';
      if (corruption === 'checks') result.checks = [{ name: 'Invented success', state: 'passed', detail: 'No actual checklist evidence' }];
      if (corruption === 'display') result.display.id = 'unrequested-display';
      if (corruption === 'bounds') result.effectiveBounds.x += 1;
      return result;
    } };
  const runtime = new DistrictRuntime({ db: f.db, appRoot: path.resolve(__dirname, '..'), workRoot: f.root,
    displayManager, defaultTestDisplayId: '3242010503', providerList: async () => [] }); f.cleanup(() => runtime.close());
  const accepted = await runtime.command({ id: 'visual-candidate-source', type: 'run_checks', projectId: f.project.id });
  const candidate = await runtime.waitForRun(accepted.runId); assert.equal(candidate.state, 'passed', candidate.detail);
  for (const mode of ['candidateHash', 'runId', 'previewId', 'checks', 'display', 'bounds', null]) {
    corruption = mode;
    const receipt = await runtime.command({ id: 'visual-identity-' + (mode || 'control'), type: 'run_visual_checks',
      projectId: f.project.id, payload: { runId: candidate.id } });
    const result = await runtime.waitForRun(receipt.runId);
    assert.equal(result.state, mode ? 'failed' : 'passed', `${mode || 'control'}: ${result.detail}`);
  }
});

test('conversation cannot commit a cancelled capture final while the next capture identity is pending', async () => {
  // Minimal DOM fixture: no native speech process, microphone or provider is used.
  const nodes = [];
  const document = { activeElement: null, createElement(tag) {
    const handlers = new Map();
    const node = { tagName: tag.toUpperCase(), ownerDocument: document, children: [], style: {}, dataset: {}, value: '',
      selectionStart: 0, selectionEnd: 0, scrollHeight: 48,
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); return child; },
      setAttribute(key, value) { this[key] = value; }, remove() {},
      addEventListener(type, handler) { const list = handlers.get(type) || []; list.push(handler); handlers.set(type, list); },
      removeEventListener(type, handler) { handlers.set(type, (handlers.get(type) || []).filter((item) => item !== handler)); },
      click() { if (!this.disabled) for (const handler of handlers.get('click') || []) handler({ target: this }); },
    };
    nodes.push(node); return node;
  } };
  const container = document.createElement('div'), window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'district-conversation.js'), 'utf8'),
    { window, Promise, setTimeout, clearTimeout });
  const commits = []; let receive, resolveSecond, starts = 0, stops = 0;
  const voice = { status: async () => ({ available: true }),
    onEvent(listener) { receive = listener; return () => { receive = null; }; },
    start() { starts++; return starts === 1 ? Promise.resolve({ captureId: 'speech-old' }) : new Promise((resolve) => { resolveSecond = resolve; }); },
    stop: async () => { stops++; return { stopped: true, confirmed: true }; },
  };
  const conversation = window.DistrictConversation.mount({ container, voice, onCommit: (request) => { commits.push(request); } });
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await tick();
    const speak = nodes.find((node) => node.className === 'dc-speak');
    const cancel = nodes.find((node) => node.className === 'dc-cancel');
    speak.click(); await tick();
    receive({ type: 'listening', captureId: 'speech-old' });
    cancel.click(); assert.equal(stops, 1);
    speak.click(); assert.equal(starts, 2);
    receive({ type: 'final', captureId: 'speech-old', text: 'Cancelled speech must never start work' });
    await tick();
    assert.equal(commits.length, 0, 'A stale final cannot become a new voice instruction before its capture ID is known');
    resolveSecond({ captureId: 'speech-new' }); await tick();
    receive({ type: 'listening', captureId: 'speech-old' });
    receive({ type: 'final', captureId: 'speech-old', text: 'Still cancelled' });
    receive({ type: 'listening', captureId: 'speech-new' });
    receive({ type: 'partial', captureId: 'speech-new', text: 'Only draft words' });
    await tick(); assert.equal(commits.length, 0);
    receive({ type: 'final', captureId: 'speech-new', text: 'Actual current completed phrase' });
    await tick();
    assert.equal(commits.length, 1); assert.equal(commits[0].text, 'Actual current completed phrase');
    assert.equal(commits[0].source, 'voice');
  } finally { conversation.destroy(); }
});
