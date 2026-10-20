(function () {
  'use strict';
  let instances = 0;
  const KEYS = ['x', 'y', 'width', 'height'];
  const MINIMUM = { minWidth: 320, minHeight: 200 };
  const safeText = (value, limit = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit) : '';
  const copyRect = (value) => value && typeof value === 'object' ? Object.fromEntries(KEYS.map((key) => [key, value[key]])) : null;
  const validRect = (value) => value && KEYS.every((key) => Number.isFinite(value[key])) && value.width > 0 && value.height > 0 && Math.max(...KEYS.map((key) => Math.abs(value[key]))) <= 10000000;
  const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
  const percent = (value) => Number.isFinite(value) ? String(Math.round(value * 10000) / 100) : '';
  const number = (value) => Math.round(value).toLocaleString();
  const errorText = (error) => safeText(String(error?.message || error?.error || error || 'The area was not saved.'), 1000);

  class DistrictScreenPicker {
    constructor({ onApply } = {}) {
      if (typeof onApply !== 'function') throw new TypeError('DistrictScreenPicker requires onApply.');
      this.onApply = onApply;
      this.doc = document;
      this.id = `district-screen-picker-${++instances}`;
      this.listeners = [];
      this.pending = false;
      this.destroyed = false;
      this.isOpen = false;
      this.epoch = 0;
      this._build();
    }

    _el(tag, className, text, attributes) {
      const node = this.doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      if (attributes) for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      return node;
    }
    _on(node, type, listener) {
      node.addEventListener(type, listener);
      this.listeners.push(() => node.removeEventListener(type, listener));
    }
    _button(text, className = 'dsp-button', attributes) { return this._el('button', className, text, { type: 'button', ...attributes }); }
    _say(message, error = false) {
      this.notice.textContent = message;
      this.notice.dataset.tone = error ? 'error' : 'info';
    }
    _build() {
      const el = this._el.bind(this);
      this.dialog = el('dialog', 'dsp-dialog dv-theme', undefined, { 'aria-labelledby': `${this.id}-title`, 'aria-describedby': `${this.id}-intro` });
      const head = el('header', 'dsp-head');
      const titleBlock = el('div', 'dsp-title-block');
      titleBlock.append(el('span', 'dsp-eyebrow', 'CYBERDECK / SCREEN ROUTING'));
      titleBlock.append(el('h2', '', 'Choose the real test area', { id: `${this.id}-title` }));
      this.projectName = el('p', 'dsp-project'); titleBlock.append(this.projectName);
      this.closeButton = this._button('Close', 'dsp-button dsp-close', { 'aria-label': 'Close area picker without saving' });
      head.append(titleBlock, this.closeButton);
      const intro = el('p', 'dsp-intro', 'Choose a physical monitor, then click a quadrant or third, draw an area, or enter percentages. Areas stay inside that monitor; they are not additional monitors. Only Assign area saves your selection.', { id: `${this.id}-intro` });
      const body = el('div', 'dsp-body');
      const main = el('section', 'dsp-main', undefined, { 'aria-label': 'Graphical monitor area selector' });
      const topologyHead = el('div', 'dsp-section-head');
      topologyHead.append(el('h3', '', 'Your connected monitors'), el('span', 'dsp-quiet', 'Arrangement in logical units'));
      this.topology = el('div', 'dsp-topology', undefined, { role: 'group', 'aria-label': 'Choose a connected monitor' });
      main.append(topologyHead, this.topology);
      const modes = el('div', 'dsp-mode-bar', undefined, { role: 'group', 'aria-label': 'How to select an area' });
      this.modeButtons = new Map();
      for (const [id, label] of [['quadrants', 'Click quadrants'], ['thirds', 'Click thirds'], ['draw', 'Draw area']]) {
        const button = this._button(label, 'dsp-button dsp-mode', { 'data-mode': id, 'aria-pressed': 'false' });
        modes.append(button); this.modeButtons.set(id, button);
      }
      this.monitorHeading = el('h3', 'dsp-monitor-heading', 'Select a monitor above');
      this.monitorMetrics = el('p', 'dsp-monitor-metrics');
      this.bezel = el('div', 'dsp-bezel');
      this.glass = el('div', 'dsp-screen-glass');
      this.systemLabel = el('span', 'dsp-system-label', 'System area excluded');
      this.workArea = el('div', 'dsp-work-area', undefined, { tabindex: '0', role: 'group', 'aria-label': 'Choose an area in the monitor work area', 'aria-describedby': `${this.id}-diagram-help` });
      this.guide = el('div', 'dsp-guide');
      this.ghostLayer = el('div', 'dsp-ghost-layer', undefined, { 'aria-hidden': 'true' });
      this.selection = el('div', 'dsp-selection');
      const selectedChrome = el('div', 'dsp-selection-title');
      selectedChrome.append(el('span', 'dsp-window-mark', '▣'), el('span', '', 'PROJECT AREA'));
      this.selectionName = el('strong', 'dsp-selection-name');
      this.selection.append(selectedChrome, this.selectionName, el('i', 'dsp-selection-corner dsp-selection-corner-a'), el('i', 'dsp-selection-corner dsp-selection-corner-b'));
      this.workArea.append(this.guide, this.ghostLayer, this.selection);
      this.glass.append(this.systemLabel, this.workArea); this.bezel.append(this.glass, el('span', 'dsp-bezel-light', '', { 'aria-hidden': 'true' }));
      this.diagramHelp = el('p', 'dsp-diagram-help', '', { id: `${this.id}-diagram-help` });
      main.append(modes, this.monitorHeading, this.monitorMetrics, this.bezel, this.diagramHelp);

      const side = el('aside', 'dsp-settings', undefined, { 'aria-label': 'Area presets and exact placement' });
      side.append(el('h3', '', 'Quick areas'));
      this.presets = el('div', 'dsp-presets', undefined, { role: 'group', 'aria-label': 'Keyboard accessible area presets' }); side.append(this.presets);
      const percentHead = el('div', 'dsp-section-head'); percentHead.append(el('h3', '', 'Exact area'), el('span', 'dsp-quiet', '% of work area'));
      this.fields = new Map();
      const fieldGrid = el('div', 'dsp-percent-grid');
      for (const [key, label] of [['x', 'Left'], ['y', 'Top'], ['width', 'Width'], ['height', 'Height']]) {
        const field = el('label', 'dsp-field'); const input = el('input', 'dsp-number', undefined, { type: 'number', inputmode: 'decimal', min: '0', max: '100', step: '0.1', 'aria-label': `${label}, percent of monitor work area`, 'aria-describedby': `${this.id}-percent-help` });
        field.append(el('span', '', `${label} %`), input); fieldGrid.append(field); this.fields.set(key, input);
        this._on(input, 'input', () => this._readFields());
      }
      const percentHelp = el('p', 'dsp-quiet', 'Percentages use the selected monitor’s usable work area. The taskbar and other reserved screen space stay excluded.', { id: `${this.id}-percent-help` });
      this.placement = el('div', 'dsp-placement', undefined, { 'aria-live': 'polite' });
      this.areaLabel = el('strong', 'dsp-area-label');
      this.logicalSize = el('p', 'dsp-logical');
      this.nativeSize = el('p', 'dsp-native');
      this.placement.append(el('span', 'dsp-eyebrow', 'ACTUAL WINDOW PLACEMENT'), this.areaLabel, this.logicalSize, this.nativeSize);
      this.ghostList = el('div', 'dsp-other-projects');
      this.overlapNotice = el('p', 'dsp-overlap-notice', '', { role: 'status', 'aria-live': 'polite' });
      side.append(percentHead, fieldGrid, percentHelp, this.placement, this.ghostList, this.overlapNotice);
      body.append(main, side);
      const foot = el('footer', 'dsp-foot');
      const feedback = el('div', 'dsp-feedback');
      this.notice = el('p', 'dsp-notice', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      feedback.append(this.notice, el('p', 'dsp-foot-note', 'Placement only. This does not start tests or move other projects.'));
      this.cancelButton = this._button('Cancel', 'dsp-button dsp-cancel');
      this.applyButton = this._button('Assign area', 'dsp-button dsp-apply');
      foot.append(feedback, this.cancelButton, this.applyButton);
      this.dialog.append(head, intro, body, foot);
      this.doc.body.append(this.dialog);

      this._on(this.closeButton, 'click', () => this._close());
      this._on(this.cancelButton, 'click', () => this._close());
      this._on(this.applyButton, 'click', () => this._apply());
      this._on(this.dialog, 'cancel', (event) => { if (this.pending) { event.preventDefault(); this._say('Saving the area. Wait for the result before closing.'); } });
      this._on(this.dialog, 'close', () => { this.isOpen = false; this.drag = null; this._restoreFocus(); });
      this._on(this.topology, 'click', (event) => {
        const button = event.target.closest?.('button[data-display-id]');
        if (button && this.topology.contains(button) && !this.pending) this._chooseDisplay(button.dataset.displayId);
      });
      this._on(modes, 'click', (event) => {
        const button = event.target.closest?.('button[data-mode]');
        if (!button || !modes.contains(button) || this.pending) return;
        this.mode = button.dataset.mode; this._say('Draft selection only. Choose Assign area when ready.'); this._render();
      });
      this._on(this.presets, 'click', (event) => {
        const button = event.target.closest?.('button[data-region]');
        if (!button || !this.presets.contains(button) || this.pending) return;
        this._setRegion(button.dataset.region);
      });
      this._on(this.workArea, 'pointerdown', (event) => this._pointerDown(event));
      this._on(this.workArea, 'pointermove', (event) => this._pointerMove(event));
      this._on(this.workArea, 'pointerup', (event) => this._pointerUp(event));
      this._on(this.workArea, 'pointercancel', () => this._cancelDrag());
      this._on(this.workArea, 'lostpointercapture', () => this._cancelDrag());
      this._on(this.workArea, 'keydown', (event) => this._nudge(event));
    }

    open({ project, displays = [], projects = [], defaultDisplayId } = {}) {
      if (this.destroyed) throw new Error('This area picker has been destroyed.');
      if (this.pending) { this._say('Wait for the current area save to finish.'); return this; }
      this.helper = window.DistrictRegions;
      if (!this.helper?.normalize || !this.helper?.resolveBounds || !this.helper?.displayKey || !this.helper?.overlaps || !Array.isArray(this.helper.REGIONS)) throw new Error('Load DistrictRegions before opening the screen picker.');
      if (!project || typeof project.id !== 'string' || !project.id) throw new TypeError('Choose a project before assigning a test area.');
      this.epoch++;
      if (!this.isOpen) this.previousFocus = this.doc.activeElement;
      this.project = { id: project.id, name: safeText(project.name || project.id, 120), preferences: { ...(project.preferences || {}) } };
      this.defaultDisplayId = defaultDisplayId == null ? '' : String(defaultDisplayId);
      this.displays = this._inventory(displays);
      this.projects = (Array.isArray(projects) ? projects : []).slice(0, 100).filter((entry) => entry && typeof entry.id === 'string').map((entry) => ({ id: entry.id, name: safeText(entry.name || entry.id, 80), preferences: { ...(entry.preferences || {}) } }));
      const saved = this.project.preferences;
      const requested = saved.testDisplayId == null || saved.testDisplayId === '' ? this.defaultDisplayId : String(saved.testDisplayId);
      const savedDisplay = this.displays.find(display => display.id === requested);
      const changed = typeof saved.testDisplayGeometry === 'string' && savedDisplay && saved.testDisplayGeometry !== savedDisplay.geometryKey;
      this.displayId = savedDisplay && !changed ? requested : '';
      this.region = typeof saved.testRegion === 'string' ? saved.testRegion : 'full';
      this.customBounds = copyRect(saved.testBounds);
      this.mode = this.region === 'custom' ? 'draw' : this.region.includes('third') ? 'thirds' : 'quadrants';
      this.drag = null;
      this.projectName.textContent = `Assigning space for ${this.project.name}`;
      this.selectionName.textContent = this.project.name;
      this.presets.replaceChildren();
      for (const preset of this.helper.REGIONS) this.presets.append(this._button(preset.id === 'full' ? 'Whole work area' : preset.label, 'dsp-button dsp-preset', { 'data-region': preset.id, 'aria-pressed': 'false' }));
      this._renderTopology();
      this._render();
      if (!this.displays.length) this._say('No connected monitor geometry is available. Reopen this picker after reconnecting a display.', true);
      else if (changed) this._say('The saved monitor geometry or scaling changed. Choose the physical monitor again to review this area.', true);
      else if (!this.displayId) this._say(saved.testDisplayId ? 'The saved monitor is unavailable. Choose a connected monitor explicitly.' : 'Choose a monitor above. Nothing is assigned until you press Assign area.');
      else this._say('Draft selection only. Assign area saves this project’s placement.');
      if (!this.dialog.open) {
        if (typeof this.dialog.showModal === 'function') this.dialog.showModal(); else { this.dialog.setAttribute('open', ''); this.dialog.setAttribute('aria-modal', 'true'); }
      }
      this.isOpen = true;
      const selected = Array.from(this.topology.querySelectorAll('button')).find((button) => button.dataset.displayId === this.displayId);
      (selected || this.topology.querySelector('button') || this.closeButton).focus({ preventScroll: true });
      return this;
    }

    _inventory(displays) {
      const seen = new Set();
      return (Array.isArray(displays) ? displays : []).slice(0, 32).filter((display) => {
        if (!display || display.id == null || !validRect(display.bounds) || !validRect(display.workArea)) return false;
        const id = String(display.id);
        if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id) || seen.has(id)) return false;
        const b = display.bounds, a = display.workArea;
        if (a.x < b.x || a.y < b.y || a.x + a.width > b.x + b.width || a.y + a.height > b.y + b.height) return false;
        seen.add(id); return true;
      }).flatMap((display, index) => {
        const entry = { id: String(display.id), label: `Monitor ${index + 1}${display.primary ? ' · Primary' : ''}`, name: safeText(display.name, 220), primary: !!display.primary,
          bounds: copyRect(display.bounds), workArea: copyRect(display.workArea), scaleFactor: Number.isFinite(display.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : null,
          nativeSize: display.nativeSize && [display.nativeSize.width, display.nativeSize.height].every(value => Number.isSafeInteger(value) && value > 0) ?
            { width: display.nativeSize.width, height: display.nativeSize.height } : null, nativeSizeSource: display.nativeSizeSource === 'reported' ? 'reported' : 'scale-estimate' };
        try { entry.geometryKey = this.helper.displayKey(entry); return [entry]; } catch { return []; }
      });
    }

    updateDisplays(displays) {
      if (this.destroyed || !this.isOpen) return this;
      const next = this._inventory(displays);
      if (JSON.stringify(next) === JSON.stringify(this.displays)) return this;
      const previous = this._display(), focused = this.topology.contains(this.doc.activeElement), focusedId = this.doc.activeElement?.dataset?.displayId;
      this._cancelDrag();
      this.displays = next;
      const current = this._display();
      if (previous && (!current || current.geometryKey !== previous.geometryKey)) {
        this.displayId = '';
        this._say(current ? 'The selected monitor geometry or scaling changed. Choose it again before saving this area.' : 'The selected monitor disconnected. Choose a connected monitor explicitly; no other monitor is substituted.', true);
      }
      this._renderTopology(); this._render();
      if (focused) (Array.from(this.topology.querySelectorAll('button')).find(button => button.dataset.displayId === focusedId) || this.closeButton).focus({ preventScroll: true });
      return this;
    }

    _display() { return this.displays?.find((display) => display.id === this.displayId) || null; }
    _normalized() { return this.helper.normalize(this.region, this.customBounds); }
    _effective() {
      const display = this._display();
      if (!display) throw new Error('Choose a connected monitor.');
      return this.helper.resolveBounds(display.workArea, this.region, this.customBounds, MINIMUM);
    }
    _place(node, bounds) {
      for (const [key, property] of [['x', 'left'], ['y', 'top'], ['width', 'width'], ['height', 'height']]) node.style[property] = `${bounds[key] * 100}%`;
    }
    _chooseDisplay(id) {
      if (!this.displays.some((display) => display.id === id)) return;
      this.displayId = id; this._say('Monitor selected for this draft. Assign area saves the choice.'); this._render();
    }
    _setRegion(region, customBounds) {
      this.region = region; this.customBounds = region === 'custom' ? copyRect(customBounds) : null;
      if (region.includes('third')) this.mode = 'thirds'; else if (['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(region)) this.mode = 'quadrants';
      this._say('Draft selection only. Assign area saves the highlighted area.'); this._render();
    }
    _readFields() {
      if (this.pending) return;
      this.region = 'custom';
      this.customBounds = Object.fromEntries(KEYS.map((key) => {
        const value = this.fields.get(key).value.trim(); return [key, value === '' ? NaN : Number(value) / 100];
      }));
      this._say('Custom percentages are a draft. Assign area saves the highlighted area.'); this._render(false);
    }

    _renderTopology() {
      this.topology.replaceChildren();
      if (!this.displays.length) { this.topology.append(this._el('p', 'dsp-empty', 'No connected displays reported.')); this.topology.style.aspectRatio = '3 / 1'; this.topology.style.width = '100%'; this.topology.style.minHeight = '94px'; return; }
      const minX = Math.min(...this.displays.map((display) => display.bounds.x));
      const minY = Math.min(...this.displays.map((display) => display.bounds.y));
      const width = Math.max(...this.displays.map((display) => display.bounds.x + display.bounds.width)) - minX;
      const height = Math.max(...this.displays.map((display) => display.bounds.y + display.bounds.height)) - minY;
      this.topology.style.aspectRatio = `${width} / ${height}`;
      this.topology.style.width = `min(100%, ${110 * width / height}px)`;
      this.topology.style.minHeight = '0';
      for (const display of this.displays) {
        const button = this._button('', 'dsp-monitor', { 'data-display-id': display.id, 'aria-pressed': 'false', title: display.name || display.label });
        this._place(button, { x: (display.bounds.x - minX) / width, y: (display.bounds.y - minY) / height, width: display.bounds.width / width, height: display.bounds.height / height });
        const native = display.nativeSize || (display.scaleFactor ? { width: display.bounds.width * display.scaleFactor, height: display.bounds.height * display.scaleFactor } : null);
        button.append(this._el('strong', '', display.label), this._el('span', '', native ? `${number(native.width)} × ${number(native.height)} native px` : 'Native pixel size unavailable'));
        button.setAttribute('aria-label', `${display.label}. Physical display ID ${display.id}. ${display.name || `${display.bounds.width} by ${display.bounds.height} logical units`}`);
        this.topology.append(button);
      }
    }

    _ghosts() {
      return (this.projects || []).filter((project) => project.id !== this.project.id && String(project.preferences.testDisplayId || this.defaultDisplayId || '') === this.displayId).flatMap((project) => {
        try { return [{ ...project, bounds: this.helper.normalize(project.preferences.testRegion || 'full', project.preferences.testBounds).bounds }]; }
        catch { return []; }
      });
    }
    _render(syncFields = true) {
      const display = this._display();
      let normalized = null, effective = null, validation = '';
      try { normalized = this._normalized(); effective = this._effective(); } catch (error) { validation = errorText(error); }
      this.dialog.dataset.pending = String(this.pending);
      this.applyButton.disabled = this.pending || !display || !effective;
      this.applyButton.textContent = this.pending ? 'Assigning…' : 'Assign area';
      this.closeButton.disabled = this.pending; this.cancelButton.disabled = this.pending;
      for (const button of this.topology.querySelectorAll('button')) { button.disabled = this.pending; button.setAttribute('aria-pressed', String(button.dataset.displayId === this.displayId)); }
      for (const [id, button] of this.modeButtons) { button.disabled = this.pending || !display; button.setAttribute('aria-pressed', String(id === this.mode)); }
      for (const button of this.presets.querySelectorAll('button')) { button.disabled = this.pending || !display; button.setAttribute('aria-pressed', String(button.dataset.region === this.region)); }
      for (const [key, input] of this.fields) {
        input.disabled = this.pending || !display;
        if (syncFields) input.value = percent(normalized?.bounds?.[key] ?? (this.region === 'custom' ? this.customBounds?.[key] : NaN));
        input.setAttribute('aria-invalid', String(!!validation && !!display));
      }
      this.bezel.hidden = !display;
      this.workArea.dataset.mode = this.mode;
      this.workArea.dataset.busy = String(this.pending);
      this.selection.hidden = !display || !normalized;
      this.selection.dataset.invalid = String(!!validation);
      this.selection.dataset.compact = String((normalized?.bounds.width || 1) < 0.3);
      this.guide.dataset.mode = this.mode;
      this.ghostLayer.replaceChildren(); this.ghostList.replaceChildren();
      if (!display) {
        this.monitorHeading.textContent = 'Select a monitor above'; this.monitorMetrics.textContent = '';
        this.areaLabel.textContent = 'No monitor selected'; this.logicalSize.textContent = 'Placement is not assigned.'; this.nativeSize.textContent = '';
        this.diagramHelp.textContent = 'Choose a monitor using the buttons above. Presets and percentages are available with the keyboard.';
        this.overlapNotice.textContent = '';
        return;
      }
      const b = display.bounds, a = display.workArea, scale = display.scaleFactor;
      this.bezel.style.width = `min(100%, ${248 * b.width / b.height + 22}px)`;
      this.glass.style.aspectRatio = `${b.width} / ${b.height}`;
      this._place(this.workArea, { x: (a.x - b.x) / b.width, y: (a.y - b.y) / b.height, width: a.width / b.width, height: a.height / b.height });
      this.systemLabel.hidden = a.width === b.width && a.height === b.height;
      this.monitorHeading.textContent = display.label;
      const native = display.nativeSize || (scale ? { width: b.width * scale, height: b.height * scale } : null);
      this.monitorMetrics.textContent = `Physical display ID ${display.id} · ${native ? `${display.nativeSizeSource === 'reported' ? '' : '≈ '}${number(native.width)} × ${number(native.height)} native px · ` : ''}${number(b.width)} × ${number(b.height)} logical units${scale ? ` · ${scale}× scale` : ' · scale unavailable'}`;
      this.workArea.setAttribute('aria-label', `${display.label} work area. ${this.mode === 'draw' ? 'Drag to draw a custom region.' : this.mode === 'thirds' ? 'Click a vertical third.' : 'Click a quadrant.'} Arrow keys move the current selection; Shift plus arrow resizes. Presets and percent fields are keyboard alternatives.`);
      if (normalized) this._place(this.selection, normalized.bounds);
      const preset = this.helper.REGIONS.find((entry) => entry.id === this.region);
      this.areaLabel.textContent = this.region === 'custom' ? 'Custom area' : this.region === 'full' ? 'Whole work area' : preset?.label || 'Choose a valid area';
      this.logicalSize.textContent = effective ? `${number(effective.width)} × ${number(effective.height)} DIP at (${number(effective.x)}, ${number(effective.y)})` : validation;
      this.nativeSize.textContent = effective && scale ? `≈ ${number(effective.width * scale)} × ${number(effective.height * scale)} native pixels · ${scale}× scale` : effective ? 'Native dimensions unavailable; placement uses logical units.' : 'Minimum window: 320 × 200 DIP. Keep the area within 0–100%.';
      this.placement.dataset.invalid = String(!!validation);
      const ghosts = this._ghosts();
      if (ghosts.length) {
        this.ghostList.append(this._el('h4', '', 'Other project areas'));
        for (const project of ghosts.slice(0, 8)) {
          const ghost = this._el('div', 'dsp-ghost'); this._place(ghost, project.bounds);
          ghost.append(this._el('span', 'dsp-ghost-label', project.name)); this.ghostLayer.append(ghost);
          this.ghostList.append(this._el('p', '', `◇ ${project.name}`));
        }
        if (ghosts.length > 8) this.ghostList.append(this._el('p', 'dsp-quiet', `Plus ${ghosts.length - 8} other saved areas.`));
        this.ghostList.append(this._el('p', 'dsp-quiet', 'Outlines are saved placements, not running windows.'));
      } else this.ghostList.append(this._el('p', 'dsp-quiet', 'No other project areas saved on this monitor.'));
      const overlapping = normalized ? ghosts.filter(project => this.helper.overlaps(normalized.bounds, project.bounds)) : [];
      this.overlapNotice.dataset.overlap = String(overlapping.length > 0);
      this.overlapNotice.textContent = overlapping.length ? `This draft overlaps saved areas for ${overlapping.slice(0, 4).map(project => project.name).join(', ')}${overlapping.length > 4 ? ' and other projects' : ''}. Their windows may cover each other. Areas are not exclusive reservations; saving does not move or stop other projects.` :
        ghosts.length ? 'This draft does not overlap the other saved areas shown. Their running-window state is unknown.' : 'An area is a saved placement inside this physical monitor, not a separate monitor or reserved screen.';
      this.diagramHelp.textContent = this.mode === 'draw' ? 'Drag inside the work area. The highlight is a placement draft; Assign area saves it. Arrow keys move it, Shift + arrows resize.' : `Click a ${this.mode === 'thirds' ? 'third' : 'quadrant'} of the work area. Use Quick areas or percent fields for the same selection with a keyboard.`;
    }

    _point(event) {
      const box = this.workArea.getBoundingClientRect();
      if (!box.width || !box.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
      return { x: clamp((event.clientX - box.left) / box.width, 0, 1), y: clamp((event.clientY - box.top) / box.height, 0, 1), pixelX: event.clientX, pixelY: event.clientY };
    }
    _pointerDown(event) {
      if (this.pending || !this.isOpen || !this._display() || event.button !== 0) return;
      const point = this._point(event); if (!point) return;
      event.preventDefault(); this.workArea.focus({ preventScroll: true });
      if (this.mode !== 'draw') {
        this._setRegion(this.mode === 'thirds' ? ['left-third', 'middle-third', 'right-third'][Math.min(2, Math.floor(point.x * 3))] : `${point.y < 0.5 ? 'top' : 'bottom'}-${point.x < 0.5 ? 'left' : 'right'}`);
        return;
      }
      this.drag = { id: event.pointerId, start: point, previous: { region: this.region, bounds: copyRect(this.customBounds) }, moved: false };
      try { this.workArea.setPointerCapture(event.pointerId); } catch { /* Keyboard fields remain available. */ }
    }
    _pointerMove(event) {
      if (!this.drag || event.pointerId !== this.drag.id || this.pending) return;
      const point = this._point(event); if (!point) return;
      const start = this.drag.start;
      if (Math.hypot(point.pixelX - start.pixelX, point.pixelY - start.pixelY) < 4 && !this.drag.moved) return;
      const bounds = { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(start.x - point.x), height: Math.abs(start.y - point.y) };
      if (bounds.width <= 0 || bounds.height <= 0) return;
      this.drag.moved = true; this.region = 'custom'; this.customBounds = bounds;
      this._say('Drawing a custom draft. Release the pointer, then choose Assign area.'); this._render();
    }
    _pointerUp(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      this._pointerMove(event);
      const drag = this.drag; this.drag = null;
      try { this.workArea.releasePointerCapture(event.pointerId); } catch { /* Capture may already be released. */ }
      if (!drag.moved) this._say('Drag to draw an area, or use the preset and percent controls.');
      else this._say('Custom area selected as a draft. Assign area saves it.');
    }
    _cancelDrag() {
      if (!this.drag) return;
      this.region = this.drag.previous.region; this.customBounds = this.drag.previous.bounds; this.drag = null;
      this._say('Drawing cancelled. The previous draft is retained.'); this._render();
    }
    _nudge(event) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || this.pending || !this._display()) return;
      let bounds; try { bounds = { ...this._normalized().bounds }; } catch { return; }
      event.preventDefault();
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const amount = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -0.01 : 0.01;
      const key = event.shiftKey ? horizontal ? 'width' : 'height' : horizontal ? 'x' : 'y';
      const maximum = key === 'x' ? 1 - bounds.width : key === 'y' ? 1 - bounds.height : key === 'width' ? 1 - bounds.x : 1 - bounds.y;
      const minimum = event.shiftKey ? 0.001 : 0;
      bounds[key] = clamp(Math.round(clamp(bounds[key] + amount, minimum, maximum) * 1000000) / 1000000, minimum, maximum);
      this._setRegion('custom', bounds);
    }

    async _apply() {
      if (this.pending || !this.isOpen || this.destroyed) return;
      let normalized;
      try { normalized = this._normalized(); this._effective(); } catch (error) { this._say(errorText(error), true); this._render(false); return; }
      const payload = { testDisplayId: this.displayId, testRegion: normalized.region };
      if (normalized.region === 'custom') payload.testBounds = { ...normalized.bounds };
      const geometryKey = this._display().geometryKey, requestedBounds = this._effective();
      const epoch = this.epoch;
      let saved = false;
      this.pending = true; this._say('Saving this project’s monitor and area…'); this._render(false);
      try {
        const receipt = await this.onApply(payload, { projectId: this.project.id, geometryKey, requestedBounds: { ...requestedBounds }, units: 'logical/DIP' });
        if (this.destroyed || epoch !== this.epoch) return;
        if (!receipt || receipt.status !== 'completed' || receipt.error) throw new Error(receipt?.error || (receipt?.status === 'accepted' ? 'Assignment request accepted, but saving is not confirmed. Your draft remains here.' : 'No successful save confirmation was returned. Your draft remains here.'));
        if (receipt.projectId && receipt.projectId !== this.project.id) throw new Error('The save result belongs to another project. This area is not confirmed saved.');
        saved = true;
        if (this._display()?.geometryKey !== geometryKey) throw new Error('The monitor changed while saving. Recheck its saved area before opening a test window.');
        this.pending = false; this._close();
      } catch (error) {
        if (!this.destroyed && epoch === this.epoch) { this.pending = false; this._say(`${saved ? 'Saved placement needs review.' : 'Area not saved.'} ${errorText(error)}`, true); this._render(false); }
      }
    }
    _restoreFocus() { if (!this.destroyed && this.previousFocus?.isConnected && typeof this.previousFocus.focus === 'function') this.previousFocus.focus({ preventScroll: true }); }
    _close() {
      if (this.pending || !this.isOpen) return;
      this.drag = null; this.isOpen = false;
      if (typeof this.dialog.close === 'function') this.dialog.close(); else { this.dialog.removeAttribute('open'); this._restoreFocus(); }
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true; this.epoch++; this.drag = null;
      for (const remove of this.listeners.splice(0)) remove();
      if (this.dialog.open && typeof this.dialog.close === 'function') this.dialog.close();
      this.dialog.remove(); this.isOpen = false;
    }
  }
  window.DistrictScreenPicker = DistrictScreenPicker;
})();
