(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DistrictWorldState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const FACILITIES = new Set(['research', 'build', 'test', 'review', 'preview']);
  const TERMINAL = new Set(['passed', 'failed', 'cancelled', 'interrupted', 'completed', 'timed_out']);
  const STOP = new Set(['stopping', 'termination_unknown']);
  const ACTIVE = new Set(['queued', 'starting', 'working', 'running', 'building', 'testing', ...STOP]);
  const BASES = new Set(['reported', 'observed', 'inferred']);
  const RANK = { inferred: 0, reported: 1, observed: 2 };
  const PHASE_NAMES = { research: 'Research', edit: 'Editing', build: 'Build', test: 'Testing', review: 'Review', idle: 'Idle', waiting: 'Waiting', error: 'Error' };
  const RUN_NAMES = { queued: 'Queued', starting: 'Starting session', working: 'Session active', running: 'Running', building: 'Building', testing: 'Testing', passed: 'Checks passed', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', completed: 'Completed', timed_out: 'Timed out', stopping: 'Stopping', termination_unknown: 'Process status unknown' };
  const ACTIVITY_STATES = new Set(['active', 'stale', 'idle', 'waiting', 'error']);
  const MAX_WORKERS = 32, FRESH_MS = 60_000;
  const text = (value, maximum = 180) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, maximum);
  const identity = (value) => text(typeof value === 'object' && value ? value.id || value.workerId || value.name : value, 160);
  const timestamp = (value) => { const number = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(number) ? number : 0; };
  const when = (record) => timestamp(record?.at ?? record?.updated ?? record?.updatedAt ?? record?.finished ?? record?.created ?? record?.lastSeen);
  const workerId = (record) => identity(record?.workerId || record?.worker || record?.provider);
  const facilityFor = (phase) => phase === 'edit' || phase === 'build' ? 'build' : FACILITIES.has(phase) ? phase : null;
  const records = (value) => Array.isArray(value) ? value.filter((record) => record && typeof record === 'object' && !Array.isArray(record)) : [];
  const stateOf = (run) => text(run?.state || run?.status || 'unknown', 40);
  const explicit = (value) => typeof value === 'string' && value.length > 0;
  const sameOptional = (left, right, key) => !explicit(left?.[key]) || !explicit(right?.[key]) || left[key] === right[key];
  const copy = (value) => value ? JSON.parse(JSON.stringify(value)) : null;

  function compare(left, right) {
    const sameSource = left.origin === right.origin && left.basis === right.basis &&
      workerId(left) === workerId(right) && left.projectId === right.projectId &&
      left.runId === right.runId && sameOptional(left, right, 'attemptId') && sameOptional(left, right, 'sessionId');
    if (sameSource && Number.isSafeInteger(left.sourceSeq) && Number.isSafeInteger(right.sourceSeq) && left.sourceSeq !== right.sourceSeq) return right.sourceSeq - left.sourceSeq;
    return when(right) - when(left) || (RANK[right.basis] ?? -1) - (RANK[left.basis] ?? -1) ||
      text(left.eventId || left.id, 256).localeCompare(text(right.eventId || right.id, 256));
  }

  function dedup(value) {
    const seen = new Set();
    return records(value).slice().sort(compare).filter((record) => {
      const id = record.eventId || record.id;
      if (!explicit(id)) return true;
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
  }

  function scopeMatches(activity, run) {
    return activity.runId === run.id && activity.projectId === run.projectId &&
      workerId(activity) === workerId(run) && sameOptional(activity, run, 'attemptId') &&
      sameOptional(activity, run, 'sessionId');
  }

  function fresh(record, now) {
    const known = when(record), age = known > 0 && now >= known ? now - known : 0;
    const unknown = !!record && (!known || known > now + 1000 || record.freshness === 'unknown' || record.unavailable === true);
    return { unknown, stale: unknown || record?.stale === true || record?.freshness === 'stale' || record?.status === 'stale' ||
      known > now + 1000 || known > 0 && age > FRESH_MS, ageMs: age };
  }

  // Presentation identity only. Provider/run IDs are separate, never invented
  // executable workers. Two 32-bit streams keep keys within renderer limits.
  function renderKey(parts) {
    const value = JSON.stringify(parts); let a = 2166136261, b = 3339675911;
    for (let n = 0; n < value.length; n++) { a = Math.imul(a ^ value.charCodeAt(n), 16777619); b = Math.imul(b ^ value.charCodeAt(n), 2246822519); }
    return 'activity:' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }

  // Fourth argument is additive; existing workerState(worker,activities,runs)
  // callers remain supported. This pure projection never dispatches commands.
  function workerState(worker = {}, activities = [], runs = [], options = {}) {
    const id = identity(worker), now = Number.isFinite(options.now) ? options.now : Date.now();
    const projectId = options.projectId || worker.projectId;
    const requestedRun = options.runId || worker.runId;
    const eligibleRuns = (options.unlinked === true ? [] : records(runs)).filter((record) => workerId(record) === id &&
      (!projectId || record.projectId === projectId) && (!requestedRun || record.id === requestedRun) &&
      sameOptional(record, options, 'attemptId') && sameOptional(record, options, 'sessionId'))
      .sort((a, b) => when(b) - when(a) || identity(a).localeCompare(identity(b)));
    const run = eligibleRuns[0] || null;
    const scopedProject = projectId || run?.projectId;
    let candidates = dedup(records(activities).filter((record) => workerId(record) === id &&
      (!scopedProject || record.projectId === scopedProject) &&
      (!requestedRun || record.runId === requestedRun) && sameOptional(record, options, 'attemptId') && sameOptional(record, options, 'sessionId')));
    if (run) candidates = candidates.filter((record) => scopeMatches(record, run));
    else if (options.unlinked === true) candidates = candidates.filter((record) => !record.runId);
    let activity = candidates[0] || null;
    const runState = run ? stateOf(run) : null;
    const ended = !!run && TERMINAL.has(runState), protectedRun = !!run && (ended || STOP.has(runState) || ['building', 'testing'].includes(runState));
    const finalActivity = ended ? candidates.find((record) => record.basis === 'observed' && record.terminal === true &&
      record.status === (runState === 'passed' ? 'completed' : runState)) : null;
    const matchingFinal = !!finalActivity;
    if (protectedRun) activity = finalActivity || null;
    const missingRun = !!requestedRun && !run || !!activity?.runId && !run;
    const basis = activity ? BASES.has(activity.basis) ? activity.basis : null : run ? 'observed' : null;
    const phase = text(activity?.phase || (runState === 'building' ? 'build' : runState === 'testing' || runState === 'passed' ? 'test' : run?.phase || ''), 30);
    const validPhase = !activity || Object.hasOwn(PHASE_NAMES, phase);
    const terminalActivity = matchingFinal;
    const unavailable = options.unavailable === true || worker.unavailable === true;
    const freshness = fresh(activity || run, now);
    const unknownScope = !!activity && (!activity.projectId || !basis || !validPhase || missingRun);
    const unknown = unavailable || unknownScope || freshness.unknown || !!run && !Object.hasOwn(RUN_NAMES, runState);
    const stale = freshness.stale || unknown || runState === 'termination_unknown';
    let label = matchingFinal ? `Observed · ${RUN_NAMES[runState]} · ${PHASE_NAMES[phase] || 'Result'}` : activity
      ? `${basis === 'observed' ? 'Observed' : basis === 'inferred' ? 'Inferred' : basis === 'reported' ? 'Agent-reported' : 'Basis unknown'} · ${PHASE_NAMES[phase] || 'Activity unavailable'}${terminalActivity ? ` · ${text(activity.status, 30)}` : ''}${!activity.projectId ? ' · Unlinked project' : ''}${!activity.runId ? ' · Unlinked run' : ''}`
      : run ? `Observed · ${RUN_NAMES[runState] || 'State unavailable'}`
        : worker.available === false ? 'CLI unavailable' : worker.passive ? 'No recent activity' : worker.available === true ? 'CLI detected · No task' : 'Availability unknown';
    if (missingRun) label += ' · Run unavailable';
    if (unavailable) label = `State unavailable · connection unconfirmed${run ? ` · Last recorded ${RUN_NAMES[runState] || runState}` : ''}`;
    else if (stale) label += freshness.unknown ? ' · Freshness unknown' : ' · Stale';
    const state = unknown ? 'unknown' : run ? runState : terminalActivity ? text(activity.status, 40)
      : activity ? ACTIVITY_STATES.has(activity.status) ? activity.status : ['idle', 'waiting', 'error'].includes(phase) ? phase : 'active'
        : worker.available === false ? 'unavailable' : 'idle';
    const terminal = terminalActivity || ended;
    const quietReason = unavailable ? 'connection_unconfirmed' : unknownScope ? 'identity_or_basis_unknown' : stale ? 'stale_or_unknown' : terminal ? 'terminal' : STOP.has(runState) ? 'stop_pending' : !activity && !run ? 'no_work' : activity && !activity.runId ? 'unlinked_run' : null;
    const scope = {
      projectId: run?.projectId || activity?.projectId || projectId,
      runId: run?.id || activity?.runId || requestedRun,
      attemptId: run?.attemptId || activity?.attemptId,
      sessionId: run?.sessionId || activity?.sessionId,
    };
    return { activity: copy(activity), run: copy(run), ...scope, workerId: id, phase, basis, state, stale,
      freshness: unknown ? 'unknown' : stale ? 'stale' : 'fresh', ageMs: freshness.ageMs,
      label: text(label, 180), facility: unknown ? null : facilityFor(phase), terminal: !!terminal,
      historical: !!terminal, protected: !!protectedRun, quietReason,
      motionAllowed: !quietReason && !['idle', 'waiting', 'error', 'queued', 'starting'].includes(state),
      message: text(activity?.message || run?.detail || worker.detail || '', 180), at: when(activity || run),
      canAssign: !!(!worker.passive && worker.available !== false && worker.canAssign !== false && !unavailable && !STOP.has(runState)) };
  }

  function project(snapshot, projectId, options = {}) {
    if (!snapshot || typeof projectId !== 'string' || !projectId || projectId.length > 160 ||
        !records(snapshot.projects).some((record) => identity(record) === projectId)) return [];
    const relevant = (record) => record.projectId === projectId;
    const activities = dedup(records(snapshot.activities).filter(relevant)).slice(0, 1000);
    const runIds = new Set();
    const runs = records(snapshot.runs).filter(relevant).sort((a, b) => when(b) - when(a)).filter((run) => {
      if (!explicit(run.id) || runIds.has(run.id)) return false; runIds.add(run.id); return true;
    }).slice(0, 200);
    const roster = new Map();
    for (const provider of records(snapshot.providers)) {
      const id = identity(provider);
      if (id && !roster.has(id)) roster.set(id, { id, name: text(provider.name || id, 70), available: provider.available, canAssign: provider.canAssign, detail: text(provider.detail) });
      if (roster.size >= MAX_WORKERS) break;
    }
    for (const record of [...activities, ...runs]) {
      const id = workerId(record);
      if (id && !roster.has(id)) roster.set(id, { id, name: text(record.workerName || id, 70), passive: true });
      if (roster.size >= MAX_WORKERS) break;
    }
    const result = [];
    const unavailable = options.unavailable === true || snapshot.unavailable === true || !!snapshot.readError;
    function append(worker, scope) {
      const state = workerState(worker, activities, runs, { ...options, projectId, unavailable, ...scope });
      if (worker.passive && state.terminal) return;
      const activityKey = renderKey([projectId, worker.id, state.runId || null, state.attemptId || null, state.runId ? null : state.sessionId || null]);
      result.push({ id: worker.id, workerId: worker.id, activityKey, renderId: activityKey, name: worker.name,
        available: worker.available, passive: !!worker.passive, canAssign: state.canAssign,
        projectId, runId: state.runId, attemptId: state.attemptId, sessionId: state.sessionId,
        eventId: state.activity?.eventId || state.activity?.id, sourceSeq: state.activity?.sourceSeq,
        facility: state.facility, phase: state.phase, basis: state.basis, state: state.state,
        stale: state.stale, freshness: state.freshness, label: state.label, message: state.message,
        terminal: state.terminal, historical: state.historical, motionAllowed: state.motionAllowed, quietReason: state.quietReason, at: state.at });
    }
    for (const worker of roster.values()) {
      const ownedRuns = runs.filter((run) => workerId(run) === worker.id);
      const live = ownedRuns.filter((run) => ACTIVE.has(stateOf(run)));
      const scoped = live.length ? live : ownedRuns.slice(0, 1);
      for (const run of scoped) {
        if (result.length >= MAX_WORKERS) break;
        append(worker, { runId: run.id, attemptId: run.attemptId, sessionId: run.sessionId });
      }
      const extras = new Map();
      for (const activity of activities.filter((record) => workerId(record) === worker.id && (!record.runId || !runIds.has(record.runId)))) {
        const key = JSON.stringify([activity.runId || null, activity.attemptId || null, activity.sessionId || null]);
        if (!extras.has(key)) extras.set(key, activity);
      }
      for (const activity of extras.values()) {
        if (result.length >= MAX_WORKERS) break;
        append(worker, { runId: activity.runId, attemptId: activity.attemptId, sessionId: activity.sessionId, unlinked: !activity.runId });
      }
      if (!scoped.length && !extras.size && result.length < MAX_WORKERS) append(worker, {});
      if (result.length >= MAX_WORKERS) break;
    }
    return result;
  }

  return Object.freeze({ workerState, project, identity, workerId, when, facilityFor, text, MAX_WORKERS });
});
