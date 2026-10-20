'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { DistrictBridge } = require('../app/district/bridge');

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-bridge-'));
  t.after(() => {
    const resolved = fs.realpathSync(dir), tempRoot = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), tempRoot);
    assert(path.basename(resolved).startsWith('agent-bus-district-bridge-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

async function fixture(t, overrides = {}) {
  const calls = [];
  const snapshot = { version: 1, projects: [], runs: [], activities: [], providers: [], checkpoints: [], previews: [], seq: 7 };
  const runtime = { snapshot: async () => snapshot, command: async (command) => {
    calls.push(command);
    return { id: command.id, status: 'accepted', runId: 'real-fixture-run' };
  }, ...overrides };
  const connectionFile = path.join(temporary(t), 'district-connection.json');
  const bridge = new DistrictBridge({ runtime, connectionFile });
  t.after(() => bridge.close());
  const started = await bridge.start();
  const descriptor = JSON.parse(fs.readFileSync(connectionFile, 'utf8'));
  return { bridge, runtime, snapshot, calls, connectionFile, descriptor, ...started };
}

function request(f, endpoint, { method = 'GET', body, headers = {}, auth = true, chunked = false } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request(f.url + endpoint, { method, headers: {
      ...(auth ? { Authorization: `Bearer ${f.descriptor.token}` } : {}),
      ...(data === undefined ? {} : { 'Content-Type': 'application/json', ...(chunked ? {} : { 'Content-Length': Buffer.byteLength(data) }) }),
      ...headers,
    } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, text, body: JSON.parse(text) });
      });
      res.once('error', reject);
    });
    req.setTimeout(3000, () => req.destroy(new Error('Fixture request timed out.')));
    req.once('error', reject);
    req.end(data);
  });
}

async function absentPid() {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore', windowsHide: true });
  const pid = child.pid;
  await once(child, 'exit');
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  return pid;
}

async function unusedEndpoint() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  await new Promise((resolve) => server.close(resolve));
  return url;
}

function oldDescriptor(pid, url) {
  return { version: 1, url, token: 'a'.repeat(64), pid, created: Date.now() - 10000 };
}

test('bridge binds loopback, writes private descriptor, returns real snapshot and accepted receipt', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(Object.keys(f.descriptor).sort(), ['version', 'url', 'token', 'pid', 'created'].sort());
  assert.match(f.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(f.bridge.server.address().address, '127.0.0.1');
  assert.equal(f.descriptor.pid, process.pid);
  assert.equal(f.descriptor.version, 1);
  assert.match(f.descriptor.token, /^[a-f0-9]{64}$/);
  if (process.platform !== 'win32') assert.equal(fs.statSync(f.connectionFile).mode & 0o777, 0o600);
  assert.deepEqual((await request(f, '/snapshot')).body, f.snapshot);
  const command = { id: 'one', type: 'start_task', origin: 'cli', projectId: 'p1', worker: 'codex', instruction: 'Make a real change.' };
  const response = await request(f, '/command', { method: 'POST', body: command });
  assert.deepEqual(response.body, { id: 'one', status: 'accepted', runId: 'real-fixture-run' });
  assert.deepEqual(f.calls, [command]);
  assert.equal((await f.bridge.start()).url, f.url);
});

test('display preferences, preview windows and visual checks cross the authenticated command boundary', async (t) => {
  const snapshot = { version: 1, seq: 8, displays: [{ id: 'display-2', label: 'Fixture display' }],
    regions: ['full', 'left', 'right', 'custom'] };
  const f = await fixture(t, { snapshot: async () => snapshot });
  const commands = [
    { id: 'preferences', type: 'set_project_preferences', origin: 'cli', projectId: 'p1',
      payload: { testDisplayId: 'display-2', testRegion: 'custom', testBounds: { x: 10, y: 20, width: 640, height: 480 } } },
    { id: 'window', type: 'open_preview_window', origin: 'cli', projectId: 'p1', payload: { runId: 'built-run' } },
    { id: 'visual', type: 'run_visual_checks', origin: 'cli', projectId: 'p1', payload: {} },
  ];
  for (const command of commands) {
    const response = await request(f, '/command', { method: 'POST', body: command });
    assert.equal(response.status, 200);
    assert.equal(response.body.id, command.id);
    assert.equal(response.body.status, 'accepted');
  }
  assert.deepEqual(f.calls, commands);
  assert.deepEqual((await request(f, '/snapshot')).body, snapshot);
  assert.equal((await request(f, '/displays')).status, 404, 'display metadata uses the existing snapshot');
});

