(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DistrictMapInteraction = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  // I01 / W02 / T01. This controller presents one existing robot; it creates no
  // models, camera motion, check results, sessions or assignments by itself.
  const ACTIVE = new Set(['assigned', 'starting_agent', 'agent_working', 'running', 'agent_review', 'stopping', 'termination_unknown']);
  const EXECUTORS = new Set(['@smoke-runner', '@codex-worker', '@claude-worker']);
  const LABELS = { research: 'Research', build: 'Build', test: 'Test', review: 'Review', preview: 'Preview' };
  const clean = (value, length = 1600) => String(value == null ? '' : value).slice(0, length);
  const validPoint = point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
  const idOf = job => Number.isSafeInteger(Number(job?.id)) && Number(job.id) > 0 ? Number(job.id) : null;
  const jobActive = job => Boolean(job && ACTIVE.has(job.state));
  function readyForInteraction(diagnostics) {
    return diagnostics?.ready === true && !diagnostics.disposed && !diagnostics.contextLost && diagnostics.camera?.type === 'orthographic' && diagnostics.showcase?.pullback === 1;
  }
  function normalizeWorkers(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).filter(value => value && EXECUTORS.has(value.id) && !seen.has(value.id) && seen.add(value.id))
      .map(value => ({ id: value.id, name: clean(value.name || value.id, 120), available: value.available === true, detail: clean(value.detail) }));
  }
  function hull(points) {
    const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = values => { const result = []; for (const point of values) { while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop(); result.push(point); } return result; };
    return [...half(sorted).slice(0, -1), ...half(sorted.slice().reverse()).slice(0, -1)];
  }
  function pointInPolygon(point, polygon) {
    if (!point || !Number.isFinite(point.x + point.y) || !Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j], cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
      if (Math.abs(cross) < .001 && point.x >= Math.min(a.x, b.x) - .001 && point.x <= Math.max(a.x, b.x) + .001 && point.y >= Math.min(a.y, b.y) - .001 && point.y <= Math.max(a.y, b.y) + .001) return true;
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function projectBounds(details, projectPoint) {
    if (!validPoint(details?.bounds?.min) || !validPoint(details?.bounds?.max)) return null;
    const { min, max } = details.bounds, points = [];
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const point = projectPoint([x, y, z]); if (!point || !Number.isFinite(point.x + point.y)) return null; points.push(point);
    }
    if (!points.some(point => point.visible !== false)) return null;
    const left = Math.min(...points.map(point => point.x)), top = Math.min(...points.map(point => point.y));
    const width = Math.max(...points.map(point => point.x)) - left, height = Math.max(...points.map(point => point.y)) - top;
    if (!(width > 0 && height > 0)) return null;
    const entrance = validPoint(details.entrance) ? projectPoint(details.entrance) : null;
    return { left, top, width, height, polygon: hull(points), entrance: entrance && Number.isFinite(entrance.x + entrance.y) ? entrance : { x: left + width / 2, y: top + height } };
  }
  function projectRobot(featuredHost, projectPoint) {
    if (!validPoint(featuredHost?.position) || !(Number.isFinite(featuredHost.scale) && featuredHost.scale > 0)) return null;
    const foot = projectPoint(featuredHost.position), head = projectPoint([featuredHost.position[0], featuredHost.position[1] + 3 * featuredHost.scale, featuredHost.position[2]]);
    if (!head || !foot || head.visible === false || foot.visible === false || !Number.isFinite(head.x + head.y + foot.x + foot.y)) return null;
    const height = Math.max(44, Math.abs(head.y - foot.y) + 14), width = Math.max(44, height * .75);
    return { left: (head.x + foot.x - width) / 2, top: (head.y + foot.y - height) / 2, width, height, head, foot };
  }
  function reconcileCandidate(jobs, attempt) {
    if (!attempt?.dispatched || !Array.isArray(jobs)) return null;
    const matches = jobs.filter(job => idOf(job) && !attempt.before.has(idOf(job)) && job.agent === attempt.agent && job.building === 'test' && Number.isFinite(job.created) && job.created >= attempt.startedAt - 1000);
    return matches.length === 1 ? matches[0] : null;
  }
  function mount({ container, getWorld, api, onJob = () => {}, onMessage = () => {} } = {}) {
    if (!container?.ownerDocument || typeof getWorld !== 'function' || !api || ['workers', 'list', 'assign', 'cancel'].some(key => typeof api[key] !== 'function')) throw new TypeError('DistrictMapInteraction requires a container, world getter and real workers/list/assign/cancel API.');
    const doc = container.ownerDocument, view = doc.defaultView || root, listeners = [], facilities = new Map();
    const later = (fn, ms) => view.setTimeout(fn, ms), cancelLater = id => view.clearTimeout(id);
    const state = { destroyed: false, visible: true, ready: false, selectedRobot: false, facility: null, workers: [], jobs: [], worker: '@smoke-runner', jobId: null, job: null,
      submitting: false, uncertain: false, cancelPending: false, attempt: null, readError: '', workerError: '', workersRead: false, workersReadAt: 0, message: '', inFlight: null, timer: null, drag: null, suppressClick: false, followPending: false, delivered: '', generation: 0 };
    function element(tag, className, text, attrs = {}) { const node = doc.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node; }
    function on(target, type, fn) { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); }
    function say(message) { state.message = clean(message, 3000); try { onMessage(state.message); } catch {} render(); }
    const layer = element('div', 'dmi-layer', undefined, { 'aria-label': 'Interactive district map' });
    const robot = element('button', 'dmi-robot', '', { type: 'button', 'aria-label': 'Assign this robot to a building', title: 'Drag the robot to Test, or choose robot then Test', 'aria-pressed': 'false' });
    const dock = element('section', 'dmi-dock', undefined, { 'aria-label': 'Building assignment', tabindex: '-1' }); dock.hidden = true; dock.style.maxWidth = '340px';
    const heading = element('h2', 'dmi-heading', 'Test');
    const close = element('button', 'dmi-close', 'Close', { type: 'button', 'aria-label': 'Close assignment dock' });
    const status = element('p', 'dmi-status', 'Choose the robot, then Test.', { role: 'status', 'aria-live': 'polite' });
    const providerLabel = element('label', 'dmi-provider-label', 'Executor');
    const provider = element('select', 'dmi-provider', undefined, { 'aria-label': 'Test executor' }); providerLabel.append(provider);
    const detail = element('p', 'dmi-provider-detail', '');
    const run = element('button', 'dmi-run', 'Run smoke test', { type: 'button' });
    const cancel = element('button', 'dmi-cancel', 'Cancel run', { type: 'button' }); cancel.hidden = true;
    const scope = element('p', 'dmi-scope', '');
    const checks = element('ul', 'dmi-checks', undefined, { 'aria-label': 'Observed smoke checks' });
    const evidence = element('details', 'dmi-evidence'); evidence.append(element('summary', '', 'Execution evidence'));
    const output = element('pre', 'dmi-output', '', { tabindex: '0' }); evidence.append(output);
    dock.append(heading, close, status, providerLabel, detail, run, cancel, scope, checks, evidence); layer.append(robot, dock); container.append(layer);
    function hasActive() { return state.submitting || state.uncertain || state.cancelPending || state.jobId !== null && !state.job || jobActive(state.job); }
    function finishDrag() {
      const drag = state.drag; state.drag = null; layer.dataset.dragging = 'false'; robot.setAttribute('aria-grabbed', 'false');
      if (drag) { try { if (robot.hasPointerCapture?.(drag.id)) robot.releasePointerCapture(drag.id); } catch {} }
      return drag;
    }
    function clearFocus() {
      finishDrag(); state.selectedRobot = false;
      if (!hasActive()) {
        const hadJob = state.jobId !== null || state.job;
        state.facility = null; state.job = null; state.jobId = null; state.attempt = null; state.delivered = ''; state.followPending = false; state.message = ''; dock.hidden = true;
        if (hadJob) { try { Promise.resolve(onJob(null, { follow: false, unavailable: false })).catch(() => {}); } catch {} }
      }
      render();
    }
    function openFacility(id, focus = true) {
      if (!state.ready || !state.visible || state.destroyed) return;
      if (hasActive() && state.facility === 'test') { if (id !== 'test') say((LABELS[id] || id) + ': Ready for future connections. The current assignment stays in Test.'); return; }
      if (id === 'test' && !state.selectedRobot) { say('Choose the robot first, then Test to prepare an assignment.'); return; }
      state.facility = id; dock.hidden = false; state.message = id === 'test' ? 'Choose an executor. Only Run smoke test starts work.' : 'Ready for future connections'; render(); if (focus && state.visible) dock.focus();
    }
    function updateLayout() {
      if (state.destroyed) return;
      let world, diagnostics, layout;
      try { world = getWorld(); diagnostics = world?.getDiagnostics?.(); layout = world?.getLayout?.(); } catch {}
      state.ready = state.visible && readyForInteraction(diagnostics) && typeof world?.projectPoint === 'function'; layer.dataset.ready = String(state.ready); layer.hidden = !state.visible;
      const project = point => world.projectPoint(point), bounds = state.ready ? projectRobot(layout?.featuredHost, project) : null;
      robot.hidden = !bounds; robot.disabled = !bounds || hasActive();
      if (bounds) Object.assign(robot.style, { left: bounds.left + 'px', top: bounds.top + 'px', width: bounds.width + 'px', height: bounds.height + 'px' });
      const known = new Set(Object.keys(layout?.facilityDetails || {}));
      for (const [id, item] of facilities) if (!known.has(id)) { item.button.hidden = true; item.zone = null; }
      for (const id of known) {
        let item = facilities.get(id);
        if (!item) {
          const button = element('button', 'dmi-facility', undefined, { type: 'button', 'data-facility': id, 'aria-label': (LABELS[id] || id) + (id === 'test' ? ' building: assign smoke test' : ': Ready for future connections') });
          const label = element('span', 'dmi-facility-label', LABELS[id] || id); button.append(label); layer.append(button); item = { button, label, zone: null }; facilities.set(id, item);
          on(button, 'click', event => { if (event.detail > 0 && Number.isFinite(event.clientX + event.clientY) && item.zone && !pointInPolygon(localPoint(event), item.zone.polygon)) return; openFacility(id); });
        }
        item.zone = state.ready ? projectBounds(layout.facilityDetails[id], project) : null; item.button.hidden = !item.zone; item.button.disabled = !item.zone;
        if (item.zone) { const zone = item.zone; Object.assign(item.button.style, { left: zone.left + 'px', top: zone.top + 'px', width: zone.width + 'px', height: zone.height + 'px' }); Object.assign(item.label.style, { left: (zone.entrance.x - zone.left) + 'px', top: (zone.entrance.y - zone.top) + 'px' }); }
      }
    }
    function localPoint(event) { const rect = container.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function hitFacility(point) { return [...facilities].filter(([, item]) => item.zone && pointInPolygon(point, item.zone.polygon)).sort((a, b) => a[1].zone.width * a[1].zone.height - b[1].zone.width * b[1].zone.height)[0]?.[0] || null; }
    function render() {
      if (state.destroyed) return;
      robot.setAttribute('aria-pressed', String(state.selectedRobot)); layer.dataset.selected = String(state.selectedRobot); layer.dataset.active = String(hasActive());
      const isTest = state.facility === 'test'; heading.textContent = LABELS[state.facility] || 'Test';
      providerLabel.hidden = !isTest; detail.hidden = !isTest; run.hidden = !isTest; checks.hidden = !isTest; evidence.hidden = !isTest || !state.job;
      const available = state.workers.find(worker => worker.id === state.worker && worker.available);
      provider.disabled = hasActive(); detail.textContent = available?.detail || (state.workerError || 'No available executor is confirmed. Refresh when a CLI or the local runner is available.');
      run.disabled = !isTest || !state.ready || hasActive() || !available || Boolean(state.readError || state.workerError) || state.jobs.some(jobActive);
      close.disabled = hasActive(); cancel.hidden = !isTest || !jobActive(state.job); cancel.disabled = state.submitting || state.cancelPending || !state.job;
      cancel.textContent = state.cancelPending ? 'Confirming cancellation…' : 'Cancel run';
      status.textContent = state.readError ? 'Status unavailable. ' + state.readError + (state.job ? ' Last recorded: ' + state.job.state + '.' : '') : state.workerError || state.message || (state.job ? clean(state.job.detail) : isTest ? 'Only Run smoke test starts work.' : 'Ready for future connections');
      if (state.uncertain) status.textContent = 'Assignment reply is unconfirmed. Checking saved jobs; no automatic retry will be sent.' + (state.readError ? ' ' + state.readError : '');
      const job = state.job;
      scope.textContent = job ? 'Job #' + job.id + ' · ' + clean(job.executor || job.agent, 160) + ' · ' + clean(job.state, 80) + ' · ' + clean(job.root, 1200) : '';
      checks.textContent = '';
      for (const step of Array.isArray(job?.steps) ? job.steps : []) {
        const row = element('li', 'dmi-check', clean(step.name, 220) + ' · ' + (state.readError ? 'last recorded ' : '') + clean(step.state || 'unknown', 80)); row.dataset.state = state.readError ? 'unknown' : clean(step.state || 'unknown', 80); checks.append(row);
      }
      output.textContent = job ? ['Job #' + job.id, 'Agent: ' + clean(job.agent, 160), 'Executor: ' + clean(job.executor, 160), 'Source root: ' + clean(job.root, 2000), 'State: ' + clean(job.state, 80), 'Detail: ' + clean(job.detail, 4000),
        'Agent detail (reported):\n' + clean(job.agent_detail, 12000), 'Agent output (reported):\n' + clean(job.agent_output, 30000), 'Observed runner output:\n' + clean(job.output, 65000)].join('\n\n') : '';
    }
    function deliver(unavailable = false) {
      if (!state.job || state.destroyed) return;
      const signature = JSON.stringify([state.job, unavailable]); if (signature === state.delivered && !state.followPending) return;
      state.delivered = signature; const follow = state.followPending; state.followPending = false;
      try { Promise.resolve(onJob(state.job, { follow, unavailable })).catch(() => {}); } catch {}
    }
    function adopt(job) {
      if (!job || !idOf(job)) return;
      state.jobId = idOf(job); state.job = job; state.uncertain = false; state.attempt = null; state.facility = 'test'; dock.hidden = false; state.followPending = true; state.delivered = '';
    }
    function schedule() { cancelLater(state.timer); state.timer = null; if (!state.destroyed && state.visible) state.timer = later(() => { state.timer = null; void refresh(); }, 500); }
    function refresh(options = {}) {
      if (state.destroyed) return Promise.resolve(null); updateLayout();
      if (state.inFlight) return state.inFlight;
      const generation = state.generation;
      const task = (async () => {
        const readWorkers = options.workers === true || !state.workersRead || Date.now() - state.workersReadAt >= 5000;
        if (readWorkers) { state.workersRead = true; state.workersReadAt = Date.now(); }
        const [workers, jobs] = await Promise.allSettled([readWorkers ? Promise.resolve().then(() => api.workers()) : Promise.resolve(null), Promise.resolve().then(() => api.list())]);
        if (state.destroyed || generation !== state.generation) return null;
        if (readWorkers && workers.status === 'fulfilled' && Array.isArray(workers.value)) {
          state.workers = normalizeWorkers(workers.value); state.workerError = ''; const previous = state.worker;
          if (!state.workers.some(worker => worker.id === previous && worker.available)) state.worker = state.workers.find(worker => worker.id === '@smoke-runner' && worker.available)?.id || state.workers.find(worker => worker.available)?.id || '';
          provider.textContent = ''; for (const worker of state.workers) { const option = element('option', '', worker.name + (worker.available ? '' : ' — unavailable')); option.value = worker.id; option.disabled = !worker.available; provider.append(option); } provider.value = state.worker;
        } else if (readWorkers) state.workerError = 'Executor availability could not be read: ' + clean(workers.reason?.message || workers.reason || 'Invalid worker response');
        if (jobs.status === 'fulfilled' && Array.isArray(jobs.value)) {
          state.jobs = jobs.value.filter(job => idOf(job)); state.readError = '';
          if (state.attempt?.dispatched && !state.jobId) { const recovered = reconcileCandidate(state.jobs, state.attempt); if (recovered) { adopt(recovered); state.message = 'Recovered the matching saved assignment after its reply was unconfirmed.'; } }
          if (state.jobId) {
            const current = state.jobs.find(job => idOf(job) === state.jobId);
            if (current) { state.job = current; state.message = clean(current.state, 80) + ': ' + clean(current.detail, 3000); if (!jobActive(current)) state.cancelPending = false; deliver(false); }
            else { state.readError = 'The selected assignment is absent from the latest saved-job list.'; deliver(true); }
          }
        } else { state.readError = 'Could not read saved jobs: ' + clean(jobs.reason?.message || jobs.reason || 'Invalid job response'); deliver(true); }
        updateLayout(); render(); return state.job;
      })();
      state.inFlight = task;
      void task.finally(() => { if (state.inFlight === task) state.inFlight = null; schedule(); });
      return task;
    }
    async function commit() {
      if (state.destroyed || !state.visible || !state.ready || state.facility !== 'test' || hasActive() || state.readError || state.workerError || !state.workers.some(worker => worker.id === state.worker && worker.available)) return;
      state.submitting = true; state.message = 'Confirming Test availability…'; render();
      let dispatched = false;
      try {
        const before = await api.list(); if (state.destroyed || !state.visible) return;
        if (!Array.isArray(before)) throw new Error('Saved-job list is invalid; no assignment was sent.');
        state.jobs = before.filter(job => idOf(job));
        if (state.jobs.some(jobActive)) { state.message = 'Test already has active work. Wait for its recorded result.'; return; }
        const attempt = state.attempt = { agent: state.worker, before: new Set(state.jobs.map(idOf)), startedAt: Date.now(), dispatched: true };
        state.job = null; state.jobId = null; dispatched = true; state.message = 'Sending the explicit assignment…'; render();
        const receipt = await api.assign({ agent: attempt.agent, building: 'test' }); if (state.destroyed) return;
        const id = idOf(receipt);
        if (!id || attempt.before.has(id) || state.jobId && state.jobId !== id) throw new Error('Assignment returned an invalid or conflicting saved job identity.');
        state.jobId = id; state.followPending = true; state.uncertain = false; state.attempt = null; state.message = 'Assignment accepted. Waiting for its actual saved state.';
        await refresh();
      } catch (error) {
        if (!state.destroyed) { state.message = clean(error?.message || error); if (dispatched) state.uncertain = !state.job; else { state.readError = state.message; state.attempt = null; } }
      } finally {
        if (!state.destroyed) { state.submitting = false; updateLayout(); render(); if (dispatched) void refresh(); }
      }
    }
    async function cancelRun() {
      if (state.destroyed || state.cancelPending || state.submitting || !jobActive(state.job)) return;
      state.cancelPending = true; state.message = 'Cancellation requested; awaiting actual saved state.'; render();
      try { await api.cancel(state.job.id); if (!state.destroyed) await refresh(); }
      catch (error) { if (!state.destroyed) { state.message = 'Cancel reply unconfirmed: ' + clean(error?.message || error) + '. Checking the saved assignment.'; void refresh(); } }
      finally { if (!state.destroyed) render(); }
    }
    on(provider, 'change', () => { if (!hasActive()) { state.worker = provider.value; render(); } });
    on(run, 'click', () => { void commit(); }); on(cancel, 'click', () => { void cancelRun(); }); on(close, 'click', () => { if (!hasActive()) clearFocus(); });
    on(robot, 'click', event => { if (state.suppressClick && event.detail > 0) { state.suppressClick = false; return; } state.suppressClick = false; if (!state.ready || hasActive()) return; state.selectedRobot = true; say('Robot selected. Choose Test, or drag it to the Test building.'); });
    on(robot, 'pointerdown', event => {
      if (!state.ready || hasActive() || event.button !== 0 || event.isPrimary === false) return;
      state.suppressClick = false; state.selectedRobot = true; state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }; robot.setAttribute('aria-grabbed', 'true');
      try { robot.setPointerCapture(event.pointerId); } catch {} event.preventDefault(); render();
    });
    const move = event => { const drag = state.drag; if (!drag || event.pointerId !== drag.id) return; if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 6) drag.moved = true; layer.dataset.dragging = String(drag.moved); };
    const release = event => { if (!state.drag || event.pointerId !== state.drag.id) return; move(event); const drag = finishDrag(); if (!drag.moved) return; state.suppressClick = true; updateLayout(); const facility = hitFacility(localPoint(event)); if (facility) openFacility(facility); else { state.selectedRobot = false; say('Drop cancelled. No assignment was sent.'); } };
    const abortDrag = event => { if (!state.drag || event?.pointerId !== undefined && event.pointerId !== state.drag.id) return; finishDrag(); state.selectedRobot = false; say('Drag cancelled. No assignment was sent.'); };
    on(doc, 'pointermove', move); on(doc, 'pointerup', release); on(doc, 'pointercancel', abortDrag); on(robot, 'lostpointercapture', abortDrag);
    on(doc, 'keydown', event => { if (event.key !== 'Escape' || !state.selectedRobot && dock.hidden && !state.drag) return; event.preventDefault(); finishDrag(); if (hasActive()) say('The assignment is still active. Use Cancel run to request cancellation.'); else clearFocus(); });
    on(doc, 'visibilitychange', () => { if (doc.hidden) finishDrag(); });
    if (typeof view.addEventListener === 'function') { on(view, 'blur', () => abortDrag({})); on(view, 'resize', updateLayout); }
    const controller = {
      refresh, hasActive, clearFocus,
      setVisible(visible) { if (state.destroyed) return; state.visible = visible === true; if (!state.visible) { finishDrag(); cancelLater(state.timer); state.timer = null; } updateLayout(); render(); if (state.visible) void refresh(); },
      destroy() { if (state.destroyed) return; state.destroyed = true; state.generation++; finishDrag(); cancelLater(state.timer); state.timer = null; for (const remove of listeners.splice(0)) remove(); layer.remove(); },
    };
    void refresh(); return controller;
  }
  return Object.freeze({ mount, readyForInteraction, normalizeWorkers, projectBounds, projectRobot, pointInPolygon, reconcileCandidate });
});
