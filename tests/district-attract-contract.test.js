'use strict';
// Actual Workbench/Conversation/Selection code, with a recording renderer and
// minimal DOM. Real runtime cases use SQLite/files/recipes/HTTP preview; provider
// sessions remain fixtures. No canvas raster, GPU, Electron or visual acceptance.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { DistrictRuntime } = require('../app/district/runtime');
const selection = require('../app/district-selection');
const sourceRoot = path.resolve(__dirname, '..');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

function clock() {
  let now = Date.now(), next = 1;
  const jobs = new Map();
  return {
    jobs, get now() { return now; },
    setTimeout(fn, delay = 0) { const id = next++; jobs.set(id, { at: now + Math.max(0, delay), fn }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    advance(milliseconds) {
      const until = now + milliseconds;
      let count = 0;
      while (true) {
        const due = [...jobs].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        assert(++count < 10000, 'fixture clock must remain bounded');
        const [id, job] = due; jobs.delete(id); now = job.at; job.fn();
      }
      now = until;
    },
  };
}

function dom() {
  class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(event) {
      event.target ||= this; event.currentTarget = this;
      event.preventDefault ||= function () { this.defaultPrevented = true; };
      for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event);
      if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
      return !event.defaultPrevented;
    }
  }
  const doc = new Events();
  class Element extends Events {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc;
      this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = {};
      this._text = ''; this.className = ''; this.id = ''; this.value = ''; this.hidden = false;
      this.disabled = false; this.selectionStart = 0; this.selectionEnd = 0; this.scrollHeight = 48;
      this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
    }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
    set textContent(value) { for (const child of this.children) child.parentNode = null; this.children = []; this._text = String(value); }
    get firstChild() { return this.children[0] || null; }
    get isConnected() { return this === doc.body || Boolean(this.parentNode?.isConnected); }
    append(...nodes) {
      for (const node of nodes) {
        if (node.parentNode) node.remove();
        node.parentNode = this; this.children.push(node);
      }
    }
    appendChild(node) { this.append(node); return node; }
    insertBefore(node, before) {
      if (node === before) return node;
      if (node.parentNode) node.remove();
      const index = before ? this.children.indexOf(before) : -1;
      node.parentNode = this;
      if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
      return node;
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }
    setAttribute(name, value) {
      value = String(value); this.attributes[name] = value;
      if (name === 'class') this.className = value;
      if (name === 'id') this.id = value;
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      if (name === 'type') this.type = value;
    }
    getAttribute(name) {
      if (name === 'class') return this.className;
      if (name === 'id') return this.id;
      if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? null;
      return this.attributes[name] ?? null;
    }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() { doc.activeElement = this; this.dispatchEvent({ type: 'focus' }); }
    scrollIntoView() {}
    getBoundingClientRect() { return { x: 0, y: 0, width: 900, height: 600, left: 0, top: 0, right: 900, bottom: 600 }; }
    get classList() {
      const element = this;
      return {
        contains(name) { return element.className.split(/\s+/).includes(name); },
        add(...names) { element.className = [...new Set(element.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); },
        remove(...names) { element.className = element.className.split(/\s+/).filter((name) => !names.includes(name)).join(' '); },
        toggle(name, force) {
          const has = this.contains(name), next = force === undefined ? !has : Boolean(force);
          if (next) this.add(name); else this.remove(name);
          return next;
        },
      };
    }
    click() { if (!this.disabled) this.dispatchEvent({ type: 'click', bubbles: true }); }
    querySelectorAll(selector) {
      const all = this.children.flatMap((node) => [node, ...node.querySelectorAll('*')]);
      if (selector === '*') return all;
      return all.filter((node) => {
        if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
        if (selector.startsWith('#')) return node.id === selector.slice(1);
        const attribute = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
        if (attribute) return attribute[2] === undefined ? node.getAttribute(attribute[1]) !== null : node.getAttribute(attribute[1]) === attribute[2];
        return node.tagName.toLowerCase() === selector.toLowerCase();
      });
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  doc.createElement = (tag) => new Element(tag);
  doc.body = doc.createElement('body'); doc.readyState = 'complete'; doc.hidden = false; doc.activeElement = null;
  doc.querySelector = (selector) => doc.body.querySelector(selector);
  doc.querySelectorAll = (selector) => doc.body.querySelectorAll(selector);
  const container = doc.createElement('main'); doc.body.append(container);
  return { doc, container };
}

function emptySnapshot() { return { version: 1, projects: [], runs: [], activities: [], providers: [], checkpoints: [], previews: [] }; }

function harness(t, { api, ready = true, onChildRefresh } = {}) {
  const timers = clock(), { doc, container } = dom(), worlds = [], rendererViolations = [];
  const media = {
    matches: false, listeners: new Set(),
    addEventListener(type, fn) { if (type === 'change') this.listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'change') this.listeners.delete(fn); },
    change(value) { this.matches = value; for (const fn of [...this.listeners]) fn({ matches: value }); },
  };
  const storage = new Map(), paneMounts = [], feedbacks = [];
  const commands = [], receipts = [], waiters = [];
  const delegate = api || { snapshot: async () => emptySnapshot(), command: async () => { throw new Error('Passive intro dispatched a command'); } };
  const wrapped = {
    snapshot: () => delegate.snapshot(),
    async command(command) {
      commands.push(structuredClone(command));
      const receipt = await delegate.command(command);
      receipts.push({ command, receipt });
      for (const waiter of [...waiters]) {
        const found = receipts.filter((item) => item.command.type === waiter.type)[waiter.index];
        if (found) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(found.receipt); }
      }
      return receipt;
    },
  };
  const window = {
    DistrictSelection: selection,
    DistrictUI: { mount(options) { const record = { options, destroyed: 0, refreshes: 0 }; paneMounts.push(record);
      return { refresh: async () => { record.refreshes++; return onChildRefresh?.(record); }, destroy() { record.destroyed++; } }; } },
    DistrictFeedback: class {
      constructor(options) { this.options = options; this.updates = []; this.destroyed = 0; feedbacks.push(this); }
      update(value) { this.updates.push(value); }
      destroy() { this.destroyed++; }
    },
    DistrictAttractWorld: { mount(options) {
      assert.deepEqual(Object.keys(options), ['container', 'view', 'showcase'], 'the renderer receives presentation options, never command or provider authority');
      assert.equal(options.view, 'cinematic');
      assert.equal(options.showcase, true);
      const canvas = doc.createElement('canvas'); canvas.className = 'daw-world'; options.container.append(canvas);
      const record = { options, calls: [], destroyed: 0 };
      worlds.push(record);
      const call = (name, value) => {
        if (record.destroyed) rendererViolations.push(name);
        record.calls.push({ name, value: typeof value === 'object' ? structuredClone(value) : value });
      };
      return {
        setShowcaseContext(value) { call('setShowcaseContext', value); },
        setBeat(value) { call('setBeat', value); }, setEngaged(value) { call('setEngaged', value); },
        setActivity(value) { call('setActivity', value); }, setPaused(value) { call('setPaused', value); },
        getDiagnostics() { call('getDiagnostics'); return { ready, renderer: 'fixture-only', gpuQualified: false }; },
        destroy() { record.destroyed++; record.calls.push({ name: 'destroy' }); canvas.remove(); },
      };
    } },
    crypto: { randomUUID: () => crypto.randomUUID() },
    localStorage: { getItem: (name) => storage.get(name) || null, setItem: (name, value) => storage.set(name, String(value)) },
    matchMedia: () => media,
  };
  class RealmDate extends Date { constructor(...args) { super(...(args.length ? args : [timers.now])); } static now() { return timers.now; } }
  class Event { constructor(type, values = {}) { this.type = type; Object.assign(this, values); } }
  const context = vm.createContext({
    window, document: doc, URL, Promise, Event, Date: RealmDate,
    setTimeout: timers.setTimeout.bind(timers), clearTimeout: timers.clearTimeout.bind(timers),
  });
  for (const file of ['district-attract-demo.js', 'district-conversation.js', 'district-workbench.js']) {
    vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'app', file), 'utf8'), context, { timeout: 1500, filename: file });
  }
  const workbench = window.DistrictWorkbench.mount({ container, api: wrapped });
  t.after(() => workbench.destroy());
  return {
    workbench, timers, doc, container, worlds, rendererViolations, commands, receipts, media, feedbacks, paneMounts,
    find: (className) => container.querySelector('.' + className),
    receipt(type, index = 0) {
      const found = receipts.filter((item) => item.command.type === type)[index];
      return found ? Promise.resolve(found.receipt) : new Promise((resolve) => waiters.push({ type, index, resolve }));
    },
  };
}

function runtimeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-attract-contract-'));
  const db = new DatabaseSync(path.join(root, 'district.sqlite'));
  const entered = deferred(), finished = deferred();
  let agentCalls = 0;
  const runtime = new DistrictRuntime({
    db, appRoot: sourceRoot, workRoot: path.join(root, 'projects'),
    providerList: async () => [{ id: 'codex', name: 'Fixture worker', available: true }],
    agentStart(options) {
      agentCalls++; entered.resolve(options);
      return { finished: finished.promise, cancel() { finished.resolve({ exitCode: 1, error: 'Fixture cancelled', output: '' }); } };
    },
  });
  t.after(async () => {
    finished.resolve({ exitCode: 1, error: 'Fixture closed', output: '' });
    await runtime.close(); db.close();
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.match(path.basename(target), /^agent-bus-attract-contract-/);
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5 });
  });
  return { runtime, entered, finished, get agentCalls() { return agentCalls; } };
}

async function finishPreparation(h, f) {
  const checks = await h.receipt('run_checks');
  assert.equal((await f.runtime.waitForRun(checks.runId)).state, 'passed');
  // Advance the Workbench's owned wait, after the actual recipe milestone.
  h.timers.advance(800);
  await tick();
  const preview = await h.receipt('preview_start');
  await tick();
  return { checks, preview };
}

