'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const shared = require('../app/district-world-state');
const source = fs.readFileSync(path.join(__dirname, '../app/district-scene.js'), 'utf8');

// This fixture exercises DOM/control and projection contracts only. The renderer
// is a bounded API fixture; no GPU, browser, provider or pixel render is started.
function harness({ gpu = true, helper = shared, offset = 0, projectionFailure = false } = {}) {
  const intersections = [], observers = [], worlds = [], animations = [];
  let document;
  class Node {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.dataset = {}; this.attributes = {}; this.handlers = new Map(); this.hidden = false;
      this.textContent = ''; this.ownerDocument = document; this.className = '';
      this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] || ''; } };
      this.classList = { add: (...names) => this._classes(names, []), remove: (...names) => this._classes([], names),
        contains: (name) => this.className.split(/\s+/).includes(name),
        toggle: (name, force) => { const add = force === undefined ? !this.classList.contains(name) : force;
          this._classes(add ? [name] : [], add ? [] : [name]); return add; } };
    }
    _classes(add, remove) { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean).filter((name) => !remove.includes(name)), ...add])].join(' '); }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    get clientWidth() { return this.hidden ? 0 : parseFloat(this.style.width) || 1000; }
    get clientHeight() { return this.hidden ? 0 : parseFloat(this.style.height) || 700; }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    appendChild(node) { this.append(node); return node; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this); this.parentElement = null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(name, callback, options = {}) {
      const values = this.handlers.get(name) || []; values.push(callback); this.handlers.set(name, values);
      options.signal?.addEventListener('abort', () => this.removeEventListener(name, callback), { once: true });
    }
    removeEventListener(name, callback) { this.handlers.set(name, (this.handlers.get(name) || []).filter((value) => value !== callback)); }
    emit(name, event = {}) { for (const callback of [...(this.handlers.get(name) || [])]) callback({ target: this, ...event }); }
    getBoundingClientRect() { return { left: 0, top: 0, x: 0, y: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight }; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    closest(selector) {
      const matches = (node) => selector === '[data-facility]' ? Boolean(node.dataset.facility)
        : selector === '[data-district-worker]' ? Boolean(node.dataset.districtWorker)
          : selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : node.tagName.toLowerCase() === selector;
      for (let node = this; node; node = node.parentElement) if (matches(node)) return node;
      return null;
    }
    focus() { document.activeElement = this; }
    setPointerCapture(id) { this.pointer = id; }
    hasPointerCapture(id) { return this.pointer === id; }
    releasePointerCapture() { this.pointer = null; }
    animate(frames, options) { const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; }, finished: Promise.resolve() }; animations.push(animation); return animation; }
  }
  document = { hidden: false, visibilityState: 'visible', activeElement: null, hit: null, handlers: new Map(),
    createElement: (tag) => new Node(tag), elementFromPoint: () => document.hit,
    addEventListener: Node.prototype.addEventListener, removeEventListener: Node.prototype.removeEventListener,
    emit: Node.prototype.emit };
  document.body = new Node('body');
  const media = { matches: false, addEventListener() {}, removeEventListener() {} };
  const window = { matchMedia: () => media, DistrictWorldState: helper };
  const centers = { research: [-11, 0, -17], build: [9, 0, -15], test: [-18, 0, -1], review: [-10, 0, 12], preview: [18, 0, 3] };
  const projection = ([x, y, z]) => ({ x: 760 + x * 12 - z * 7 + offset, y: 450 + x * 5 + z * 5 - y * 16, visible: true });
  if (gpu) window.DistrictAttractWorld = { mount({ container, view }) {
    const model = { diagnostic: { ready: true, view, gpuWorkersReady: true, phase: 'ready' }, workers: {}, records: [], calls: [], destroyed: false,
      setView(value) { this.diagnostic.view = value; }, setPaused(value) { this.paused = value; },
      setWorkers(records) { this.records = JSON.parse(JSON.stringify(records)); this.calls.push(this.records); this.workers = {};
        for (const [index, record] of records.entries()) { const anchor = centers[record.facility] || [0, .55, 0]; this.workers[record.id] = [anchor[0] + index, anchor[1], anchor[2] + 7]; } },
      getDiagnostics() { return { ...this.diagnostic }; },
      getLayout() { return { hub: [0, .55, 0], facilities: centers,
        facilityDetails: Object.fromEntries(Object.entries(centers).map(([id, [x, y, z]]) => [id,
          { entrance: [x, y, z + 7], pin: [x, 8, z], bounds: { min: [x - 4, 0, z - 3], max: [x + 4, 8, z + 3] },
            footprint: [[x - 4, 0, z - 3], [x + 4, 0, z - 3], [x + 4, 0, z + 3], [x - 4, 0, z + 3]] }])), workers: this.workers }; },
      projectPoint(point) { if (projectionFailure) throw new Error('Projection unavailable'); return projection(point); },
      destroy() { this.destroyed = true; this.diagnostic.ready = false; container.children = []; } };
    worlds.push(model); return model;
  } };
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; intersections.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    show(value) { this.callback([{ target: this.target, isIntersecting: value, intersectionRect: { width: value ? 1000 : 0, height: value ? 700 : 0 } }]); }
  }
  class ResizeObserver { constructor(callback) { this.callback = callback; observers.push(this); } observe(target) { this.target = target; } disconnect() { this.disconnected = true; } }
  const getComputedStyle = (node) => ({ display: node.hidden ? 'none' : node.style.display || 'block', visibility: node.style.visibility || 'visible',
    transform: node.style.transform || 'none', getPropertyValue: (name) => node.style.getPropertyValue(name) });
  vm.runInNewContext(source, { window, document, getComputedStyle, IntersectionObserver, ResizeObserver, AbortController,
    performance: { now: () => 1000 }, Date, console, Map, Set }, { timeout: 2000 });
  const scenes = [];
  function create(options = {}) { const container = new Node(); document.body.append(container);
    const scene = new window.DistrictScene({ container, ...options }); scenes.push(scene); return { scene, container }; }
  return { create, document, window, worlds, intersections, observers, animations, projection, media,
    reveal: (scene, visible = true) => intersections.find((observer) => observer.target === scene.root).show(visible),
    close: () => scenes.forEach((scene) => scene.destroy()) };
}
const provider = { id: 'codex', name: 'Codex', available: true };
const now = Date.now();
const input = (extra = {}) => ({ project: { id: 'p1', name: 'First' }, workers: [provider], activities: [], runs: [], now, ...extra });
const activity = (extra = {}) => ({ id: 'activity-1', workerId: 'codex', projectId: 'p1', runId: 'r1', phase: 'research', basis: 'reported', status: 'active', at: now, ...extra });
const running = (extra = {}) => ({ id: 'r1', worker: 'codex', projectId: 'p1', state: 'working', at: now, ...extra });
const worker = (scene, id = 'codex') => [...scene.workerNodes.values()].find((record) => record.workerId === id);
const pointer = (target, x, y, id = 1) => ({ target, button: 0, pointerId: id, clientX: x, clientY: y, preventDefault() {} });

