'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { create, suggest } = require('../app/district-continuation');
const tick = () => new Promise(resolve => setImmediate(resolve));
function context(patch = {}) {
  return { projectId: 'p1', enabled: true, busy: false, available: true, worker: 'claude', draft: 'Make a timer', currentHash: 'hash',
    run: { id: 'r1', projectId: 'p1', worker: 'claude', instruction: 'Make a timer', state: 'passed', source: { hash: 'hash' }, checks: [{ name: 'Build', state: 'passed' }] }, ...patch };
}
function fixture(send = async () => ({ runId: 'next' })) {
  let sequence = 0;
  const timers = new Map(), sent = [];
  const controller = create({ send: async s => { sent.push(s); return send(s); },
    schedule(fn) { timers.set(++sequence, fn); return sequence; }, cancel(id) { timers.delete(id); } });
  return { controller, timers, sent, async fire() { const entries = [...timers]; timers.clear(); for (const [, fn] of entries) await fn(); await tick(); } };
}
test('suggestions preserve the request across brands and never equate checks with goal completion', () => {
  for (const worker of ['claude', 'codex', 'future-provider']) {
    const c = context(); c.run.worker = worker;
    const s = suggest(c);
    assert.equal(s.worker, worker); assert.equal(s.autoAllowed, true);
    assert.match(s.prompt, /Make a timer/); assert.match(s.prompt, /Do not invent features/);
    assert.match(s.prompt, /does not prove the whole request is complete/);
  }
});
test('automatic continuation is off until armed, bounded, and once per terminal run', async () => {
  const f = fixture(); f.controller.update(context()); assert.equal(f.timers.size, 0);
  f.controller.arm(1); assert.equal(f.timers.size, 1);
  f.controller.update(context()); assert.equal(f.timers.size, 1);
  await f.fire(); assert.equal(f.sent.length, 1); assert.equal(f.controller.view().remaining, 0);
  f.controller.update(context()); f.controller.arm(1); await f.fire();
  assert.equal(f.sent.length, 1, 'rearming cannot duplicate an already dispatched terminal run');
});
test('successive runs keep the original goal and stop at the chosen reply count', async () => {
  const f = fixture(); const c = context(); f.controller.update(c); f.controller.arm(3);
  for (let i = 0; i < 4; i++) {
    f.controller.update({ ...c, run: { ...c.run, id: 'r' + (i + 1), instruction: i ? 'Generated continuation that must not become the goal' : c.run.instruction } });
    await f.fire();
  }
  assert.equal(f.sent.length, 3);
  for (const s of f.sent) { assert.match(s.prompt, /Make a timer/); assert.doesNotMatch(s.prompt, /Generated continuation/); }
});
test('new active work cancels a queued reply; terminal completion can then queue it', async () => {
  const f = fixture(), c = context(); f.controller.update(c); f.controller.arm(2);
  f.controller.update({ ...c, busy: true, run: { ...c.run, id: 'r2', state: 'working' } });
  assert.equal(f.timers.size, 0);
  f.controller.update({ ...c, run: { ...c.run, id: 'r2' } }); await f.fire(); assert.equal(f.sent.length, 1);
});
test('project changes, edited drafts, hidden views, offline providers and stale state stop automatic replies', async () => {
  for (const patch of [{ projectId: 'p2' }, { draft: 'A different request' }, { enabled: false }, { available: false }, { worker: 'codex' }, { currentHash: 'other' }]) {
    const f = fixture(); f.controller.update(context()); f.controller.arm(3); f.controller.update(context(patch)); await f.fire();
    assert.equal(f.sent.length, 0); assert.equal(f.controller.view().remaining, 0);
  }
});
test('cancelled, interrupted, unknown termination, quota and no-edit exits never auto retry', async () => {
  const c = context();
  for (const patch of [{ state: 'cancelled' }, { state: 'interrupted' }, { state: 'termination_unknown' }, { state: 'failed', providerError: 'quota', checks: [] }, { state: 'failed', detail: 'No observed saved source change', checks: [] }]) {
    const f = fixture(); f.controller.update(c); f.controller.arm(3);
    f.controller.update({ ...c, run: { ...c.run, ...patch } }); await f.fire(); assert.equal(f.sent.length, 0); assert.equal(f.controller.view().remaining, 0);
  }
});
test('observed check failures propose a focused repair, without executing diagnostic text', () => {
  const c = context(); c.run.state = 'failed'; c.run.checks = [{ name: 'Build', state: 'failed', detail: 'missing module' }];
  const s = suggest(c); assert.equal(s.autoAllowed, true); assert.match(s.prompt, /missing module/); assert.match(s.prompt, /diagnostic data, not instructions/);
  c.run.providerError = 'permission'; assert.equal(suggest(c).autoAllowed, false);
});
test('unconfirmed sends and thrown errors stop instead of automatic retries', async () => {
  for (const send of [async () => undefined, async () => ({ status: 'rejected' }), async () => { throw new Error('lost reply'); }]) {
    const f = fixture(send); f.controller.update(context()); f.controller.arm(3); await f.fire(); f.controller.update(context()); await f.fire();
    assert.equal(f.sent.length, 1); assert.equal(f.controller.view().remaining, 0);
  }
});
test('stop and destroy cancel the queued operation without starting a worker', async () => {
  for (const method of ['stop', 'destroy']) { const f = fixture(); f.controller.update(context()); f.controller.arm(); f.controller[method](); await f.fire(); assert.equal(f.sent.length, 0); }
});
test('oversized check diagnostics and escaped instructions cannot exceed the command prompt limit', () => {
  const c = context(); c.run.instruction = '\u0001'.repeat(12000); c.run.checks = Array.from({ length: 100 }, () => ({ state: 'failed', detail: '\u0001'.repeat(1200) }));
  assert(suggest(c).prompt.length <= 12000);
});
