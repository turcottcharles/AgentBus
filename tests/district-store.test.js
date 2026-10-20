'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DistrictStore } = require('../app/district/store');

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  const store = new DistrictStore({ db });
  t.after(() => db.close());
  return { db, store };
}

test('district records round-trip additive JSON, isolate kinds and never share mutable references', (t) => {
  const { store } = fixture(t);
  const project = { id: 'same', name: 'Checklist', extra: { choices: ['teal'], optional: null } };
  const returned = store.put('project', project);
  project.extra.choices.push('changed after write');
  returned.extra.choices.push('changed return');
  store.put('run', { id: 'same', state: 'assigned' });
  store.put('checkpoint', { id: 'checkpoint', files: {} });
  store.put('activity', { id: 'activity', sourceSeq: { provider: 3 } });
  assert.deepEqual(store.get('project', 'same'), { id: 'same', name: 'Checklist', extra: { choices: ['teal'], optional: null } });
  const fetched = store.get('project', 'same');
  fetched.extra.choices.length = 0;
  assert.equal(store.get('project', 'same').extra.choices.length, 1);
  assert.equal(store.get('run', 'same').state, 'assigned');
  assert.equal(store.list('checkpoint').length, 1);
  assert.equal(store.list('activity')[0].sourceSeq.provider, 3);
  assert.equal(store.get('project', 'missing'), null);
  assert.equal(store.remove('project', 'same'), true);
  assert.equal(store.remove('project', 'same'), false);
  assert.equal(store.get('run', 'same').state, 'assigned');
});

test('updates retain deterministic insertion order and replacement removes old fields', (t) => {
  const { store } = fixture(t);
  store.put('run', { id: 'z', state: 'assigned', obsolete: true });
  store.put('run', { id: 'a', state: 'assigned' });
  store.put('run', { id: 'z', state: 'passed' });
  assert.deepEqual(store.list('run'), [{ id: 'z', state: 'passed' }, { id: 'a', state: 'assigned' }]);
});

test('events use database sequence across kinds, override supplied sequence and page in commit order', (t) => {
  const { store } = fixture(t);
  const first = store.appendEvent({ id: 'event-1', type: 'assigned', seq: 999, evidence: { checks: [] } });
  const second = store.appendEvent({ id: 'event-2', type: 'tool_started' });
  const third = store.appendEvent({ id: 'event-3', type: 'passed' });
  first.evidence.checks.push('not persisted');
  assert.deepEqual([first.seq, second.seq, third.seq], [1, 2, 3]);
  assert.deepEqual(store.events(1, 1), [second]);
  assert.deepEqual(store.events(2), [third]);
  assert.deepEqual(store.events(900), []);
  assert.deepEqual(store.events()[0].evidence.checks, []);
});

test('idempotent command replay returns original receipt and does not append or repeat work', (t) => {
  const { store } = fixture(t);
  let launches = 0;
  function command(id) {
    return store.transaction(() => {
      const receipt = store.receipt(id);
      if (receipt) return receipt;
      store.put('run', { id: 'run-1', state: 'assigned' });
      const event = store.appendEvent({ type: 'run.assigned', runId: 'run-1' });
      launches += 1;
      return store.saveReceipt(id, { id, status: 'accepted', runId: 'run-1', seq: event.seq });
    });
  }
  const original = command('command-1');
  assert.deepEqual(command('command-1'), original);
  assert.deepEqual(store.saveReceipt('command-1', { id: 'command-1', status: 'completed', result: 'wrong retry' }), original);
  original.status = 'mutated outside store';
  assert.equal(store.receipt('command-1').status, 'accepted');
  assert.equal(store.events().length, 1);
  assert.equal(launches, 1);
  assert.equal(store.receipt('absent'), null);
});

test('failed event persistence rolls back record, event and receipt together', (t) => {
  const { db, store } = fixture(t);
  db.exec(`CREATE TRIGGER district_fixture_fail BEFORE INSERT ON district_events
    WHEN json_extract(NEW.event_json, '$.type') = 'planted_failure'
    BEGIN SELECT RAISE(ABORT, 'planted event storage failure'); END`);
  function persist(type) {
    return store.transaction(() => {
      store.put('run', { id: 'run-atomic', state: 'passed' });
      store.saveReceipt('atomic-command', { id: 'atomic-command', status: 'completed' });
      return store.appendEvent({ type, runId: 'run-atomic' });
    });
  }
  assert.throws(() => persist('planted_failure'), /planted event storage failure/);
  assert.equal(store.get('run', 'run-atomic'), null);
  assert.equal(store.receipt('atomic-command'), null);
  assert.deepEqual(store.events(), []);
  const restored = persist('run.passed');
  assert.equal(restored.type, 'run.passed');
  assert.equal(store.receipt('atomic-command').status, 'completed');
  assert.equal(store.get('run', 'run-atomic').state, 'passed');
});

