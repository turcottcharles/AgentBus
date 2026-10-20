'use strict';
// Real filesystem/recipe/HTTP fixtures. No GPU/native/browser/provider is launched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { PreviewManager } = require('../app/district/preview');
const { Workspaces } = require('../app/district/workspaces');
const { runRecipe } = require('../app/district/recipes');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-showcase-preview-'));
  const records = new Map(), store = {
    get: (kind, id) => records.get(`${kind}:${id}`) ?? null,
    put: (kind, record) => { records.set(`${kind}:${record.id}`, structuredClone(record)); return structuredClone(record); },
    list: (kind) => [...records].filter(([key]) => key.startsWith(`${kind}:`)).map(([, value]) => structuredClone(value)),
  };
  const workspaces = new Workspaces({ root: path.join(temp, 'projects'), store }), manager = new PreviewManager();
  t.after(async () => {
    await manager.close();
    const target = path.resolve(temp);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.match(path.basename(target), /^agent-bus-showcase-preview-/);
    fs.rmSync(target, { recursive: true, force: true });
  });
  return { temp, workspaces, manager };
}
async function checked(fixture, project, runId) {
  const result = await runRecipe({ root: project.root, artifactRoot: path.join(project.root, '.agent-bus', 'artifacts', runId), runId, contractId: project.starterId || 'checklist' });
  assert.equal(result.state, 'passed', result.output);
  return { projectId: project.id, runId, artifactRoot: result.artifact.root, candidateHash: result.artifact.candidateHash, result };
}
function request(url, options = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: target.hostname, port: target.port, path: options.path || target.pathname + target.search,
      method: options.method || 'GET', headers: options.headers || {}, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.setTimeout(2500, () => req.destroy(new Error('HTTP fixture timed out.')));
    req.once('error', reject); req.end();
  });
}
async function identity(binding) {
  const response = await request(new URL('__district/identity.json', binding.url));
  assert.equal(response.status, 200);
  assert.equal(response.headers['x-district-response-sha256'], hash(response.bytes));
  return JSON.parse(response.bytes);
}

test('checked project snapshots stay distinct from other projects and newer unchecked edits', { timeout: 15000 }, async (t) => {
  const f = fixture(t), left = f.workspaces.create({ name: 'Left actual app' }), right = f.workspaces.create({ name: 'Right actual app' });
  f.workspaces.write(left.id, 'styles.css', 'body { color: teal; }\n');
  f.workspaces.write(right.id, 'styles.css', 'body { color: violet; }\n');
  const leftChecked = await checked(f, left, 'left-run'), rightChecked = await checked(f, right, 'right-run');
  const leftView = await f.manager.start(leftChecked), rightView = await f.manager.start(rightChecked);
  const leftIdentity = await identity(leftView), rightIdentity = await identity(rightView);
  assert.equal(leftIdentity.projectId, left.id); assert.equal(rightIdentity.projectId, right.id);
  assert.equal(leftIdentity.runId, 'left-run'); assert.equal(rightIdentity.runId, 'right-run');
  assert.equal(leftIdentity.candidateHash, leftChecked.candidateHash);
  assert.equal(rightIdentity.candidateHash, rightChecked.candidateHash);
  assert.deepEqual((await request(new URL('styles.css', leftView.url))).bytes, Buffer.from('body { color: teal; }\n'));
  assert.deepEqual((await request(new URL('styles.css', rightView.url))).bytes, Buffer.from('body { color: violet; }\n'));
  f.workspaces.write(left.id, 'styles.css', 'body { color: red; }\n');
  f.workspaces.write(left.id, 'script.js', 'const deliberateSyntaxBreak = ;');
  const failure = await runRecipe({ root: left.root, artifactRoot: path.join(left.root, '.agent-bus', 'artifacts', 'failed-edit'), runId: 'failed-edit' });
  assert.equal(failure.state, 'failed'); assert.equal(failure.artifact, null);
  assert.notEqual(f.workspaces.manifest(left.id).hash, leftIdentity.candidateHash);
  assert.deepEqual((await request(new URL('styles.css', leftView.url))).bytes, Buffer.from('body { color: teal; }\n'));
  assert.equal((await identity(leftView)).runId, 'left-run', 'a failed edit cannot relabel historical output');
  assert.equal((await identity(rightView)).projectId, right.id);
  const wrongPrefix = new URL(leftView.url).pathname;
  assert.equal((await request(rightView.url, { path: wrongPrefix })).status, 404);
});

test('opening the same verified run reuses the live binding instead of restarting its app', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Stable live application' }), candidate = await checked(f, project, 'stable-run');
  const first = await f.manager.start(candidate);
  const [again, concurrent] = await Promise.all([f.manager.start(candidate), f.manager.start({ ...candidate, candidateHash: candidate.candidateHash.toUpperCase() })]);
  assert.deepEqual(again, first); assert.deepEqual(concurrent, first);
  assert.equal(f.manager.list().length, 1);
  assert.equal((await request(first.url)).status, 200);
  fs.writeFileSync(path.join(candidate.artifactRoot, 'styles.css'), 'body { color: red; }');
  await assert.rejects(f.manager.start(candidate), /candidate hash/);
  assert.deepEqual(f.manager.list()[0], first, 'tampered disk bytes do not replace the captured candidate');
});