test('passive showcase and conversation drafts never dispatch, reset or pause a visible renderer', async (t) => {
  let readUnavailable = false;
  const h = harness(t, { api: {
    snapshot: async () => {
      if (readUnavailable) throw new Error('Fixture current snapshot unavailable');
      return emptySnapshot();
    },
    command: async () => { throw new Error('Passive showcase dispatched a command'); },
  } });
  await h.workbench.refresh();
  assert.equal(h.worlds.length, 1);
  const world = h.worlds[0];
  assert(world.calls.some((call) => call.name === 'setShowcaseContext'));
  assert(world.calls.some((call) => call.name === 'setPaused' && call.value === false));
  const draft = h.find('dc-draft');
  draft.focus(); draft.value = 'An unfinished idea that is only a draft.';
  draft.dispatchEvent({ type: 'input' });
  const pauseBoundary = world.calls.length;
  h.timers.advance(60000); await tick();
  await h.workbench.refresh();
  assert.equal(h.commands.length, 0);
  assert.equal(draft.value, 'An unfinished idea that is only a draft.');
  assert(world.calls.slice(pauseBoundary).filter((call) => call.name === 'setPaused').every((call) => call.value === false),
    'typing/focus cannot be treated as renderer pause');
  assert.equal(h.worlds.length, 1, 'passive timers and refreshes cannot remount the opening');
  assert.equal(world.calls.filter((call) => ['setBeat', 'setActivity', 'setEngaged'].includes(call.name)).length, 0,
    'the scoped showcase owns presentation; independent legacy beat/activity calls cannot reset it');
  const contexts = world.calls.filter((call) => call.name === 'setShowcaseContext').map((call) => call.value);
  assert(contexts.every((value) => value.projectId === '' && value.run === null && value.activity === null && value.follow === false && value.unavailable === false),
    'drafting cannot manufacture a project, worker, activity, result or fresh-run handoff');
  assert.equal(h.find('dw-attract-demo'), null, 'the rejected floating demo is absent');
  assert.equal(h.find('dw-app').dataset.sound, 'muted');
  readUnavailable = true; await h.workbench.refresh();
  const unavailable = world.calls.filter((call) => call.name === 'setShowcaseContext').at(-1).value;
  assert.equal(unavailable.unavailable, true, 'a genuine failed snapshot gates interpretation of prior state');
  assert.equal(unavailable.run, null);
  assert.equal(unavailable.activity, null);
  assert.equal(unavailable.follow, false);
  readUnavailable = false; await h.workbench.refresh();
  assert.equal(world.calls.filter((call) => call.name === 'setShowcaseContext').at(-1).value.unavailable, false);
  h.doc.hidden = true; h.doc.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(world.calls.filter((call) => call.name === 'setPaused').at(-1).value, true);
  h.doc.hidden = false; h.doc.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(world.calls.filter((call) => call.name === 'setPaused').at(-1).value, false);
  assert.equal(h.commands.length, 0);
});


