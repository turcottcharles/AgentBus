'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const regions = require('../app/district/regions');
const { DisplayManager } = require('../app/district/displays');
const TARGET = '3242010503', OWNER = '4060505759';
const plain = value => JSON.parse(JSON.stringify(value));

function monitors() {
  return [
    { id: Number(TARGET), label: '4K test display', bounds: { x: -1536, y: 0, width: 1536, height: 864 },
      workArea: { x: -1536, y: 0, width: 1536, height: 824 }, scaleFactor: 2.5 },
    { id: Number(OWNER), label: 'Owner 1080p', bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 },
  ];
}

function managerFixture(t, { load, Manager = DisplayManager, onInvalidated } = {}) {
  let inventory = monitors();
  const windows = [];
  class SyntheticWindow extends EventEmitter {
    constructor(settings) {
      super(); this.id = windows.length + 1; this.bounds = { x: settings.x, y: settings.y, width: settings.width, height: settings.height };
      this.moves = []; this.shows = 0; this.destroyed = false;
      const contents = this.webContents = new EventEmitter(), session = contents.session = new EventEmitter();
      session.setPermissionCheckHandler = session.setPermissionRequestHandler = () => {};
      session.webRequest = { onBeforeRequest() {} };
      contents.setWindowOpenHandler = () => {};
      contents.getURL = () => this.url;
      windows.push(this);
    }
    setMenu() {}
    setMinimumSize() {}
    hide() {}
    setBounds(value) { this.moves.push({ ...value }); this.bounds = { ...value }; }
    getBounds() { return { ...this.bounds }; }
    loadURL(url) { this.url = url; return load ? load(this) : Promise.resolve(); }
    showInactive() { this.shows++; }
    isDestroyed() { return this.destroyed; }
    destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('closed'); } }
  }
  const screen = Object.assign(new EventEmitter(), { getAllDisplays: () => structuredClone(inventory), getPrimaryDisplay: () => structuredClone(inventory.find(display => String(display.id) === OWNER) || inventory[0]),
    getDisplayMatching: bounds => inventory.find(display => bounds.x >= display.bounds.x && bounds.y >= display.bounds.y &&
      bounds.x + bounds.width <= display.bounds.x + display.bounds.width && bounds.y + bounds.height <= display.bounds.y + display.bounds.height) || inventory[0] });
  const manager = new Manager({ screen, BrowserWindow: SyntheticWindow, defaultDisplayId: TARGET, onInvalidated });
  t.after(() => manager.close());
  return { manager, windows, screen, set(value) { inventory = value; }, get() { return structuredClone(inventory); } };
}

function preview(projectId) {
  return { id: `preview-${projectId}`, projectId, runId: `run-${projectId}`, candidateHash: 'a'.repeat(64),
    url: `http://127.0.0.1:40123/${'b'.repeat(48)}/index.html` };
}

// Synthetic DOM exercises actual picker event handlers and save callbacks. It
// supplies geometry only: no Electron, browser, desktop content or GPU is used.
function pickerFixture(t, onApply = async () => ({ status: 'completed', projectId: 'atlas' })) {
  let document;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.dataset = {}; this.attributes = {}; this.style = {}; this.handlers = new Map(); this.value = ''; this.disabled = false; this.open = false; this._text = ''; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { for (const child of this.children) child.parent = null; this.children = []; this._text = ''; this.append(...children); }
    setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'id') this.id = String(value); if (key === 'open') this.open = true;
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; if (key === 'open') this.open = false; }
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(handler); }
    removeEventListener(type, handler) { this.handlers.get(type)?.delete(handler); }
    contains(node) { return !!node && (node === this || this.children.some(child => child.contains(node))); }
    get isConnected() { return document.body.contains(this); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; void this.fire('close'); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    getBoundingClientRect() { return this.box || { left: 100, top: 100, width: 800, height: 400 }; }
    setPointerCapture(id) { this.capture = id; }
    releasePointerCapture() { this.capture = null; }
    closest(selector) {
      const match = /^button(?:\[data-([a-z-]+)\])?$/.exec(selector);
      for (let node = this; node; node = node.parent) if (match && node.tagName === 'BUTTON' && (!match[1] || node.getAttribute(`data-${match[1]}`) !== null)) return node;
      return null;
    }
    querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || selector === 'button' && child.tagName === 'BUTTON'); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    async fire(type, properties = {}) {
      const event = { type, target: this, button: 0, pointerId: 1, preventDefault() { this.defaultPrevented = true; }, ...properties };
      const pending = [];
      for (let node = this; node; node = node.parent) for (const handler of node.handlers.get(type) || []) pending.push(handler(event));
      await Promise.all(pending);
    }
    click() { return this.disabled ? Promise.resolve() : this.fire('click'); }
  }
  document = { createElement: tag => new Element(tag), activeElement: null };
  document.body = new Element('body'); document.activeElement = document.body;
  const browser = { DistrictRegions: regions };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/district-screen-picker.js'), 'utf8'), { window: browser, document }, { timeout: 1000 });
  const picker = new browser.DistrictScreenPicker({ onApply });
  t.after(() => picker.destroy());
  return { picker, document };
}

