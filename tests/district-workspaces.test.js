'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { Workspaces, ProjectFiles, LIMITS, ALLOWED_EXTENSIONS } = require('../app/district/workspaces');

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-workspaces-test-'));
  const projectsRoot = path.join(temp, 'projects');
  const records = new Map();
  const store = {
    get: (kind, id) => records.has(`${kind}:${id}`) ? structuredClone(records.get(`${kind}:${id}`)) : null,
    put: (kind, record) => { records.set(`${kind}:${record.id}`, structuredClone(record)); return structuredClone(record); },
    list: (kind) => [...records.entries()].filter(([key]) => key.startsWith(`${kind}:`)).map(([, record]) => structuredClone(record))
  };
  const workspaces = new Workspaces({ root: projectsRoot, store });
  t.after(() => {
    // This exact fresh fixture root is the only recursively removed directory.
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
    assert.match(path.basename(temp), /^agent-bus-workspaces-test-/);
    fs.rmSync(temp, { recursive: true, force: true });
  });
  return { temp, projectsRoot, store, records, workspaces };
}

test('creates separate owned roots and restores project records across instances', (t) => {
  const { workspaces, projectsRoot, store } = fixture(t);
  const first = workspaces.create({ name: '  My project  ' });
  const second = workspaces.create({ name: 'My project' });
  assert.equal(first.name, 'My project');
  assert.equal(first.template, 'checklist');
  assert.equal(path.dirname(first.root), projectsRoot);
  assert.notEqual(first.root, second.root);
  assert.equal(first.id, path.basename(first.root));
  assert.deepEqual(workspaces.files(first.id), ['index.html', 'script.js', 'styles.css']);
  const reopened = new Workspaces({ root: projectsRoot, store });
  assert.deepEqual(reopened.get(first.id), first);
  assert.equal(reopened.list().length, 2);
  assert.equal(reopened.get('missing'), null);
  assert.throws(() => reopened.read('missing', 'index.html'), /unknown project/);
});

test('starter renders two additions, literal text, completion and removal through its real script', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Checklist' });
  const html = workspaces.read(project.id, 'index.html');
  for (const selector of ['task-input', 'add-task', 'task-list']) assert.match(html, new RegExp(`data-testid="${selector}"`));
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="script\.js"/);
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.value = ''; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(event, callback) { this.events[event] = callback; }
    focus() { this.focused = true; }
    emit(event) { return this.events[event]({ preventDefault() {} }); }
  }
  const nodes = Object.fromEntries(['task-form', 'task-input', 'task-list', 'task-status', 'empty-state'].map((id) => [id, new Element()]));
  const document = { getElementById: (id) => nodes[id], createElement: (tag) => new Element(tag) };
  vm.runInNewContext(workspaces.read(project.id, 'script.js'), { document }, { timeout: 1000 });
  const add = (text) => { nodes['task-input'].value = text; nodes['task-form'].emit('submit'); };
  add('Buy milk');
  add('<img src=x onerror=alert(1)>');
  const list = nodes['task-list'];
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].children[0].children[1].textContent, 'Buy milk');
  assert.equal(list.children[1].children[0].children[1].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(nodes['empty-state'].hidden, true);
  assert.equal(nodes['task-status'].textContent, '2 tasks left to do.');
  const checkbox = list.children[0].children[0].children[0];
  checkbox.checked = true;
  checkbox.emit('change');
  assert.match(list.children[0].className, /is-complete/);
  assert.equal(nodes['task-status'].textContent, '1 task left to do.');
  list.children[1].children[1].emit('click');
  assert.equal(list.children.length, 1);
  assert.equal(nodes['task-status'].textContent, 'All done. Enjoy the moment.');
  list.children[0].children[1].emit('click');
  add('   ');
  assert.equal(list.children.length, 0);
  assert.equal(nodes['empty-state'].hidden, false);
  assert.equal(nodes['task-input'].focused, true);
});

