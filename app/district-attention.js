(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DistrictAttention = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Pure snapshot projection. Selection orders attention; it never acknowledges
  // an event. Optional attentionSeenIds are caller-owned UI hints, not durable
  // backend read receipts. No clock, storage, timer, command or provider is used.
  const ACTIVE = new Set(['working', 'running', 'building', 'testing']);
  const FINAL = new Set(['passed', 'completed', 'failed', 'timed_out', 'cancelled', 'interrupted']);
  const WAITING = new Set(['queued', 'starting', 'stopping', 'waiting', 'blocked', 'needs_input']);
  const UNKNOWN = new Set(['unknown', 'stale', 'termination_unknown', 'interrupted', 'unavailable']);
  const BASIS = { observed: 'Observed', reported: 'Agent-reported', inferred: 'Inferred', unknown: 'Basis unknown' };
  const NAMES = { passed: 'Checks passed', completed: 'Run completed', failed: 'Run failed', timed_out: 'Run timed out',
    cancelled: 'Run cancelled', interrupted: 'Execution interrupted', termination_unknown: 'Process status unconfirmed',
    queued: 'Queued', starting: 'Starting session', stopping: 'Waiting for stop confirmation', waiting: 'Waiting',
    blocked: 'Waiting for action', needs_input: 'Waiting for input', working: 'Session active', running: 'Running',
    building: 'Building', testing: 'Testing', unknown: 'Status unknown', stale: 'Status stale', unavailable: 'Project unavailable' };
  const records = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
  const id = value => typeof value === 'string' && value.trim() && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
  const text = (value, max = 350) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
  const time = value => { const number = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(number) && number >= 0 ? number : null; };
  const when = record => Math.max(-1, ...['updated', 'updatedAt', 'finished', 'at', 'created', 'createdAt'].map(key => time(record?.[key]) ?? -1));
  const created = record => time(record?.created) ?? time(record?.createdAt) ?? when(record);
  const stateOf = record => text(record.state || record.status || 'unknown', 60) || 'unknown';
  const workerOf = record => id(record.workerId) || id(record.worker) || id(record.provider);
  const staleOf = record => record?.stale === true || ['stale', 'unknown'].includes(record?.freshness) || record?.status === 'stale';
  const basisOf = record => Object.hasOwn(BASIS, record.basis) ? record.basis : 'unknown';
  const tie = record => JSON.stringify([id(record.eventId), id(record.id), stateOf(record), text(record.phase, 40),
    workerOf(record), id(record.sessionId), text(record.detail || record.message), id(record.artifact?.candidateHash), id(record.source?.hash)]);
  const newer = (a, b) => when(a) - when(b) || ({ observed: 3, reported: 2, inferred: 1 }[a.basis] || 0) - ({ observed: 3, reported: 2, inferred: 1 }[b.basis] || 0)
    || tie(a).localeCompare(tie(b));
  const scope = (projectId, runId) => JSON.stringify([projectId, runId]);

  function projectAttention(snapshot = {}, selectedIds = []) {
    if (!snapshot || typeof snapshot !== 'object') return [];
    const projects = new Map();
    for (const project of records(snapshot.projects)) if (id(project.id) && !projects.has(project.id)) projects.set(project.id, project);
    const selected = new Set(Array.isArray(selectedIds) ? selectedIds.filter(id) : []);
    const seen = Array.isArray(snapshot.attentionSeenIds) ? new Set(snapshot.attentionSeenIds.filter(value => typeof value === 'string' && value.length <= 16384)) : null;
    const snapshotStale = snapshot.stale === true || snapshot.unavailable === true || Boolean(snapshot.readError);
    const runs = new Map(), owners = new Map(), latest = new Map(), entries = new Map();
    for (const run of records(snapshot.runs)) {
      if (!id(run.id) || !projects.has(run.projectId)) continue;
      const key = scope(run.projectId, run.id);
      const previous = runs.get(key);
      const final = FINAL.has(stateOf(run)), previousFinal = previous && FINAL.has(stateOf(previous));
      // One run identity never reopens. A replay with a newer report timestamp
      // cannot replace its recorded terminal outcome with an active state.
      if (!previous || final && !previousFinal || final === previousFinal && newer(run, previous) > 0) runs.set(key, run);
      if (!owners.has(run.id)) owners.set(run.id, new Set());
      owners.get(run.id).add(run.projectId);
      latest.set(run.projectId, Math.max(latest.get(run.projectId) ?? -1, created(run)));
    }

    function emit(record, source, kind, state, title, options = {}) {
      const project = projects.get(record.projectId);
      const runId = source === 'run' ? record.id : id(record.runId);
      const workerId = workerOf(record), basis = source === 'activity' ? basisOf(record) : 'observed';
      const sourceId = source === 'activity' ? options.activityScope : source === 'run' ? record.id : project.id;
      const key = `${source}:${JSON.stringify([project.id, sourceId, kind, state])}`;
      const candidateHash = id(record.artifact?.candidateHash) || id(record.candidateHash) || id(record.evidence?.candidateHash);
      const sourceHash = id(record.source?.hash) || id(record.evidence?.sourceHash);
      const currentHash = id(project.manifest?.hash);
      const changed = Boolean(currentHash && [sourceHash, candidateHash].some(hash => hash && hash !== currentHash)
        || sourceHash && candidateHash && sourceHash !== candidateHash);
      const stale = snapshotStale || project.unavailable === true || staleOf(record) || UNKNOWN.has(state) || changed;
      const historical = source !== 'project' && (record.historical === true || options.historical === true || changed || snapshotStale
        || FINAL.has(state) && staleOf(record)
        || (source === 'run' ? created(record) : when(record)) < (latest.get(project.id) ?? -1));
      const actionable = !historical && (kind === 'failed' || kind === 'unknown'
        || kind === 'waiting' && (['waiting', 'blocked', 'needs_input'].includes(state) || record.requiresUserAction === true));
      const unseen = seen ? !seen.has(key) : typeof record.unseen === 'boolean' ? record.unseen
        : typeof record.unread === 'boolean' ? record.unread : typeof record.seen === 'boolean' ? !record.seen : null;
      const evidence = { runId: runId || null, activityId: source === 'activity' ? id(record.id) : null,
        eventId: id(record.eventId), attemptId: id(record.attemptId), sessionId: id(record.sessionId), candidateHash, sourceHash };
      const entry = { id: key, key, projectId: project.id, projectName: text(project.name, 100) || project.id,
        runId: runId || null, workerId, sessionId: id(record.sessionId), kind, state,
        label: `${historical ? FINAL.has(state) ? 'Earlier result · ' : 'Earlier state · ' : ''}${BASIS[basis]} · ${title}${changed ? ' · Source changed' : stale && !UNKNOWN.has(state) ? ' · Stale' : ''}`,
        detail: text(record.detail || record.message || record.error), basis, at: when(record) >= 0 ? when(record) : null,
        stale, historical, selected: selected.has(project.id), unseen, actionable, evidence };
      entries.set(key, entry);
      return entry;
    }

    const attentionRuns = new Set();
    for (const [runScope, run] of runs) {
      const state = stateOf(run), stale = snapshotStale || projects.get(run.projectId).unavailable === true || staleOf(run);
      let kind = null, title = NAMES[state] || `Recorded state: ${state}`;
      if (UNKNOWN.has(state) || stale && ACTIVE.has(state)) { kind = 'unknown'; if (stale && ACTIVE.has(state)) title = `Status stale · Last recorded ${NAMES[state].toLowerCase()}`; }
      else if (['failed', 'timed_out', 'error'].includes(state)) kind = 'failed';
      else if (WAITING.has(state)) kind = 'waiting';
      else if (['passed', 'completed', 'cancelled'].includes(state)) kind = 'completed';
      else if (!ACTIVE.has(state)) kind = 'unknown';
      if (kind) { emit(run, 'run', kind, state, title); attentionRuns.add(runScope); }
    }

    const terminalActivity = record => record.terminal === true && basisOf(record) === 'observed' && id(record.runId)
      && (FINAL.has(stateOf(record)) || UNKNOWN.has(stateOf(record)));
    const fence = record => JSON.stringify([record.projectId, id(record.runId), id(record.attemptId)]);
    const fences = new Set(records(snapshot.activities).filter(record => projects.has(record.projectId) && workerOf(record)
      && (!record.recordType || record.recordType === 'activity-projection') && terminalActivity(record)
      && (!owners.has(record.runId) || owners.get(record.runId).has(record.projectId))).map(fence));
    const activities = new Map();
    for (const activity of records(snapshot.activities)) {
      if (!projects.has(activity.projectId) || !workerOf(activity) || activity.recordType && activity.recordType !== 'activity-projection') continue;
      const runId = id(activity.runId), linked = runId && runs.get(scope(activity.projectId, runId));
      if (runId && owners.has(runId) && !owners.get(runId).has(activity.projectId)) continue;
      if (linked && (FINAL.has(stateOf(linked)) || attentionRuns.has(scope(activity.projectId, runId)))) continue;
      if (linked && when(activity) < when(linked) && activity.terminal !== true) continue;
      const terminal = terminalActivity(activity);
      if (!terminal && fences.has(fence(activity))) continue;
      const activityScope = JSON.stringify([activity.projectId, runId, terminal ? null : workerOf(activity), id(activity.attemptId), runId ? null : id(activity.sessionId)]);
      if (!activities.has(activityScope) || newer(activity, activities.get(activityScope)) > 0) activities.set(activityScope, activity);
    }
    for (const [activityScope, activity] of activities) {
      const basis = basisOf(activity), state = stateOf(activity), terminal = activity.terminal === true && basis === 'observed' && id(activity.runId);
      let kind = null, title = '';
      if (terminal && ['completed', 'passed', 'cancelled'].includes(state)) { kind = 'completed'; title = NAMES[state]; }
      else if (terminal && ['failed', 'timed_out'].includes(state)) { kind = 'failed'; title = NAMES[state]; }
      else if (terminal && UNKNOWN.has(state)) { kind = 'unknown'; title = NAMES[state]; }
      else if (snapshotStale || staleOf(activity) || UNKNOWN.has(state)) { kind = 'unknown'; title = 'Activity status stale or unknown'; }
      else if (activity.phase === 'error') { kind = 'failed'; title = 'Error reported'; }
      else if (activity.phase === 'waiting') { kind = 'waiting'; title = 'Waiting'; }
      if (kind) emit(activity, 'activity', kind, state, title, { activityScope });
    }
    for (const project of projects.values()) {
      if (project.unavailable === true) emit({ projectId: project.id, error: project.error,
        at: project.unavailableAt ?? project.errorAt }, 'project', 'unknown', 'unavailable', 'Project files unavailable');
    }
    return [...entries.values()].sort((a, b) => Number(b.actionable) - Number(a.actionable)
      || Number(b.unseen === true) - Number(a.unseen === true) || Number(a.selected) - Number(b.selected)
      || ({ failed: 0, unknown: 1, waiting: 2, completed: 3 }[a.kind] - { failed: 0, unknown: 1, waiting: 2, completed: 3 }[b.kind])
      || (b.at ?? -1) - (a.at ?? -1) || a.key.localeCompare(b.key));
  }

  return Object.freeze({ projectAttention });
});
