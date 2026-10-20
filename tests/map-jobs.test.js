'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { MapJobs } = require('../app/map-jobs');
const root = path.resolve(__dirname, '..');
const python = process.env.AGENT_BUS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function fixture(t, options = {}) {
  const db = new DatabaseSync(':memory:'); db.exec(require('../app/schema'));
  const jobs = new MapJobs({ db, root, findPython: async () => python, ...options });
  t.after(() => { jobs.close(); db.close(); });
  return { db, jobs };
}
async function completed(jobs) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const row = jobs.list()[0];
    if (!['assigned', 'running'].includes(row.state)) return row;
    await sleep(30);
  }
  throw new Error('Fixture job did not finish');
}
test('real runner passes all six checks, records output and source hashes', async (t) => {
  const { jobs, db } = fixture(t);
  const { id } = jobs.start({ agent: '@smoke-runner', building: 'test' });
  assert.throws(() => jobs.start({ agent: '@smoke-runner', building: 'test' }), /occupied/);
  const job = await completed(jobs);
  assert.equal(job.id, id); assert.equal(job.state, 'passed', job.output); assert.equal(job.exit_code, 0);
  assert.equal(job.steps.length, 6); assert(job.steps.every((s) => s.state === 'passed'));
  assert.match(job.output, /6\/6 smoke checks passed/);
  assert.match(job.manifest['agent_bus_mcp.py'], /^[a-f0-9]{64}$/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n, 0, 'live database remains untouched by probes');
});
test('only supported facilities and managed workers can be assigned', (t) => {
  const { jobs, db } = fixture(t);
  assert.throws(() => jobs.start({ agent: 'missing', building: 'test' }), /test agent/);
  assert.throws(() => jobs.start({ agent: 'owner', building: 'test' }), /test agent/);
  assert.throws(() => jobs.start({ agent: '@smoke-runner', building: 'build' }), /Only the Test/);
  db.prepare("INSERT INTO agents(name) VALUES('vm')").run();
  db.prepare("INSERT INTO agent_meta(name,remote) VALUES('vm',1)").run();
  assert.throws(() => jobs.start({ agent: 'vm', building: 'test' }), /test agent/);
});
test('cancellation during preparation never starts a process or records a pass', async (t) => {
  let resolve;
  const { jobs } = fixture(t, { findPython: () => new Promise((r) => { resolve = r; }) });
  const { id } = jobs.start({ agent: '@smoke-runner', building: 'test' }); jobs.cancel(id); resolve(python);
  await sleep(20); assert.equal(jobs.list()[0].state, 'cancelled'); assert.equal(jobs.list()[0].exit_code, null);
});
test('time limit includes Python discovery', async (t) => {
  const { jobs } = fixture(t, { timeoutMs: 25, findPython: async () => { await sleep(100); return python; } });
  jobs.start({ agent: '@smoke-runner', building: 'test' });
  assert.equal((await completed(jobs)).state, 'timed_out'); await sleep(110);
});
test('missing Python and spawn errors produce failed jobs', async (t) => {
  const { jobs } = fixture(t, { findPython: async () => null });
  jobs.start({ agent: '@smoke-runner', building: 'test' }); assert.equal((await completed(jobs)).state, 'failed');
  jobs.findPython = async () => python; jobs.executable = path.join(os.tmpdir(), 'missing-agent-bus-fixture-executable');
  jobs.start({ agent: '@smoke-runner', building: 'test' }); assert.equal((await completed(jobs)).state, 'failed');
});
test('passive registered local session cannot be mislabeled as an executing agent', (t) => {
  const { jobs, db } = fixture(t);
  db.prepare("INSERT INTO agents(name) VALUES('local-fixture')").run();
  assert.throws(() => jobs.start({ agent: 'local-fixture', building: 'test' }), /bus registration alone/);
});
test('source mutation during preparation invalidates a passing runner result', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-mutated-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 }));
  fs.mkdirSync(path.join(temp, 'app'));
  for (const name of fs.readdirSync(path.join(root, 'app')).filter((n) => n.endsWith('.js'))) fs.copyFileSync(path.join(root, 'app', name), path.join(temp, 'app', name));
  for (const name of ['agent_bus_mcp.py', 'claude_statusline.py', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(temp, name));
  let resolve;
  const { jobs } = fixture(t, { root: temp, findPython: () => new Promise((r) => { resolve = r; }) });
  jobs.start({ agent: '@smoke-runner', building: 'test' });
  fs.appendFileSync(path.join(temp, 'agent_bus_mcp.py'), '\n# source changed after assignment\n'); resolve(python);
  const job = await completed(jobs); assert.equal(job.state, 'failed'); assert.match(job.detail, /Source files changed/);
});
test('stored in-flight jobs recover as interrupted, completed results persist', async (t) => {
  const { jobs, db } = fixture(t);
  jobs.start({ agent: '@smoke-runner', building: 'test' }); const result = await completed(jobs);
  db.prepare("INSERT INTO map_jobs(agent,state,created,steps,output) VALUES('fixture','running',1,'[]','partial')").run();
  const reopened = new MapJobs({ db, root, findPython: async () => python });
  assert.equal(reopened.list()[0].state, 'interrupted'); assert.equal(reopened.list()[1].state, result.state);
});
test('planted messaging break fails by name, restoring source passes again', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-negative-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 }));
  fs.mkdirSync(path.join(temp, 'app'));
  for (const name of fs.readdirSync(path.join(root, 'app')).filter((n) => n.endsWith('.js'))) fs.copyFileSync(path.join(root, 'app', name), path.join(temp, 'app', name));
  for (const name of ['agent_bus_mcp.py', 'claude_statusline.py', 'package.json']) fs.copyFileSync(path.join(root, name), path.join(temp, name));
  const file = path.join(temp, 'agent_bus_mcp.py'), source = fs.readFileSync(file, 'utf8');
  const broken = source.replace('mid = deliver(c, sender, to, a["body"])', 'mid = deliver(c, sender, to, "PLANTED-BREAK")');
  assert.notEqual(source, broken); fs.writeFileSync(file, broken);
  const { jobs } = fixture(t, { root: temp });
  jobs.start({ agent: '@smoke-runner', building: 'test' }); const failed = await completed(jobs);
  assert.equal(failed.state, 'failed'); assert.notEqual(failed.exit_code, 0);
  assert.equal(failed.steps.find((s) => s.name === 'Python syntax and local messaging').state, 'failed');
  fs.writeFileSync(file, source);
  jobs.start({ agent: '@smoke-runner', building: 'test' }); assert.equal((await completed(jobs)).state, 'passed');
});
