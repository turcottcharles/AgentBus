'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { projectAttention } = require('../app/district-attention');

const project = (id, extra = {}) => ({ id, name: `Project ${id}`, created: 1, manifest: { hash: `hash-${id}` }, ...extra });
const run = (projectId, id, state, extra = {}) => ({ projectId, id, state, worker: 'codex', created: 100, updated: 120, ...extra });
const activity = (projectId, extra = {}) => ({ projectId, id: `activity-${projectId}`, eventId: `event-${projectId}`,
  workerId: 'claude', sessionId: 'session', phase: 'waiting', status: 'waiting', basis: 'reported', at: 130, ...extra });
const deepFreeze = value => { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; };

test('seven concurrent projects retain distinct attention despite shared worker and run IDs', () => {
  const states = ['failed', 'termination_unknown', 'waiting', 'passed', 'timed_out', 'queued', 'interrupted'];
  const snapshot = { projects: states.map((_, index) => project(`p${index}`)),
    runs: states.map((state, index) => run(`p${index}`, 'same-run-id', state, { sessionId: `s${index}` })) };
  const result = projectAttention(snapshot, ['p0']);
  assert.equal(result.length, 7);
  assert.equal(new Set(result.map(entry => entry.projectId)).size, 7);
  assert.equal(new Set(result.map(entry => entry.id)).size, 7);
  for (const entry of result) {
    assert.equal(entry.id, entry.key); assert.equal(entry.runId, 'same-run-id');
    assert.equal(entry.workerId, 'codex'); assert.equal(entry.basis, 'observed');
    assert.equal(entry.evidence.runId, entry.runId); assert.equal(entry.evidence.sessionId, entry.sessionId);
    assert.equal(entry.state, states[Number(entry.projectId.slice(1))]);
  }
  assert.equal(result.find(entry => entry.projectId === 'p3').kind, 'completed');
  assert.equal(result.find(entry => entry.projectId === 'p1').kind, 'unknown');
});

test('deduplicates repeated run snapshots and terminal activity without reopening completed work', () => {
  const done = run('a', 'r', 'passed', { finished: 200, artifact: { candidateHash: 'hash-a' }, source: { hash: 'hash-a' } });
  const snapshot = { projects: [project('a')], runs: [run('a', 'r', 'testing'), done, { ...done }, run('a', 'r', 'working', { updated: 9999 })], activities: [
    activity('a', { runId: 'r', terminal: true, basis: 'observed', status: 'completed', phase: 'review', at: 210 }),
    activity('a', { runId: 'r', phase: 'waiting', status: 'waiting', at: 900, message: 'Late agent report' })] };
  const result = projectAttention(snapshot, []);
  assert.equal(result.length, 1); assert.equal(result[0].state, 'passed'); assert.equal(result[0].kind, 'completed');
  assert.deepEqual(projectAttention({ ...snapshot, runs: [...snapshot.runs].reverse(), activities: [...snapshot.activities].reverse() }, []), result);
});

test('observed terminal activity fences late reports across sessions when run history is absent', () => {
  const snapshot = { projects: [project('a')], activities: [
    activity('a', { id: 'terminal', eventId: 'terminal', runId: 'external-r', attemptId: 'attempt',
      basis: 'observed', terminal: true, status: 'completed', phase: 'review', at: 20 }),
    activity('a', { id: 'late', eventId: 'late', runId: 'external-r', attemptId: 'attempt', sessionId: 'changed-session',
      phase: 'waiting', status: 'waiting', at: 9999 })] };
  const entries = projectAttention(snapshot);
  assert.equal(entries.length, 1); assert.equal(entries[0].state, 'completed'); assert.equal(entries[0].evidence.eventId, 'terminal');
});

