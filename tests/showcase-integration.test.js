'use strict';
// SC-19 source/backend qualification. No Electron, GPU, microphone or live provider.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createFixture, waitFor, assertOwned, TEMP_PREFIX, removeOwned, writeNativeFixture, runNative } = require('../evidence/showcase/runtime-review.cjs');
const { CHECKS, ACTIVE } = require('../app/agent-protocol');
const { CHECK_NAMES } = require('../app/district/recipes');
function fixture(t) { const value = createFixture(); t.after(() => value.close({ remove: true })); return value; }
const command = (f, type, extra = {}) => f.command({ id: 'test-' + require('node:crypto').randomUUID(), type, ...extra });
const mapResult = (f, id) => waitFor(() => { const run = f.jobs.list().find(run => run.id === id); return run && !ACTIVE.includes(run.state) ? run : null; }, { label: 'real MapJobs terminal result' });

test('acceptance harness import is inert and cleanup rejects unrelated paths', () => {
  const file = path.resolve(__dirname, '../evidence/showcase/runtime-review.cjs');
  const result = spawnSync(process.execPath, ['-e', 'require(process.argv[1])', file], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, '');
  assert.throws(() => assertOwned(path.resolve(__dirname, '..')), /temporary directory/);
});

test('generated isolated native fixture compiles without launching Electron or touching owner data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX)); t.after(() => removeOwned(directory));
  writeNativeFixture({ directory, python: 'not-executed-by-preparation' });
  for (const name of ['main.cjs', 'preload.cjs', 'initialize.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(directory, name)], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 0, name + ': ' + result.stderr);
  }
  assert.equal(fs.existsSync(path.join(directory, 'fixture.sqlite')), false, 'preparation does not construct a runtime or launch a process');
  assert.equal(fs.existsSync(path.join(directory, 'user-data')), false, 'preparation never consults an owner or native userData folder');
  const html = fs.readFileSync(path.join(directory, 'district.html'), 'utf8');
  assert.match(html, /district-workbench\.js/); assert.match(html, /district-attract-world\.js/); assert.match(html, /<base href="file:[^"]*\/app\/">/);
});

test('native entry rejects missing or wrong frozen identity before creating a profile or app', async () => {
  const before = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith(TEMP_PREFIX)).sort();
  await assert.rejects(runNative(), /exact frozen/);
  await assert.rejects(runNative({ sourceHash: '0'.repeat(64) }), /does not match.*No app launched/);
  assert.deepEqual(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith(TEMP_PREFIX)).sort(), before);
});

test('actual MapJobs six-check execution and project recipe coexist without crossing command or result identity', async t => {
  const f = fixture(t);
  const create = { id: 'same-project-command', type: 'create_project', payload: { name: 'Integration project' } };
  const first = await f.command(create), replay = await f.command(create);
  assert.equal(first.projectId, replay.projectId); assert.equal(f.runtime.workspaces.list().length, 1);
  const recipe = await command(f, 'run_checks', { projectId: first.projectId });
  const map = f.jobs.start({ agent: '@smoke-runner', building: 'test' });
  const [run, smoke] = await Promise.all([f.runtime.waitForRun(recipe.runId), mapResult(f, map.id)]);
  assert.equal(run.state, 'passed', run.detail); assert.deepEqual(run.checks.map(check => check.name), CHECK_NAMES);
  assert.equal(smoke.state, 'passed', smoke.output); assert.deepEqual(smoke.steps.map(check => check.name), CHECKS);
  assert.equal(smoke.exit_code, 0); assert.equal(smoke.root, path.join(f.directory, 'smoke-source'));
  assert.equal(f.runtime.run(recipe.runId).projectId, first.projectId);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM messages').get().n, 0, 'only disposable smoke databases exchange fixture messages');
  assert.equal(f.sessions.size, 0, 'checks never launch even a provider fixture');
  const observed = f.trace.filter(event => event.type === 'map-observation' && event.patch.steps).flatMap(event => JSON.parse(event.patch.steps));
  assert(CHECKS.every(name => observed.some(check => check.name === name && check.state === 'running')), 'actual named progress was persisted');
  const preview = (await f.runtime.snapshot()).previews.find(preview => preview.projectId === first.projectId);
  assert.equal(preview.candidateHash, run.artifact.candidateHash); assert.equal(preview.runId, run.id); assert.equal(preview.stale, false);
});

