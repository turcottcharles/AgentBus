'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { DisplayManager, REGIONS } = require('../app/district/displays');
const { Workspaces } = require('../app/district/workspaces');

const TARGET = '3242010503', PRIMARY = '4060505759';
const candidateHash = 'a'.repeat(64);
const previewFor = (projectId = 'project-a', token = 'b'.repeat(48)) => ({ id: `preview-${projectId}`, projectId,
  runId: `run-${projectId}`, candidateHash, url: `http://127.0.0.1:47889/${token}/index.html`, nonce: 'fixture' });

function fixture(t, options = {}) {
  let displays = [
    { id: Number(TARGET), label: 'Monitor 1', bounds: { x: -1536, y: 0, width: 1536, height: 864 },
      workArea: { x: -1536, y: 0, width: 1536, height: 824 }, scaleFactor: 2.5 },
    { id: Number(PRIMARY), label: 'Monitor 2', bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 },
  ];
  const created = [];
  class FakeWindow extends EventEmitter {
    constructor(settings) {
      super(); this.options = settings; this.id = created.length + 1; this.bounds = { x: settings.x, y: settings.y, width: settings.width, height: settings.height };
      this.destroyed = false; this.inactiveShows = 0; this.focusCalls = 0; this.loads = []; this.boundsCalls = []; this.hideCalls = 0;
      const contents = this.webContents = new EventEmitter();
      const session = contents.session = new EventEmitter();
      session.setPermissionCheckHandler = (handler) => { session.permissionCheck = handler; };
      session.setPermissionRequestHandler = (handler) => { session.permissionRequest = handler; };
      session.webRequest = { onBeforeRequest: (_filter, handler) => { session.beforeRequest = handler; } };
      contents.setWindowOpenHandler = (handler) => { contents.openHandler = handler; };
      contents.getURL = () => this.url;
      this.mainWorldCalls = 0;
      contents.executeJavaScript = () => {
        this.mainWorldCalls++;
        throw new Error('Checks must never execute in the untrusted main world.');
      };
      contents.executeJavaScriptInIsolatedWorld = (worldId, scripts, userGesture) => {
        assert.equal(worldId, 1001);
        assert.equal(scripts.length, 1);
        const source = scripts[0].code;
        this.executed = { source, worldId, scripts, userGesture };
        return options.execute ? options.execute(this, source) : Promise.reject(new Error('This fixture has no renderer.'));
      };
      if (options.noIsolatedApi) delete contents.executeJavaScriptInIsolatedWorld;
      created.push(this);
    }
    setMenu(menu) { this.menu = menu; }
    setBounds(bounds) {
      this.boundsCalls.push({ ...bounds });
      this.bounds = options.adjustBounds ? options.adjustBounds(bounds, this.boundsCalls.length) : options.misplace ? { ...bounds, x: 0 } : { ...bounds };
    }
    setMinimumSize(width, height) { this.minimum = { width, height }; }
    getBounds() { return { ...this.bounds }; }
    loadURL(url) { this.url = url; this.loads.push(url); return options.load ? options.load(this, url) : Promise.resolve(); }
    showInactive() { this.inactiveShows++; }
    hide() { this.hideCalls++; }
    focus() { this.focusCalls++; }
    isDestroyed() { return this.destroyed; }
    destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('closed'); } }
  }
  const screen = {
    getAllDisplays: () => structuredClone(displays),
    getPrimaryDisplay: () => structuredClone(displays.find((display) => String(display.id) === PRIMARY) || displays[0]),
    getDisplayMatching: (bounds) => displays.find((display) => bounds.x >= display.bounds.x &&
      bounds.x + bounds.width <= display.bounds.x + display.bounds.width) || displays[0],
  };
  const manager = new DisplayManager({ screen, BrowserWindow: FakeWindow, defaultDisplayId: options.noDefault ? null : TARGET });
  t.after(() => manager.close());
  return { manager, created, FakeWindow, screen, setDisplays(value) { displays = value; }, displays };
}

function event(url) { return { url, prevented: false, preventDefault() { this.prevented = true; } }; }

test('display inventory preserves IDs and logical geometry while labels identify native 4K pixels', (t) => {
  const { manager } = fixture(t);
  const displays = manager.list();
  assert.equal(displays.length, 2);
  assert.equal(displays[0].id, TARGET);
  assert.equal(displays[0].primary, false);
  assert.deepEqual(displays[0].nativeSize, { width: 3840, height: 2160 });
  assert.match(displays[0].name, /3840×2160 px/);
  assert.match(displays[0].name, /1536×864 logical, 2.5×/);
  assert.equal(displays[1].primary, true);
  displays[0].bounds.x = 999;
  assert.equal(manager.list()[0].bounds.x, -1536);
});

test('missing or unselected monitor rejects explicitly and never creates a primary-display window', async (t) => {
  const { manager, created } = fixture(t, { noDefault: true });
  await assert.rejects(manager.open({ preview: previewFor(), projectId: 'project-a', displayId: 'not-connected' }), (error) => {
    assert.equal(error.code, 'DISPLAY_NOT_FOUND'); assert.equal(error.fallback, false);
    assert.equal(error.availableDisplays.length, 2); return true;
  });
  await assert.rejects(manager.open({ preview: previewFor(), projectId: 'project-a' }), { code: 'DISPLAY_SELECTION_REQUIRED' });
  const checks = await manager.runChecks({ preview: previewFor(), projectId: 'project-a', displayId: 'not-connected' });
  assert.equal(checks.state, 'failed'); assert.equal(checks.errorCode, 'DISPLAY_NOT_FOUND');
  assert.equal(checks.fallback, false); assert.equal(checks.display, null);
  assert.equal(created.length, 0);
});

