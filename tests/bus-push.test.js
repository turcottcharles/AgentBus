'use strict';
// Actual HTTP + SQLite in explicitly disposable directories. No owner hub,
// app window, provider process, model call, or recurring test polling.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Hub, MAX_EVENT_BUFFER, MAX_AGENT_STREAMS } = require('../app/hub');
const { startHub, parseArgs } = require('../bin/bus-hub.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
function bounded(promise, message = 'fixture deadline exceeded') {
  let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 2500); })]).finally(() => clearTimeout(timer));
}
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-push-'));
  const running = await startHub({ db: path.join(directory, 'bus.sqlite'), config: path.join(directory, 'hub.json'), port: 0 });
  const streams = [];
  t.after(async () => { for (const stream of streams) stream.destroy(); await running.close(); const resolved = path.resolve(directory); assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(resolved, { recursive: true, force: true }); });
  for (const name of ['alice', 'bob', 'carol']) await running.hub.tool('bus_register', { name }, {}, '127.0.0.1');
  const authorization = { Authorization: `Bearer ${running.hub.config.token}` };
  function request(route, { headers = authorization, method = 'GET', body } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(running.url + route, { method, headers, agent: false }, res => {
        const parts = []; res.on('data', data => parts.push(data)); res.on('error', reject); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString(), headers: res.headers }));
      }); req.on('error', reject); req.end(body);
    });
  }
  async function stream(route = '/events?as=bob&after=0', headers = authorization) {
    const result = await bounded(new Promise((resolve, reject) => {
      const req = http.get(running.url + route, { headers, agent: false }, res => {
        const rows = [], waiters = []; let buffer = '', ended = false, closeResolve;
        const closed = new Promise(done => { closeResolve = done; });
        const markClosed = () => { ended = true; closeResolve(); }; res.on('close', markClosed); res.on('error', markClosed);
        res.on('data', data => {
          buffer += data.toString(); let split;
          while ((split = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, split); buffer = buffer.slice(split + 2);
            const id = /^id: (\d+)$/m.exec(frame), payload = /^data: (.*)$/m.exec(frame);
            if (payload) { assert.match(frame, /^event: message$/m); const row = JSON.parse(payload[1]); assert.equal(row.id, Number(id[1])); rows.push(row); }
          }
          for (const waiter of [...waiters]) if (rows.length >= waiter.count) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(rows); }
        });
        const value = { status: res.statusCode, headers: res.headers, rows, closed, get ended() { return ended; }, wait(count) { return bounded(rows.length >= count ? Promise.resolve(rows) : new Promise(resolve => waiters.push({ count, resolve })), `Expected ${count} SSE messages`); }, destroy() { req.destroy(); res.destroy(); } };
        streams.push(value); resolve(value);
      }); req.on('error', reject);
    })); return result;
  }
  return { ...running, directory, authorization, request, stream };
}

