'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../app/district-feedback.js'), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture(onRequestChange = () => ({ status: 'accepted', runId: 'requested-run' })) {
  const timers = new Map(), nodes = [], posts = [];
  let timerId = 0;
  const eventTarget = () => {
    const listeners = new Map();
    return { listeners,
      addEventListener(type, listener) { const group = listeners.get(type) || new Set(); group.add(listener); listeners.set(type, group); },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      emit(type, extra = {}) {
        const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
        for (const listener of [...(listeners.get(type) || [])]) listener(event);
        return event;
      },
    };
  };
  const document = { createElement(tag) {
    const node = Object.assign(eventTarget(), { tagName: tag.toUpperCase(), children: [], attributes: {}, dataset: {},
      value: '', textContent: '', disabled: false, hidden: false, parentNode: null, srcAssignments: 0,
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      append(...children) { for (const child of children) this.appendChild(child); },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      removeAttribute(key) { delete this.attributes[key]; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; },
      click() { if (!this.disabled) this.emit('click'); },
    });
    if (tag === 'iframe') {
      node.contentWindow = { postMessage(data, origin) { posts.push({ data: JSON.parse(JSON.stringify(data)), origin }); } };
      Object.defineProperty(node, 'src', { get() { return this.attributes.src || ''; },
        set(value) { this.attributes.src = value; this.srcAssignments++; } });
    }
    nodes.push(node); return node;
  } };
  const window = eventTarget(), container = document.createElement('main'), requests = [];
  class FixedDate extends Date { static now() { return 1800000000000; } }
  vm.runInNewContext(source, { window, document, URL, Date: FixedDate,
    setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const feedback = new window.DistrictFeedback({ container, onRequestChange(request) { requests.push(request); return onRequestChange(request); } });
  const preview = { id: 'preview-owned', projectId: 'project-owned', runId: 'run-built', candidateHash: 'a'.repeat(64),
    nonce: 'nonce-owned', url: 'http://127.0.0.1:41789/owned/index.html' };
  function load(binding = preview) {
    feedback.update({ preview: binding }); feedback.iframe.emit('load');
    return posts.filter((post) => post.data.type === 'district:verify').at(-1)?.data.requestId;
  }
  function identity(binding = preview, requestId = feedback.verificationId) {
    return { type: 'district:identity', nonce: binding.nonce, previewId: binding.id,
      projectId: binding.projectId, runId: binding.runId, candidateHash: binding.candidateHash, requestId };
  }
  function message(data, extras = {}) {
    window.emit('message', { source: feedback.iframe.contentWindow, origin: new URL(preview.url).origin, data, ...extras });
  }
  function instruction(value = 'Make the heading easier to read.') { feedback.input.value = value; feedback.input.emit('input'); }
  function submit() { feedback.form.emit('submit'); }
  function selection(binding = preview) {
    return { type: 'district:selection', nonce: binding.nonce, projectId: binding.projectId,
      runId: binding.runId, candidateHash: binding.candidateHash, selector: 'main > h1', tag: 'h1', text: 'Actual heading',
      rect: { x: 20, y: 40, width: 200, height: 32 } };
  }
  return { feedback, preview, posts, requests, timers, nodes, container, window, load, identity, message, instruction, submit, selection };
}

test('iframe load cannot authorize a request; the current exact identity enables only explicit submission', async () => {
  const f = fixture();
  try {
    f.feedback.update({ preview: f.preview }); f.instruction(); f.submit(); await tick();
    assert.equal(f.feedback.submit.disabled, true); assert.equal(f.requests.length, 0);
    const requestId = f.load();
    assert.equal(f.feedback.frameReady, false); assert.equal(f.feedback.inspect.disabled, true);
    assert.equal(f.feedback.submit.disabled, true); assert.equal(f.timers.size, 1);
    assert.deepEqual(f.posts.at(-1), { data: { type: 'district:verify', nonce: f.preview.nonce, requestId }, origin: 'http://127.0.0.1:41789' });
    f.message(f.identity()); await tick();
    assert.equal(f.feedback.frameReady, true); assert.equal(f.feedback.submit.disabled, false);
    assert.equal(f.timers.size, 0); assert.equal(f.requests.length, 0, 'attestation is presentation, not dispatch');
    f.submit(); await tick(); assert.equal(f.requests.length, 1); assert.equal(f.requests[0].selection, null);
    assert.equal(f.requests[0].instruction, 'Make the heading easier to read.');
  } finally { f.feedback.destroy(); }
});

test('every identity fence independently rejects a bad reply and permits its matching control', async () => {
  const cases = [
    ['source', (data) => data, { source: {} }],
    ['origin', (data) => data, { origin: 'http://127.0.0.1:41790' }],
    ...['nonce', 'previewId', 'projectId', 'runId', 'candidateHash', 'requestId'].flatMap((key) => [
      [`wrong ${key}`, (data) => ({ ...data, [key]: `wrong-${key}` })],
      [`missing ${key}`, (data) => { const copy = { ...data }; delete copy[key]; return copy; }],
    ]),
  ];
  for (const [name, corrupt, eventPatch] of cases) {
    const f = fixture();
    try {
      f.load(); f.instruction(); f.message(corrupt(f.identity()), eventPatch); f.submit(); await tick();
      assert.equal(f.feedback.frameReady, false, name); assert.equal(f.feedback.submit.disabled, true, name);
      assert.equal(f.requests.length, 0, name);
      f.message(f.identity()); assert.equal(f.feedback.submit.disabled, false, `${name}: valid control must be usable`);
    } finally { f.feedback.destroy(); }
  }
});

test('reload invalidates the old attestation even when wall-clock time and binding are unchanged', async () => {
  const f = fixture();
  try {
    const first = f.load(); f.instruction(); f.message(f.identity());
    f.feedback.inspect.click(); f.message(f.selection()); assert(f.feedback.selection);
    f.feedback.reload.click(); assert.equal(f.feedback.frameReady, false); assert.equal(f.feedback.selection, null);
    f.message(f.identity(f.preview, first)); f.submit(); await tick(); assert.equal(f.requests.length, 0);
    f.feedback.iframe.emit('load'); const second = f.feedback.verificationId;
    assert.notEqual(second, first, 'per-load sequence must fence reloads even at identical Date.now()');
    f.message(f.identity(f.preview, first)); assert.equal(f.feedback.frameReady, false);
    f.message(f.selection()); assert.equal(f.feedback.selection, null);
    f.message(f.identity(f.preview, second)); assert.equal(f.feedback.frameReady, true);
    assert.equal(f.feedback.input.value, 'Make the heading easier to read.');
    assert.equal(f.requests.length, 0);
  } finally { f.feedback.destroy(); }
});

test('polling the same preview preserves its frame; a new candidate rejects the previous load request', () => {
  const f = fixture();
  try {
    const oldRequest = f.load(), assignments = f.feedback.iframe.srcAssignments;
    f.feedback.update({ preview: { ...f.preview } });
    assert.equal(f.feedback.iframe.srcAssignments, assignments);
    assert.equal(f.feedback.verificationId, oldRequest);
    const replacement = { ...f.preview, id: 'preview-new', runId: 'run-new', nonce: 'nonce-new', candidateHash: 'b'.repeat(64),
      url: 'http://127.0.0.1:41789/new/index.html' };
    f.feedback.update({ preview: replacement });
    f.message(f.identity(f.preview, oldRequest)); assert.equal(f.feedback.frameReady, false);
    f.feedback.iframe.emit('load');
    f.message(f.identity(f.preview, oldRequest)); assert.equal(f.feedback.frameReady, false);
    f.message(f.identity(replacement)); assert.equal(f.feedback.frameReady, true);
  } finally { f.feedback.destroy(); }
});

test('stale output cannot select or submit even if its loaded bytes attest successfully', async () => {
  const f = fixture();
  try {
    f.load(); f.instruction(); f.message(f.identity()); f.feedback.inspect.click();
    f.feedback.update({ preview: f.preview, stale: true });
    f.message(f.identity()); f.message(f.selection()); f.submit(); await tick();
    assert.equal(f.feedback.inspect.disabled, true); assert.equal(f.feedback.submit.disabled, true);
    assert.equal(f.feedback.selection, null); assert.equal(f.requests.length, 0);
    assert.match(f.feedback.reason.textContent, /older than the current project/);
    f.feedback.update({ preview: f.preview, stale: false }); assert.equal(f.feedback.submit.disabled, false);
  } finally { f.feedback.destroy(); }
});

test('selection needs an explicit user toggle, valid context and a separate request; duplicate submit is bounded', async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; }));
  try {
    f.load(); f.message(f.identity()); f.instruction('Make this heading clearer.');
    f.message(f.selection()); assert.equal(f.feedback.selection, null);
    f.feedback.inspect.click(); assert.equal(f.posts.at(-1).data.enabled, true);
    f.message({ ...f.selection(), runId: 'wrong-run' });
    f.message({ ...f.selection(), rect: { x: 0, y: 0, width: -1, height: 4 } });
    assert.equal(f.feedback.selection, null); assert.equal(f.feedback.inspectEnabled, true);
    f.message(f.selection()); assert.equal(f.feedback.selection.selector, 'main > h1');
    assert.equal(f.feedback.inspectEnabled, false); assert.equal(f.requests.length, 0);
    f.submit(); f.submit(); await tick(); assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].instruction, 'Make this heading clearer.');
    assert.equal(f.requests[0].selection.candidateHash, f.preview.candidateHash);
    assert.equal(f.requests[0].selection.runId, f.preview.runId);
    assert.equal(f.requests[0].selection.selector, 'main > h1');
    finish({ status: 'accepted', runId: 'change-run' }); await tick();
    assert.match(f.feedback.requestStatus.textContent, /accepted as run change-run/);
  } finally { f.feedback.destroy(); }
});