test('owned sandbox window stays on requested area, shows inactive, and denies escape/permissions/downloads', async (t) => {
  const { manager } = fixture(t);
  const preview = previewFor();
  const window = await manager.open({ preview, projectId: preview.projectId, region: 'left-third' });
  assert.deepEqual(window.getBounds(), { x: -1536, y: 0, width: 512, height: 824 });
  assert.equal(window.minimum.width, 320);
  assert.equal(window.inactiveShows, 1); assert.equal(window.focusCalls, 0);
  assert.equal(window.options.show, false);
  const settings = window.options.webPreferences;
  assert.equal(settings.sandbox, true); assert.equal(settings.contextIsolation, true);
  assert.equal(settings.nodeIntegration, false); assert.equal(settings.nodeIntegrationInWorker, false);
  assert.equal(settings.nodeIntegrationInSubFrames, false); assert.equal(settings.webviewTag, false);
  assert.equal(settings.preload, undefined); assert.equal(settings.webSecurity, true);
  assert(!settings.partition.startsWith('persist:'));
  const contents = window.webContents, session = contents.session;
  assert.deepEqual(contents.openHandler({ url: 'https://example.com' }), { action: 'deny' });
  assert.equal(session.permissionCheck(null, 'media'), false);
  session.permissionRequest(contents, 'geolocation', (granted) => assert.equal(granted, false));
  for (const name of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
    for (const url of ['https://example.com/', 'file:///C:/secret.txt', 'javascript:alert(1)',
      `http://127.0.0.1:47889/${'c'.repeat(48)}/index.html`, preview.url.replace('index.html', '%2e%2e/secret.txt')]) {
      const blocked = event(url); contents.emit(name, blocked); assert.equal(blocked.prevented, true, `${name}: ${url}`);
    }
    const allowed = event(preview.url.replace('index.html', 'other.html')); contents.emit(name, allowed); assert.equal(allowed.prevented, false);
  }
  const oldSignature = event(); contents.emit('will-navigate', oldSignature, 'https://example.com/'); assert.equal(oldSignature.prevented, true);
  const download = event(); session.emit('will-download', download); assert.equal(download.prevented, true);
  session.beforeRequest({ url: 'https://example.com/tracker.js' }, ({ cancel }) => assert.equal(cancel, true));
  session.beforeRequest({ url: preview.url.replace('index.html', 'styles.css') }, ({ cancel }) => assert.equal(cancel, false));
  assert.equal(window.districtDisplay.requestedRegion, 'left-third');
  assert.equal(window.districtDisplay.candidateHash, candidateHash);
});

test('all region edges cover odd-width work areas with no overlap or lost remainder', async (t) => {
  const f = fixture(t);
  f.displays[0].bounds.width = 1537; f.displays[0].workArea.width = 1537;
  f.setDisplays(f.displays);
  const thirds = [];
  for (const [index, region] of ['left-third', 'middle-third', 'right-third'].entries()) {
    const projectId = `third-${index}`;
    const window = await f.manager.open({ preview: previewFor(projectId), projectId, region });
    thirds.push(window.getBounds());
  }
  assert.equal(thirds[0].x, -1536);
  assert.equal(thirds[0].x + thirds[0].width, thirds[1].x);
  assert.equal(thirds[1].x + thirds[1].width, thirds[2].x);
  assert.equal(thirds.reduce((sum, bounds) => sum + bounds.width, 0), 1537);
  assert.equal(thirds[2].x + thirds[2].width, 1);
  const left = await f.manager.open({ preview: previewFor('left'), projectId: 'left', region: 'left-half' });
  const right = await f.manager.open({ preview: previewFor('right'), projectId: 'right', region: 'right-half' });
  assert.equal(left.bounds.x + left.bounds.width, right.bounds.x);
  assert.equal(left.bounds.width + right.bounds.width, 1537);
  assert.equal(REGIONS.length, 10);
  await assert.rejects(f.manager.open({ preview: previewFor(), projectId: 'project-a', region: 'virtual-monitor-3' }), { code: 'REGION_INVALID' });
});

test('same project reuses one window with current URL guards; different projects keep separate areas and sessions', async (t) => {
  const { manager, created } = fixture(t);
  const a = previewFor(), b = previewFor('project-b');
  const left = await manager.open({ preview: a, projectId: a.projectId, region: 'left-third' });
  const middle = await manager.open({ preview: b, projectId: b.projectId, region: 'middle-third' });
  assert.notEqual(left.id, middle.id); assert.notEqual(left.options.webPreferences.partition, middle.options.webPreferences.partition);
  assert.equal(left.bounds.x + left.bounds.width, middle.bounds.x);
  const replacement = { ...previewFor(a.projectId, 'd'.repeat(48)), id: 'replacement', runId: 'run-replacement' };
  const reused = await manager.open({ preview: replacement, projectId: a.projectId, region: 'right-third' });
  assert.equal(reused, left); assert.equal(created.length, 2);
  const stale = event(a.url); reused.webContents.emit('will-navigate', stale); assert.equal(stale.prevented, true);
  const current = event(replacement.url); reused.webContents.emit('will-navigate', current); assert.equal(current.prevented, false);
  assert.equal(middle.isDestroyed(), false);
});