test('a new checked candidate replaces only its own project and old URLs stop serving', { timeout: 15000 }, async (t) => {
  const f = fixture(t), firstProject = f.workspaces.create({ name: 'First' }), otherProject = f.workspaces.create({ name: 'Other' });
  const before = await checked(f, firstProject, 'before'), other = await checked(f, otherProject, 'other');
  const beforeView = await f.manager.start(before), otherView = await f.manager.start(other);
  f.workspaces.write(firstProject.id, 'styles.css', 'body { color: orange; }');
  const after = await checked(f, firstProject, 'after'), afterView = await f.manager.start(after);
  assert.notEqual(afterView.id, beforeView.id); assert.notEqual(afterView.candidateHash, beforeView.candidateHash);
  await assert.rejects(request(beforeView.url));
  assert.equal((await identity(afterView)).runId, 'after');
  assert.equal((await request(otherView.url)).status, 200);
  assert.deepEqual((await request(new URL('styles.css', afterView.url))).bytes, Buffer.from('body { color: orange; }'));
  assert.equal(await f.manager.stop(firstProject.id, { previewId: beforeView.id, runId: beforeView.runId }), false, 'late cleanup cannot close a replacement');
  assert.equal((await request(afterView.url)).status, 200);
  assert.equal(await f.manager.stop(firstProject.id, { previewId: afterView.id, runId: 'wrong-run' }), false);
  assert.equal((await request(afterView.url)).status, 200);
  assert.equal(await f.manager.stop(firstProject.id, { previewId: afterView.id, runId: afterView.runId, candidateHash: '0'.repeat(64) }), false);
  assert.equal((await request(afterView.url)).status, 200);
  assert.equal(await f.manager.stop(firstProject.id, { previewId: afterView.id, runId: afterView.runId, candidateHash: afterView.candidateHash }), true);
  await assert.rejects(request(afterView.url)); assert.equal((await request(otherView.url)).status, 200);
});

test('one run identity cannot be rebound to different artifact bytes or directory', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Immutable identity' });
  const first = await checked(f, project, 'identity'), binding = await f.manager.start(first);
  f.workspaces.write(project.id, 'styles.css', 'body { color: magenta; }');
  const second = await checked(f, project, 'different');
  await assert.rejects(f.manager.start({ ...second, runId: first.runId }), /cannot be rebound/);
  assert.equal((await identity(binding)).candidateHash, first.candidateHash);
  assert.equal(f.manager.list()[0].id, binding.id);
});

test('HTML instrumentation precedes application scripts and reports source and served byte hashes separately', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Picker ordering' });
  const html = '<!-- <head>fake marker</head> --><!doctype html><html><head data-label="a > b"><link rel="stylesheet" href="styles.css"><script src="script.js" defer></script></head><body><input data-testid="task-input"><button data-testid="add-task">Add</button><ul data-testid="task-list"></ul></body></html>';
  f.workspaces.write(project.id, 'index.html', html);
  const candidate = await checked(f, project, 'instrumented'), binding = await f.manager.start(candidate);
  const response = await request(binding.url), body = response.bytes.toString('utf8');
  assert.equal(response.status, 200);
  assert.ok(body.indexOf(`<head data-label="a > b">`) < body.indexOf(`__district/${binding.nonce}.js`));
  assert.ok(body.indexOf(`__district/${binding.nonce}.js`) < body.indexOf('src="script.js"'));
  assert.ok(body.startsWith('<!-- <head>fake marker</head> -->'));
  assert.equal(response.headers['x-district-source-sha256'], hash(Buffer.from(html)));
  assert.equal(response.headers['x-district-response-sha256'], hash(response.bytes));
  assert.notEqual(response.headers['x-district-source-sha256'], response.headers['x-district-response-sha256']);
  assert.deepEqual(fs.readFileSync(path.join(candidate.artifactRoot, 'index.html')), Buffer.from(html));
  assert.equal((await identity(binding)).instrumentation.sourceFilesUnchanged, true);
  const head = await request(binding.url, { method: 'HEAD' });
  assert.equal(head.bytes.length, 0); assert.equal(head.headers['x-district-response-sha256'], response.headers['x-district-response-sha256']);
});

