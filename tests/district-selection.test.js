'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const selection = require('../app/district-selection');

const ids = Object.freeze(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);

test('selection creates a first available selection and supports array/full-state initial values', () => {
  assert.deepEqual(selection.create([]), { selectedIds: [], focusedId: null, anchorId: null });
  assert.deepEqual(selection.create(ids), { selectedIds: ['alpha'], focusedId: 'alpha', anchorId: 'alpha' });
  assert.deepEqual(selection.create(ids, ['delta', 'beta', 'delta', 'gone']), {
    selectedIds: ['beta', 'delta'], focusedId: 'beta', anchorId: 'beta',
  });
  assert.deepEqual(selection.create(ids, { selectedIds: ['gamma', 'beta'], focusedId: 'gamma', anchorId: 'beta' }), {
    selectedIds: ['beta', 'gamma'], focusedId: 'gamma', anchorId: 'beta',
  });
});

test('plain click selects exactly one and resets focus and range anchor', () => {
  const many = selection.create(ids, ['alpha', 'gamma', 'epsilon']);
  assert.deepEqual(selection.click(many, 'delta', ids), { selectedIds: ['delta'], focusedId: 'delta', anchorId: 'delta' });
});

test('Ctrl and Meta toggle selections in displayed order and retain at least one', () => {
  let state = selection.create(ids, ['delta']);
  state = selection.click(state, 'beta', ids, { ctrlKey: true });
  assert.deepEqual(state, { selectedIds: ['beta', 'delta'], focusedId: 'beta', anchorId: 'beta' });
  state = selection.click(state, 'delta', ids, { metaKey: true });
  assert.deepEqual(state, { selectedIds: ['beta'], focusedId: 'delta', anchorId: 'delta' });
  state = selection.click(state, 'beta', ids, { ctrlKey: true });
  assert.deepEqual(state, { selectedIds: ['beta'], focusedId: 'beta', anchorId: 'beta' });
});

test('explicit toggle has the same accessible behavior without requiring modifier keys', () => {
  let state = selection.create(ids, ['gamma']);
  state = selection.toggle(state, 'alpha', ids);
  assert.deepEqual(state.selectedIds, ['alpha', 'gamma']);
  state = selection.toggle(state, 'gamma', ids);
  assert.deepEqual(state.selectedIds, ['alpha']);
  assert.deepEqual(selection.toggle(state, 'alpha', ids).selectedIds, ['alpha']);
});

test('Shift selects a contiguous forward or reverse range from a stable anchor', () => {
  const start = selection.create(ids, ['beta']);
  const forward = selection.click(start, 'epsilon', ids, { shiftKey: true });
  assert.deepEqual(forward, { selectedIds: ['beta', 'gamma', 'delta', 'epsilon'], focusedId: 'epsilon', anchorId: 'beta' });
  const reverse = selection.click(forward, 'alpha', ids, { shiftKey: true });
  assert.deepEqual(reverse, { selectedIds: ['alpha', 'beta'], focusedId: 'alpha', anchorId: 'beta' });
});

test('Ctrl/Meta plus Shift adds a contiguous range without dropping prior selections', () => {
  const start = selection.create(ids, { selectedIds: ['alpha', 'delta'], focusedId: 'delta', anchorId: 'delta' });
  for (const modifier of ['ctrlKey', 'metaKey']) {
    assert.deepEqual(selection.click(start, 'beta', ids, { shiftKey: true, [modifier]: true }), {
      selectedIds: ['alpha', 'beta', 'gamma', 'delta'], focusedId: 'beta', anchorId: 'delta',
    });
  }
});

test('roving focus preserves selection and anchor, including an unselected focused tab', () => {
  const start = selection.create(ids, ['beta', 'delta']);
  const focused = selection.focus(start, 'epsilon', ids);
  assert.deepEqual(focused, { selectedIds: ['beta', 'delta'], focusedId: 'epsilon', anchorId: 'beta' });
  assert.deepEqual(selection.click(focused, 'delta', ids, { shiftKey: true }), {
    selectedIds: ['beta', 'gamma', 'delta'], focusedId: 'delta', anchorId: 'beta',
  });
});