test('quadrants and custom rectangles use shared logical geometry and reject outside or too-small custom areas', async (t) => {
  const { manager, created } = fixture(t);
  const top = await manager.open({ preview: previewFor('top'), projectId: 'top', region: 'top-left' });
  const bottom = await manager.open({ preview: previewFor('bottom'), projectId: 'bottom', region: 'bottom-right' });
  assert.deepEqual(top.getBounds(), { x: -1536, y: 0, width: 768, height: 412 });
  assert.deepEqual(bottom.getBounds(), { x: -768, y: 412, width: 768, height: 412 });
  const custom = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
  const window = await manager.open({ preview: previewFor(), projectId: 'project-a', region: 'custom', regionBounds: custom });
  assert.deepEqual(window.getBounds(), { x: -1152, y: 206, width: 768, height: 412 });
  assert.deepEqual(window.districtDisplay.regionBounds, custom);
  custom.x = 0;
  assert.equal(window.districtDisplay.regionBounds.x, 0.25, 'saved geometry is a copy');
  for (const regionBounds of [undefined, { x: 0.9, y: 0, width: 0.4, height: 0.5 }, { x: NaN, y: 0, width: 0.5, height: 0.5 }]) {
    await assert.rejects(manager.open({ preview: previewFor(), projectId: 'project-a', region: 'custom', regionBounds }), { code: 'REGION_INVALID' });
  }
  await assert.rejects(manager.open({ preview: previewFor(), projectId: 'project-a', region: 'custom',
    regionBounds: { x: 0, y: 0, width: 0.1, height: 0.5 } }), { code: 'REGION_TOO_SMALL' });
  assert.equal(created.length, 3);
  assert.deepEqual(window.getBounds(), { x: -1152, y: 206, width: 768, height: 412 }, 'invalid update cannot move a prior window');
});

