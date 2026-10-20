(function () {
  'use strict';

  const ACTIVE = new Set(['queued', 'starting', 'working', 'running', 'building', 'testing', 'stopping', 'termination_unknown']);
  const FACILITIES = {
    research: { name: 'Research', title: 'The briefing room', description: 'Your instruction, the assigned worker, and activity as it is reported.' },
    build: { name: 'Workshop', title: 'The workshop', description: 'Real file edits become a built candidate. Source and output stay inspectable.' },
    test: { name: 'Checks', title: 'The testing lab', description: 'Observed recipe checks, with their actual result. Browser behavior is a separate check.' },
    review: { name: 'Review', title: 'The review booth', description: 'Save a real baseline, inspect file changes, or recover earlier work.' },
    preview: { name: 'Preview', title: 'The preview portal', description: 'Open the actual built candidate. Select an element to request another edit.' },
  };
  const TEST_REGIONS = window.DistrictRegions?.REGIONS?.map((region) => ({ id: region.id, name: region.label })) || [
    { id: 'full', name: 'Full display' }, { id: 'left-third', name: 'Left third' },
    { id: 'middle-third', name: 'Middle third' }, { id: 'right-third', name: 'Right third' },
    { id: 'left-half', name: 'Left half' }, { id: 'right-half', name: 'Right half' },
    { id: 'top-left', name: 'Top-left quarter' }, { id: 'top-right', name: 'Top-right quarter' },
    { id: 'bottom-left', name: 'Bottom-left quarter' }, { id: 'bottom-right', name: 'Bottom-right quarter' },
  ];
  const FIRST_IDEA = 'Make this checklist feel like my own app: add a warm welcome, clearer task labels, and a visible count of completed tasks. Keep adding and checking tasks working.';
  let mountNumber = 0;

  function mount({ container, api, initialProjectId = '', initialFacility = 'research', initialInstruction = '', hideProjectChooser = false, pollIntervalMs, onSelectionChange }) {
    if (!container || !api || typeof api.snapshot !== 'function' || typeof api.command !== 'function') {
      throw new TypeError('DistrictUI requires a container and snapshot/command API.');
    }
    const doc = container.ownerDocument;
    const instance = `district-ui-${++mountNumber}`;
    const listeners = [];
    const keyed = new WeakMap();
    const pending = new Set();
    const drafts = new Map();
    const areaIds = Object.keys(FACILITIES);
    const normalizeAreas = (ids) => [...new Set((Array.isArray(ids) ? ids : [ids]).map((id) => id === 'edit' ? 'build' : id).filter((id) => FACILITIES[id]))];
    const initialAreas = normalizeAreas(initialFacility);
    const selectionHelper = window.DistrictSelection;
    const initialAreaIds = initialAreas.length ? initialAreas : ['research'];
    const configuredPoll = Number.isFinite(pollIntervalMs) ? Math.max(500, pollIntervalMs) : null;
    let areaSelection = selectionHelper?.create ? selectionHelper.create(areaIds, initialAreaIds) : { selectedIds: initialAreaIds, focusedId: initialAreaIds[0], anchorId: initialAreaIds[0] };
    const state = {
      snapshot: { projects: [], providers: [], runs: [], checkpoints: [], previews: [], activities: [] },
      projectId: String(initialProjectId || ''), worker: '', runId: '', facility: initialAreaIds[0], facilities: [...areaSelection.selectedIds], loaded: false, readError: '',
      lastRead: 0, commandNumber: 0, destroyed: false, refreshing: null, timer: null, diff: null, showCreate: false, visualResults: new Map(), previewWindows: new Map(),
      inspectorCollapsed: initialAreaIds.length === 1 && initialAreaIds[0] === 'research',
      missionExpanded: false,
    };
    let scene = null;
    let feedback = null;
    let screenPicker = null;
    let pickerProjectId = '';
    let noticeKey = '';
    let layoutObserver = null;
    let layoutFrame = null;
    let layoutSignature = '';

    function element(tag, className, text, attributes) {
      const result = doc.createElement(tag);
      if (className) result.className = className;
      if (text !== undefined && text !== null) result.textContent = String(text);
      if (attributes) for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, String(value));
      return result;
    }
    function append(parent, ...children) { parent.append(...children.filter(Boolean)); return parent; }
    function on(target, type, handler) {
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    }
    function text(target, value) {
      const next = value === undefined || value === null ? '' : String(value);
      if (target.textContent !== next) target.textContent = next;
    }
    function action(label, className, handler, attributes) {
      const control = element('button', className || 'dv-button', label, { type: 'button', ...attributes });
      on(control, 'click', handler);
      return control;
    }
    function labelFor(control, wording, className) {
      const label = element('label', className || 'dv-field', undefined, { for: control.id });
      append(label, element('span', 'dv-label', wording), control);
      return label;
    }
    function input(tag, className, suffix, attributes) {
      return element(tag, className, undefined, { id: `${instance}-${suffix}`, ...attributes });
    }
    function reconcile(parent, records, keyOf, create, update) {
      const previous = keyed.get(parent) || new Map();
      const next = new Map();
      const focused = parent.contains(doc.activeElement) ? doc.activeElement : null;
      records.forEach((record, index) => {
        const key = String(keyOf(record));
        if (next.has(key)) return;
        const node = previous.get(key) || create(record);
        update(node, record);
        next.set(key, node);
        if (parent.children[index] !== node) parent.insertBefore(node, parent.children[index] || null);
      });
      for (const [key, node] of previous) if (!next.has(key)) node.remove();
      keyed.set(parent, next);
      if (focused && focused.isConnected && doc.activeElement !== focused) focused.focus({ preventScroll: true });
    }
    function options(select, records) {
      const prior = select.value;
      reconcile(select, records, (record) => record.id, () => element('option'), (node, record) => {
        node.value = record.id; text(node, record.name); node.disabled = Boolean(record.disabled);
      });
      if (records.some((record) => record.id === prior)) select.value = prior;
    }
    function errorText(error) {
      if (typeof error === 'string') return error;
      if (!error) return 'The operation did not complete.';
      return String(error.message || error.detail || error.error || 'The operation did not complete.');
    }
    function time(value) {
      if (!value) return 'Time not recorded';
      const date = new Date(typeof value === 'number' && value < 100000000000 ? value * 1000 : value);
      return Number.isNaN(date.getTime()) ? 'Time not recorded' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function shortHash(value) { return value ? String(value).slice(0, 12) : 'Not recorded'; }
    function statusOf(run) { return String(run?.state || run?.status || 'unknown'); }
    function activeActionLabel(run) {
      const status = statusOf(run);
      const workerId = run.worker || run.provider || '';
      const workerName = state.snapshot.providers.find((item) => item.id === workerId)?.name || ({ codex: 'Codex', claude: 'Claude' }[workerId]) || workerId || 'Worker';
      if (status === 'queued') return 'Waiting to start';
      if (status === 'stopping') return 'Stopping';
      if (status === 'termination_unknown') return 'Stop unconfirmed';
      if (status === 'building') return 'Building';
      if (status === 'testing') return run.kind === 'visual' ? 'Checking in browser' : 'Checking';
      if (status === 'starting') return run.kind === 'visual' ? 'Starting browser checks' : workerId === 'local' ? 'Starting local checks' : `Connecting ${workerName}`;
      if (run.kind === 'visual') return 'Checking in browser';
      return workerId === 'local' ? 'Running local recipe' : `${workerName} is working`;
    }
    function project() { return state.snapshot.projects.find((item) => item.id === state.projectId) || null; }
    function projectRuns() {
      return state.snapshot.runs.filter((item) => item.projectId === state.projectId)
        .slice().sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
    }
    function selectedRun() {
      const runs = projectRuns();
      return runs.find((item) => item.id === state.runId) || runs[0] || null;
    }
    function activeRun() { return projectRuns().find((item) => ACTIVE.has(statusOf(item))) || null; }
    function provider() { return state.snapshot.providers.find((item) => item.id === state.worker) || null; }
    function selectedPreview() {
      return state.snapshot.previews.filter((item) => item.projectId === state.projectId)
        .slice().sort((a, b) => Number(b.created || 0) - Number(a.created || 0))[0] || null;
    }
    function latestCandidateRun() { return projectRuns().find((item) => item.artifact && statusOf(item) === 'passed') || null; }
    function candidateForRun(run) {
      if (run?.artifact && statusOf(run) === 'passed') return run;
      if (run?.kind === 'visual' && run.candidateRunId) return projectRuns().find((item) => item.id === run.candidateRunId && item.artifact && statusOf(item) === 'passed') || null;
      return null;
    }
    function visualCandidateId(run) { return candidateForRun(run)?.id || (run?.kind === 'visual' ? run.candidateRunId : '') || ''; }
    function regionName(id) { return id === 'custom' ? 'Custom area' : TEST_REGIONS.find((region) => region.id === id)?.name || String(id || 'Full display'); }
    function validCustomBounds(bounds) {
      return bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) &&
        bounds.x >= 0 && bounds.y >= 0 && bounds.width > 0 && bounds.height > 0 && bounds.x + bounds.width <= 1 && bounds.y + bounds.height <= 1;
    }
    function openScreenPicker() {
      const current = project();
      if (!current || !screenPicker) return;
      pickerProjectId = current.id;
      screenPicker.open({ project: current, displays: state.snapshot.displays || [], projects: state.snapshot.allProjects || state.snapshot.projects, defaultDisplayId: state.snapshot.defaultTestDisplayId || '' });
    }
    async function restoreBaseline(checkpointId) {
      const comparison=await dispatch('inspect_diff',{payload:{checkpointId}});
      if(!comparison||comparison.status==='rejected')return;
      const guard=comparison.result?.restoreGuard||{};
      return dispatch('restore_checkpoint',{payload:{checkpointId,...guard,...(comparison.result?.diffHash?{expectedDiffHash:comparison.result.diffHash}:{})}});
    }
    function placementText(result) {
      if (!result) return '';
      const placement = result.placement || result;
      const display = placement.display || result.display;
      const displayId = typeof display === 'object' ? display?.name || display?.id : display || result.displayId || result.requestedDisplayId;
      const bounds = result.bounds || placement.effectiveBounds || result.effectiveBounds;
      const region = result.region || placement.requestedRegion || result.requestedRegion;
      const location = bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) ? `${bounds.width} × ${bounds.height} at (${bounds.x}, ${bounds.y}) DIP` : '';
      return [displayId ? `Display ${displayId}` : '', region ? regionName(region) : '', location].filter(Boolean).join(' · ');
    }
    function busy(type) { return pending.has(`${type}:${state.projectId}`); }
    function hasProject() { return Boolean(project()); }
    function notify(message, tone = 'info') {
      const key = `${tone}:${message}`;
      if (key === noticeKey) return;
      noticeKey = key;
      text(notice, message);
      notice.dataset.tone = tone;
    }
    function setProject(id) {
      if (state.destroyed || typeof id !== 'string') return false;
      if (state.loaded && !state.snapshot.projects.some((item) => item.id === id)) return false;
      if (state.projectId === id) return true;
      drafts.set(state.projectId, instruction.value);
      state.projectId = id; state.runId = ''; state.diff = null;
      instruction.value = drafts.get(id) || '';
      projectSelect.value = id;
      render();
      emitSelection();
      return true;
    }
    function setWorker(id) {
      if (!state.snapshot.providers.some((item) => item.id === id)) return;
      state.worker = id; workerSelect.value = id; render();
      emitSelection();
    }
    function getSelection() {
      return { projectId: state.projectId, facility: state.facility, facilities: [...state.facilities], worker: state.worker, runId: selectedRun()?.id || state.runId };
    }
    function emitSelection() {
      if (typeof onSelectionChange === 'function' && !state.destroyed) onSelectionChange(getSelection());
    }
    function applyAreas(next, primary, focus = false, open = true) {
      areaSelection = next;
      state.facilities = [...next.selectedIds];
      state.facility = state.facilities.includes(primary) ? primary : state.facilities[0];
      if (open) state.inspectorCollapsed = false;
      render();
      scheduleLayout();
      if (focus) tabs[next.focusedId]?.focus({ preventScroll: true });
      emitSelection();
      return getSelection();
    }
    function setFacilities(ids) {
      if (state.destroyed) return getSelection();
      const normalized = normalizeAreas(ids);
      if (!normalized.length) return getSelection();
      if (state.facilities.length === normalized.length && state.facilities.every((id) => normalized.includes(id))) {
        if (state.inspectorCollapsed) { state.inspectorCollapsed = false; render(); }
        return getSelection();
      }
      const next = selectionHelper?.create ? selectionHelper.create(areaIds, normalized) : { selectedIds: areaIds.filter((id) => normalized.includes(id)), focusedId: normalized[0], anchorId: normalized[0] };
      return applyAreas(next, normalized.includes(state.facility) ? state.facility : normalized[0]);
    }
    function setFacility(id, focus = false, open = true) {
      const normalized = normalizeAreas(id)[0];
      if (!normalized) return;
      const next = selectionHelper?.create ? selectionHelper.create(areaIds, [normalized]) : { selectedIds: [normalized], focusedId: normalized, anchorId: normalized };
      return applyAreas(next, normalized, focus, open);
    }
    function chooseFacility(id, event = {}, focus = false) {
      let next;
      if (selectionHelper?.click) next = selectionHelper.click(areaSelection, id, areaIds, event);
      else if (event.shiftKey) {
        const anchor = areaSelection.anchorId || state.facility;
        const from = areaIds.indexOf(anchor), to = areaIds.indexOf(id);
        const range = areaIds.slice(Math.min(from, to), Math.max(from, to) + 1);
        const selected = event.ctrlKey || event.metaKey ? new Set([...state.facilities, ...range]) : new Set(range);
        next = { selectedIds: areaIds.filter((item) => selected.has(item)), focusedId: id, anchorId: anchor };
      }
      else if (event.ctrlKey || event.metaKey) {
        const selected = new Set(state.facilities);
        if (selected.has(id) && selected.size > 1) selected.delete(id); else selected.add(id);
        next = { selectedIds: areaIds.filter((item) => selected.has(item)), focusedId: id, anchorId: id };
      } else next = { selectedIds: [id], focusedId: id, anchorId: id };
      return applyAreas(next, id, focus);
    }
    function toggleFacility(id) {
      if (selectionHelper?.toggle) return applyAreas(selectionHelper.toggle(areaSelection, id, areaIds), id);
      return chooseFacility(id, { ctrlKey: true });
    }
    function revealFacility(id, open = true) {
      if (state.facilities.length === 1) return setFacility(id, false, open);
      const nextIds = [...new Set([...state.facilities, id])];
      const next = selectionHelper?.create ? selectionHelper.create(areaIds, { selectedIds: nextIds, focusedId: id, anchorId: id }) : { selectedIds: areaIds.filter((item) => nextIds.includes(item)), focusedId: id, anchorId: id };
      return applyAreas(next, id, false, open);
    }
    function requestId() {
      const random = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${++state.commandNumber}`;
      return `gui-${random}`;
    }

    const shell = element('div', 'dv-container');
    const app = element('section', 'dv-app', undefined, { 'aria-label': 'Agent Bus development district' });
    app.classList.toggle('dv-embedded', Boolean(hideProjectChooser));
    const header = element('header', 'dv-topbar');
    const brand = append(element('div', 'dv-brand'), element('span', 'dv-brand-mark', '◈', { 'aria-hidden': 'true' }),
      append(element('div'), element('strong', '', 'AGENT BUS'), element('span', 'dv-brand-caption', 'DEVELOPMENT DISTRICT')));
    const projectSelect = input('select', 'dv-select dv-project-select', 'project', { 'aria-label': 'Current project' });
    const newProject = action('+ New project', 'dv-button dv-new-project', () => {
      state.showCreate = !state.showCreate;
      state.missionExpanded = state.showCreate;
      render();
      if (!createForm.hidden) projectName.focus({ preventScroll: true });
    });
    const connectionBadge = element('span', 'dv-connection', 'Loading district…', { role: 'status' });
    const helpButton = action('Help', 'dv-button dv-button-quiet', () => {
      if (typeof help.showModal === 'function') help.showModal();
      else { help.hidden = false; help.setAttribute('open', ''); }
    }, { 'aria-label': 'CLI & help' });
    const smokeButton = action('Test Agent Bus', 'dv-button dv-button-quiet', () => {
      if (typeof api.openSmoke === 'function') api.openSmoke();
    });
    const projectSwitch = append(element('div', 'dv-project-switch'), projectSelect, newProject);
    projectSwitch.hidden = Boolean(hideProjectChooser);
    append(header, brand, projectSwitch,
      append(element('div', 'dv-top-actions'), connectionBadge, helpButton, smokeButton));

    const world = element('div', 'dv-world');
    const sceneHost = element('div', 'dv-scene-host', undefined, { 'aria-label': 'Isometric development district' });
    const sceneFallback = append(element('div', 'dv-scene-fallback'), element('p', '', 'District view is loading. Every action is also available in the controls.'));
    append(sceneHost, sceneFallback);
    const projectCaption = append(element('div', 'dv-world-caption'), element('span', 'dv-eyebrow', 'YOUR WORKSPACE'), element('strong', '', 'Choose a project'), element('span', 'dv-world-path', 'Create a small app, give a worker an instruction, and follow the real result.'));
    const fitButton = action('Fit district', 'dv-button dv-button-quiet dv-fit-button', () => scene?.fit());

    const dock = element('aside', 'dv-command-dock dv-glass', undefined, { 'aria-label': 'Project and worker instructions' });
    const missionTitle = element('h2', '', 'Make an app. See it work.');
    const missionToggle = action('Expand mission', 'dv-button dv-button-quiet dv-mission-toggle', () => setMissionExpanded(!state.missionExpanded), { 'aria-controls': `${instance}-mission-body`, 'aria-expanded': 'false' });
    const dockHeader = append(element('div', 'dv-dock-heading'), append(element('div', 'dv-mission-heading'), element('span', 'dv-eyebrow', 'YOUR NEXT MISSION'), missionTitle), missionToggle);
    const missionBody = element('div', 'dv-mission-body', undefined, { id: `${instance}-mission-body` });
    const firstSteps = element('ol', 'dv-first-steps', undefined, { 'aria-label': 'Your first app in three steps' });
    const stepNames = ['Name your app', 'Tell your crew', 'Try the real app'];
    for (const [index, name] of stepNames.entries()) append(firstSteps, append(element('li'), element('span', '', String(index + 1), { 'aria-hidden': 'true' }), element('strong', '', name)));
    const goalIntro = element('p', 'dv-goal-intro', 'Start with a working checklist. Give your crew an idea and make it yours.');
    const createForm = element('form', 'dv-create-form');
    const projectName = input('input', 'dv-input', 'project-name', { type: 'text', maxlength: '80', placeholder: 'My checklist', autocomplete: 'off', required: '' });
    const createButton = element('button', 'dv-button dv-button-primary', 'Start my checklist →', { type: 'submit', 'aria-label': 'Create project' });
    append(createForm, labelFor(projectName, 'New app name'), createButton,
      element('p', 'dv-small', 'Your starting checklist is a template. Your crew makes changes only after you send an instruction.'));
    on(createForm, 'submit', (event) => {
      event.preventDefault();
      if (!projectName.value.trim()) { projectName.focus(); return; }
      void dispatch('create_project', { payload: { name: projectName.value.trim() } });
    });
    const instructionForm = element('form', 'dv-instruction-form');
    const workerSelect = input('select', 'dv-select', 'worker', { 'aria-label': 'Worker', 'aria-describedby': `${instance}-worker-note` });
    const workerNote = element('p', 'dv-worker-note', 'Detecting installed worker CLIs…', { id: `${instance}-worker-note` });
    const crewSummary = element('p', 'dv-crew-summary', 'Looking for your crew…');
    const model = input('input', 'dv-input', 'model', { type: 'text', placeholder: 'CLI default', maxlength: '120', autocomplete: 'off' });
    const effort = input('input', 'dv-input', 'effort', { type: 'text', placeholder: 'CLI default', maxlength: '32', autocomplete: 'off' });
    const advanced = element('details', 'dv-worker-options');
    append(advanced, element('summary', '', 'More crew settings'), append(element('div', 'dv-model-grid'), labelFor(model, 'Model'), labelFor(effort, 'Effort')),
      element('p', 'dv-small', 'Optional. Use a model and effort supported by the selected CLI.'));
    const instruction = input('textarea', 'dv-input dv-instruction', 'instruction', {
      rows: '2', maxlength: '12000', placeholder: 'Tell the worker what to make or change…', 'aria-describedby': `${instance}-instruction-note`,
    });
    if (typeof initialInstruction === 'string' && initialInstruction) {
      instruction.value = initialInstruction.slice(0, 12000);
      drafts.set(state.projectId, instruction.value);
    }
    const runButton = element('button', 'dv-button dv-button-primary dv-run-button', 'Make this change →', { type: 'submit', 'aria-label': 'Send worker' });
    const runNote = element('p', 'dv-small dv-instruction-note', 'Real file edits → build → checks. Provider login and quota apply.', { id: `${instance}-instruction-note` });
    const cancelButton = action('Stop this run', 'dv-button dv-button-danger dv-stop-run', () => {
      const run = activeRun();
      if (run) void dispatch('cancel_run', { payload: { runId: run.id } });
    });
    cancelButton.hidden = true;
    const localChecks = action('Build & check locally', 'dv-button dv-button-secondary', () => {
      revealFacility('test', false); void dispatch('run_checks');
    });
    const localNote = element('p', 'dv-small', 'Runs the fixed recipe on this project. No model calls.');
    const crewSettings = element('details', 'dv-crew-settings');
    append(crewSettings, element('summary', '', 'Crew, checks & settings'), labelFor(workerSelect, 'Worker'), workerNote, advanced,
      append(element('div', 'dv-local-action'), localChecks, localNote));
    on(crewSettings, 'toggle', () => { if (crewSettings.open && !state.missionExpanded) setMissionExpanded(true); });
    const tryAppButton = action('Open my app →', 'dv-button dv-button-secondary dv-try-app', () => {
      const candidate = latestCandidateRun();
      if (candidate && selectedPreview()?.runId === candidate.id) revealFacility('preview');
      else startPreview(candidate);
    });
    append(instructionForm, crewSummary, labelFor(instruction, 'Your instruction', 'dv-field dv-instruction-field'), runButton, runNote, cancelButton, tryAppButton, crewSettings);
    on(instructionForm, 'submit', (event) => {
      event.preventDefault();
      void startTask(instruction.value.trim(), null);
    });
    on(instruction, 'input', () => { drafts.set(state.projectId, instruction.value); updateControls(); });
    on(workerSelect, 'change', () => setWorker(workerSelect.value));
    on(projectSelect, 'change', () => setProject(projectSelect.value));
    append(dock, dockHeader, append(missionBody, firstSteps, goalIntro, createForm, instructionForm));
    function setMissionExpanded(expanded) {
      state.missionExpanded = Boolean(expanded);
      if (!expanded) crewSettings.open = false;
      render();
    }
    on(dock, 'keydown', (event) => {
      if (event.key === 'Escape' && state.missionExpanded) {
        event.preventDefault(); setMissionExpanded(false); missionToggle.focus({ preventScroll: true });
      }
    });

    const inspector = element('aside', 'dv-inspector dv-glass', undefined, { 'aria-label': 'Facility and execution evidence' });
    const inspectorHead = element('header', 'dv-inspector-heading');
    const facilityTitle = element('h2', '', FACILITIES.research.title);
    const facilityDescription = element('p', 'dv-small', FACILITIES.research.description);
    const runBadge = element('span', 'dv-run-state', 'No run yet', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const inspectorToggle = action('Back to district', 'dv-button dv-button-quiet dv-inspector-toggle', () => {
      state.inspectorCollapsed = !state.inspectorCollapsed;
      render();
    }, { 'aria-controls': `${instance}-pane-container` });
    append(inspectorHead, inspectorToggle, append(element('div', 'dv-inspector-title'), facilityTitle, runBadge), facilityDescription);
    const areaRail = element('div', 'dv-area-rail');
    const tabList = element('div', 'dv-tabs', undefined, { role: 'tablist', 'aria-label': 'Work areas', 'aria-orientation': 'vertical', 'aria-multiselectable': 'true' });
    const areaToggles = element('fieldset', 'dv-area-toggles');
    append(areaToggles, element('legend', 'dv-sr-only', 'Keep multiple work areas open'));
    const tabs = {};
    const panes = {};
    const areaCheckboxes = {};
    for (const [id, facility] of Object.entries(FACILITIES)) {
      const tab = action(facility.name, 'dv-tab', (event) => chooseFacility(id, event), { role: 'tab', id: `${instance}-tab-${id}`, 'aria-controls': `${instance}-pane-${id}`, title: `${facility.name}: click to open one area; Ctrl/Command-click to keep more` });
      on(tab, 'keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); chooseFacility(id, event); return;
        }
        const ids = Object.keys(FACILITIES); let index = ids.indexOf(id);
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % ids.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index - 1 + ids.length) % ids.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = ids.length - 1;
        else return;
        event.preventDefault();
        if (event.shiftKey) chooseFacility(ids[index], event, true);
        else {
          areaSelection = selectionHelper?.focus ? selectionHelper.focus(areaSelection, ids[index], areaIds) : { ...areaSelection, focusedId: ids[index] };
          for (const [areaId, areaTab] of Object.entries(tabs)) areaTab.tabIndex = areaId === ids[index] ? 0 : -1;
          tabs[ids[index]].focus({ preventScroll: true });
        }
      });
      tabs[id] = tab;
      panes[id] = element('section', `dv-pane dv-pane-${id}`, undefined, { role: 'tabpanel', id: `${instance}-pane-${id}`, 'aria-labelledby': tab.id });
      append(panes[id], append(element('div', 'dv-pane-heading'), element('h3', 'dv-pane-title', facility.title), element('p', 'dv-small', facility.description)));
      const checkbox = input('input', 'dv-area-checkbox', `keep-${id}`, { type: 'checkbox', 'aria-label': `Keep ${facility.name} open`, 'aria-controls': panes[id].id, 'aria-describedby': `${instance}-area-help` });
      const checkboxLabel = append(element('label', 'dv-area-toggle', undefined, { for: checkbox.id, title: `Include ${facility.name} in the open work areas` }), checkbox);
      on(checkbox, 'change', () => toggleFacility(id));
      areaCheckboxes[id] = checkbox;
      append(areaToggles, checkboxLabel);
      append(tabList, tab);
    }
    const paneContainer = element('div', 'dv-pane-container', undefined, { id: `${instance}-pane-container` });
    append(paneContainer, ...Object.values(panes));

    const taskSummary = element('p', 'dv-task-summary', 'Create a project and send an instruction to a real worker.');
    const taskIdentity = element('p', 'dv-mono dv-small');
    const taskOutcome = element('p', 'dv-task-outcome');
    const activityTitle = element('h3', 'dv-section-title', 'Activity');
    const activityEmpty = element('p', 'dv-empty-copy', 'No activity yet. Reports will identify who said what; observed work is labeled separately.');
    const activityList = element('ol', 'dv-activity-list', undefined, { 'aria-label': 'Recent activity' });
    const historyTitle = element('h3', 'dv-section-title', 'Runs');
    const historyEmpty = element('p', 'dv-empty-copy', 'No runs in this project yet.');
    const historyList = element('div', 'dv-run-list', undefined, { 'aria-label': 'Project run history' });
    append(panes.research, taskSummary, taskIdentity, taskOutcome, activityTitle, activityEmpty, activityList, historyTitle, historyEmpty, historyList);

    const buildSummary = element('p', 'dv-task-summary', 'No candidate built yet.');
    const buildIdentity = element('dl', 'dv-facts');
    const buildIdentityDetails = element('details', 'dv-evidence');
    append(buildIdentityDetails, element('summary', '', 'Exact files & run identity'), buildIdentity);
    const buildHint = element('p', 'dv-small', 'A build saves a version of your app. The checks report what actually ran; the preview lets you try the result.');
    const buildPreview = action('Open selected candidate →', 'dv-button dv-button-primary', () => startPreview(candidateForRun(selectedRun())));
    const buildOutputDetails = element('details', 'dv-evidence');
    const buildOutput = element('pre', 'dv-output', 'No observed build output yet.', { tabindex: '0', 'aria-label': 'Observed execution output' });
    const followLabel = element('label', 'dv-follow');
    const follow = input('input', '', 'follow', { type: 'checkbox' }); follow.checked = true;
    append(followLabel, follow, element('span', '', 'Follow new output'));
    append(buildOutputDetails, element('summary', '', 'Observed output & provenance'), followLabel, buildOutput);
    on(buildOutput, 'scroll', () => {
      if (buildOutput.scrollHeight - buildOutput.scrollTop - buildOutput.clientHeight > 12) follow.checked = false;
    });
    on(follow, 'change', () => { if (follow.checked) buildOutput.scrollTop = buildOutput.scrollHeight; });
    const agentOutputDetails = element('details', 'dv-evidence');
    const agentOutput = element('pre', 'dv-output', 'No agent output recorded.', { tabindex: '0', 'aria-label': 'Agent output, reported' });
    append(agentOutputDetails, element('summary', '', 'Worker output (reported)'), agentOutput);
    append(panes.build, buildSummary, buildHint, buildPreview, buildIdentityDetails, buildOutputDetails, agentOutputDetails);

    const checksIntro = element('p', 'dv-task-summary', 'Build & check runs the real local recipe.');
    const checksKind = element('p', 'dv-small', 'Recipe checks cover file contracts, JavaScript syntax, local assets, and snapshot integrity. They do not establish full browser behavior.');
    const checksList = element('ol', 'dv-check-list', undefined, { 'aria-label': 'Observed recipe checks' });
    const checksEmpty = element('p', 'dv-empty-copy', 'No check events for this run yet.');
    const checkAgain = action('Run project checks', 'dv-button dv-button-secondary', () => dispatch('run_checks'));
    append(panes.test, checksIntro, checksKind, checksEmpty, checksList, checkAgain);
    const visualBlock = element('div', 'dv-visual-checks');
    const displaySelect = input('select', 'dv-select', 'test-display', { 'aria-label': 'Visual test display', 'aria-describedby': `${instance}-display-note` });
    const regionSelect = input('select', 'dv-select', 'test-region', { 'aria-label': 'Test area', 'aria-describedby': `${instance}-display-note` });
    const chooseTestArea = action('Choose test area…', 'dv-button dv-button-secondary', openScreenPicker);
    const displayNote = element('p', 'dv-small', 'Places visual preview and test windows within a real display. Headless recipe checks need no display. This does not add displays or choose a GPU.', { id: `${instance}-display-note` });
    const visualCheckButton = action('Run visual checks', 'dv-button dv-button-secondary', () => {
      const runId = visualCandidateId(selectedRun());
      if (runId) void dispatch('run_visual_checks', { payload: { runId } });
    });
    const visualSummary = element('p', 'dv-small', 'Visual checks have not been run on this candidate.', { role: 'status', 'aria-live': 'polite' });
    const visualPlacement = element('p', 'dv-small dv-mono');
    const visualEvidence = element('details', 'dv-evidence');
    const visualOutput = element('pre', 'dv-output', '', { tabindex: '0', 'aria-label': 'Observed visual check evidence' });
    append(visualEvidence, element('summary', '', 'Visual check evidence'), visualOutput);
    append(visualBlock, element('h3', 'dv-section-title', 'Visual browser checks'), labelFor(displaySelect, 'Visual test display'), labelFor(regionSelect, 'Test area'), chooseTestArea, displayNote, visualCheckButton, visualSummary, visualPlacement, visualEvidence);
    append(panes.test, visualBlock);
    const saveTestPlacement = () => dispatch('set_project_preferences', { payload: {
      testDisplayId: displaySelect.value, testRegion: regionSelect.value,
      testBounds: regionSelect.value === 'custom' ? project()?.preferences?.testBounds || null : null,
    } });
    on(displaySelect, 'change', saveTestPlacement);
    on(regionSelect, 'change', saveTestPlacement);

    const checkpointForm = element('form', 'dv-checkpoint-form');
    const checkpointLabel = input('input', 'dv-input', 'checkpoint-label', { type: 'text', placeholder: 'Before the next change', maxlength: '120' });
    const checkpointButton = element('button', 'dv-button dv-button-secondary', 'Save baseline', { type: 'submit' });
    append(checkpointForm, labelFor(checkpointLabel, 'Baseline name'), checkpointButton);
    on(checkpointForm, 'submit', (event) => {
      event.preventDefault(); void dispatch('create_checkpoint', { payload: { label: checkpointLabel.value.trim() || 'Saved baseline' } });
    });
    const checkpointHelp = element('p', 'dv-small', 'A baseline saves actual file bytes. Restore archives the current managed files before recovering that baseline.');
    const checkpointEmpty = element('p', 'dv-empty-copy', 'No baselines saved for this project.');
    const checkpointList = element('div', 'dv-checkpoint-list', undefined, { 'aria-label': 'Saved baselines' });
    const diffHeader = element('h3', 'dv-section-title', 'File changes');
    const diffStatus = element('p', 'dv-small', 'Choose Compare on a baseline to inspect current file changes.');
    const diffFiles = element('div', 'dv-diff-files');
    append(panes.review, checkpointForm, checkpointHelp, checkpointEmpty, checkpointList, diffHeader, diffStatus, diffFiles);

    const previewIdentity = element('p', 'dv-preview-status', 'Your app will appear here after its first build.');
    const previewVersionDetails = element('details', 'dv-evidence');
    const previewVersionFacts = element('dl', 'dv-facts');
    append(previewVersionDetails, element('summary', '', 'Which version is this?'), previewVersionFacts);
    const previewControls = element('div', 'dv-preview-actions');
    const openPreview = action('Open latest built candidate', 'dv-button dv-button-primary', () => startPreview());
    const closePreview = action('Close preview', 'dv-button dv-button-quiet', () => dispatch('preview_stop'));
    const openOnDisplay = action('Open on test display', 'dv-button dv-button-secondary', () => {
      const preview = selectedPreview();
      const runId = preview?.runId || latestCandidateRun()?.id;
      if (runId) void dispatch('open_preview_window', { payload: { runId } });
    });
    const previewDisplayNote = element('p', 'dv-small');
    const choosePreviewArea = action('Choose test area…', 'dv-button dv-button-quiet', openScreenPicker);
    const previewWindowSummary = element('p', 'dv-small dv-mono');
    const previewWindowEvidence = element('details', 'dv-evidence');
    const previewWindowOutput = element('pre', 'dv-output', '', { tabindex: '0', 'aria-label': 'Observed detached preview placement' });
    append(previewWindowEvidence, element('summary', '', 'Detached preview window evidence'), previewWindowOutput);
    const feedbackHost = element('div', 'dv-feedback-host');
    const feedbackFallback = element('p', 'dv-empty-copy', 'Preview controls are loading. Build and check a candidate before opening it.');
    append(feedbackHost, feedbackFallback);
    append(previewControls, openPreview, openOnDisplay, closePreview);
    append(panes.preview, previewIdentity, previewControls, previewDisplayNote, choosePreviewArea, feedbackHost, previewVersionDetails, previewWindowSummary, previewWindowEvidence);
    const areaHelp = element('p', 'dv-area-help', 'Click an area to open it. Ctrl/⌘-click or use the checkboxes to keep several open. At least one stays open.', { id: `${instance}-area-help` });
    append(areaRail, tabList, areaToggles);
    append(inspector, inspectorHead, areaHelp, append(element('div', 'dv-inspector-body'), areaRail, paneContainer));

    const footer = element('footer', 'dv-statusbar');
    const notice = element('p', 'dv-notice', 'Loading saved district state…', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const refreshButton = action('Refresh', 'dv-button dv-button-quiet', () => refresh());
    append(footer, notice, refreshButton);

    const help = element('dialog', 'dv-help-dialog', undefined, { 'aria-labelledby': `${instance}-help-title` });
    const helpClose = action('Close', 'dv-button dv-button-quiet', () => {
      if (typeof help.close === 'function') help.close();
      else { help.removeAttribute('open'); help.hidden = true; }
    });
    const cliConnection = element('p', 'dv-small dv-mono', 'CLI connection is loading.');
    const cliExamples = element('pre', 'dv-cli-example', 'agent-bus district status\nagent-bus district create "My app"\nagent-bus district run PROJECT --agent codex --instruction "Add a filter"');
    append(help, append(element('div', 'dv-dialog-title'), element('h2', '', 'One district. Two ways in.', { id: `${instance}-help-title` }), helpClose),
      element('p', '', 'Use the map or the command line. They operate on the same projects, runs, files and evidence.'), cliConnection, cliExamples,
      element('p', 'dv-small', 'CLI commands return receipts. Accepted means work was requested; check status for observed progress and results.'),
      element('h3', 'dv-section-title', 'Keyboard access'), element('p', '', 'Tab between controls. Up/Down moves through the work-area tabs; Enter or Space opens one. Control/Command plus activation, or the labeled checkboxes, keeps multiple areas open. Shift selects a range. No action requires dragging.'),
      element('h3', 'dv-section-title', 'Read the labels'), element('p', '', 'Reported activity comes from a worker. Observed activity comes from a real operation. A connected worker is not evidence of work or completion.'));
    on(help, 'click', (event) => { if (event.target === help) helpClose.click(); });
    append(world, sceneHost, projectCaption, fitButton, dock, inspector);
    append(app, header, world, footer, help);
    shell.append(app);
    container.append(shell);

    function startTask(value, selection) {
      const decline = (message) => { notify(message, 'warning'); return Promise.resolve({ status: 'rejected', error: message }); };
      if (!hasProject()) { projectName.focus(); return decline('Create or choose a project first.'); }
      if (state.readError || project()?.unavailable) return decline('Refresh this project before starting work. Its current files or state are unavailable.');
      if (!value) { instruction.focus(); return decline('Write an instruction for the worker first.'); }
      if (value.length > 12000) return decline('Keep the instruction within 12,000 characters. Your text is kept.');
      if (activeRun() || busy('start_task')) return decline('This project already has active work. Wait for its result or stop that run.');
      const worker = provider();
      if (!worker?.available) return decline(worker?.detail || 'No installed worker is available. Use local checks or install and sign in to Codex or Claude Code.');
      if (selection && (selection.projectId !== state.projectId || !selectedPreview() || selectedPreview().stale || selection.runId !== selectedPreview().runId || selection.candidateHash !== selectedPreview().candidateHash)) {
        return decline('This element belongs to an earlier preview. Open the current built candidate before requesting the change.');
      }
      revealFacility('research', false);
      return dispatch('start_task', { worker: state.worker, instruction: value,
        ...(model.value.trim() ? { model: model.value.trim() } : {}),
        ...(effort.value.trim() ? { effort: effort.value.trim() } : {}),
        ...(selection ? { payload: { selection } } : {}) });
    }
    function startPreview(candidate = latestCandidateRun()) {
      if (!candidate?.artifact || statusOf(candidate) !== 'passed') { notify('Build and check this project to create a real preview candidate.', 'warning'); revealFacility('test'); return; }
      revealFacility('preview');
      void dispatch('preview_start', { payload: { runId: candidate.id } });
    }
    async function dispatch(type, extra = {}) {
      if (state.destroyed) return null;
      const targetProject = typeof extra.projectId === 'string' ? extra.projectId : state.projectId;
      const key = `${type}:${type === 'create_project' ? '' : targetProject}`;
      if (pending.has(key)) return { status: 'rejected', error: 'This command is already being submitted.' };
      if (type !== 'create_project' && !state.snapshot.projects.some((item) => item.id === targetProject)) { notify('Create or choose a project first.', 'warning'); return { status: 'rejected', error: 'Choose a project first.' }; }
      pending.add(key); updateControls();
      const command = { id: requestId(), type, origin: 'gui', ...(targetProject ? { projectId: targetProject } : {}), ...extra };
      try {
        const receipt = await api.command(command);
        if (state.destroyed) return receipt;
        if (!receipt || receipt.status === 'rejected') throw new Error(errorText(receipt?.error));
        if (receipt.projectId && type === 'create_project') {
          state.projectId = receipt.projectId; state.runId = ''; instruction.value = FIRST_IDEA; drafts.set(receipt.projectId, FIRST_IDEA); projectName.value = ''; state.showCreate = false; state.missionExpanded = false; crewSettings.open = false; createForm.hidden = true;
        }
        if (receipt.runId && targetProject === state.projectId) state.runId = receipt.runId;
        if (type === 'inspect_diff' && targetProject === state.projectId) state.diff = { checkpointId: extra.payload?.checkpointId, result: receipt.result || {} };
        if (type === 'restore_checkpoint' && targetProject === state.projectId) state.diff = null;
        if (type === 'run_visual_checks') state.visualResults.set(`${targetProject}:${extra.payload?.runId || receipt.runId || ''}`, receipt.result || { state: receipt.status, detail: 'Visual checks requested; awaiting their observed result.' });
        if (type === 'open_preview_window' && receipt.result) state.previewWindows.set(targetProject, { ...receipt.result, runId: receipt.runId || extra.payload?.runId });
        const messages = {
          create_project: 'Your checklist is ready to make your own. Edit the suggested idea, then send it to your crew.',
          start_task: 'Task accepted. Watch for reported activity, observed file changes, and the actual result.',
          run_checks: 'Running the local project checks; selected agent is not being started.',
          cancel_run: 'Stop requested. The run remains active until process termination is confirmed.',
          create_checkpoint: 'Baseline saved with actual file bytes.',
          restore_checkpoint: 'Baseline restored. Build and check these recovered files before opening a new preview.',
          preview_start: 'Built candidate opened. Preview identity is shown above the page.',
          preview_stop: 'Preview closed.', inspect_diff: 'Comparison loaded from the actual baseline and current files.',
          set_project_preferences: 'Visual test display and area saved for this project. No checks or preview windows were started.',
          open_preview_window: 'Candidate preview requested on the project’s visual test display and area.',
          run_visual_checks: 'Visual browser checks requested. Their actual result and evidence appear in Checks.',
        };
        notify(messages[type] || (receipt.status === 'accepted' ? 'Command accepted. Awaiting observed results.' : 'Command completed.'), 'success');
        await refresh();
        return receipt;
      } catch (error) {
        if (!state.destroyed) notify(errorText(error), 'error');
        return { id: command.id, status: 'rejected', error: errorText(error) };
      } finally {
        pending.delete(key);
        if (!state.destroyed) updateControls();
      }
    }

    function updateControls() {
      const current = project();
      const active = activeRun();
      const invalidCustom = current?.preferences?.testRegion === 'custom' && !validCustomBounds(current.preferences.testBounds);
      const selectedProvider = provider();
      const writable = Boolean(current) && !current.unavailable && !active && !state.readError;
      const runningRequest = busy('start_task') || busy('run_checks');
      const creating = pending.has('create_project:');
      createButton.disabled = creating; text(createButton, creating ? 'Making your starting app…' : 'Start my checklist →');
      runButton.disabled = !writable || runningRequest || !selectedProvider?.available || !instruction.value.trim();
      text(runButton, active ? activeActionLabel(active) : busy('start_task') ? 'Sending your idea…' : 'Make this change →');
      localChecks.disabled = !writable || runningRequest;
      checkAgain.disabled = !writable || runningRequest;
      checkpointButton.disabled = !writable || busy('create_checkpoint');
      cancelButton.hidden = !active;
      cancelButton.disabled = busy('cancel_run') || ['stopping', 'termination_unknown'].includes(statusOf(active));
      text(cancelButton, statusOf(active) === 'stopping' ? 'Waiting for worker to stop…' : statusOf(active) === 'termination_unknown' ? 'Worker termination unconfirmed' : 'Stop this run');
      const candidate = latestCandidateRun();
      const candidateFresh = candidate && (!current?.manifest?.hash || current.manifest.hash === candidate.artifact?.candidateHash);
      tryAppButton.hidden = !candidate;
      tryAppButton.disabled = Boolean(active) || !candidateFresh || Boolean(state.readError);
      text(tryAppButton, active ? activeActionLabel(active) : candidateFresh ? 'Open my app →' : 'Check the latest changes first');
      openPreview.disabled = !current || !candidate || busy('preview_start') || Boolean(state.readError);
      const chosen = selectedRun();
      buildPreview.disabled = !current || !candidateForRun(chosen) || busy('preview_start') || Boolean(state.readError);
      text(buildPreview, chosen?.kind === 'visual' ? 'Open referenced built candidate →' : 'Open selected candidate →');
      closePreview.disabled = !selectedPreview() || busy('preview_stop');
      const hasDisplays = state.snapshot.displays?.length > 0;
      visualBlock.hidden = !hasDisplays;
      displaySelect.disabled = !current || Boolean(state.readError) || busy('set_project_preferences');
      regionSelect.disabled = displaySelect.disabled;
      chooseTestArea.disabled = !current || !hasDisplays || !screenPicker || Boolean(state.readError) || busy('set_project_preferences');
      choosePreviewArea.hidden = !hasDisplays;
      choosePreviewArea.disabled = chooseTestArea.disabled;
      visualCheckButton.disabled = !current || invalidCustom || !visualCandidateId(chosen) || Boolean(active) || Boolean(state.readError) || busy('run_visual_checks');
      text(visualCheckButton, busy('run_visual_checks') ? 'Running visual checks…' : 'Run visual checks');
      openOnDisplay.hidden = !hasDisplays;
      openOnDisplay.disabled = !current || invalidCustom || (!selectedPreview()?.runId && !latestCandidateRun()) || Boolean(state.readError) || busy('open_preview_window');
      text(displayNote, invalidCustom ? 'The saved custom area is missing or invalid. Choose a new area or preset before visual testing. Headless recipe checks need no display.' : 'Places visual preview and test windows within a real display. Headless recipe checks need no display. This does not add displays or choose a GPU.');
      for (const row of checkpointList.children) {
        row.children[2].children[0].disabled = busy('inspect_diff') || !current || Boolean(state.readError);
        row.children[2].children[1].disabled = Boolean(active) || busy('restore_checkpoint') || Boolean(state.readError);
      }
      text(workerNote, !state.loaded ? 'Detecting installed worker CLIs…' : selectedProvider?.available
        ? 'CLI detected. Login and quota are checked when a task starts.'
        : selectedProvider?.detail || 'No worker CLI found. Local build & checks remain available.');
      workerNote.dataset.available = String(Boolean(selectedProvider?.available));
      text(crewSummary, selectedProvider?.available ? `Your crew: ${selectedProvider.name || selectedProvider.id}` : 'Your crew needs a connection. Open Crew, checks & settings.');
      instruction.disabled = !current;
      if (!current) text(runNote, 'Create a project first. The starting files are a local template.');
      else if (current.unavailable) text(runNote, `Workspace unavailable: ${current.error || 'its files could not be read'}. Refresh or choose another project.`);
      else if (active) {
        const activeState = statusOf(active);
        text(runNote, activeState === 'stopping' ? 'Stop requested. Waiting to confirm the worker has exited.'
          : activeState === 'termination_unknown' ? 'The worker’s stop could not be confirmed. Open its details before starting more work.'
          : active.kind === 'visual' ? 'Your app is being checked in a real browser window.'
          : active.worker === 'local' ? 'Building and checking the real project files. No model calls.'
          : ['building', 'testing'].includes(activeState) ? 'Your change is being built and checked.'
          : ['queued', 'starting'].includes(activeState) ? 'Connecting your crew. Any sign-in or usage-limit problem will appear here.'
          : 'Your crew is making the change. Watch what it reports and what actually runs in the district.');
      }
      else text(runNote, `Uses your signed-in ${selectedProvider?.name || 'worker'} account. You will see real changes, checks and the result.`);
      refreshButton.disabled = Boolean(state.refreshing);
    }

    function updateFacts(parent, entries) {
      reconcile(parent, entries, (entry) => entry[0], () => {
        const pair = element('div', 'dv-fact'); append(pair, element('dt'), element('dd')); return pair;
      }, (pair, entry) => { text(pair.children[0], entry[0]); text(pair.children[1], entry[1]); });
    }
    function renderDiff() {
      const files = Array.isArray(state.diff?.result?.files) ? state.diff.result.files : [];
      text(diffStatus, !state.diff ? 'Choose Compare on a baseline to inspect current file changes.' : files.length
        ? `${files.length} file${files.length === 1 ? '' : 's'} in this comparison · baseline ${state.diff.checkpointId}${state.diff.result.truncated?' · Text shortened; file hashes cover all bytes':''}` : 'No file changes from this baseline.');
      reconcile(diffFiles, files, (file) => file.path, () => {
        const detail = element('details', 'dv-diff-file');
        append(detail, element('summary'), element('h4', '', 'Saved baseline'), element('pre', 'dv-output', '', { tabindex: '0' }),
          element('h4', '', 'Current file'), element('pre', 'dv-output', '', { tabindex: '0' })); return detail;
      }, (detail, file) => {
        text(detail.children[0], `${file.path} · ${file.status || 'changed'}${file.beforeTruncated||file.afterTruncated?' · Text excerpt':''}`);
        text(detail.children[2], file.before === null || file.before === undefined ? '(file absent)' : String(file.before).slice(0, 100000));
        text(detail.children[4], file.after === null || file.after === undefined ? '(file absent)' : String(file.after).slice(0, 100000));
      });
    }
    function render() {
      if (state.destroyed) return;
      const projects = state.snapshot.projects;
      const providers = state.snapshot.providers;
      options(projectSelect, projects.length ? projects.map((item) => ({ id: item.id, name: item.name || item.id })) : [{ id: '', name: state.loaded ? 'No projects yet' : 'Loading projects…' }]);
      projectSelect.value = state.projectId;
      projectSelect.disabled = !projects.length;
      options(workerSelect, providers.length ? providers.map((item) => ({ id: item.id, name: `${item.name || item.id}${item.available ? '' : ' · CLI unavailable'}` })) : [{ id: '', name: state.loaded ? 'No installed worker' : 'Detecting workers…' }]);
      workerSelect.value = state.worker;
      workerSelect.disabled = !providers.length;
      createForm.hidden = projects.length > 0 && !state.showCreate;
      const current = project();
      text(projectCaption.children[1], current?.name || 'A place for your next idea.');
      text(projectCaption.children[2], current?.unavailable ? 'This app’s files cannot be read. Open details for the reason.' : current ? 'Tell your crew what to change. Then try the real app.' : 'Start with a checklist. Make it yours.');
      projectCaption.children[2].title = '';
      app.classList.toggle('dv-has-project', Boolean(current));
      app.classList.toggle('dv-show-create', state.showCreate);
      app.classList.toggle('dv-mission-expanded', state.missionExpanded);
      missionToggle.hidden = !current || state.showCreate;
      missionToggle.setAttribute('aria-expanded', String(state.missionExpanded));
      text(missionToggle, state.missionExpanded ? 'Collapse mission' : 'Expand mission');
      text(missionTitle, current && !state.showCreate ? 'Tell your crew what to make.' : 'Make an app. See it work.');
      firstSteps.hidden = Boolean(current) && !state.showCreate;
      goalIntro.hidden = firstSteps.hidden;
      app.classList.toggle('dv-preview-open', state.facilities.includes('preview'));
      app.classList.toggle('dv-multi-open', state.facilities.length > 1);
      app.classList.toggle('dv-inspector-collapsed', state.inspectorCollapsed);
      paneContainer.hidden = state.inspectorCollapsed;
      areaHelp.hidden = state.inspectorCollapsed;
      text(inspectorToggle, state.inspectorCollapsed ? 'Details' : 'Back to district');
      inspectorToggle.setAttribute('aria-expanded', String(!state.inspectorCollapsed));
      inspectorToggle.setAttribute('aria-label', state.inspectorCollapsed ? 'Show selected work area details' : 'Hide work area details');
      text(facilityTitle, state.facilities.length > 1 ? `${state.facilities.length} work areas open` : FACILITIES[state.facility].title);
      text(facilityDescription, state.facilities.length > 1 ? state.facilities.map((id) => FACILITIES[id].name).join(' · ') : FACILITIES[state.facility].description);
      for (const [id, tab] of Object.entries(tabs)) {
        const selected = state.facilities.includes(id);
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = areaSelection.focusedId === id ? 0 : -1;
        areaCheckboxes[id].checked = selected;
        panes[id].hidden = !selected;
        panes[id].setAttribute('aria-expanded', String(selected));
      }
      const run = selectedRun();
      const runState = run ? statusOf(run) : 'none';
      text(runBadge, run ? runState.replaceAll('_', ' ') : 'No run yet'); runBadge.dataset.state = runState;
      text(taskSummary, run?.instruction || (run?.worker === 'local' ? 'Local build and recipe checks.' : 'Create a project and send an instruction to a real worker.'));
      text(taskIdentity, run ? `${run.worker || run.provider || 'Worker not recorded'} · ${time(run.created)}` : '');
      const taskDetail = run?.detail || (current?.unavailable ? current.error || 'The project files could not be read.' : '');
      text(taskOutcome, taskDetail); taskOutcome.hidden = !taskDetail; taskOutcome.dataset.state = current?.unavailable ? 'failed' : runState;
      const activities = state.snapshot.activities.filter((item) => item.projectId === state.projectId).slice()
        .sort((a, b) => Number(b.at || b.updated || b.created || 0) - Number(a.at || a.updated || a.created || 0)).slice(0, 14);
      activityEmpty.hidden = activities.length > 0;
      reconcile(activityList, activities, (item) => item.id || `${item.workerId}:${item.runId}:${item.phase}`, () => {
        const row = element('li', 'dv-activity'); append(row, element('span', 'dv-activity-dot', '', { 'aria-hidden': 'true' }),
          append(element('div'), element('div', 'dv-activity-meta'), element('p'))); return row;
      }, (row, item) => {
        row.dataset.basis = item.basis || 'unknown'; row.dataset.phase = item.phase || 'unknown';
        text(row.children[1].children[0], `${item.basis === 'observed' ? 'Observed' : item.basis === 'reported' ? 'Agent-reported' : 'Inferred'} · ${item.workerId || 'Unknown worker'} · ${time(item.at || item.updated || item.created)}`);
        text(row.children[1].children[1], item.message || item.label || item.phase || 'Activity details not recorded');
      });
      const runs = projectRuns().slice(0, 12);
      const hasCrewRequest = runs.some((item) => ['codex', 'claude'].includes(item.worker || item.provider));
      firstSteps.children[0].dataset.current = String(!current);
      firstSteps.children[1].dataset.current = String(Boolean(current) && !hasCrewRequest);
      firstSteps.children[2].dataset.current = String(Boolean(latestCandidateRun()));
      text(goalIntro, current ? 'Describe your idea below. The crew changes real files, then builds and checks them.' : 'Start with a working checklist. Give your crew an idea and make it yours.');
      historyEmpty.hidden = runs.length > 0;
      reconcile(historyList, runs, (item) => item.id, () => action('', 'dv-run-item', (event) => {
        state.runId = event.currentTarget.dataset.runId; render();
      }), (button, item) => {
        button.dataset.runId = item.id; button.dataset.state = statusOf(item);
        button.setAttribute('aria-pressed', String(item.id === run?.id));
        text(button, `${statusOf(item).replaceAll('_', ' ')} · ${item.worker || item.provider || 'local'} · ${time(item.created)}`);
        button.title = item.instruction || item.detail || 'Local build & checks';
      });
      const checks = Array.isArray(run?.checks) ? run.checks : [];
      const passed = checks.filter((check) => (check.state || check.status) === 'passed').length;
      const checkKind = run?.kind === 'visual' ? 'visual browser' : 'recipe';
      text(checksIntro, run ? checks.length ? `${passed}/${checks.length} observed ${checkKind} checks passed · ${runState.replaceAll('_', ' ')}` : `Waiting for observed ${checkKind} checks · ${runState.replaceAll('_', ' ')}` : 'No check run yet. Build & check runs the real local recipe.');
      text(checksKind, run?.kind === 'visual' ? 'These checks exercised the real built app in a browser. Its exact version and window placement are in the evidence below.' : 'These checks verify the app’s files, JavaScript, linked assets and saved version. They do not prove browser behavior; try the app or run visual checks too.');
      checksEmpty.hidden = checks.length > 0;
      reconcile(checksList, checks, (check) => check.name || check.id, () => {
        const row = element('li', 'dv-check'); append(row, element('span', 'dv-check-symbol', '', { 'aria-hidden': 'true' }),
          append(element('div'), element('strong'), element('p', 'dv-small'))); return row;
      }, (row, check) => {
        const checkState = check.state || check.status || 'pending'; row.dataset.state = checkState;
        text(row.children[0], checkState === 'passed' ? '✓' : checkState === 'failed' ? '!' : checkState === 'running' ? '↻' : '·');
        text(row.children[1].children[0], check.name || check.id || 'Unnamed check');
        text(row.children[1].children[1], `${checkState.replaceAll('_', ' ')}${check.detail ? ` · ${check.detail}` : ''}`);
      });
      const displays = state.snapshot.displays || [];
      const savedDisplay = String(current?.preferences?.testDisplayId || '');
      const savedRegion = current?.preferences?.testRegion || 'full';
      const defaultDisplay = displays.find((display) => String(display.id) === String(state.snapshot.defaultTestDisplayId || ''));
      const defaultDisplayLabel = defaultDisplay ? `App default · ${defaultDisplay.name || `Display ${defaultDisplay.id}`}` : 'System default';
      const displayOptions = [{ id: '', name: defaultDisplayLabel }, ...displays.map((display) => ({
        id: String(display.id), name: `${display.name || `Display ${display.id}`}${display.primary ? ' · Primary' : ''}${display.bounds?.width && display.bounds?.height ? ` · ${display.bounds.width} × ${display.bounds.height}` : ''}`,
      }))];
      if (savedDisplay && !displayOptions.some((display) => display.id === savedDisplay)) displayOptions.push({ id: savedDisplay, name: `Saved display unavailable · ${savedDisplay}`, disabled: true });
      options(displaySelect, displayOptions);
      displaySelect.value = savedDisplay;
      const regionOptions = [...TEST_REGIONS];
      if (savedRegion === 'custom') regionOptions.push({ id: 'custom', name: validCustomBounds(current?.preferences?.testBounds) ? 'Custom area · saved rectangle' : 'Custom area · missing or invalid rectangle' });
      options(regionSelect, regionOptions);
      regionSelect.value = regionOptions.some((region) => region.id === savedRegion) ? savedRegion : 'full';
      previewDisplayNote.hidden = !displays.length;
      text(previewDisplayNote, `Visual test placement: ${displayOptions.find((display) => display.id === savedDisplay)?.name || defaultDisplayLabel} · ${regionName(savedRegion)}. Change it in Checks.`);
      const visualResult = run?.visualChecks || run?.visualCheckResult || state.visualResults.get(`${state.projectId}:${run?.id || ''}`);
      const visualState = visualResult?.state || visualResult?.status;
      text(visualSummary, visualResult ? `${visualState ? `${String(visualState).replaceAll('_', ' ')} · ` : ''}${visualResult.error || visualResult.detail || visualResult.message || 'Observed visual check evidence is available below.'}` : run?.kind === 'visual' && ACTIVE.has(runState) ? `Visual browser checks are ${runState.replaceAll('_', ' ')}. Awaiting their observed result.` : visualCandidateId(run) ? 'Visual checks have not been run on this candidate.' : 'Build and check a candidate before running visual browser checks.');
      text(visualPlacement, placementText(visualResult)); visualPlacement.hidden = !visualPlacement.textContent;
      visualEvidence.hidden = !visualResult;
      const visualText = visualResult ? visualResult.output || JSON.stringify(visualResult, null, 2) : '';
      if (visualOutput.textContent !== visualText) { const scrollTop = visualOutput.scrollTop; text(visualOutput, visualText); visualOutput.scrollTop = scrollTop; }
      text(buildSummary, run?.detail || (run?.kind === 'visual' ? `Visual browser checks ${runState.replaceAll('_', ' ')}. Open the referenced built app to try it.` : run ? `${runState.replaceAll('_', ' ')} · ${run.artifact ? 'Built candidate recorded.' : 'No built candidate for this run yet.'}` : 'No candidate built yet.'));
      const sourceHash = run?.source?.hash || run?.sourceHash;
      const candidateHash = run?.artifact?.candidateHash || run?.artifact?.hash;
      updateFacts(buildIdentity, run ? [
        ['Project location', current?.root || 'Not recorded'], ['Run', run.id], ['Kind', run.kind === 'visual' ? 'Visual browser checks' : run.worker === 'local' ? 'Local recipe' : 'Worker edit and recipe'],
        ...(run.candidateRunId ? [['Built candidate run', run.candidateRunId]] : []), ['Worker', run.worker || run.provider || 'Not recorded'],
        ['Session', run.sessionId || run.session_id || 'Not recorded / local recipe'],
        ['Source hash', sourceHash || 'Not recorded'], ['Candidate hash', candidateHash || (run.kind === 'visual' ? 'See referenced built candidate' : 'Not built')],
        ['Artifact', run.artifact?.root || (run.kind === 'visual' ? 'Visual checks do not create a new artifact' : 'Not built')], ['Exit code', run.exitCode ?? run.exit_code ?? 'Not recorded'],
      ] : current ? [['Project location', current.root || 'Not recorded'], ['Workspace', current.unavailable ? current.error || 'Files unavailable' : 'Starting template files']] : []);
      const nextOutput = String(run?.output || 'No observed build output yet.');
      if (buildOutput.dataset.runId !== (run?.id || '')) {
        buildOutput.dataset.runId = run?.id || ''; follow.checked = true;
      }
      if (buildOutput.textContent !== nextOutput) {
        const scrollTop = buildOutput.scrollTop;
        if (nextOutput.startsWith(buildOutput.textContent) && buildOutput.textContent.length) buildOutput.append(doc.createTextNode(nextOutput.slice(buildOutput.textContent.length)));
        else text(buildOutput, nextOutput);
        buildOutput.scrollTop = follow.checked ? buildOutput.scrollHeight : scrollTop;
      }
      text(agentOutput, run?.agentOutput || run?.agent_output || 'No agent output recorded.');
      const checkpoints = state.snapshot.checkpoints.filter((item) => item.projectId === state.projectId).slice()
        .sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
      checkpointEmpty.hidden = checkpoints.length > 0;
      reconcile(checkpointList, checkpoints, (item) => item.id, () => {
        const row = element('article', 'dv-checkpoint');
        const compare = action('Compare', 'dv-button dv-button-quiet', () => dispatch('inspect_diff', { payload: { checkpointId: row.dataset.checkpointId } }));
        const restore = action('Restore', 'dv-button dv-button-quiet', () => restoreBaseline(row.dataset.checkpointId));
        append(row, element('strong'), element('span', 'dv-small dv-mono'), append(element('div', 'dv-checkpoint-actions'), compare, restore));
        return row;
      }, (row, item) => {
        row.dataset.checkpointId = item.id; text(row.children[0], item.label || 'Saved baseline');
        text(row.children[1], `${time(item.created)} · ${shortHash(item.manifest?.hash || item.hash || item.id)}`);
        row.children[2].children[0].disabled = busy('inspect_diff') || !hasProject();
        row.children[2].children[1].disabled = Boolean(activeRun()) || busy('restore_checkpoint') || Boolean(state.readError);
        row.children[2].children[1].setAttribute('aria-label', `Restore baseline ${item.label || item.id}`);
      });
      renderDiff();
      const preview = selectedPreview();
      const windowResult = state.previewWindows.get(state.projectId);
      previewWindowEvidence.hidden = !windowResult;
      previewWindowSummary.hidden = !windowResult;
      text(previewWindowSummary, windowResult ? `Preview window · ${placementText(windowResult)}` : '');
      text(previewWindowOutput, windowResult ? JSON.stringify(windowResult, null, 2) : '');
      const previewRun = preview ? state.snapshot.runs.find((item) => item.id === preview.runId) : null;
      const stale = Boolean(preview && (preview.stale || (preview.currentHash && preview.currentHash !== preview.candidateHash) || (current?.manifest?.hash && previewRun?.source?.hash && current.manifest.hash !== previewRun.source.hash)));
      text(previewIdentity, preview ? stale ? 'Earlier version · your files have changed.' : 'Built preview · try it here' : 'Your app will appear here after its first build.');
      updateFacts(previewVersionFacts, preview ? [['Built candidate run', preview.runId], ['Candidate hash', preview.candidateHash], ['Preview address', preview.url], ['Freshness', stale ? 'Earlier candidate; source has changed' : 'Matches the observed source']] : []);
      previewIdentity.dataset.stale = String(stale);
      if (feedback) feedback.update({ preview, stale, instructionDisabled: !hasProject() || Boolean(activeRun()) || !provider()?.available || Boolean(state.readError) || busy('start_task') });
      const connection = state.snapshot.connection;
      text(cliConnection, connection?.connectionFile ? `Connection file: ${connection.connectionFile}` : 'The app has not reported a CLI connection file yet.');
      const projectArg = current?.id || 'PROJECT';
      text(cliExamples, `agent-bus district status\nagent-bus district run ${projectArg} --agent ${state.worker || 'codex'} --instruction "Add a filter"\nagent-bus district check ${projectArg}\nagent-bus district preview ${projectArg}`);
      const readLabel = state.readError ? 'Saved state · refresh failed' : state.loaded ? `State synced · ${time(state.lastRead)}` : 'Loading district…';
      text(connectionBadge, readLabel); connectionBadge.dataset.error = String(Boolean(state.readError));
      if (scene) scene.update({ project: current, workers: providers, activities: state.snapshot.activities, unavailable: Boolean(state.readError || current?.unavailable),
        runs: state.snapshot.runs, selectedWorker: state.worker, selectedFacility: state.facility, selectedFacilities: [...state.facilities] });
      updateControls();
      scheduleLayout();
    }

    function syncLayout() {
      layoutFrame = null;
      if (state.destroyed || !scene || typeof sceneHost.getBoundingClientRect !== 'function') return;
      const bounds = sceneHost.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      const overlaps = (rect) => rect.width > 0 && rect.height > 0 && rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom;
      const dockBounds = dock.getBoundingClientRect();
      const inspectorBounds = inspector.getBoundingClientRect();
      const captionBounds = projectCaption.getBoundingClientRect();
      const bottomDock = overlaps(dockBounds) && dockBounds.width > bounds.width * .5;
      const left = overlaps(dockBounds) && !bottomDock ? Math.max(0, Math.ceil(dockBounds.right - bounds.left + 14)) : 0;
      const right = overlaps(inspectorBounds) ? Math.max(0, Math.ceil(bounds.right - inspectorBounds.left + 14)) : 0;
      // The left strip already covers its caption and Fit control; do not reserve that space twice.
      const captionInMap = overlaps(captionBounds) && captionBounds.right > bounds.left + left && captionBounds.left < bounds.right - right;
      const top = captionInMap ? Math.max(12, Math.ceil(captionBounds.bottom - bounds.top + 12)) : 12;
      const bottom = bottomDock ? Math.max(56, Math.ceil(bounds.bottom - dockBounds.top + 14)) : 56;
      const signature = [Math.round(bounds.width), Math.round(bounds.height), left, right, top, bottom].join(':');
      if (signature === layoutSignature) return;
      layoutSignature = signature;
      for (const [side, value] of Object.entries({ left, right, top, bottom })) sceneHost.style.setProperty(`--dv-scene-inset-${side}`, `${value}px`);
      if (typeof scene.resize === 'function') scene.resize(); else scene.fit();
    }
    function scheduleLayout() {
      if (state.destroyed || layoutFrame !== null || !scene) return;
      if (typeof window.requestAnimationFrame === 'function') layoutFrame = window.requestAnimationFrame(syncLayout);
      else syncLayout();
    }

    async function refresh() {
      if (state.destroyed) return;
      if (state.refreshing) return state.refreshing;
      clearTimeout(state.timer);
      const request = (async () => {
        await Promise.resolve();
        try {
          const next = await api.snapshot();
          if (state.destroyed) return;
          if (!next || typeof next !== 'object') throw new Error('The district returned no state.');
          state.snapshot = { ...next };
          for (const key of ['projects', 'providers', 'runs', 'checkpoints', 'previews', 'activities', 'displays']) state.snapshot[key] = Array.isArray(next[key]) ? next[key] : [];
          screenPicker?.updateDisplays?.(state.snapshot.displays);
          const recovering = Boolean(state.readError);
          state.readError = ''; state.loaded = true; state.lastRead = Date.now();
          if (!state.snapshot.projects.some((item) => item.id === state.projectId)) {
            const first = state.snapshot.projects[0];
            state.projectId = first?.id || ''; state.runId = ''; state.diff = null;
            instruction.value = drafts.get(state.projectId) || '';
          }
          if (!state.snapshot.providers.some((item) => item.id === state.worker)) {
            state.worker = (state.snapshot.providers.find((item) => item.available) || state.snapshot.providers[0])?.id || '';
          }
          if (!noticeKey) notify(state.snapshot.projects.length ? 'Choose a worker and give it an instruction. Every result stays tied to its real files.' : 'Start by naming your project. The working checklist template is ready to build.', 'info');
          else if (recovering) notify('District state refreshed. Showing the latest observed records.', 'info');
          render();
        } catch (error) {
          if (state.destroyed) return;
          state.readError = errorText(error);
          notify(`Cannot refresh district state: ${state.readError}${state.loaded ? ' Showing the last observed records.' : ''}`, 'error');
          render();
        } finally {
          state.refreshing = null;
          if (!state.destroyed) {
            updateControls();
            state.timer = setTimeout(refresh, configuredPoll ?? (state.snapshot.runs.some((run) => ACTIVE.has(statusOf(run))) ? 1000 : 2500));
          }
        }
      })();
      state.refreshing = request;
      updateControls();
      return request;
    }

    if (typeof window.DistrictScene === 'function') {
      sceneFallback.remove();
      scene = new window.DistrictScene({ container: sceneHost, onFacility: (id) => setFacility(id), onWorker: (id) => setWorker(id), onAssign: ({ worker, facility }) => {
        if (!hasProject()) { notify('Create a project before assigning a worker.', 'warning'); projectName.focus(); return; }
        setWorker(worker);
        if (facility === 'research' || facility === 'build') void startTask(instruction.value.trim(), null);
        else if (facility === 'test') {
          revealFacility('test');
          if (state.readError || project()?.unavailable) { notify('Refresh this project before running checks. Its current files or state are unavailable.', 'warning'); return; }
          if (activeRun() || busy('run_checks') || busy('start_task')) { notify('This project already has active work. Wait for its result or stop that run before running checks.', 'warning'); return; }
          void dispatch('run_checks');
        }
        else if (facility === 'preview') startPreview();
        else { revealFacility('review'); notify('Review opens saved baselines and file comparisons. Save or select a baseline to continue.'); }
      } });
    }
    if (typeof window.DistrictFeedback === 'function') {
      feedbackFallback.remove();
      feedback = new window.DistrictFeedback({ container: feedbackHost, onRequestChange: ({ instruction: value, selection }) => startTask(String(value || '').trim(), selection) });
    }
    if (typeof window.DistrictScreenPicker === 'function') {
      screenPicker = new window.DistrictScreenPicker({ onApply: (preferences,metadata) => dispatch('set_project_preferences', {
        projectId: pickerProjectId, payload: { testDisplayId: preferences.testDisplayId, testRegion: preferences.testRegion, testBounds: preferences.testBounds || null,...(metadata?.geometryKey?{testDisplayGeometry:metadata.geometryKey}:{}) },
      }) });
    }
    if (typeof ResizeObserver === 'function') {
      layoutObserver = new ResizeObserver(scheduleLayout);
      for (const target of [world, dock, inspector, projectCaption, fitButton]) layoutObserver.observe(target);
    }
    if (typeof window.addEventListener === 'function') on(window, 'resize', scheduleLayout);
    render();
    void refresh();
    return {
      refresh,
      setProject,
      setFacilities,
      getSelection,
      destroy() {
        if (state.destroyed) return;
        state.destroyed = true; clearTimeout(state.timer);
        layoutObserver?.disconnect();
        if (layoutFrame !== null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(layoutFrame);
        for (const cleanup of listeners) cleanup();
        scene?.destroy(); feedback?.destroy();
        screenPicker?.destroy();
        if (help.open && typeof help.close === 'function') help.close();
        shell.remove();
      },
    };
  }
  window.DistrictUI = Object.freeze({ mount });
})();