test('reconcile removes gone ids, follows new order and preserves available focus and anchor', () => {
  const start = selection.create(ids, { selectedIds: ['beta', 'delta'], focusedId: 'gamma', anchorId: 'delta' });
  assert.deepEqual(selection.reconcile(start, ['delta', 'gamma', 'alpha']), {
    selectedIds: ['delta'], focusedId: 'gamma', anchorId: 'delta',
  });
  assert.deepEqual(selection.reconcile(start, ['epsilon', 'gamma']), {
    selectedIds: ['gamma'], focusedId: 'gamma', anchorId: 'gamma',
  });
  assert.deepEqual(selection.reconcile(start, ['epsilon']), {
    selectedIds: ['epsilon'], focusedId: 'epsilon', anchorId: 'epsilon',
  });
  assert.deepEqual(selection.reconcile(start, []), { selectedIds: [], focusedId: null, anchorId: null });
});

test('unknown ids and malformed option values cannot create phantom selections', () => {
  const start = selection.create(ids, ['beta']);
  assert.deepEqual(selection.click(start, 'gone', ids, { shiftKey: true }), start);
  assert.deepEqual(selection.toggle(start, 'gone', ids), start);
  assert.deepEqual(selection.focus(start, 'gone', ids), start);
  assert.deepEqual(selection.create([null, '', ' ', 'beta', 'beta', 3, 'alpha', 'bad\0id']), {
    selectedIds: ['beta'], focusedId: 'beta', anchorId: 'beta',
  });
  assert.deepEqual(selection.create(null), { selectedIds: [], focusedId: null, anchorId: null });
});

test('all interactions are pure and returned snapshots cannot be mutated accidentally', () => {
  const initial = Object.freeze({ selectedIds: Object.freeze(['delta', 'beta']), focusedId: 'delta', anchorId: 'beta' });
  const before = JSON.stringify(initial);
  const result = selection.click(initial, 'epsilon', ids, { shiftKey: true });
  selection.toggle(initial, 'beta', ids); selection.focus(initial, 'alpha', ids); selection.reconcile(initial, ['beta']);
  assert.equal(JSON.stringify(initial), before); assert.deepEqual(ids, ['alpha', 'beta', 'gamma', 'delta', 'epsilon']);
  assert(Object.isFrozen(result)); assert(Object.isFrozen(result.selectedIds));
  assert.throws(() => { result.selectedIds.push('alpha'); }, TypeError);
});

test('persistence is a caller-owned versioned string containing only selection state', () => {
  const state = selection.create(ids, { selectedIds: ['beta', 'epsilon'], focusedId: 'delta', anchorId: 'beta' });
  const serialized = selection.serialize({ ...state, token: 'DO-NOT-PERSIST', connection: { token: 'SECRET' }, project: { root: 'private-path' } });
  assert.deepEqual(JSON.parse(serialized), { version: 1, selectedIds: ['beta', 'epsilon'], focusedId: 'delta', anchorId: 'beta' });
  assert.doesNotMatch(serialized, /SECRET|PERSIST|private-path|connection/);
  assert.deepEqual(selection.deserialize(serialized, ids), state);
  assert.deepEqual(selection.deserialize(serialized, ['epsilon', 'delta']), {
    selectedIds: ['epsilon'], focusedId: 'delta', anchorId: 'delta',
  });
});

test('invalid, unknown-version and damaged saved state safely falls back to available tabs', () => {
  const expected = selection.create(ids);
  for (const value of [null, '', '{broken', 'null', '[]', '{}', '{"version":99,"selectedIds":["epsilon"]}', 'x'.repeat(1024 * 1024 + 1)]) {
    assert.deepEqual(selection.deserialize(value, ids), expected);
  }
  assert.deepEqual(selection.deserialize('{"version":1,"selectedIds":["gone"],"focusedId":"gone"}', ids), expected);
});

test('browser UMD installs only the shared helper without touching storage or dispatching work', () => {
  const file = path.join(__dirname, '..', 'app', 'district-selection.js');
  const source = fs.readFileSync(file, 'utf8');
  const browser = {};
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('Storage is caller-owned.'); } });
  Object.defineProperty(browser, 'bus', { get() { throw new Error('Selection cannot dispatch commands.'); } });
  const context = vm.createContext({ window: browser });
  vm.runInContext(source, context, { timeout: 1000 });
  assert.equal(typeof browser.DistrictSelection.click, 'function');
  const state = browser.DistrictSelection.click(browser.DistrictSelection.create(['a', 'b']), 'b', ['a', 'b'], { ctrlKey: true });
  assert.deepEqual(JSON.parse(JSON.stringify(state)), { selectedIds: ['a', 'b'], focusedId: 'b', anchorId: 'b' });
  assert.deepEqual(Object.keys(browser), ['DistrictSelection']);
});