test('writes bounded UTF-8 bytes and hashes actual public source without internal artifacts', (t) => {
  const { workspaces, store } = fixture(t);
  const project = workspaces.create({ name: 'Files' });
  const content = 'A new task: café ☕\n';
  const result = workspaces.write(project.id, 'notes/today.md', content);
  assert.deepEqual(result, { path: 'notes/today.md', bytes: Buffer.byteLength(content), hash: digest(content) });
  assert.equal(workspaces.read(project.id, 'notes/today.md'), content);
  assert.equal(workspaces.resolve(project.id, 'notes/today.md'), path.join(project.root, 'notes', 'today.md'));
  const internal = path.join(project.root, '.agent-bus', 'artifact.json');
  fs.writeFileSync(internal, 'private');
  const manifest = workspaces.manifest(project.id);
  const expected = Object.fromEntries(workspaces.files(project.id).map((file) => [file, digest(fs.readFileSync(workspaces.resolve(project.id, file)))]));
  assert.deepEqual(manifest.files, expected);
  assert.equal(manifest.hash, digest(JSON.stringify(expected)));
  assert.equal(typeof manifest.at, 'number');
  assert(!JSON.stringify(manifest).includes('.agent-bus'));
  assert(store.get('project', project.id).updated >= project.updated);
  const rootFiles = new ProjectFiles({ root: project.root });
  assert.equal(rootFiles.read('notes/today.md'), content);
  assert.equal(rootFiles.manifest().hash, manifest.hash);
});

test('source edits change the manifest; failed writes preserve original bytes', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Integrity' });
  const before = workspaces.manifest(project.id);
  const original = workspaces.read(project.id, 'script.js');
  assert.throws(() => workspaces.write(project.id, 'script.js', 'x'.repeat(LIMITS.maxFileBytes + 1)), /size limit/);
  assert.equal(workspaces.read(project.id, 'script.js'), original);
  assert.equal(workspaces.manifest(project.id).hash, before.hash);
  workspaces.write(project.id, 'script.js', original + '\n// Actual new source.\n');
  const after = workspaces.manifest(project.id);
  assert.notEqual(after.hash, before.hash);
  assert.notEqual(after.files['script.js'], before.files['script.js']);
  assert.equal(after.files['index.html'], before.files['index.html']);
});

test('all public path operations reject traversal, absolute, ADS, reserved and internal paths', (t) => {
  const { workspaces, temp } = fixture(t);
  const project = workspaces.create({ name: 'Paths' });
  const outside = path.join(temp, 'outside.txt');
  fs.writeFileSync(outside, 'untouched');
  const attempts = ['../outside.txt', 'nested/../../outside.txt', '..\\outside.txt', 'nested\\..\\outside.txt', '/outside.txt', 'C:/outside.txt', '//server/share/outside.txt', 'index.html:payload', '.agent-bus/workspace.json', '.AGENT-BUS/workspace.json', '.git/config.txt', 'nested/.git/thing.txt', 'CON.txt', 'aux.md', 'COM1.js', 'LPT².txt', 'file.txt.', 'file .txt ', 'thing.exe', 'nested//file.txt', './file.txt', 'bad\u0000.txt'];
  for (const relative of attempts) {
    assert.throws(() => workspaces.resolve(project.id, relative), undefined, relative);
    assert.throws(() => workspaces.read(project.id, relative), undefined, relative);
    assert.throws(() => workspaces.write(project.id, relative, 'replace'), undefined, relative);
  }
  assert.equal(fs.readFileSync(outside, 'utf8'), 'untouched');
});

test('constructor and stored records never fall back to cwd or an external folder', (t) => {
  const { workspaces, store, temp } = fixture(t);
  assert.throws(() => new Workspaces({ store }), /explicit absolute root/);
  assert.throws(() => new Workspaces({ root: '.', store }), /explicit absolute root/);
  assert.throws(() => new Workspaces({ root: path.parse(temp).root, store }), /filesystem root/);
  const project = workspaces.create({ name: 'Boundary' });
  const external = path.join(temp, 'existing-user-project');
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'notes.txt'), 'unfinished work');
  store.put('project', { ...project, root: external });
  assert.throws(() => workspaces.get(project.id), /outside the generated parent/);
  assert.throws(() => workspaces.files(project.id), /outside the generated parent/);
  assert.throws(() => workspaces.write(project.id, 'notes.txt', 'lost'), /outside the generated parent/);
  assert.equal(fs.readFileSync(path.join(external, 'notes.txt'), 'utf8'), 'unfinished work');
});

test('ownership records and project-root replacement are rechecked for every operation', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Ownership' });
  const files = new ProjectFiles({ root: project.root });
  const markerPath = path.join(project.root, '.agent-bus', 'workspace.json');
  const original = fs.readFileSync(markerPath);
  const altered = JSON.parse(original);
  altered.id = 'someone-else';
  fs.writeFileSync(markerPath, JSON.stringify(altered));
  for (const operation of [() => workspaces.get(project.id), () => files.files(), () => files.read('index.html'), () => files.write('notes.txt', 'no'), () => files.manifest()]) assert.throws(operation, /ownership record/);
  fs.writeFileSync(markerPath, original);
  assert.equal(files.files().length, 3);
  fs.writeFileSync(markerPath, 'x'.repeat(4097));
  assert.throws(() => files.files(), /ownership record/);
});