test('different projects load in parallel while same-project operations serialize', async (t) => {
  let release, announce;
  const started = new Promise((resolve) => { announce = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const { manager } = fixture(t, { load: (window) => { if (window.id === 1) { announce(); return gate; } return Promise.resolve(); } });
  t.after(release);
  const a = manager.open({ preview: previewFor(), projectId: 'project-a', region: 'left-third' });
  await started;
  const b = await manager.open({ preview: previewFor('project-b'), projectId: 'project-b', region: 'middle-third' });
  assert.equal(b.id, 2); release(); assert.equal((await a).id, 1);
});

test('closing a project cancels its active and queued opens without reopening an old request', async (t) => {
  let release, announce;
  const started = new Promise((resolve) => { announce = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const { manager, created } = fixture(t, { load: (window) => { if (window.id === 1) { announce(); return gate; } return Promise.resolve(); } });
  t.after(release);
  const active = manager.open({ preview: previewFor(), projectId: 'project-a' });
  await started;
  const queued = manager.open({ preview: previewFor('project-a', 'd'.repeat(48)), projectId: 'project-a' });
  manager.close('project-a'); release();
  await assert.rejects(active, { code: 'CANCELLED' });
  await assert.rejects(queued, { code: 'CANCELLED' });
  assert.equal(created.length, 1); assert.equal(created[0].isDestroyed(), true);
  const later = await manager.open({ preview: previewFor(), projectId: 'project-a' });
  assert.equal(later.id, 2);
});

test('wrong project, arbitrary URL and misplaced native window fail without silent fallback', async (t) => {
  const { manager, created } = fixture(t, { misplace: true });
  await assert.rejects(manager.open({ preview: previewFor(), projectId: 'someone-else' }), { code: 'PREVIEW_PROJECT_MISMATCH' });
  for (const url of ['https://example.com/', 'http://localhost:47889/private/index.html', 'file:///C:/index.html', 'http://127.0.0.1:47889/index.html']) {
    await assert.rejects(manager.open({ preview: { ...previewFor(), url }, projectId: 'project-a' }), { code: 'PREVIEW_INVALID' });
  }
  assert.equal(created.length, 0);
  await assert.rejects(manager.open({ preview: previewFor(), projectId: 'project-a' }), { code: 'DISPLAY_PLACEMENT_FAILED' });
  assert.equal(created[0].isDestroyed(), true); assert.equal(created[0].inactiveShows, 0);
});

test('unresponsive one-pixel native overspill stays rejected with complete measured placement diagnostics', async (t) => {
  const { manager, created } = fixture(t, { adjustBounds: (bounds) => ({ ...bounds, width: 769 }) });
  const regionBounds = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
  const options = { preview: previewFor(), projectId: 'project-a', region: 'custom', regionBounds };
  await assert.rejects(manager.open(options), (error) => {
    assert.equal(error.code, 'DISPLAY_PLACEMENT_FAILED');
    assert.equal(error.fallback, false);
    assert.deepEqual(error.requestedBounds, { x: -1152, y: 206, width: 768, height: 412 });
    assert.deepEqual(error.actualBounds, { x: -1152, y: 206, width: 769, height: 412 });
    assert.deepEqual(error.placement.delta, { x: 0, y: 0, width: 1, height: 0 });
    assert.deepEqual(error.placement.overflow, { left: 0, top: 0, right: 1, bottom: 0 });
    assert.equal(error.placement.units, 'logical/DIP');
    assert.equal(error.placement.scaleFactor, 2.5);
    assert.equal(error.placement.withinWorkArea, true);
    assert.equal(error.placement.withinRequestedRegion, false);
    assert.equal(error.placement.exactRequestedBounds, false);
    assert.equal(error.placement.correctionReason, 'did-not-converge');
    assert.equal(error.placement.attempts.length, 4);
    assert.deepEqual(JSON.parse(error.message.split('Placement: ')[1]), error.placement, 'IPC error text preserves measurements');
    return true;
  });
  const result = await manager.runChecks(options);
  assert.equal(result.state, 'failed');
  assert.equal(result.errorCode, 'DISPLAY_PLACEMENT_FAILED');
  assert.equal(result.placement.overflow.right, 1);
  assert.deepEqual(result.placement.regionBounds, regionBounds);
  assert.equal(created.length, 2);
  assert(created.every((window) => window.isDestroyed() && !window.inactiveShows && !window.executed));
});

test('measured fixed Windows width drift converges to the exact requested custom outer bounds', async (t) => {
  const { manager } = fixture(t, { adjustBounds: (bounds) => ({ ...bounds, width: bounds.width + 2 }) });
  const regionBounds = { x: 77 / 1536, y: 86 / 824, width: 768 / 1536, height: 562 / 824 };
  const expected = { x: -1459, y: 86, width: 768, height: 562 };
  const window = await manager.open({ preview: previewFor(), projectId: 'project-a', region: 'custom', regionBounds });
  assert.deepEqual(window.getBounds(), expected);
  assert.deepEqual(window.boundsCalls, [expected, { ...expected, width: 766 }]);
  assert.deepEqual(window.districtDisplay.requestedBounds, expected);
  assert.deepEqual(window.districtDisplay.effectiveBounds, expected);
  assert.deepEqual(window.districtDisplay.actualBounds, expected);
  assert.equal(window.districtDisplay.placementAttempts.length, 2);
  assert.equal(window.districtDisplay.placementAttempts[0].actualBounds.width, 770);
  assert.equal(window.districtDisplay.placementAttempts[1].commandBounds.width, 766);
  assert.equal(window.districtDisplay.placementAttempts[1].actualBounds.width, 768);
  assert.equal(window.hideCalls, 1);
  assert.equal(window.inactiveShows, 1);
  assert.equal(window.focusCalls, 0);
});

test('large or wrong-display drift cannot trigger unbounded geometry correction', async (t) => {
  const { manager, created } = fixture(t, { adjustBounds: (bounds) => ({ ...bounds, width: bounds.width + 20 }) });
  await assert.rejects(manager.open({ preview: previewFor(), projectId: 'project-a', region: 'custom',
    regionBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }), (error) => {
    assert.equal(error.code, 'DISPLAY_PLACEMENT_FAILED');
    assert.equal(error.placement.correctionReason, 'correction-exceeds-bound');
    assert.equal(error.placement.attempts.length, 1);
    assert.equal(error.fallback, false);
    return true;
  });
  assert.equal(created[0].boundsCalls.length, 1);
  assert.equal(created[0].isDestroyed(), true);
  assert.equal(created[0].inactiveShows, 0);
});

test('cancellation closes only its owned check window and cannot report passed', async (t) => {
  let announce;
  const started = new Promise((resolve) => { announce = resolve; });
  const { manager, created } = fixture(t, { execute: () => { announce(); return new Promise(() => {}); } });
  const b = await manager.open({ preview: previewFor('project-b'), projectId: 'project-b', region: 'middle-third' });
  const controller = new AbortController();
  const pending = manager.runChecks({ preview: previewFor(), projectId: 'project-a', region: 'left-third', signal: controller.signal });
  await started; controller.abort();
  const result = await pending;
  assert.equal(result.state, 'cancelled'); assert.equal(result.exitCode, null);
  assert.equal(result.errorCode, 'CANCELLED'); assert.equal(created[1].isDestroyed(), true);
  assert.equal(b.isDestroyed(), false);
  assert.equal(result.requestedRegion, 'left-third'); assert.equal(result.effectiveBounds.width, 512);
});

test('a stalled renderer times out, closes its window and exposes failure rather than false completion', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let announce;
  const started = new Promise((resolve) => { announce = resolve; });
  const { manager, created } = fixture(t, { execute: () => { announce(); return new Promise(() => {}); } });
  const pending = manager.runChecks({ preview: previewFor(), projectId: 'project-a' });
  await started; t.mock.timers.tick(10001);
  const result = await pending;
  assert.equal(result.state, 'failed'); assert.equal(result.exitCode, 1); assert.equal(result.errorCode, 'TIMED_OUT');
  assert.equal(created[0].isDestroyed(), true);
});

function starter(t, starterId = 'checklist') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-display-fixture-'));
  const data = new Map();
  const store = { get: (kind, id) => data.get(`${kind}:${id}`), put: (kind, row) => data.set(`${kind}:${row.id}`, row),
    list: (kind) => [...data.entries()].filter(([key]) => key.startsWith(`${kind}:`)).map(([, row]) => row) };
  const workspaces = new Workspaces({ root: path.join(temp, 'projects'), store });
  const project = workspaces.create({ name: 'Visual checks fixture', starterId });
  t.after(() => {
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir())); assert.match(path.basename(temp), /^agent-bus-display-fixture-/);
    fs.rmSync(temp, { recursive: true, force: true });
  });
  return { project, script: workspaces.read(project.id, 'script.js'), styles: workspaces.read(project.id, 'styles.css') };
}

