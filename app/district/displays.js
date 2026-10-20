'use strict';

const crypto = require('node:crypto');
const { REGIONS, normalize, resolveBounds, workAreaRect, displayKey } = require('./regions');

const CHECK_NAMES = ['Add two tasks', 'Complete a task', 'Remove a task'];
const RALLY_CHECK_NAMES = ['Score both teams', 'Change the look', 'Reset the scores'];
const LOAD_TIMEOUT_MS = 15000;
const CHECK_TIMEOUT_MS = 10000;
const CHECK_WORLD_ID = 1001;
const MAX_PLACEMENT_ATTEMPTS = 4;
const MAX_PLACEMENT_CORRECTION_DIP = 8;

function failure(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

function rect(value) {
  return workAreaRect(value);
}

function boundedId(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\x00-\x1f\x7f]/.test(value)) {
    throw failure('PREVIEW_INVALID', `${name} is required and must be a bounded identifier.`);
  }
  return value;
}

function binding(preview, projectId) {
  boundedId(projectId, 'Project ID');
  if (!preview || preview.projectId !== projectId) throw failure('PREVIEW_PROJECT_MISMATCH', 'Preview does not belong to this project.');
  boundedId(preview.id, 'Preview ID'); boundedId(preview.runId, 'Run ID');
  if (typeof preview.candidateHash !== 'string' || !/^[a-f0-9]{64}$/i.test(preview.candidateHash)) {
    throw failure('PREVIEW_INVALID', 'A candidate-bound preview is required.');
  }
  let url;
  try { url = new URL(preview.url); } catch { throw failure('PREVIEW_INVALID', 'Preview URL is invalid.'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash ||
      !/^\/[a-zA-Z0-9_-]{24,128}\/index\.html$/.test(url.pathname)) {
    throw failure('PREVIEW_INVALID', 'Preview must use its private loopback entry URL.');
  }
  return { id: preview.id, projectId, runId: preview.runId, candidateHash: preview.candidateHash,
    url: url.href, origin: url.origin, prefix: url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) };
}

function allowsUrl(current, value) {
  try {
    const url = new URL(value);
    const decoded = decodeURIComponent(url.pathname);
    return url.protocol === 'http:' && url.origin === current.origin && !url.username && !url.password &&
      decoded.startsWith(current.prefix) && !decoded.includes('\\') && !decoded.includes('\0') &&
      !decoded.split('/').some((part) => part === '.' || part === '..');
  } catch { return false; }
}

function within(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

function sameRect(left, right) {
  return ['x', 'y', 'width', 'height'].every((key) => left[key] === right[key]);
}

function deadline(operation, { signal, timeoutMs, onStop, label }) {
  return new Promise((resolve, reject) => {
    let timer, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    };
    const stop = (error) => {
      try { onStop(); } catch {}
      finish(error);
    };
    const abort = () => stop(failure('CANCELLED', `${label} cancelled.`));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => stop(failure('TIMED_OUT', `${label} exceeded its time limit.`)), timeoutMs);
    Promise.resolve().then(operation).then((value) => finish(null, value), (error) => finish(error));
  });
}

