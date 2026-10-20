'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { DistrictStore } = require('../app/district/store');
const { ActivityProjector } = require('../app/district/activity');
const world = require('../app/district-world-state');
const NOW = 1_800_000_000_000;
const provider = { id: 'codex', name: 'Codex', available: true };
const run = (id = 'run-a', extra = {}) => ({ id, projectId: 'project-a', worker: 'codex', state: 'working', updated: NOW, ...extra });
const report = (id = 'report-a', extra = {}) => ({ id, workerId: 'codex', projectId: 'project-a', phase: 'research', basis: 'reported', origin: 'cli', at: NOW, message: 'Reading the actual request', ...extra });
const snapshot = (extra = {}) => ({ projects: [{ id: 'project-a' }, { id: 'project-b' }], providers: [provider], activities: [], runs: [], ...extra });
function fixture(t) {
  const db = new DatabaseSync(':memory:'); const store = new DistrictStore({ db }); let now = NOW;
  const projector = new ActivityProjector({ store, now: () => now });
  t.after(() => db.close());
  return { store, projector, setTime(value) { now = value; }, now: () => now };
}

test('CLI and agent reports automatically select each phase without inventing execution or a pass', (t) => {
  const f = fixture(t);
  for (const [index, phase] of ['research', 'build', 'test', 'review'].entries()) {
    f.setTime(NOW + index);
    const activity = f.projector.ingest(report('phase-' + phase, { phase, sourceSeq: index, message: 'All checks passed (agent prose only)', terminal: true, status: 'passed' }));
    const row = world.project(snapshot({ activities: [activity] }), 'project-a', { now: f.now() })[0];
    assert.equal(row.facility, phase); assert.equal(row.phase, phase); assert.equal(row.basis, 'reported');
    assert.match(row.label, /Agent-reported/); assert.match(row.label, /Unlinked run/);
    assert.equal(row.terminal, false); assert.notEqual(row.state, 'passed'); assert.equal(row.motionAllowed, false);
    assert.equal(f.store.list('run').length, 0, 'phase observations create no process or result');
  }
});

test('observed and inferred bases remain explicit while actual run state controls verdicts', () => {
  for (const basis of ['observed', 'reported', 'inferred']) {
    const result = world.workerState(provider, [report('basis', { runId: 'run-a', phase: 'review', basis })], [run()], { projectId: 'project-a', now: NOW });
    assert.equal(result.facility, 'review'); assert.equal(result.basis, basis); assert.equal(result.state, 'working');
    assert.equal(result.terminal, false); assert.equal(result.runId, 'run-a');
    assert.match(result.label, new RegExp(basis === 'reported' ? 'Agent-reported' : basis === 'observed' ? 'Observed' : 'Inferred'));
  }
});

test('actual recipe stages outrank later reports and never borrow their made-up progress', () => {
  for (const [state, facility] of [['building', 'build'], ['testing', 'test']]) {
    const result = world.workerState(provider, [report('claim', { runId: 'run-a', phase: 'review', at: NOW + 500, message: '100% done' })], [run('run-a', { state })], { now: NOW + 500 });
    assert.equal(result.activity, null); assert.equal(result.state, state); assert.equal(result.facility, facility);
    assert.equal(result.basis, 'observed'); assert.equal(result.terminal, false); assert.doesNotMatch(result.message, /100%/);
  }
});

test('project/run/attempt/session identity must all agree before phase decoration', () => {
  const owned = run('run-a', { attemptId: 'attempt-a', sessionId: 'session-a' });
  const wrong = [
    report('wrong-project', { projectId: 'project-b', runId: 'run-a', phase: 'test', at: NOW + 1 }),
    report('wrong-run', { runId: 'run-b', phase: 'build', at: NOW + 2 }),
    report('wrong-attempt', { runId: 'run-a', attemptId: 'attempt-b', phase: 'review', at: NOW + 3 }),
    report('wrong-session', { runId: 'run-a', sessionId: 'session-b', phase: 'test', at: NOW + 4 }),
    report('wrong-worker', { workerId: 'claude', runId: 'run-a', phase: 'build', at: NOW + 5 }),
  ];
  const result = world.workerState(provider, wrong, [owned], { projectId: 'project-a', runId: 'run-a', now: NOW + 5 });
  assert.equal(result.activity, null); assert.equal(result.facility, null); assert.equal(result.runId, 'run-a');
  const right = world.workerState(provider, wrong.concat(report('correct', { runId: 'run-a', attemptId: 'attempt-a', sessionId: 'session-a', phase: 'edit' })), [owned], { projectId: 'project-a', runId: 'run-a', now: NOW });
  assert.equal(right.facility, 'build'); assert.equal(right.activity.id, 'correct');
});

test('legacy worker projection cannot pair the latest run with another run newer report', () => {
  const result = world.workerState(provider, [report('another-run', { runId: 'run-b', phase: 'test', at: NOW + 10 })], [run()], { now: NOW + 10 });
  assert.equal(result.activity, null); assert.equal(result.runId, 'run-a'); assert.equal(result.facility, null);
});

