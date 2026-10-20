'use strict';

// These tests execute source scheduling/ownership logic against non-rendering
// driver doubles. They create no native window, GPU scene, image or provider.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createTestPerformance, keyOf } = require('../app/district/test-performance');
const probe = require('../evidence/showcase/gpu-probe.cjs');
const ROOT = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }

function worldFixture(options = {}) {
  const counters = { renders: 0, rendererDisposals: 0, forceLosses: 0, observerDisconnects: 0, nativeUnsubscribe: 0,
    resourceDisposals: 0, parsed: [], rendererCreated: 0, openingCreated: 0, openingDestroyed: 0, openingPoses: 0, testSamples: [],
    crewCreated: 0, crewDisposals: 0, crewSets: [] };
  let now = 1, nextFrame = 1, nativeVisibility;
  const frames = new Map(), observers = [];
  class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(event) { event.preventDefault ||= () => { event.defaultPrevented = true; }; for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event); }
    listenerCount() { return [...this.listeners.values()].reduce((count, set) => count + set.size, 0); }
  }
  class Vector {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    setScalar(value) { return this.set(value, value, value); }
    copy(other) { return this.set(other.x, other.y, other.z); }
    clone() { return new Vector(this.x, this.y, this.z); }
    lerp(other, t) { return this.lerpVectors(this, other, t); }
    lerpVectors(a, b, t) { return this.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }
    distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z); }
    multiplyScalar(value) { this.x *= value; this.y *= value; this.z *= value; return this; }
    add(other) { this.x += other.x; this.y += other.y; this.z += other.z; return this; }
    toArray() { return [this.x, this.y, this.z]; }
    project() { return this; }
  }
  class Quaternion {
    constructor() { this.values = [0, 0, 0, 1]; }
    copy(other) { this.values = [...other.values]; return this; }
    clone() { return new Quaternion().copy(this); }
    slerpQuaternions(a, b, t) { this.values = a.values.map((value, index) => value + (b.values[index] - value) * t); return this; }
  }
  class Group {
    constructor() { this.children = []; this.parent = null; this.position = new Vector(); this.scale = new Vector(1, 1, 1); this.rotation = new Vector(); this.quaternion = new Quaternion(); this.visible = true; }
    add(...nodes) { for (const node of nodes) { node.parent?.remove(node); node.parent = this; this.children.push(node); } }
    remove(node) { this.children = this.children.filter(child => child !== node); node.parent = null; }
    traverse(fn) { fn(this); for (const node of [...this.children]) node.traverse(fn); }
    getObjectByName(name) { if (this.name === name) return this; for (const child of this.children) { const found = child.getObjectByName(name); if (found) return found; } return undefined; }
    updateMatrixWorld() {}
  }
  function resource() { return { disposed: 0, dispose() { this.disposed++; counters.resourceDisposals++; } }; }
  function graph(name = '') {
    const group = new Group(); group.name = name;
    const mesh = new Group(); mesh.isMesh = true; mesh.geometry = resource(); mesh.material = resource(); group.add(mesh);
    return group;
  }
  class Camera extends Group { constructor(fov = 43) { super(); this.fov = fov; } lookAt() {} updateProjectionMatrix() {} getWorldDirection(vector) { return vector.set(0, 0, -1); } }
  class Color { set() { return this; } }
  class Light extends Group { constructor() { super(); this.color = new Color(); this.intensity = 1; this.shadow = { mapSize: { set() {} }, camera: {} }; } }
  const gl = {
    VERSION: 1, drawingBufferWidth: 1, drawingBufferHeight: 1,
    getExtension(name) { return name === 'WEBGL_debug_renderer_info' ? { UNMASKED_VENDOR_WEBGL: 2, UNMASKED_RENDERER_WEBGL: 3 } : null; },
    getParameter(key) { return key === 1 ? 'WebGL 2.0 Chromium' : key === 2 ? 'NVIDIA' : options.software ? 'SwiftShader software' : 'NVIDIA GeForce test driver'; },
  };
  class Element extends Events {
    constructor(tag) { super(); this.tagName = tag; this.children = []; this.dataset = {}; this.className = ''; this.parent = null; this.width = 1; this.height = 1;
      this.classList = { add() {}, remove() {} }; }
    appendChild(node) { node.parent = this; this.children.push(node); }
    prepend(node) { node.parent = this; this.children.unshift(node); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute() {}
    getContext() { return gl; }
    getBoundingClientRect() { return { width: 3840, height: 2160 }; }
  }
  const doc = new Events(); doc.hidden = false; doc.visibilityState = 'visible'; doc.createElement = tag => new Element(tag);
  const container = new Element('div'); container.clientWidth = 3840; container.clientHeight = 2160;
  const reduced = new Events(); reduced.matches = false;
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; counters.observerDisconnects++; }
  }
  class Renderer {
    constructor({ canvas }) { counters.rendererCreated++; this.canvas = canvas; this.shadowMap = {}; this.info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 3, textures: 2 }, reset() {} }; this.renderLists = { dispose() {} }; }
    getContext() { return gl; }
    setPixelRatio(value) { this.dpr = value; }
    setSize(width, height) { this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr); gl.drawingBufferWidth = this.canvas.width; gl.drawingBufferHeight = this.canvas.height; }
    setRenderTarget() {}
    render(_scene, camera) { counters.renders++; if (camera) counters.lastCamera = [camera.position.x, camera.position.y, camera.position.z]; this.info.render = { calls: options.overBudget ? 1201 : 5, triangles: 500 }; }
    dispose() { counters.rendererDisposals++; }
    forceContextLoss() { counters.forceLosses++; }
  }
  class Composer {
    constructor(renderer) { this.renderer = renderer; this.passes = []; }
    addPass(pass) { this.passes.push(pass); }
    render() { this.renderer.render(null, this.passes[0]?.camera); }
    setPixelRatio() {} setSize() {} dispose() {}
  }
  class Pass { constructor(_scene, camera) { this.camera = camera; } dispose() {} }
  class Room extends Group { dispose() {} }
  class PMREM { fromScene() { return { texture: {}, dispose() {} }; } dispose() {} }
  class Loader {
    async parseAsync() { const loaded = options.parseGate ? await options.parseGate.promise : graph('loaded'); counters.parsed.push(loaded); return { scene: loaded }; }
  }
  class LoadingManager { setURLModifier(fn) { this.modify = fn; } }
  const THREE = { Group, Scene: Group, Vector3: Vector, Vector2: Vector, Color, FogExp2: class {},
    PerspectiveCamera: Camera, OrthographicCamera: Camera, HemisphereLight: Light, DirectionalLight: Light, PointLight: Light,
    WebGLRenderer: Renderer, PMREMGenerator: PMREM, LoadingManager,
    MathUtils: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)), lerp: (a, b, t) => a + (b - a) * t,
      radToDeg: value => value * 180 / Math.PI,
      smoothstep(value, min, max) { const t = Math.max(0, Math.min(1, (value - min) / (max - min))); return t * t * (3 - 2 * t); } } };
  const window = { devicePixelRatio: 3, matchMedia: () => reduced, bus: {
    districtReadAsset: options.assetGate ? () => options.assetGate.promise : options.assets ? () => Promise.resolve(minimalGLB()) : () => Promise.reject(new Error('No asset needed for scheduling fixture')),
    onDistrictWindowVisibility(fn) { nativeVisibility = fn; return () => { counters.nativeUnsubscribe++; nativeVisibility = null; }; },
  } };
  const sandbox = { window, document: doc, THREE, GLTFLoader: Loader, EffectComposer: Composer, RenderPass: Pass, UnrealBloomPass: Pass,
    OutputPass: Pass, RoomEnvironment: Room, performanceState: { createTestPerformance }, routing: require('../app/district/showcase-routing'),
    testActor: () => ({ dispose() {}, sensor: { pose() {} } }), poseTestScene: ({ sample, hostGroup, camera }) => {
      counters.testSamples.push({ ...sample }); hostGroup.position.set(...sample.position); camera.position.set(-20, 6, 12); return { ...sample };
    },
    createRobotCrew: ({ template, scale }) => {
      counters.crewCreated++; counters.crewTemplate = template; counters.crewScale = scale;
      const root = graph('recording-robot-crew'); let disposed = false;
      return { root, set(records) { counters.crewSets.push(JSON.parse(JSON.stringify(records))); }, update() {},
        dispose() { if (!disposed) { disposed = true; counters.crewDisposals++; root.parent?.remove(root); } } };
    },
    createShowcaseOpening: ({ hostGroup, camera }) => {
      counters.openingCreated++; let destroyed = false;
      return { duration: 12, thrusters: { pose() {} }, setMood: () => ({ exposure: .8 }),
        pose(seconds) { counters.openingPoses++; hostGroup.position.set(5, .95 + seconds * .001, 12); camera.position.set(12 + seconds * .02, 7, 26);
          return { shotId: 'M01', lighting: { exposure: .8, welcome: 1 }, thrustPower: .1, sensorPose: { extension: 0, open: 0 }, camera: { position: camera.position.toArray() } }; },
        destroy() { if (!destroyed) { destroyed = true; counters.openingDestroyed++; } } };
    },
    performance: { now: () => now }, ResizeObserver: Observer, IntersectionObserver: Observer,
    CustomEvent: class { constructor(type, fields) { this.type = type; Object.assign(this, fields); } },
    requestAnimationFrame(fn) { const id = nextFrame++; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); },
    TextDecoder, ArrayBuffer, DataView, Uint8Array, atob: value => Buffer.from(value, 'base64').toString('binary'),
    __graph: graph, console };
  let source = fs.readFileSync(path.join(ROOT, 'app/district-3d/world-entry.js'), 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
  source += `\nproceduralDistrict=()=>__graph('world'); infrastructure=()=>({root:__graph('infrastructure'),update(){}});
    atmosphere=()=>({root:__graph('atmosphere'),update(){}}); demonstration=()=>({root:__graph('demo'),update(){}});
    worldWorkers=()=>({root:__graph('workers'),update(){},set(){}}); proceduralHost=()=>({root:__graph('host')});
    cylinder=()=>null; ring=()=>null; material=()=>({}); inspectAsset=()=>({textures:0,meshes:1,triangles:1});
    globalThis.sourceApi={mount,hardwareIdentity,validateEmbeddedGLB};`;
  vm.runInNewContext(source, sandbox, { filename: 'actual-world-entry-with-non-rendering-drivers.js', timeout: 2000 });
  const handle = sandbox.sourceApi.mount({ container, showcase: options.showcase === true });
  return { handle, counters, frames, observers, document: doc, reduced, gl, graph, container,
    canvas: () => container.children[0]?.children[0],
    step(milliseconds = 17) { now += milliseconds; const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(now); },
    native(visible) { nativeVisibility?.(visible); },
    async flush() { await tick(); await tick(); } };
}

