'use strict';
(() => {
  const WIDTH = 1536, HEIGHT = 1024;
  const HUB = { x: 790, y: 475 };
  const FACILITIES = [
    { id: 'research', name: 'Research', action: 'Explore and understand', x: 425, y: 337, pin: [315, 292], box: [74, 86, 477, 302], shape: 'polygon(0 39%,45% 0,100% 46%,52% 100%)', route: [[590, 358]], color: 'teal' },
    { id: 'build', name: 'Workshop', action: 'Edit files and build', x: 503, y: 637, pin: [400, 549], box: [160, 392, 452, 327], shape: 'polygon(0 38%,45% 0,100% 44%,56% 100%)', route: [[606, 516], [594, 661]], color: 'amber' },
    { id: 'test', name: 'Test lab', action: 'Run real checks', x: 1168, y: 319, pin: [1164, 258], box: [1015, 75, 428, 300], shape: 'polygon(0 30%,48% 0,100% 42%,55% 100%)', route: [[1004, 390]], color: 'violet' },
    { id: 'review', name: 'Review', action: 'Inspect results and changes', x: 1240, y: 638, pin: [1240, 557], box: [1055, 390, 402, 293], shape: 'polygon(0 30%,44% 0,100% 44%,58% 100%)', route: [[1004, 390], [1017, 528], [1080, 666]], color: 'violet' },
    { id: 'preview', name: 'Preview portal', action: 'Open the built candidate', x: 1210, y: 854, pin: [1210, 888], box: [1026, 710, 393, 233], shape: 'polygon(0 45%,51% 0,100% 48%,49% 100%)', route: [[1004, 390], [1017, 528], [1019, 705], [1071, 818]], color: 'teal' },
  ];
  const BY_ID = new Map(FACILITIES.map((facility) => [facility.id, facility]));
  // Display metadata from design/district-factions.json; it never binds a provider or grants a capability.
  const CULTURES = {
    research: { id: 'open-lantern', name: 'Open Lantern', glyph: '▤', label: 'Research', specialty: 'Read, explain and research', material: 'Translucent violet information panes' },
    build: { id: 'copper-patch', name: 'Copper Patch', glyph: '⌁', label: 'Build', specialty: 'Make and build useful changes', material: 'Reclaimed copper conduits' },
    test: { id: 'aster-measure', name: 'Aster Measure', glyph: '□', label: 'Checks', specialty: 'Check work against evidence', material: 'Pale ceramic instrument plates' },
    review: { id: 'harbor-reset', name: 'Harbor Reset', glyph: '↶', label: 'Recovery', specialty: 'Save, compare and recover work', material: 'Rounded steel archive cases' },
    preview: { id: 'prism-yard', name: 'Prism Yard', glyph: '◇', label: 'Preview', specialty: 'See and refine the built result', material: 'Slate display frames' },
  };
  const PHASE_NAMES = { research: 'Research', edit: 'Editing', build: 'Build', test: 'Testing', review: 'Review', idle: 'Idle', waiting: 'Waiting', error: 'Error' };
  const TERMINAL = new Set(['passed', 'failed', 'cancelled', 'interrupted', 'completed', 'timed_out']);
  const RUN_NAMES = { queued: 'Queued', starting: 'Starting session', working: 'Session active', building: 'Building', testing: 'Testing', passed: 'Checks passed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', completed: 'Completed', stopping: 'Stopping', termination_unknown: 'Process status unknown' };
  let nextId = 0;

  const text = (value, maximum = 180) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, maximum);
  const identity = (value) => text(typeof value === 'object' && value ? value.id || value.workerId || value.name : value, 160);
  const timestamp = (value) => { const number = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(number) ? number : 0; };
  const when = (record) => timestamp(record?.updated || record?.updatedAt || record?.at || record?.finished || record?.created || record?.lastSeen);
  const workerId = (record) => identity(record?.workerId || record?.worker || record?.provider || record?.id);
  const facilityFor = (phase) => phase === 'edit' || phase === 'build' ? 'build' : BY_ID.has(phase) ? phase : null;
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const copyFacilities = () => FACILITIES.map((facility) => ({ ...facility, pin: [...facility.pin], box: [...facility.box], route: facility.route.map((point) => [...point]) }));
  const worldPoint = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

  function hull(points) {
    const sorted = points.map((point) => ({ x: point.x, y: point.y })).sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = (values) => {
      const result = [];
      for (const point of values) {
        while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
        result.push(point);
      }
      return result;
    };
    return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  class DistrictScene {
    constructor({ container, onFacility, onWorker, onAssign } = {}) {
      if (!container || typeof container.append !== 'function') throw new TypeError('DistrictScene requires a container element.');
      this.container = container;
      this.onFacility = onFacility;
      this.onWorker = onWorker;
      this.onAssign = typeof onAssign === 'function' ? onAssign : null;
      this.closed = false;
      this.visible = true;
      this.unavailable = false;
      this.abort = new AbortController();
      this.workerNodes = new Map();
      this.facilityNodes = new Map();
      this.facilities = copyFacilities();
      this.byId = new Map(this.facilities.map((facility) => [facility.id, facility]));
      this.hub = { ...HUB };
      this.gpuWorld = null;
      this.gpuReady = false;
      this.gpuFailed = false;
      this.gpuLayout = null;
      this.gpuProjectionKey = '';
      this.gpuWorkerSignature = '';
      this.projectedWorkers = new Map();
      this.intersecting = typeof IntersectionObserver !== 'function';
      this.snapshot = {};
      this.camera = { x: 0, y: 0, scale: 1, fit: 1, mode: 'cover', modified: false };
      this.hasSize = false;
      this.projectId = null;
      this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery?.matches === true;
      this.root = element('div', 'dv-scene');
      this.root.dataset.testid = 'district-scene';
      this.root.dataset.worldReady = 'false';
      this.root.dataset.worldState = 'illustrated';
      this.root.getDistrictSceneDiagnostics = () => this.getDiagnostics();
      this.root.setAttribute('role', 'region');
      this.root.setAttribute('aria-label', 'Development district map');
      this.root.tabIndex = 0;
      const helpId = `dv-scene-help-${++nextId}`;
      this.root.setAttribute('aria-describedby', helpId);
      this.world = element('div', 'dv-scene-world');
      this.world.style.width = `${WIDTH}px`;
      this.world.style.height = `${HEIGHT}px`;
      const plate = element('img', 'dv-scene-plate');
      plate.src = 'assets/district.png';
      plate.alt = '';
      plate.draggable = false;
      plate.width = WIDTH;
      plate.height = HEIGHT;
      this.plate = plate;
      this.world.append(plate);
      this.worldHost = element('div', 'dv-scene-3d-host');
      this.worldHost.setAttribute('aria-hidden', 'true');
      this.world.append(this.worldHost);
      const atmosphere = element('div', 'dv-scene-atmosphere');
      atmosphere.setAttribute('aria-hidden', 'true');
      this.world.append(atmosphere);
      for (const facility of this.facilities) this._createFacility(facility);
      this.portal = this._createPortal();
      this.world.append(this.portal);
      this.root.append(this.world);
      this.legend = element('div', 'dv-scene-legend');
      this.legend.append(element('span', 'dv-scene-legend-dot'), element('span', '', 'Activity follows real reports and tools'));
      this.root.append(this.legend);
      this.notice = element('div', 'dv-scene-notice');
      this.notice.setAttribute('role', 'status');
      this.notice.setAttribute('aria-live', 'polite');
      this.root.append(this.notice);
      const help = element('p', 'dv-scene-sr', 'Select a building to inspect it. Drag empty ground to pan. Use plus, minus or the mouse wheel to zoom. Home fits the whole district; zero fills the district view. Tab reaches buildings and workers. Movement shows activity location, not task progress.');
      help.id = helpId;
      this.root.append(help);
      this.controls = element('div', 'dv-scene-controls');
      this.controls.setAttribute('role', 'group');
      this.controls.setAttribute('aria-label', 'District camera');
      this._control('−', 'Zoom out', () => this._zoom(1 / 1.2));
      this.scaleLabel = element('span', 'dv-scene-scale', 'Fit');
      this.scaleLabel.setAttribute('aria-hidden', 'true');
      this.controls.append(this.scaleLabel);
      this._control('+', 'Zoom in', () => this._zoom(1.2));
      this._control('⌂', 'Fit district (Home)', () => this.fit());
      this._control('◈', 'Fill district view (0)', () => this._cover());
      this.root.append(this.controls);
      container.append(this.root);
      this._listen(this.root, 'click', (event) => this._click(event));
      this._listen(this.root, 'pointerdown', (event) => this._pointerDown(event));
      this._listen(this.root, 'pointermove', (event) => this._pointerMove(event));
      this._listen(this.root, 'pointerup', (event) => this._pointerEnd(event, false));
      this._listen(this.root, 'pointercancel', (event) => this._pointerEnd(event, true));
      this._listen(this.root, 'lostpointercapture', (event) => this._pointerEnd(event, true));
      this._listen(this.root, 'wheel', (event) => {
        if (event.target.closest?.('.dv-scene-controls')) return;
        event.preventDefault();
        const rect = this.root.getBoundingClientRect();
        this._zoom(Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * 0.0025), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      }, { passive: false });
      this._listen(this.root, 'keydown', (event) => this._key(event));
      this._listen(document, 'visibilitychange', () => { if (document.visibilityState !== 'visible') this._finishMotion(); this._syncGPU(); });
      this._listen(this.worldHost, 'district-world-state', () => { if (!this.sendingGPUWorkers && !this.releasingGPU) this._syncGPUState(); }, { capture: true });
      this._listen(this.root, 'focusin', () => this._syncGPU());
      this._motionChange = (event) => { this.reducedMotion = event.matches; if (event.matches) this._finishMotion(); this._syncGPU(); };
      this.motionQuery?.addEventListener('change', this._motionChange);
      if (typeof ResizeObserver === 'function') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.root);
      }
      if (typeof IntersectionObserver === 'function') {
        this.intersectionObserver = new IntersectionObserver((entries) => {
          const entry = entries.find((item) => item.target === this.root);
          if (!entry || this.closed) return;
          this.intersecting = Boolean(entry.isIntersecting && (entry.intersectionRect?.width ?? 1) > 0 && (entry.intersectionRect?.height ?? 1) > 0);
          if (!this.intersecting) this._finishMotion();
          this._syncGPU();
        }, { threshold: 0 });
        this.intersectionObserver.observe(this.root);
      }
      this._cover();
    }

    _gpuVisible() {
      if (this.closed || !this.visible || !this.projectId || !this.intersecting || document.hidden || document.visibilityState && document.visibilityState !== 'visible') return false;
      if (this.root.isConnected === false || this.root.clientWidth < 1 || this.root.clientHeight < 1) return false;
      for (let node = this.root; node; node = node.parentElement) {
        if (node.hidden || getComputedStyle(node).display === 'none' || getComputedStyle(node).visibility === 'hidden') return false;
      }
      return true;
    }
    _syncGPU() {
      if (this.closed || this.syncingGPU) return;
      this.syncingGPU = true;
      try {
        if (!this._gpuVisible()) { this._releaseGPU(); return; }
        if (!this.gpuWorld && !this.gpuFailed && typeof window.DistrictAttractWorld?.mount === 'function') {
          try {
            this.gpuWorld = window.DistrictAttractWorld.mount({ container: this.worldHost, view: 'management' });
            if (typeof this.gpuWorld?.projectPoint !== 'function' || typeof this.gpuWorld?.getLayout !== 'function') {
              throw new Error('Management projection is unavailable.');
            }
            this.gpuWorld.setView?.('management');
            this.root.dataset.worldState = 'starting';
            this.gpuWorkerSignature = '';
          } catch {
            this.gpuFailed = true;
            this._releaseGPU();
            this.root.dataset.worldState = 'unavailable';
          }
        }
        if (this.gpuWorld) {
          this.gpuWorld.setPaused?.(this.reducedMotion);
          this._sendGPUWorkers();
          this._syncGPUState();
        }
      } finally { this.syncingGPU = false; }
    }
    _releaseGPU() {
      if (this.releasingGPU) return;
      this.releasingGPU = true;
      const current = this.gpuWorld;
      this.gpuWorld = null;
      this.gpuWorkerSignature = '';
      try { current?.setPaused?.(true); current?.destroy?.(); } catch { /* A failed GPU still leaves the keyboard/list controls. */ }
      this.releasingGPU = false;
      this._setGPUReady(false);
      if (!this.closed) this.root.dataset.worldState = this.gpuFailed ? 'unavailable' : 'illustrated';
    }
    _sendGPUWorkers() {
      if (!this.gpuWorld || this.sendingGPUWorkers) return;
      const records = (this.gpuWorkerRecords || []).map((record) => ({ id: record.id, workerId: record.workerId,
        activityKey: record.id, facility: record.facility, phase: record.phase, basis: record.basis,
        state: record.state, stale: record.stale === true, terminal: record.terminal === true,
        motionAllowed: record.motionAllowed === true, quietReason: record.quietReason || '' }));
      const signature = JSON.stringify(records);
      if (signature === this.gpuWorkerSignature) return;
      this.gpuWorkerSignature = signature;
      this.sendingGPUWorkers = true;
      try { this.gpuWorld.setWorkers?.(records); } catch { this.gpuWorkerSignature = ''; }
      finally { this.sendingGPUWorkers = false; }
    }
    _syncGPUState() {
      if (!this.gpuWorld || this.closed || this.projectingGPU || this.releasingGPU) return;
      let diagnostic, layout;
      try { diagnostic = this.gpuWorld.getDiagnostics(); layout = this.gpuWorld.getLayout(); }
      catch { this._setGPUReady(false); return; }
      const ready = diagnostic.ready === true && diagnostic.view === 'management'
        && layout && worldPoint(layout.hub) && this.facilities.every((facility) => worldPoint(layout.facilities?.[facility.id]));
      this.root.dataset.worldState = ready ? 'management' : diagnostic.contextLost ? 'context-lost' : diagnostic.phase === 'error' ? 'unavailable' : 'starting';
      if (!ready) { this._setGPUReady(false); return; }
      const key = JSON.stringify({ layout, workersReady: diagnostic.gpuWorkersReady === true });
      if (!this.gpuReady || key !== this.gpuProjectionKey) {
        this.gpuProjectionKey = key;
        this.gpuLayout = layout;
        this._projectLayout(layout, diagnostic.gpuWorkersReady === true);
      }
    }
    _project(point) {
      if (!worldPoint(point) || !this.gpuWorld) return null;
      try {
        const projected = this.gpuWorld.projectPoint(point);
        return projected && projected.visible !== false && Number.isFinite(projected.x) && Number.isFinite(projected.y)
          ? { x: projected.x, y: projected.y, visible: true } : null;
      } catch { return null; }
    }
    _projectLayout(layout, workersReady) {
      const projected = copyFacilities();
      const hub = this._project(layout.hub);
      if (!hub) { this._setGPUReady(false); this.root.dataset.worldState = 'projection-unavailable'; return; }
      for (const facility of projected) {
        const anchor = layout.facilities[facility.id], details = layout.facilityDetails?.[facility.id] || {};
        const entrance = this._project(details.entrance || anchor), pin = this._project(details.pin || anchor);
        if (!entrance || !pin) { this._setGPUReady(false); this.root.dataset.worldState = 'projection-unavailable'; return; }
        facility.x = entrance.x; facility.y = entrance.y;
        facility.pin = [pin.x, pin.y + (details.pin ? 10 : -70)];
        facility.worldAnchor = [...(details.entrance || anchor)];
        const corners = Array.isArray(details.footprintCorners) ? details.footprintCorners : Array.isArray(details.footprint) ? details.footprint : [];
        let points = corners.filter(worldPoint).map((point) => this._project(point)).filter(Boolean);
        if (worldPoint(details.bounds?.min) && worldPoint(details.bounds?.max)) {
          for (const x of [details.bounds.min[0], details.bounds.max[0]]) for (const y of [details.bounds.min[1], details.bounds.max[1]]) for (const z of [details.bounds.min[2], details.bounds.max[2]]) {
            const point = this._project([x, y, z]); if (point) points.push(point);
          }
        }
        // An exact roof pin and entrance always give a truthful selectable target,
        // even if an asset supplies no optional footprint envelope.
        points.push({ x: pin.x - 75, y: pin.y - 25 }, { x: pin.x + 75, y: pin.y - 25 },
          { x: entrance.x - 90, y: entrance.y + 35 }, { x: entrance.x + 90, y: entrance.y + 35 });
        points = hull(points);
        const left = Math.min(...points.map((point) => point.x)), top = Math.min(...points.map((point) => point.y));
        const width = Math.max(180, Math.max(...points.map((point) => point.x)) - left);
        const height = Math.max(120, Math.max(...points.map((point) => point.y)) - top);
        facility.box = [left, top, width, height];
        facility.shape = `polygon(${points.map((point) => `${(point.x - left) / width * 100}% ${(point.y - top) / height * 100}%`).join(',')})`;
        const route = Array.isArray(details.route) ? details.route.filter(worldPoint).map((point) => this._project(point)).filter(Boolean) : [];
        facility.route = route.map((point) => [point.x, point.y]);
      }
      this.facilities = projected; this.byId = new Map(projected.map((facility) => [facility.id, facility])); this.hub = hub;
      this.projectedWorkers = new Map();
      if (workersReady) for (const [id, point] of Object.entries(layout.workers || {})) {
        const position = this._project(point); if (position) this.projectedWorkers.set(id, position);
      }
      this.gpuReady = true;
      this.root.dataset.worldReady = 'true';
      for (const facility of this.facilities) this._layoutFacility(facility);
      if (this.drag) this._pointerEnd({ pointerId: this.drag.pointerId }, true);
      this._refreshProjection();
    }
    _setGPUReady(value) {
      const changed = this.gpuReady !== value;
      this.gpuReady = value; this.root.dataset.worldReady = String(value);
      if (value || !changed) return;
      this.facilities = copyFacilities(); this.byId = new Map(this.facilities.map((facility) => [facility.id, facility])); this.hub = { ...HUB };
      this.gpuLayout = null; this.gpuProjectionKey = ''; this.projectedWorkers.clear();
      for (const facility of this.facilities) this._layoutFacility(facility);
      if (this.drag) this._pointerEnd({ pointerId: this.drag.pointerId }, true);
      this._refreshProjection();
    }
    _refreshProjection() {
      if (this.projectingGPU || this.closed) return;
      this.projectingGPU = true;
      try {
        this._finishMotion();
        if (this.latestInput) this.update(this.latestInput);
        if (this.camera.mode === 'focus') this._focusFacility(this.camera.focus, false);
      } finally { this.projectingGPU = false; }
    }
    _layoutFacility(facility) {
      const entry = this.facilityNodes.get(facility.id);
      if (!entry) return;
      entry.facility = facility;
      const [x, y, width, height] = facility.box;
      Object.assign(entry.hit.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, clipPath: facility.shape });
      Object.assign(entry.pin.style, { left: `${facility.pin[0]}px`, top: `${facility.pin[1]}px` });
      Object.assign(entry.glow.style, { left: `${facility.x}px`, top: `${facility.y}px` });
      entry.hit.dataset.anchorMode = this.gpuReady ? 'projected-management' : 'illustrated-fallback';
      if (facility.worldAnchor) entry.hit.dataset.worldAnchor = JSON.stringify(facility.worldAnchor);
      else delete entry.hit.dataset.worldAnchor;
    }
    getDiagnostics() {
      let renderer = null;
      try { renderer = this.gpuWorld?.getDiagnostics?.() || null; } catch {}
      return { projectId: this.projectId, ready: this.gpuReady, intersecting: this.intersecting, visible: this.visible, unavailable: this.unavailable,
        mounted: Boolean(this.gpuWorld), camera: { ...this.camera }, renderer,
        layout: this.gpuLayout ? JSON.parse(JSON.stringify(this.gpuLayout)) : null };
    }
    setVisible(value) {
      if (this.closed) return;
      this.visible = value === true;
      if (!this.visible) this._finishMotion();
      this._syncGPU();
    }
    setUnavailable(value) {
      if (this.closed) return;
      this.unavailable = value === true;
      if (this.latestInput) this.update({ ...this.latestInput, unavailable: this.unavailable });
    }
    _listen(target, name, callback, options = {}) { target.addEventListener(name, callback, { ...options, signal: this.abort.signal }); }
    _control(label, title, callback) {
      const button = element('button', 'dv-scene-camera-button', label);
      button.type = 'button'; button.title = title; button.setAttribute('aria-label', title);
      button.addEventListener('click', callback, { signal: this.abort.signal }); this.controls.append(button);
    }
    _createFacility(facility) {
      const hit = element('button', `dv-facility-hit dv-facility-${facility.color}`);
      hit.type = 'button'; hit.dataset.facility = facility.id;
      hit.setAttribute('aria-label', `${facility.name}: ${facility.action}. Select to inspect.`);
      const [x, y, width, height] = facility.box;
      Object.assign(hit.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, clipPath: facility.shape });
      const glow = element('div', `dv-facility-groundlight dv-facility-${facility.color}`);
      glow.setAttribute('aria-hidden', 'true');
      Object.assign(glow.style, { left: `${facility.x}px`, top: `${facility.y}px` });
      const pin = element('div', `dv-facility-pin dv-facility-${facility.color}`);
      pin.setAttribute('aria-hidden', 'true');
      pin.dataset.facility = facility.id;
      Object.assign(pin.style, { left: `${facility.pin[0]}px`, top: `${facility.pin[1]}px` });
      pin.append(element('span', 'dv-facility-gem'), element('strong', '', facility.name));
      const status = element('span', 'dv-facility-count', 'Inspect'); pin.append(status);
      const culture = CULTURES[facility.id];
      const badge = element('span', 'dv-facility-culture', `${culture.glyph} ${culture.name}`);
      badge.dataset.culture = culture.id;
      badge.title = `${culture.name} · ${culture.specialty}. Material: ${culture.material}. Identity only; activity and results are shown separately.`;
      pin.append(badge);
      hit.title = `${facility.name} · ${culture.name}\n${culture.specialty}\n${culture.material}`;
      this.world.append(glow, hit, pin);
      this.facilityNodes.set(facility.id, { hit, pin, status, glow, facility });
    }
    _createPortal() {
      const portal = element('div', 'dv-preview-beacon');
      portal.setAttribute('aria-hidden', 'true');
      const fallback = element('span', 'dv-preview-fallback');
      fallback.append(element('span', 'dv-preview-ring'), element('span', 'dv-preview-window'), element('span', 'dv-preview-base'));
      const image = element('img', 'dv-preview-render');
      image.alt = ''; image.draggable = false; image.width = 235; image.height = 235;
      image.addEventListener('load', () => portal.classList.add('is-rendered'), { signal: this.abort.signal });
      image.addEventListener('error', () => { image.hidden = true; portal.classList.remove('is-rendered'); }, { signal: this.abort.signal });
      image.src = 'assets/district-v2/preview-portal.png';
      portal.append(fallback, image);
      return portal;
    }
    _emit(callback, value) {
      if (typeof callback !== 'function' || this.closed) return;
      try { const result = callback(value); if (result?.catch) result.catch((error) => this._announce(text(error?.message || error))); }
      catch (error) { this._announce(text(error?.message || error)); }
    }
    _announce(message) { if (!this.closed) setText(this.notice, message); }
    _requestAssignment(worker, facility) {
      if (!this.projectId || this.unavailable || !this.byId.has(facility) || ![...this.workerNodes.values()].some((record) => record.workerId === worker && record.canAssign)) return;
      this._announce(`${this.byId.get(facility)?.name || 'Building'} action requested. Task controls show whether work starts.`);
      this._emit(this.onAssign, { worker, facility });
    }
    _click(event) {
      if (performance.now() < (this.suppressClickUntil || 0)) return;
      const worker = event.target.closest?.('[data-district-worker]');
      if (worker) { const record = this.workerNodes.get(worker.dataset.districtWorker); if (record) this._emit(this.onWorker, record.workerId); return; }
      const facility = event.target.closest?.('[data-facility]');
      if (facility) { this._focusFacility(facility.dataset.facility, true); this._emit(this.onFacility, facility.dataset.facility); }
    }
    _safeArea() {
      const style = getComputedStyle(this.root);
      const read = (side) => Math.max(0, parseFloat(style.getPropertyValue(`--dv-scene-inset-${side}`)) || 0);
      const width = this.root.clientWidth || this.container.clientWidth, height = this.root.clientHeight || this.container.clientHeight;
      let left = read('left'), right = read('right'), top = read('top'), bottom = read('bottom');
      const horizontal = left + right, vertical = top + bottom;
      const horizontalRoom = Math.max(0, width - Math.min(160, width)), verticalRoom = Math.max(0, height - Math.min(160, height));
      if (horizontal > horizontalRoom && horizontal > 0) { const ratio = horizontalRoom / horizontal; left *= ratio; right *= ratio; }
      if (vertical > verticalRoom && vertical > 0) { const ratio = verticalRoom / vertical; top *= ratio; bottom *= ratio; }
      return { x: left, y: top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom), fullWidth: width, fullHeight: height };
    }
    fit() {
      if (this.closed) return;
      const area = this._safeArea();
      if (area.fullWidth < 1 || area.fullHeight < 1) return;
      const topBand = Math.max(0, 48 - area.y), bottomBand = Math.min(74, area.height * 0.25);
      const content = { x: area.x + 8, y: area.y + topBand, width: Math.max(1, area.width - 16), height: Math.max(1, area.height - topBand - bottomBand) };
      const scale = Math.min(content.width / WIDTH, content.height / HEIGHT) * 0.98;
      this.camera = { x: content.x + (content.width - WIDTH * scale) / 2, y: content.y + (content.height - HEIGHT * scale) / 2, scale, fit: scale, mode: 'fit', modified: false };
      this.hasSize = true;
      this._applyCamera();
    }
    _cover() {
      if (this.closed) return;
      const area = this._safeArea();
      if (area.fullWidth < 1 || area.fullHeight < 1) return;
      const scale = Math.max(area.fullWidth / WIDTH, area.fullHeight / HEIGHT) * 1.01;
      this.camera = { x: (area.fullWidth - WIDTH * scale) / 2, y: (area.fullHeight - HEIGHT * scale) / 2, scale, fit: Math.min(area.width / WIDTH, area.height / HEIGHT) * 0.98, mode: 'cover', modified: false };
      this.hasSize = true; this._applyCamera();
    }
    resize() {
      if (this.closed) return;
      this._syncGPU();
      if (!this.hasSize || this.camera.mode === 'cover') this._cover();
      else if (this.camera.mode === 'fit') this.fit();
      else if (this.camera.mode === 'focus') this._focusFacility(this.camera.focus, false);
      else { this._constrainCamera(); this._applyCamera(); }
    }
    _focusFacility(id, animate = false) {
      const facility = this.byId.get(id);
      if (!facility || !this.hasSize || this.closed) return;
      const area = this._safeArea();
      this.camera.x = area.x + area.width / 2 - facility.x * this.camera.scale;
      this.camera.y = area.y + area.height / 2 - (facility.y - 55) * this.camera.scale;
      this.camera.mode = 'focus'; this.camera.focus = id; this.camera.modified = false;
      this._constrainCamera(); this._applyCamera(animate);
    }
    _applyCamera(animate = false) {
      if (this.closed) return;
      const previous = animate ? getComputedStyle(this.world).transform || this.world.style.transform : null;
      this.cameraMotion?.cancel(); this.cameraMotion = null;
      this.world.style.transform = `translate3d(${this.camera.x}px,${this.camera.y}px,0) scale(${this.camera.scale})`;
      if (this.hitScale !== this.camera.scale) {
        this.world.style.setProperty('--dv-worker-hit-size', `${Math.max(72, Math.ceil(44 / this.camera.scale))}px`);
        this.hitScale = this.camera.scale;
      }
      setText(this.scaleLabel, `${Math.round(this.camera.scale * 100)}%`);
      if (animate && previous && !this.reducedMotion && document.visibilityState === 'visible' && typeof this.world.animate === 'function') {
        const motion = this.world.animate([{ transform: previous }, { transform: this.world.style.transform }], { duration: 420, iterations: 1, easing: 'cubic-bezier(.2,.7,.2,1)' });
        this.cameraMotion = motion; motion.finished.then(() => { if (this.cameraMotion === motion) this.cameraMotion = null; }, () => {});
      }
    }
    _constrainCamera() {
      const area = this._safeArea(), slack = Math.min(100, area.width * 0.2);
      const width = WIDTH * this.camera.scale, height = HEIGHT * this.camera.scale;
      this.camera.x = width < area.width ? area.x + (area.width - width) / 2 : Math.max(area.x + area.width - width - slack, Math.min(area.x + slack, this.camera.x));
      this.camera.y = height < area.height ? area.y + (area.height - height) / 2 : Math.max(area.y + area.height - height - slack, Math.min(area.y + slack, this.camera.y));
    }
    _zoom(factor, point) {
      if (!this.hasSize || this.closed) return;
      const area = this._safeArea(), center = point || { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      const coverScale = Math.max(area.fullWidth / WIDTH, area.fullHeight / HEIGHT);
      const old = this.camera.scale, next = Math.max(this.camera.fit * 0.8, Math.min(Math.max(this.camera.fit * 3.5, coverScale * 2), old * factor));
      this.camera.x = center.x - (center.x - this.camera.x) * next / old;
      this.camera.y = center.y - (center.y - this.camera.y) * next / old;
      this.camera.scale = next; this.camera.modified = true; this.camera.mode = 'custom'; this._constrainCamera(); this._applyCamera();
    }
    _point(event) { const rect = this.root.getBoundingClientRect(); return { x: (event.clientX - rect.left - this.camera.x) / this.camera.scale, y: (event.clientY - rect.top - this.camera.y) / this.camera.scale }; }
    _pointerDown(event) {
      if (event.button !== 0 || this.drag || event.target.closest?.('.dv-scene-controls')) return;
      const button = event.target.closest?.('[data-district-worker]');
      if (event.target.closest?.('[data-facility]')) return;
      const record = button ? this.workerNodes.get(button.dataset.districtWorker) : null;
      if (record && !record.canAssign) return;
      this.drag = { pointerId: event.pointerId, record, startX: event.clientX, startY: event.clientY, cameraX: this.camera.x, cameraY: this.camera.y, moved: false };
      this.root.setPointerCapture?.(event.pointerId);
      if (!record) event.preventDefault();
    }
    _pointerMove(event) {
      const drag = this.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      drag.moved = true;
      if (drag.record) {
        this._stopMotion(drag.record);
        drag.record.node.classList.add('is-dragging');
        const point = this._point(event); this._place(drag.record, point);
        const target = this._dropFacility(event);
        for (const [id, entry] of this.facilityNodes) entry.hit.classList.toggle('is-drop-target', target === id);
      } else {
        this.camera.x = drag.cameraX + event.clientX - drag.startX;
        this.camera.y = drag.cameraY + event.clientY - drag.startY;
        this.camera.modified = true; this.camera.mode = 'custom'; this._constrainCamera(); this._applyCamera(); this.root.classList.add('is-panning');
      }
      event.preventDefault();
    }
    _dropFacility(event) {
      const under = document.elementFromPoint?.(event.clientX, event.clientY);
      const hit = under?.closest?.('[data-facility]');
      return hit && this.root.contains(hit) ? hit.dataset.facility : null;
    }
    _pointerEnd(event, cancelled) {
      const drag = this.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this.drag = null;
      const facility = drag.moved && drag.record && !cancelled ? this._dropFacility(event) : null;
      if (this.root.hasPointerCapture?.(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
      this.root.classList.remove('is-panning');
      for (const entry of this.facilityNodes.values()) entry.hit.classList.remove('is-drop-target');
      if (drag.record) { drag.record.node.classList.remove('is-dragging'); this._place(drag.record, drag.record.target); }
      if (drag.moved) {
        this.suppressClickUntil = performance.now() + 350;
        if (facility) this._requestAssignment(drag.record.workerId, facility);
        else if (drag.record && !cancelled) this._announce('No assignment was made. Drop the worker on a building or use the task controls.');
      }
    }
    _key(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape' && this.drag) { this._pointerEnd({ pointerId: this.drag.pointerId }, true); event.preventDefault(); return; }
      const focused = event.target.closest?.('[data-facility]');
      if (focused && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        const index = FACILITIES.findIndex((facility) => facility.id === focused.dataset.facility), forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        this.facilityNodes.get(FACILITIES[(index + (forward ? 1 : -1) + FACILITIES.length) % FACILITIES.length].id).hit.focus();
        event.preventDefault(); return;
      }
      if (event.key === '+' || event.key === '=') { this._zoom(1.2); event.preventDefault(); }
      else if (event.key === '-') { this._zoom(1 / 1.2); event.preventDefault(); }
      else if (event.key === 'Home') { this.fit(); event.preventDefault(); }
      else if (event.key === '0') { this._cover(); event.preventDefault(); }
      else if (event.target === this.root && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        this.camera.x += event.key === 'ArrowLeft' ? 55 : event.key === 'ArrowRight' ? -55 : 0;
        this.camera.y += event.key === 'ArrowUp' ? 55 : event.key === 'ArrowDown' ? -55 : 0;
        this.camera.modified = true; this.camera.mode = 'custom'; this._constrainCamera(); this._applyCamera(); event.preventDefault();
      }
    }

    _createWorker(id) {
      const node = element('div', 'dv-scene-worker'); node.dataset.worker = id;
      const button = element('button', 'dv-worker-button'); button.type = 'button'; button.dataset.districtWorker = id;
      const shadow = element('span', 'dv-worker-ground');
      const art = element('img', 'dv-worker-art'); art.src = 'assets/district-v2/worker-engineer.png'; art.alt = ''; art.draggable = false;
      const fallback = element('span', 'dv-worker-fallback', '◈'); fallback.setAttribute('aria-hidden', 'true'); fallback.hidden = true;
      art.addEventListener('error', () => { art.hidden = true; fallback.hidden = false; }, { signal: this.abort.signal });
      const label = element('span', 'dv-worker-label'), name = element('strong'), status = element('span', 'dv-worker-status'); label.append(name, status);
      const bubble = element('span', 'dv-worker-message'); bubble.setAttribute('aria-hidden', 'true');
      button.append(shadow, fallback, art, label, bubble); node.append(button); this.world.append(node);
      return { id, node, button, art, ground: shadow, nameNode: name, statusNode: status, bubble, position: { ...this.hub }, target: { ...this.hub }, facility: null };
    }
    _workerState(worker, activities, runs) {
      if (typeof window.DistrictWorldState?.workerState === 'function') {
        const result = window.DistrictWorldState.workerState(worker, activities, runs, { projectId: this.projectId, unavailable: this.unavailable });
        return { ...result, terminal: Boolean(result.terminal), canAssign: Boolean(this.onAssign) && !this.unavailable && result.canAssign };
      }
      const id = worker.id;
      const activity = activities.filter((record) => workerId(record) === id).sort((a, b) => when(b) - when(a) || (b.sourceSeq || 0) - (a.sourceSeq || 0))[0];
      const run = runs.filter((record) => workerId(record) === id).sort((a, b) => when(b) - when(a))[0];
      const ended = run && TERMINAL.has(run.state);
      const protectedState = run && ['stopping', 'termination_unknown', 'building', 'testing'].includes(run.state);
      const sameRun = activity && run && activity.runId === run.id
        && ['attemptId', 'sessionId'].every((field) => !activity[field] || !run[field] || activity[field] === run[field]);
      const activityIsAfterRun = !run || sameRun && !ended && !protectedState;
      const chosenActivity = activityIsAfterRun ? activity : null;
      const phase = text(chosenActivity?.phase || (run?.state === 'building' ? 'build' : run?.state === 'testing' || run?.state === 'passed' ? 'test' : run?.phase || ''), 30);
      const basis = chosenActivity ? ['observed', 'reported', 'inferred'].includes(chosenActivity.basis) ? chosenActivity.basis : 'reported' : run ? 'observed' : null;
      const missingRun = Boolean(chosenActivity?.runId && !sameRun);
      const stale = missingRun || chosenActivity?.stale === true || chosenActivity?.freshness === 'stale' || chosenActivity?.status === 'stale' || chosenActivity?.freshness === 'unknown' || run?.state === 'termination_unknown';
      const terminalActivity = Boolean(chosenActivity?.terminal === true && sameRun && ended && !missingRun && basis === 'observed'
        && chosenActivity.status === (run.state === 'passed' ? 'completed' : run.state));
      const label = chosenActivity ? `${basis === 'observed' ? 'Observed' : basis === 'inferred' ? 'Inferred' : 'Agent-reported'} · ${PHASE_NAMES[phase] || 'Activity'}${terminalActivity ? ` · ${text(chosenActivity.status, 30)}` : ''}${!chosenActivity.projectId ? ' · Unlinked project' : ''}` : run ? `Observed · ${RUN_NAMES[run.state] || text(run.state, 40)}` : worker.available === false ? 'CLI unavailable' : worker.passive ? 'No recent activity' : worker.available === true ? 'CLI detected · No task' : 'Availability unknown';
      const terminal = Boolean(terminalActivity || ended && !chosenActivity);
      const state = run && (!chosenActivity || chosenActivity.runId === run.id) ? run.state : terminal ? chosenActivity?.status : chosenActivity ? stale ? 'stale' : ['idle', 'waiting', 'error'].includes(phase) ? phase : 'active' : 'idle';
      return { activity: chosenActivity, run, phase, basis, state: missingRun ? 'unknown' : state, stale,
        label: missingRun ? `${label} · Run unavailable` : stale ? `${label} · Stale` : label,
        facility: missingRun ? null : facilityFor(phase), terminal,
        motionAllowed: !stale && !terminal && !this.unavailable && Boolean(run) && !['stopping', 'termination_unknown'].includes(run.state)
          && ['working', 'running', 'active', 'building', 'testing'].includes(state) && ['reported', 'observed'].includes(basis),
        message: text(chosenActivity?.message || run?.detail || worker.detail || '', 180), at: when(chosenActivity || run), canAssign: !!this.onAssign && !this.unavailable && !worker.passive && worker.available !== false && worker.canAssign !== false };
    }
    _projectionRows(project, workers, activities, runs, now) {
      const roster = new Map();
      for (const worker of Array.isArray(workers) ? workers : []) {
        const id = identity(worker); if (id) roster.set(id, { ...worker, id, name: text(worker.name || id, 70) });
      }
      if (typeof window.DistrictWorldState?.project === 'function') {
        const rows = window.DistrictWorldState.project({ projects: project ? [project] : [], providers: [...roster.values()], activities, runs,
          unavailable: this.unavailable }, this.projectId, { now, unavailable: this.unavailable });
        const seen = new Set();
        return (Array.isArray(rows) ? rows : []).flatMap((row) => {
          const id = identity(row), key = identity(row.renderId || row.activityKey || id);
          if (!id || !key || seen.has(key) || row.projectId && row.projectId !== this.projectId) return [];
          seen.add(key);
          const worker = { ...(roster.get(id) || { id, passive: true }), ...row, id, name: text(row.name || roster.get(id)?.name || id, 70) };
          const sameScope = (record) => workerId(record) === id
            && ['attemptId', 'sessionId'].every((field) => !row[field] || !record[field] || row[field] === record[field]);
          // The shared projector has already resolved evidence precedence. Only
          // reattach its selected event, never the latest prose for this provider.
          const activity = row.activity || activities.find((record) => sameScope(record)
            && (row.runId ? record.runId === row.runId : !record.runId)
            && (row.eventId ? (record.eventId || record.id) === row.eventId
              : !row.terminal && record.phase === row.phase && record.basis === row.basis && when(record) === row.at)) || null;
          const run = row.run || (row.runId ? runs.find((record) => sameScope(record) && record.id === row.runId) : null) || null;
          const state = { ...row, activity: ['idle', 'unavailable'].includes(row.state) ? null : activity,
            run: row.runId || !['idle', 'unavailable'].includes(row.state) ? run : null,
            terminal: Boolean(row.terminal), at: row.at || when(activity || run),
            canAssign: Boolean(this.onAssign) && !this.unavailable && !worker.passive && worker.available !== false && worker.canAssign !== false };
          return [{ key, worker, state }];
        }).slice(0, 32);
      }
      for (const record of [...activities, ...runs]) {
        const id = identity(record.workerId || record.worker || record.provider);
        if (id && !roster.has(id)) roster.set(id, { id, name: text(record.workerName || id, 70), passive: true });
      }
      return [...roster.values()].map((worker) => ({ key: worker.id, worker, state: this._workerState(worker, activities, runs) }))
        .filter(({ worker, state }) => !worker.passive || !state.terminal).slice(0, 32);
    }
    update({ project, workers = [], activities = [], runs = [], selectedWorker, selectedFacility, selectedFacilities = [], unavailable = this.unavailable, now = Date.now() } = {}) {
      if (this.closed) return;
      this.unavailable = unavailable === true;
      if (!this.projectingGPU) this.latestInput = { project, workers, activities, runs, selectedWorker, selectedFacility, selectedFacilities, unavailable, now };
      const previousFacility = identity(this.snapshot.selectedFacility);
      const nextProject = identity(project), changedProject = nextProject !== this.projectId; this.projectId = nextProject;
      if (changedProject && this.drag) this._pointerEnd({ pointerId: this.drag.pointerId }, true);
      this.snapshot = { project, selectedWorker, selectedFacility };
      const highlighted = new Set((Array.isArray(selectedFacilities) ? selectedFacilities : []).map(identity).filter((id) => BY_ID.has(id)));
      const relevant = (record) => Boolean(nextProject && record && typeof record.projectId === 'string' && identity(record.projectId) === nextProject);
      activities = Array.isArray(activities) ? activities.filter(relevant).sort((a, b) => when(b) - when(a)).slice(0, 1000) : [];
      runs = Array.isArray(runs) ? runs.filter(relevant).sort((a, b) => when(b) - when(a)).slice(0, 200) : [];
      const projections = nextProject ? this._projectionRows(project, workers, activities, runs, now) : [];
      for (const { state } of projections) {
        state.stale = Boolean(state.stale || this.unavailable);
        state.terminal = Boolean(state.terminal);
        state.motionAllowed = !state.stale && !state.terminal && !this.unavailable && (state.motionAllowed === true
          || state.motionAllowed === undefined && ['working', 'running', 'active', 'building', 'testing'].includes(state.state) && ['reported', 'observed'].includes(state.basis));
        if (this.unavailable) { state.label = `Unknown · last recorded: ${text(state.label || 'No current activity', 135)}`; state.state = 'unknown'; state.facility = null; }
      }
      this.gpuWorkerRecords = projections.map(({ key, worker, state }) => ({ id: key, workerId: worker.id, facility: state.facility,
        phase: state.phase, basis: state.basis, state: state.state || 'idle', stale: state.stale, terminal: state.terminal,
        motionAllowed: state.motionAllowed, quietReason: state.quietReason || (state.stale ? 'stale' : state.terminal ? 'terminal' : '') }));
      if (!this.projectingGPU) this._syncGPU();
      const occupied = new Map(), counts = new Map();
      const wanted = new Set();
      for (const { key, worker, state } of projections) {
        wanted.add(key);
        let record = this.workerNodes.get(key);
        const fresh = !record;
        if (!record) { record = this._createWorker(key); this.workerNodes.set(key, record); }
        record.workerId = worker.id; record.name = worker.name; record.canAssign = state.canAssign;
        const facility = state.facility || null, slotKey = facility || 'idle';
        const index = occupied.get(slotKey) || 0; occupied.set(slotKey, index + 1);
        const anchor = this.byId.get(facility) || this.hub;
        const offset = !facility ? { x: index % 3 * 155 - 105, y: Math.floor(index / 3) * 92 + index % 3 * 10 } : index === 0 ? { x: 0, y: 0 } : { x: (index % 2 ? 1 : -1) * (145 + Math.floor(index / 2) * 25), y: 32 + Math.floor(index / 2) * 65 };
        const gpuPosition = this.gpuReady ? this.projectedWorkers.get(key) : null;
        const target = gpuPosition || { x: anchor.x + offset.x, y: anchor.y + offset.y };
        if (facility && (state.activity || state.run)) {
          const count = counts.get(facility) || { observed: 0, reported: 0, inferred: 0, terminal: 0, stale: 0 };
          if (state.terminal) count.terminal++; else count[state.basis || 'reported']++;
          if (state.stale) count.stale++; counts.set(facility, count);
        }
        setText(record.nameNode, worker.name); setText(record.statusNode, state.label);
        setText(record.bubble, state.message.length > 84 ? `${state.message.slice(0, 83)}…` : state.message);
        record.bubble.hidden = !state.message || (!state.activity && identity(selectedWorker) !== worker.id);
        record.button.setAttribute('aria-pressed', String(identity(selectedWorker) === worker.id));
        record.button.setAttribute('aria-label', `${worker.name}. ${state.label}. ${state.message}${state.canAssign ? ' Drag to a building to request assignment.' : ''}`);
        record.button.title = `${worker.name} — ${state.label}${state.message ? `\n${state.message}` : ''}`;
        record.node.classList.toggle('is-selected', identity(selectedWorker) === worker.id);
        record.node.classList.toggle('is-stale', state.stale); record.node.classList.toggle('is-terminal', state.terminal);
        record.node.classList.toggle('is-unavailable', worker.available === false && !state.run && !state.activity);
        record.node.classList.toggle('is-assignable', state.canAssign);
        record.node.classList.toggle('is-gpu-worker', Boolean(gpuPosition));
        record.node.dataset.basis = state.basis || 'none'; record.node.dataset.phase = state.phase || 'idle';
        if (this.drag?.record !== record) this._move(record, target, facility, !state.motionAllowed || Boolean(gpuPosition) || this.projectingGPU || fresh || changedProject || !state.activity && !state.run);
        record.facility = facility; record.target = target;
        this._signal(record, state);
      }
      for (const [id, record] of this.workerNodes) if (!wanted.has(id)) { if (this.drag?.record === record) this._pointerEnd({ pointerId: this.drag.pointerId }, true); this._stopMotion(record); record.signal?.cancel(); record.node.remove(); this.workerNodes.delete(id); }
      for (const [id, entry] of this.facilityNodes) {
        const count = counts.get(id), selected = identity(selectedFacility) === id || highlighted.has(id), primary = identity(selectedFacility) === id;
        let description = 'Inspect';
        if (count) description = [count.observed ? `${count.observed} observed` : '', count.reported ? `${count.reported} reported` : '', count.inferred ? `${count.inferred} inferred` : '', count.terminal ? `${count.terminal} finished` : '', count.stale ? 'stale' : ''].filter(Boolean).join(' · ');
        setText(entry.status, description);
        entry.hit.setAttribute('aria-pressed', String(selected)); entry.hit.setAttribute('aria-label', `${entry.facility.name}: ${entry.facility.action}. ${description}. ${CULTURES[id].name}, ${CULTURES[id].label} identity. Select to inspect.`);
        entry.hit.classList.toggle('is-selected', selected); entry.pin.classList.toggle('is-selected', selected);
        entry.pin.classList.toggle('is-primary', primary); entry.glow.classList.toggle('is-selected', selected);
        entry.pin.dataset.active = String(!!count && count.observed + count.reported + count.inferred > 0);
      }
      if (!changedProject && previousFacility && previousFacility !== identity(selectedFacility)) this._focusFacility(identity(selectedFacility), true);
      const activityCount = projections.filter(({ state }) => state.activity || state.run && !state.terminal).length;
      this.root.dataset.hasActivity = String(activityCount > 0);
      this.root.dataset.hasProject = String(!!project);
      this.legend.title = `${projections.length} scoped worker tasks shown. Positions show activity location; movement does not measure progress.`;
      if (!project && !activityCount) this._announce('Create a project to begin. Buildings open their details; they do not start work by themselves.');
      else if (this.notice.textContent.startsWith('Create a project')) this._announce('');
    }
    _place(record, point) {
      record.position = point;
      record.node.style.transform = `translate3d(${point.x}px,${point.y}px,0)`;
      record.node.style.zIndex = String(100 + Math.round(point.y));
    }
    _signal(record, state) {
      if (!state.motionAllowed) { record.signal?.cancel(); record.signal = null; return; }
      const signal = state.activity ? text(state.activity.eventId || state.activity.id || `${state.phase}:${state.at}:${state.message}`, 240) : state.run ? `${state.run.id}:${state.run.state}` : null;
      if (!signal || record.lastSignal === signal) return;
      record.lastSignal = signal;
      record.signal?.cancel(); record.signal = null;
      if (!state.motionAllowed || state.terminal || state.stale || this.reducedMotion || !this._gpuVisible() || typeof record.ground.animate !== 'function') return;
      const animation = record.ground.animate([{ opacity: 0.55, transform: 'translate(-50%,50%) scale(1)' }, { opacity: 1, transform: 'translate(-50%,50%) scale(1.4)' }, { opacity: 0.55, transform: 'translate(-50%,50%) scale(1)' }], { duration: 650, iterations: 1, easing: 'ease-out' });
      record.signal = animation;
      animation.finished.then(() => { if (record.signal === animation) record.signal = null; }, () => {});
    }
    _stopMotion(record) { record.motion?.cancel(); record.step?.cancel(); record.motion = null; record.step = null; record.node.classList.remove('is-moving'); }
    _finishMotion() { this.cameraMotion?.cancel(); this.cameraMotion = null; for (const record of this.workerNodes.values()) { this._stopMotion(record); record.signal?.cancel(); record.signal = null; if (this.drag?.record !== record) this._place(record, record.target); } }
    _move(record, target, facility, immediate) {
      if (distance(record.target, target) < 1 && record.facility === facility && !immediate) return;
      let from = record.position;
      if (record.motion && typeof DOMMatrixReadOnly === 'function') {
        try { const matrix = new DOMMatrixReadOnly(getComputedStyle(record.node).transform); from = { x: matrix.m41, y: matrix.m42 }; } catch {}
      }
      this._stopMotion(record);
      if (immediate || this.reducedMotion || !this._gpuVisible() || typeof record.node.animate !== 'function' || distance(from, target) < 5) { this._place(record, target); return; }
      const route = (id) => [this.hub, ...(this.byId.get(id)?.route || []).map(([x, y]) => ({ x, y }))];
      const points = (record.facility === facility ? [from, target] : [from, ...route(record.facility).reverse(), ...route(facility).slice(1), target]).filter((point, index, array) => index === 0 || distance(point, array[index - 1]) > 1);
      let total = 0; const lengths = [0]; for (let index = 1; index < points.length; index++) { total += distance(points[index - 1], points[index]); lengths.push(total); }
      const duration = Math.max(450, Math.min(1800, total * 1.25));
      this._place(record, target); record.node.classList.add('is-moving');
      const motion = record.node.animate(points.map((point, index) => ({ transform: `translate3d(${point.x}px,${point.y}px,0)`, zIndex: String(100 + Math.round(point.y)), offset: lengths[index] / total })), { duration, easing: 'linear' });
      record.motion = motion;
      record.step = record.art.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], { duration: 180, iterations: Math.ceil(duration / 180) });
      motion.finished.then(() => { if (record.motion === motion) { this._stopMotion(record); this._place(record, record.target); } }, () => {});
    }
    destroy() {
      if (this.closed) return;
      this.closed = true; this.abort.abort(); this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect(); this.cameraMotion?.cancel();
      this._releaseGPU();
      this.motionQuery?.removeEventListener('change', this._motionChange);
      this._finishMotion(); this.workerNodes.clear(); this.facilityNodes.clear(); this.drag = null; this.root.remove();
    }
  }
  window.DistrictScene = DistrictScene;
})();
