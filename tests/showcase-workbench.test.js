'use strict';
// Showcase Workbench/Conversation/Selection/Attention, with a recording renderer and
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

function harness(t, { api, ready = true, onChildRefresh, mapAdapter } = {}) {
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
    DistrictMapInteraction:mapAdapter,
    DistrictSelection: selection,
    DistrictAttention: require('../app/district-attention'),
    DistrictUI: { mount(options) { const record = { options, destroyed: 0, refreshes: 0 }; paneMounts.push(record);
      return { refresh: async () => { record.refreshes++; return onChildRefresh?.(record); }, destroy() { record.destroyed++; } }; } },
    DistrictFeedback: class {
      constructor(options) { this.options = options; this.updates = []; this.destroyed = 0; feedbacks.push(this); }
      update(value) { this.updates.push(value); }
      destroy() { this.destroyed++; }
    },
    DistrictAttractWorld: { mount(options) {
      assert.deepEqual(Object.keys(options), ['container', 'view', 'showcase'], 'renderer gets presentation options only');
      assert.equal(options.view, 'cinematic'); assert.equal(options.showcase, true);
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
  for (const file of ['district-continuation.js', 'district-conversation.js', 'district-workbench.js']) {
    vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'app', file), 'utf8'), context, { timeout: 1500, filename: file });
  }
  if(delegate.tests)wrapped.tests=delegate.tests;
  const workbench = window.DistrictWorkbench.mount({ container, api: wrapped });
  t.after(() => workbench.destroy());
  return {
    workbench, timers, doc, container, worlds, rendererViolations, commands, receipts, media, feedbacks, paneMounts, storage,
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

test('build-area continuation fills once and auto-dispatches through existing authority to the same provider', async (t) => {
  const snapshot = emptySnapshot();
  snapshot.projects = [{ id: 'p1', name: 'Timer', root: 'fixture/timer', manifest: { hash: 'h1' } }];
  snapshot.providers = [{ id: 'codex', available: true }, { id: 'claude', available: true }];
  snapshot.runs = [{ id: 'r1', projectId: 'p1', worker: 'claude', instruction: 'Make a timer', created: 1, state: 'passed', source: { hash: 'h1' }, checks: [{ name: 'Build', state: 'passed' }] }];
  const h = harness(t, { api: { snapshot: async () => structuredClone(snapshot), command: async command => {
    assert.equal(command.type, 'start_task');
    snapshot.runs.unshift({ ...snapshot.runs[0], id: 'r2', state: 'working', instruction: command.instruction, created: 2 });
    return { status: 'accepted', runId: 'r2', projectId: 'p1' };
  } } });
  await h.workbench.refresh(); h.find('dw-build-area').click();
  h.find('dc-next-use').click();
  assert.match(h.find('dc-draft').value, /Make a timer/); assert.equal(h.commands.length, 0, 'Use once only fills the draft');
  h.find('dc-next-count').value = '1'; h.find('dc-next-auto').click();
  h.timers.advance(3000); await tick(); await tick();
  assert.equal(h.commands.length, 1); assert.equal(h.commands[0].worker, 'claude', 'must not silently switch to the preferred Codex provider');
  assert.equal(h.commands[0].projectId, 'p1'); assert.match(h.commands[0].instruction, /Do not invent features/);
  h.timers.advance(10000); await tick(); assert.equal(h.commands.length, 1);
});

test('editing the draft cancels a queued build-area auto reply before dispatch', async (t) => {
  const snapshot = emptySnapshot(); snapshot.projects = [{ id: 'p1', name: 'Timer' }];
  snapshot.providers = [{ id: 'codex', available: true }];
  snapshot.runs = [{ id: 'r1', projectId: 'p1', worker: 'codex', instruction: 'Make a timer', created: 1, state: 'passed', checks: [] }];
  const h = harness(t, { api: { snapshot: async () => structuredClone(snapshot), command: async () => { throw new Error('Cancelled auto reply dispatched'); } } });
  await h.workbench.refresh(); h.find('dw-build-area').click(); h.find('dc-next-auto').click();
  const draft = h.find('dc-draft'); draft.value = 'Let me think'; draft.dispatchEvent({ type: 'input' });
  h.timers.advance(10000); await tick(); assert.equal(h.commands.length, 0); assert.equal(draft.value, 'Let me think');
});

test('first-frame drafts and the muted cinematic survive an unresolved snapshot without dispatch or reset', async (t) => {
  const firstRead = deferred();
  const h = harness(t, { api: { snapshot: () => firstRead.promise, command: async () => { throw new Error('Passive entry cannot dispatch'); } } });
  const draft = h.find('dc-draft');
  assert.equal(h.find('dw-welcome').hidden, false, 'input is present before the first snapshot resolves');
  assert.equal(draft.disabled, false);
  draft.value = 'I am still deciding what to make.'; draft.dispatchEvent({ type: 'input' }); draft.focus();
  h.timers.advance(12000); await tick();
  assert.equal(h.commands.length, 0);
  assert.equal(h.worlds.length, 1);
  assert.equal(h.find('dw-app').dataset.sound, 'muted');
  assert.equal(h.find('dw-attract-demo'), null, 'the rejected floating example is absent');
  assert.equal(h.find('dw-demo-idea'), null);
  assert.equal(h.worlds[0].calls.filter((call) => call.name === 'setBeat').length, 0);
  firstRead.resolve(emptySnapshot()); await h.workbench.refresh();
  assert.equal(draft.value, 'I am still deciding what to make.');
  assert(h.worlds[0].calls.filter((call) => call.name === 'setShowcaseContext').every((call) => call.value.run === null));
  assert.equal(h.commands.length, 0);
});

test('an explicit mid-opening commit keeps one world, editable next draft and exact live check/task identities', { timeout: 30000 }, async (t) => {
  const f = runtimeFixture(t), checkAccepted = deferred(), checkReply = deferred();
  const h = harness(t, { api: {
    snapshot: () => f.runtime.snapshot(),
    async command(command) {
      const receipt = await f.runtime.command(command);
      if (command.type === 'run_checks') { checkAccepted.resolve(receipt); await checkReply.promise; }
      return receipt;
    },
  } });
  await h.workbench.refresh(); h.timers.advance(6000); await tick();
  const draft = h.find('dc-draft'); draft.value = 'Let me rename tasks for Saturday.';
  draft.dispatchEvent({ type: 'input' });
  draft.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false, repeat: false });
  const accepted = await checkAccepted.promise;
  assert.equal(draft.disabled, false, 'a pending operation locks sending, not drafting');
  draft.value = 'My next idea is only a draft.'; draft.dispatchEvent({ type: 'input' });
  draft.dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false, repeat: false });
  const actualCheckRun = await f.runtime.waitForRun(accepted.runId);
  assert.equal(actualCheckRun.state, 'passed');
  checkReply.resolve();
  await finishPreparation(h, f);
  const agent = await f.entered.promise; await tick();
  assert.equal(h.worlds.length, 1, 'commit and candidate output cannot remount/replay the opening');
  assert.equal(h.commands.filter((command) => command.type === 'start_task').length, 1);
  assert.equal(agent.instruction, 'Let me rename tasks for Saturday.');
  assert.equal(draft.value, 'My next idea is only a draft.');
  const contexts = h.worlds[0].calls.filter((call) => call.name === 'setShowcaseContext').map((call) => call.value);
  assert(contexts.some((value) => value.run?.id === accepted.runId && value.run.checks.length === actualCheckRun.checks.length));
  assert(contexts.some((value) => value.projectId === agent.projectId || value.run?.id === agent.runId));
  assert(contexts.every((value) => !value.run || value.projectId === value.run.projectId));
  assert(contexts.filter((value) => value.run?.id === accepted.runId).every((value) => value.follow === true), 'owned command identity follows even a recipe that passed before its first snapshot');
  assert(contexts.filter((value) => !value.run).every((value) => value.follow === false));
  assert.equal(h.worlds[0].calls.filter((call) => ['setActivity', 'setBeat', 'setEngaged'].includes(call.name)).length, 0);
  assert.equal(h.worlds[0].calls.filter((call) => call.name === 'setPaused').at(-1).value, false);
  assert.equal(h.paneMounts.length, 0, 'no hidden regular workspace competes with the cinematic/output');
  f.finished.resolve({ exitCode: 1, error: 'Fixture ends after dispatch evidence', output: '' });
  await f.runtime.waitForRun(agent.runId);
});