function minimalGLB() {
  const json = Buffer.from('{"asset":{"version":"2.0"}}  ');
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const buffer = Buffer.alloc(20 + padded.length);
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12); buffer.writeUInt32LE(0x4e4f534a, 16); padded.copy(buffer, 20);
  return { base64: buffer.toString('base64') };
}

test('actual renderer schedules one RAF lane and pauses for DOM, native and intersection visibility', async t => {
  const f = worldFixture(); t.after(() => f.handle.destroy()); await f.flush();
  assert.equal(f.handle.getDiagnostics().ready, true);
  assert.equal(f.frames.size, 1);
  for (let i = 0; i < 5; i++) f.handle.setPaused(false);
  assert.equal(f.frames.size, 1, 'repeated snapshots cannot create duplicate animation loops');
  f.step(); const rendered = f.handle.getDiagnostics().renderedFrames;
  f.document.hidden = true; f.document.visibilityState = 'hidden'; f.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(f.frames.size, 0); f.step(); assert.equal(f.handle.getDiagnostics().renderedFrames, rendered);
  f.document.hidden = false; f.document.visibilityState = 'visible'; f.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(f.frames.size, 1);
  f.native(false); assert.equal(f.frames.size, 0); f.native(true); assert.equal(f.frames.size, 1);
  const intersection = f.observers[1]; intersection.callback([{ isIntersecting: false }]); assert.equal(f.frames.size, 0);
  intersection.callback([{ isIntersecting: true }]); assert.equal(f.frames.size, 1);
});

