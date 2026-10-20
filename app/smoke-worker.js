'use strict';
// Runs from the map AND npm run smoke. Every write goes into our own temporary directory.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(option('--root', path.join(__dirname, '..')));
const python = option('--python', process.env.AGENT_BUS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-smoke-'));
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');
let hub, db;
async function step(name, fn) {
  emit({ type: 'step', name, state: 'running', text: `Running: ${name}` });
  try {
    await fn();
    emit({ type: 'step', name, state: 'passed', text: `PASS: ${name}` });
  } catch (e) {
    emit({ type: 'step', name, state: 'failed', text: `FAIL: ${name}: ${e.message}` });
    throw e;
  }
}
async function main() {
  emit({ type: 'log', text: `Checkout: ${root}\nExecutor: local smoke runner\nScratch: ${scratch}\nPython: ${python}` });
  await step('JavaScript syntax', () => {
    for (const file of fs.readdirSync(path.join(root, 'app')).filter((x) => x.endsWith('.js'))) {
      execFileSync(process.execPath, ['--check', path.join(root, 'app', file)], {
        timeout: 10000, windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'pipe',
      });
    }
  });
  await step('Python syntax and local messaging', () => {
    const code = `import ast,importlib.util,json,os,pathlib,sys
root=pathlib.Path(sys.argv[1]); scratch=pathlib.Path(sys.argv[2])
sys.dont_write_bytecode=True
for f in root.glob('*.py'): ast.parse(f.read_text(encoding='utf-8'))
os.environ['AGENT_BUS_DB']=str(scratch/'python.sqlite')
# Never consult or contact the operator's remote hub/config during a smoke test.
original=pathlib.Path.home
os.environ['HOME']=str(scratch); os.environ['USERPROFILE']=str(scratch)
os.environ.pop('AGENT_BUS_URL',None); os.environ.pop('AGENT_BUS_TOKEN',None); os.environ.pop('AGENT_BUS_NAME',None)
spec=importlib.util.spec_from_file_location('fixture_bus',root/'agent_bus_mcp.py'); b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
assert b.REMOTE_URL is None
b.t_register({'name':'fixture-a'}); b.t_register({'name':'fixture-b'})
b.t_send({'as':'fixture-a','to':'fixture-b','body':'smoke-payload'})
assert 'smoke-payload' in b.t_inbox({'as':'fixture-b'})
assert b.t_inbox({'as':'fixture-b'}) == 'No new messages.'
b.t_send({'as':'fixture-a','to':'all','body':'broadcast-fixture'})
assert 'broadcast-fixture' in b.t_inbox({'as':'fixture-b'})
assert b.t_inbox({'as':'fixture-a'}) == 'No new messages.'
print('Direct message, receipt and broadcast verified against isolated Python SQLite bus')`;
    const output = execFileSync(python, ['-c', code, root, scratch], { timeout: 15000, windowsHide: true, encoding: 'utf8', stdio: 'pipe' });
    emit({ type: 'log', text: output.trim() });
  });
  await step('Hub messaging and read receipts', async () => {
    const { Hub } = require(path.join(root, 'app', 'hub'));
    db = new DatabaseSync(':memory:'); db.exec(require(path.join(root, 'app', 'schema')));
    hub = new Hub({ db, root: scratch, configPath: path.join(scratch, 'hub.json') });
    await hub.tool('bus_register', { name: 'fixture-a' }, {}, '127.0.0.1');
    await hub.tool('bus_register', { name: 'fixture-b' }, {}, '127.0.0.1');
    await hub.tool('bus_send', { as: 'fixture-a', to: 'fixture-b', body: 'hub-fixture' }, {}, '127.0.0.1');
    assert.match(await hub.tool('bus_inbox', { as: 'fixture-b' }, {}, '127.0.0.1'), /hub-fixture/);
    assert.equal(await hub.tool('bus_inbox', { as: 'fixture-b' }, {}, '127.0.0.1'), 'No new messages.');
  });
  await step('File bytes and integrity hash', () => {
    const bytes = Buffer.from('smoke file fixture\x00\xff');
    const file = hub.storeFile('fixture-a', 'fixture-b', 'fixture.bin', bytes, '');
    const row = db.prepare('SELECT path,sha256 FROM files WHERE id=?').get(file.file_id);
    assert.deepEqual(fs.readFileSync(row.path), bytes);
    assert.equal(row.sha256, require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
  });
  await step('HTTP authentication and RPC', async () => {
    hub.config.port = 0; await hub.listen([]);
    assert.equal(hub.servers.length, 1, hub.errors.join(', '));
    const base = `http://127.0.0.1:${hub.servers[0].server.address().port}`;
    const request = { method: 'POST', body: JSON.stringify({ tool: 'bus_list', args: {} }), signal: AbortSignal.timeout(5000) };
    assert.equal((await fetch(base + '/rpc', request)).status, 401);
    const response = await fetch(base + '/rpc', { ...request, headers: { Authorization: `Bearer ${hub.config.token}` } });
    assert.equal(response.status, 200); assert.match((await response.json()).text, /fixture-a/);
  });
  await step('Owner approval and keyring overwrite guards', () => {
    const id = hub.proposals.propose('fixture-a', 'Smoke fixture', '');
    assert.throws(() => hub.proposals.setStatus('fixture-a', id, 'approved'), /Only the owner/);
    hub.keyring.add('fixture-a', { name: 'dummy-key', value: 'not-a-real-secret' });
    assert.throws(() => hub.keyring.add('fixture-b', { name: 'dummy-key', value: 'different' }), /different value/);
    assert.equal(hub.keyring.getText('dummy-key', true), 'not-a-real-secret');
  });
  emit({ type: 'summary', state: 'passed', text: '6/6 smoke checks passed. Disposable data only; no live messages or credentials touched.' });
}
main().catch((e) => {
  emit({ type: 'summary', state: 'failed', text: e.stack || e.message }); process.exitCode = 1;
}).finally(async () => {
  await hub?.close(); db?.close();
  // scratch comes only from mkdtemp above, never from a caller-supplied deletion path.
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
});