// A fixture DOM exercises the fixed renderer script against the real starter
// model. This is source-level behavior evidence; it is not a real Electron run.
function page(script, url) {
  const ids = new Map();
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.handlers = {}; this.attributes = {}; this._text = ''; this.value = ''; this.className = ''; this.checked = false; }
    set textContent(value) { this._text = String(value); }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
    dispatchEvent(event) { for (const handler of this.handlers[event.type] || []) handler(event); }
    focus() {}
    click() {
      if (this.type === 'checkbox') { this.checked = !this.checked; this.dispatchEvent({ type: 'change' }); }
      else if (this === ids.get('add-task')) ids.get('task-form').dispatchEvent({ type: 'submit', preventDefault() {} });
      else this.dispatchEvent({ type: 'click' });
    }
    get classList() { return { contains: (value) => this.className.split(/\s+/).includes(value) }; }
    querySelectorAll(selector) {
      const all = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
      return all.filter((child) => selector === '*' || selector === 'span' && child.tagName === 'SPAN');
    }
    querySelector(selector) {
      return this.querySelectorAll('*').find((child) => selector === 'input[type="checkbox"]' ? child.tagName === 'INPUT' && child.type === 'checkbox' :
        selector === '.task-text' ? child.className === 'task-text' : child.tagName === 'BUTTON' && child.className === 'remove-task') || null;
    }
  }
  for (const [id, tag] of [['task-form', 'form'], ['task-input', 'input'], ['add-task', 'button'], ['task-list', 'ul'], ['task-status', 'p'], ['empty-state', 'p']]) ids.set(id, new Element(tag));
  const makeDocument = () => ({ getElementById: (id) => ids.get(id), createElement: (tag) => new Element(tag),
    querySelector: (selector) => ids.get(/data-testid="([^"]+)"/.exec(selector)?.[1]) || null });
  const globals = { location: { href: url }, Event: class { constructor(type, settings) { this.type = type; Object.assign(this, settings); } },
    requestAnimationFrame: (callback) => queueMicrotask(callback), getComputedStyle: (element) => ({ textDecorationLine: element.parent.classList.contains('is-complete') ? 'line-through' : 'none' }) };
  const mainWorld = vm.createContext({ ...globals, document: makeDocument() });
  vm.runInContext(script, mainWorld, { timeout: 1000 });
  // Separate wrappers/intrinsics share backing DOM state and the actual event
  // handlers registered by the starter. No main-world driver fallback exists.
  const isolatedWorld = vm.createContext({ ...globals, document: makeDocument() });
  return { ids, execute: (source) => vm.runInContext(source, isolatedWorld, { timeout: 1000 }),
    mainExecute: (source) => vm.runInContext(source, mainWorld, { timeout: 1000 }) };
}

for (const breakKind of ['none', 'add', 'complete', 'remove']) {
  test(`fixed browser interactions consume the actual starter script and detect ${breakKind === 'none' ? 'working behavior' : `a planted ${breakKind} defect`}`, async (t) => {
    const { project, script } = starter(t);
    const replacements = {
      add: ['tasks.push({ id: nextId++, text, done: false });', '/* planted: no task addition */'],
      complete: ['task.done = checkbox.checked;', 'task.done = false;'],
      remove: ['tasks = tasks.filter((entry) => entry.id !== task.id);', 'tasks = tasks;'],
    };
    const changed = breakKind === 'none' ? script : script.replace(...replacements[breakKind]);
    if (breakKind !== 'none') assert.notEqual(changed, script, 'the actual code defect was planted');
    const preview = previewFor(project.id);
    let renderer;
    const { manager, created } = fixture(t, { load: (_window, url) => { renderer = page(changed, url); return Promise.resolve(); },
      adjustBounds: breakKind === 'none' ? (bounds) => ({ ...bounds, width: bounds.width + 2 }) : undefined,
      execute: (_window, source) => renderer.execute(source) });
    const region = breakKind === 'none' ? 'custom' : 'middle-third';
    const customBounds = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const result = await manager.runChecks({ preview, projectId: project.id, region, regionBounds: customBounds });
    assert.equal(result.state, breakKind === 'none' ? 'passed' : 'failed', JSON.stringify(result));
    assert.equal(result.contractId, 'checklist');
    assert.equal(result.exitCode, breakKind === 'none' ? 0 : 1);
    assert.equal(result.requestedRegion, region); assert.equal(result.effectiveBounds.width, breakKind === 'none' ? 768 : 512);
    if (breakKind === 'none') assert.deepEqual(result.regionBounds, customBounds);
    assert.equal(result.display.id, TARGET); assert.equal(result.candidateHash, candidateHash);
    assert.equal(result.checks.length, 5);
    assert.equal(created[0].executed.userGesture, false);
    assert.equal(created[0].executed.worldId, 1001);
    assert.equal(created[0].mainWorldCalls, 0);
    assert(!created[0].executed.source.includes('require('));
    if (breakKind !== 'none') assert.equal(result.checks.find((check) => check.name === ({ add: 'Add two tasks', complete: 'Complete a task', remove: 'Remove a task' })[breakKind]).state, 'failed');
  });
}