test('reduced motion settles the animation loop while explicit test-state updates remain drawable', async t => {
  const f = worldFixture(); t.after(() => f.handle.destroy()); await f.flush();
  f.reduced.matches = true; f.reduced.dispatchEvent({ type: 'change' });
  assert.equal(f.frames.size, 0);
  const before = f.handle.getDiagnostics().renderedFrames;
  f.handle.setTestRun({ id: 'r', projectId: 'p', state: 'running', steps: [{ name: 'One real check', state: 'running' }] });
  assert.equal(f.frames.size, 1); f.step();
  assert.equal(f.handle.getDiagnostics().renderedFrames, before + 1);
  assert.equal(f.frames.size, 0, 'one new state does not restart continuous motion');
});

test('reduced-motion activity and beat changes request a settled pose without restarting animation', async t => {
  const f = worldFixture(); t.after(() => f.handle.destroy()); await f.flush();
  f.reduced.matches = true; f.reduced.dispatchEvent({ type: 'change' });
  const before = [...f.counters.lastCamera];
  f.handle.setActivity({ state: 'testing', label: 'Observed named checks' });
  assert.equal(f.frames.size, 1, 'a newly observed state needs one static redraw'); f.step(); assert.equal(f.frames.size, 0);
  f.handle.setBeat('crew');
  assert.equal(f.frames.size, 1, 'a presentation change needs one static redraw'); f.step();
  assert.notDeepEqual(f.counters.lastCamera, before, 'reduced motion must settle at the requested shot instead of freezing its old transition');
  assert.equal(f.frames.size, 0);
});

