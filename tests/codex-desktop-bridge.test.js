'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { startHub } = require('../bin/bus-hub.cjs');
const core = require('../app/codex-desktop-bridge');

const map = core.DEFAULT_MAP;

function frame(id, extra) {
  return { id, row: { id, sender: 'cursor-worker', recipient: map.mailbox, body: 'hello ' + id, ...extra } };
}

test('skips self-replies and non-mailbox mail; queues foreign mail once', () => {
  const st = core.emptyState();
  assert.equal(core.ingestFrame(st, frame(1, { sender: map.mailbox }), map).action, 'skip');
  assert.equal(core.ingestFrame(st, frame(2, { sender: 'hub-47801-probe' }), map).action, 'skip');
  assert.equal(core.ingestFrame(st, frame(3, { recipient: 'owner' }), map).action, 'skip');
  assert.equal(core.ingestFrame(st, frame(4), map).action, 'queued');
  assert.equal(core.ingestFrame(st, frame(4), map).action, 'duplicate');
  assert.deepEqual(st.queue.map((q) => q.id), [4]);
  assert.ok(st.skipped.includes(1) && st.skipped.includes(2) && st.skipped.includes(3));
  assert.equal(st.after, 4);
});

test('restart recovery does not redeliver; new ids still queue', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-desktop-bridge-'));
  try {
    const file = path.join(directory, 'state.json');
    const st = core.emptyState();
    core.ingestFrame(st, frame(10), map);
    core.ingestFrame(st, frame(11), map);
    core.markDelivered(st, 10, { mode: 'test' });
    core.writeJson(file, st);
    const loaded = core.loadState(file);
    assert.equal(core.ingestFrame(loaded, frame(10), map).action, 'duplicate');
    assert.equal(core.ingestFrame(loaded, frame(11), map).action, 'duplicate');
    assert.equal(core.ingestFrame(loaded, frame(12), map).action, 'queued');
    assert.deepEqual(loaded.delivered, [10]);
    assert.deepEqual(loaded.queue.map((q) => q.id), [11, 12]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('uncertain submit pauses and does not mark delivered or retry as delivered', () => {
  const st = core.emptyState();
  core.ingestFrame(st, frame(20), map);
  const paused = core.pauseUncertain(st, 20, 'submit-unconfirmed');
  assert.equal(paused.action, 'pause');
  assert.equal(st.paused, true);
  assert.deepEqual(st.pending, [20]);
  assert.ok(!st.delivered.includes(20));
  assert.equal(core.ingestFrame(st, frame(20), map).action, 'duplicate');
});

test('rollout idle requires quiet mtime and rejects active turns', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-rollout-'));
  try {
    const file = path.join(directory, 'rollout-01a14ba6-220d-7df3-9e4c-ec3296a8ced5.jsonl');
    const busy = JSON.stringify({ type: 'event_msg', payload: { type: 'reasoning' } }) + '\n';
    fs.writeFileSync(file, busy);
    const now = Date.now();
    fs.utimesSync(file, new Date(now), new Date(now));
    assert.equal(core.rolloutIdle(file, 8000, now + 100).idle, false);
    const done = JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } }) + '\n';
    fs.writeFileSync(file, done);
    const past = now - 20000;
    fs.utimesSync(file, new Date(past), new Date(past));
    const idle = core.rolloutIdle(file, 8000, now);
    assert.equal(idle.idle, true);
    assert.equal(idle.reason, 'task_complete');
    assert.equal(core.rolloutContains(file, 'task_complete'), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('fresh listener catch-up skips retained history instead of injecting it', () => {
  const st = core.emptyState();
  assert.equal(core.needsCatchUp(st), true);
  assert.equal(core.ingestFrame(st, frame(65), map, 'catch-up').action, 'skip');
  assert.equal(core.ingestFrame(st, frame(66), map, 'catch-up').reason, 'catch-up');
  assert.deepEqual(st.queue, []);
  assert.equal(st.after, 66);
  assert.equal(core.needsCatchUp(st), false);
  assert.equal(core.ingestFrame(st, frame(67), map).action, 'queued');
});

test('parseSse splits frames and findRollout matches thread id', () => {
  const parsed = core.parseSse('id: 7\ndata: {"id":7,"sender":"a","recipient":"b","body":"x"}\n\npartial');
  assert.equal(parsed.frames.length, 1);
  assert.equal(parsed.frames[0].id, 7);
  assert.equal(parsed.rest, 'partial');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-sessions-'));
  try {
    const sessions = path.join(directory, 'sessions', '2026', '10');
    fs.mkdirSync(sessions, { recursive: true });
    const target = path.join(sessions, 'rollout-x-' + map.threadId + '.jsonl');
    fs.writeFileSync(target, '{}\n');
    assert.equal(core.findRollout(directory, map.threadId), target);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('SSE replay after restart delivers only unseen ids (fixture hub, no Desktop UI)', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-desktop-sse-'));
  const running = await startHub({ db: path.join(directory, 'bus.sqlite'), config: path.join(directory, 'hub.json'), port: 0 });
  t.after(async () => {
    await running.close();
    fs.rmSync(path.resolve(directory), { recursive: true, force: true });
  });
  await running.hub.tool('bus_register', { name: 'cursor-worker' }, {}, '127.0.0.1');
  await running.hub.tool('bus_register', { name: map.mailbox }, {}, '127.0.0.1');
  const send = async (body) => {
    const text = await running.hub.tool('bus_send', { as: 'cursor-worker', to: map.mailbox, body }, {}, '127.0.0.1');
    const id = Number(/#(\d+)/.exec(String(text))[1]);
    return { id, text };
  };
  const first = await send('one');
  const second = await send('two');
  const st = core.emptyState();
  const collect = await new Promise((resolve, reject) => {
    const req = http.get(running.url + `/events?as=${map.mailbox}&after=0`, {
      headers: { Authorization: 'Bearer ' + running.hub.config.token, Accept: 'text/event-stream' },
      agent: false,
    }, (res) => {
      let buf = '';
      const seen = [];
      res.on('data', (chunk) => {
        buf += chunk;
        const parsed = core.parseSse(buf); buf = parsed.rest;
        for (const fr of parsed.frames) seen.push(core.ingestFrame(st, fr, map));
        if (seen.length >= 2) { req.destroy(); resolve(seen); }
      });
    });
    req.on('error', reject);
  });
  assert.equal(collect.filter((d) => d.action === 'queued').length, 2);
  core.markDelivered(st, first.id, { mode: 'test' });
  core.markDelivered(st, second.id, { mode: 'test' });
  const stateFile = path.join(directory, 'state.json');
  core.writeJson(stateFile, st);
  const third = await send('three');
  const st2 = core.loadState(stateFile);
  const replay = await new Promise((resolve, reject) => {
    const req = http.get(running.url + `/events?as=${map.mailbox}&after=${st2.after}`, {
      headers: { Authorization: 'Bearer ' + running.hub.config.token, Accept: 'text/event-stream' },
      agent: false,
    }, (res) => {
      let buf = '';
      const seen = [];
      res.on('data', (chunk) => {
        buf += chunk;
        const parsed = core.parseSse(buf); buf = parsed.rest;
        for (const fr of parsed.frames) seen.push(core.ingestFrame(st2, fr, map));
        if (seen.length >= 1) { req.destroy(); resolve(seen); }
      });
    });
    req.on('error', reject);
  });
  assert.equal(replay.length, 1);
  assert.equal(replay[0].action, 'queued');
  assert.equal(replay[0].id, third.id);
  assert.ok(st2.delivered.includes(first.id) && st2.delivered.includes(second.id));
  assert.ok(!st2.delivered.includes(third.id));
});
