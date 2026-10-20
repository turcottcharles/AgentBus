'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('../app/district-world-state');
const provider = { id: 'codex', name: 'Codex', available: true };
const snapshot = (extra = {}) => ({ projects: [{ id: 'p1' }, { id: 'p2' }], providers: [provider], activities: [], runs: [], ...extra });

test('worker state preserves reported, observed and inferred facility semantics without outcome authority', () => {
  for (const basis of ['reported', 'observed', 'inferred']) {
    const result = api.workerState(provider, [{ workerId: 'codex', projectId: 'p1', phase: 'edit', basis, message: 'Saved-looking prose', at: 20, terminal: basis === 'reported', status: 'passed' }], []);
    assert.equal(result.facility, 'build');
    assert.equal(result.basis, basis);
    assert.equal(result.terminal, false);
    assert.equal(typeof result.terminal, 'boolean');
    assert.equal(result.state, 'active');
    assert.doesNotMatch(result.label, /passed/);
  }
  const idle = api.workerState(provider, [], []);
  assert.equal(idle.terminal, false);
  assert.equal(idle.state, 'idle');
  assert.equal(idle.facility, null);
});

test('exact-project projection rejects unlinked/cross-project activity and creates only actual passive workers', () => {
  const value = snapshot({ activities: [
    { workerId: 'codex', projectId: 'p2', phase: 'test', basis: 'observed', at: 99 },
    { workerId: 'codex', phase: 'build', basis: 'reported', at: 100 },
    { id: 'event-not-a-worker', projectId: 'p1', phase: 'research', basis: 'reported', at: 99 },
    { workerId: 'researcher', projectId: 'p1', phase: 'research', basis: 'reported', at: 10 },
  ] });
  assert.deepEqual(api.project(value, ''), []);
  assert.deepEqual(api.project(value, undefined), []);
  assert.deepEqual(api.project(value, 'missing'), []);
  const rows = api.project(value, 'p1');
  assert.deepEqual(rows.map((row) => row.id), ['codex', 'researcher']);
  assert.equal(rows[0].state, 'idle');
  assert.equal(rows[0].facility, null);
  assert.equal(rows[1].facility, 'research');
  assert.match(rows[1].label, /Agent-reported/);
});

test('terminal runs and protected stop states defeat later reports from the same run', () => {
  for (const state of ['passed', 'failed', 'cancelled', 'interrupted', 'timed_out', 'stopping', 'termination_unknown']) {
    const run = { id: 'r1', worker: 'codex', projectId: 'p1', state, updated: 10, detail: 'Actual recorded result' };
    const activity = { workerId: 'codex', projectId: 'p1', runId: 'r1', phase: 'research', basis: 'reported', at: 99, message: 'Still researching' };
    const result = api.workerState(provider, [activity], [run]);
    assert.equal(result.activity, null);
    assert.equal(result.state, state);
    assert.equal(result.basis, 'observed');
    assert.equal(typeof result.terminal, 'boolean');
    assert.equal(result.terminal, !['stopping', 'termination_unknown'].includes(state));
    if (state === 'termination_unknown') assert.equal(result.stale, true);
  }
});

test('stale activity stays stale and phases cannot promote a working run to verified testing', () => {
  const run = { id: 'r1', worker: 'codex', projectId: 'p1', state: 'working', updated: 10 };
  const activity = { workerId: 'codex', runId: 'r1', projectId: 'p1', phase: 'test', basis: 'reported', freshness: 'stale', at: 20, message: 'All checks passed' };
  const direct = api.workerState(provider, [activity], [run]);
  const projected = api.project(snapshot({ activities: [activity], runs: [run] }), 'p1')[0];
  assert.equal(direct.state, 'working');
  assert.equal(direct.stale, true);
  assert.equal(direct.terminal, false);
  assert.equal(direct.facility, 'test');
  assert.match(direct.label, /Agent-reported.*Stale/);
  for (const key of ['facility', 'phase', 'basis', 'state', 'stale', 'label', 'message', 'terminal']) assert.equal(projected[key], direct[key]);
});

test('projection is bounded, does not mutate snapshots, and completed passive participants match management filtering', () => {
  const value = snapshot({ activities: Array.from({ length: 60 }, (_, index) => ({ workerId: 'worker-' + index, projectId: 'p1', phase: 'research', basis: 'reported', at: index + 1, message: 'x'.repeat(1000) })),
    runs: [{ id: 'done', worker: 'finished-helper', projectId: 'p1', state: 'passed', updated: 100 }] });
  const before = JSON.stringify(value);
  const result = api.project(value, 'p1');
  assert.equal(result.length, 32);
  assert.ok(result.every((row) => row.id.length <= 160 && row.message.length <= 180 && row.label.length <= 180 && typeof row.terminal === 'boolean'));
  result[0].message = 'Changed display only';
  assert.equal(JSON.stringify(value), before);
  const terminalOnly = api.project(snapshot({ runs: [{ id: 'done', worker: 'finished-helper', projectId: 'p1', state: 'passed', updated: 100 }] }), 'p1');
  assert.deepEqual(terminalOnly.map((row) => row.id), ['codex']);
});

test('browser UMD exposes the same pure API without commands, timers or a DOM', () => {
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/district-world-state.js'), 'utf8'), browser);
  assert.equal(typeof browser.window.DistrictWorldState.workerState, 'function');
  const result = browser.window.DistrictWorldState.project(snapshot(), 'p1');
  assert.equal(result.length, 1);
  assert.equal(result[0].state, 'idle');
  assert.equal(browser.window.DistrictWorldState.MAX_WORKERS, 32);
});