test('context loss stops submission; restore rechecks hardware and software restore stays failed', async t => {
  const options = {}, f = worldFixture(options); t.after(() => f.handle.destroy()); await f.flush();
  const canvas = f.canvas(); const before = f.handle.getDiagnostics().renderedFrames;
  const lost = { type: 'webglcontextlost' }; canvas.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true); assert.equal(f.frames.size, 0);
  assert.equal(f.handle.getDiagnostics().contextLost, true); f.step(); assert.equal(f.handle.getDiagnostics().renderedFrames, before);
  canvas.dispatchEvent({ type: 'webglcontextrestored' }); assert.equal(f.frames.size, 1); f.step();
  assert.equal(f.handle.getDiagnostics().ready, true); assert.equal(f.handle.getDiagnostics().contextLost, false);
  canvas.dispatchEvent({ type: 'webglcontextlost' }); options.software = true;
  canvas.dispatchEvent({ type: 'webglcontextrestored' });
  assert.equal(f.frames.size, 0); assert.match(f.handle.getDiagnostics().error, /hardware/i);
});

test('destroy releases source-owned observers, listeners and resources and late public methods stay inert', async () => {
  const f = worldFixture(); await f.flush(); const canvas = f.canvas();
  f.handle.destroy(); f.handle.destroy();
  assert.equal(f.frames.size, 0); assert.equal(f.container.children.length, 0);
  assert.equal(f.counters.observerDisconnects, 2); assert.equal(f.counters.nativeUnsubscribe, 1);
  assert.equal(f.document.listenerCount(), 0); assert.equal(f.reduced.listenerCount(), 0); assert.equal(canvas.listenerCount(), 0);
  assert.equal(f.counters.rendererDisposals, 1); assert.equal(f.counters.forceLosses, 1); assert(f.counters.resourceDisposals > 0);
  const before = f.counters.renders;
  f.handle.setPaused(false); f.handle.setView('management'); f.handle.setActivity({ state: 'running' }); f.handle.setTestRun({ id: 'late', state: 'passed' }); f.step();
  assert.equal(f.counters.renders, before); assert.equal(f.frames.size, 0); assert.equal(f.handle.getDiagnostics().disposed, true);
});