test('same provider can show concurrent runs without mixing phase or executable identity', () => {
  const value = snapshot({ runs: [run('run-a'), run('run-b', { updated: NOW + 1 })], activities: [
    report('research-a', { runId: 'run-a', phase: 'research' }),
    report('review-b', { runId: 'run-b', phase: 'review', at: NOW + 1 }),
    report('other-project', { projectId: 'project-b', runId: 'run-c', phase: 'test', at: NOW + 2 }),
  ] });
  const rows = world.project(value, 'project-a', { now: NOW + 2 });
  assert.equal(rows.length, 2); assert.deepEqual(rows.map((row) => row.id), ['codex', 'codex']);
  assert.equal(new Set(rows.map((row) => row.activityKey)).size, 2);
  assert(rows.every((row) => row.activityKey.length <= 32 && row.workerId === 'codex' && row.projectId === 'project-a'));
  assert.equal(rows.find((row) => row.runId === 'run-a').facility, 'research');
  assert.equal(rows.find((row) => row.runId === 'run-b').facility, 'review');
  const afterSessionDiscovery = world.project({ ...value, runs: value.runs.map((item) => ({ ...item, sessionId: 'discovered-' + item.id })) }, 'project-a', { now: NOW + 2 });
  for (const row of rows) assert.equal(afterSessionDiscovery.find((item) => item.runId === row.runId).activityKey, row.activityKey);
});

test('unlinked CLI activity is its own scope after a historical run and cannot reopen that run', () => {
  const rows = world.project(snapshot({ runs: [run('finished', { state: 'passed' })], activities: [report('new-research', { at: NOW + 10 })] }), 'project-a', { now: NOW + 10 });
  assert.equal(rows.length, 2);
  const historical = rows.find((row) => row.runId === 'finished');
  const standalone = rows.find((row) => !row.runId);
  assert.equal(historical.state, 'passed'); assert.equal(historical.terminal, true); assert.equal(historical.historical, true);
  assert.equal(historical.motionAllowed, false); assert.equal(standalone.facility, 'research');
  assert.equal(standalone.terminal, false); assert.equal(standalone.quietReason, 'unlinked_run');
  assert.notEqual(historical.activityKey, standalone.activityKey);
});

test('durable sequence cursors reject reordering across optional session discovery and restart', (t) => {
  const f = fixture(t); f.store.put('run', run());
  assert(f.projector.ingest(report('seq-5', { runId: 'run-a', sourceSeq: 5 })));
  f.setTime(NOW + 1);
  const reopened = new ActivityProjector({ store: f.store, now: f.now });
  assert.equal(reopened.ingest(report('seq-4', { runId: 'run-a', sessionId: 'newly-known', sourceSeq: 4, at: NOW + 1 })), null);
  assert.equal(reopened.ingest(report('seq-5', { runId: 'different-run', sourceSeq: 100 })), null, 'same event ID is consumed once');
  const accepted = reopened.ingest(report('seq-6', { runId: 'run-a', sessionId: 'newly-known', sourceSeq: 6, at: NOW + 1, phase: 'test' }));
  assert.equal(accepted.phase, 'test'); assert.equal(f.store.get('run', 'run-a').state, 'working');
});

test('snapshot source sequence wins over a later-looking stale report, with explicit basis', () => {
  const rows = world.project(snapshot({ activities: [
    report('late-old', { sourceSeq: 3, phase: 'review', at: NOW + 100 }),
    report('current', { sourceSeq: 4, phase: 'research', at: NOW }),
    report('current', { sourceSeq: 4, phase: 'research', at: NOW }),
  ] }), 'project-a', { now: NOW + 100 });
  assert.equal(rows.length, 1); assert.equal(rows[0].phase, 'research'); assert.match(rows[0].label, /Agent-reported/);
});

test('unconfirmed termination fences late activity and remains explicit uncertainty', (t) => {
  const f = fixture(t); f.store.put('run', run('run-a', { state: 'termination_unknown' }));
  const final = f.projector.ingest(report('unknown-final', { runId: 'run-a', attemptId: 'run-a', basis: 'observed', origin: 'runtime', phase: 'waiting', terminal: true, status: 'termination_unknown' }));
  assert.equal(final.terminal, true); assert.equal(final.status, 'termination_unknown'); assert.equal(final.motionAllowed, false);
  assert.equal(f.projector.ingest(report('late', { runId: 'run-a', phase: 'research', at: NOW + 1 })), null);
  const result = world.project(snapshot({ runs: f.store.list('run'), activities: f.projector.list() }), 'project-a', { now: NOW })[0];
  assert.equal(result.state, 'termination_unknown'); assert.equal(result.motionAllowed, false); assert.equal(result.canAssign, false);
  assert.match(result.label, /Process status unknown/); assert.doesNotMatch(result.label, /Stopped|Checks passed/);
});