test('seven projects retain actual independent states, stale candidate and provider-fixture scope', async t => {
  const f = fixture(t); const state = await f.seedSeven();
  assert.equal(state.runtime.projects.length, 7);
  const byName = name => state.runtime.projects.find(project => project.name === name);
  const latest = name => state.runtime.runs.find(run => run.projectId === byName(name).id);
  assert.equal(latest('Needs attention').state, 'working');
  assert.equal(latest('Checks passed').state, 'passed');
  assert.equal(latest('Checks failed').state, 'failed');
  assert.equal(latest('Stopped fixture').state, 'cancelled');
  assert.equal(latest('Saved history').state, 'failed');
  assert.equal(latest('Waiting for an idea'), undefined);
  const prior = state.runtime.previews.find(preview => preview.projectId === byName('Prior preview').id);
  assert.equal(prior.stale, true); assert.notEqual(prior.currentHash, prior.candidateHash);
  for (const project of state.runtime.projects) assert(fs.existsSync(path.join(project.root, '.agent-bus/workspace.json')));
  assert.equal(state.scope.liveProviders, false);
  const active = latest('Needs attention');
  assert(state.runtime.activities.filter(activity => activity.runId === active.id).every(activity => activity.projectId === active.projectId));
  assert(state.runtime.activities.some(activity => activity.runId === active.id && activity.basis === 'reported'));
});

test('reported success and exit zero cannot mint an edit; observed fixture edit runs the real recipe', async t => {
  const f = fixture(t); const project = (await command(f, 'create_project', { payload: { name: 'Bound provider fixture' } })).result.project;
  const first = await command(f, 'start_task', { projectId: project.id, worker: 'codex', instruction: 'Exercise no-change fixture.' });
  await waitFor(() => f.sessions.has(first.runId));
  f.sessions.get(first.runId).options.onEvent({ type: 'activity', phase: 'test', message: 'All checks passed; this remains only reported prose.' });
  assert.equal(f.runtime.run(first.runId).state, 'working');
  assert.equal((await f.settleProvider(first.runId, 'no-change')).state, 'failed');
  const second = await command(f, 'start_task', { projectId: project.id, worker: 'codex', instruction: 'Exercise observed saved-edit fixture.' });
  await waitFor(() => f.sessions.has(second.runId)); const passed = await f.settleProvider(second.runId, 'edit');
  assert.equal(passed.state, 'passed', passed.detail); assert.deepEqual(passed.checks.map(check => check.name), CHECK_NAMES);
  assert.equal(passed.artifact.candidateHash, f.runtime.workspaces.manifest(project.id).hash);
  assert(f.trace.some(event => event.type === 'recipe-observation' && event.runId === second.runId));
});

test('production cancellation and planted named failure retain truthful map history while read failure changes no result', async t => {
  const f = fixture(t); await f.control({ op: 'map-preparation-gate' });
  const cancelled = f.jobs.start({ agent: '@smoke-runner', building: 'test' }); f.jobs.cancel(cancelled.id);
  await f.control({ op: 'release-map-gate' }); assert.equal((await mapResult(f, cancelled.id)).state, 'cancelled');
  await f.control({ op: 'map-planted-failure' }); const started = f.jobs.start({ agent: '@smoke-runner', building: 'test' });
  const failed = await mapResult(f, started.id); assert.equal(failed.state, 'failed');
  assert.equal(failed.steps.find(check => check.name === 'Python syntax and local messaging').state, 'failed');
  await f.control({ op: 'read-failure', surface: 'map', value: true }); assert.throws(() => f.mapList(), /Planted map snapshot/);
  const groundTruth = await f.state(); assert.equal(groundTruth.jobs.find(run => run.id === started.id).state, 'failed');
  assert.equal(groundTruth.jobs.find(run => run.id === cancelled.id).state, 'cancelled');
  await f.control({ op: 'read-failure', surface: 'map', value: false }); assert.equal(f.mapList().length, 2);
});