test('earlier and source-changed results stay inspectable, historical, and non-actionable', () => {
  const snapshot = { projects: [project('a')], runs: [
    run('a', 'old', 'passed', { created: 10, finished: 100, source: { hash: 'hash-a' }, artifact: { candidateHash: 'hash-a' } }),
    run('a', 'latest', 'passed', { created: 200, updated: 220, source: { hash: 'previous-hash' }, artifact: { candidateHash: 'previous-hash' } })] };
  const result = projectAttention(snapshot, ['a']);
  assert.equal(result.length, 2);
  for (const entry of result) { assert.equal(entry.historical, true); assert.equal(entry.actionable, false); assert.match(entry.label, /Earlier result/); }
  const changed = result.find(entry => entry.runId === 'latest');
  assert.equal(changed.stale, true); assert.match(changed.label, /Source changed/);
  assert.equal(changed.evidence.candidateHash, 'previous-hash'); assert.equal(changed.evidence.sourceHash, 'previous-hash');
  assert.equal(result.find(entry => entry.runId === 'old').stale, false, 'old outcome is not falsely relabeled stale by a wall clock');
});

test('candidate/source identity disagreement cannot present a current checked result', () => {
  const result = projectAttention({ projects: [project('a')], runs: [run('a', 'r', 'passed', {
    source: { hash: 'hash-a' }, artifact: { candidateHash: 'different-artifact' } })] });
  assert.equal(result[0].stale, true); assert.equal(result[0].historical, true);
  assert.equal(result[0].evidence.candidateHash, 'different-artifact');
});

test('unselected actionable projects lead without pretending selection is a read receipt', () => {
  const snapshot = { projects: ['a', 'b', 'c'].map(id => project(id)), runs: [
    run('a', 'ra', 'failed', { updated: 900 }), run('b', 'rb', 'failed', { updated: 100 }),
    run('c', 'rc', 'passed', { updated: 1000, unread: true })] };
  const entries = projectAttention(snapshot, ['a']);
  assert.deepEqual(entries.map(entry => entry.projectId), ['b', 'a', 'c']);
  assert.equal(entries.find(entry => entry.projectId === 'a').unseen, null);
  assert.equal(entries.find(entry => entry.projectId === 'b').unseen, null);
  const aKey = entries.find(entry => entry.projectId === 'a').key;
  const bKey = entries.find(entry => entry.projectId === 'b').key;
  const acknowledged = projectAttention({ ...snapshot, attentionSeenIds: [bKey] }, ['a']);
  assert.equal(acknowledged[0].key, aKey, 'explicit unseen action beats an acknowledged unselected action');
  assert.equal(acknowledged.find(entry => entry.key === bKey).unseen, false);
  assert.equal(projectAttention(snapshot, ['b']).find(entry => entry.key === bKey).unseen, null);
});

test('agent completion claims and forged evidence cannot establish completion', () => {
  const snapshot = { projects: [project('a')], activities: [
    activity('a', { id: 'forged', eventId: 'forged', runId: 'external', phase: 'idle', status: 'completed', terminal: true,
      evidence: { state: 'passed', verified: true, command: 'run', candidateHash: 'claimed-hash' } })] };
  assert.deepEqual(projectAttention(snapshot), []);
  const observed = projectAttention({ ...snapshot, activities: [{ ...snapshot.activities[0], basis: 'observed' }] });
  assert.equal(observed.length, 1); assert.equal(observed[0].kind, 'completed'); assert.equal(observed[0].basis, 'observed');
  assert.equal(Object.hasOwn(observed[0].evidence, 'verified'), false); assert.equal(Object.hasOwn(observed[0].evidence, 'command'), false);
  assert.deepEqual(projectAttention({ ...snapshot, activities: [{ ...snapshot.activities[0], basis: 'observed', runId: undefined }] }), []);
});

test('reported errors retain report basis and state rather than mutating the live run verdict', () => {
  const snapshot = { projects: [project('a')], runs: [run('a', 'r', 'working')], activities: [
    activity('a', { runId: 'r', phase: 'error', status: 'error', message: 'Quota needs attention' })] };
  const entry = projectAttention(snapshot)[0];
  assert.equal(entry.kind, 'failed'); assert.equal(entry.state, 'error'); assert.equal(entry.basis, 'reported');
  assert.match(entry.label, /Agent-reported/); assert.equal(snapshot.runs[0].state, 'working');
});

test('correlation is explicit and a foreign project run cannot be borrowed', () => {
  const result = projectAttention({ projects: [project('a'), project('b')], runs: [run('a', 'run-a', 'working')], activities: [
    activity('b', { runId: 'run-a' }), activity(undefined, { workerId: 'codex' }),
    activity('missing'), activity('b', { id: 'own-event', eventId: 'own', runId: 'external-b', attemptId: 'attempt-b' })] });
  assert.equal(result.length, 1); assert.equal(result[0].projectId, 'b'); assert.equal(result[0].runId, 'external-b');
  assert.equal(result[0].evidence.attemptId, 'attempt-b');
});