test('late GLB parsing after unmount disposes returned graph without reviving renderer', async () => {
  const assetGate = deferred(), parseGate = deferred(), f = worldFixture({ assetGate, parseGate });
  assetGate.resolve(minimalGLB()); await f.flush();
  f.handle.destroy(); const before = f.counters.resourceDisposals;
  const late = f.graph('late-loaded'); parseGate.resolve(late); await f.flush();
  assert.equal(late.parent, null); assert(f.counters.resourceDisposals > before);
  assert.equal(f.frames.size, 0); assert.equal(f.container.children.length, 0); assert.equal(f.handle.getDiagnostics().disposed, true);
});

test('showcase caches one opening and a mid-opening run joins that same renderer without resetting elapsed time', async t => {
  const f = worldFixture({ showcase: true, assets: true }); t.after(() => f.handle.destroy()); await f.flush();
  for (let i = 0; i < 20; i++) f.step(50);
  const before = f.handle.getDiagnostics().showcase;
  assert(before?.elapsed > 0); assert.equal(f.counters.openingCreated, 1);
  const run = { id: 'r', projectId: 'p', created: 1, state: 'testing', source: { hash: 'A' }, checks: [{ name: 'Syntax', state: 'running' }] };
  for (let i = 0; i < 5; i++) f.handle.setShowcaseContext({ projectId: 'p', run });
  f.step(50); const after = f.handle.getDiagnostics().showcase;
  assert.equal(after.handoff, true); assert.equal(after.projectId, 'p'); assert.equal(after.runId, 'r');
  assert.equal(after.elapsed, before.elapsed, 'entering work does not rewind or replay the opening clock');
  assert.deepEqual(after.hostPosition, before.hostPosition, 'handoff begins at the last displayed host position');
  assert.deepEqual(after.camera.position, before.camera.position, 'handoff begins at the last displayed camera');
  assert.equal(f.counters.rendererCreated, 1); assert.equal(f.counters.openingCreated, 1);
  assert.equal(f.frames.size, 1);
  f.handle.destroy(); assert.equal(f.counters.openingDestroyed, 1);
});

test('showcase unavailable state freezes work pose and age, then resumes the same run without a new opening', async t => {
  const f = worldFixture({ showcase: true, assets: true }); t.after(() => f.handle.destroy()); await f.flush(); f.step(50);
  const run = { id: 'r', projectId: 'p', created: 1, state: 'testing', source: { hash: 'A' }, checks: [] };
  f.handle.setShowcaseContext({ projectId: 'p', run });
  for (let i = 0; i < 10; i++) f.step(50);
  const beforeDiagnostic = f.handle.getDiagnostics(), before = beforeDiagnostic.showcase;
  const posesBeforeUnknown = f.counters.testSamples.length;
  f.handle.setShowcaseContext({ projectId: 'p', run, unavailable: true });
  for (let i = 0; i < 10; i++) f.step(50);
  const unknown = f.handle.getDiagnostics();
  assert.equal(unknown.showcase.state, 'unknown'); assert.equal(unknown.testScene.age, beforeDiagnostic.testScene.age);
  assert.equal(f.counters.testSamples.length, posesBeforeUnknown, 'unknown work cannot advance the execution choreography');
  assert.equal(unknown.showcase.handoffAge, before.handoffAge);
  assert.deepEqual(unknown.showcase.hostPosition, before.hostPosition);
  assert(unknown.showcase.pullback >= before.pullback, 'the approved presentation pullback may continue while operational work stays frozen');
  assert(unknown.showcase.camera.position.every(Number.isFinite));
  f.handle.setShowcaseContext({ projectId: 'p', run }); f.step(50);
  assert.equal(f.handle.getDiagnostics().showcase.state, 'testing'); assert.equal(f.counters.openingCreated, 1);
});

