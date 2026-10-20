'use strict';

// An observation changes this read model only. It never launches work, writes a
// run verdict, grants permission, or treats an agent's words as execution proof.
const { createHash } = require('node:crypto');

const PHASES = new Set(['research', 'edit', 'build', 'test', 'review', 'idle', 'waiting', 'error']);
const BASES = new Set(['reported', 'observed', 'inferred']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'timed_out', 'termination_unknown']);
const FRESH_MS = 60_000;
const MAX_SOURCES = 64;
const BASIS_RANK = { inferred: 0, reported: 1, observed: 2 };
const BASIS_LABEL = { inferred: 'Inferred', reported: 'Agent-reported', observed: 'Observed' };
const PHASE_LABEL = {
  research: 'Research', edit: 'Editing', build: 'Building', test: 'Testing',
  review: 'Reviewing', idle: 'Idle', waiting: 'Waiting', error: 'Error',
};
const TERMINAL_LABEL = {
  completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
  interrupted: 'Interrupted', timed_out: 'Timed out',
  termination_unknown: 'Process status unconfirmed',
};
const FACILITY = { research: 'research', edit: 'workshop', build: 'build', test: 'test', review: 'review' };

function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function identifier(value) { return typeof value === 'string' && value.trim().length > 0 && value.length <= 256; }
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function runTerminal(run) {
  if (!run) return null;
  const state = run.state || run.status;
  return state === 'passed' ? 'completed' : TERMINAL.has(state) ? state : null;
}

function normalize(event, receivedAt) {
  if (!plain(event) || !identifier(event.id) || !identifier(event.workerId) ||
      !identifier(event.origin) || !PHASES.has(event.phase) || !BASES.has(event.basis)) return null;
  for (const key of ['sessionId', 'projectId', 'runId', 'attemptId']) {
    if (event[key] !== undefined && event[key] !== null && !identifier(event[key])) return null;
  }
  if (event.message !== undefined && (typeof event.message !== 'string' || event.message.length > 4_000)) return null;
  if (event.sourceSeq !== undefined && (!Number.isSafeInteger(event.sourceSeq) || event.sourceSeq < 0)) return null;
  if (event.at !== undefined && (!Number.isFinite(event.at) || event.at < 0)) return null;
  // Future clocks cannot keep a worker permanently fresh or pin it above later
  // local observations. The original timestamp remains available for diagnosis.
  const at = Math.min(event.at === undefined ? receivedAt : event.at, receivedAt);
  const result = {
    eventId: event.id, workerId: event.workerId, phase: event.phase, basis: event.basis,
    origin: event.origin, at, receivedAt, message: event.message || '',
  };
  for (const key of ['sessionId', 'projectId', 'runId', 'attemptId', 'sourceSeq']) {
    if (event[key] !== undefined && event[key] !== null) result[key] = event[key];
  }
  if (event.at !== undefined && event.at > receivedAt) result.sourceAt = event.at;
  if (event.evidence !== undefined) {
    try {
      const encoded = JSON.stringify(event.evidence);
      if (encoded === undefined || Buffer.byteLength(encoded, 'utf8') > 65_536) return null;
      result.evidence = JSON.parse(encoded);
    } catch { return null; }
  }
  // A report cannot close an assignment, including one containing forged
  // status/evidence fields. Trusted runtime adapters alone label observations.
  result.terminal = event.basis === 'observed' && event.terminal === true &&
    TERMINAL.has(event.status) && identifier(result.runId);
  if (event.basis === 'observed' && event.terminal === true && !result.terminal) return null;
  if (result.terminal) result.terminalStatus = event.status;
  return result;
}

function scopeId(event) {
  // Missing identities stay missing; never borrow the last project/run of a
  // worker. Different attempts and sessions cannot overwrite one another.
  return 'activity:' + hash(JSON.stringify([
    event.workerId, event.sessionId || null, event.projectId || null,
    event.runId || null, event.attemptId || null,
  ]));
}

