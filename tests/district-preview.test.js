'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { PreviewManager } = require('../app/district/preview');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const STARTER = {
  'index.html': '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Actual checklist</h1><button data-testid="add-task">Add task</button><script src="script.js"></script></body></html>',
  'styles.css': 'body { color: #52efcb; background: #112233; }\n',
  'script.js': 'window.actualSource = "saved bytes";\n',
};

function artifact(t, entries = STARTER) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-preview-test-'));
  // Remove only this fixture's resolved, explicitly owned temp directory.
  t.after(() => {
    const resolved = path.resolve(root), parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), parent);
    assert.match(path.basename(resolved), /^agent-bus-preview-test-/);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const manifest = {};
  for (const name of Object.keys(entries).sort()) {
    const target = path.join(root, ...name.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const bytes = Buffer.from(entries[name]); fs.writeFileSync(target, bytes);
    manifest[name] = hash(bytes);
  }
  return { root, entries, manifest, candidateHash: hash(JSON.stringify(manifest)) };
}
function manager(t) {
  const preview = new PreviewManager();
  t.after(() => preview.close());
  return preview;
}
function request(url, options = {}) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: parsed.port,
      path: options.path || parsed.pathname + parsed.search, method: options.method || 'GET',
      headers: options.headers || {}, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.setTimeout(3000, () => req.destroy(new Error('Preview fixture request timed out.')));
    req.on('error', reject); req.end();
  });
}
function start(preview, source, overrides = {}) {
  return preview.start({ projectId: 'project-1', runId: 'run-1', artifactRoot: source.root,
    candidateHash: source.candidateHash, ...overrides });
}

test('preview serves verified artifact bytes, real binding identity and restrictive headers', { timeout: 10000 }, async (t) => {
  const source = artifact(t), preview = manager(t), binding = await start(preview, source);
  assert.match(binding.url, /^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{48}\/index\.html$/);
  assert.equal(binding.candidateHash, source.candidateHash);
  assert.equal(preview.list()[0].id, binding.id);
  const html = await request(binding.url);
  assert.equal(html.status, 200);
  assert.match(html.bytes.toString(), /Actual checklist/);
  assert.match(html.bytes.toString(), new RegExp(`__district/${binding.nonce}\\.js`));
  assert.equal(html.headers['x-district-source-sha256'], source.manifest['index.html']);
  assert.equal(html.headers['x-district-candidate-hash'], source.candidateHash);
  assert.equal(html.headers['x-district-preview-id'], binding.id);
  assert.equal(html.headers['cache-control'], 'no-store');
  assert.equal(html.headers['x-content-type-options'], 'nosniff');
  const csp = html.headers['content-security-policy'];
  for (const part of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "object-src 'none'", "base-uri 'none'", "frame-src 'none'", 'sandbox allow-scripts allow-same-origin']) assert(csp.includes(part));
  assert.match(csp, /(?:^|;)\s*sandbox[^;]*\ballow-forms\b/, 'local submit events must reach JS handlers while form-action blocks navigation');
  assert(!csp.includes('unsafe-inline')); assert(!csp.includes('unsafe-eval'));
  assert.equal(html.headers['access-control-allow-origin'], undefined);
  const css = await request(new URL('styles.css', binding.url));
  assert.equal(css.status, 200); assert.deepEqual(css.bytes, Buffer.from(source.entries['styles.css']));
  assert.equal(css.headers['x-district-source-sha256'], source.manifest['styles.css']);
  const js = await request(new URL('script.js', binding.url));
  assert.deepEqual(js.bytes, Buffer.from(source.entries['script.js']));
  const identity = await request(new URL('__district/identity.json', binding.url));
  const record = JSON.parse(identity.bytes);
  assert.equal(record.projectId, binding.projectId); assert.equal(record.runId, binding.runId);
  assert.equal(record.candidateHash, binding.candidateHash); assert.deepEqual(record.files, source.manifest);
  assert.equal(record.root, undefined); assert.equal(record.nonce, undefined);
  const head = await request(binding.url, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.bytes.length, 0);
  assert.equal(Number(head.headers['content-length']), html.bytes.length);
  assert.equal(fs.readFileSync(path.join(source.root, 'index.html'), 'utf8'), source.entries['index.html'], 'instrumentation never edits the artifact');
});