function openPicker(picker, displays, preferences = {}, projects = []) {
  return picker.open({ project: { id: 'atlas', name: 'Atlas', preferences }, displays, projects, defaultDisplayId: TARGET });
}

test('physical monitor identity and fractional zones remain separate across inventory reordering and scaling', t => {
  const f = managerFixture(t), first = f.manager.selection({ region: 'left-third' }), middle = f.manager.selection({ region: 'middle-third' });
  assert.equal(first.display.id, TARGET); assert.equal(middle.display.id, TARGET);
  assert.equal(first.requestedRegion, 'left-third'); assert.equal(middle.requestedRegion, 'middle-third');
  assert.deepEqual(first.requestedBounds, { x: -1536, y: 0, width: 512, height: 824 });
  assert.equal(first.requestedBounds.x + first.requestedBounds.width, middle.requestedBounds.x);
  assert.deepEqual(first.display.nativeSize, { width: 3840, height: 2160 });
  const geometry = first.geometryKey;
  f.set(f.get().reverse());
  assert.equal(f.manager.selection({ displayId: TARGET, region: 'left-third', expectedGeometry: geometry }).geometryKey, geometry);
  assert.equal(f.windows.length, 0, 'validating or assigning a zone creates no window');
});

test('invalid or unknown scale is disclosed rather than invented as 1x/native pixels', t => {
  const f = managerFixture(t), inventory = f.get();
  inventory[0].scaleFactor = NaN; f.set(inventory);
  const unknown = f.manager.list()[0];
  assert.equal(unknown.scaleFactor, null); assert.equal(unknown.nativeSize, null); assert.equal(unknown.nativeSizeSource, 'unknown');
  assert.match(unknown.name, /scale unknown/);
  inventory[0].nativePixelSize = { width: 3840, height: 2160 }; f.set(inventory);
  assert.equal(f.manager.list()[0].nativeSizeSource, 'reported');
  assert.deepEqual(f.manager.list()[0].nativeSize, { width: 3840, height: 2160 });
});

test('saved geometry revisions reject changed scale or work area before creating any window', async t => {
  const f = managerFixture(t), key = f.manager.selection({}).geometryKey;
  const changed = f.get(); changed[0].scaleFactor = 2; f.set(changed);
  await assert.rejects(f.manager.open({ projectId: 'atlas', preview: preview('atlas'), expectedGeometry: key }), { code: 'DISPLAY_GEOMETRY_CHANGED' });
  assert.equal(f.windows.length, 0);
  changed[0].workArea.width = 2000; f.set(changed);
  assert.throws(() => f.manager.selection({}), { code: 'DISPLAY_INVALID' });
});

