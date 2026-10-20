'use strict';
// Actual controller, recording DOM/projection/API fixtures. No Electron, GPU,
// provider subprocess or native pointer qualification is claimed by these tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const controller = require('../app/district-map-interaction');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) {
    event.target ||= this; event.currentTarget = this; event.preventDefault ||= function () { this.defaultPrevented = true; };
    for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  listenerCount() { return [...this.listeners.values()].reduce((sum, values) => sum + values.size, 0); }
}
function makeDOM() {
  const doc = new Events(), view = new Events(), timers = new Map(); let next = 1;
  view.setTimeout = (fn, delay) => { const id = next++; timers.set(id, { fn, delay }); return id; };
  view.clearTimeout = id => timers.delete(id);
  class Element extends Events {
    constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = {}; this.style = {}; this.className = ''; this._text = ''; this.hidden = false; this.disabled = false; this.value = ''; this.captures = new Set(); }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
    set textContent(value) { this._text = String(value); for (const child of this.children) child.parentNode = null; this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() { doc.activeElement = this; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 600 }; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { if (this.captures.delete(id)) this.dispatchEvent({ type: 'lostpointercapture', pointerId: id }); }
    click() { if (!this.disabled) this.dispatchEvent({ type: 'click', detail: 0, bubbles: true }); }
    querySelectorAll(selector) {
      const nodes = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      if (selector === '*') return nodes;
      if (selector.startsWith('.')) return nodes.filter(node => node.className.split(/\s+/).includes(selector.slice(1)));
      return nodes.filter(node => node.tagName.toLowerCase() === selector);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  doc.createElement = tag => new Element(tag); doc.body = doc.createElement('body'); doc.defaultView = view; doc.hidden = false;
  const container = doc.createElement('main'); doc.body.append(container);
  return { doc, view, container, timers, async poll() { const entry = [...timers][0]; assert(entry, 'visible controller schedules a poll'); assert.equal(entry[1].delay, 500); timers.delete(entry[0]); entry[1].fn(); await tick(); } };
}
function fixture(t, options = {}) {
  const dom = makeDOM(), calls = { assign: [], cancel: [], jobs: [], messages: [], list: 0, workers: 0 }, diagnostics = { ready: true, camera: { type: 'orthographic' }, showcase: { pullback: 1 } };
  const layout = { featuredHost: { position: [0, 0, 0], scale: .65 }, facilityDetails: {
    test: { bounds: { min: [10, 0, 0], max: [16, 5, 6] }, entrance: [13, 0, 6] },
    build: { bounds: { min: [-20, 0, 0], max: [-15, 4, 5] }, entrance: [-18, 0, 5] },
  } };
  const world = { getDiagnostics: () => diagnostics, getLayout: () => layout, projectPoint: ([x, y, z]) => ({ x: 300 + x * 10 + z * 2, y: 300 - y * 10 + z * 3, visible: true }) };
  const state = { jobs: [], workers: [{ id: '@smoke-runner', name: 'Smoke runner', available: true, detail: 'Built-in · no model calls' }, { id: '@codex-worker', name: 'Codex', available: true, detail: 'Installed CLI; authentication checked on assignment' }, { id: '@claude-worker', name: 'Claude', available: false, detail: 'CLI unavailable' }], listError: null, workerError: null };
  const api = {
    workers() { calls.workers++; if (state.workerError) return Promise.reject(state.workerError); return state.workers; },
    list() { calls.list++; if (state.listError) return Promise.reject(state.listError); return state.jobs.map(job => structuredClone(job)); },
    assign(assignment) { calls.assign.push(assignment); const job = { id: 101, agent: assignment.agent, building: assignment.building, state: 'assigned', created: Date.now(), executor: assignment.agent === '@smoke-runner' ? 'local' : 'codex', root: 'D:/owned/disposable', detail: 'Waiting for actual runner', steps: [], output: '' }; state.jobs.push(job); return { id: job.id }; },
    cancel(id) { calls.cancel.push(id); state.jobs.find(job => job.id === id).state = 'cancelled'; return { cancelled: true }; },
    ...options.api,
  };
  let instance;
  instance = controller.mount({ container: dom.container, getWorld: () => world, api, onJob(job, metadata) { calls.jobs.push({ job: structuredClone(job), metadata }); options.onJob?.(job, metadata, instance); }, onMessage(message) { calls.messages.push(message); } });
  t.after(() => instance.destroy());
  const find = name => dom.container.querySelector('.dmi-' + name);
  const facility = id => dom.container.querySelectorAll('.dmi-facility').find(node => node.dataset.facility === id);
  const chooseTest = () => { find('robot').click(); facility('test').click(); };
  return { ...dom, instance, calls, state, diagnostics, layout, world, api, find, facility, chooseTest };
}

test('UMD import is inert and browser export exposes the same controller contract', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/district-map-interaction.js'), 'utf8');
  const window = {}; vm.runInNewContext(source, { window });
  assert.equal(typeof window.DistrictMapInteraction.mount, 'function');
  assert.equal(Object.keys(window).length, 1);
  assert.throws(() => controller.mount({}), /requires/);
});

test('I01/W02 readiness and projection use the actual host plus all eight facility corners', () => {
  assert.equal(controller.readyForInteraction({ ready: true, camera: { type: 'orthographic' }, showcase: { pullback: 1 } }), true);
  for (const value of [{ ready: false }, { ready: true, camera: { type: 'perspective' }, showcase: { pullback: 1 } }, { ready: true, camera: { type: 'orthographic' }, showcase: { pullback: .99 } }, { ready: true, contextLost: true, camera: { type: 'orthographic' }, showcase: { pullback: 1 } }]) assert.equal(controller.readyForInteraction(value), false);
  const projected = [], project = point => { projected.push(point); return { x: point[0] + point[2], y: point[1] + point[2], visible: true }; };
  const zone = controller.projectBounds({ bounds: { min: [0, 0, 0], max: [2, 3, 4] }, entrance: [1, 0, 4] }, project);
  assert.equal(new Set(projected.slice(0, 8).map(JSON.stringify)).size, 8); assert.deepEqual(projected[8], [1, 0, 4]);
  assert.equal(controller.pointInPolygon({ x: 2, y: 3 }, zone.polygon), true); assert.equal(controller.pointInPolygon({ x: 100, y: 100 }, zone.polygon), false);
  assert.equal(controller.pointInPolygon(zone.polygon[0], zone.polygon), true);
  projected.length = 0; controller.projectRobot({ position: [1, 2, 3], scale: .65 }, project);
  assert.deepEqual(projected, [[1, 2, 3], [1, 3.95, 3]]);
  assert.equal(controller.projectRobot({ position: [0, 0, 0], scale: 0 }, project), null);
});

test('only actual executable workers are offered; historical success never follows or dispatches', async t => {
  const f = fixture(t); f.state.workers.push({ id: 'bus-peer', name: 'Peer', available: true }, { id: '@codex-worker', name: 'Duplicate', available: true });
  f.state.jobs.push({ id: 8, state: 'passed', steps: [{ name: 'Old check', state: 'passed' }] }); await f.instance.refresh();
  assert.deepEqual(f.find('provider').children.map(node => node.value), ['@smoke-runner', '@codex-worker', '@claude-worker']);
  assert.equal(f.find('provider').children[2].disabled, true); assert.equal(f.calls.jobs.length, 0); assert.equal(f.calls.assign.length, 0);
  assert.equal(f.find('checks').children.length, 0);
});

test('keyboard choose robot then Test prepares a dock; only one explicit Run commits exact executor', async t => {
  const f = fixture(t), gate = deferred(); await f.instance.refresh(); f.chooseTest();
  assert.equal(f.find('dock').hidden, false); assert.equal(f.calls.assign.length, 0);
  f.find('provider').value = '@codex-worker'; f.find('provider').dispatchEvent({ type: 'change' });
  const originalList = f.api.list; f.api.list = () => gate.promise;
  f.find('run').click(); f.find('run').click(); assert.equal(f.instance.hasActive(), true); assert.equal(f.calls.assign.length, 0);
  f.api.list = originalList; gate.resolve([]); await tick(); await f.instance.refresh();
  assert.deepEqual(f.calls.assign, [{ agent: '@codex-worker', building: 'test' }]);
  assert.equal(f.calls.jobs.length, 1); assert.deepEqual(f.calls.jobs[0].metadata, { follow: true, unavailable: false });
  await f.instance.refresh(); assert.equal(f.calls.jobs.length, 1, 'same snapshot does not recurse/follow again');
});

test('drag drop opens Test without assignment; outside, cancellation and Escape never dispatch', async t => {
  const f = fixture(t); await f.instance.refresh(); const robot = f.find('robot');
  function drag(x, y, id = 1) { robot.dispatchEvent({ type: 'pointerdown', button: 0, pointerId: id, clientX: 300, clientY: 290 }); f.doc.dispatchEvent({ type: 'pointermove', pointerId: id, clientX: x, clientY: y }); }
  drag(445, 290); assert(robot.hasPointerCapture(1)); f.doc.dispatchEvent({ type: 'pointerup', pointerId: 1, clientX: 445, clientY: 290 });
  assert.equal(robot.hasPointerCapture(1), false); assert.equal(f.find('dock').hidden, false); assert.equal(f.calls.assign.length, 0);
  f.instance.clearFocus(); drag(899, 599); f.doc.dispatchEvent({ type: 'pointerup', pointerId: 1, clientX: 899, clientY: 599 });
  assert.equal(f.find('dock').hidden, true); assert.match(f.find('status').textContent, /cancelled/);
  robot.click(); f.facility('test').click(); assert.equal(f.find('dock').hidden, false, 'keyboard selection works after cancelled drag without a synthetic click');
  f.instance.clearFocus(); drag(445, 290, 2); f.doc.dispatchEvent({ type: 'pointercancel', pointerId: 2 }); assert.equal(robot.hasPointerCapture(2), false);
  drag(445, 290, 3); f.doc.dispatchEvent({ type: 'keydown', key: 'Escape' }); assert.equal(robot.hasPointerCapture(3), false);
  f.doc.dispatchEvent({ type: 'pointerup', pointerId: 3, clientX: 445, clientY: 290 }); assert.equal(f.calls.assign.length, 0);
});

test('unwired buildings are honest inspect-only and camera readiness gates every assignment affordance', async t => {
  const f = fixture(t); await f.instance.refresh(); f.facility('build').click();
  assert.equal(f.find('run').hidden, true); assert.equal(f.find('status').textContent, 'Ready for future connections');
  assert.equal(f.calls.assign.length, 0);
  f.diagnostics.showcase.pullback = .5; await f.instance.refresh(); assert.equal(f.find('robot').hidden, true); assert.equal(f.facility('test').hidden, true);
  f.find('robot').click(); f.facility('test').click(); f.find('run').click(); await tick(); assert.equal(f.calls.assign.length, 0);
  f.diagnostics.showcase.pullback = 1; f.diagnostics.contextLost = true; await f.instance.refresh(); assert.equal(f.find('robot').hidden, true);
});

test('actual named progress, failed auth output and current identity are rendered without fabricated checks', async t => {
  const f = fixture(t, { onJob(_job, _metadata, instance) { void instance.refresh(); } }); await f.instance.refresh(); f.chooseTest(); f.find('run').click(); await tick();
  const job = f.state.jobs[0]; job.state = 'running'; job.detail = 'running: HTTP authentication and RPC'; job.steps = [{ name: 'JavaScript syntax', state: 'passed' }, { name: 'HTTP authentication and RPC', state: 'running' }];
  await f.instance.refresh(); assert.equal(f.find('checks').children.length, 2); assert.match(f.find('status').textContent, /HTTP authentication and RPC/);
  assert.deepEqual(f.calls.jobs.at(-1).metadata, { follow: false, unavailable: false });
  job.state = 'failed'; job.detail = 'Codex authentication unavailable'; job.agent_detail = 'login required'; job.agent_output = 'quota not available'; job.output = 'Observed exit 1';
  await f.instance.refresh(); assert.equal(f.instance.hasActive(), false); assert.match(f.find('status').textContent, /failed.*authentication/);
  assert.match(f.find('output').textContent, /reported\):\nquota not available/); assert.match(f.find('output').textContent, /Observed runner output:\nObserved exit 1/);
  assert.match(f.find('scope').textContent, /Job #101.*local.*failed.*owned/); assert.equal(f.find('checks').children.length, 2);
});

test('read failure marks only the selected own last result unavailable and recovers without refollow', async t => {
  const f = fixture(t); await f.instance.refresh(); f.chooseTest(); f.find('run').click(); await tick();
  f.state.listError = new Error('SQLite busy'); await f.instance.refresh(); assert.equal(f.calls.jobs.at(-1).metadata.unavailable, true);
  assert.match(f.find('status').textContent, /Status unavailable.*SQLite busy.*assigned/); assert.equal(f.instance.hasActive(), true);
  f.state.listError = null; f.state.jobs[0].state = 'passed'; f.state.jobs[0].detail = '6/6 smoke checks passed'; await f.instance.refresh();
  assert.deepEqual(f.calls.jobs.at(-1).metadata, { follow: false, unavailable: false }); assert.equal(f.instance.hasActive(), false);
});

test('lost assignment reply reconciles its one matching new saved job and never retries', async t => {
  const f = fixture(t); await f.instance.refresh(); f.chooseTest(); const original = f.api.assign;
  f.api.assign = assignment => { original(assignment); throw new Error('reply lost'); };
  f.find('run').click(); await tick(); await f.instance.refresh();
  assert.equal(f.calls.assign.length, 1); assert.equal(f.calls.jobs[0].job.id, 101); assert.equal(f.calls.jobs[0].metadata.follow, true);
  f.find('run').click(); await f.poll(); assert.equal(f.calls.assign.length, 1);
});

test('poll recovery while assign reply is pending remains confirmed after that reply rejects', async t => {
  const f = fixture(t), gate = deferred(); await f.instance.refresh(); f.chooseTest(); const original = f.api.assign;
  f.api.assign = assignment => { original(assignment); return gate.promise; }; f.find('run').click(); await tick();
  await f.instance.refresh(); assert.equal(f.calls.jobs.length, 1); gate.reject(new Error('late reply lost')); await tick();
  f.state.jobs[0].state = 'passed'; f.state.jobs[0].detail = '6/6 smoke checks passed'; await f.instance.refresh();
  assert.equal(f.instance.hasActive(), false); assert.doesNotMatch(f.find('status').textContent, /unconfirmed/); assert.equal(f.calls.assign.length, 1);
});

test('missing or ambiguous lost replies stay busy without a blind retry or historical adoption', async t => {
  const f = fixture(t); await f.instance.refresh(); f.chooseTest(); f.api.assign = assignment => { f.calls.assign.push(assignment); throw new Error('connection closed'); };
  f.find('run').click(); await tick(); assert.equal(f.instance.hasActive(), true); assert.match(f.find('status').textContent, /unconfirmed/);
  const candidate = { agent: '@smoke-runner', building: 'test', created: Date.now(), state: 'passed' };
  f.state.jobs.push({ ...candidate, id: 4 }, { ...candidate, id: 5 }); await f.instance.refresh();
  assert.equal(f.calls.jobs.length, 0); f.find('run').click(); await f.poll(); assert.equal(f.calls.assign.length, 1); assert.equal(f.instance.hasActive(), true);
  assert.equal(controller.reconcileCandidate([{ ...candidate, id: 4 }], { dispatched: true, agent: '@smoke-runner', startedAt: Date.now(), before: new Set([4]) }), null);
  assert.equal(controller.reconcileCandidate([{ ...candidate, id: 4, agent: '@codex-worker' }], { dispatched: true, agent: '@smoke-runner', startedAt: Date.now(), before: new Set() }), null);
});

test('known receipt with unavailable saved state remains active until its actual record is read', async t => {
  const f = fixture(t); await f.instance.refresh(); f.chooseTest(); f.api.assign = assignment => { f.calls.assign.push(assignment); f.state.listError = new Error('read unavailable'); return { id: 123 }; };
  f.find('run').click(); await tick(); assert.equal(f.instance.hasActive(), true); assert.equal(f.calls.jobs.length, 0);
  f.state.listError = null; f.state.jobs.push({ id: 123, agent: '@smoke-runner', building: 'test', state: 'passed', detail: 'Observed 6/6 passed', steps: [] }); await f.instance.refresh();
  assert.equal(f.instance.hasActive(), false); assert.equal(f.calls.jobs.length, 1);
});

test('preflight active work or failed availability read prevents any assignment', async t => {
  const f = fixture(t); await f.instance.refresh(); f.chooseTest(); f.state.jobs.push({ id: 2, state: 'running' }); f.find('run').click(); await tick();
  assert.equal(f.calls.assign.length, 0); assert.match(f.find('status').textContent, /already has active/);
  f.state.jobs = []; await f.instance.refresh(); f.state.listError = new Error('disk unavailable'); f.find('run').click(); await tick(); assert.equal(f.calls.assign.length, 0);
  f.state.listError = null; f.state.workerError = new Error('discovery unavailable'); await f.instance.refresh({ workers: true }); assert.equal(f.find('run').disabled, true);
});

test('Escape preserves actual work; explicit cancel targets only the owned job and waits for saved terminal state', async t => {
  const f = fixture(t), gate = deferred(); await f.instance.refresh(); f.chooseTest(); f.find('run').click(); await tick();
  f.doc.dispatchEvent({ type: 'keydown', key: 'Escape' }); assert.equal(f.calls.cancel.length, 0); assert.equal(f.find('dock').hidden, false); assert.match(f.find('status').textContent, /Use Cancel run/);
  f.api.cancel = id => { f.calls.cancel.push(id); return gate.promise; }; f.find('cancel').click(); f.find('cancel').click();
  assert.deepEqual(f.calls.cancel, [101]); assert.equal(f.instance.hasActive(), true); assert.equal(f.find('close').disabled, true);
  f.state.jobs[0].state = 'cancelled'; gate.resolve({ cancelled: true }); await tick(); await f.instance.refresh();
  assert.equal(f.instance.hasActive(), false); f.find('close').click(); assert.equal(f.find('dock').hidden, true);
  assert.deepEqual(f.calls.jobs.at(-1), { job: null, metadata: { follow: false, unavailable: false } });
  await f.instance.refresh(); assert.equal(f.calls.jobs.at(-1).job, null, 'closed terminal job never retakes world authority');
});

test('500ms job polling caches executor discovery and explicit worker refresh reads current availability', async t => {
  const f = fixture(t); await f.instance.refresh(); assert.equal(f.calls.workers, 1);
  for (let index = 0; index < 10; index++) await f.poll();
  assert.equal(f.calls.workers, 1, 'job polling must not repeatedly discover installed CLIs');
  f.state.workers[1].available = false; await f.instance.refresh({ workers: true });
  assert.equal(f.calls.workers, 2); assert.equal(f.find('provider').children[1].disabled, true);
});

test('visibility and destroy stop polling/listeners; pending preflight never dispatches after leaving', async t => {
  const f = fixture(t), gate = deferred(); await f.instance.refresh(); assert.equal(f.timers.size, 1); await f.poll();
  f.instance.setVisible(false); assert.equal(f.timers.size, 0); assert.equal(f.find('layer').hidden, true);
  f.instance.setVisible(true); await f.instance.refresh(); f.chooseTest(); f.api.list = () => gate.promise; f.find('run').click();
  f.instance.destroy(); gate.resolve([]); await tick();
  assert.equal(f.calls.assign.length, 0); assert.equal(f.calls.cancel.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.doc.listenerCount(), 0); assert.equal(f.view.listenerCount(), 0); assert.equal(f.container.children.length, 0);
});

test('destroy after dispatch never auto-cancels or delivers a late result', async t => {
  const f = fixture(t), gate = deferred(); await f.instance.refresh(); f.chooseTest(); f.api.assign = assignment => { f.calls.assign.push(assignment); return gate.promise; };
  f.find('run').click(); await tick(); assert.equal(f.calls.assign.length, 1); f.instance.destroy(); gate.resolve({ id: 99 }); await tick();
  assert.equal(f.calls.jobs.length, 0); assert.equal(f.calls.cancel.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.container.children.length, 0);
});