test('management opens no renderer until actually visible; per-instance projected geometry never mutates fallback maps', (t) => {
  const api = harness(), first = api.create(), second = api.create(); t.after(api.close);
  first.scene.update(input()); second.scene.update(input({ project: { id: 'p2' } }));
  assert.equal(api.worlds.length, 0, 'seven selected but hidden maps must not create seven GPU contexts');
  const fallbackX = second.scene.byId.get('research').x;
  api.reveal(first.scene);
  assert.equal(first.scene.gpuReady, true); assert.equal(api.worlds[0].diagnostic.view, 'management');
  const entrance = api.worlds[0].getLayout().facilityDetails.research.entrance;
  assert.equal(first.scene.byId.get('research').x, api.projection(entrance).x);
  assert.equal(first.scene.facilityNodes.get('research').hit.dataset.anchorMode, 'projected-management');
  assert.equal(JSON.parse(first.scene.facilityNodes.get('research').hit.dataset.worldAnchor)[2], entrance[2]);
  assert.equal(second.scene.byId.get('research').x, fallbackX);
  assert.equal(second.scene.root.dataset.worldReady, 'false');
  assert.match(first.scene.facilityNodes.get('research').hit.style.clipPath, /^polygon\(/);
  assert(first.scene.byId.get('research').box[2] > 100);
});

test('CLI reports automatically move the same scoped GPU and DOM token without dispatching commands', (t) => {
  const api = harness(), assigns = [], selected = [], { scene } = api.create({ onAssign: (value) => assigns.push(value), onWorker: (value) => selected.push(value) }); t.after(api.close);
  scene.update(input({ runs: [running()], activities: [activity()] })); api.reveal(scene);
  let token = worker(scene); assert(token);
  assert.match(token.statusNode.textContent, /Agent-reported.*Research/);
  assert.equal(token.facility, 'research'); assert.equal(token.node.classList.contains('is-gpu-worker'), true);
  const rendered = api.worlds[0].records.find((record) => record.workerId === 'codex');
  assert(rendered); assert.equal(rendered.facility, 'research'); assert.equal(rendered.basis, 'reported');
  assert.equal(token.position.x, api.projection(api.worlds[0].workers[token.id]).x);
  scene.update(input({ runs: [running()], activities: [activity({ id: 'event-2', phase: 'edit', at: now + 1 })] }));
  token = worker(scene); assert.equal(token.facility, 'build');
  assert.equal(token.position.y, api.projection(api.worlds[0].workers[token.id]).y);
  assert.equal(assigns.length, 0); assert.equal(selected.length, 0);
  scene._click({ target: token.button }); assert.deepEqual(selected, ['codex']); assert.equal(assigns.length, 0);
});

test('unlinked CLI activity stays labelled and quiet; a missing linked run is unknown rather than a ghost task', (t) => {
  const api = harness(), { scene } = api.create(); t.after(api.close);
  scene.update(input({ activities: [activity({ runId: undefined })] })); api.reveal(scene);
  assert.equal(worker(scene).facility, 'research');
  assert.match(worker(scene).statusNode.textContent, /Agent-reported.*Unlinked run/);
  assert.equal(api.worlds[0].records[0].motionAllowed, false);
  scene.update(input({ activities: [activity()] }));
  assert.equal(worker(scene).facility, null);
  assert.match(worker(scene).statusNode.textContent, /Run unavailable/);
  assert.equal(api.worlds[0].records[0].state, 'unknown');
  assert.equal(api.worlds[0].records[0].motionAllowed, false);
});

test('cross-project and unlinked reports cannot create ghost facility status, and terminal run cannot be reopened by late prose', (t) => {
  const api = harness({ gpu: false }), { scene } = api.create(); t.after(api.close);
  scene.update(input({ activities: [activity({ projectId: 'p2', phase: 'test' }), activity({ projectId: undefined, phase: 'build' })] }));
  assert.equal(worker(scene).facility, null); assert.equal(scene.facilityNodes.get('test').status.textContent, 'Inspect');
  scene.update(input({ runs: [{ id: 'r1', worker: 'codex', projectId: 'p1', state: 'failed', finished: now }],
    activities: [activity({ phase: 'research', at: now + 1 })] }));
  assert.match(worker(scene).statusNode.textContent, /Failed/);
  assert.doesNotMatch(worker(scene).statusNode.textContent, /researching|Agent-reported/i);
  assert.equal(worker(scene).node.classList.contains('is-terminal'), true);
  scene.update(input({ project: { id: 'p2' } }));
  assert.equal(worker(scene).facility, null); assert.equal(scene.facilityNodes.get('research').status.textContent, 'Inspect');
  assert.equal(worker(scene).node.classList.contains('is-terminal'), false);
});

test('only explicit eligible drag completion invokes onAssign once; selection, pan and cancel never execute', (t) => {
  const api = harness({ gpu: false }), assigned = [], opened = [], { scene } = api.create({ onAssign: (value) => assigned.push(value), onFacility: (id) => opened.push(id) }); t.after(api.close);
  scene.update(input()); const token = worker(scene), target = scene.facilityNodes.get('test').hit;
  scene._click({ target }); assert.deepEqual(opened, ['test']); assert.equal(assigned.length, 0);
  scene._pointerDown(pointer(scene.root, 100, 100)); scene._pointerMove(pointer(scene.root, 150, 140)); scene._pointerEnd(pointer(scene.root, 150, 140), false);
  assert.equal(assigned.length, 0);
  api.document.hit = target;
  scene._pointerDown(pointer(token.button, 100, 100, 2)); scene._pointerMove(pointer(token.button, 160, 150, 2)); scene._pointerEnd(pointer(token.button, 160, 150, 2), true);
  assert.equal(assigned.length, 0);
  scene._pointerDown(pointer(token.button, 100, 100, 3)); scene._pointerMove(pointer(token.button, 160, 150, 3)); scene._pointerEnd(pointer(token.button, 160, 150, 3), false);
  scene._pointerEnd(pointer(token.button, 160, 150, 3), false);
  assert.equal(assigned.length, 1); assert.equal(assigned[0].worker, 'codex'); assert.equal(assigned[0].facility, 'test');
  scene.setUnavailable(true);
  scene._requestAssignment('codex', 'build'); assert.equal(assigned.length, 1);
});

test('stale, unavailable and reduced-motion states settle existing signals and retain honest labels', (t) => {
  const api = harness(), { scene } = api.create({ onAssign() {} }); t.after(api.close);
  scene.update(input({ runs: [running()], activities: [activity()] })); api.reveal(scene);
  scene.update(input({ runs: [running()], activities: [activity({ id: 'event-2', at: now + 1, freshness: 'stale' })] }));
  assert.equal(worker(scene).node.classList.contains('is-stale'), true);
  assert.match(worker(scene).statusNode.textContent, /Stale/i);
  assert.equal(api.worlds[0].records[0].motionAllowed, false);
  assert.equal(worker(scene).signal, null);
  scene.setUnavailable(true);
  assert.match(worker(scene).statusNode.textContent, /Unknown|unavailable/i);
  assert.equal(worker(scene).facility, null);
  assert.equal(worker(scene).canAssign, false); assert.equal(api.worlds[0].records[0].state, 'unknown');
  scene.setUnavailable(false); api.media.matches = true; scene._motionChange({ matches: true });
  assert.equal(api.worlds[0].paused, true);
  scene.fit(); const fit = scene.camera.scale; scene._zoom(1.2); assert(scene.camera.scale > fit);
  const event = { target: scene.facilityNodes.get('research').hit, key: 'ArrowRight', preventDefault() {} };
  scene._key(event); assert.equal(api.document.activeElement, scene.facilityNodes.get('build').hit);
});

test('seven projects mount only visible scenes and dispose contexts on hidden pane, document hide and destroy', (t) => {
  const api = harness(), entries = Array.from({ length: 7 }, (_, index) => api.create()); t.after(api.close);
  for (const [index, { scene }] of entries.entries()) scene.update(input({ project: { id: `p${index}` } }));
  assert.equal(api.worlds.length, 0);
  api.reveal(entries[0].scene); api.reveal(entries[1].scene);
  const active = () => api.worlds.filter((world) => !world.destroyed).length;
  assert.equal(active(), 2);
  entries[1].container.hidden = true; entries[1].scene.resize(); assert.equal(active(), 1);
  api.reveal(entries[2].scene); assert.equal(active(), 2);
  api.document.hidden = true; api.document.visibilityState = 'hidden'; api.document.emit('visibilitychange'); assert.equal(active(), 0);
  api.document.hidden = false; api.document.visibilityState = 'visible'; api.document.emit('visibilitychange'); assert.equal(active(), 2);
  entries[0].scene.setVisible(false); assert.equal(active(), 1);
  api.close(); assert.equal(active(), 0); assert(api.intersections.every((observer) => observer.disconnected));
});

test('offscreen maps update text and placement while cancelling active motion', (t) => {
  const api = harness({ gpu: false }), { scene } = api.create(); t.after(api.close);
  scene.update(input({ runs: [running()], activities: [activity()] })); api.reveal(scene);
  scene.update(input({ runs: [running()], activities: [activity({ id: 'editing', phase: 'edit', at: now + 1 })] }));
  const moving = worker(scene).motion;
  assert(moving, 'a fresh observed run may animate its current location transition');
  api.reveal(scene, false); assert.equal(moving.cancelled, true);
  const previousCount = api.animations.length;
  scene.update(input({ runs: [running()], activities: [activity({ id: 'checking', phase: 'test', at: now + 2 })] }));
  assert.equal(worker(scene).facility, 'test'); assert.match(worker(scene).statusNode.textContent, /Agent-reported.*Testing/);
  assert.equal(worker(scene).motion, null); assert.equal(api.animations.length, previousCount);
});

test('projection failures keep the illustrated fallback and real keyboard controls, without a dispatch', (t) => {
  const api = harness({ projectionFailure: true }), assignments = [], { scene } = api.create({ onAssign: (value) => assignments.push(value) }); t.after(api.close);
  const fallback = scene.byId.get('build').x; scene.update(input()); api.reveal(scene);
  assert.equal(scene.gpuReady, false); assert.equal(scene.byId.get('build').x, fallback);
  assert.equal(scene.root.dataset.worldState, 'projection-unavailable');
  assert.equal(scene.plate.src, 'assets/district.png');
  scene._key({ key: 'Home', target: scene.root, preventDefault() {} }); assert.equal(scene.camera.mode, 'fit');
  assert.equal(assignments.length, 0);
});

test('concurrent rows use unique render keys but worker selection and assignment still name the actual provider', (t) => {
  const rows = ['run-a', 'run-b'].map((key, index) => ({ id: 'codex', activityKey: key, renderId: key, projectId: 'p1', runId: key,
    name: 'Codex', available: true, passive: false, canAssign: true, facility: index ? 'test' : 'research', phase: index ? 'test' : 'research',
    basis: 'observed', state: 'working', terminal: false, stale: false, label: `Observed ${key}`, message: key, motionAllowed: true }));
  const api = harness({ helper: { ...shared, project: () => rows.map((row) => ({ ...row })) } }), selected = [], assigned = [],
    { scene } = api.create({ onWorker: (id) => selected.push(id), onAssign: (value) => assigned.push(value) }); t.after(api.close);
  scene.update(input()); api.reveal(scene);
  assert.equal(scene.workerNodes.size, 2); assert.deepEqual([...scene.workerNodes.keys()], ['run-a', 'run-b']);
  assert.equal(api.worlds[0].records.length, 2); assert.deepEqual(api.worlds[0].records.map((row) => row.id), ['run-a', 'run-b']);
  scene._click({ target: scene.workerNodes.get('run-a').button }); assert.deepEqual(selected, ['codex']);
  scene._requestAssignment(scene.workerNodes.get('run-b').workerId, 'build'); assert.equal(assigned.length, 1); assert.equal(assigned[0].worker, 'codex');
});

test('actual concurrent shared rows keep run-specific events and updates do not recreate or dispatch a token', (t) => {
  const api = harness(), assigned = [], { scene } = api.create({ onAssign: (value) => assigned.push(value) }); t.after(api.close);
  const runs = [running({ id: 'run-a', attemptId: 'a', sessionId: 'sa' }), running({ id: 'run-b', attemptId: 'b', sessionId: 'sb' })];
  const activities = [activity({ id: 'a-event', runId: 'run-a', attemptId: 'a', sessionId: 'sa', message: 'Reading actual files' }),
    activity({ id: 'b-event', runId: 'run-b', attemptId: 'b', sessionId: 'sb', phase: 'test', message: 'Testing actual files' })];
  scene.update(input({ runs, activities })); api.reveal(scene);
  assert.equal(scene.workerNodes.size, 2);
  const records = [...scene.workerNodes.values()];
  assert.deepEqual(records.map((record) => record.facility).sort(), ['research', 'test']);
  assert.equal(new Set(api.worlds[0].records.map((record) => record.id)).size, 2);
  assert(records.every((record) => record.workerId === 'codex'));
  const research = records.find((record) => record.facility === 'research'), original = research.node;
  scene.update(input({ runs, activities: [...activities, activity({ id: 'wrong-session', runId: 'run-a', attemptId: 'a', sessionId: 'other', phase: 'review', at: now + 2 })] }));
  assert.equal(scene.workerNodes.get(research.id).node, original);
  assert.equal(scene.workerNodes.get(research.id).facility, 'research');
  assert.equal(scene.workerNodes.get(research.id).bubble.textContent, 'Reading actual files');
  assert.equal(assigned.length, 0);
});

test('project changes cancel a pending drag and minimum worker hit area survives zooming out', (t) => {
  const api = harness({ gpu: false }), assigned = [], { scene } = api.create({ onAssign: (value) => assigned.push(value) }); t.after(api.close);
  scene.update(input()); const token = worker(scene);
  scene._pointerDown(pointer(token.button, 100, 100)); scene._pointerMove(pointer(token.button, 160, 150));
  scene.update(input({ project: { id: 'p2' } }));
  api.document.hit = scene.facilityNodes.get('build').hit;
  scene._pointerEnd(pointer(token.button, 160, 150), false);
  assert.equal(scene.drag, null); assert.equal(assigned.length, 0);
  scene.fit(); scene._zoom(.3);
  assert(parseFloat(scene.world.style.getPropertyValue('--dv-worker-hit-size')) * scene.camera.scale >= 44);
});

test('standalone fallback preserves Boolean terminal and never upgrades reported completion to a verified result', (t) => {
  const api = harness({ gpu: false, helper: undefined }), { scene } = api.create(); t.after(api.close);
  delete api.window.DistrictWorldState;
  scene.update(input({ activities: [activity({ terminal: true, status: 'passed' })] }));
  assert.equal(worker(scene).node.classList.contains('is-terminal'), false);
  assert.doesNotMatch(worker(scene).statusNode.textContent, /passed/);
  assert.equal(typeof scene._workerState(provider, [], []).terminal, 'boolean');
  scene.update(input({ runs: [running()], activities: [activity({ basis: 'observed', terminal: true, status: 'completed' })] }));
  assert.equal(worker(scene).node.classList.contains('is-terminal'), false);
  assert.doesNotMatch(worker(scene).statusNode.textContent, /completed/);
  scene.update(input({ runs: [running({ state: 'passed' })], activities: [activity({ phase: 'research', at: now + 10 })] }));
  assert.equal(worker(scene).node.classList.contains('is-terminal'), true);
  assert.doesNotMatch(worker(scene).statusNode.textContent, /Agent-reported/);
});