for (const lostType of ['create_project', 'run_checks']) {
  test('a lost ' + lostType + ' reply resumes the same real entry phase without duplicate work',
    { timeout: 30000 }, async (t) => {
      const f = runtimeFixture(t);
      const lost = deferred();
      let dropped = false;
      const h = harness(t, { api: {
        snapshot: () => f.runtime.snapshot(),
        async command(command) {
          const receipt = await f.runtime.command(command);
          if (!dropped && command.type === lostType) {
            dropped = true; lost.resolve(receipt);
            throw new Error('Fixture lost the reply after the real command was accepted');
          }
          return receipt;
        },
      } });
      await h.workbench.refresh();
      h.find('dw-first-project').click();
      const acceptedButLost = await lost.promise;
      if (lostType === 'run_checks') assert.equal((await f.runtime.waitForRun(acceptedButLost.runId)).state, 'passed');
      await tick(); await tick();
      h.find('dw-first-project').click();
      const { checks } = await finishPreparation(h, f);
      await tick();
      const snapshot = await f.runtime.snapshot();
      assert.equal(snapshot.projects.length, 1, 'a lost response cannot create a second real workspace');
      const creations = h.commands.filter((command) => command.type === 'create_project');
      const preparations = h.commands.filter((command) => command.type === 'run_checks');
      assert.equal(new Set(creations.map((command) => command.id)).size, 1, 'create retries retain the entry phase identity');
      assert.equal(new Set(preparations.map((command) => command.id)).size, 1, 'check retries retain the entry phase identity');
      assert.equal(snapshot.runs.filter((run) => run.worker === 'local').length, 1,
        'a lost check response cannot build a second candidate run');
      if (lostType === 'run_checks') assert.equal(checks.runId, acceptedButLost.runId);
      assert.equal(f.agentCalls, 0);
      assert.equal(h.commands.filter((command) => command.type === 'start_task').length, 0);
      assert(h.feedbacks.some((item) => item.updates.some((value) => value.preview?.candidateHash)));
    });
}

test('a source edit after preview opening plus failed fresh snapshot cannot engage or dispatch against stale output',
  { timeout: 30000 }, async (t) => {
    const f = runtimeFixture(t);
    let refuseSnapshots = false, changedProject = null;
    const h = harness(t, { api: {
      snapshot() {
        if (refuseSnapshots) return Promise.reject(new Error('Fixture fresh snapshot unavailable'));
        return f.runtime.snapshot();
      },
      async command(command) {
        const receipt = await f.runtime.command(command);
        if (command.type === 'preview_start') {
          changedProject = command.projectId;
          f.runtime.workspaces.write(changedProject, 'styles.css',
            f.runtime.workspaces.read(changedProject, 'styles.css') + '\n/* actual edit after opening candidate A */\n');
          refuseSnapshots = true;
        }
        return receipt;
      },
    } });
    await h.workbench.refresh();
    const draft = h.find('dc-draft');
    draft.value = 'Change the real app only after its current output is verified.';
    draft.dispatchEvent({ type: 'input' });
    draft.dispatchEvent({ type: 'keydown', key: 'Enter', repeat: false, shiftKey: false });
    const checks = await h.receipt('run_checks');
    assert.equal((await f.runtime.waitForRun(checks.runId)).state, 'passed');
    h.timers.advance(800); await tick();
    await h.receipt('preview_start'); await tick(); await tick();
    const actual = await f.runtime.snapshot();
    assert(changedProject);
    assert(actual.previews.some((preview) => preview.projectId === changedProject && preview.stale === true),
      'the negative fixture must really stale the saved source against its opened artifact');
    assert.equal(h.find('dw-play-output').hidden, true, 'an older snapshot cannot grant current playable-output authority');
    assert.equal(h.find('dw-entry-error').hidden, false, 'failed freshness must remain inspectable');
    assert.equal(f.agentCalls, 0);
    assert.equal(h.commands.filter((command) => command.type === 'start_task').length, 0);
    assert.equal(h.feedbacks.length, 0, 'a failed current-state read cannot attach editable preview feedback');
    assert.equal(draft.value, 'Change the real app only after its current output is verified.');
  });