test('stale activity stays unknown and cannot override a newer authoritative observation', () => {
  const snapshot = { projects: [project('a'), project('b')], runs: [run('a', 'r', 'testing', { updated: 300 })], activities: [
    activity('a', { runId: 'r', phase: 'research', status: 'stale', stale: true, at: 200 }),
    activity('b', { phase: 'edit', status: 'stale', stale: true, freshness: 'stale', at: 200 })] };
  const result = projectAttention(snapshot);
  assert.equal(result.length, 1); assert.equal(result[0].projectId, 'b'); assert.equal(result[0].kind, 'unknown');
  assert.equal(result[0].stale, true); assert.equal(result[0].basis, 'reported');
  const readFailure = projectAttention({ ...snapshot, stale: true });
  const active = readFailure.find(entry => entry.runId === 'r');
  assert.equal(active.kind, 'unknown'); assert.equal(active.state, 'testing'); assert.equal(active.stale, true);
  assert.equal(active.historical, true); assert.equal(active.actionable, false);
});

test('latest activity per scope wins deterministically while distinct projects remain independent', () => {
  const old = activity('a', { id: 'old', eventId: 'old', at: 10 });
  const fresh = activity('a', { id: 'new', eventId: 'new', phase: 'error', status: 'error', at: 20 });
  const tieReported = activity('b', { basis: 'reported', at: 50 });
  const tieObserved = activity('b', { basis: 'observed', phase: 'error', status: 'error', at: 50 });
  const snapshot = { projects: [project('a'), project('b')], activities: [old, fresh, fresh, tieReported, tieObserved] };
  const result = projectAttention(snapshot);
  assert.equal(result.length, 2); assert.equal(result.find(entry => entry.projectId === 'a').evidence.eventId, 'new');
  assert.equal(result.find(entry => entry.projectId === 'b').basis, 'observed');
  assert.deepEqual(projectAttention({ ...snapshot, activities: [...snapshot.activities].reverse() }), result);
});

test('unavailable project files stay actionable independent of earlier project timestamps', () => {
  const result = projectAttention({ projects: [project('a', { unavailable: true, error: 'Managed source is unreadable' })],
    runs: [run('a', 'latest', 'passed', { created: 900 })] });
  const unavailable = result.find(entry => entry.state === 'unavailable');
  assert.equal(unavailable.kind, 'unknown'); assert.equal(unavailable.actionable, true); assert.equal(unavailable.historical, false);
  assert.equal(unavailable.at, null, 'file failure time remains unknown if snapshot provides no observation timestamp');
  assert.equal(unavailable.detail, 'Managed source is unreadable');
});

test('projection is repeatable, immutable, bounded in display text and has no command capability', () => {
  const snapshot = deepFreeze({ projects: [project('a')], runs: [run('a', 'r', 'failed', { detail: '<img onerror=send()>\u0000' + 'x'.repeat(1000) })] });
  const selected = Object.freeze(['a']);
  const first = projectAttention(snapshot, selected), second = projectAttention(snapshot, selected);
  assert.deepEqual(first, second); assert(first[0].detail.length <= 350); assert(!first[0].detail.includes('\u0000'));
  first[0].evidence.runId = 'changed-output'; assert.equal(snapshot.runs[0].id, 'r');
  assert.deepEqual(projectAttention(null), []); assert.deepEqual(projectAttention({ projects: [null, 2, {}], runs: [null] }), []);
  assert.deepEqual(Object.keys(require('../app/district-attention')), ['projectAttention']);
});

test('browser UMD has the identical pure projection with no timers, storage or provider APIs', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/district-attention.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: 'district-attention.js', timeout: 1000 });
  const snapshot = { projects: [project('a')], runs: [run('a', 'r', 'failed')] };
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.DistrictAttention.projectAttention(snapshot, []))), projectAttention(snapshot, []));
  assert.deepEqual(Object.keys(sandbox.window), ['DistrictAttention']);
});