test('unverified timeout leaves requests blocked and replacement loading clears the old timer', async () => {
  const f = fixture();
  try {
    const oldRequest = f.load(); f.instruction(); const expiredId = [...f.timers.keys()][0], expired = f.timers.get(expiredId);
    assert.equal(expired.ms, 5000); f.timers.delete(expiredId); expired.callback();
    assert.equal(f.feedback.frameFailed, true); f.submit(); await tick(); assert.equal(f.requests.length, 0);
    assert.match(f.feedback.requestStatus.textContent, /could not be verified/);
    f.message(f.identity(f.preview, oldRequest));
    assert.equal(f.feedback.frameReady, false, 'an expired verification request must not recover without a new load');
    assert.equal(f.feedback.submit.disabled, true);
    f.feedback.reload.click(); assert.equal(f.timers.size, 0);
    f.feedback.iframe.emit('load'); assert.equal(f.timers.size, 1);
    f.message(f.identity(f.preview, oldRequest)); assert.equal(f.feedback.frameReady, false);
    f.message(f.identity()); assert.equal(f.feedback.frameReady, true, 'new-load positive control recovers');
  } finally { f.feedback.destroy(); }
});

test('a frame error revokes the current attestation request and needs a new loaded-frame reply', async () => {
  const f = fixture();
  try {
    const first = f.load(); f.instruction();
    f.feedback.iframe.emit('error');
    assert.equal(f.timers.size, 0); assert.equal(f.feedback.frameFailed, true);
    f.message(f.identity(f.preview, first)); f.submit(); await tick();
    assert.equal(f.feedback.frameReady, false); assert.equal(f.requests.length, 0);
    f.feedback.reload.click(); f.feedback.iframe.emit('load');
    f.message(f.identity()); assert.equal(f.feedback.frameReady, true);
  } finally { f.feedback.destroy(); }
});