test('app overrides in the main world cannot replace the isolated driver DOM wrappers or intrinsics', async (t) => {
  const { project, script } = starter(t);
  let renderer;
  const { manager, created } = fixture(t, {
    load: (_window, url) => {
      renderer = page(script, url);
      renderer.mainExecute(`
        Array.from = () => { throw new Error('untrusted Array.from override'); };
        document.querySelector = () => { throw new Error('untrusted DOM wrapper override'); };
        requestAnimationFrame = () => { throw new Error('untrusted scheduling override'); };
      `);
      return Promise.resolve();
    },
    execute: (_window, source) => renderer.execute(source),
  });
  const result = await manager.runChecks({ preview: previewFor(project.id), projectId: project.id });
  assert.equal(result.state, 'passed', JSON.stringify(result));
  assert.equal(result.checks.length, 5);
  assert.equal(created[0].executed.worldId, 1001);
  assert.equal(created[0].mainWorldCalls, 0);
  assert.equal(renderer.ids.get('task-list').children.length, 1, 'real app handlers added, completed and removed the selected task');
});

test('an unavailable isolated renderer API fails closed with no main-world fallback', async (t) => {
  const { manager, created } = fixture(t, { noIsolatedApi: true });
  const result = await manager.runChecks({ preview: previewFor(), projectId: 'project-a' });
  assert.equal(result.state, 'failed');
  assert.equal(result.exitCode, 1);
  assert.equal(result.errorCode, 'ISOLATED_WORLD_UNAVAILABLE');
  assert.equal(created[0].mainWorldCalls, 0);
  assert.equal(created[0].isDestroyed(), true);
});

test('unknown browser contracts reject before any window or renderer is created', async (t) => {
  const { manager, created } = fixture(t);
  for (const contractId of ['', null, 'rally', '__proto__', {}, ['checklist']]) {
    const result = await manager.runChecks({ preview: previewFor(), projectId: 'project-a', contractId });
    assert.equal(result.state, 'failed'); assert.equal(result.exitCode, 1);
    assert.equal(result.errorCode, 'CONTRACT_INVALID');
    assert.equal(result.checks[0].name, 'Browser contract');
  }
  assert.equal(created.length, 0);
});

function rallyPage(script, styles, url) {
  let document;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.ownerDocument = document; this.children = [];
      this.dataset = {}; this.attributes = {}; this.handlers = {}; this._text = ''; this.className = ''; this.value = ''; this.style = {}; this.hidden = false;
    }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    set textContent(value) { this._text = String(value); }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return key.startsWith('data-') ? this.dataset[key.slice(5)] ?? null : this.attributes[key] ?? null; }
    addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
    removeEventListener(type, handler) { this.handlers[type] = (this.handlers[type] || []).filter((candidate) => candidate !== handler); }
    dispatchEvent(event) { for (const handler of this.handlers[event.type] || []) handler(event); }
    click() { this.dispatchEvent({ type: 'click' }); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
    get parentElement() { return this.parent || null; }
    get isConnected() { return this === body || !!this.parent?.isConnected && this.parent.children.includes(this); }
    getClientRects() {
      for (let element = this; element; element = element.parentElement) if (element.hidden || element.style.display === 'none') return [];
      return this.isConnected ? [{ x: 0, y: 0, width: parseFloat(this.style.width || '200'), height: parseFloat(this.style.height || '40') }] : [];
    }
    querySelectorAll(selector) {
      const descendants = this.children.flatMap((child) => [child, ...child.all()]);
      const selectors = selector.split(',').map((entry) => entry.trim());
      return descendants.filter((child) => selectors.some((entry) => {
        const testId = /^\[data-testid="([^"]+)"\]$/.exec(entry)?.[1];
        if (testId) return child.dataset.testid === testId;
        if (entry === 'section.district-attract-demo') return child.tagName === 'SECTION' && child.className === 'district-attract-demo';
        if (entry === '[role="heading"]') return child.getAttribute('role') === 'heading';
        if (['h1', 'h2'].includes(entry)) return child.tagName === entry.toUpperCase();
        return entry.startsWith('.') && child.className.split(/\s+/).includes(entry.slice(1));
      }));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    all() { return this.children.flatMap((child) => [child, ...child.all()]); }
  }
  const body = new Element('body');
  const makeDocument = () => ({ readyState: 'complete', createElement: (tag) => new Element(tag),
    querySelector: (selector) => selector === '[data-neon-rally-app]' ? body : body.querySelector(selector),
    querySelectorAll: (selector) => selector === '[data-neon-rally-app]' ? [body] : body.querySelectorAll(selector) });
  document = makeDocument(); body.ownerDocument = document;
  // This small style fixture reads the actual component's custom-property
  // rules. Real CSS layout/painting remains the native Electron acceptance.
  const shells = new Map();
  let coloredSurface = false;
  const pattern = /\.district-attract-demo(?:\[data-theme="([^"]+)"\])?\s*\{([^}]+)\}/g;
  for (const match of styles.matchAll(pattern)) {
    const shell = /--nr-shell\s*:\s*(#[a-f0-9]+)/i.exec(match[2])?.[1];
    if (shell) shells.set(match[1] || 'electric', shell);
    if (!match[1] && /background\s*:\s*var\(--nr-shell\)/.test(match[2])) coloredSurface = true;
  }
  const computed = (element) => {
    const shell = shells.get(element.dataset.theme) || shells.get('electric') || '';
    return { backgroundColor: coloredSurface && shell ? shell : 'rgba(0, 0, 0, 0)',
      display: element.style.display || 'block', visibility: element.style.visibility || 'visible', opacity: element.style.opacity || '1',
      getPropertyValue: (name) => name === '--nr-shell' ? shell : '' };
  };
  const globals = { location: { href: url }, Event: class { constructor(type, settings) { this.type = type; Object.assign(this, settings); } },
    requestAnimationFrame: (callback) => queueMicrotask(callback), getComputedStyle: computed, setTimeout, clearTimeout };
  const mainWorld = vm.createContext({ ...globals, document });
  mainWorld.window = mainWorld;
  vm.runInContext(script, mainWorld, { timeout: 1000 });
  const isolatedWorld = vm.createContext({ ...globals, document: makeDocument() });
  return { body, execute: (source) => vm.runInContext(source, isolatedWorld, { timeout: 1000 }),
    mainExecute: (source) => vm.runInContext(source, mainWorld, { timeout: 1000 }) };
}