test('nested junctions and generated-root junction replacement cannot escape', (t) => {
  const { workspaces, temp } = fixture(t);
  const project = workspaces.create({ name: 'Junctions' });
  const files = new ProjectFiles({ root: project.root });
  const outside = path.join(temp, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'keep');
  fs.symlinkSync(outside, path.join(project.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const operation of [() => files.files(), () => files.resolve('linked/secret.txt'), () => files.read('linked/secret.txt'), () => files.write('linked/secret.txt', 'lost'), () => files.manifest()]) assert.throws(operation, /symlink|junction|unsafe/i);
  assert.equal(fs.readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'keep');
  fs.unlinkSync(path.join(project.root, 'linked'));
  const moved = project.root + '-retained';
  fs.renameSync(project.root, moved);
  fs.symlinkSync(outside, project.root, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => workspaces.get(project.id), /unsafe/);
  assert.throws(() => files.resolve('secret.txt'), /unsafe/);
  assert.throws(() => files.write('secret.txt', 'lost'), /unsafe/);
  assert.equal(fs.readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'keep');
});

test('hardlinked public files are rejected before read, manifest or replacement', (t) => {
  const { workspaces, temp } = fixture(t);
  const project = workspaces.create({ name: 'Hardlinks' });
  const external = path.join(temp, 'external.txt');
  fs.writeFileSync(external, 'unfinished');
  fs.linkSync(external, path.join(project.root, 'linked.txt'));
  for (const operation of [() => workspaces.files(project.id), () => workspaces.read(project.id, 'linked.txt'), () => workspaces.write(project.id, 'linked.txt', 'overwritten'), () => workspaces.manifest(project.id)]) assert.throws(operation, /links are not allowed/);
  assert.equal(fs.readFileSync(external, 'utf8'), 'unfinished');
});

test('public file count limit rejects a new file but permits a bounded replacement', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Count' });
  for (let n = 0; n < LIMITS.maxFiles - 3; n++) workspaces.write(project.id, `note-${n}.txt`, String(n));
  assert.equal(workspaces.files(project.id).length, LIMITS.maxFiles);
  assert.throws(() => workspaces.write(project.id, 'one-too-many.txt', 'no'), /file count or total size/);
  assert(!fs.existsSync(path.join(project.root, 'one-too-many.txt')));
  workspaces.write(project.id, 'note-0.txt', 'changed');
  assert.equal(workspaces.read(project.id, 'note-0.txt'), 'changed');
});

test('aggregate byte limit accounts for UTF-8 and replacement size', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Bytes' });
  const initialBytes = Object.keys(workspaces.manifest(project.id).files).reduce((sum, name) => sum + fs.statSync(workspaces.resolve(project.id, name)).size, 0);
  const megabyte = 'x'.repeat(LIMITS.maxFileBytes);
  for (let n = 0; n < 3; n++) workspaces.write(project.id, `large-${n}.txt`, megabyte);
  const remaining = LIMITS.maxTotalBytes - initialBytes - 3 * LIMITS.maxFileBytes;
  workspaces.write(project.id, 'last.txt', 'a'.repeat(remaining));
  assert.throws(() => workspaces.write(project.id, 'extra.txt', 'é'), /file count or total size/);
  assert.throws(() => workspaces.write(project.id, 'last.txt', 'a'.repeat(remaining) + 'a'), /file count or total size/);
  workspaces.write(project.id, 'last.txt', 'shorter');
  workspaces.write(project.id, 'extra.txt', 'é');
  assert.equal(workspaces.read(project.id, 'extra.txt'), 'é');
  assert.throws(() => workspaces.write(project.id, 'wide.txt', 'é'.repeat(LIMITS.maxFileBytes)), /size limit/);
});