test('destroy while a child workspace refresh is pending cannot mount a replacement pane when it resolves',
  { timeout: 30000 }, async (t) => {
    const f = runtimeFixture(t);
    await f.runtime.command({
      id: 'existing-project-before-workbench', type: 'create_project', origin: 'gui', payload: { name: 'Existing project' },
    });
    const childEntered = deferred(), childRelease = deferred();
    let hold = false;
    const h = harness(t, { api: f.runtime, onChildRefresh(record) {
      if (hold) { childEntered.resolve(record); return childRelease.promise; }
    } });
    await h.workbench.refresh();
    assert.equal(h.paneMounts.length, 1);
    hold = true;
    h.find('dw-new').click();
    h.find('dw-project-name').value = 'A legitimately saved second project';
    h.find('dw-create').dispatchEvent({ type: 'submit' });
    await childEntered.promise;
    const mountedBeforeDestroy = h.paneMounts.length;
    h.workbench.destroy();
    assert(h.paneMounts.every((pane) => pane.destroyed === 1));
    childRelease.resolve();
    await tick(); await tick();
    h.timers.advance(10000); await tick();
    assert.equal((await f.runtime.snapshot()).projects.length, 2, 'closing UI preserves the already saved project');
    assert.equal(h.container.children.length, 0);
    assert.equal(h.paneMounts.length, mountedBeforeDestroy, 'late create continuation cannot mount an orphaned child UI');
    assert.equal(h.paneMounts.reduce((sum, pane) => sum + pane.destroyed, 0), h.paneMounts.length);
    assert.equal(h.timers.jobs.size, 0);
    assert.equal(h.rendererViolations.length, 0);
  });

test('one explicit Enter creates/checks/prepares one real checklist project and dispatches one owned fixture session',
  { timeout: 30000 }, async (t) => {
    const f = runtimeFixture(t);
    const h = harness(t, { api: f.runtime });
    await h.workbench.refresh();
    const draft = h.find('dc-draft');
    draft.value = 'Let me rename tasks and see how many are complete.';
    draft.dispatchEvent({ type: 'input' });
    assert.equal(h.commands.length, 0);
    draft.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false, repeat: false });
    draft.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false, repeat: true });
    draft.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false, repeat: false });
    const { checks, preview } = await finishPreparation(h, f);
    const agent = await f.entered.promise;
    assert.equal(f.agentCalls, 1);
    const types = h.commands.map((command) => command.type);
    assert.equal(types.filter((type) => type === 'create_project').length, 1);
    assert.equal(types.filter((type) => type === 'run_checks').length, 1);
    assert.equal(types.filter((type) => type === 'preview_start').length, 1);
    assert.equal(types.filter((type) => type === 'start_task').length, 1);
    const created = h.commands.find((command) => command.type === 'create_project');
    assert.equal(created.payload.starterId, 'checklist');
    const snapshot = await f.runtime.snapshot();
    assert.equal(snapshot.projects.length, 1);
    assert.equal(snapshot.projects[0].starterId, 'checklist');
    assert.equal(agent.root, snapshot.projects[0].root);
    assert.equal(agent.instruction, 'Let me rename tasks and see how many are complete.');
    assert.equal(agent.contractId, 'checklist');
    assert.equal(h.find('dw-play-output').hidden, true, 'preparing a real candidate does not obscure the helper by default');
    assert.equal(preview.runId, checks.runId);
    assert.equal(snapshot.previews.find((item) => item.runId === checks.runId).candidateHash,
      snapshot.runs.find((item) => item.id === checks.runId).artifact.candidateHash);
    f.finished.resolve({ exitCode: 1, error: 'Fixture deliberately ends after dispatch qualification', output: '' });
    await f.runtime.waitForRun(agent.runId);
    await tick();
    assert.equal(f.agentCalls, 1);
  });