for (const defect of ['none', 'score', 'reset', 'theme', 'style']) {
  test(`Neon Rally fixed isolated contract runs actual handlers and detects ${defect === 'none' ? 'working behavior' : `a planted ${defect} defect`}`, async (t) => {
    const { project, script, styles } = starter(t, 'neon-rally');
    const mutations = {
      score: ['scores[index] = Math.min(99, scores[index] + 1);', 'scores[index] = scores[index];'],
      reset: ['      scores = [0, 0];', '      /* planted: reset keeps old scores */'],
      theme: ["shell.dataset.theme = theme.value;", "shell.dataset.theme = 'electric';"],
    };
    const changedScript = Object.hasOwn(mutations, defect) ? script.replace(...mutations[defect]) : script;
    const changedStyles = defect === 'style' ? styles.replace('--nr-shell: #b6a5f8;', '--nr-shell: #ffcb53;') : styles;
    if (defect !== 'none') assert(changedScript !== script || changedStyles !== styles, 'defect planted in actual source');
    let renderer;
    const { manager, created } = fixture(t, { load: (_window, url) => { renderer = rallyPage(changedScript, changedStyles, url); return Promise.resolve(); },
      execute: (_window, source) => renderer.execute(source) });
    const result = await manager.runChecks({ preview: previewFor(project.id), projectId: project.id, contractId: 'neon-rally', region: 'left-third' });
    assert.equal(result.contractId, 'neon-rally');
    assert.equal(result.state, defect === 'none' ? 'passed' : 'failed', JSON.stringify(result));
    assert.deepEqual(result.checks.map((check) => check.name), ['Preview load', 'Target display', 'Score both teams', 'Change the look', 'Reset the scores']);
    assert.equal(created[0].executed.worldId, 1001); assert.equal(created[0].mainWorldCalls, 0);
    assert.equal(result.candidateHash, candidateHash); assert.equal(result.display.id, TARGET);
    if (defect === 'none') {
      assert.equal(renderer.body.querySelector('[data-testid="neon-score-comets"]').textContent, '00');
      assert.equal(renderer.body.querySelector('[data-testid="neon-score-bolts"]').textContent, '00');
      assert.equal(renderer.body.querySelector('section.district-attract-demo').dataset.theme, 'electric');
    } else {
      const failedName = { score: 'Score both teams', reset: 'Reset the scores', theme: 'Change the look', style: 'Change the look' }[defect];
      assert.equal(result.checks.find((check) => check.name === failedName).state, 'failed');
    }
  });
}

test('real Rally title and team-name personalization preserves the functional browser contract', async (t) => {
  const { project, script, styles } = starter(t, 'neon-rally');
  const personalized = script.replaceAll("'COMETS'", "'DRAGONS'").replaceAll("'BOLTS'", "'OTTERS'")
    .replace("'RALLY'", "'SATURDAY ARENA'").replace("'NEON'", "'LANTERN'")
    .replace("'nr-title-rally'", "'personal-party-title'")
    .replace("make('span', 'nr-edition', 'TINY PARTY CONSOLE', top);", '/* Decorative edition omitted by personalization. */');
  assert.notEqual(personalized, script);
  let renderer;
  const { manager } = fixture(t, { load: (_window, url) => { renderer = rallyPage(personalized, styles, url); return Promise.resolve(); },
    execute: (_window, source) => renderer.execute(source) });
  const result = await manager.runChecks({ preview: previewFor(project.id), projectId: project.id, contractId: 'neon-rally' });
  assert.equal(result.state, 'passed', JSON.stringify(result));
  assert.equal(result.contractId, 'neon-rally');
  assert.equal(renderer.body.querySelector('h1').textContent, 'SATURDAY ARENA');
  assert.deepEqual(renderer.body.querySelectorAll('.nr-team-name').map((element) => element.textContent), ['DRAGONS', 'OTTERS']);
  assert.equal(renderer.body.querySelector('.nr-edition'), null);
  assert.equal(renderer.body.querySelector('[data-testid="neon-score-comets"]').textContent, '00');
  assert.equal(renderer.body.querySelector('[data-testid="neon-score-bolts"]').textContent, '00');
});