test('externally introduced unsupported, oversized or excess public files fail closed', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'External mutations' });
  const bad = path.join(project.root, 'payload.exe');
  fs.writeFileSync(bad, 'not public');
  assert.throws(() => workspaces.files(project.id), /unsupported file type/);
  assert.throws(() => workspaces.write(project.id, 'allowed.txt', 'no'), /unsupported file type/);
  fs.unlinkSync(bad);
  const big = path.join(project.root, 'big.txt');
  fs.writeFileSync(big, Buffer.alloc(LIMITS.maxFileBytes + 1));
  assert.throws(() => workspaces.read(project.id, 'index.html'), /size limit/);
  assert.throws(() => workspaces.manifest(project.id), /size limit/);
  fs.unlinkSync(big);
  for (let n = 0; n < LIMITS.maxFiles; n++) fs.writeFileSync(path.join(project.root, `n${n}.txt`), 'x');
  assert.throws(() => workspaces.files(project.id), /file count or total size/);
});

test('invalid UTF-8 is rejected as text and non-text write inputs do not create files', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Text' });
  fs.writeFileSync(path.join(project.root, 'invalid.txt'), Buffer.from([0xc3, 0x28]));
  assert.throws(() => workspaces.read(project.id, 'invalid.txt'), /UTF-8/);
  assert.throws(() => workspaces.write(project.id, 'buffer.txt', Buffer.from('no')), /content must be UTF-8 text/);
  assert(!fs.existsSync(path.join(project.root, 'buffer.txt')));
});

test('project parent symlinks and invalid names are rejected without changing user files', (t) => {
  const { workspaces, store, temp } = fixture(t);
  for (const name of ['', '   ', 'x'.repeat(81), 'bad\nname']) assert.throws(() => workspaces.create({ name }), /project name/);
  const external = path.join(temp, 'external-parent');
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'keep.txt'), 'saved');
  const linked = path.join(temp, 'linked-parent');
  fs.symlinkSync(external, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => new Workspaces({ root: linked, store }), /unsafe/);
  assert.equal(fs.readFileSync(path.join(external, 'keep.txt'), 'utf8'), 'saved');
  assert.deepEqual(workspaces.list(), []);
});

test('inspection exports cannot weaken the public file policy', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Immutable policy' });
  ALLOWED_EXTENSIONS.add('.exe');
  try { assert.throws(() => workspaces.write(project.id, 'payload.exe', 'no'), /unsupported file type/); }
  finally { ALLOWED_EXTENSIONS.delete('.exe'); }
  assert(Object.isFrozen(LIMITS));
});

test('Neon Rally starter copies the actual showcase source bytes and keeps immutable identity', (t) => {
  const { workspaces, store } = fixture(t);
  const project = workspaces.create('Neon Rally', { starterId: 'neon-rally' });
  assert.equal(project.starterId, 'neon-rally');
  assert.equal(project.template, 'neon-rally');
  const html = workspaces.read(project.id, 'index.html');
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<title>Neon Rally<\/title>/);
  assert.match(html, /data-neon-rally-app/);
  assert.match(html, /script-src 'self'; style-src 'self'/);
  assert(!/task-input|add-task|task-list/.test(html));
  assert(fs.readFileSync(workspaces.resolve(project.id, 'script.js')).equals(fs.readFileSync(path.join(__dirname, '..', 'app', 'district-attract-demo.js'))));
  assert(fs.readFileSync(workspaces.resolve(project.id, 'styles.css')).equals(fs.readFileSync(path.join(__dirname, '..', 'app', 'district-attract-demo.css'))));
  assert.equal(workspaces.files(project.id).length, 3);
  store.put('project', { ...project, starterId: 'checklist' });
  assert.throws(() => workspaces.get(project.id), /starter identity changed/);
  assert.throws(() => workspaces.create({ name: 'Invalid', starterId: 'unknown' }), /unknown starter/);
  assert.equal(workspaces.create({ name: 'Default' }).starterId, 'checklist');
  assert.equal(workspaces.create({ name: 'Object option', starterId: 'neon-rally' }).starterId, 'neon-rally');
});