test('bridge applies shared command field and payload limits before invoking the runtime', async (t) => {
  const f = await fixture(t);
  const atLimit = { id: 'a'.repeat(160), type: 'run_checks', projectId: 'p'.repeat(160) };
  assert.equal((await request(f, '/command', { method: 'POST', body: atLimit })).status, 200);
  for (const command of [
    { ...atLimit, id: 'a'.repeat(161) },
    { id: 'instruction', type: 'start_task', instruction: 'x'.repeat(12001) },
    { id: 'payload', type: 'set_project_preferences', payload: { first: 'a'.repeat(24000), second: 'b'.repeat(24000) } },
  ]) assert.equal((await request(f, '/command', { method: 'POST', body: command })).status, 400);
  assert.deepEqual(f.calls, [atLimit]);
});

test('unauthenticated health is minimal; protected routes reject absent/wrong credentials without runtime calls', async (t) => {
  let snapshots = 0;
  const f = await fixture(t, { snapshot: async () => { snapshots++; throw new Error('SECRET D:\\private'); } });
  const health = await request(f, '/health', { auth: false });
  assert.deepEqual(health.body, { ok: true, service: 'agent-bus-district', version: 1 });
  for (const endpoint of ['/snapshot', '/command', '/missing']) {
    const response = await request(f, endpoint, { auth: false });
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: 'District authorization required.' });
    assert(!response.text.includes(f.descriptor.token));
    assert(!response.text.includes(f.connectionFile));
  }
  assert.equal((await request(f, '/snapshot', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal(snapshots, 0);
  assert.equal(f.calls.length, 0);
});

test('every browser Origin, including null and empty, is rejected on health, snapshot and command', async (t) => {
  const f = await fixture(t);
  for (const origin of ['null', '', 'http://127.0.0.1', 'https://example.com']) {
    for (const endpoint of ['/health', '/snapshot', '/command']) {
      const response = await request(f, endpoint, { headers: { Origin: origin } });
      assert.equal(response.status, 403);
      assert(!Object.keys(response.headers).some((key) => key.startsWith('access-control-')));
    }
  }
  assert.equal(f.calls.length, 0);
});

test('local Host is required so a rebound hostname cannot use even the health endpoint', async (t) => {
  const f = await fixture(t);
  assert.equal((await request(f, '/health', { auth: false, headers: { Host: 'attacker.example' } })).status, 403);
});

test('command route rejects malformed JSON, shapes, methods, content types and excessive nesting', async (t) => {
  const f = await fixture(t);
  assert.equal((await request(f, '/command')).status, 405);
  assert.equal((await request(f, '/snapshot', { method: 'POST' })).status, 405);
  assert.equal((await request(f, '/missing')).status, 404);
  assert.equal((await request(f, '/command', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  for (const body of ['{', 'null', '[]', '{}', '{"id":"x","type":"shell"}', '{"id":"x","type":"run_checks","unexpected":true}',
    '{"id":"x","type":"run_checks","payload":{"__proto__":{"polluted":true}}}']) {
    assert.equal((await request(f, '/command', { method: 'POST', body })).status, 400);
  }
  let nested = {};
  for (let i = 0; i < 15; i++) nested = { nested };
  assert.equal((await request(f, '/command', { method: 'POST', body: { id: 'nested', type: 'run_checks', payload: nested } })).status, 400);
  assert.equal(f.calls.length, 0);
});

test('body cap counts bytes for both declared-length and chunked uploads', async (t) => {
  const f = await fixture(t);
  const body = JSON.stringify({ id: 'big', type: 'start_task', instruction: 'x'.repeat(65536) });
  for (const chunked of [false, true]) {
    const response = await request(f, '/command', { method: 'POST', body, chunked });
    assert.equal(response.status, 413);
    assert.deepEqual(response.body, { error: 'Command body exceeds 64 KB.' });
  }
  assert.equal(f.calls.length, 0);
});

test('runtime failures return generic JSON errors; rejected receipts remain real runtime receipts', async (t) => {
  const f = await fixture(t, { snapshot: async () => { throw new Error('SECRET D:\\private\\file'); },
    command: async (command) => { if (command.id === 'failure') throw new Error('SECRET'); return { id: command.id, status: 'rejected', error: 'Task unavailable' }; } });
  const failure = await request(f, '/snapshot');
  assert.equal(failure.status, 500);
  assert.deepEqual(failure.body, { error: 'District request failed.' });
  assert(!failure.text.includes('SECRET'));
  assert.equal((await request(f, '/command', { method: 'POST', body: { id: 'failure', type: 'run_checks' } })).status, 500);
  const rejected = await request(f, '/command', { method: 'POST', body: { id: 'denied', type: 'run_checks' } });
  assert.deepEqual(rejected.body, { id: 'denied', status: 'rejected', error: 'Task unavailable' });
});

test('another live bridge cannot overwrite a descriptor or remove it when its startup fails', async (t) => {
  const f = await fixture(t);
  const original = fs.readFileSync(f.connectionFile, 'utf8');
  const other = new DistrictBridge({ runtime: f.runtime, connectionFile: f.connectionFile });
  t.after(() => other.close());
  await assert.rejects(other.start(), /live process owns/);
  await other.close();
  assert.equal(fs.readFileSync(f.connectionFile, 'utf8'), original);
  assert.equal((await request(f, '/health', { auth: false })).status, 200);
});

test('pre-existing stale and malformed descriptors are preserved with explicit recovery errors', async (t) => {
  const dir = temporary(t);
  for (const contents of ['not JSON', JSON.stringify({ version: 1, pid: -1, token: 'other' })]) {
    const connectionFile = path.join(dir, `connection-${contents.length}.json`);
    fs.writeFileSync(connectionFile, contents);
    const bridge = new DistrictBridge({ connectionFile, runtime: { snapshot() {}, command() {} } });
    t.after(() => bridge.close());
    await assert.rejects(bridge.start(), /left unchanged|stale district/);
    await bridge.close();
    assert.equal(fs.readFileSync(connectionFile, 'utf8'), contents);
  }
});

test('confirmed absent process plus unreachable endpoint recovers an owned descriptor into a preserved archive', async (t) => {
  const dir = temporary(t), connectionFile = path.join(dir, 'connection.json');
  const previousUrl = await unusedEndpoint();
  const previous = JSON.stringify(oldDescriptor(await absentPid(), previousUrl));
  fs.writeFileSync(connectionFile, previous, { mode: 0o600 });
  const bridge = new DistrictBridge({ connectionFile, port: Number(new URL(previousUrl).port),
    runtime: { snapshot: async () => ({ seq: 1 }), command() {} } });
  t.after(() => bridge.close());
  const started = await bridge.start();
  const current = JSON.parse(fs.readFileSync(connectionFile, 'utf8'));
  assert.equal(current.pid, process.pid);
  assert.equal(current.url, previousUrl, 'recover before binding the crashed instance port');
  assert.notEqual(current.token, JSON.parse(previous).token);
  assert.equal(fs.readFileSync(bridge.recoveredDescriptor.file, 'utf8'), previous);
  assert.match(path.basename(bridge.recoveredDescriptor.file), /^connection\.json\.stale-[a-f0-9-]+$/);
  assert.equal((await request({ ...started, descriptor: current }, '/health', { auth: false })).status, 200);
  await bridge.close();
  assert.equal(fs.existsSync(connectionFile), false);
  assert.equal(fs.readFileSync(bridge.recoveredDescriptor.file, 'utf8'), previous);
});

test('absent PID with a reachable health endpoint is preserved, regardless of health status', async (t) => {
  const dir = temporary(t), connectionFile = path.join(dir, 'connection.json');
  let healthPath;
  const server = http.createServer((req, res) => { healthPath = req.url; res.writeHead(503); res.end('unhealthy'); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const previous = JSON.stringify(oldDescriptor(await absentPid(), `http://127.0.0.1:${server.address().port}`));
  fs.writeFileSync(connectionFile, previous);
  const bridge = new DistrictBridge({ connectionFile, runtime: { snapshot() {}, command() {} } });
  t.after(() => bridge.close());
  await assert.rejects(bridge.start(), /endpoint is still reachable/);
  assert.equal(healthPath, '/health');
  assert.equal(fs.readFileSync(connectionFile, 'utf8'), previous);
});

test('stale recovery can be disabled and simultaneous recoveries never replace a winner', async (t) => {
  const dir = temporary(t), connectionFile = path.join(dir, 'connection.json');
  const previous = JSON.stringify(oldDescriptor(await absentPid(), await unusedEndpoint()));
  fs.writeFileSync(connectionFile, previous);
  const runtime = { snapshot() {}, command() {} };
  const disabled = new DistrictBridge({ connectionFile, runtime, recoverStale: false });
  t.after(() => disabled.close());
  await assert.rejects(disabled.start(), /recovery is disabled/);
  assert.equal(fs.readFileSync(connectionFile, 'utf8'), previous);
  const a = new DistrictBridge({ connectionFile, runtime }), b = new DistrictBridge({ connectionFile, runtime });
  t.after(() => a.close()); t.after(() => b.close());
  const results = await Promise.allSettled([a.start(), b.start()]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const winner = a.descriptor ? a : b, loser = a.descriptor ? b : a;
  const winnerText = fs.readFileSync(connectionFile, 'utf8');
  assert.equal(JSON.parse(winnerText).token, winner.descriptor.token);
  await loser.close();
  assert.equal(fs.readFileSync(connectionFile, 'utf8'), winnerText);
});

test('close removes only its unchanged owned descriptor and stops accepting connections', async (t) => {
  const f = await fixture(t);
  await f.bridge.close();
  assert.equal(fs.existsSync(f.connectionFile), false);
  await assert.rejects(request(f, '/health', { auth: false }));
  await f.bridge.close();
  await assert.rejects(f.bridge.start(), /closed/);
});

test('close preserves a replacement descriptor even when another actor rewrites the same file', async (t) => {
  const f = await fixture(t);
  const replacement = JSON.stringify({ ...f.descriptor, token: 'replacement-token', pid: 123 });
  fs.writeFileSync(f.connectionFile, replacement);
  await f.bridge.close();
  assert.equal(fs.readFileSync(f.connectionFile, 'utf8'), replacement);
});

test('failed descriptor creation and close during startup do not leave a live listener', async (t) => {
  const dir = temporary(t);
  const bridge = new DistrictBridge({ runtime: { snapshot() {}, command() {} }, connectionFile: path.join(dir, 'missing', 'connection.json') });
  t.after(() => bridge.close());
  await assert.rejects(bridge.start(), /ENOENT/);
  assert.equal(bridge.server, null);
  const stopping = new DistrictBridge({ runtime: { snapshot() {}, command() {} }, connectionFile: path.join(dir, 'stopping.json') });
  const starting = stopping.start();
  await stopping.close();
  await assert.rejects(starting, /closed during startup/);
  assert.equal(fs.existsSync(stopping.connectionFile), false);
});

test('Origin acceptance check detects a planted guard removal and passes after restoring the copied implementation', async (t) => {
  const dir = temporary(t), copy = path.join(dir, 'bridge.cjs'), connectionFile = path.join(dir, 'connection.json');
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'district', 'bridge.js'), 'utf8');
  fs.copyFileSync(path.join(__dirname, '..', 'app', 'district', 'contracts.js'), path.join(dir, 'contracts.js'));
  const broken = source.replace("if (Object.hasOwn(request.headers, 'origin'))", "if (false && Object.hasOwn(request.headers, 'origin'))");
  assert.notEqual(broken, source, 'The planted break must remove the implementation guard.');
  const runtime = { snapshot: async () => ({ version: 1, seq: 1 }), command: async () => ({ status: 'rejected' }) };
  async function openCopy(contents) {
    fs.writeFileSync(copy, contents);
    delete require.cache[require.resolve(copy)];
    const { DistrictBridge: CopiedBridge } = require(copy);
    const bridge = new CopiedBridge({ runtime, connectionFile });
    t.after(() => bridge.close());
    const started = await bridge.start();
    return { bridge, ...started, descriptor: JSON.parse(fs.readFileSync(connectionFile, 'utf8')) };
  }
  // Each fresh CommonJS load compiles the copied implementation; the shared app is untouched.
  const planted = await openCopy(broken);
  const exposed = await request(planted, '/snapshot', { headers: { Origin: 'https://example.com' } });
  assert.throws(() => assert.equal(exposed.status, 403), assert.AssertionError,
    'The Origin rejection acceptance assertion must fail when the actual guard is removed.');
  await planted.bridge.close();
  const restored = await openCopy(source);
  assert.equal((await request(restored, '/snapshot', { headers: { Origin: 'https://example.com' } })).status, 403);
});
