'use strict';

const KINDS = new Set(['project', 'run', 'checkpoint', 'activity']);
let nextSavepoint = 0;

function kindName(kind) {
  if (!KINDS.has(kind)) throw new TypeError(`Unknown district record kind: ${String(kind)}`);
  return kind;
}

function stringId(id, label = 'Record id') {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError(`${label} must be a nonempty string`);
  return id;
}

function jsonObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object`);
  }
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError(`${label} must be a JSON object`);
  const copy = JSON.parse(json);
  if (copy === null || typeof copy !== 'object' || Array.isArray(copy)) {
    throw new TypeError(`${label} must serialize to a JSON object`);
  }
  return { json, copy };
}

class DistrictStore {
  constructor({ db } = {}) {
    if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
      throw new TypeError('DistrictStore requires a node:sqlite DatabaseSync');
    }
    this.db = db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS district_records (
        kind TEXT NOT NULL CHECK(kind IN ('project', 'run', 'checkpoint', 'activity')),
        id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        PRIMARY KEY(kind, id)
      );
      CREATE TABLE IF NOT EXISTS district_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS district_receipts (
        command_id TEXT PRIMARY KEY NOT NULL,
        receipt_json TEXT NOT NULL
      );
    `);
    this.statements = {
      get: db.prepare('SELECT record_json FROM district_records WHERE kind=? AND id=?'),
      put: db.prepare(`INSERT INTO district_records(kind,id,record_json) VALUES(?,?,?)
        ON CONFLICT(kind,id) DO UPDATE SET record_json=excluded.record_json`),
      list: db.prepare('SELECT record_json FROM district_records WHERE kind=? ORDER BY rowid ASC'),
      remove: db.prepare('DELETE FROM district_records WHERE kind=? AND id=?'),
      appendEvent: db.prepare('INSERT INTO district_events(event_json) VALUES(?)'),
      events: db.prepare('SELECT seq,event_json FROM district_events WHERE seq>? ORDER BY seq ASC LIMIT ?'),
      receipt: db.prepare('SELECT receipt_json FROM district_receipts WHERE command_id=?'),
      saveReceipt: db.prepare('INSERT INTO district_receipts(command_id,receipt_json) VALUES(?,?) ON CONFLICT(command_id) DO NOTHING'),
    };
  }

  get(kind, id) {
    const row = this.statements.get.get(kindName(kind), stringId(id));
    return row ? JSON.parse(row.record_json) : null;
  }

  put(kind, record) {
    kindName(kind);
    const { json, copy } = jsonObject(record, 'Record');
    stringId(copy.id);
    this.statements.put.run(kind, copy.id, json);
    return copy;
  }

  list(kind) {
    return this.statements.list.all(kindName(kind)).map((row) => JSON.parse(row.record_json));
  }

  remove(kind, id) {
    return this.statements.remove.run(kindName(kind), stringId(id)).changes > 0;
  }

  appendEvent(event) {
    const { copy } = jsonObject(event, 'Event');
    // Only SQLite assigns the authoritative cursor, including for replayed input.
    delete copy.seq;
    const result = this.statements.appendEvent.run(JSON.stringify(copy));
    return { ...copy, seq: Number(result.lastInsertRowid) };
  }

  events(since = 0, limit = 500) {
    if (!Number.isSafeInteger(since) || since < 0) throw new TypeError('Event cursor must be a nonnegative safe integer');
    if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('Event limit must be a positive safe integer');
    return this.statements.events.all(since, limit).map((row) => ({ ...JSON.parse(row.event_json), seq: row.seq }));
  }

  receipt(commandId) {
    const row = this.statements.receipt.get(stringId(commandId, 'Command id'));
    return row ? JSON.parse(row.receipt_json) : null;
  }

  saveReceipt(commandId, receipt) {
    stringId(commandId, 'Command id');
    const { json } = jsonObject(receipt, 'Receipt');
    // Acceptance is immutable: a retried command gets the exact original result.
    this.statements.saveReceipt.run(commandId, json);
    return this.receipt(commandId);
  }

  transaction(fn) {
    if (typeof fn !== 'function' || Object.prototype.toString.call(fn) === '[object AsyncFunction]') {
      throw new TypeError('DistrictStore transaction requires a synchronous function');
    }
    // Savepoints compose with both another store transaction and a caller's SQL transaction.
    const name = `district_store_${++nextSavepoint}`;
    this.db.exec(`SAVEPOINT ${name}`);
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        throw new TypeError('DistrictStore transaction cannot return a Promise');
      }
      this.db.exec(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      try {
        this.db.exec(`ROLLBACK TO SAVEPOINT ${name}`);
        this.db.exec(`RELEASE SAVEPOINT ${name}`);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'DistrictStore transaction and rollback failed');
      }
      throw error;
    }
  }
}

module.exports = { DistrictStore };
