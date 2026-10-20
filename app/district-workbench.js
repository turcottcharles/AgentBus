(function () {
  'use strict';

  const ACTIVE = new Set(['queued', 'starting', 'working', 'running', 'building', 'testing', 'stopping', 'termination_unknown']);
  const ARRAYS = ['projects', 'runs', 'activities', 'providers', 'checkpoints', 'previews'];
  const SELECTION_KEY = 'agent-bus.district.project-selection.v1';
  const MODE_KEY = 'agent-bus.district.workspace-mode.v1';
  const VIEW_KEY = 'agent-bus.district.workspace-view.v1';
  let mounts = 0;

  function mount({ container, api } = {}) {
    if (!container || !api || typeof api.snapshot !== 'function' || typeof api.command !== 'function') throw new TypeError('DistrictWorkbench requires a container and snapshot/command API.');
    if (!window.DistrictSelection || !window.DistrictUI?.mount) throw new Error('Load DistrictSelection and DistrictUI before DistrictWorkbench.');
    const selectionApi = window.DistrictSelection;
    const doc = container.ownerDocument;
    const instance = `district-workbench-${++mounts}`;
    const listeners = [];
    const tabs = new Map();
    const cards = new Map();
    const panes = new Map();
    const initialInstructions = new Map();
    const initialFacilities = new Map();
    const attentionItems = new Map();
    const followedCommands = new Set();
    const followedRuns = new Set();
    const state = {
      snapshot: null, selection: null, focusedProject: '', mode: 'overview', navigation: 'top',
      destroyed: false, inFlight: null, timer: null, createPending: false,
      loaded: false, commandNumber: 0, readError: '', paneNumber: 0, galleryExpanded: false,
      entryActive: false, entryPending: false, entryProjectId: '', entryRunId: '', entryWaitTimer: null, entryWaitResolve: null,
      entryLeaving: false, entryTransitionTimer: null,
      entryEngaged: false, entryTaskId: '', entryInstruction: '', entryOutputOpen: false,
      worldPollTimer: null, worldPollCount: 0, worldMountFailed: false, visible: true,
      entryCreateId: '', entryCheckId: '',
      entryTaskRequest: null,
      mapJob: null, mapJobUnavailable: false, mapJobFollowed: false,
    };
    let persistedSelection = '';
    let conversation = null, continuation = null;
    let playFeedback = null;
    let attractWorld = null;
    let inputObserver = null;
    let mapInteraction = null;
    try {
      persistedSelection = window.localStorage.getItem(SELECTION_KEY) || '';
      if (window.localStorage.getItem(MODE_KEY) === 'split') state.mode = 'split';
      if (typeof selectionApi.deserializeView === 'function') {
        const view = selectionApi.deserializeView(window.localStorage.getItem(VIEW_KEY) || window.localStorage.getItem(MODE_KEY));
        state.navigation = view.navigation; state.mode = view.layout;
      }
    } catch { /* Display preferences do not require local storage. */ }

    function el(tag, className, text, attrs) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      if (attrs) for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
      return node;
    }
    function add(parent, ...children) { parent.append(...children); return parent; }
    function on(node, type, handler, options) { node.addEventListener(type, handler, options); listeners.push(() => node.removeEventListener(type, handler, options)); }
    function button(label, handler, className = 'dv-button') {
      const node = el('button', className, label, { type: 'button' }); on(node, 'click', handler); return node;
    }
    function text(node, value) { const next = String(value ?? ''); if (node.textContent !== next) node.textContent = next; }
    function errorText(error) { return String(error?.message || error?.error || error || 'The operation did not complete.').slice(0, 1500); }
    function timestamp(value) { return typeof value === 'number' ? value : Date.parse(value) || 0; }
    function newest(items) { return items.slice().sort((a, b) => timestamp(b.created || b.at || b.updated) - timestamp(a.created || a.at || a.updated)); }
    function projectIds() { return (state.snapshot?.projects || []).map((project) => project.id); }
    function chosenIds() { return state.selection?.selectedIds || []; }
    function projectById(id) { return state.snapshot?.projects.find((project) => project.id === id) || null; }
    function announce(message, tone = 'info') { text(notice, message); notice.dataset.tone = tone; }
    function savePreferences() {
      try {
        if (state.selection) window.localStorage.setItem(SELECTION_KEY, selectionApi.serialize(state.selection));
        window.localStorage.setItem(MODE_KEY, state.mode);
        if (typeof selectionApi.serializeView === 'function') window.localStorage.setItem(VIEW_KEY, selectionApi.serializeView({ navigation: state.navigation, layout: state.mode }));
      } catch { /* In-memory selection and drafts still work. */ }
    }
    function commandId() { return `gui-workbench-${window.crypto?.randomUUID?.() || `${Date.now()}-${++state.commandNumber}`}`; }
    function rejected(command, message) { return { id: command?.id, status: 'rejected', error: message }; }
    function scopedSnapshot(projectId) {
      const current = state.snapshot;
      if (!current) return refresh().then(() => scopedSnapshot(projectId));
      if (!projectId) return Promise.resolve(current);
      const scoped = { ...current };
      // Region selection may display other projects without granting cross-project commands.
      scoped.allProjects = Array.isArray(current.allProjects) ? current.allProjects : current.projects;
      for (const key of ['projects', 'runs', 'activities', 'checkpoints', 'previews']) {
        scoped[key] = current[key].filter((record) => key === 'projects' ? record.id === projectId : record.projectId === projectId);
      }
      return Promise.resolve(scoped);
    }
    async function childCommand(projectId, command) {
      if (state.destroyed) return rejected(command, 'The workbench is closed.');
      if (!command || typeof command !== 'object') return rejected(command, 'A command is required.');
      if (projectId && command.type === 'create_project') return rejected(command, 'Use New project above the project tabs to create another workspace.');
      if (projectId && command.projectId && command.projectId !== projectId) return rejected(command, 'This workspace can operate only on its own project. Open the other project tab to change it.');
      const target = projectId || command.projectId;
      if (projectId && !projectById(projectId)) return rejected(command, 'This project is no longer available.');
      for (const [field, records] of [['runId', state.snapshot?.runs], ['checkpointId', state.snapshot?.checkpoints]]) {
        const id = command.payload?.[field];
        const record = id && records?.find((item) => item.id === id);
        if (target && record && record.projectId !== target) return rejected(command, 'The selected result belongs to another project.');
      }
      if (target && command.payload?.selection?.projectId && command.payload.selection.projectId !== target) return rejected(command, 'The selected preview belongs to another project.');
      let receipt;
      try { receipt = await api.command({ ...command, ...(target ? { projectId: target } : {}) }); }
      catch (error) { return rejected(command, errorText(error)); }
      if (!state.destroyed) {
        if (command.type === 'create_project' && receipt?.status !== 'rejected' && receipt?.projectId) {
          initialInstructions.set(receipt.projectId, command.payload?.starterId === 'neon-rally'
            ? 'Make Neon Rally feel like my game: let me rename both teams and give each a distinct color. Keep scoring, themes, and reset working.'
            : 'Make this checklist feel like my own app: add a warm welcome, clearer task labels, and a visible count of completed tasks. Keep adding and checking tasks working.');
        }
        await refresh();
        if (state.destroyed) return receipt;
        if (command.type === 'create_project' && receipt?.status !== 'rejected' && receipt?.projectId) selectCreated(receipt.projectId);
      }
      return receipt;
    }
    function childApi(projectId) {
      return {
        snapshot: () => scopedSnapshot(projectId),
        command: (command) => childCommand(projectId, command),
        openSmoke: () => api.openSmoke?.(),
      };
    }

    const root = el('section', 'dw-app dv-theme', undefined, { 'aria-label': 'Agent Bus creation district' });
    root.dataset.entry = 'true';
    root.dataset.showcase = 'true';
    root.dataset.sound = 'muted';
    root.dataset.ambient = doc.hidden ? 'paused' : 'idle';
    const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const header = el('header', 'dw-header');
    const heading = add(el('div', 'dw-heading'), el('span', 'dw-eyebrow', 'AGENT BUS / YOUR CREATION DISTRICT'), el('h1', '', 'Make something together.'));
    const modes = el('div', 'dw-modes', undefined, { role: 'group', 'aria-label': 'Workspace view preference' });
    const overviewButton = button('Combined overview', () => setMode('overview'), 'dv-button dw-mode');
    const splitButton = button('Side by side', () => setMode('split'), 'dv-button dw-mode');
    add(modes, overviewButton, splitButton);
    const navigationControls = el('div', 'dw-navigation-controls', undefined, { role: 'group', 'aria-label': 'Project tab position' });
    const navigationTop = button('Project tabs on top', () => setNavigation('top'), 'dv-button dw-navigation-top');
    const navigationSide = button('Project tabs on side', () => setNavigation('side'), 'dv-button dw-navigation-side');
    add(navigationControls, navigationTop, navigationSide);
    const newButton = button('+ New project', () => {
      createForm.hidden = !createForm.hidden;
      newButton.setAttribute('aria-expanded', String(!createForm.hidden));
      if (!createForm.hidden) projectName.focus();
    }, 'dv-button dv-button-primary dw-new');
    newButton.setAttribute('aria-expanded', 'false');
    newButton.setAttribute('aria-controls', `${instance}-create`);
    const buildArea=button('Build area',()=>{
      const project=projectById(state.focusedProject)||projectById(chosenIds()[0])||state.snapshot?.projects[0];
      if(!project)return;
      state.entryProjectId=project.id;state.entryEngaged=true;state.entryActive=false;state.entryOutputOpen=false;
      state.entryTaskId=newest((state.snapshot?.runs||[]).filter(run=>run.projectId===project.id))[0]?.id||'';
      renderLayout();
    },'dv-button dw-build-area');
    add(header, heading, modes, navigationControls, buildArea, newButton);

    const projectNav = el('nav', 'dw-project-nav', undefined, { 'aria-label': 'Projects' });
    const tablist = el('div', 'dw-project-tabs', undefined, { role: 'tablist', 'aria-label': 'Selected project workspaces', 'aria-multiselectable': 'true', 'aria-orientation': 'horizontal', 'aria-describedby': `${instance}-selection-help` });
    const selectionHelp = el('p', 'dw-selection-help', 'Choose one project, Ctrl/⌘-click to add or remove, or Shift-click a range. The + / ✓ buttons also select projects without a keyboard.', { id: `${instance}-selection-help` });
    const selectedCount = el('span', 'dw-selected-count');
    add(projectNav, tablist, add(el('div', 'dw-nav-help'), selectionHelp, selectedCount));

    const createForm = el('form', 'dw-create', undefined, { id: `${instance}-create`, 'data-testid': 'district-create-form' }); createForm.hidden = true;
    const projectName = el('input', 'dv-input dw-project-name', undefined, { id: `${instance}-name`, type: 'text', maxlength: '80', autocomplete: 'off', placeholder: 'Name the new project', 'aria-label': 'New project name', 'data-testid': 'district-create-name' });
    const createLabel = add(el('label', 'dw-create-label', undefined, { for: projectName.id }), el('span', 'dv-label', 'New project name'), projectName);
    const createButton = el('button', 'dv-button dv-button-primary', 'Create project', { type: 'submit', 'data-testid': 'district-create-submit' });
    const createCancel = button('Cancel', () => { createForm.hidden = true; newButton.setAttribute('aria-expanded', 'false'); newButton.focus(); }, 'dv-button dv-button-quiet');
    add(createForm, createLabel, createButton, createCancel, el('p', 'dw-create-help', 'Start with a working checklist, then tell your agent what you want to make.'));
    on(createForm, 'submit', (event) => { event.preventDefault(); void createProject(); });

    const notice = el('p', 'dw-notice', 'Reading the real projects and run states…', { role: 'status', 'aria-live': 'polite' });
    const attention = el('section', 'dw-attention', undefined, { 'aria-label': 'Project attention' }); attention.hidden = true;
    const attentionStatus = el('p', 'dw-attention-status');
    const attentionList = el('ul', 'dw-attention-list', undefined, { 'aria-label': 'Recorded signals across projects', tabindex: '0' });
    add(attention, el('h2', '', 'Across your projects'), attentionStatus, attentionList);
    const content = el('div', 'dw-content');
    const overviewReturn = el('div', 'dw-overview-return');
    const overviewSummary = el('p');
    const overviewBack = button('← All selected projects', () => {
      state.galleryExpanded = true; renderLayout();
    }, 'dv-button dv-button-quiet');
    add(overviewReturn, overviewSummary, overviewBack);
    const overview = el('section', 'dw-overview', undefined, { 'aria-label': 'Combined overview of selected projects' });
    const overviewHeader = add(el('div', 'dw-overview-heading'), el('h2', '', 'Bring your next idea to life.'), el('p', '', 'Enter a project, tell your agent what should change, then try what you made. Each project keeps its own instructions, files, checks and actual preview.'));
    const cardGrid = el('div', 'dw-project-cards');
    add(overview, overviewHeader, cardGrid);
    const workspaceHint = el('p', 'dw-workspace-hint');
    const workspaceHost = el('div', 'dw-workspaces', undefined, { 'aria-label': 'Project workspaces' });
    const welcome = el('section', 'dw-welcome', undefined, { 'aria-label': 'Agent Bus attract screen' });
    welcome.hidden = true;
    const welcomeArt = el('div', 'dw-welcome-art', undefined, { 'aria-hidden': 'true' });
    const welcomeImage = el('img', '', undefined, { src: 'assets/district-v2/attract-keyart.png', alt: '', draggable: 'false' });
    let attractFallback = false;
    on(welcomeImage, 'error', () => {
      if (attractFallback) return;
      attractFallback = true; welcome.dataset.keyart = 'fallback';
      welcomeImage.setAttribute('src', 'assets/district.png');
    });
    on(welcomeImage, 'load', () => { welcome.dataset.keyart = attractFallback ? 'fallback' : 'new'; });
    add(welcomeArt, welcomeImage);
    const worldHost = el('div', 'dw-attract-world-host', undefined, { 'aria-hidden': 'true' });
    welcomeArt.append(worldHost);
    worldHost.getDistrictWorldDiagnostics = () => attractWorld?.getDiagnostics?.() || { ready: false, phase: state.destroyed ? 'destroyed' : 'unavailable' };
    on(worldHost, 'district-world-state', () => readWorldDiagnostics(), true);
    const welcomeWorker = add(el('figure', 'dw-attract-worker', undefined, { 'aria-label': 'Engineer character, idle. No agent is running.' }), el('img', '', undefined, { src: 'assets/district-v2/worker-engineer.png', alt: '', draggable: 'false' }), el('figcaption', '', 'Waiting for you'));
    const wordmark = el('h1', 'dw-attract-wordmark', 'AGENT BUS');
    const welcomeCopy = add(el('div', 'dw-welcome-copy'), wordmark);
    const firstProject = button('Press Start', () => {
      const draft = conversation?.getDraft?.();
      void startFirstApp({ instruction: typeof draft === 'string' ? draft : '' });
    }, 'dv-button dw-first-project');
    firstProject.id = 'district-first-project';
    firstProject.setAttribute('data-testid', 'district-first-project');
    const entryStatus = el('p', 'dw-entry-status', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const entryError = add(el('details', 'dw-entry-error'), el('summary', '', 'Details'));
    const entryErrorText = el('p'); entryError.append(entryErrorText); entryError.hidden = true;
    const entryRecover = button('Open my project', () => {
      if (!projectById(state.entryProjectId) || state.entryPending) return;
      state.entryActive = false; initialFacilities.set(state.entryProjectId, 'test'); selectCreated(state.entryProjectId); renderLayout();
    }, 'dv-button dw-entry-recover'); entryRecover.hidden = true;
    add(welcomeCopy, firstProject, entryStatus, entryError, entryRecover);
    add(welcome, welcomeArt, welcomeWorker, welcomeCopy);
    const playOutput = el('div', 'dw-play-output', undefined, { 'aria-label': 'Your real playable app' }); playOutput.hidden = true;
    playOutput.id = `${instance}-output`;
    const closeOutput = button('Back to the world', () => {
      state.entryOutputOpen = false; renderLayout(); openOutput.focus();
    }, 'dv-button dw-close-output');
    const outputControls = add(el('div', 'dw-output-controls'), closeOutput);
    const outputContent = el('div', 'dw-output-content');
    add(playOutput, outputControls, outputContent);
    const conversationHost = el('div', 'dw-conversation-host');
    const playTools = el('div', 'dw-play-tools'); playTools.hidden = true;
    const playState = el('p', 'dw-play-state', '', { role: 'status', 'aria-live': 'polite' });
    const stopPlay = button('Stop', () => {
      continuation?.stop();
      const run = activeEntryRun();
      if (run) void entryCommand('cancel_run', state.entryProjectId, { runId: run.id }).catch((error) => conversation?.setStatus(errorText(error)));
    }, 'dv-button dw-play-stop'); stopPlay.hidden = true;
    const openOutput = button('Try your creation', () => {
      state.entryOutputOpen = true; renderLayout(); closeOutput.focus();
    }, 'dv-button dw-open-output');
    openOutput.setAttribute('aria-controls', playOutput.id);
    openOutput.setAttribute('aria-expanded', 'false');
    const yourDistrict = button('Your district', () => {
      if (state.entryPending) return;
      state.entryEngaged = false; state.entryActive = false; state.entryLeaving = false;
      playFeedback?.destroy(); playFeedback = null;
      initialFacilities.set(state.entryProjectId, 'preview'); selectCreated(state.entryProjectId); renderLayout();
    }, 'dv-button dw-your-district');
    add(playTools, playState, stopPlay, openOutput, yourDistrict);
    add(welcome, playOutput, conversationHost, playTools);
    if (api.tests && typeof window.DistrictMapInteraction?.mount === 'function') {
      mapInteraction = window.DistrictMapInteraction.mount({container:welcome,getWorld:()=>attractWorld,api:api.tests,
        onMessage:message=>conversation?.setStatus(message),
        onJob(job,{follow=false,unavailable=false}={}){
          if(state.destroyed)return;
          if(job?.id!==state.mapJob?.id)state.mapJobFollowed=false;
          state.mapJob=job||null;state.mapJobUnavailable=unavailable;
          state.mapJobFollowed=state.mapJobFollowed||follow;
          syncAttractWorld(root.dataset.entry==='true');
        }});
    }
    if (typeof window.DistrictConversation?.mount === 'function') {
      conversation = window.DistrictConversation.mount({ container: conversationHost, voice: api.voice,
        onCommit: ({ text: instruction, source }) => { continuation?.stop(); return startFirstApp({ instruction, source }); },
        onDraftChange: () => continuation?.stop('Auto reply paused while you edit the draft.'),
      });
      if (window.DistrictContinuation?.mount) continuation = window.DistrictContinuation.mount({ container: conversationHost,
        fill: prompt => conversation.setDraft(prompt),
        send: suggestion => startFirstApp({ instruction: suggestion.prompt, worker: suggestion.worker }),
      });
      welcome.dataset.conversation = 'true';
    } else conversationHost.hidden = true;
    welcome.style.setProperty('--dw-input-reserve', '105px');
    root.style.setProperty('--dw-input-reserve', '105px');
    if (typeof window.ResizeObserver === 'function') {
      inputObserver = new window.ResizeObserver(() => {
        if (state.destroyed) return;
        const height = conversationHost.getBoundingClientRect().height;
        if (Number.isFinite(height) && height > 0) {
          const reserve = `${Math.ceil(Math.max(105, height + 24))}px`;
          welcome.style.setProperty('--dw-input-reserve', reserve);
          root.style.setProperty('--dw-input-reserve', reserve);
        }
      });
      inputObserver.observe(conversationHost);
    }
    add(content, overviewReturn, overview, workspaceHint, workspaceHost, welcome);
    add(root, header, projectNav, createForm, attention, notice, content);
    container.append(root);
    if (typeof doc.addEventListener === 'function') on(doc, 'visibilitychange', () => { syncAttractMotion(root.dataset.entry === 'true'); syncAttractWorld(root.dataset.entry === 'true'); syncContinuation(); });
    if (typeof reducedMotion?.addEventListener === 'function') on(reducedMotion, 'change', () => { syncAttractMotion(root.dataset.entry === 'true'); syncAttractWorld(root.dataset.entry === 'true'); });

    function readWorldDiagnostics() {
      clearTimeout(state.worldPollTimer); state.worldPollTimer = null;
      if (!attractWorld || state.destroyed) return;
      let diagnostics;
      try { diagnostics = attractWorld.getDiagnostics(); } catch { diagnostics = { ready: false, error: 'Renderer diagnostics unavailable' }; }
      const ready = diagnostics?.ready === true && !diagnostics.contextLost && !diagnostics.error;
      welcome.dataset.worldReady = String(ready); root.dataset.worldReady = String(ready);
      welcome.dataset.shot = diagnostics?.showcase?.shotId || 'M01';
      root.dataset.phase = diagnostics?.showcase?.phase || 'opening';
      if (!ready && !diagnostics?.error && state.visible && !doc.hidden && state.worldPollCount++ < 120) state.worldPollTimer = setTimeout(readWorldDiagnostics, 250);
    }
    function syncAttractWorld(entry) {
      if (state.destroyed) return;
      if (!entry) {
        clearTimeout(state.worldPollTimer); state.worldPollTimer = null;
        if (attractWorld) { attractWorld.setPaused(true); attractWorld.destroy(); attractWorld = null; }
        welcome.dataset.worldReady = 'false'; root.dataset.worldReady = 'false';
        return;
      }
      if (!attractWorld && !state.visible) return;
      if (!attractWorld && !state.worldMountFailed && typeof window.DistrictAttractWorld?.mount === 'function') {
        try {
          attractWorld = window.DistrictAttractWorld.mount({ container: worldHost, view: 'cinematic', showcase: true });
          state.worldPollCount = 0;
          if (typeof attractWorld.setShowcaseContext !== 'function') attractWorld.setBeat?.('hook');
        } catch { state.worldMountFailed = true; welcome.dataset.worldReady = 'false'; root.dataset.worldReady = 'false'; }
      }
      if (!attractWorld) return;
      const projectId = state.entryProjectId;
      const project = projectById(projectId);
      let run = activeEntryRun() || state.snapshot?.runs.find((item) => item.id === state.entryTaskId && item.projectId === projectId) ||
        newest((state.snapshot?.runs || []).filter((item) => item.projectId === projectId))[0] || null;
      let activity = run ? newest((state.snapshot?.activities || []).filter((item) => item.projectId === projectId && item.runId === run.id))[0] || null : null;
      let unavailable = Boolean(state.readError || (projectId && (!project || project.unavailable)));
      let presentationProject = projectId;
      if(state.mapJob){
        const job=state.mapJob;
        // This is the existing checkout smoke assignment, not a generated app
        // project. Its six signed checks retain their actual checkout identity.
        presentationProject='checkout:'+String(job.root||'unconfirmed');
        run={...job,id:'smoke-'+job.id,projectId:presentationProject,kind:'smoke',worker:job.executor,
          checks:Array.isArray(job.steps)?job.steps:[],total:6,sessionId:job.session_id,root:job.root,building:job.building};
        activity=null;unavailable=state.mapJobUnavailable;
      }
      if (typeof attractWorld.setShowcaseContext === 'function') {
        // The renderer consumes the same live identity through intro, work and output.
        // It owns historical-result suppression; presentation receives no command API.
        const follow = state.mapJob ? state.mapJobFollowed : Boolean(run && (followedRuns.has(run.id) || followedCommands.has(run.commandId)));
        attractWorld.setShowcaseContext({ projectId:presentationProject, run, activity: unavailable ? null : activity, unavailable, follow, outputVisible: state.entryEngaged && state.entryOutputOpen });
      } else {
        attractWorld.setEngaged?.(Boolean(state.entryEngaged));
        attractWorld.setActivity?.(unavailable ? { state: 'unknown', label: 'Status unavailable · last refresh failed' }
          : run ? { state: String(run.state || run.status || 'unknown'), label: 'Observed run state · ' + (run.worker || 'Local') + ' · ' + String(run.state || run.status || 'unknown') }
            : { state: 'idle', label: 'Waiting for you' });
      }
      const workers = unavailable ? [] : window.DistrictWorldState?.project(state.snapshot || {}, projectId) || [];
      // The featured robot presents this run. Additional robots require their
      // own actual session/run; an installed CLI alone is not another worker.
      attractWorld.setWorkers?.(workers.filter((worker) => (worker.runId || worker.sessionId) && worker.runId !== run?.id)
        .map((worker) => ({ ...worker, id: worker.renderId || worker.activityKey || worker.id, workerId: worker.workerId || worker.id })));
      attractWorld.setPaused(Boolean(!state.visible || doc.hidden || reducedMotion?.matches));
      readWorldDiagnostics();
    }

    function syncAttractMotion(entry) {
      const paused = !entry || !state.visible || doc.hidden || reducedMotion?.matches || state.destroyed;
      root.dataset.ambient = paused ? 'paused' : 'idle';
      welcome.dataset.beat = 'hook';
    }

    function setMode(mode) {
      if (state.destroyed || !['overview', 'split'].includes(mode)) return;
      const view = selectionApi.setView?.({ navigation: state.navigation, layout: state.mode }, { layout: mode });
      state.mode = view?.layout || mode;
      if (mode === 'overview') state.galleryExpanded = true;
      savePreferences();
      renderLayout();
      announce(mode === 'split' ? 'Side-by-side workspaces. Each project has its own instructions and controls.' : 'Combined overview. Open any selected project workspace below its status cards.');
    }
    function setNavigation(navigation) {
      if (state.destroyed || !['top', 'side'].includes(navigation)) return;
      const view = selectionApi.setView?.({ navigation: state.navigation, layout: state.mode }, { navigation });
      state.navigation = view?.navigation || navigation;
      savePreferences(); renderNavigation(); renderLayout();
      announce(navigation === 'side' ? 'Project tabs are on the side. Your projects and drafts stay selected.' : 'Project tabs are on top. Your projects and drafts stay selected.');
    }
    function applySelection(next, message) {
      if (state.destroyed) return;
      state.selection = next;
      state.galleryExpanded = next.selectedIds.length > 1;
      if (!chosenIds().includes(state.focusedProject)) state.focusedProject = chosenIds().includes(next.focusedId) ? next.focusedId : chosenIds()[0] || '';
      savePreferences();
      renderNavigation(); renderCards(); renderAttention(); renderLayout();
      if (message) announce(message);
    }
    function selectCreated(projectId) {
      if (state.destroyed) return;
      const ids = projectIds();
      if (!ids.includes(projectId)) return;
      const prior = chosenIds();
      state.selection = selectionApi.create(ids, { selectedIds: prior.concat(projectId), focusedId: projectId, anchorId: projectId });
      state.focusedProject = projectId;
      state.galleryExpanded = false;
      createForm.hidden = true; newButton.setAttribute('aria-expanded', 'false');
      savePreferences(); renderNavigation(); renderCards(); renderLayout();
      announce('Your project is ready. Tell your agent what you want to make.');
    }
    async function entryCommand(type, projectId, payload, extra = {}) {
      const command = { id: commandId(), type, origin: 'gui', ...(projectId ? { projectId } : {}), ...(payload ? { payload } : {}), ...extra };
      if (['run_checks', 'start_task'].includes(type)) followedCommands.add(command.id);
      const receipt = await childCommand(projectId || null, command);
      if (state.destroyed) throw new Error('The window closed.');
      if (!receipt || receipt.status === 'rejected') throw new Error(errorText(receipt?.error || 'The request returned no receipt.'));
      if (receipt.runId && ['run_checks', 'start_task'].includes(type)) followedRuns.add(receipt.runId);
      return receipt;
    }
    function entryPause() {
      return new Promise((resolve) => {
        state.entryWaitResolve = resolve;
        state.entryWaitTimer = setTimeout(() => { state.entryWaitTimer = null; state.entryWaitResolve = null; resolve(); }, 800);
      });
    }
    async function waitForEntryRun(projectId, runId) {
      const deadline = Date.now() + 120000;
      while (!state.destroyed && Date.now() < deadline) {
        await refresh();
        if (state.readError) throw new Error('The current project state could not be confirmed. Try again when the connection returns.');
        const run = state.snapshot?.runs.find((item) => item.id === runId && item.projectId === projectId);
        if (run?.state === 'passed') {
          if (!run.artifact?.candidateHash) throw new Error('The result has no verified output.');
          return run;
        }
        if (run && !ACTIVE.has(String(run.state || run.status || ''))) throw new Error(run.detail || `The attempt ended: ${run.state || run.status}.`);
        await entryPause();
      }
      throw new Error(state.destroyed ? 'The window closed.' : 'Your app is taking longer than expected. Your saved project is kept.');
    }
    function activeEntryRun() {
      return state.snapshot?.runs.find((run) => run.projectId === state.entryProjectId && ACTIVE.has(String(run.state || run.status || ''))) || null;
    }
    async function sendPlayInstruction(instruction, selection, requestedWorker) {
      if (state.readError) throw new Error('The current project state is unavailable. Your words are kept; retry after the connection returns.');
      if (activeEntryRun()) throw new Error('Your crew is still working. You can keep writing, or stop that run before sending another idea.');
      const providers = state.snapshot?.providers || [];
      const worker = requestedWorker ? providers.find(item => item.id === requestedWorker && item.available === true) :
        providers.find((item) => item.id === 'codex' && item.available === true) || providers.find((item) => item.id === 'claude' && item.available === true);
      if (!worker) throw new Error('No agent is available here yet. Your app is open and your words are kept.');
      const requestKey = JSON.stringify({ projectId: state.entryProjectId, worker: worker.id, instruction, selection: selection || null });
      if (state.entryTaskRequest?.key !== requestKey) state.entryTaskRequest = { key: requestKey, id: commandId() };
      const receipt = await entryCommand('start_task', state.entryProjectId, selection ? { selection } : undefined, { id: state.entryTaskRequest.id, worker: worker.id, instruction });
      state.entryTaskId = receipt.runId || '';
      state.entryTaskRequest = null;
      conversation?.setStatus(`${worker.name || worker.id} has your idea. Follow the recorded activity above.`);
      return receipt;
    }
    async function startFirstApp({ instruction = '', selection = null, worker } = {}) {
      if (state.destroyed || state.entryPending) return;
      if(mapInteraction?.hasActive()){
        const error='Your robot is working at Test. Wait for its result or stop that assignment first.';
        conversation?.setStatus(error);return{status:'rejected',error};
      }
      if(state.mapJob)mapInteraction?.clearFocus();
      instruction = typeof instruction === 'string' ? instruction : '';
      if (!state.loaded) {
        state.entryPending = true; conversation?.setPending?.(true);
        conversation?.setStatus('Reading the real project state. You can keep drafting.');
        renderLayout();
        try { await refresh(); }
        finally { if (!state.destroyed) { state.entryPending = false; conversation?.setPending?.(false); } }
        if (state.destroyed) return;
        if (!state.loaded || state.readError) return { status: 'rejected', error: 'The project state is unavailable. Your words are kept; try again when the connection returns.' };
      }
      if (state.entryEngaged) {
        if (!instruction.trim()) return;
        state.entryPending = true; conversation?.setPending?.(true);
        try { return await sendPlayInstruction(instruction, selection || (worker ? null : playFeedback?.selection) || null, worker); }
        catch (error) { conversation?.setStatus(errorText(error)); return { status: 'rejected', error: errorText(error) }; }
        finally { if (!state.destroyed) { state.entryPending = false; conversation?.setPending?.(false); renderLayout(); } }
      }
      if (!state.entryActive && state.snapshot?.projects.length) return { status: 'rejected', error: 'Open the intended project before sending this instruction. Your words are kept.' };
      state.entryInstruction = instruction;
      state.entryPending = true; state.entryActive = true;
      firstProject.disabled = true; firstProject.textContent = 'Starting…';
      entryError.hidden = true; entryRecover.hidden = true;
      text(entryStatus, 'Preparing your starter app…'); renderLayout();
      try {
        if (!state.entryProjectId) {
          state.entryCreateId ||= commandId();
          const created = await entryCommand('create_project', null, { name: 'My first creation', starterId: 'checklist' }, { id: state.entryCreateId });
          if (!created.projectId) throw new Error('Your new app returned no project identity.');
          state.entryProjectId = created.projectId;
        }
        await refresh();
        if (state.readError) throw new Error('The current project state could not be confirmed. Try again when the connection returns.');
        if (!projectById(state.entryProjectId)) throw new Error('Your saved app is not visible yet. Try again when the connection returns.');
        text(entryStatus, 'Checking your saved app…');
        const prior = state.snapshot.runs.find((item) => item.id === state.entryRunId && item.projectId === state.entryProjectId);
        if (prior && ((!ACTIVE.has(prior.state) && prior.state !== 'passed') ||
          (prior.state === 'passed' && prior.artifact?.candidateHash !== projectById(state.entryProjectId)?.manifest?.hash))) {
          state.entryRunId = ''; state.entryCheckId = '';
        }
        if (!state.entryRunId) {
          state.entryCheckId ||= commandId();
          const started = await entryCommand('run_checks', state.entryProjectId, undefined, { id: state.entryCheckId });
          if (!started.runId) throw new Error('The app preparation returned no run identity.');
          state.entryRunId = started.runId;
        }
        const run = await waitForEntryRun(state.entryProjectId, state.entryRunId);
        text(entryStatus, 'Your creation is ready to try.');
        await entryCommand('preview_start', state.entryProjectId, { runId: run.id });
        await refresh();
        if (state.readError) throw new Error('The current app could not be confirmed. Your saved project is kept. Try again when the connection returns.');
        const preview = state.snapshot?.previews.find((item) => item.projectId === state.entryProjectId && item.runId === run.id && item.candidateHash === run.artifact.candidateHash);
        if (!preview || preview.projectId !== state.entryProjectId || preview.runId !== run.id || preview.candidateHash !== run.artifact.candidateHash || preview.stale === true || !preview.url || !preview.nonce) throw new Error('The opened app could not be tied to this result. Your project is kept.');
        let previewUrl;
        try { previewUrl = new URL(preview.url); } catch { throw new Error('Your app returned an invalid preview address.'); }
        if (previewUrl.protocol !== 'http:' || previewUrl.hostname !== '127.0.0.1' || !previewUrl.port || previewUrl.username || previewUrl.password) throw new Error('Your app preview is not on the owned local server.');
        const manifestHash = projectById(state.entryProjectId)?.manifest?.hash;
        if (!manifestHash || manifestHash !== preview.candidateHash) throw new Error('Your project changed while opening. Try again to open the current version.');
        initialFacilities.set(state.entryProjectId, 'preview');
        state.entryEngaged = true; state.entryActive = false; state.entryLeaving = true;
        selectCreated(state.entryProjectId);
        if (instruction.trim()) {
          try { await sendPlayInstruction(instruction, selection); }
          catch (error) { conversation?.setStatus(errorText(error)); text(entryStatus, errorText(error)); }
        } else conversation?.setStatus('Your creation is ready. Try it, or tell me what to change.');
        state.entryPending = false;
        renderLayout();
        state.entryTransitionTimer = setTimeout(() => {
          state.entryTransitionTimer = null;
          if (!state.destroyed) { state.entryLeaving = false; renderLayout(); }
        }, reducedMotion?.matches ? 0 : 900);
      } catch (error) {
        if (!state.destroyed) {
          text(entryStatus, "Couldn't open your app yet. Press Start to try again.");
          text(entryErrorText, errorText(error)); entryError.hidden = false;
          entryRecover.hidden = !projectById(state.entryProjectId);
        }
      } finally {
        if (!state.destroyed) { state.entryPending = false; firstProject.disabled = false; firstProject.textContent = 'Press Start'; renderLayout(); }
      }
    }
    async function createProject() {
      if (state.createPending || state.destroyed) return;
      const name = projectName.value.trim();
      if (!name) { announce('Name the project before creating it.', 'warning'); projectName.focus(); return; }
      state.createPending = true; createButton.disabled = true; createButton.textContent = 'Creating…';
      try {
        const receipt = await childCommand(null, { id: commandId(), type: 'create_project', origin: 'gui', payload: { name } });
        if (state.destroyed) return;
        if (!receipt || receipt.status === 'rejected') { announce(`Project was not created: ${errorText(receipt?.error || 'No receipt was returned.')}`, 'error'); return; }
        if (receipt.projectId) selectCreated(receipt.projectId);
        projectName.value = '';
      } finally {
        if (!state.destroyed) { state.createPending = false; createButton.disabled = false; createButton.textContent = 'Create project'; }
      }
    }
    function openWorkspace(projectId, focus = true) {
      if (!chosenIds().includes(projectId)) return;
      state.focusedProject = projectId;
      state.galleryExpanded = false;
      state.selection = selectionApi.focus(state.selection, projectId, projectIds());
      savePreferences(); renderNavigation(); renderLayout();
      const pane = panes.get(projectId);
      if (focus && pane) {
        pane.heading.focus({ preventScroll: true });
        pane.root.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    }
    function paneFor(project) {
      let pane = panes.get(project.id);
      if (pane) return pane;
      const id = `${instance}-pane-${++state.paneNumber}`;
      const paneRoot = el('section', 'dw-pane', undefined, { id, role: 'tabpanel', 'aria-labelledby': `${id}-title` });
      paneRoot.hidden = true;
      const paneHeader = el('header', 'dw-pane-header');
      const paneHeading = el('h2', '', project.name || project.id, { id: `${id}-title`, tabindex: '-1' });
      const paneSelection = el('span', 'dw-pane-selection', 'Independent workspace');
      add(paneHeader, paneHeading, paneSelection);
      const uiHost = el('div', 'dw-ui-host');
      add(paneRoot, paneHeader, uiHost); workspaceHost.append(paneRoot);
      pane = { root: paneRoot, heading: paneHeading, summary: paneSelection, host: uiHost, ui: null };
      panes.set(project.id, pane);
      return pane;
    }
    function mountPane(projectId) {
      if (state.destroyed) return null;
      const project = projectById(projectId);
      if (!project) return null;
      const pane = paneFor(project);
      if (!pane.ui) {
        pane.ui = window.DistrictUI.mount({
          container: pane.host, api: childApi(projectId), initialProjectId: projectId,
          initialInstruction: initialInstructions.get(projectId) || '',
          initialFacility: initialFacilities.get(projectId) || 'research', hideProjectChooser: true, pollIntervalMs: 60000,
          onSelectionChange: (selection) => {
            if (state.destroyed) return;
            const names = selection?.facilities || (selection?.facility ? [selection.facility] : []);
            text(pane.summary, names.length ? `Open areas: ${names.join(' · ')}` : 'Independent workspace');
          },
        });
        initialInstructions.delete(projectId);
        initialFacilities.delete(projectId);
      }
      return pane;
    }

    function renderNavigation() {
      const projects = state.snapshot?.projects || [];
      const ids = projectIds();
      projects.forEach((project, index) => {
        const pane = paneFor(project);
        text(pane.heading, project.name || project.id);
        let entry = tabs.get(project.id);
        if (!entry) {
          const group = el('div', 'dw-project-tab-group', undefined, { role: 'presentation' });
          const tab = el('button', 'dw-project-tab', undefined, { type: 'button', role: 'tab', 'aria-controls': pane.root.id });
          const name = el('span', 'dw-project-tab-name');
          const status = el('span', 'dw-project-tab-status');
          add(tab, name, status);
          const toggle = el('button', 'dw-project-toggle', '+', { type: 'button' });
          add(group, tab, toggle);
          on(tab, 'click', (event) => {
            const next = selectionApi.click(state.selection, project.id, projectIds(), event);
            state.focusedProject = next.selectedIds.includes(project.id) ? project.id : next.selectedIds[0] || '';
            applySelection(next);
          });
          on(tab, 'keydown', (event) => {
            const order = projectIds();
            const position = order.indexOf(project.id);
            let target = position;
            if (event.key === 'ArrowRight' || (state.navigation === 'side' && event.key === 'ArrowDown')) target = (position + 1) % order.length;
            else if (event.key === 'ArrowLeft' || (state.navigation === 'side' && event.key === 'ArrowUp')) target = (position - 1 + order.length) % order.length;
            else if (event.key === 'Home') target = 0;
            else if (event.key === 'End') target = order.length - 1;
            else return;
            event.preventDefault();
            const id = order[target];
            if (event.shiftKey) applySelection(selectionApi.click(state.selection, id, order, event));
            else { state.selection = selectionApi.focus(state.selection, id, order); renderNavigation(); savePreferences(); }
            tabs.get(id)?.tab.focus({ preventScroll: true });
            tabs.get(id)?.root.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
          });
          on(toggle, 'click', () => {
            const old = chosenIds();
            const next = selectionApi.toggle(state.selection, project.id, projectIds());
            applySelection(next, old.length === 1 && old[0] === project.id ? 'Keep at least one project selected. Add another project before removing this one.' : `${next.selectedIds.length} projects selected. Selection does not start work.`);
          });
          entry = { root: group, tab, name, status, toggle }; tabs.set(project.id, entry);
        }
        const selected = chosenIds().includes(project.id);
        const run = newest(state.snapshot.runs.filter((item) => item.projectId === project.id))[0];
        text(entry.name, project.name || project.id);
        text(entry.status, run ? String(run.state || run.status || 'unknown').replaceAll('_', ' ') : 'Starter files');
        entry.tab.setAttribute('aria-selected', String(selected));
        entry.tab.tabIndex = state.selection?.focusedId === project.id ? 0 : -1;
        entry.root.dataset.selected = String(selected);
        entry.toggle.setAttribute('aria-pressed', String(selected));
        entry.toggle.setAttribute('aria-label', `${selected ? 'Remove' : 'Include'} ${project.name || project.id} ${selected ? 'from' : 'in'} selected workspaces`);
        text(entry.toggle, selected ? '✓' : '+');
        if (tablist.children[index] !== entry.root) tablist.insertBefore(entry.root, tablist.children[index] || null);
      });
      for (const [id, entry] of tabs) if (!ids.includes(id)) { entry.root.remove(); tabs.delete(id); }
      text(selectedCount, `${chosenIds().length} of ${projects.length} selected`);
      projectNav.hidden = !projects.length;
    }

    function renderCards() {
      const selected = chosenIds();
      selected.forEach((projectId, index) => {
        const project = projectById(projectId);
        if (!project) return;
        let card = cards.get(projectId);
        if (!card) {
          const cardRoot = el('article', 'dw-project-card');
          const art = add(el('div', 'dw-card-art', undefined, { 'aria-hidden': 'true' }), el('img', '', undefined, { src: 'assets/district.png', alt: '', draggable: 'false', loading: 'lazy' }), el('span', 'dw-card-art-label', 'YOUR PROJECT DISTRICT'));
          const body = el('div', 'dw-card-body');
          const heading = el('h3');
          const status = el('p', 'dw-card-state');
          const detail = el('p', 'dw-card-detail');
          const checks = el('p', 'dw-card-checks');
          const preview = el('p', 'dw-card-preview');
          const activities = el('ul', 'dw-card-activities', undefined, { 'aria-label': 'Recent recorded activity' });
          const open = button('Enter project', () => openWorkspace(projectId), 'dv-button dw-open-workspace');
          const evidence = el('details', 'dw-card-evidence');
          add(evidence, el('summary', '', 'Files, run identity & details'));
          const evidenceList = el('dl');
          const values = {};
          for (const [key, label] of [['root', 'Project files'], ['runId', 'Latest run'], ['worker', 'Assigned worker'], ['candidateHash', 'Preview candidate']]) {
            add(evidenceList, el('dt', '', label)); values[key] = el('dd'); evidenceList.append(values[key]);
          }
          const runDetail = el('p');
          add(evidence, detail, checks, preview, evidenceList, runDetail);
          add(body, heading, status, activities, open, evidence);
          add(cardRoot, art, body);
          card = { root: cardRoot, heading, status, detail, checks, preview, activities, open, values, runDetail, activityKey: '' }; cards.set(projectId, card);
        }
        const runs = newest(state.snapshot.runs.filter((run) => run.projectId === projectId));
        const latest = runs[0];
        const actualChecks = latest?.checks || [];
        const preview = newest(state.snapshot.previews.filter((item) => item.projectId === projectId))[0];
        const activities = newest(state.snapshot.activities.filter((item) => item.projectId === projectId)).slice(0, 1);
        text(card.heading, project.name || project.id);
        const recordedState = String(latest?.state || latest?.status || 'idle');
        const friendlyStates = {
          queued: 'Request accepted · waiting to start', starting: 'Starting your agent',
          working: 'Agent working · activity recorded', running: 'Work is running',
          building: 'Building the saved files', testing: 'Checking this candidate',
          passed: 'Checks passed · try the result', failed: 'Needs attention · inspect the result',
          cancelled: 'Stopped · inspect the saved work', interrupted: 'Interrupted · check before continuing',
          stopping: 'Stopping · waiting for confirmation', termination_unknown: 'Stop status unconfirmed',
        };
        const worker = latest?.worker || latest?.provider;
        const workerLabel = worker === 'codex' ? 'Codex' : worker === 'claude' ? 'Claude' : worker === 'local' ? 'Local checks' : worker ? String(worker).slice(0, 120) : '';
        text(card.status, project.unavailable ? 'Project files need attention' : latest ? `${workerLabel ? `${workerLabel} · ` : ''}${friendlyStates[recordedState] || `Recorded state: ${recordedState.replaceAll('_', ' ')}`}` : 'Ready for your first instruction');
        card.status.title = card.status.textContent;
        card.status.dataset.state = project.unavailable ? 'error' : String(latest?.state || latest?.status || 'idle');
        text(card.detail, project.unavailable ? 'Open the workspace to inspect the file error before continuing.' : !latest ? 'A working checklist starter is waiting. Give it one change you would like to see.' : recordedState === 'passed' ? 'Try the built candidate, then describe one useful improvement.' : ['failed', 'cancelled', 'interrupted', 'termination_unknown'].includes(recordedState) ? 'Your project stays inspectable. Open it to understand what happened and choose the next step.' : 'Open the project to follow the recorded work and shape what happens next.');
        text(card.checks, actualChecks.length ? `Recipe checks: ${actualChecks.filter((check) => check.state === 'passed').length} passed / ${actualChecks.length} recorded` : 'No recipe check results recorded for the latest run.');
        card.checks.hidden = !actualChecks.length;
        text(card.preview, preview ? preview.stale === true ? 'Preview needs refreshing · it shows an older candidate' : preview.stale === false ? 'Actual candidate preview is open' : 'Preview open · freshness is unknown' : 'Open a real preview after the project checks.');
        card.preview.hidden = !preview;
        text(card.open, latest ? 'Continue project →' : 'Enter project →');
        card.open.setAttribute('aria-label', `${latest ? 'Continue' : 'Enter'} ${project.name || project.id} project workspace`);
        text(card.values.root, project.root || 'Path not recorded');
        text(card.values.runId, latest?.id || 'No run recorded');
        text(card.values.worker, latest?.worker || latest?.provider || 'No worker assigned');
        text(card.values.candidateHash, preview?.candidateHash || 'No preview candidate open');
        text(card.runDetail, project.unavailable ? project.error || 'The project files could not be read.' : latest?.detail || 'The starter is real local source. No agent run or check result has been recorded yet.');
        card.root.dataset.trim = String(Array.from(project.id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4);
        const activityKey = JSON.stringify(activities.map((item) => [item.id, item.phase, item.message, item.basis, item.status, item.freshness]));
        if (activityKey !== card.activityKey) {
          card.activityKey = activityKey;
          while (card.activities.firstChild) card.activities.firstChild.remove();
          for (const activity of activities) add(card.activities, el('li', '', `${activity.workerId ? `${String(activity.workerId).slice(0, 80)} · ` : ''}${activity.basis === 'observed' ? 'Observed' : activity.basis === 'reported' ? 'Agent-reported' : activity.basis === 'inferred' ? 'Inferred' : 'Basis unknown'} · ${activity.phase || 'unknown'} · ${String(activity.message || activity.label || 'No detail recorded').slice(0, 350)}${activity.freshness === 'stale' ? ' · stale' : ''}`));
        }
        card.activities.hidden = !activities.length;
        if (cardGrid.children[index] !== card.root) cardGrid.insertBefore(card.root, cardGrid.children[index] || null);
      });
      for (const [id, card] of cards) if (!selected.includes(id)) { card.root.remove(); cards.delete(id); }
    }

    function renderAttention() {
      if (state.destroyed) return;
      const projectAttention = window.DistrictAttention?.projectAttention;
      const entries = state.snapshot && typeof projectAttention === 'function' ? projectAttention(state.snapshot, chosenIds()) : [];
      const keys = new Set();
      entries.forEach((entry, index) => {
        if (!entry || !projectById(entry.projectId)) return;
        if ((state.entryActive || state.entryEngaged) && entry.projectId === state.entryProjectId) return;
        const key = String(entry.key || entry.id || `${entry.projectId}:${entry.runId || entry.kind}`);
        if (keys.has(key)) return;
        keys.add(key);
        let item = attentionItems.get(key);
        if (!item) {
          const itemRoot = el('li', 'dw-attention-item');
          const open = el('button', 'dw-attention-open', undefined, { type: 'button' });
          const detail = el('p', 'dw-attention-detail');
          const meta = el('p', 'dw-attention-meta');
          add(itemRoot, open, detail, meta);
          item = { root: itemRoot, open, detail, meta, entry };
          const handle = () => {
            const projectId = item.entry.projectId;
            if (state.destroyed || state.entryPending || !projectById(projectId)) return;
            state.entryEngaged = false; state.entryActive = false; state.entryLeaving = false;
            playFeedback?.destroy(); playFeedback = null;
            state.focusedProject = projectId;
            applySelection(selectionApi.create(projectIds(), { selectedIds: chosenIds().concat(projectId), focusedId: projectId, anchorId: projectId }));
            openWorkspace(projectId);
          };
          open.addEventListener('click', handle);
          item.cleanup = () => open.removeEventListener('click', handle);
          attentionItems.set(key, item);
        }
        item.entry = entry;
        item.root.dataset.kind = String(entry.kind || 'unknown');
        item.root.dataset.state = state.readError ? 'unknown' : String(entry.state || 'unknown');
        item.root.dataset.projectId = entry.projectId;
        item.root.dataset.stale = String(Boolean(state.readError || entry.stale));
        item.root.dataset.historical = String(Boolean(entry.historical));
        text(item.open, `${entry.projectName || projectById(entry.projectId)?.name || entry.projectId} · ${state.readError ? 'Last recorded: ' : ''}${entry.label || entry.state || 'Status unknown'}`);
        text(item.detail, entry.detail || ''); item.detail.hidden = !entry.detail;
        text(item.meta, [state.readError ? 'Current status unavailable' : String(entry.state || 'unknown').replaceAll('_', ' '), entry.basis ? `${entry.basis} evidence` : 'Basis unknown', entry.historical ? 'Historical result' : '', entry.stale ? 'Stale' : '', entry.runId ? `Run ${entry.runId}` : ''].filter(Boolean).join(' · '));
        if (attentionList.children[index] !== item.root) attentionList.insertBefore(item.root, attentionList.children[index] || null);
      });
      for (const [key, item] of attentionItems) if (!keys.has(key)) { item.cleanup(); item.root.remove(); attentionItems.delete(key); }
      attention.hidden = !keys.size;
      text(attentionStatus, state.readError ? 'Connection lost · Earlier signals' : state.entryActive || state.entryEngaged ? 'Elsewhere in your district' : 'Recorded signals across every project. Opening one changes the view only.');
    }

    function renderLayout() {
      if (state.destroyed) return;
      const ids = chosenIds();
      const hasProjects = Boolean(state.snapshot?.projects.length);
      const entry = !hasProjects || state.entryActive || state.entryEngaged;
      const gallery = !entry && state.mode === 'overview' && state.galleryExpanded;
      root.dataset.mode = state.mode;
      root.dataset.nav = state.navigation;
      tablist.setAttribute('aria-orientation', state.navigation === 'side' ? 'vertical' : 'horizontal');
      navigationTop.setAttribute('aria-pressed', String(state.navigation === 'top'));
      navigationSide.setAttribute('aria-pressed', String(state.navigation === 'side'));
      root.dataset.empty = String(!hasProjects);
      root.dataset.entry = String(entry || state.entryLeaving);
      root.dataset.transition = state.entryLeaving ? 'leaving' : '';
      welcome.dataset.engaged = String(state.entryEngaged);
      root.dataset.gallery = gallery ? 'expanded' : 'collapsed';
      content.dataset.count = String(ids.length);
      overviewButton.setAttribute('aria-pressed', String(state.mode === 'overview'));
      splitButton.setAttribute('aria-pressed', String(state.mode === 'split'));
      overview.hidden = !gallery || !hasProjects;
      header.hidden = entry || state.entryLeaving;
      projectNav.hidden = entry || state.entryLeaving || !hasProjects;
      createForm.hidden = entry || createForm.hidden;
      overviewReturn.hidden = entry || state.mode !== 'overview' || gallery || ids.length < 2;
      text(overviewSummary, `${projectById(state.focusedProject)?.name || 'Project workspace'} · ${ids.length} projects selected`);
      workspaceHost.hidden = entry || gallery;
      workspaceHint.hidden = true;
      welcome.hidden = !entry && !state.entryLeaving;
      syncAttractMotion(entry || state.entryLeaving);
      syncAttractWorld(entry || state.entryLeaving);
      mapInteraction?.setVisible(Boolean((entry || state.entryLeaving) && state.visible));
      playOutput.hidden = !state.entryEngaged || !state.entryOutputOpen;
      welcome.dataset.outputOpen = String(state.entryEngaged && state.entryOutputOpen);
      openOutput.setAttribute('aria-expanded', String(state.entryOutputOpen));
      playTools.hidden = !(state.entryActive || state.entryEngaged);
      openOutput.hidden = !state.entryEngaged;
      yourDistrict.disabled = state.entryPending;
      conversation?.setDisabled(!entry);
      conversation?.setPending?.(state.entryPending);
      syncContinuation(entry);
      for (const item of attentionItems.values()) item.open.disabled = state.entryPending;
      if (state.entryEngaged) {
        const preview = newest(state.snapshot.previews.filter((item) => item.projectId === state.entryProjectId))[0] || null;
        if (!playFeedback && typeof window.DistrictFeedback === 'function') playFeedback = new window.DistrictFeedback({ container: outputContent, onRequestChange: ({ instruction: value, selection: selected }) => startFirstApp({ instruction: value, selection: selected }) });
        playFeedback?.update({ preview, stale: preview?.stale === true, instructionDisabled: state.entryPending || Boolean(activeEntryRun()) });
      }
      if (state.entryActive || state.entryEngaged) {
        const run = activeEntryRun() || state.snapshot.runs.find((item) => item.id === (state.entryTaskId || state.entryRunId));
        const count = (run?.checks || []).filter(check => check.state === 'passed').length;
        const total = run?.checkPlan?.length || run?.checks?.length || 0;
        const checking = run?.checks?.find(check => check.state === 'running');
        text(playState, run?.state === 'passed' ? `${count}/${total} source checks passed · Ready to try` : checking ? `${count}/${total} source checks · ${checking.name}` : run ? `${run.worker === 'local' ? 'Local checks' : run.worker} · ${String(run.state || 'unknown').replaceAll('_', ' ')}${run.detail ? ` · ${String(run.detail).slice(0, 220)}` : ''}` : 'Preparing your creation');
        stopPlay.hidden = !activeEntryRun();
        if (run && !ACTIVE.has(String(run.state || run.status || '')) && state.entryTaskId === run.id && ['failed', 'cancelled', 'interrupted', 'termination_unknown'].includes(run.state)) conversation?.setStatus(run.detail || `The run ${run.state}. Your words are kept.`);
      }
      firstProject.disabled = state.entryPending;
      firstProject.hidden = state.entryEngaged;
      const visible = entry || gallery ? [] : state.mode === 'split' ? ids : ids.includes(state.focusedProject) ? [state.focusedProject] : ids.slice(0, 1);
      text(workspaceHint, state.mode === 'split' ? `${ids.length} independent workspace${ids.length === 1 ? '' : 's'}. Each instruction targets its own project. Scroll sideways to reach every selected workspace.` : 'Focused workspace · choose Open full workspace on another card to switch. Drafts and selected areas are kept.');
      for (const id of visible) mountPane(id);
      for (const [id, pane] of panes) pane.root.hidden = !visible.includes(id);
    }

    function normalizeSnapshot(value) {
      if (!value || typeof value !== 'object') throw new Error('The district returned no snapshot.');
      const next = { ...value };
      for (const key of ARRAYS) next[key] = Array.isArray(value[key]) ? value[key] : [];
      const seen = new Set();
      next.projects = next.projects.filter((project) => project && typeof project.id === 'string' && project.id && !seen.has(project.id) && seen.add(project.id));
      return next;
    }
    function syncContinuation(entry = root.dataset.entry === 'true') {
      if (!continuation) return;
      const run = newest((state.snapshot?.runs || []).filter(item => item.projectId === state.entryProjectId && item.instruction && item.worker !== 'local'))[0] || null;
      const available = (state.snapshot?.providers || []).some(item => item.id === run?.worker && item.available === true);
      const context = { projectId: state.entryProjectId, run, worker: run?.worker, available,
        enabled: Boolean(entry && state.visible && !doc.hidden && state.entryEngaged && !state.readError && !state.mapJob && !mapInteraction?.hasActive()),
        busy: state.entryPending || Boolean(activeEntryRun()), currentHash: projectById(state.entryProjectId)?.manifest?.hash,
        draft: conversation?.getDraft() || '' };
      continuation.update(context);
      conversation?.setSuggestion(continuation.getSuggestion()?.prompt || '');
    }
    function schedule() {
      if (state.destroyed) return;
      clearTimeout(state.timer);
      const busy = state.snapshot?.runs.some((run) => ACTIVE.has(String(run.state || run.status || '')));
      state.timer = setTimeout(() => { void refresh(); }, busy ? 1000 : 2500);
    }
    function refresh() {
      if (state.destroyed) return Promise.resolve(state.snapshot);
      if (state.inFlight) return state.inFlight;
      clearTimeout(state.timer);
      const pending = (async () => {
        try {
          const next = normalizeSnapshot(await Promise.resolve().then(() => api.snapshot()));
          if (state.destroyed) return state.snapshot;
          state.snapshot = next;
          const ids = projectIds();
          state.selection = state.selection ? selectionApi.reconcile(state.selection, ids) : selectionApi.deserialize(persistedSelection, ids);
          if (!state.loaded) state.galleryExpanded = chosenIds().length > 1;
          if (!chosenIds().includes(state.focusedProject)) state.focusedProject = chosenIds().includes(state.selection.focusedId) ? state.selection.focusedId : chosenIds()[0] || '';
          const wasError = state.readError;
          state.readError = ''; state.loaded = true;
          for (const [id, pane] of panes) if (!ids.includes(id)) { pane.ui?.destroy(); pane.root.remove(); panes.delete(id); }
          renderNavigation(); renderCards(); renderAttention(); renderLayout(); savePreferences();
          await Promise.allSettled([...panes.values()].filter((pane) => pane.ui).map((pane) => pane.ui.refresh()));
          if (state.destroyed) return state.snapshot;
          if (wasError || notice.textContent === 'Reading the real projects and run states…') announce(ids.length ? 'Choose a project and tell your agent what you want to make.' : 'What do you want to make? Type your idea below.');
          return next;
        } catch (error) {
          if (!state.destroyed) { state.readError = errorText(error); continuation?.stop('Auto reply paused: project state is unavailable.'); announce(`Could not refresh project states: ${state.readError} Previously displayed results may be older.`, 'error'); renderAttention(); syncAttractWorld(root.dataset.entry === 'true'); }
          return state.snapshot;
        } finally {
          state.inFlight = null;
          schedule();
        }
      })();
      state.inFlight = pending;
      return pending;
    }

    renderLayout();
    void refresh();
    return {
      refresh,
      setVisible(value) {
        if (state.destroyed) return;
        state.visible = value === true;
        syncContinuation();
        mapInteraction?.setVisible(state.visible);
        syncAttractMotion(root.dataset.entry === 'true');
        syncAttractWorld(root.dataset.entry === 'true');
      },
      getDiagnostics: () => worldHost.getDistrictWorldDiagnostics(),
      destroy() {
        if (state.destroyed) return;
        state.destroyed = true; clearTimeout(state.timer);
        inputObserver?.disconnect(); inputObserver = null;
        clearTimeout(state.worldPollTimer); attractWorld?.setPaused(true); attractWorld?.destroy(); attractWorld = null;
        continuation?.destroy(); conversation?.destroy(); playFeedback?.destroy();
        mapInteraction?.destroy();mapInteraction=null;
        clearTimeout(state.entryTransitionTimer);
        clearTimeout(state.entryWaitTimer); state.entryWaitResolve?.();
        for (const pane of panes.values()) pane.ui?.destroy();
        for (const cleanup of listeners) cleanup();
        for (const item of attentionItems.values()) item.cleanup();
        attentionItems.clear();
        followedCommands.clear(); followedRuns.clear();
        panes.clear(); tabs.clear(); cards.clear(); initialInstructions.clear(); initialFacilities.clear(); root.remove();
      },
    };
  }

  window.DistrictWorkbench = Object.freeze({ mount });
})();