test('nested failures roll back their savepoint and outer failure rolls back released inner work', (t) => {
  const { db, store } = fixture(t);
  store.transaction(() => {
    store.put('project', { id: 'outer' });
    assert.throws(() => store.transaction(() => {
      store.put('run', { id: 'inner' });
      store.appendEvent({ type: 'inner' });
      throw new Error('inner failure');
    }), /inner failure/);
    store.appendEvent({ type: 'outer' });
  });
  assert.equal(store.get('run', 'inner'), null);
  assert.deepEqual(store.events().map((event) => event.type), ['outer']);
  assert.throws(() => store.transaction(() => {
    store.transaction(() => store.put('activity', { id: 'released-inner' }));
    throw new Error('outer failure');
  }), /outer failure/);
  assert.equal(store.get('activity', 'released-inner'), null);
  db.exec('BEGIN');
  store.transaction(() => store.put('checkpoint', { id: 'external-transaction' }));
  db.exec('ROLLBACK');
  assert.equal(store.get('checkpoint', 'external-transaction'), null);
  assert.equal(store.transaction(() => 42), 42);
});

test('transactions reject asynchronous callbacks and Promise results without committing partial writes', (t) => {
  const { store } = fixture(t);
  let called = false;
  assert.throws(() => store.transaction(async () => { called = true; }), /synchronous/);
  assert.equal(called, false);
  assert.throws(() => store.transaction(() => {
    store.put('run', { id: 'async-result' });
    return Promise.resolve('cannot commit');
  }), /Promise/);
  assert.equal(store.get('run', 'async-result'), null);
});

test('records, events and immutable receipts survive reopen and global ordering spans connections', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-store-'));
  const file = path.join(dir, 'state.sqlite');
  const open = [];
  t.after(() => {
    for (const db of open) db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const db1 = new DatabaseSync(file); open.push(db1);
  const first = new DistrictStore({ db: db1 });
  first.transaction(() => {
    first.put('project', { id: 'persisted', name: 'Persistent district' });
    first.appendEvent({ type: 'first' });
    first.saveReceipt('persisted-command', { status: 'accepted', projectId: 'persisted' });
  });
  const db2 = new DatabaseSync(file); open.push(db2);
  const second = new DistrictStore({ db: db2 });
  assert.equal(second.get('project', 'persisted').name, 'Persistent district');
  assert.equal(second.appendEvent({ type: 'second' }).seq, 2);
  assert.equal(first.appendEvent({ type: 'third' }).seq, 3);
  assert.deepEqual(second.saveReceipt('persisted-command', { status: 'rejected' }), { status: 'accepted', projectId: 'persisted' });
  assert.deepEqual(first.events().map((event) => event.seq), [1, 2, 3]);
  db1.close(); open.splice(open.indexOf(db1), 1);
  db2.close(); open.splice(open.indexOf(db2), 1);
  const db3 = new DatabaseSync(file); open.push(db3);
  const reopened = new DistrictStore({ db: db3 });
  assert.equal(reopened.get('project', 'persisted').name, 'Persistent district');
  assert.equal(reopened.receipt('persisted-command').status, 'accepted');
  assert.equal(reopened.appendEvent({ type: 'after-reopen' }).seq, 4);
  assert.deepEqual(reopened.events().map((event) => event.type), ['first', 'second', 'third', 'after-reopen']);
});

test('store creates only district tables and preserves existing Agent Bus schema and data', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(require('../app/schema'));
  db.prepare('INSERT INTO agents(name,kind,note) VALUES(?,?,?)').run('existing-agent', 'codex', 'preserve');
  const schema = db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const store = new DistrictStore({ db });
  store.put('project', { id: 'new-project' });
  const after = db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE 'district_%' ORDER BY name").all();
  assert.deepEqual(after, schema);
  assert.equal(db.prepare('SELECT note FROM agents WHERE name=?').get('existing-agent').note, 'preserve');
});

test('invalid kinds, identifiers, non-JSON values and cursors fail without writing data', (t) => {
  const { store } = fixture(t);
  assert.throws(() => new DistrictStore(), /DatabaseSync/);
  for (const kind of ['agents', 'constructor', 'project; DROP TABLE agents', null]) {
    assert.throws(() => store.put(kind, { id: 'x' }), /kind/);
    assert.throws(() => store.get(kind, 'x'), /kind/);
    assert.throws(() => store.list(kind), /kind/);
    assert.throws(() => store.remove(kind, 'x'), /kind/);
  }
  for (const record of [{}, { id: 1 }, { id: '' }, [], null]) assert.throws(() => store.put('project', record), /id|JSON object/);
  for (const value of [[], null, 'text', 4]) {
    assert.throws(() => store.appendEvent(value), /JSON object/);
    assert.throws(() => store.saveReceipt('invalid', value), /JSON object/);
  }
  const cycle = { id: 'cycle' }; cycle.self = cycle;
  assert.throws(() => store.put('project', cycle), /circular/i);
  assert.throws(() => store.put('project', { id: 'big', value: 1n }), /BigInt/i);
  assert.throws(() => store.receipt(''), /Command id/);
  assert.throws(() => store.events(-1), /cursor/);
  assert.throws(() => store.events(1.5), /cursor/);
  assert.throws(() => store.events(0, 0), /limit/);
  assert.throws(() => store.events(0, Infinity), /limit/);
  assert.deepEqual(store.list('project'), []);
  assert.deepEqual(store.events(), []);
});