test('all seven projects retain attention, selection and independent panes across top/side and overview/split changes', async (t) => {
  const snapshot = emptySnapshot();
  snapshot.displays = [{ id:'display-fixture' }];
  snapshot.projects = Array.from({ length:7 }, (_, index) => ({ id:'project-' + index, name:'Project ' + index, root:'fixture/' + index, preferences:{ testDisplayId:'display-fixture' } }));
  snapshot.runs = snapshot.projects.map((project, index) => ({ id:'run-' + index, projectId:project.id, state:'failed', worker:'local', detail:'Actual fixture diagnostic ' + index, created:new Date(Date.now() - index * 1000).toISOString(), checks:[{id:'named-check',state:'failed'}] }));
  const h = harness(t, { api:{ snapshot:async () => structuredClone(snapshot), command:async () => { throw new Error('View selection dispatched'); } } });
  await h.workbench.refresh();
  assert.equal(h.container.querySelectorAll('.dw-attention-item').length, 7, 'unselected projects remain visible in the attention feed');
  const targetAttention = h.container.querySelectorAll('.dw-attention-item').find((item) => item.dataset.projectId === 'project-6');
  targetAttention.querySelector('.dw-attention-open').click();
  assert.equal(h.commands.length, 0);
  for (const toggle of h.container.querySelectorAll('.dw-project-toggle')) if (toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
  h.find('dw-navigation-side').click();
  assert.equal(h.find('dw-app').dataset.nav, 'side');
  assert.equal(h.find('dw-project-tabs').getAttribute('aria-orientation'), 'vertical');
  h.container.querySelectorAll('.dw-mode').find((item) => item.textContent === 'Side by side').click();
  assert.equal(h.paneMounts.length, 7);
  const mountCount = h.paneMounts.length;
  const selected = () => h.container.querySelectorAll('.dw-project-tab').filter((item) => item.getAttribute('aria-selected') === 'true').length;
  assert.equal(selected(), 7);
  h.find('dw-navigation-top').click();
  h.container.querySelectorAll('.dw-mode').find((item) => item.textContent === 'Combined overview').click();
  h.container.querySelectorAll('.dw-mode').find((item) => item.textContent === 'Side by side').click();
  assert.equal(h.paneMounts.length, mountCount, 'view preferences preserve the pooled panes and their drafts');
  assert.equal(selected(), 7);
  assert.equal(JSON.parse(h.storage.get('agent-bus.district.workspace-view.v1')).navigation, 'top');
  for (const pane of h.paneMounts) {
    const scoped = await pane.options.api.snapshot();
    assert.equal(scoped.projects.length, 1); assert.equal(scoped.runs.length, 1);
    assert.equal(scoped.projects[0].id, scoped.runs[0].projectId);
    assert.equal(scoped.displays[0].id, 'display-fixture');
    assert.equal(scoped.allProjects.length, 7);
    const refused = await pane.options.api.command({ id:'cross-project-negative',type:'run_checks',projectId:scoped.projects[0].id === 'project-0' ? 'project-1' : 'project-0' });
    assert.equal(refused.status, 'rejected');
  }
  assert.equal(h.commands.length, 0);
});

test('read failure quiets the live context and recovery cannot fabricate or replay a historical result', { timeout: 30000 }, async (t) => {
  const f = runtimeFixture(t); let unavailable = false;
  const h = harness(t, { api:{ snapshot:() => unavailable ? Promise.reject(new Error('Actual fixture read outage')) : f.runtime.snapshot(), command:(command) => f.runtime.command(command) } });
  await h.workbench.refresh(); h.find('dw-first-project').click(); await finishPreparation(h, f);
  const before = h.commands.length;
  const lastRun = h.worlds[0].calls.filter((call) => call.name === 'setShowcaseContext' && call.value.run).at(-1).value.run;
  unavailable = true; await h.workbench.refresh();
  const failedRead = h.worlds[0].calls.filter((call) => call.name === 'setShowcaseContext').at(-1).value;
  assert.equal(failedRead.unavailable, true);
  assert.equal(failedRead.run.id, lastRun.id, 'identity remains inspectable while unavailable gates interpretation');
  unavailable = false; await h.workbench.refresh(); await h.workbench.refresh();
  assert.equal(h.commands.length, before);
  assert.equal(h.worlds.length, 1);
  assert(h.worlds[0].calls.filter((call) => call.name === 'setShowcaseContext' && call.value.run).every((call) => call.value.run.id === lastRun.id));
  assert.equal(h.worlds[0].calls.filter((call) => ['setActivity','setBeat','setEngaged'].includes(call.name)).length, 0, 'only the scoped presenter can interpret historical/terminal transitions');
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

test('Enter before the first snapshot waits for actual state and sends the original instruction once', { timeout: 30000 }, async (t) => {
  const f = runtimeFixture(t), initial = deferred(); let reads = 0;
  const h = harness(t, { api:{ snapshot:() => ++reads === 1 ? initial.promise : f.runtime.snapshot(), command:(command) => f.runtime.command(command) } });
  const draft = h.find('dc-draft'); draft.value = 'Give checklist tasks editable names.';
  draft.dispatchEvent({ type:'input' }); draft.dispatchEvent({ type:'keydown',key:'Enter',shiftKey:false,repeat:false });
  h.find('dw-first-project').click();
  assert.equal(h.commands.length, 0);
  assert.equal(draft.disabled, false);
  draft.value = 'Still drafting the next change.'; draft.dispatchEvent({type:'input'});
  initial.resolve(await f.runtime.snapshot());
  await finishPreparation(h, f);
  const agent = await f.entered.promise;
  assert.equal(agent.instruction, 'Give checklist tasks editable names.');
  assert.equal(h.commands.filter((command) => command.type === 'create_project').length, 1);
  assert.equal(h.commands.filter((command) => command.type === 'start_task').length, 1);
  assert.equal(draft.value, 'Still drafting the next change.');
  assert.equal(h.worlds.length, 1);
  f.finished.resolve({exitCode:1,error:'Fixture complete',output:''}); await f.runtime.waitForRun(agent.runId);
});

test('retrying a lost explicit task acceptance reuses the command after the real session ends', { timeout: 30000 }, async (t) => {
  const f = runtimeFixture(t), lost = deferred(); let dropped = false;
  const h = harness(t, { api:{
    snapshot:() => f.runtime.snapshot(),
    async command(command) {
      const receipt = await f.runtime.command(command);
      if (command.type === 'start_task' && !dropped) { dropped = true; lost.resolve(receipt); throw new Error('Fixture lost task reply after real acceptance'); }
      return receipt;
    },
  } });
  await h.workbench.refresh();
  const draft = h.find('dc-draft'); draft.value = 'Keep this exact task-name request.';
  draft.dispatchEvent({type:'input'}); draft.dispatchEvent({type:'keydown',key:'Enter',shiftKey:false,repeat:false});
  await finishPreparation(h, f);
  const receipt = await lost.promise, agent = await f.entered.promise; await tick(); await tick();
  f.finished.resolve({exitCode:1,error:'Fixture intentionally ends accepted run',output:''}); await f.runtime.waitForRun(agent.runId);
  await h.workbench.refresh(); await tick();
  draft.value = 'Keep this exact task-name request.'; draft.dispatchEvent({type:'input'});
  draft.dispatchEvent({type:'keydown',key:'Enter',shiftKey:false,repeat:false});
  const recovered = await h.receipt('start_task'); await tick();
  assert.equal(recovered.runId, receipt.runId);
  assert.equal(new Set(h.commands.filter((command) => command.type === 'start_task').map((command) => command.id)).size, 1);
  assert.equal(f.agentCalls, 1, 'receipt recovery cannot launch a second provider session');
  assert.equal(h.worlds.length, 1);
});

test('a checked checklist preview stays behind the explicit output choice without losing world or draft', { timeout: 30000 }, async (t) => {
  const f = runtimeFixture(t), h = harness(t, { api:f.runtime });
  await h.workbench.refresh();
  h.find('dw-first-project').click();
  const { checks, preview } = await finishPreparation(h, f);
  const snapshot = await f.runtime.snapshot();
  assert.equal(snapshot.projects[0].starterId, 'checklist');
  const actual = snapshot.previews.find((item) => item.runId === checks.runId);
  assert(actual && actual.candidateHash === snapshot.runs.find((run) => run.id === checks.runId).artifact.candidateHash,
    'the hidden panel must already have a genuine candidate-bound preview');
  assert.equal(actual.runId, preview.runId);
  assert(h.feedbacks.some((feedback) => feedback.updates.some((update) => update.preview?.runId === checks.runId && update.preview?.candidateHash === actual.candidateHash)),
    'feedback is prepared against the real checked identity');
  const panel = h.find('dw-play-output'), open = h.find('dw-open-output'), close = h.find('dw-close-output');
  assert.equal(panel.hidden, true, 'real output is available without obscuring the helper automatically');
  assert(open && close, 'opening and closing the output are explicit controls');
  assert.equal(open.textContent, 'Try your creation');
  const draft = h.find('dc-draft'); draft.value = 'Keep this next idea while I inspect the result.';
  draft.dispatchEvent({type:'input'});
  const commandCount = h.commands.length, world = h.worlds[0], feedback = h.feedbacks[0];
  open.click();
  assert.equal(panel.hidden, false);
  await h.workbench.refresh();
  assert.equal(panel.hidden, false, 'snapshot refresh preserves the explicit output choice');
  assert.equal(draft.disabled, false);
  close.click();
  assert.equal(panel.hidden, true);
  await h.workbench.refresh();
  assert.equal(panel.hidden, true, 'closing returns to the same continuous world');
  assert.equal(draft.value, 'Keep this next idea while I inspect the result.');
  assert.equal(h.commands.length, commandCount, 'output view controls are presentation choices');
  assert.equal(h.worlds.length, 1);
  assert.equal(world.destroyed, 0);
  assert.equal(feedback.destroyed, 0);
  assert.equal(h.feedbacks.length, 1, 'view toggles preserve the already bound feedback instance');
  assert.equal(f.agentCalls, 0);
});

test('isometric smoke assignments retain checkout identity, six real checks and the same world without creating an app', async t=>{
  const adapter={options:null,active:false,destroyed:0,visible:[],mount(options){this.options=options;return{hasActive:()=>this.active,clearFocus:()=>options.onJob(null),setVisible:value=>this.visible.push(value),destroy:()=>this.destroyed++};}};
  const h=harness(t,{mapAdapter:adapter,api:{snapshot:async()=>emptySnapshot(),command:async()=>{throw new Error('Smoke presentation must not issue a project command');},tests:{list:async()=>[]}}});
  await tick();await tick();assert(adapter.options);assert.equal(h.worlds.length,1);
  const job={id:42,root:'D:/ASM/agent-bus',building:'test',agent:'@codex-worker',executor:'codex',state:'running',created:1,sha:'checkout-head',manifest:{'app/file.js':'actual-source-hash'},steps:[{name:'JavaScript syntax',state:'passed'}],session_id:'actual-session'};
  adapter.active=true;adapter.options.onJob(job,{follow:true});
  let context=h.worlds[0].calls.filter(c=>c.name==='setShowcaseContext').at(-1).value;
  assert.equal(context.projectId,'checkout:D:/ASM/agent-bus');assert.equal(context.run.id,'smoke-42');assert.equal(context.run.kind,'smoke');assert.equal(context.run.total,6);assert.equal(context.run.checks.length,1);assert.equal(context.run.root,job.root);assert.equal(context.run.sessionId,'actual-session');assert.equal(context.follow,true);
  const draft=h.find('dc-draft');draft.value='Keep this next idea';draft.dispatchEvent({type:'input'});draft.dispatchEvent({type:'keydown',key:'Enter',shiftKey:false});await tick();
  assert.equal(h.commands.length,0,'the single robot cannot start concurrent project work');assert.equal(draft.value,'Keep this next idea');
  adapter.options.onJob(job,{unavailable:true});context=h.worlds[0].calls.filter(c=>c.name==='setShowcaseContext').at(-1).value;assert.equal(context.unavailable,true);assert.equal(context.run.checks.length,1,'read failure cannot invent completed checks');
  adapter.active=false;adapter.options.onJob({...job,state:'passed',steps:require('../app/agent-protocol').CHECKS.map(name=>({name,state:'passed'}))});
  context=h.worlds[0].calls.filter(c=>c.name==='setShowcaseContext').at(-1).value;assert.equal(context.run.checks.length,6);assert.equal(context.run.kind,'smoke');assert.equal(h.worlds.length,1);assert.equal(h.worlds[0].destroyed,0);
  h.workbench.destroy();const count=h.worlds[0].calls.length;adapter.options.onJob(job,{follow:true});assert.equal(h.worlds[0].calls.length,count);assert.equal(adapter.destroyed,1);assert.deepEqual(h.rendererViolations,[]);
});