// This is the only source executed in an isolated candidate renderer world.
// Native DOM wrappers and JavaScript intrinsics belong to that trusted world;
// events still reach the app's real handlers in the untrusted main world.
// No project source, Node APIs, IPC or agent-authored script is executed here.
async function checklistChecks() {
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, state: ok ? 'passed' : 'failed', detail });
  const input = document.querySelector('[data-testid="task-input"]');
  const add = document.querySelector('[data-testid="add-task"]');
  const list = document.querySelector('[data-testid="task-list"]');
  if (!input || !add || !list) {
    for (const name of ['Add two tasks', 'Complete a task', 'Remove a task']) check(name, false, 'Required checklist controls are missing.');
    return { url: location.href, checks };
  }
  const pause = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const rows = () => Array.from(list.children).filter((entry) => entry.tagName === 'LI');
  const token = `District browser check ${Date.now().toString(36)}`;
  const first = `${token} first`, second = `${token} second`;
  const rowFor = (text) => rows().find((entry) => Array.from(entry.querySelectorAll('span')).some((span) => span.textContent === text));
  const before = rows().length;
  for (const text of [first, second]) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    add.click();
    await pause();
  }
  const added = rows().length === before + 2 && !!rowFor(first) && !!rowFor(second);
  check('Add two tasks', added, added ? 'Two submitted tasks appeared as separate list items.' : 'Two submissions did not produce two matching list items.');
  const box = rowFor(first)?.querySelector('input[type="checkbox"]');
  if (box) { box.click(); await pause(); }
  const completedRow = rowFor(first);
  const completedBox = completedRow?.querySelector('input[type="checkbox"]');
  const text = completedRow?.querySelector('.task-text');
  const completePresentation = completedRow?.classList.contains('is-complete') ||
    (text && getComputedStyle(text).textDecorationLine.includes('line-through'));
  const completed = added && !!completedBox?.checked && !!completePresentation;
  check('Complete a task', completed, completed ? 'The checkbox and completed task presentation both updated.' : 'Checking the task did not produce a visible completed state.');
  const remove = completedRow?.querySelector('.remove-task, [data-testid="remove-task"], button[aria-label^="Remove "]');
  if (remove) { remove.click(); await pause(); }
  const removed = added && rows().length === before + 1 && !rowFor(first) && !!rowFor(second);
  check('Remove a task', removed, removed ? 'The selected task was removed and the other task remained.' : 'Remove did not remove exactly the selected task.');
  return { url: location.href, checks };
}

const CHECK_SCRIPT = `(${checklistChecks.toString()})()`;

async function rallyChecks() {
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, state: ok ? 'passed' : 'failed', detail });
  const visible = (element) => {
    if (!element?.isConnected || !Array.from(element.getClientRects()).some((area) => area.width >= 1 && area.height >= 1)) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (current.hidden || style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || Number(style.opacity || '1') <= 0) return false;
    }
    return true;
  };
  const unique = (scope, selector) => {
    const entries = scope.querySelectorAll(selector);
    return entries.length === 1 && visible(entries[0]) ? entries[0] : null;
  };
  const get = (id) => unique(document, `[data-testid="${id}"]`);
  const comets = get('neon-add-comets'), bolts = get('neon-add-bolts');
  const scoreComets = get('neon-score-comets'), scoreBolts = get('neon-score-bolts');
  const theme = get('neon-theme'), reset = get('neon-reset'), status = get('neon-status');
  const surface = unique(document, 'section.district-attract-demo');
  const hookSpecs = [['neon-add-comets', 'BUTTON'], ['neon-add-bolts', 'BUTTON'], ['neon-score-comets', 'OUTPUT'],
    ['neon-score-bolts', 'OUTPUT'], ['neon-theme', 'SELECT'], ['neon-reset', 'BUTTON'], ['neon-status', null]];
  const hookProblems = () => hookSpecs.flatMap(([id, tag]) => {
    const element = get(id);
    return !element || tag && element.tagName !== tag || element.disabled ? [id] : [];
  });
  const readableLabels = () => {
    if (!surface || !visible(surface)) return false;
    const headings = Array.from(surface.querySelectorAll('h1, h2, [role="heading"]'));
    const teams = Array.from(surface.querySelectorAll('.nr-team-name'));
    const names = teams.map((team) => team.textContent.trim().replace(/\s+/g, ' ').toLowerCase());
    return headings.some((heading) => visible(heading) && !!heading.textContent.trim()) &&
      teams.length === 2 && teams.every(visible) && names.every(Boolean) && new Set(names).size === 2;
  };
  const statusReady = () => !!status && visible(status) && !!status.textContent.trim() &&
    (status.getAttribute('role') === 'status' || ['polite', 'assertive'].includes(status.getAttribute('aria-live')));
  const ready = () => hookProblems().length === 0 && readableLabels() && statusReady();
  if (!comets || !bolts || !scoreComets || !scoreBolts || !theme || !reset || !status || !surface || !ready()) {
    const problems = hookProblems();
    for (const name of ['Score both teams', 'Change the look', 'Reset the scores']) check(name, false,
      `Neon Rally needs unique, visible, connected native controls and readable labels/status.${problems.length ? ` Invalid hooks: ${problems.join(', ')}.` : ''}`);
    return { url: location.href, checks };
  }
  const pause = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const score = (element) => {
    const value = element.textContent.trim();
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
  };
  const initialComets = score(scoreComets), initialBolts = score(scoreBolts);
  comets.click(); await pause();
  const firstComets = score(scoreComets), firstBolts = score(scoreBolts);
  bolts.click(); await pause();
  const finalComets = score(scoreComets), finalBolts = score(scoreBolts);
  const scored = ready() && visible(scoreComets) && visible(scoreBolts) && Number.isFinite(initialComets) && Number.isFinite(initialBolts) &&
    firstComets === initialComets + 1 && firstBolts === initialBolts &&
    finalComets === initialComets + 1 && finalBolts === initialBolts + 1 && !!status.textContent.trim();
  check('Score both teams', scored, scored ? 'Each team gained exactly one point without changing the other team.' :
    `Score controls did not independently add one point (before ${initialComets}/${initialBolts}, first ${firstComets}/${firstBolts}, final ${finalComets}/${finalBolts}).`);
  const beforeTheme = surface.getAttribute('data-theme');
  const beforeColor = getComputedStyle(surface).backgroundColor;
  const beforeShell = getComputedStyle(surface).getPropertyValue('--nr-shell').trim();
  const targetTheme = beforeTheme === 'sunset' ? 'lagoon' : 'sunset';
  theme.value = targetTheme;
  theme.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const changedColor = getComputedStyle(surface).backgroundColor;
  const changedShell = getComputedStyle(surface).getPropertyValue('--nr-shell').trim();
  const changed = ready() && theme.value === targetTheme && surface.getAttribute('data-theme') === targetTheme &&
    !!beforeShell && !!changedShell && changedShell !== beforeShell && !!beforeColor && !!changedColor &&
    changedColor !== beforeColor && changedColor !== 'rgba(0, 0, 0, 0)' && changedColor !== 'transparent';
  check('Change the look', changed, changed ? 'The selected look, theme attribute and computed surface colors changed together.' :
    'Changing the look did not update its selected value, theme attribute and actual computed surface colors together.');
  reset.click(); await pause();
  const resetComets = score(scoreComets), resetBolts = score(scoreBolts);
  const resetColor = getComputedStyle(surface).backgroundColor;
  const resetShell = getComputedStyle(surface).getPropertyValue('--nr-shell').trim();
  const resetOk = ready() && visible(scoreComets) && visible(scoreBolts) && resetComets === 0 && resetBolts === 0 && theme.value === 'electric' &&
    surface.getAttribute('data-theme') === 'electric' && !!resetShell &&
    (targetTheme !== 'electric' && changed ? resetColor !== changedColor && resetShell !== changedShell : true) && !!status.textContent.trim();
  check('Reset the scores', resetOk, resetOk ? 'Both scores returned to zero and the electric look was restored.' :
    `Reset did not restore zero scores and the electric look (scores ${resetComets}/${resetBolts}, look ${surface.getAttribute('data-theme')}).`);
  return { url: location.href, checks };
}