for (const defect of ['duplicate-hidden-hook', 'hidden-hook', 'disconnected-hook', 'zero-area-hook', 'wrong-control-tag', 'hidden-title', 'empty-title',
  'hidden-team-label', 'empty-team-label', 'duplicate-team-label', 'extra-team-label', 'transparent-board', 'unreadable-status']) {
  test(`Neon Rally refuses ${defect} even when hook names and handlers otherwise exist`, async (t) => {
    const { project, script, styles } = starter(t, 'neon-rally');
    let renderer;
    const { manager } = fixture(t, {
      load: (_window, url) => {
        renderer = rallyPage(script, styles, url);
        const button = renderer.body.querySelector('[data-testid="neon-add-comets"]');
        if (defect === 'duplicate-hidden-hook' || defect === 'wrong-control-tag') {
          const stub = renderer.body.ownerDocument.createElement(defect === 'wrong-control-tag' ? 'div' : 'button');
          stub.dataset.testid = 'neon-add-comets'; stub.textContent = 'SCORE';
          if (defect === 'duplicate-hidden-hook') stub.style.display = 'none';
          else button.remove();
          renderer.body.append(stub);
        } else if (defect === 'hidden-hook') button.style.display = 'none';
        else if (defect === 'disconnected-hook') button.remove();
        else if (defect === 'zero-area-hook') { button.style.width = '0px'; button.style.height = '0px'; }
        else if (defect === 'hidden-title') renderer.body.querySelector('.nr-title-rally').style.visibility = 'hidden';
        else if (defect === 'empty-title') renderer.body.querySelector('.nr-title-rally').textContent = '   ';
        else if (defect === 'hidden-team-label') renderer.body.querySelectorAll('.nr-team-name')[1].style.visibility = 'hidden';
        else if (defect === 'empty-team-label') renderer.body.querySelectorAll('.nr-team-name')[1].textContent = '   ';
        else if (defect === 'duplicate-team-label') renderer.body.querySelectorAll('.nr-team-name')[1].textContent = '  comets  ';
        else if (defect === 'extra-team-label') {
          const extra = renderer.body.ownerDocument.createElement('h3'); extra.className = 'nr-team-name'; extra.textContent = 'EXTRA';
          renderer.body.querySelector('section.district-attract-demo').append(extra);
        }
        else if (defect === 'transparent-board') renderer.body.querySelector('.nr-board').style.opacity = '0';
        else renderer.body.querySelector('[data-testid="neon-status"]').textContent = '';
        return Promise.resolve();
      }, execute: (_window, source) => renderer.execute(source),
    });
    const result = await manager.runChecks({ preview: previewFor(project.id), projectId: project.id, contractId: 'neon-rally' });
    assert.equal(result.state, 'failed', JSON.stringify(result));
    assert.equal(result.contractId, 'neon-rally');
    assert.equal(result.checks.length, 5);
    assert(result.checks.slice(2).every((check) => check.state === 'failed' && /unique, visible, connected/.test(check.detail)));
    assert.equal(renderer.body.querySelector('[data-testid="neon-score-comets"]').textContent, '00', 'invalid controls cannot pass by exercising hidden/fake hooks');
    assert.equal(renderer.body.querySelector('[data-testid="neon-score-bolts"]').textContent, '00');
  });
}

test('main-world poison cannot hide a broken Rally reset from the isolated contract', async (t) => {
  const { project, script, styles } = starter(t, 'neon-rally');
  const broken = script.replace('      scores = [0, 0];', '      /* planted reset defect */');
  assert.notEqual(broken, script);
  let renderer;
  const { manager, created } = fixture(t, {
    load: (_window, url) => {
      renderer = rallyPage(broken, styles, url);
      renderer.mainExecute(`
        Array.from = () => [];
        document.querySelector = () => ({textContent:'00', value:'electric', click(){}, dispatchEvent(){}, getAttribute(){return 'electric';}});
        getComputedStyle = () => ({backgroundColor:'#fake', getPropertyValue(){return '#fake';}});
      `);
      return Promise.resolve();
    }, execute: (_window, source) => renderer.execute(source),
  });
  const result = await manager.runChecks({ preview: previewFor(project.id), projectId: project.id, contractId: 'neon-rally' });
  assert.equal(result.state, 'failed');
  assert.equal(result.checks.find((check) => check.name === 'Reset the scores').state, 'failed');
  assert.equal(renderer.body.querySelector('[data-testid="neon-score-comets"]').textContent, '01');
  assert.equal(created[0].mainWorldCalls, 0); assert.equal(created[0].executed.worldId, 1001);
});

test('close affects only manager-owned windows and closed manager cannot create later windows', async (t) => {
  const { manager, FakeWindow, created } = fixture(t);
  const unrelated = new FakeWindow({ x: 0, y: 0, width: 100, height: 100, webPreferences: {} });
  const a = await manager.open({ preview: previewFor(), projectId: 'project-a' });
  const b = await manager.open({ preview: previewFor('project-b'), projectId: 'project-b' });
  manager.close('project-a'); assert.equal(a.isDestroyed(), true); assert.equal(b.isDestroyed(), false);
  manager.close(); assert.equal(b.isDestroyed(), true); assert.equal(unrelated.isDestroyed(), false);
  await assert.rejects(manager.open({ preview: previewFor('later'), projectId: 'later' }), { code: 'CLOSED' });
  assert.equal(created.length, 3); unrelated.destroy();
});