function terminalId(event, run) {
  return event.runId ? 'activity-terminal:' + hash(JSON.stringify([event.runId, event.attemptId || run?.attemptId || run?.id || null])) : null;
}

function sourceId(event, run) {
  // A source's sequence cannot reset by adding/removing session metadata after
  // a run has already been linked. Independent report/observer streams retain
  // independent counters. Unlinked sessions remain separate, unknown work.
  return 'activity-source:' + hash(JSON.stringify([
    event.workerId, event.projectId || null, event.runId || null,
    event.attemptId || run?.attemptId || (event.runId ? run?.id : null) || null,
    event.runId ? null : event.sessionId || null, event.origin, event.basis,
  ]));
}

function newer(event, current) {
  if (!current) return true;
  if (event.at !== current.at) return event.at > current.at;
  if (BASIS_RANK[event.basis] !== BASIS_RANK[current.basis]) {
    return BASIS_RANK[event.basis] > BASIS_RANK[current.basis];
  }
  if (event.origin === current.origin && event.sourceSeq !== undefined && current.sourceSeq !== undefined) {
    return event.sourceSeq > current.sourceSeq;
  }
  // Equal-time unrelated streams have no shared sequence. A stable tie break
  // avoids choosing a different projection solely because arrival order changed.
  return (event.origin + '\0' + event.eventId) > (current.origin + '\0' + current.eventId);
}

function present(record, now) {
  const { recordType, _sources, terminalStatus, ...activity } = copy(record);
  activity.ageMs = Math.max(0, now - activity.at);
  activity.freshness = activity.ageMs <= FRESH_MS ? 'fresh' : 'stale';
  activity.stale = activity.freshness === 'stale';
  activity.motionAllowed = !activity.stale && !activity.terminal &&
    Boolean(activity.projectId && activity.runId) && ['research', 'edit', 'build', 'test', 'review'].includes(activity.phase);
  activity.status = activity.terminal ? terminalStatus : activity.stale ? 'stale' :
    ['idle', 'waiting', 'error'].includes(activity.phase) ? activity.phase : 'active';
  const detail = activity.terminal ? TERMINAL_LABEL[terminalStatus] : PHASE_LABEL[activity.phase];
  activity.label = BASIS_LABEL[activity.basis] + ' · ' + detail +
    (activity.stale && !activity.terminal ? ' (stale)' : '');
  return activity;
}

class ActivityProjector {
  constructor({ store, now = Date.now } = {}) {
    if (!store || ['get', 'put', 'list', 'transaction'].some((method) => typeof store[method] !== 'function')) {
      throw new TypeError('ActivityProjector requires a DistrictStore.');
    }
    if (typeof now !== 'function') throw new TypeError('ActivityProjector now must be a function.');
    this.store = store;
    this.now = now;
  }