test('destroy removes verification timers and listeners, ignores late replies and never dispatches', async () => {
  const f = fixture(); f.load(); f.instruction();
  const reply = f.identity(), lateTimer = [...f.timers.values()][0].callback;
  f.feedback.destroy();
  assert.equal(f.timers.size, 0); assert.equal(f.window.listeners.get('message').size, 0);
  assert.equal(f.feedback.iframe.listeners.get('load').size, 0);
  assert.equal(f.feedback.form.listeners.get('submit').size, 0);
  assert.equal(f.container.children.length, 0);
  f.message(reply); f.feedback.iframe.emit('load'); f.submit(); lateTimer(); await tick();
  assert.equal(f.requests.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.feedback.binding, null);
});

test('remote or credential-bearing preview URLs never load or dispatch', async () => {
  for (const url of ['https://example.invalid/index.html', 'http://localhost:41789/index.html',
    'http://127.0.0.1/index.html', 'http://owner:secret@127.0.0.1:41789/index.html']) {
    const f = fixture();
    try {
      f.feedback.update({ preview: { ...f.preview, url } }); f.instruction(); f.feedback.iframe.emit('load'); f.submit(); await tick();
      assert.equal(f.feedback.binding, null, url); assert.equal(f.feedback.iframe.srcAssignments, 0, url);
      assert.equal(f.requests.length, 0, url); assert.equal(f.timers.size, 0, url);
    } finally { f.feedback.destroy(); }
  }
});

test('a missing or invalid preview ID cannot become a bindable identity even with a matching reply', async () => {
  for (const id of [undefined, '', 42, 'bad\nidentity', 'x'.repeat(513)]) {
    const f = fixture();
    try {
      const invalid = { ...f.preview, id };
      f.feedback.update({ preview: invalid }); f.instruction(); f.feedback.iframe.emit('load');
      f.message(f.identity(invalid)); f.submit(); await tick();
      assert.equal(f.feedback.binding, null, `preview ID ${String(id).slice(0, 20)}`);
      assert.equal(f.feedback.iframe.srcAssignments, 0);
      assert.equal(f.feedback.frameReady, false); assert.equal(f.requests.length, 0);
      f.load(); f.message(f.identity()); assert.equal(f.feedback.frameReady, true, 'valid preview control remains usable');
    } finally { f.feedback.destroy(); }
  }
});
