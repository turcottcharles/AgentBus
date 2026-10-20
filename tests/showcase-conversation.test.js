'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../app/district-conversation.js'), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function mount({ onCommit = () => {}, voice } = {}) {
  const nodes = [];
  const document = { activeElement: null, createElement(tag) {
    const handlers = new Map();
    const node = { tagName: tag.toUpperCase(), ownerDocument: document, children: [], style: {}, dataset: {},
      attributes: {}, value: '', selectionStart: 0, selectionEnd: 0, scrollHeight: 48, parentNode: null,
      append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; },
      addEventListener(type, handler) { const list = handlers.get(type) || []; list.push(handler); handlers.set(type, list); },
      removeEventListener(type, handler) { handlers.set(type, (handlers.get(type) || []).filter((item) => item !== handler)); },
      dispatch(type, extras = {}) {
        const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extras };
        let current = this;
        while (current) { for (const handler of current._handlers.get(type) || []) handler(event); current = current.parentNode; }
        return event;
      },
      click() { if (!this.disabled) this.dispatch('click'); },
      focus() { document.activeElement = this; this.dispatch('focus'); },
      _handlers: handlers,
    };
    nodes.push(node); return node;
  } };
  const container = document.createElement('main'), window = {};
  vm.runInNewContext(source, { window, Promise });
  const conversation = window.DistrictConversation.mount({ container, voice, onCommit });
  const find = (name) => nodes.find((node) => node.className === name);
  const draft = find('dc-draft');
  const type = (value) => { draft.value = value; draft.selectionStart = value.length; draft.selectionEnd = value.length; draft.dispatch('input'); };
  const enter = (extras) => draft.dispatch('keydown', { key: 'Enter', ...extras });
  return { conversation, document, container, nodes, find, draft, type, enter };
}

function fakeVoice({ status = Promise.resolve({ available: true }), start } = {}) {
  let listener = null, starts = 0, stops = 0, unsubscribed = 0;
  return { status: () => status,
    onEvent(receive) { listener = receive; return () => { unsubscribed++; listener = null; }; },
    start() { starts++; return start ? start(starts) : Promise.resolve({ captureId: `capture-${starts}` }); },
    stop() { stops++; return Promise.resolve({ stopped: true, confirmed: true }); },
    emit(event) { listener?.(event); },
    get counts() { return { starts, stops, unsubscribed }; },
  };
}

test('suggested prompt fills with ArrowUp only on an empty draft and never sends automatically', async () => {
  const commits = [], f = mount({ onCommit: request => commits.push(request) });
  f.conversation.setSuggestion('Continue the timer and check the saved files.');
  f.draft.dispatch('keydown', { key: 'ArrowUp' });
  assert.match(f.conversation.getDraft(), /Continue the timer/); await tick(); assert.equal(commits.length, 0);
  f.type('My own new instruction'); f.draft.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(f.conversation.getDraft(), 'My own new instruction');
  f.conversation.setDraft('Suggested next step'); assert.equal(commits.length, 0);
  f.enter(); await tick(); assert.equal(commits.length, 1); f.conversation.destroy();
});

test('first-frame typed input works while speech support is unresolved and never opens the microphone', async () => {
  const readiness = deferred(), voice = fakeVoice({ status: readiness.promise }), commits = [];
  const f = mount({ voice, onCommit: (request) => commits.push(request) });
  try {
    assert.equal(f.draft.disabled, false);
    f.type('Make a simple timer'); assert.equal(commits.length, 0);
    f.enter(); await tick();
    assert.equal(commits.length, 1); assert.equal(commits[0].text, 'Make a simple timer');
    assert.equal(voice.counts.starts, 0);
    readiness.resolve({ available: false, reason: 'No speech service is installed.' }); await tick();
    assert.match(f.find('dc-hint').children.map((node) => node.textContent).join(''), /Speech unavailable/);
    assert.equal(f.draft.disabled, false);
  } finally { f.conversation.destroy(); }
});