test('renderer-not-ready fallback still permits one explicit real app preparation without an automatic provider',
  { timeout: 30000 }, async (t) => {
    const f = runtimeFixture(t);
    const h = harness(t, { api: f.runtime, ready: false });
    await h.workbench.refresh();
    h.timers.advance(30000); await tick();
    assert.equal(h.commands.length, 0);
    const start = h.find('dw-first-project');
    assert.equal(start.disabled, false);
    start.click(); start.click();
    await finishPreparation(h, f);
    assert.equal(h.commands.filter((command) => command.type === 'create_project').length, 1);
    assert.equal(h.commands.filter((command) => command.type === 'run_checks').length, 1);
    assert.equal(h.commands.filter((command) => command.type === 'preview_start').length, 1);
    assert.equal(h.commands.filter((command) => command.type === 'start_task').length, 0);
    assert.equal(f.agentCalls, 0);
    assert(h.feedbacks.some((item) => item.updates.some((value) => value.preview?.candidateHash)),
      'the actual candidate preview reaches the playable-output UI boundary');
    assert.equal(h.find('dw-play-output').hidden, true, 'fallback preparation also waits for the explicit output view choice');
  });

test('destroy during pending snapshot cannot remount or call the disposed renderer after a late completion', async (t) => {
  const pending = deferred();
  let reads = 0;
  const h = harness(t, { api: { snapshot: () => ++reads === 1 ? Promise.resolve(emptySnapshot()) : pending.promise,
    command: async () => { throw new Error('Closed UI dispatched'); } } });
  await h.workbench.refresh();
  assert.equal(h.worlds.length, 1, 'the lifecycle case must own a real renderer handle before destruction');
  const refreshing = h.workbench.refresh();
  await tick();
  const mounted = h.worlds.length;
  h.workbench.destroy(); h.workbench.destroy();
  const countAfterDestroy = h.worlds.length;
  pending.resolve(emptySnapshot());
  await refreshing;
  await tick();
  h.timers.advance(120000); await tick();
  h.doc.dispatchEvent({ type: 'visibilitychange' });
  h.media.change(true);
  await h.workbench.refresh();
  assert.equal(h.container.children.length, 0);
  assert.equal(h.worlds.length, countAfterDestroy, 'late snapshot cannot resurrect a renderer');
  assert.equal(countAfterDestroy, mounted);
  assert(h.worlds.every((world) => world.destroyed === 1), 'each owned renderer is disposed exactly once');
  assert.deepEqual(h.rendererViolations, [], 'no method may touch a renderer after destroy');
  assert.equal(h.timers.jobs.size, 0, 'destroy clears readiness, beat, polling and transition timers');
  assert.equal(h.commands.length, 0);
});


test('hiding the workbench cannot reactivate its renderer through a later refresh or automatic timer', async (t) => {
  const h = harness(t);
  await h.workbench.refresh();
  assert.equal(typeof h.workbench.setVisible, 'function', 'the host needs a lifecycle hook when another app view is shown');
  assert.equal(h.worlds.length, 1);
  h.workbench.setVisible(false);
  const mountedWhileHidden = h.worlds.length;
  const inactive = (world) => world.destroyed === 1
    || world.calls.filter((call) => call.name === 'setPaused').at(-1)?.value === true;
  assert(h.worlds.every(inactive), 'hiding must pause or dispose every owned renderer');
  h.timers.advance(60000); await tick();
  await h.workbench.refresh();
  assert.equal(h.worlds.length, mountedWhileHidden, 'data refresh cannot mount a hidden world');
  assert(h.worlds.every(inactive), 'hidden data refresh cannot unpause the world');
  h.workbench.setVisible(true);
  await h.workbench.refresh();
  const live = h.worlds.filter((world) => !world.destroyed);
  assert.equal(live.length, 1);
  assert.equal(live[0].calls.filter((call) => call.name === 'setPaused').at(-1).value, false);
  assert.equal(h.commands.length, 0, 'host visibility remains a presentation operation');
  assert.deepEqual(h.rendererViolations, []);
});