const CONTRACTS = Object.freeze({
  checklist: Object.freeze({ names: CHECK_NAMES, script: CHECK_SCRIPT }),
  'neon-rally': Object.freeze({ names: RALLY_CHECK_NAMES, script: `(${rallyChecks.toString()})()` }),
});

class DisplayManager {
  constructor({ screen, BrowserWindow, defaultDisplayId = null, onInvalidated } = {}) {
    if (!screen || typeof screen.getAllDisplays !== 'function' || typeof screen.getPrimaryDisplay !== 'function' || typeof BrowserWindow !== 'function') {
      throw new TypeError('DisplayManager requires Electron screen and BrowserWindow dependencies.');
    }
    this.screen = screen;
    this.BrowserWindow = BrowserWindow;
    this.defaultDisplayId = defaultDisplayId == null ? null : String(defaultDisplayId);
    this._windows = new Map();
    this._queues = new Map();
    this._generations = new Map();
    this._closed = false;
    this._displayListeners = [];
    if (typeof screen.on === 'function' && typeof screen.removeListener === 'function') {
      const topologyChanged = () => {
        for (const record of [...this._windows.values()]) {
          try { this._currentDisplay(record.display); }
          catch (error) {
            record.invalidationError = error;
            record.window.hide?.(); this._destroy(record);
            if (typeof onInvalidated === 'function') {
              try { onInvalidated({ projectId: record.projectId, displayId: record.display.id, code: error.code || 'DISPLAY_INVALID', message: error.message }); } catch {}
            }
          }
        }
      };
      for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
        screen.on(event, topologyChanged); this._displayListeners.push(() => screen.removeListener(event, topologyChanged));
      }
    }
  }

  list() {
    const primaryId = String(this.screen.getPrimaryDisplay().id);
    return this.screen.getAllDisplays().map((display, index) => {
      if (display.id == null) throw failure('DISPLAY_INVALID', 'Physical monitor identity is unavailable.');
      const bounds = rect(display.bounds), workArea = rect(display.workArea || display.bounds);
      const scaleFactor = Number.isFinite(display.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : null;
      const reported = display.nativePixelSize;
      const reportedValid = reported && [reported.width, reported.height].every(value => Number.isSafeInteger(value) && value > 0);
      const estimated = scaleFactor && [bounds.width * scaleFactor, bounds.height * scaleFactor].every(value => Number.isFinite(value) && Number.isSafeInteger(Math.round(value)));
      const nativeSize = reportedValid ? { width: reported.width, height: reported.height } : estimated ?
        { width: Math.round(bounds.width * scaleFactor), height: Math.round(bounds.height * scaleFactor) } : null;
      const label = typeof display.label === 'string' && display.label.trim() ? display.label.trim().slice(0, 160) : `Display ${index + 1}`;
      const entry = { id: String(display.id), name: `${label} — ${nativeSize ? `${reportedValid ? '' : '≈ '}${nativeSize.width}×${nativeSize.height} px` : 'native size unknown'} (${bounds.width}×${bounds.height} logical, ${scaleFactor ? `${scaleFactor}×` : 'scale unknown'})`,
        primary: String(display.id) === primaryId, bounds, workArea, scaleFactor, nativeSize,
        nativeSizeSource: reportedValid ? 'reported' : nativeSize ? 'scale-estimate' : 'unknown', units: 'logical/DIP' };
      entry.geometryKey = displayKey(entry);
      return entry;
    });
  }

  _display(displayId) {
    const requestedDisplayId = displayId == null ? this.defaultDisplayId : String(displayId);
    const availableDisplays = this.list();
    if (!requestedDisplayId) throw failure('DISPLAY_SELECTION_REQUIRED', 'Choose a display for this project before opening a visual preview.',
      { requestedDisplayId: null, availableDisplays, fallback: false });
    const display = availableDisplays.find((entry) => entry.id === requestedDisplayId);
    if (!display) throw failure('DISPLAY_NOT_FOUND', `Requested display ${requestedDisplayId} is unavailable. Choose another display explicitly.`,
      { requestedDisplayId, availableDisplays, fallback: false });
    return display;
  }

  selection({ displayId, region = 'full', regionBounds: customBounds, expectedGeometry } = {}) {
    const display = this._display(displayId);
    if (expectedGeometry !== undefined && (typeof expectedGeometry !== 'string' || expectedGeometry !== display.geometryKey))
      throw failure('DISPLAY_GEOMETRY_CHANGED', 'The saved monitor geometry or scaling changed. Choose its test area again.',
        { requestedDisplayId: display.id, availableDisplays: this.list(), fallback: false });
    const normalized = normalize(region, customBounds);
    return { display, geometryKey: display.geometryKey, requestedRegion: normalized.region, regionBounds: { ...normalized.bounds },
      requestedBounds: resolveBounds(display.workArea, normalized.region, normalized.bounds, { minWidth: 320, minHeight: 200 }) };
  }

  _currentDisplay(display) {
    const current = this._display(display.id);
    if (current.geometryKey !== display.geometryKey) throw failure('DISPLAY_GEOMETRY_CHANGED',
      'The selected monitor moved, resized or changed scale during this operation. Its window was not accepted; choose the area again.',
      { requestedDisplayId: display.id, availableDisplays: this.list(), fallback: false });
    return current;
  }

  _enqueue(projectId, operation) {
    const generation = this._generations.get(projectId) || 0;
    const pending = (this._queues.get(projectId) || Promise.resolve()).then(() => {
      if (this._closed) throw failure('CLOSED', 'Display manager is closed.');
      if ((this._generations.get(projectId) || 0) !== generation) throw failure('CANCELLED', 'Visual operation cancelled before it started.');
      return operation();
    });
    const tail = pending.catch(() => {});
    this._queues.set(projectId, tail);
    tail.then(() => { if (this._queues.get(projectId) === tail) this._queues.delete(projectId); });
    return pending;
  }

  _destroy(record) {
    if (this._windows.get(record.projectId) === record) this._windows.delete(record.projectId);
    if (!record.window.isDestroyed()) record.window.destroy();
  }

  _active(record) {
    if (record.invalidationError) throw record.invalidationError;
    if (this._closed || this._windows.get(record.projectId) !== record || record.window.isDestroyed()) {
      throw failure('CANCELLED', 'The owned preview window was closed.');
    }
  }

  _newWindow(projectId, current, display, bounds) {
    const window = new this.BrowserWindow({ ...bounds, show: false, title: 'Agent Bus project preview', backgroundColor: '#0b1421',
      autoHideMenuBar: true, fullscreenable: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false,
        devTools: false, disableDialogs: true, backgroundThrottling: false, partition: `district-preview-${crypto.randomUUID()}` } });
    const record = { projectId, window, current, display, effectiveBounds: bounds, requestedRegion: 'full' };
    this._windows.set(projectId, record);
    window.once('closed', () => { if (this._windows.get(projectId) === record) this._windows.delete(projectId); });
    try {
    window.setMenu(null);
    const contents = window.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const guard = (event, oldUrl) => { if (!allowsUrl(record.current, event.url || oldUrl)) event.preventDefault(); };
    contents.on('will-navigate', guard);
    contents.on('will-frame-navigate', guard);
    contents.on('will-redirect', guard);
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.on('will-prevent-unload', (event) => event.preventDefault());
    contents.on('page-title-updated', (event) => event.preventDefault());
    const session = contents.session;
    session.setPermissionCheckHandler(() => false);
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.on('will-download', (event) => event.preventDefault());
    session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      callback({ cancel: !allowsUrl(record.current, details.url) });
    });
    } catch (error) { this._destroy(record); throw record.invalidationError || error; }
    return record;
  }

  _placed(record, display) {
    this._currentDisplay(display);
    const actual = rect(record.window.getBounds());
    const matched = typeof this.screen.getDisplayMatching === 'function' ? this.screen.getDisplayMatching(actual) : null;
    if (!within(display.workArea, actual) || !sameRect(record.effectiveBounds, actual) || (matched && String(matched.id) !== display.id)) {
      const requested = { ...record.effectiveBounds };
      const placement = { units: 'logical/DIP', requestedDisplayId: display.id, actualDisplayId: matched ? String(matched.id) : null,
        requestedRegion: record.requestedRegion, regionBounds: record.regionBounds ? { ...record.regionBounds } : null,
        requestedBounds: requested, actualBounds: actual, workArea: { ...display.workArea }, scaleFactor: display.scaleFactor,
        delta: { x: actual.x - requested.x, y: actual.y - requested.y, width: actual.width - requested.width, height: actual.height - requested.height },
        overflow: { left: Math.max(0, requested.x - actual.x), top: Math.max(0, requested.y - actual.y),
          right: Math.max(0, actual.x + actual.width - requested.x - requested.width),
          bottom: Math.max(0, actual.y + actual.height - requested.y - requested.height) },
        withinWorkArea: within(display.workArea, actual), withinRequestedRegion: within(requested, actual),
        exactRequestedBounds: sameRect(requested, actual), correctionReason: record.correctionReason || null,
        attempts: record.placementAttempts || [], fallback: false };
      // Electron IPC serializes Error.message but may omit custom properties.
      // Include measured geometry there as well as structured result metadata.
      throw failure('DISPLAY_PLACEMENT_FAILED', `The preview window was not placed wholly on the requested display/area. Placement: ${JSON.stringify(placement)}`,
        { ...placement, placement });
    }
  }

  async _fitPlacement(record, display, signal) {
    const requested = record.effectiveBounds;
    let command = { ...requested };
    record.placementAttempts = [];
    record.correctionReason = null;
    for (let attempt = 1; attempt <= MAX_PLACEMENT_ATTEMPTS; attempt++) {
      if (signal?.aborted) throw failure('CANCELLED', 'Preview placement cancelled.');
      this._active(record);
      this._currentDisplay(display);
      record.window.setBounds(command, false);
      // Let native resize notifications settle before measuring the feedback.
      await new Promise((resolve) => setImmediate(resolve));
      this._active(record);
      const actual = rect(record.window.getBounds());
      record.placementAttempts.push({ attempt, commandBounds: { ...command }, actualBounds: { ...actual } });
      if (sameRect(requested, actual)) { this._placed(record, display); return; }
      const matched = typeof this.screen.getDisplayMatching === 'function' ? this.screen.getDisplayMatching(actual) : null;
      if (matched && String(matched.id) !== display.id) { record.correctionReason = 'wrong-display'; break; }
      const next = Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, command[key] + requested[key] - actual[key]]));
      if (['x', 'y', 'width', 'height'].some((key) => !Number.isSafeInteger(next[key]) || Math.abs(next[key] - requested[key]) > MAX_PLACEMENT_CORRECTION_DIP)) {
        record.correctionReason = 'correction-exceeds-bound'; break;
      }
      if (next.width <= 0 || next.height <= 0 || !within(display.workArea, next)) {
        record.correctionReason = 'correction-outside-work-area'; break;
      }
      command = next;
    }
    record.correctionReason ||= 'did-not-converge';
    this._placed(record, display); // Exact match remains mandatory; no tolerance.
  }

  async _open({ current, display, projectId, signal, region, customBounds }) {
    if (signal?.aborted) throw failure('CANCELLED', 'Preview load cancelled.');
    const normalized = normalize(region, customBounds);
    this._currentDisplay(display);
    const bounds = resolveBounds(display.workArea, normalized.region, normalized.bounds, { minWidth: 320, minHeight: 200 });
    let record = this._windows.get(projectId);
    if (!record || record.window.isDestroyed()) record = this._newWindow(projectId, current, display, bounds);
    record.current = current; record.display = display;
    record.requestedRegion = normalized.region; record.effectiveBounds = bounds; record.regionBounds = normalized.bounds;
    record.window.setMinimumSize?.(320, 200);
    try {
      // A reused window stays hidden until the final native outer bounds are
      // exact. Intermediate correction measurements are never accepted/shown.
      record.window.hide?.();
      await this._fitPlacement(record, display, signal);
      await deadline(() => record.window.loadURL(current.url), { signal, timeoutMs: LOAD_TIMEOUT_MS,
        label: 'Preview load', onStop: () => this._destroy(record) });
      this._active(record);
      if (!allowsUrl(current, record.window.webContents.getURL())) throw failure('PREVIEW_NAVIGATION_BLOCKED', 'Preview loaded outside the current private URL.');
      this._display(display.id); // A monitor disconnected during loading is an explicit error.
      this._placed(record, display);
      record.window.districtDisplay = { requestedRegion: normalized.region, regionBounds: { ...normalized.bounds }, requestedBounds: { ...bounds },
        actualBounds: rect(record.window.getBounds()), effectiveBounds: { ...bounds },
        placementAttempts: record.placementAttempts.map((attempt) => ({ ...attempt, commandBounds: { ...attempt.commandBounds }, actualBounds: { ...attempt.actualBounds } })), display,
        projectId, previewId: current.id, runId: current.runId, candidateHash: current.candidateHash };
      record.window.showInactive();
      return record;
    } catch (error) { this._destroy(record); throw record.invalidationError || error; }
  }

  open({ preview, displayId, projectId, mode = 'preview', region = 'full', regionBounds: customBounds, expectedGeometry } = {}) {
    return this._enqueue(projectId, async () => {
      if (mode !== 'preview') throw failure('MODE_INVALID', 'Only project preview windows can be opened.');
      const current = binding(preview, projectId), { display } = this.selection({ displayId, region, regionBounds: customBounds, expectedGeometry });
      return (await this._open({ current, display, projectId, region, customBounds })).window;
    });
  }

  async runChecks({ preview, displayId, projectId, signal, region = 'full', regionBounds: customBounds, expectedGeometry, contractId = 'checklist' } = {}) {
    let display = null;
    let effectiveBounds = null;
    let normalizedBounds = null;
    const checks = [];
    try {
      return await this._enqueue(projectId, async () => {
        if (typeof contractId !== 'string' || !Object.hasOwn(CONTRACTS, contractId)) {
          throw failure('CONTRACT_INVALID', 'Choose the checklist or neon-rally browser test contract.');
        }
        const contract = CONTRACTS[contractId];
        const current = binding(preview, projectId);
        display = this.selection({ displayId, region, regionBounds: customBounds, expectedGeometry }).display;
        if (signal?.aborted) throw failure('CANCELLED', 'Browser checks cancelled.');
        const record = await this._open({ current, display, projectId, signal, region, customBounds });
        effectiveBounds = { ...record.effectiveBounds };
        normalizedBounds = { ...record.regionBounds };
        checks.push({ name: 'Preview load', state: 'passed', detail: 'Loaded the candidate-bound private loopback preview.' });
        checks.push({ name: 'Target display', state: 'passed', detail: `Window ${record.window.id} is wholly within ${display.name}.` });
        try {
          if (typeof record.window.webContents.executeJavaScriptInIsolatedWorld !== 'function') {
            throw failure('ISOLATED_WORLD_UNAVAILABLE', 'This Electron runtime cannot execute isolated browser checks.');
          }
          const result = await deadline(() => record.window.webContents.executeJavaScriptInIsolatedWorld(CHECK_WORLD_ID, [{ code: contract.script }], false),
            { signal, timeoutMs: CHECK_TIMEOUT_MS, label: 'Browser checks', onStop: () => this._destroy(record) });
          if (signal?.aborted) throw failure('CANCELLED', 'Browser checks cancelled.');
          this._active(record);
          this._display(display.id); this._placed(record, display);
          if (!result || !allowsUrl(current, result.url) || !Array.isArray(result.checks) || result.checks.length !== contract.names.length ||
              result.checks.some((check, index) => check.name !== contract.names[index] || !['passed', 'failed'].includes(check.state) || typeof check.detail !== 'string')) {
            throw failure('BROWSER_RESULT_INVALID', `The browser did not return the expected ${contractId} behavior evidence.`);
          }
          checks.push(...result.checks.map((check) => ({ name: check.name, state: check.state, detail: check.detail.slice(0, 1000) })));
          const passed = checks.every((check) => check.state === 'passed');
          return { state: passed ? 'passed' : 'failed', exitCode: passed ? 0 : 1, contractId, checks, display, requestedRegion: region, regionBounds: normalizedBounds, effectiveBounds, windowId: record.window.id,
            placementAttempts: record.placementAttempts.map((attempt) => ({ ...attempt, commandBounds: { ...attempt.commandBounds }, actualBounds: { ...attempt.actualBounds } })),
            previewId: current.id, runId: current.runId, candidateHash: current.candidateHash,
            ...(passed ? {} : { error: 'One or more browser behavior checks failed.' }) };
        } catch (error) { this._destroy(record); throw record.invalidationError || error; }
      });
    } catch (error) {
      const cancelled = error.code === 'CANCELLED';
      const failedCheck = /^CONTRACT_/.test(error.code || '') ? 'Browser contract' : /^PREVIEW_/.test(error.code || '') ? 'Preview binding' : /^REGION_/.test(error.code || '') ? 'Target area' :
        /^DISPLAY_/.test(error.code || '') || !display ? 'Target display' : 'Browser execution';
      checks.push({ name: cancelled ? 'Browser checks' : failedCheck, state: cancelled ? 'cancelled' : 'failed', detail: String(error.message || error).slice(0, 1000) });
      return { state: cancelled ? 'cancelled' : 'failed', exitCode: cancelled ? null : 1, contractId, checks, display, requestedRegion: region, regionBounds: normalizedBounds, effectiveBounds,
        error: String(error.message || error).slice(0, 1000), errorCode: error.code || 'BROWSER_FAILED',
        ...(error.requestedDisplayId !== undefined ? { requestedDisplayId: error.requestedDisplayId } : {}),
        ...(error.placement ? { placement: error.placement } : {}),
        ...(error.availableDisplays ? { availableDisplays: error.availableDisplays, fallback: false } : {}) };
    }
  }

  close(projectId) {
    if (projectId === undefined) {
      this._closed = true;
      for (const remove of this._displayListeners.splice(0)) remove();
    }
    else this._generations.set(projectId, (this._generations.get(projectId) || 0) + 1);
    for (const record of [...this._windows.values()]) {
      if (projectId === undefined || record.projectId === projectId) this._destroy(record);
    }
  }
}

module.exports = { DisplayManager, REGIONS };