test('a long send keeps the next draft and focus editable while duplicate commits stay blocked', async () => {
  const sending = deferred(), commits = [];
  const f = mount({ onCommit: (request) => { commits.push(request); return commits.length === 1 ? sending.promise : undefined; } });
  try {
    f.draft.focus(); f.type('First request'); f.enter(); await tick();
    assert.equal(commits.length, 1); assert.equal(f.draft.disabled, false);
    f.type('My next thought'); f.enter(); f.enter({ repeat: true }); await tick();
    assert.equal(commits.length, 1); assert.equal(f.conversation.getDraft(), 'My next thought');
    assert.equal(f.document.activeElement, f.draft);
    sending.resolve({ status: 'accepted', runId: 'owned-run' }); await tick();
    assert.equal(f.conversation.getDraft(), 'My next thought');
    f.enter(); await tick(); assert.equal(commits.length, 2); assert.equal(commits[1].text, 'My next thought');
  } finally { f.conversation.destroy(); }
});

test('external pending blocks dispatch without disabling drafting and releases only on an explicit new Enter', async () => {
  const commits = [], f = mount({ onCommit: (request) => commits.push(request) });
  try {
    f.conversation.setPending(true); f.type('Keep this draft'); f.enter(); await tick();
    assert.equal(commits.length, 0); assert.equal(f.draft.disabled, false);
    f.conversation.setPending(false); await tick(); assert.equal(commits.length, 0);
    f.enter(); await tick(); assert.equal(commits.length, 1);
    assert.equal(commits[0].text, 'Keep this draft');
  } finally { f.conversation.destroy(); }
});

test('drafts, composition, Shift+Enter and repeated keydown never start work', async () => {
  const commits = [], f = mount({ onCommit: (request) => commits.push(request) });
  try {
    f.type('A multiline\nidea');
    f.enter({ shiftKey: true }); f.enter({ isComposing: true }); f.enter({ keyCode: 229 }); f.enter({ repeat: true }); await tick();
    assert.equal(commits.length, 0);
    f.enter(); f.enter(); await tick(); assert.equal(commits.length, 1);
    assert.equal(commits[0].text, 'A multiline\nidea');
  } finally { f.conversation.destroy(); }
});

test('rejected receipts and thrown provider errors remain actual diagnostics and keep the edited draft', async () => {
  const sending = deferred();
  const f = mount({ onCommit: () => sending.promise });
  try {
    f.type('Try this change'); f.enter(); await tick(); f.type('A revised idea');
    sending.resolve({ status: 'rejected', error: { message: 'Claude reported a usage limit. Reset time unavailable.' } }); await tick();
    assert.equal(f.find('dc-status').textContent, 'Claude reported a usage limit. Reset time unavailable.');
    assert.equal(f.conversation.getDraft(), 'A revised idea'); assert.equal(f.draft.disabled, false);
  } finally { f.conversation.destroy(); }
  const thrown = mount({ onCommit: () => { throw new Error('403: This account lacks permission.'); } });
  try {
    thrown.type('Keep me'); thrown.enter(); await tick();
    assert.equal(thrown.find('dc-status').textContent, '403: This account lacks permission.');
    assert.equal(thrown.conversation.getDraft(), 'Keep me');
  } finally { thrown.conversation.destroy(); }
});

test('only an explicitly started, matching completed utterance commits once; partial speech is a draft', async () => {
  const voice = fakeVoice(), commits = [], f = mount({ voice, onCommit: (request) => commits.push(request) });
  try {
    await tick(); assert.equal(voice.counts.starts, 0);
    voice.emit({ type: 'final', captureId: 'capture-1', text: 'Unsolicited' }); await tick(); assert.equal(commits.length, 0);
    f.find('dc-speak').click(); await tick(); assert.equal(voice.counts.starts, 1);
    voice.emit({ type: 'partial', captureId: 'capture-1', text: 'An unfinished idea' }); await tick();
    assert.equal(commits.length, 0); assert.equal(f.conversation.getDraft(), 'An unfinished idea');
    voice.emit({ type: 'final', captureId: 'other-capture', text: 'Wrong identity' });
    voice.emit({ type: 'final', captureId: 'capture-1', text: 'Make a useful timer' });
    voice.emit({ type: 'final', captureId: 'capture-1', text: 'Duplicate final' }); await tick();
    assert.equal(commits.length, 1); assert.equal(commits[0].text, 'Make a useful timer'); assert.equal(commits[0].source, 'voice');
  } finally { f.conversation.destroy(); }
});