  ingest(input) {
    const receivedAt = this.now();
    if (!Number.isFinite(receivedAt) || receivedAt < 0) throw new TypeError('Activity clock must return milliseconds.');
    const event = normalize(input, receivedAt);
    if (!event) return null;
    const markerId = 'activity-event:' + hash(event.eventId);
    const id = scopeId(event);
    return this.store.transaction(() => {
      if (this.store.get('activity', markerId)) return null;
      const current = this.store.get('activity', id);
      const sources = current ? copy(current._sources || {}) : {};
      const sourceKey = hash(event.origin + '\0' + event.basis);
      const run = event.runId ? this.store.get('run', event.runId) : null;
      const cursorId = sourceId(event, run);
      const cursor = this.store.get('activity', cursorId);
      const previousSeq = cursor?.sourceSeq ?? sources[sourceKey] ??
        (current?.origin === event.origin && current?.basis === event.basis ? current.sourceSeq : undefined);
      const finalRunStatus = runTerminal(run);
      const fenceId = terminalId(event, run);
      const fence = fenceId ? this.store.get('activity', fenceId) : null;
      let reason = null;
      if (run && event.projectId && run.projectId && run.projectId !== event.projectId) reason = 'project_mismatch';
      else if (run && (run.workerId || run.worker || run.provider) && (run.workerId || run.worker || run.provider) !== event.workerId) reason = 'worker_mismatch';
      else if (run && run.sessionId && event.sessionId && run.sessionId !== event.sessionId) reason = 'session_mismatch';
      else if (run && run.attemptId && event.attemptId && run.attemptId !== event.attemptId && !event.terminal) reason = 'superseded_attempt';
      else if (current && current.terminal) reason = 'terminal_scope';
      else if (fence) reason = 'terminal_attempt';
      else if (finalRunStatus && (!event.terminal || finalRunStatus !== event.terminalStatus)) reason = 'terminal_run';
      else if (event.sourceSeq !== undefined && previousSeq !== undefined && event.sourceSeq <= previousSeq) reason = 'source_order';
      else if (event.sourceSeq !== undefined && previousSeq === undefined && Object.keys(sources).length >= MAX_SOURCES) reason = 'source_limit';
      else if (!event.terminal && !newer(event, current)) reason = 'older_observation';

      // Durable event markers make event-ID dedup independent of projector
      // lifetime, bounded cursor history, and changes to correlation fields.
      // list() filters these implementation records from the public projection.
      this.store.put('activity', {
        id: markerId, recordType: 'activity-event', eventId: event.eventId,
        activityId: id, receivedAt, disposition: reason || 'projected',
      });
      if (reason) {
        // Even a globally older observation advances its own stream cursor, so
        // later replays cannot sneak back in with a different timestamp.
        if (reason === 'older_observation' && event.sourceSeq !== undefined && current) {
          sources[sourceKey] = event.sourceSeq;
          this.store.put('activity', { ...current, _sources: sources });
          this.store.put('activity', { id: cursorId, recordType: 'activity-source', sourceSeq: event.sourceSeq });
        }
        return null;
      }
      if (event.sourceSeq !== undefined) sources[sourceKey] = event.sourceSeq;
      if (event.sourceSeq !== undefined) this.store.put('activity', { id: cursorId, recordType: 'activity-source', sourceSeq: event.sourceSeq });
      const record = {
        id, recordType: 'activity-projection', ...event,
        facility: FACILITY[event.phase] || null,
        createdAt: current ? current.createdAt : receivedAt, updatedAt: receivedAt,
        _sources: sources,
      };
      if (event.terminal) {
        this.store.put('activity', {
          id: fenceId, recordType: 'activity-terminal', activityId: id,
          runId: event.runId, ...(event.attemptId ? { attemptId: event.attemptId } : {}),
          status: event.terminalStatus, eventId: event.eventId, at: event.at,
        });
      }
      this.store.put('activity', record);
      return present(record, receivedAt);
    });
  }

  list({ projectId } = {}) {
    if (projectId !== undefined && !identifier(projectId)) return [];
    const now = this.now();
    if (!Number.isFinite(now) || now < 0) throw new TypeError('Activity clock must return milliseconds.');
    const records = this.store.list('activity');
    const fences = new Map(records.filter((record) => record.recordType === 'activity-terminal')
      .map((record) => [record.id, record]));
    return records
      .filter((record) => record.recordType === 'activity-projection' &&
        (projectId === undefined || record.projectId === projectId) &&
        // The final observation replaces earlier partial-session projections of
        // this exact attempt. Do not leave an old Research badge active beside it.
        (!fences.has(terminalId(record, record.runId ? this.store.get('run', record.runId) : null)) ||
          fences.get(terminalId(record, record.runId ? this.store.get('run', record.runId) : null)).activityId === record.id))
      .map((record) => present(record, now))
      .sort((left, right) => right.at - left.at || left.id.localeCompare(right.id));
  }
}

module.exports = { ActivityProjector };
