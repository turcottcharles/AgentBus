'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../app/codex-desktop-bridge');

const map = {
  mailbox: 'cursor-worker',
  skipSenders: ['cursor-worker', 'hub-47801-probe'],
};

function frame(id, extra) {
  return { id, row: { id, sender: 'editor-agent-bus', recipient: 'cursor-worker', body: 'hi ' + id, ...extra } };
}

test('Cursor mailbox skips self and probes; queues Editor mail once', () => {
  const st = core.emptyState();
  assert.equal(core.ingestFrame(st, frame(1, { sender: 'cursor-worker' }), map).action, 'skip');
  assert.equal(core.ingestFrame(st, frame(2, { sender: 'hub-47801-probe' }), map).action, 'skip');
  assert.equal(core.ingestFrame(st, frame(3, { recipient: 'owner' }), map).action, 'skip');
  assert.equal(core.ingestFrame(st, frame(4), map).action, 'queued');
  assert.equal(core.ingestFrame(st, frame(4), map).action, 'duplicate');
});

test('Cursor restart does not re-wake delivered Editor mail', () => {
  const st = core.emptyState();
  core.ingestFrame(st, frame(84), map);
  core.markDelivered(st, 84, { mode: 'wake' });
  assert.equal(core.ingestFrame(st, frame(84), map).action, 'duplicate');
  assert.equal(core.ingestFrame(st, frame(85), map).action, 'queued');
});
