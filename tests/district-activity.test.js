'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { DistrictStore } = require('../app/district/store');
const { ActivityProjector } = require('../app/district/activity');

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  const store = new DistrictStore({ db });
  let time = 100_000;
  const projector = new ActivityProjector({ store, now: () => time });
  t.after(() => db.close());
  return { store, projector, setTime(value) { time = value; }, now: () => time };
}
function event(id, extra = {}) {
  return {
    id, workerId: 'codex-worker', sessionId: 'session-a', projectId: 'project-a',
    runId: 'run-a', attemptId: 'attempt-a', phase: 'research', basis: 'reported',
    origin: 'agent', message: 'Reading the request', ...extra,
  };
}

test('reported, observed and inferred phases remain labelled and edit maps to Workshop', (t) => {
  const { projector, setTime } = fixture(t);
  const report = projector.ingest(event('report'));
  assert.equal(report.phase, 'research'); assert.equal(report.facility, 'research');
  assert.equal(report.label, 'Agent-reported · Research'); assert.equal(report.status, 'active');
  setTime(100_010);
  const edit = projector.ingest(event('edit', { phase: 'edit', basis: 'observed', origin: 'file-tool', evidence: { path: 'index.html', hash: 'fixture-hash' } }));
  assert.equal(edit.facility, 'workshop'); assert.equal(edit.label, 'Observed · Editing');
  assert.equal(edit.evidence.path, 'index.html');
  setTime(100_020);
  const inferred = projector.ingest(event('waiting', { phase: 'waiting', basis: 'inferred', origin: 'runtime', message: 'No current operation is known' }));
  assert.equal(inferred.label, 'Inferred · Waiting'); assert.equal(inferred.status, 'waiting');
  assert.equal(inferred.terminal, false);
});

test('projection and durable dedup survive reconstruction without dispatching commands', (t) => {
  const { store, projector, now } = fixture(t);
  store.command = () => assert.fail('Observation must never dispatch a command');
  assert(projector.ingest(event('same-event', { sourceSeq: 2 })));
  const reopened = new ActivityProjector({ store, now });
  assert.equal(reopened.ingest(event('same-event', { runId: 'different-run' })), null);
  assert.equal(reopened.list().length, 1, 'hidden dedup markers are excluded');
  assert.equal(reopened.list()[0].eventId, 'same-event');
  assert.equal(store.get('run', 'run-a'), null, 'activity cannot create run/result records');
});

test('source order and observation time reject late reports without refreshing them', (t) => {
  const { projector, setTime } = fixture(t);
  assert(projector.ingest(event('seq-2', { sourceSeq: 2, at: 99_900 })));
  setTime(100_500);
  assert.equal(projector.ingest(event('seq-1', { sourceSeq: 1, at: 100_400, phase: 'edit' })), null);
  assert.equal(projector.ingest(event('older', { sourceSeq: 3, at: 99_800 })), null);
  assert.equal(projector.ingest(event('replay-seq-3', { sourceSeq: 3, at: 100_500 })), null);
  assert.equal(projector.list()[0].at, 99_900);
  assert.equal(projector.list()[0].updatedAt, 100_000);
  assert.equal(projector.ingest(event('seq-4', { sourceSeq: 4, at: 100_500, phase: 'edit' })).phase, 'edit');
});

test('independent source sequences do not share a counter; observed wins equal-time ties', (t) => {
  const { projector } = fixture(t);
  projector.ingest(event('reported-high', { sourceSeq: 500, at: 99_900 }));
  const observed = projector.ingest(event('observed-low', { basis: 'observed', origin: 'file-tool', sourceSeq: 1, phase: 'edit', at: 100_000 }));
  assert.equal(observed.phase, 'edit');
  assert.equal(projector.ingest(event('reported-new', { sourceSeq: 501, phase: 'research', at: 100_000 })), null);
  assert.equal(projector.list()[0].basis, 'observed');
});

test('freshness ages on read and future source clocks cannot keep activity fresh', (t) => {
  const { projector, setTime } = fixture(t);
  const initial = projector.ingest(event('future', { at: 9_000_000 }));
  assert.equal(initial.at, 100_000); assert.equal(initial.sourceAt, 9_000_000);
  setTime(160_001);
  const stale = projector.list()[0];
  assert.equal(stale.freshness, 'stale'); assert.equal(stale.status, 'stale');
  assert.equal(stale.stale, true); assert.equal(stale.ageMs, 60_001);
  assert.match(stale.label, /Agent-reported.*stale/);
  assert.equal(projector.ingest(event('old-report', { at: 99_999 })), null);
  assert.equal(projector.list()[0].at, 100_000);
});

test('unknown correlation stays unknown and never borrows another worker project or run', (t) => {
  const { projector } = fixture(t);
  projector.ingest(event('known'));
  const unknown = projector.ingest({ id: 'unknown', workerId: 'codex-worker', phase: 'research', basis: 'reported', origin: 'cli', message: 'Researching' });
  for (const key of ['sessionId', 'projectId', 'runId', 'attemptId']) assert.equal(Object.hasOwn(unknown, key), false);
  assert.equal(projector.list().length, 2);
  assert.equal(projector.list({ projectId: 'project-a' }).length, 1);
  assert.equal(projector.list({ projectId: 'project-b' }).length, 0);
});