function rallyHarness(source, { standalone = false, reduced = false } = {}) {
  let now = 0, next = 1;
  const timers = new Map();
  class Event { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } }
  class Element {
    constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = new Map(); this.clicks = 0; }
    append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(event) { for (const fn of this.listeners.get(event.type) || []) fn(event); if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event); return true; }
    click() { this.clicks++; this.dispatchEvent(new Event('click', { bubbles: true })); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; }
    querySelector(selector) { if (selector === '.district-attract-demo') return this.children.find((node) => node.className === 'district-attract-demo') || null; return null; }
  }
  const document = { readyState: 'complete', createElement: (tag) => new Element(tag, document), querySelector: () => standalone ? container : null };
  const container = new Element('main', document);
  const window = { matchMedia: () => ({ matches: reduced }) };
  vm.runInNewContext(source, { document, window, Event, setTimeout(fn, delay) { const id = next++; timers.set(id, { at: now + delay, fn }); return id; }, clearTimeout(id) { timers.delete(id); } }, { timeout: 1000 });
  const api = standalone ? null : window.DistrictAttractDemo.mount({ container });
  const find = (id, node = container) => node.dataset.testid === id ? node : node.children.map((child) => find(id, child)).find(Boolean);
  const text = (node = container) => [node.textContent || '', ...node.children.map((child) => text(child))].join(' ');
  const advance = (milliseconds) => {
    const end = now + milliseconds;
    while (true) {
      const pair = [...timers.entries()].sort((a, b) => a[1].at - b[1].at).find(([, value]) => value.at <= end);
      if (!pair) break;
      const [id, job] = pair; now = job.at; timers.delete(id); job.fn();
    }
    now = end;
  };
  return { api, container, timers, find, advance, Event, text };
}

test('owned Rally auto-mounts the same interactive app without demo label or autoplay', (t) => {
  const { workspaces } = fixture(t);
  const project = workspaces.create({ name: 'Play now', starterId: 'neon-rally' });
  const h = rallyHarness(workspaces.read(project.id, 'script.js'), { standalone: true });
  for (const hook of ['neon-add-comets', 'neon-add-bolts', 'neon-score-comets', 'neon-score-bolts', 'neon-theme', 'neon-reset', 'neon-status']) assert(h.find(hook), hook);
  assert(!h.text().includes('DEMO'));
  assert.equal(h.timers.size, 0);
  h.advance(10000);
  assert.equal(h.find('neon-score-comets').textContent, '00');
  h.find('neon-add-comets').click(); h.find('neon-add-comets').click(); h.find('neon-add-bolts').click();
  assert.equal(h.find('neon-score-comets').textContent, '02');
  assert.equal(h.find('neon-score-bolts').textContent, '01');
  const theme = h.find('neon-theme'); theme.value = 'sunset'; theme.dispatchEvent(new h.Event('change'));
  assert.equal(h.container.children[0].dataset.theme, 'sunset');
  h.find('neon-reset').click();
  assert.equal(h.find('neon-score-comets').textContent, '00');
  assert.equal(h.find('neon-score-bolts').textContent, '00');
  assert.equal(h.container.children[0].dataset.theme, 'electric');
});

test('Rally showcase uses actual controls, yields to people, stops timers and keeps reduced-motion values identical', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'district-attract-demo.js'), 'utf8');
  const h = rallyHarness(source);
  assert(h.text().includes('DEMO'));
  h.api.play(); h.advance(1000); h.find('neon-add-bolts').click();
  assert.equal(h.timers.size, 0);
  const stopped = [h.find('neon-score-comets').textContent, h.find('neon-score-bolts').textContent];
  h.advance(9000);
  assert.deepEqual([h.find('neon-score-comets').textContent, h.find('neon-score-bolts').textContent], stopped);
  h.api.reset(); h.api.play(); h.advance(8000);
  assert.equal(h.find('neon-score-comets').textContent, '06');
  assert.equal(h.find('neon-score-bolts').textContent, '04');
  assert.equal(h.container.children[0].dataset.theme, 'lagoon');
  assert.equal(h.find('neon-add-comets').clicks, 7, 'includes six actual showcase button clicks');
  assert.equal(h.timers.size, 0);
  h.api.play(); assert.equal(h.timers.size, 0, 'showcase runs once until reset');
  h.api.reset(); h.api.play(); h.advance(600); h.api.pause();
  assert.equal(h.timers.size, 0); h.advance(9000); assert.equal(h.find('neon-score-comets').textContent, '01');
  h.api.reset(); h.api.play(); h.api.destroy(); h.api.destroy();
  assert.equal(h.timers.size, 0); assert.equal(h.container.children.length, 0);
  for (const reduced of [false, true]) {
    const motion = rallyHarness(source, { reduced }); motion.api.play(); motion.advance(8000);
    assert.equal(motion.find('neon-score-comets').textContent, '06'); assert.equal(motion.find('neon-score-bolts').textContent, '04');
    assert.equal(motion.container.children[0].dataset.theme, 'lagoon'); motion.api.destroy();
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'district-attract-demo.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /transition: none !important/);
  assert.match(css, /animation: none !important/);
});