test('switching showcase projects cannot acknowledge another project historical result', async t => {
  const f = worldFixture({ showcase: true, assets: true }); t.after(() => f.handle.destroy()); await f.flush(); f.step(50);
  f.handle.setShowcaseContext({ projectId: 'p1', run: { id: 'r1', projectId: 'p1', created: 1, state: 'running', checks: [] } });
  for (let i = 0; i < 20; i++) f.step(50);
  f.handle.setShowcaseContext({ projectId: 'p2', run: { id: 'r2', projectId: 'p2', created: 1, state: 'passed', artifact: { candidateHash: 'B' }, checks: [] } });
  f.step(50); const diagnostic = f.handle.getDiagnostics();
  assert.equal(diagnostic.showcase.projectId, 'p2'); assert.equal(diagnostic.showcase.runId, 'r2');
  assert.equal(diagnostic.testScene.live, false); assert.equal(diagnostic.testScene.reaction, null);
  assert.equal(f.counters.openingCreated, 1); assert.equal(f.counters.rendererCreated, 1);
});

test('the same single host pulls back continuously to isometric after the reveal without a view command or filler crew', async t => {
  const f = worldFixture({ showcase: true, assets: true }); t.after(() => f.handle.destroy()); await f.flush();
  assert.equal(f.handle.getDiagnostics().hostAsset, 'loaded', 'the new asset path must really complete in this fixture');
  assert.equal(f.handle.getDiagnostics().worldAsset, 'loaded');
  assert.equal(f.counters.crewCreated, 1, 'the imported crew adapter must be supplied rather than silently failing asset readiness');
  const destination = [60, 62, 58], samples = [];
  for (let frame = 0; frame < 380; frame++) {
    f.step(50);
    const diagnostic = f.handle.getDiagnostics();
    if (diagnostic.showcase?.overview) samples.push({ progress: diagnostic.showcase.pullback, position: [...f.counters.lastCamera] });
  }
  assert(samples.length > 50, 'observe a sequence of distinct pullback poses, not only its endpoint');
  assert(samples.some(sample => sample.progress > 0 && sample.progress < 1));
  const distance = position => Math.hypot(...position.map((value, index) => value - destination[index]));
  for (let index = 1; index < samples.length; index++) {
    assert(samples[index].progress >= samples[index - 1].progress, 'camera progress cannot rewind the reveal');
    assert(distance(samples[index].position) <= distance(samples[index - 1].position) + 1e-8, 'camera approaches the same authored overhead position');
    assert(Math.hypot(...samples[index].position.map((value, axis) => value - samples[index - 1].position[axis])) < 4,
      'camera samples must join continuously rather than cut to the overhead endpoint');
  }
  const final = f.handle.getDiagnostics();
  assert.equal(final.showcase.elapsed, 12); assert.equal(final.showcase.shotId, 'W02'); assert.equal(final.showcase.pullback, 1);
  assert.equal(final.camera.type, 'orthographic'); assert.deepEqual([...final.camera.position], destination);
  assert.equal(final.view, 'cinematic', 'automatic approved framing does not require an explicit management command');
  assert.equal(final.workerCount, 0); assert.equal(final.ambientTraffic.count, 0);
  assert(f.counters.crewSets.every(records => records.length === 0), 'presentation time alone cannot manufacture workers');
  assert.equal(f.counters.rendererCreated, 1); assert.equal(f.counters.openingCreated, 1); assert.equal(f.frames.size, 1);
});

test('only supplied run/session worker records reach the same-model crew; roster and scenery filler are excluded', async t => {
  const f = worldFixture({ showcase: true, assets: true }); t.after(() => f.handle.destroy()); await f.flush(); f.step(50);
  assert.equal(f.counters.crewScale, .65);
  const records = [
    { id: 'idle-provider', state: 'idle', available: true },
    { id: 'unlinked-roster', state: 'working', facility: 'research' },
    { id: 'decorative-traffic', scenery: true, state: 'traveling' },
    { id: 'linked-run', workerId: 'codex', projectId: 'project-actual', runId: 'run-actual', state: 'working', facility: 'build', basis: 'observed' },
    { id: 'linked-session', workerId: 'claude', sessionId: 'session-actual', state: 'working', facility: 'research', basis: 'reported' },
  ];
  f.handle.setWorkers(records); f.step(50);
  assert.equal(f.handle.getDiagnostics().workerCount, 2);
  assert.deepEqual(f.counters.crewSets.at(-1).map(record => record.id).sort(), ['linked-run', 'linked-session']);
  assert.deepEqual(Object.keys(f.handle.getLayout().workers).sort(), ['linked-run', 'linked-session']);
  const linked = f.counters.crewSets.at(-1).find(record => record.id === 'linked-run');
  assert.equal(linked.workerId, 'codex'); assert.equal(linked.basis, 'observed');
  f.handle.setWorkers([]); f.step(50);
  assert.equal(f.handle.getDiagnostics().workerCount, 0);
  assert.equal(f.counters.crewSets.at(-1).length, 0, 'removing real records cannot leave an ambient substitute');
  assert.equal(f.handle.getDiagnostics().ambientTraffic.count, 0);
  assert.equal(f.counters.rendererCreated, 1);
});