test('Escape cancels speech, restores the earlier draft and ignores a late final', async () => {
  const voice = fakeVoice(), commits = [], f = mount({ voice, onCommit: (request) => commits.push(request) });
  try {
    await tick(); f.type('My original words'); f.find('dc-speak').click(); await tick();
    voice.emit({ type: 'partial', captureId: 'capture-1', text: 'Extra dictation' });
    f.draft.dispatch('keydown', { key: 'Escape' });
    assert.equal(voice.counts.stops, 1); assert.equal(f.conversation.getDraft(), 'My original words');
    assert.equal(f.document.activeElement, f.draft);
    voice.emit({ type: 'final', captureId: 'capture-1', text: 'Stale final' }); await tick(); assert.equal(commits.length, 0);
  } finally { f.conversation.destroy(); }
});

test('cancelled native capture cannot commit while the next capture identity is unresolved', async () => {
  const second = deferred(), voice = fakeVoice({ start: (count) => count === 1 ? Promise.resolve({ captureId: 'old' }) : second.promise });
  const commits = [], f = mount({ voice, onCommit: (request) => commits.push(request) });
  try {
    await tick(); f.find('dc-speak').click(); await tick(); f.find('dc-cancel').click();
    f.find('dc-speak').click(); voice.emit({ type: 'final', captureId: 'old', text: 'Cancelled final' });
    second.resolve({ captureId: 'new' }); await tick(); assert.equal(commits.length, 0);
    voice.emit({ type: 'partial', captureId: 'new', text: 'Draft new' });
    voice.emit({ type: 'final', captureId: 'new', text: 'Completed new' }); await tick();
    assert.equal(commits.length, 1); assert.equal(commits[0].text, 'Completed new');
  } finally { f.conversation.destroy(); }
});

test('typing during speech cancels capture, keeps the typed draft and never dispatches its late final', async () => {
  const voice = fakeVoice(), commits = [], f = mount({ voice, onCommit: (request) => commits.push(request) });
  try {
    await tick(); f.find('dc-speak').click(); await tick(); f.type('Typed replacement');
    voice.emit({ type: 'final', captureId: 'capture-1', text: 'Late microphone text' }); await tick();
    assert.equal(voice.counts.stops, 1); assert.equal(commits.length, 0); assert.equal(f.conversation.getDraft(), 'Typed replacement');
    f.enter(); await tick(); assert.equal(commits.length, 1); assert.equal(commits[0].source, 'text');
  } finally { f.conversation.destroy(); }
});

test('status changes preserve focus and text; teardown prevents queued work and tolerates failed voice unsubscribe', async () => {
  const voice = fakeVoice(), commits = [], f = mount({ voice, onCommit: (request) => commits.push(request) });
  f.draft.focus(); f.type('Unsent idea'); f.conversation.setStatus('Provider connection is unavailable.');
  assert.equal(f.document.activeElement, f.draft); assert.equal(f.conversation.getDraft(), 'Unsent idea');
  f.enter(); f.conversation.destroy(); await tick(); assert.equal(commits.length, 0); assert.equal(f.container.children.length, 0);
  assert.equal(voice.counts.unsubscribed, 1);
  const brokenVoice = fakeVoice(); brokenVoice.onEvent = () => () => { throw new Error('Fixture unsubscribe failed'); };
  const other = mount({ voice: brokenVoice });
  assert.doesNotThrow(() => other.conversation.destroy()); assert.equal(other.container.children.length, 0);
});