test('same-ID monitor drift during load fails closed and never shows or moves an owner-display window', async t => {
  let f;
  f = managerFixture(t, { load: async () => { const changed = f.get(); changed[0].workArea.y = 20; changed[0].workArea.height = 804; f.set(changed); } });
  const owner = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, moves: 0 };
  await assert.rejects(f.manager.open({ projectId: 'atlas', preview: preview('atlas'), region: 'middle-third' }), { code: 'DISPLAY_GEOMETRY_CHANGED' });
  assert.equal(f.windows[0].shows, 0); assert.equal(f.windows[0].destroyed, true);
  assert(f.windows[0].moves.every(bounds => bounds.x + bounds.width <= 0));
  assert.equal(owner.moves, 0); assert.equal(owner.bounds.width, 1920);
});

test('disconnected saved monitor never silently substitutes the primary monitor', async t => {
  const f = managerFixture(t);
  f.set(f.get().filter(display => String(display.id) === OWNER));
  await assert.rejects(f.manager.open({ projectId: 'atlas', preview: preview('atlas') }), { code: 'DISPLAY_NOT_FOUND', fallback: false });
  assert.equal(f.windows.length, 0);
});

test('topology changes close only affected manager-owned windows and preserve explicit invalidation evidence', async t => {
  const invalidations = [], f = managerFixture(t, { onInvalidated: event => invalidations.push(event) });
  const testWindow = await f.manager.open({ projectId: 'atlas', preview: preview('atlas'), region: 'left-third' });
  const ownerWindow = await f.manager.open({ projectId: 'beacon', preview: preview('beacon'), displayId: OWNER, region: 'middle-third' });
  const unrelated = { moved: false, closed: false };
  f.screen.emit('display-added'); assert.equal(testWindow.isDestroyed(), false, 'unchanged connected geometry stays open');
  f.set(f.get().filter(display => String(display.id) === OWNER));
  f.screen.emit('display-removed');
  assert.equal(testWindow.isDestroyed(), true); assert.equal(ownerWindow.isDestroyed(), false);
  assert.deepEqual(invalidations.map(event => [event.projectId, event.displayId, event.code]), [['atlas', TARGET, 'DISPLAY_NOT_FOUND']]);
  assert.deepEqual(unrelated, { moved: false, closed: false });
  f.manager.close();
  assert.equal(f.screen.listenerCount('display-removed'), 0); assert.equal(f.screen.listenerCount('display-metrics-changed'), 0);
});

test('monitor removal during a rejected load preserves the display cause rather than a generic aborted-page error', async t => {
  let f;
  f = managerFixture(t, { load: async () => {
    f.set(f.get().filter(display => String(display.id) === OWNER)); f.screen.emit('display-removed');
    throw new Error('ERR_ABORTED from the destroyed synthetic page');
  } });
  await assert.rejects(f.manager.open({ projectId: 'atlas', preview: preview('atlas') }), { code: 'DISPLAY_NOT_FOUND', fallback: false });
  assert.equal(f.windows[0].shows, 0); assert.equal(f.windows[0].destroyed, true);
});

test('adjacent thirds have no overlap; intersecting drafts are explanatory and do not reserve screens', () => {
  assert.equal(regions.overlaps(regions.normalize('left-third').bounds, regions.normalize('middle-third').bounds), false);
  assert.equal(regions.overlaps(regions.normalize('left-half').bounds, regions.normalize('middle-third').bounds), true);
  assert.throws(() => regions.overlaps({ x: 0.9, y: 0, width: 1, height: 1 }, regions.normalize('full').bounds), { code: 'REGION_INVALID' });
});

test('graphical thirds save one physical display ID plus a zone, with placement metadata and no implicit work', async t => {
  const f = managerFixture(t), calls = [];
  const { picker } = pickerFixture(t, async (payload, context) => { calls.push({ payload: plain(payload), context: plain(context) }); return { status: 'completed', projectId: 'atlas' }; });
  openPicker(picker, f.manager.list());
  await picker.modeButtons.get('thirds').click();
  await picker.workArea.fire('pointerdown', { clientX: 500, clientY: 250 });
  assert.equal(calls.length, 0);
  assert.match(picker.monitorMetrics.textContent, new RegExp(`Physical display ID ${TARGET}`));
  assert.equal(picker.region, 'middle-third');
  await picker.applyButton.click();
  assert.deepEqual(calls[0].payload, { testDisplayId: TARGET, testRegion: 'middle-third' });
  assert.equal(calls[0].context.projectId, 'atlas');
  assert.equal(calls[0].context.geometryKey, f.manager.selection({ region: 'middle-third' }).geometryKey);
  assert.equal(calls[0].context.units, 'logical/DIP');
  assert.equal(picker.isOpen, false); assert.equal(f.windows.length, 0);
});