test('software backend and measured resource excess fail closed without an animation loop', async () => {
  const software = worldFixture({ software: true }); await software.flush();
  assert.equal(software.counters.rendererCreated, 0); assert.equal(software.frames.size, 0); assert.equal(software.handle.getDiagnostics().ready, false); software.handle.destroy();
  const excess = worldFixture({ overBudget: true }); await excess.flush();
  assert.equal(excess.frames.size, 0); assert.equal(excess.handle.getDiagnostics().ready, false); assert.match(excess.handle.getDiagnostics().error, /budget/); excess.handle.destroy();
});

test('test performance keeps project identities separate and historical results cannot celebrate', () => {
  const performance = createTestPerformance();
  const run = { id: 'same-run-id', projectId: 'p1', root: 'owned-one', state: 'running', created: 1, manifest: { 'index.html': 'A' }, steps: [] };
  performance.setRun(run);
  for (let i = 0; i < 130; i++) performance.sample(.1);
  performance.setRun({ ...run, projectId: 'p2', root: 'owned-two', state: 'passed' });
  assert.equal(performance.sample(.01).reaction, null);
  assert.equal(performance.sample(.01).live, false);
  performance.setRun({ ...run, state: 'running' }, { unavailable: true });
  assert.equal(performance.sample(.1).state, 'unknown');
});

test('test performance identity includes recipe candidate evidence, not only legacy smoke manifest', () => {
  const a = { id: 'same', projectId: 'p', created: 1, artifact: { candidateHash: 'A' }, source: { hash: 'A' } };
  const b = { ...a, artifact: { candidateHash: 'B' }, source: { hash: 'B' } };
  assert.notEqual(keyOf(a), keyOf(b), 'a changed recipe candidate must reset motion ownership and suppress stale result cues');
});

test('first artifact enrichment preserves live completion, while a changed known candidate does not celebrate', () => {
  const run = { id: 'live-recipe', projectId: 'p', created: 1, state: 'running', source: { hash: 'A' }, steps: [] };
  const performance = createTestPerformance(); performance.setRun(run);
  for (let i = 0; i < 130; i++) performance.sample(.1);
  const passed = { ...run, state: 'passed', artifact: { candidateHash: 'A' } };
  performance.setRun(passed);
  assert.equal(performance.sample(.01).reaction, 'relief', 'first artifact confirmation belongs to the already-followed run');
  for (let i = 0; i < 20; i++) performance.sample(.1);
  performance.setRun(passed);
  assert.equal(performance.sample(.01).reaction, null, 'repeated completed snapshots cannot replay acknowledgement');
  performance.setRun({ ...run, artifact: { candidateHash: 'A' } });
  for (let i = 0; i < 130; i++) performance.sample(.1);
  performance.setRun({ ...passed, source: { hash: 'B' }, artifact: { candidateHash: 'B' } });
  assert.equal(performance.sample(.01).reaction, null, 'different known candidate is a new inspection identity');
});

test('first artifact enrichment cannot hide a changed checkout commit or source manifest', () => {
  for (const changed of [{ sha: 'new-commit' }, { manifest: { 'index.html': 'different-source' } }]) {
    const performance = createTestPerformance();
    const run = { id: 'r', projectId: 'p', root: 'owned-root', created: 1, sha: 'old-commit', manifest: { 'index.html': 'original-source' }, state: 'running', steps: [] };
    performance.setRun(run); for (let i = 0; i < 130; i++) performance.sample(.1);
    performance.setRun({ ...run, ...changed, state: 'passed', artifact: { candidateHash: 'first-known-candidate' } });
    assert.equal(performance.sample(.01).reaction, null, 'candidate enrichment cannot retain motion ownership across changed checkout/source');
  }
});