test('picker leaves normal keyboard-style clicks available to app handlers and intercepts only explicit inspection', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Interactive source' });
  const candidate = await checked(f, project, 'interact'), binding = await f.manager.start(candidate);
  const bridge = (await request(new URL(`__district/${binding.nonce}.js`, binding.url))).bytes.toString('utf8');
  const documentHandlers = new Map(), windowHandlers = new Map(), sent = [];
  const parent = { postMessage: (data, origin) => sent.push({ data, origin }) };
  const context = { URL, Date, CSS: { escape: (value) => value }, location: new URL(binding.url),
    window: { parent, addEventListener: (name, listener) => windowHandlers.set(name, listener) },
    document: { documentElement: { toggleAttribute() {} }, addEventListener: (name, listener) => documentHandlers.set(name, listener) } };
  vm.runInNewContext(bridge, context, { timeout: 1000 });
  let applicationClicks = 0;
  const button = { nodeType: 1, tagName: 'BUTTON', parentElement: null, id: '', innerText: 'Add a task',
    getAttribute: (name) => name === 'data-testid' ? 'add-task' : null, closest: () => null,
    getBoundingClientRect: () => ({ x: 1, y: 2, width: 90, height: 20 }) };
  function click() { let stopped = false, prevented = false; const event = { target: button, detail: 0,
    preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; }, stopImmediatePropagation: () => { stopped = true; } };
    documentHandlers.get('click')(event); if (!stopped) applicationClicks++; return prevented; }
  assert.equal(click(), false); assert.equal(applicationClicks, 1);
  windowHandlers.get('message')({ source: parent, origin: 'null', data: { type: 'district:inspect', nonce: binding.nonce, enabled: true } });
  assert.equal(click(), true); assert.equal(applicationClicks, 1); assert.equal(sent[0].data.type, 'district:selection');
  assert.equal(sent[0].data.projectId, project.id); assert.equal(sent[0].data.runId, 'interact');
  windowHandlers.get('message')({ source: parent, origin: 'null', data: { type: 'district:inspect', nonce: binding.nonce, enabled: false } });
  assert.equal(click(), false); assert.equal(applicationClicks, 2);
});

test('linked files cannot be admitted as a checked public artifact', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Hardlink guard' }), candidate = await checked(f, project, 'hardlink');
  const original = path.join(candidate.artifactRoot, 'styles.css'), shared = path.join(f.temp, 'outside.css');
  fs.renameSync(original, shared); fs.linkSync(shared, original);
  await assert.rejects(f.manager.start(candidate), /hardlinked public files/);
  assert.deepEqual(f.manager.list(), []);
});

test('close during replacement never returns a newly opened dead binding or leaks its server', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Close replacement' }), before = await checked(f, project, 'close-before');
  const first = await f.manager.start(before), after = await checked(f, project, 'close-after');
  const stop = f.manager._stopSession.bind(f.manager);
  let release, observed;
  const entered = new Promise((resolve) => { observed = resolve; }), gate = new Promise((resolve) => { release = resolve; });
  f.manager._stopSession = async (session) => { if (session.binding.id === first.id) { observed(); await gate; } return stop(session); };
  const replacing = f.manager.start(after);
  await entered;
  const closed = f.manager.close(); release();
  await assert.rejects(replacing, /closed/); await closed;
  assert.deepEqual(f.manager.list(), []); await assert.rejects(request(first.url));
  await f.manager.close(); await assert.rejects(f.manager.start(after), /closed/);
});

test('explicit identity handshake is nonce, parent-window, parent-origin and per-load request scoped', { timeout: 10000 }, async (t) => {
  const f = fixture(t), project = f.workspaces.create({ name: 'Frame attestation' }), candidate = await checked(f, project, 'attested-run');
  const binding = await f.manager.start(candidate), bridge = (await request(new URL(`__district/${binding.nonce}.js`, binding.url))).bytes.toString('utf8');
  const handlers = new Map(), replies = [], parent = { postMessage: (data, origin) => replies.push({ data, origin }) };
  vm.runInNewContext(bridge, { URL, Date, window: { parent, addEventListener: (name, listener) => handlers.set(`window:${name}`, listener) },
    document: { documentElement: { toggleAttribute() {} }, addEventListener: (name, listener) => handlers.set(`document:${name}`, listener) },
    location: new URL(binding.url) }, { timeout: 1000 });
  const verify = (patch = {}, source = parent, origin = 'null') => handlers.get('window:message')({ source, origin,
    data: { type: 'district:verify', nonce: binding.nonce, requestId: 'load-1', ...patch } });
  assert.equal(replies.length, 0, 'no automatic message or polling is added');
  verify({}, {}); verify({ nonce: 'wrong' }); verify({ requestId: '' }); verify({ requestId: 'line\nbreak' }); verify({ requestId: 'x'.repeat(129) });
  assert.equal(replies.length, 0);
  verify(); assert.equal(replies.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0].data)), { type: 'district:identity', nonce: binding.nonce,
    requestId: 'load-1', previewId: binding.id, projectId: project.id, runId: 'attested-run', candidateHash: candidate.candidateHash });
  assert.equal(replies[0].origin, '*', 'opaque file parent is still window/nonce scoped');
  verify({ requestId: 'load-2' }); assert.equal(replies[1].data.requestId, 'load-2');
  verify({ requestId: 'changed-origin' }, parent, 'https://other-parent.invalid'); assert.equal(replies.length, 2);
  assert.equal(replies[0].data.command, undefined); assert.equal(replies[0].data.instruction, undefined);
});