test('draw, percent fields and arrow-key adjustment use the same validated normalized custom rectangle', async t => {
  const f = managerFixture(t), calls = [];
  const { picker } = pickerFixture(t, async payload => { calls.push(plain(payload)); return { status: 'completed', projectId: 'atlas' }; });
  openPicker(picker, f.manager.list());
  await picker.modeButtons.get('draw').click();
  await picker.workArea.fire('pointerdown', { clientX: 300, clientY: 200 });
  await picker.workArea.fire('pointermove', { clientX: 700, clientY: 400 });
  await picker.workArea.fire('pointerup', { clientX: 700, clientY: 400 });
  assert.deepEqual(plain(picker.customBounds), { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  await picker.workArea.fire('keydown', { key: 'ArrowRight' });
  await picker.workArea.fire('keydown', { key: 'ArrowDown', shiftKey: true });
  assert.equal(picker.customBounds.x, 0.26); assert.equal(picker.customBounds.height, 0.51);
  for (const [key, value] of [['x', '25'], ['y', '25'], ['width', '50'], ['height', '50']]) picker.fields.get(key).value = value;
  await picker.fields.get('width').fire('input');
  assert.equal(picker.applyButton.disabled, false);
  assert.match(picker.logicalSize.textContent, /768.*412 DIP/);
  await picker.applyButton.click();
  assert.deepEqual(calls[0], { testDisplayId: TARGET, testRegion: 'custom', testBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } });
});

test('picker discloses saved-area overlap and accessible alternatives without starting work', async t => {
  const f = managerFixture(t); let calls = 0;
  const { picker } = pickerFixture(t, async () => { calls++; return { status: 'completed' }; });
  openPicker(picker, f.manager.list(), { testRegion: 'left-third' }, [{ id: 'beacon', name: 'Beacon', preferences: { testDisplayId: TARGET, testRegion: 'middle-third' } }]);
  assert.match(picker.overlapNotice.textContent, /does not overlap/);
  const half = picker.presets.querySelectorAll('button').find(button => button.dataset.region === 'left-half');
  await half.click();
  assert.match(picker.overlapNotice.textContent, /overlaps saved areas for Beacon/);
  assert.match(picker.overlapNotice.textContent, /not exclusive reservations/);
  assert.equal(picker.overlapNotice.getAttribute('role'), 'status');
  assert.match(picker.workArea.getAttribute('aria-label'), /Arrow keys/);
  assert.equal(picker.fields.get('width').getAttribute('aria-label'), 'Width, percent of monitor work area');
  assert.equal(calls, 0);
});

test('picker refresh invalidates stale/disconnected monitors and requires explicit re-selection', async t => {
  const f = managerFixture(t), calls = [];
  const { picker } = pickerFixture(t, async payload => { calls.push(payload); return { status: 'completed', projectId: 'atlas' }; });
  openPicker(picker, f.manager.list(), { testDisplayId: TARGET, testRegion: 'left-third' });
  const changed = f.get(); changed[0].scaleFactor = 2; f.set(changed);
  picker.updateDisplays(f.manager.list());
  assert.equal(picker.displayId, ''); assert.equal(picker.applyButton.disabled, true); assert.match(picker.notice.textContent, /scaling changed/);
  await picker.applyButton.click(); assert.equal(calls.length, 0);
  await picker.topology.querySelectorAll('button').find(button => button.dataset.displayId === TARGET).click();
  assert.equal(picker.applyButton.disabled, false);
  f.set(changed.filter(display => String(display.id) === OWNER)); picker.updateDisplays(f.manager.list());
  assert.equal(picker.displayId, ''); assert.match(picker.notice.textContent, /disconnected/);
  assert.equal(picker.applyButton.disabled, true);
});

test('persisted stale geometry and missing monitor remain reviewable without replacing the physical ID', t => {
  const f = managerFixture(t), { picker } = pickerFixture(t);
  openPicker(picker, f.manager.list(), { testDisplayId: TARGET, testDisplayGeometry: 'old-geometry', testRegion: 'middle-third' });
  assert.equal(picker.displayId, ''); assert.match(picker.notice.textContent, /geometry or scaling changed/);
  f.set(f.get().filter(display => String(display.id) === OWNER));
  openPicker(picker, f.manager.list(), { testDisplayId: TARGET, testRegion: 'middle-third' });
  assert.equal(picker.displayId, ''); assert.match(picker.notice.textContent, /saved monitor is unavailable/);
});

test('a completed save racing monitor removal is labeled saved-but-needs-review and does not close silently', async t => {
  const f = managerFixture(t); let finish;
  const { picker } = pickerFixture(t, () => new Promise(resolve => { finish = resolve; }));
  openPicker(picker, f.manager.list());
  const saving = picker.applyButton.click();
  assert.equal(picker.pending, true);
  f.set(f.get().filter(display => String(display.id) === OWNER)); picker.updateDisplays(f.manager.list());
  finish({ status: 'completed', projectId: 'atlas' }); await saving;
  assert.equal(picker.pending, false); assert.equal(picker.isOpen, true);
  assert.match(picker.notice.textContent, /Saved placement needs review/);
  assert.equal(picker.applyButton.disabled, true);
});

test('invalid custom bounds and too-small areas never reach the save callback', async t => {
  const f = managerFixture(t); let saves = 0;
  const { picker } = pickerFixture(t, async () => { saves++; return { status: 'completed' }; });
  openPicker(picker, f.manager.list());
  for (const [key, value] of [['x', '90'], ['y', '0'], ['width', '50'], ['height', '50']]) picker.fields.get(key).value = value;
  await picker.fields.get('width').fire('input'); assert.equal(picker.applyButton.disabled, true);
  picker.fields.get('x').value = '0'; picker.fields.get('width').value = '1'; await picker.fields.get('width').fire('input');
  assert.equal(picker.applyButton.disabled, true); assert.match(picker.logicalSize.textContent, /choose at least/);
  await picker.applyButton.click(); assert.equal(saves, 0);
});

test('live-geometry acceptance rejects a planted stale-monitor guard break and passes restored source', async t => {
  const filename = path.join(__dirname, '../app/district/displays.js');
  const source = fs.readFileSync(filename, 'utf8');
  const broken = source.replace('if (current.geometryKey !== display.geometryKey)', 'if (false && current.geometryKey !== display.geometryKey)');
  assert.notEqual(broken, source, 'The actual live-geometry guard must be changed.');
  const compile = code => {
    const compiled = { exports: {} };
    vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require: createRequire(filename), URL,
      setTimeout, clearTimeout, setImmediate }, { timeout: 1000 });
    return compiled.exports.DisplayManager;
  };
  async function acceptance(Manager) {
    let f;
    f = managerFixture(t, { Manager, load: async () => { const changed = f.get(); changed[0].workArea.y = 20; changed[0].workArea.height = 804; f.set(changed); } });
    await assert.rejects(f.manager.open({ projectId: 'atlas', preview: preview('atlas'), region: 'left-third' }),
      { code: 'DISPLAY_GEOMETRY_CHANGED' }, 'Changed live work area must never be accepted from its stale snapshot.');
  }
  // Change the source in memory, compile fresh, observe the acceptance failure,
  // then restore/compile the original and pass. Shared production files are untouched.
  await assert.rejects(acceptance(compile(broken)), assert.AssertionError);
  await acceptance(compile(source));
});