test('binding retains captured bytes after artifact edits; an invalid replacement preserves prior preview', { timeout: 10000 }, async (t) => {
  const source = artifact(t), preview = manager(t), binding = await start(preview, source);
  fs.writeFileSync(path.join(source.root, 'styles.css'), 'body { color: red; }');
  assert.deepEqual((await request(new URL('styles.css', binding.url))).bytes, Buffer.from(source.entries['styles.css']));
  await assert.rejects(start(preview, source, { runId: 'changed-run' }), /candidate hash/);
  assert.equal(preview.list()[0].id, binding.id);
  assert.equal((await request(binding.url)).status, 200);
  fs.unlinkSync(path.join(source.root, 'script.js'));
  assert.deepEqual((await request(new URL('script.js', binding.url))).bytes, Buffer.from(source.entries['script.js']));
});

test('HTTP rejects traversal, private/unsupported routes, foreign hosts and writes', { timeout: 10000 }, async (t) => {
  const preview = manager(t), binding = await start(preview, artifact(t));
  const prefix = new URL('.', binding.url).pathname;
  for (const raw of ['../secret.txt', '%2e%2e/secret.txt', '%2E%2E%2fsecret.txt', 'nested/../index.html', '%5c..%5csecret.txt', 'a%00b', '%zz']) {
    const result = await request(binding.url, { path: prefix + raw });
    assert.equal(result.status, 400, raw); assert(!result.bytes.includes(Buffer.from(process.cwd())));
  }
  for (const raw of ['.agent-bus/ticket.json', '.git/config', 'bus.sqlite', 'CON.txt', 'index.html:stream', '__district/wrong.js', 'missing.txt']) {
    assert.equal((await request(binding.url, { path: prefix + raw })).status, 404, raw);
  }
  assert.equal((await request(binding.url, { path: '/index.html' })).status, 404);
  assert.equal((await request(binding.url, { headers: { Host: 'attacker.example' } })).status, 400);
  const write = await request(binding.url, { method: 'POST' });
  assert.equal(write.status, 405); assert.equal(write.headers.allow, 'GET, HEAD');
});

test('artifact capture rejects unverified identities, private files, unsupported files and oversized trees', { timeout: 10000 }, async (t) => {
  const preview = manager(t), good = artifact(t);
  await assert.rejects(start(preview, good, { artifactRoot: 'relative/path' }), /absolute/);
  await assert.rejects(start(preview, good, { candidateHash: 'not-a-hash' }), /SHA-256/);
  await assert.rejects(start(preview, good, { candidateHash: '0'.repeat(64) }), /candidate hash/);
  await assert.rejects(start(preview, artifact(t, { 'styles.css': 'body{}' })), /index.html/);
  await assert.rejects(start(preview, artifact(t, { ...STARTER, '.agent-bus/ticket.json': '{}' })), /public path/);
  await assert.rejects(start(preview, artifact(t, { ...STARTER, '.git/config': 'private' })), /public path/);
  await assert.rejects(start(preview, artifact(t, { ...STARTER, '__district/identity.json': '{"userFile":true}' })), /public path/);
  await assert.rejects(start(preview, artifact(t, { ...STARTER, 'secret.sqlite': 'private' })), /file type/);
  await assert.rejects(start(preview, artifact(t, { ...STARTER, 'index.html': Buffer.from([0xff, 0xfe, 0xff]) })), /UTF-8/);
  await assert.rejects(start(preview, artifact(t, { ...STARTER, 'huge.txt': Buffer.alloc(1024 * 1024 + 1) })), /limit/);
  const many = { ...STARTER };
  for (let index = 0; index < 30; index++) many[`file-${index}.txt`] = 'x';
  await assert.rejects(start(preview, artifact(t, many)), /limit/);
  const total = { ...STARTER };
  for (let index = 0; index < 5; index++) total[`large-${index}.txt`] = Buffer.alloc(900000);
  await assert.rejects(start(preview, artifact(t, total)), /limit/);
  const deep = `${'directory/'.repeat(17)}file.txt`;
  await assert.rejects(start(preview, artifact(t, { ...STARTER, [deep]: 'x' })), /depth limit/);
  assert.equal(preview.list().length, 0);
});

test('artifact roots and directory entries cannot be symlink or junction aliases', { timeout: 10000 }, async (t) => {
  const preview = manager(t), source = artifact(t), external = artifact(t);
  const alias = path.join(source.root, 'alias');
  try { fs.symlinkSync(external.root, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip('Host does not permit fixture directory links.'); return; } throw error; }
  await assert.rejects(start(preview, source), /symlink|junction/i);
  await assert.rejects(start(preview, external, { artifactRoot: alias }), /symlink|junction/i);
  assert.equal(preview.list().length, 0);
});