test('real Electron layout fits Rally controls in embedded and short owned previews', (t) => {
  const { spawnSync } = require('node:child_process');
  const { pathToFileURL } = require('node:url');
  const electron = require('electron');
  const { workspaces, temp } = fixture(t);
  const project = workspaces.create({ name: 'Browser geometry', starterId: 'neon-rally' });
  const asset = (name) => pathToFileURL(path.resolve(__dirname, '..', 'app', name)).href;
  const fixtureFile = path.join(temp, 'embed.html');
  const mainFile = path.join(temp, 'geometry.cjs');
  fs.writeFileSync(fixtureFile, '<!doctype html><html><head><link rel="stylesheet" href="' + asset('styles.css') + '"><link rel="stylesheet" href="' + asset('district-attract-demo.css') + '"><script src="' + asset('district-attract-demo.js') + '" defer></script><style>body{display:block;margin:0;overflow:auto}#fixture{width:580px;height:430px;display:grid;place-items:center}</style></head><body><div id="fixture"></div></body></html>');
  fs.writeFileSync(mainFile, `
    const { app, BrowserWindow } = require('electron');
    const assert = require('node:assert/strict');
    app.setPath('userData', process.env.NEON_TEST_PROFILE);
    app.whenReady().then(async () => {
      const win = new BrowserWindow({ width: 1428, height: 900, show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
      const results = [];
      async function inspect(label) {
        const result = await win.webContents.executeJavaScript(\`(() => {
          const host = document.getElementById('fixture') || document.querySelector('[data-neon-rally-app]');
          const app = document.querySelector('.district-attract-demo');
          const rect = (node) => { const r = node.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
          return { host:rect(host), app:rect(app), headerBackground:getComputedStyle(app.querySelector('.nr-top')).backgroundColor, headerBorder:getComputedStyle(app.querySelector('.nr-top')).borderBottomWidth, scoreFont:getComputedStyle(app.querySelector('.nr-score')).fontSize, controls:[...app.querySelectorAll('button,select')].map(node => ({ id:node.dataset.testid, ...rect(node) })), scrollHeight:document.documentElement.scrollHeight, viewportHeight:innerHeight };
        })()\`);
        assert.equal(result.controls.length, 4, label + ' controls');
        for (const control of result.controls) {
          assert(control.x >= result.host.x - 1 && control.right <= result.host.right + 1, label + ' horizontal ' + control.id);
          assert(control.y >= result.host.y - 1 && control.bottom <= result.host.bottom + 1, label + ' vertical ' + control.id);
          assert(control.height >= 34, label + ' readable target ' + control.id);
        }
        assert(result.app.height <= 430, label + ' console height');
        assert(parseFloat(result.scoreFont) >= 58, label + ' readable scores');
        assert.equal(result.headerBackground, 'rgba(0, 0, 0, 0)', label + ' header background');
        assert.equal(result.headerBorder, '0px', label + ' header border');
        results.push({ label, ...result });
      }
      await win.loadFile(process.env.NEON_TEST_FIXTURE);
      await win.webContents.executeJavaScript("DistrictAttractDemo.mount({container:document.getElementById('fixture')});true");
      await inspect('embedded580x430-global1428');
      await win.webContents.executeJavaScript("document.getElementById('fixture').style.width='1000px';true");
      await inspect('embedded1000x430-global1428');
      win.setContentSize(1000, 430);
      await win.loadFile(process.env.NEON_TEST_PROJECT);
      await inspect('owned1000x430');
      assert(results.at(-1).scrollHeight <= results.at(-1).viewportHeight, 'owned preview does not require scrolling');
      console.log('NEON_GEOMETRY ' + JSON.stringify(results));
      win.destroy(); app.exit(0);
    }).catch(error => { console.error(error.stack); app.exit(1); });
  `);
  const env = { ...process.env, NEON_TEST_PROFILE: path.join(temp, 'browser-profile'), NEON_TEST_FIXTURE: fixtureFile, NEON_TEST_PROJECT: path.join(project.root, 'index.html') };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(electron, [mainFile], { env, encoding: 'utf8', windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const line = child.stdout.split(/\r?\n/).find((entry) => entry.startsWith('NEON_GEOMETRY '));
  assert(line, child.stdout);
  const measurements = JSON.parse(line.slice('NEON_GEOMETRY '.length));
  assert.equal(measurements.length, 3);
  assert.equal(measurements[0].host.width, 580);
  assert.equal(measurements[2].viewportHeight, 430);
});