test('all terminal/stop states defeat newer same-run reports without inventing completion', () => {
  for (const state of ['passed', 'failed', 'cancelled', 'interrupted', 'timed_out', 'completed', 'stopping', 'termination_unknown']) {
    const result = world.workerState(provider, [report('late', { runId: 'run-a', phase: 'research', at: NOW + 10 })], [run('run-a', { state })], { now: NOW + 10 });
    assert.equal(result.activity, null); assert.equal(result.state, state); assert.equal(result.motionAllowed, false);
    assert.equal(result.historical, !['stopping', 'termination_unknown'].includes(state));
  }
});

test('observed result reaches Review while a later report cannot move a finished attempt', () => {
  const finished = run('run-a', { state: 'passed' });
  const actual = report('observed-final', { runId: 'run-a', phase: 'review', basis: 'observed', origin: 'runtime', terminal: true, status: 'completed' });
  const result = world.workerState(provider, [actual], [finished], { now: NOW });
  assert.equal(result.phase, 'review'); assert.equal(result.facility, 'review');
  assert.equal(result.state, 'passed'); assert.equal(result.historical, true); assert.equal(result.motionAllowed, false);
  assert.match(result.label, /Observed.*Checks passed.*Review/);
  const late = world.workerState(provider, [actual, report('late-final-claim', { runId: 'run-a', phase: 'research', at: NOW + 10 })], [finished], { now: NOW + 10 });
  assert.equal(late.state, 'passed'); assert.equal(late.activity.id, 'observed-final'); assert.equal(late.terminal, true);
  assert.equal(late.facility, 'review', 'late report cannot move the completed Review projection back to another facility');
});

test('an observed-looking activity cannot finish an active or absent run', () => {
  const claim = report('premature-final', { runId: 'run-a', phase: 'review', basis: 'observed', terminal: true, status: 'completed' });
  const active = world.workerState(provider, [claim], [run()], { now: NOW });
  assert.equal(active.state, 'working'); assert.equal(active.terminal, false); assert.equal(active.historical, false);
  assert.doesNotMatch(active.label, /completed|Checks passed/);
  const absent = world.workerState(provider, [{ ...claim, runId: undefined }], [], { now: NOW });
  assert.equal(absent.terminal, false); assert.notEqual(absent.state, 'completed'); assert.equal(absent.motionAllowed, false);
});

test('activity ingestion rejects another worker/session claiming a known run', (t) => {
  const f = fixture(t); f.store.put('run', run('run-a', { sessionId: 'owned-session' }));
  assert.equal(f.projector.ingest(report('wrong-worker', { workerId: 'claude', runId: 'run-a' })), null);
  assert.equal(f.projector.ingest(report('wrong-session', { runId: 'run-a', sessionId: 'someone-else' })), null);
  assert.equal(f.projector.list().length, 0);
  assert(f.projector.ingest(report('right', { runId: 'run-a', sessionId: 'owned-session' })));
});

test('stale, unknown and disconnected snapshots quiet work while retaining honest words', () => {
  const value = snapshot({ runs: [run()], activities: [report('aged', { runId: 'run-a' })] });
  const stale = world.project(value, 'project-a', { now: NOW + 60_001 })[0];
  assert.equal(stale.stale, true); assert.equal(stale.motionAllowed, false); assert.match(stale.label, /Stale/);
  const unknown = world.project({ ...value, activities: [report('unknown-basis', { runId: 'run-a', basis: 'trusted' })] }, 'project-a', { now: NOW })[0];
  assert.equal(unknown.state, 'unknown'); assert.equal(unknown.facility, null); assert.equal(unknown.motionAllowed, false); assert.match(unknown.label, /Basis unknown/);
  const disconnected = world.project(value, 'project-a', { now: NOW, unavailable: true })[0];
  assert.equal(disconnected.state, 'unknown'); assert.equal(disconnected.facility, null); assert.equal(disconnected.canAssign, false);
  assert.match(disconnected.label, /connection unconfirmed/); assert.equal(disconnected.runId, 'run-a');
  const untimed = world.workerState(provider, [], [{ id: 'run-a', projectId: 'project-a', worker: 'codex', state: 'working' }], { now: NOW });
  assert.equal(untimed.state, 'unknown'); assert.equal(untimed.motionAllowed, false); assert.match(untimed.label, /Freshness unknown/);
  const future = world.workerState(provider, [report('future', { runId: 'run-a', at: NOW + 5000 })], [run()], { now: NOW });
  assert.equal(future.state, 'unknown'); assert.equal(future.motionAllowed, false);
});

test('projection does not mutate source, dispatch work, use a DOM, or mint actual workers', () => {
  const before = snapshot({ runs: [run()], activities: [report('one', { runId: 'run-a' })] });
  const encoded = JSON.stringify(before);
  const browser = { window: {}, setTimeout() { assert.fail('projection cannot schedule'); }, fetch() { assert.fail('projection cannot call services'); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/district-world-state.js'), 'utf8'), browser);
  const projected = browser.window.DistrictWorldState.project(before, 'project-a', { now: NOW });
  assert.equal(projected[0].id, 'codex'); assert.equal(projected[0].workerId, 'codex');
  projected[0].message = 'Changed view'; assert.equal(JSON.stringify(before), encoded);
  assert.equal(world.workerId({ id: 'event-id-only' }), '', 'an event ID is never a worker registration');
});