test('same-project starts serialize, replacement stops the old port, and close releases owned servers', { timeout: 10000 }, async (t) => {
  const preview = manager(t), source = artifact(t);
  const [first, second] = await Promise.all([start(preview, source), start(preview, source, { runId: 'run-2' })]);
  assert.equal(preview.list().length, 1); assert.equal(preview.list()[0].id, second.id);
  await assert.rejects(request(first.url));
  assert.equal((await request(second.url)).status, 200);
  const other = await start(preview, source, { projectId: 'project-2' });
  assert.equal(preview.list().length, 2);
  assert.equal(await preview.stop('project-1'), true); assert.equal(await preview.stop('project-1'), false);
  await assert.rejects(request(second.url)); assert.equal((await request(other.url)).status, 200);
  await preview.close(); assert.deepEqual(preview.list(), []); await assert.rejects(request(other.url));
  await assert.rejects(start(preview, source), /closed/);
});

test('served picker requires parent nonce handshake and emits bounded contextual selection without commands', { timeout: 10000 }, async (t) => {
  const preview = manager(t), binding = await start(preview, artifact(t));
  const script = await request(new URL(`__district/${binding.nonce}.js`, binding.url));
  assert.equal(script.status, 200);
  const handlers = {}, emitted = [], attrs = new Map();
  const parent = { postMessage: (data, origin) => emitted.push({ data, origin }) };
  const window = { parent, addEventListener: (name, listener) => { handlers[`window:${name}`] = listener; } };
  const document = { documentElement: { toggleAttribute: (name, value) => attrs.set(name, value) },
    addEventListener: (name, listener) => { handlers[`document:${name}`] = listener; } };
  const element = { nodeType: 1, tagName: 'BUTTON', id: '', parentElement: null,
    innerText: 'A'.repeat(2000), getAttribute: (name) => name === 'data-testid' ? 'add-task' : null,
    setAttribute: (name, value) => attrs.set(name, value), removeAttribute: (name) => attrs.delete(name), closest: () => null,
    getBoundingClientRect: () => ({ x: -200000, y: Infinity, width: 300000, height: -20 }) };
  vm.runInNewContext(script.bytes.toString('utf8'), { window, document, URL,
    location: new URL(binding.url), Date, CSS: { escape: (value) => value } }, { timeout: 1000 });
  const message = (source, nonce, enabled, origin = 'null') => handlers['window:message']({ source, origin,
    data: { type: 'district:inspect', nonce, enabled } });
  let prevented = 0;
  const click = () => handlers['document:click']({ target: element, preventDefault: () => prevented++, stopPropagation() {}, stopImmediatePropagation() {} });
  message({}, binding.nonce, true); click(); assert.equal(emitted.length, 0);
  message(parent, 'wrong', true); click(); assert.equal(emitted.length, 0);
  message(parent, binding.nonce, true);
  handlers['document:mouseover']({ target: element }); assert(attrs.has('data-district-preview-target'));
  click(); assert.equal(emitted.length, 1); assert.equal(prevented, 1);
  const selection = emitted[0].data;
  assert.equal(selection.type, 'district:selection'); assert.equal(selection.projectId, binding.projectId);
  assert.equal(selection.runId, binding.runId); assert.equal(selection.candidateHash, binding.candidateHash);
  assert.equal(selection.nonce, binding.nonce); assert.equal(selection.selector, '[data-testid="add-task"]');
  assert.equal(selection.text.length, 500); assert.equal(selection.tag, 'button');
  assert.equal(selection.rect.x, -100000); assert.equal(selection.rect.y, 0);
  assert.equal(selection.rect.width, 100000); assert.equal(selection.rect.height, 0);
  assert.equal(emitted[0].origin, '*', 'opaque file parent still receives a nonce-scoped message');
  assert.equal(selection.command, undefined); assert.equal(selection.instruction, undefined);
  message(parent, binding.nonce, false); assert(!attrs.has('data-district-preview-target'));
  click(); assert.equal(emitted.length, 1);
  message(parent, binding.nonce, true, 'https://changed-parent.example'); click(); assert.equal(emitted.length, 1);
});