test('standalone options are explicit; malformed/disabled config is preserved and import is inert', async () => {
  assert.throws(() => parseArgs([]), /required/); assert.throws(() => parseArgs(['--db', 'x', '--config', 'y', '--port', '-1']), /Port/);
  assert.throws(() => parseArgs(['--db', 'x', '--config', 'x']), /different/);
  assert.equal(parseArgs(['--help']).help, true);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-push-config-'));
  try {
    const config = path.join(directory, 'hub.json'), db = path.join(directory, 'absent.sqlite');
    for (const text of ['{broken', '{"enabled":false,"token":"preserve-this","lan":true}']) {
      fs.writeFileSync(config, text); await assert.rejects(startHub({ db, config, port: 0 })); assert.equal(fs.readFileSync(config, 'utf8'), text); assert.equal(fs.existsSync(db), false);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('standalone hub publishes a local descriptor and removes it on clean close', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-push-descriptor-'));
  const running = await startHub({ db: path.join(directory, 'bus.sqlite'), config: path.join(directory, 'hub.json'), port: 0 });
  try {
    const saved = JSON.parse(fs.readFileSync(running.connectionPath, 'utf8'));
    assert.equal(saved.db, running.database); assert.equal(saved.url, running.url); assert.ok(saved.token); assert.ok(saved.nonce);
  } finally {
    await running.close();
  }
  assert.equal(fs.existsSync(running.connectionPath), false);
  fs.rmSync(path.resolve(directory), { recursive: true, force: true });
});

test('loopback launcher preserves token/custom configuration and serves the actual repository MCP script', async t => {
  const f = await fixture(t); assert.equal(f.hub.servers.length, 1); assert.equal(f.hub.servers[0].server.address().address, '127.0.0.1');
  assert.equal(f.hub.root, path.resolve(__dirname, '..')); assert.equal(f.filesDir, path.join(f.directory, 'files'));
  const descriptor = JSON.parse(fs.readFileSync(f.connectionPath, 'utf8'));
  assert.equal(descriptor.version, 1); assert.equal(descriptor.db, f.database); assert.equal(descriptor.url, f.url);
  assert.equal(descriptor.token, f.hub.config.token); assert.match(descriptor.nonce, /^[0-9a-f]{32}$/);
  const script = await f.request('/agent_bus_mcp.py'); assert.equal(script.status, 200); assert.equal(script.body, fs.readFileSync(path.join(__dirname, '../agent_bus_mcp.py'), 'utf8'));
  const saved = JSON.parse(fs.readFileSync(f.config, 'utf8')); saved.token = 'exact-existing-token'; saved.custom = { keep: true }; saved.lan = true; fs.writeFileSync(f.config, JSON.stringify(saved));
  const fresh = new Hub({ db: f.db, root: f.hub.root, configPath: f.config });
  assert.equal(fresh.config.token, 'exact-existing-token'); assert.deepEqual(fresh.config.custom, { keep: true }); await fresh.close();
});

test('SSE authenticates before validating registered scope/cursor and accepts Bearer or existing token query', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/events?as=bob&after=0', { headers: {} })).status, 401);
  assert.equal((await f.request('/events?as=unregistered&after=0')).status, 400);
  assert.equal((await f.request('/events?after=0')).status, 400);
  for (const value of ['-1', '1.2', '1e3', '9007199254740992', 'x', '']) assert.equal((await f.request('/events?as=bob&after=' + value)).status, 400);
  assert.equal((await f.request('/events?as=bob', { method: 'POST' })).status, 405);
  const stream = await f.stream('/events?as=bob&after=0&t=' + f.hub.config.token, {}); assert.equal(stream.status, 200); assert.match(stream.headers['content-type'], /text\/event-stream/);
  const id = f.hub.deliver('alice', 'bob', 'query-auth compatible'); await stream.wait(1); assert.equal(stream.rows[0].id, id);
});

test('durable ordered replay and live delivery filter recipients, broadcasts and sender self-broadcast without marking reads', async t => {
  const f = await fixture(t);
  f.hub.deliver('alice', 'carol', 'not bob'); const first = f.hub.deliver('alice', 'bob', 'before connection');
  const broadcast = f.hub.deliver('alice', 'all', 'hello everyone'); f.hub.deliver('bob', 'all', 'exclude bob');
  const stream = await f.stream(); await stream.wait(2);
  const live = f.hub.deliver('carol', 'bob', 'new\nline "quoted" ☃'); await stream.wait(3);
  assert.deepEqual(stream.rows.map(row => row.id), [first, broadcast, live]); assert.equal(stream.rows.at(-1).body, 'new\nline "quoted" ☃');
  for (const row of stream.rows) assert.deepEqual(row, { ...f.db.prepare('SELECT id,ts,sender,recipient,body FROM messages WHERE id=?').get(row.id) });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM reads').get().n, 0);
  const text = await f.hub.tool('bus_inbox', { as: 'bob' }, {}, '127.0.0.1'); assert.match(text, /before connection/); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM reads').get().n, 3);
  const replay = await f.stream('/events?as=bob&after=' + first); await replay.wait(2); assert.deepEqual(replay.rows.map(row => row.id), [broadcast, live], 'read receipts do not remove durable stream replay');
});

test('Last-Event-ID reconnect and immediate post-subscribe publish have no replay/live gap', async t => {
  const f = await fixture(t); const old = f.hub.deliver('alice', 'bob', 'old'); const before = f.hub.deliver('alice', 'bob', 'replay');
  const stream = await f.stream('/events?as=bob', { ...f.authorization, 'Last-Event-ID': String(old) }); const after = f.hub.deliver('alice', 'bob', 'right after headers');
  await stream.wait(2); assert.deepEqual(stream.rows.map(row => row.id), [before, after]);
  const subscribers = f.hub.subscribers.get('bob'), remove = subscribers.delete.bind(subscribers);
  const serverClosed = new Promise(resolve => { subscribers.delete = value => { const result = remove(value); resolve(); return result; }; });
  stream.destroy(); await bounded(Promise.all([stream.closed, serverClosed])); assert.equal(f.hub.subscribers.size, 0);
  const reconnect = await f.stream('/events?as=bob&after=' + after); const next = f.hub.deliver('alice', 'bob', 'reconnect live'); await reconnect.wait(1); assert.deepEqual(reconnect.rows.map(row => row.id), [next]);
});

test('per-agent stream cap is enforced and disconnect releases a slot; hub close releases all streams', async t => {
  const f = await fixture(t), streams = [];
  for (let index = 0; index < MAX_AGENT_STREAMS; index++) streams.push(await f.stream());
  assert.equal((await f.request('/events?as=bob&after=0')).status, 429);
  streams[0].destroy(); await bounded(streams[0].closed); await tick();
  const replacement = await f.stream(); assert.equal(replacement.status, 200);
  await f.hub.close(); await bounded(Promise.all([...streams, replacement].map(stream => stream.closed))); assert.equal(f.hub.subscribers.size, 0);
});

test('inbox wait performs no recurring query and wakes only on relevant committed message', async t => {
  const f = await fixture(t); let queries = 0; const original = f.hub.inboxText.bind(f.hub); f.hub.inboxText = name => { queries++; return original(name); };
  const waiting = f.hub.tool('bus_inbox', { as: 'bob', wait_seconds: 5 }, {}, '127.0.0.1'); assert.equal(queries, 1); assert.equal(f.hub.inboxWaiters.get('bob').size, 1);
  f.hub.deliver('alice', 'carol', 'other recipient'); f.hub.deliver('bob', 'all', 'own broadcast'); await tick(); assert.equal(queries, 1);
  f.hub.deliver('alice', 'bob', 'wake now'); assert.match(await bounded(waiting), /wake now/); assert.equal(queries, 2); assert.equal(f.hub.inboxWaiters.size, 0);
  assert.equal(await f.hub.tool('bus_inbox', { as: 'bob', wait_seconds: .02 }, {}, '127.0.0.1'), 'No new messages.'); assert.equal(queries, 4, 'deadline performs one final query, not periodic scans');
});

test('inbox HTTP disconnect and hub close remove wait listeners without scanning or leaking timers', async t => {
  const f = await fixture(t);
  const req = http.request(f.url + '/rpc', { method: 'POST', headers: f.authorization, agent: false }); req.on('error', () => {});
  req.end(JSON.stringify({ tool: 'bus_inbox', args: { as: 'bob', wait_seconds: 300 } }));
  // Synchronize on the actual listener registration, without a timed poll.
  const original = f.hub.waitForInbox.bind(f.hub); let ready;
  const registered = new Promise(resolve => { ready = resolve; });
  f.hub.waitForInbox = (...args) => { const result = original(...args); ready(); return result; };
  await bounded(registered); req.destroy();
  const cleanup = new Promise(resolve => { const wake = [...f.hub.inboxWaiters.get('bob')][0]; const set = f.hub.inboxWaiters.get('bob'); const remove = set.delete.bind(set); set.delete = value => { const result = remove(value); if (value === wake) resolve(); return result; }; });
  await bounded(cleanup); assert.equal(f.hub.inboxWaiters.size, 0);
  const waiting = f.hub.tool('bus_inbox', { as: 'carol', wait_seconds: 300 }, {}, '127.0.0.1'); await f.hub.close(); assert.equal(await bounded(waiting), 'No new messages.'); assert.equal(f.hub.inboxWaiters.size, 0);
});

test('commit precedes notification and an open transaction cannot leak rolled-back messages', async t => {
  const f = await fixture(t); const original = f.hub.publish.bind(f.hub); let committed;
  f.hub.publish = row => { committed = f.db.prepare('SELECT body FROM messages WHERE id=?').get(row.id)?.body; return original(row); };
  f.hub.deliver('alice', 'bob', 'durable first'); assert.equal(committed, 'durable first');
  f.db.exec('BEGIN'); assert.throws(() => f.hub.deliver('alice', 'bob', 'never publish'), /autocommitted/); f.db.exec('ROLLBACK');
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM messages WHERE body='never publish'").get().n, 0);
});

test('response backpressure pauses until drain and bounded overflow disconnects while retaining DB replay', async t => {
  const f = await fixture(t), req = new EventEmitter(), res = new EventEmitter();
  req.headers = {}; req.socket = { setTimeout() {}, setNoDelay() {} }; res.destroyed = false; res.writableLength = 0; const frames = []; let blocked = true;
  res.writeHead = () => {}; res.flushHeaders = () => {}; res.write = frame => { frames.push(frame); return !blocked; }; res.destroy = () => { res.destroyed = true; res.emit('close'); };
  f.hub.events(req, res, new URL('http://fixture/events?as=bob&after=0'));
  const first = f.hub.deliver('alice', 'bob', 'first blocked write'); const next = f.hub.deliver('alice', 'bob', 'queued until drain'); assert.equal(frames.length, 1);
  blocked = false; res.emit('drain'); assert.equal(frames.length, 2); assert.match(frames[1], new RegExp('id: ' + next));
  blocked = true; f.hub.deliver('alice', 'bob', 'block again'); const large = f.hub.deliver('alice', 'bob', 'x'.repeat(MAX_EVENT_BUFFER));
  assert.equal(res.destroyed, true); assert.equal(f.hub.subscribers.size, 0); assert.equal(f.db.prepare('SELECT length(body) AS n FROM messages WHERE id=?').get(large).n, MAX_EVENT_BUFFER);
  assert.equal(f.db.prepare('SELECT body FROM messages WHERE id=?').get(next).body, 'queued until drain', 'unsent queued bytes remain in the durable database');
  const stream = await f.stream('/events?as=bob&after=' + large); const marker = f.hub.deliver('alice', 'bob', 'post-pressure reconnect'); await stream.wait(1); assert.equal(stream.rows[0].id, marker);
});