test('probe helper rejects software, unknown resources and unbounded short samples without launching native apps', () => {
  assert.equal(probe.DISPLAY_ID, '3242010503');
  const sample = { renderedFrames: 100, maxFPS: 60, ready: true, dpr: 1, backbufferWidth: 1000, backbufferHeight: 600,
    drawCalls: 5, triangles: 500, memory: { geometries: 10, textures: 3 } };
  assert.equal(probe.frameVerdict(sample, { ...sample, renderedFrames: 160 }, 1000).state, 'passed');
  assert.equal(probe.frameVerdict(sample, { ...sample, renderedFrames: 300 }, 1000).state, 'failed');
  assert.equal(probe.frameVerdict(sample, { ...sample, renderedFrames: 100 }, 1000).state, 'failed');
  assert.equal(probe.resourceVerdict([sample, sample]).state, 'passed');
  assert.equal(probe.resourceVerdict([sample, { ...sample, memory: { geometries: 11, textures: 3 } }]).state, 'failed');
  assert.equal(probe.resourceVerdict([{}, {}]).state, 'failed');
  assert.equal(probe.hardwareVerdict({ context: { renderer: 'SwiftShader software' } }).state, 'failed');
});

test('probe source manifest changes with product bytes and a wrong frozen hash refuses native launch', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-manifest-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'app')); fs.writeFileSync(path.join(root, 'app', 'main.js'), 'first');
  const before = probe.sourceManifest(root);
  fs.writeFileSync(path.join(root, 'app', 'main.js'), 'changed');
  const after = probe.sourceManifest(root);
  assert.notEqual(before.digest, after.digest);
  assert.notEqual(before.files['app/main.js'], after.files['app/main.js']);
  const result = spawnSync(process.execPath, [path.join(ROOT, 'evidence/showcase/gpu-probe.cjs'), '--run', '--source-hash', '0'.repeat(64)],
    { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(result.status, 1); assert.match(result.stderr, /does not match current bytes; no app launched/);
});

test('borrowed lifecycle helper binds an explicit owned wrapper and rejects wrong app or shared data before GPU access', async t => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-owned-wrapper-'));
  t.after(() => fs.rmSync(data, { recursive: true, force: true }));
  const expectedUserData = path.join(data, 'user-data'), expectedAppPath = path.join(data, 'wrapper');
  const bounds = { x: 0, y: 0, width: 3840, height: 2160 };
  const metadata = { pid: 123, userData: expectedUserData, appPath: expectedAppPath,
    paths: { database: path.join(data, 'bus.sqlite'), workRoot: path.join(data, 'projects'), connection: path.join(data, 'connection.json') },
    displays: [{ id: probe.DISPLAY_ID, workArea: bounds, nativeSize: { width: 3840, height: 2160 } }],
    windows: [{ id: 1, displayId: probe.DISPLAY_ID, bounds }] };
  const application = { process: () => ({ pid: 123 }), evaluate: async () => metadata };
  let pageCalls = 0;
  const page = { async waitForFunction() { pageCalls++; throw new Error('Owned metadata accepted before GPU access'); } };
  await assert.rejects(probe.collectLifecycle({ application, page, expectedUserData }), /exact owned/);
  assert.equal(pageCalls, 0, 'unrelated app path cannot reach a world canvas');
  await assert.rejects(probe.collectLifecycle({ application, page, expectedUserData, expectedAppPath }), /Owned metadata accepted/);
  assert.equal(pageCalls, 1);
  metadata.paths.database = path.join(ROOT, 'bus.sqlite');
  await assert.rejects(probe.collectLifecycle({ application, page, expectedUserData, expectedAppPath }), /exact owned/);
  assert.equal(pageCalls, 1, 'a shared database path cannot reach a world canvas');
});