test('only observed explicit terminal events close a run; late reports cannot reopen it', (t) => {
  const { projector, setTime } = fixture(t);
  projector.ingest(event('start'));
  setTime(100_020);
  const forged = projector.ingest(event('forged-result', { terminal: true, status: 'completed', evidence: { state: 'passed' } }));
  assert.equal(forged.terminal, false); assert.equal(forged.status, 'active');
  // Terminal observation is decisive even if a report arrived with a later time.
  const done = projector.ingest(event('real-result', { phase: 'idle', basis: 'observed', origin: 'runtime', terminal: true, status: 'completed', at: 100_010 }));
  assert.equal(done.status, 'completed'); assert.equal(done.label, 'Observed · Completed');
  setTime(100_050);
  assert.equal(projector.ingest(event('late-research', { sourceSeq: 99 })), null);
  assert.equal(projector.ingest(event('late-observed', { phase: 'edit', basis: 'observed', origin: 'file-tool' })), null);
  assert.equal(projector.ingest(event('conflicting-final', { phase: 'error', basis: 'observed', origin: 'runtime', terminal: true, status: 'failed' })), null);
  assert.equal(projector.list()[0].status, 'completed');
});

test('old attempts and sessions cannot close or reopen a new attempt', (t) => {
  const { projector, setTime } = fixture(t);
  projector.ingest(event('old-final', { phase: 'error', basis: 'observed', origin: 'runtime', terminal: true, status: 'cancelled' }));
  setTime(100_100);
  const current = projector.ingest(event('new-attempt', { attemptId: 'attempt-b', sessionId: 'session-b', phase: 'edit', basis: 'observed', origin: 'file-tool' }));
  assert.equal(current.status, 'active');
  assert.equal(projector.ingest(event('late-old')), null);
  const activities = projector.list();
  assert.equal(activities.length, 2);
  assert.equal(activities.find((activity) => activity.attemptId === 'attempt-b').status, 'active');
  assert.equal(activities.find((activity) => activity.attemptId === 'attempt-a').status, 'cancelled');
});

test('terminal attempt fences survive changed or omitted session metadata and restart', (t) => {
  const { store, projector, now, setTime } = fixture(t);
  projector.ingest(event('session-not-known', { sessionId: undefined }));
  setTime(100_010);
  projector.ingest(event('session-discovered', { phase: 'edit', basis: 'observed', origin: 'file-tool' }));
  setTime(100_020);
  const terminal = projector.ingest(event('session-final', { phase: 'idle', basis: 'observed', origin: 'runtime', terminal: true, status: 'completed' }));
  assert.equal(terminal.status, 'completed');
  const reopened = new ActivityProjector({ store, now });
  setTime(100_030);
  assert.equal(reopened.ingest(event('late-no-session', { sessionId: undefined })), null);
  assert.equal(reopened.ingest(event('late-other-session', { sessionId: 'session-other' })), null);
  const visible = reopened.list();
  assert.equal(visible.length, 1, 'partial-session Research projection is superseded by the observed final');
  assert.equal(visible[0].terminal, true);
  assert.equal(visible[0].status, 'completed');
});

test('known run finality, workspace identity and superseded attempts fence observations', (t) => {
  const { store, projector } = fixture(t);
  store.put('run', { id: 'run-a', projectId: 'project-a', attemptId: 'attempt-b', state: 'running' });
  assert.equal(projector.ingest(event('wrong-project', { projectId: 'project-b', attemptId: 'attempt-b' })), null);
  assert.equal(projector.ingest(event('old-attempt')), null);
  store.put('run', { id: 'run-a', projectId: 'project-a', attemptId: 'attempt-b', state: 'failed' });
  assert.equal(projector.ingest(event('late-new', { attemptId: 'attempt-b' })), null);
  assert.equal(projector.ingest(event('wrong-outcome', { attemptId: 'attempt-b', phase: 'idle', basis: 'observed', origin: 'runtime', terminal: true, status: 'completed' })), null);
  const failed = projector.ingest(event('failed', { attemptId: 'attempt-b', phase: 'error', basis: 'observed', origin: 'runtime', terminal: true, status: 'failed' }));
  assert.equal(failed.status, 'failed');
});

test('idle and error alone are phase observations, never completion verdicts', (t) => {
  const { projector, setTime } = fixture(t);
  const idle = projector.ingest(event('idle', { phase: 'idle', basis: 'observed' }));
  assert.equal(idle.status, 'idle'); assert.equal(idle.terminal, false);
  setTime(100_010);
  const error = projector.ingest(event('error', { phase: 'error', basis: 'reported' }));
  assert.equal(error.status, 'error'); assert.equal(error.terminal, false);
  setTime(100_020);
  assert.equal(projector.ingest(event('resumed', { phase: 'edit', basis: 'observed' })).status, 'active');
});

test('invalid events and unsupported phases cannot mutate projection state', (t) => {
  const { projector, store } = fixture(t);
  for (const invalid of [
    null, {}, event('bad-phase', { phase: 'deploy' }), event('bad-basis', { basis: 'trusted' }),
    event('bad-seq', { sourceSeq: -1 }), event('bad-clock', { at: Infinity }),
    event('bad-message', { message: 'a'.repeat(4_001) }), event('bad-project', { projectId: '../'.repeat(100) }),
    event('bad-terminal', { basis: 'observed', terminal: true, status: 'passed' }),
    event('bad-evidence', { evidence: { huge: 'x'.repeat(65_537) } }),
  ]) assert.equal(projector.ingest(invalid), null);
  assert.equal(store.list('activity').length, 0);
});

test('returned evidence is isolated from persisted projection and no private markers leak', (t) => {
  const { projector } = fixture(t);
  const result = projector.ingest(event('copy', { evidence: { checks: ['one'] } }));
  result.evidence.checks.push('invented'); result.phase = 'build';
  const listed = projector.list()[0];
  assert.deepEqual(listed.evidence.checks, ['one']); assert.equal(listed.phase, 'research');
  for (const key of ['_sources', 'recordType', 'terminalStatus']) assert.equal(Object.hasOwn(listed, key), false);
});
