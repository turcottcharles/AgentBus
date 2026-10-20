'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { DistrictStore } = require('../app/district/store');
const { Workspaces } = require('../app/district/workspaces');
const { DistrictRuntime } = require('../app/district/runtime');
const { runRecipe } = require('../app/district/recipes');
const selection = require('../app/district-selection');

const appRoot = path.resolve(__dirname, '..');
const command = (type, projectId, payload = {}, id = crypto.randomUUID()) => ({ id, type, origin: 'showcase-projects-fixture', ...(projectId ? { projectId } : {}), payload });
function deferred() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
function tempFixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-showcase-projects-'));
  return { temp, dbPath: path.join(temp, 'state.sqlite'), workRoot: path.join(temp, 'projects') };
}
function removeFixture(temp) {
  assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
  assert.match(path.basename(temp), /^agent-bus-showcase-projects-/);
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 });
}
function workspaceFixture(t) {
  const f = tempFixture();
  function open() {
    f.db = new DatabaseSync(f.dbPath);
    f.store = new DistrictStore({ db: f.db });
    f.workspaces = new Workspaces({ root: f.workRoot, store: f.store });
  }
  open();
  f.reopen = () => { f.db.close(); open(); };
  t.after(() => { f.db.close(); removeFixture(f.temp); });
  return f;
}
function runtimeFixture(t, options = {}) {
  const f = tempFixture();
  f.db = new DatabaseSync(f.dbPath);
  f.startCalls = 0;
  f.runtimeOptions = {
    db: f.db, appRoot, workRoot: f.workRoot, providerList: async () => [],
    agentStart: () => { f.startCalls++; throw new Error('A project fixture must never call a provider'); }, ...options,
  };
  f.runtime = new DistrictRuntime(f.runtimeOptions);
  t.after(async () => { f.beforeClose?.(); await f.runtime.close(); f.db.close(); removeFixture(f.temp); });
  return f;
}

test('seven same-name projects retain distinct roots, interleaved source bytes and SQLite identity after reopen', (t) => {
  const f = workspaceFixture(t);
  const projects = Array.from({ length: 7 }, () => f.workspaces.create({ name: 'My project' }));
  assert.equal(new Set(projects.map((project) => project.id)).size, 7);
  assert.equal(new Set(projects.map((project) => project.root)).size, 7);
  const initialHashes = projects.map((project) => f.workspaces.manifest(project.id).hash);
  assert.equal(new Set(initialHashes).size, 1, 'same source bytes may share a hash without sharing a project');
  const order = [4, 0, 6, 2, 1, 5, 3];
  const content = new Map();
  for (let revision = 0; revision < 3; revision++) {
    for (const index of order) {
      const project = projects[index];
      const before = projects.map((entry) => f.workspaces.manifest(entry.id).hash);
      const text = JSON.stringify({ projectId: project.id, index, revision });
      f.workspaces.write(project.id, 'notes/project.json', text);
      content.set(project.id, text);
      projects.forEach((entry, other) => {
        if (other !== index) assert.equal(f.workspaces.manifest(entry.id).hash, before[other], 'another project source changed');
      });
    }
  }
  const finalHashes = projects.map((project) => f.workspaces.manifest(project.id).hash);
  assert.equal(new Set(finalHashes).size, 7);
  f.reopen();
  assert.equal(f.workspaces.list().length, 7);
  projects.forEach((project, index) => {
    assert.equal(f.workspaces.get(project.id).root, project.root);
    assert.equal(f.workspaces.read(project.id, 'notes/project.json'), content.get(project.id));
    assert.equal(f.workspaces.manifest(project.id).hash, finalHashes[index]);
    const neighbor = projects[(index + 1) % projects.length];
    assert.throws(() => f.workspaces.write(project.id, `../${neighbor.id}/notes/project.json`, 'cross-project overwrite'), /path segment/);
    assert.equal(f.workspaces.read(neighbor.id, 'notes/project.json'), content.get(neighbor.id));
  });
});

test('three unavailable roots remain individually visible while four healthy projects still snapshot and write', async (t) => {
  const f = runtimeFixture(t);
  const workspaces = f.runtime.workspaces;
  const projects = Array.from({ length: 7 }, (_, index) => workspaces.create({ name: `Project ${index + 1}` }));
  const retained = path.join(f.temp, 'retained-original-project');
  fs.renameSync(projects[0].root, retained);
  const marker = path.join(projects[1].root, '.agent-bus', 'workspace.json');
  const changed = JSON.parse(fs.readFileSync(marker, 'utf8'));
  changed.id = projects[6].id;
  fs.writeFileSync(marker, JSON.stringify(changed));
  const storedBefore = f.runtime.store.get('project', projects[2].id);
  f.runtime.store.put('project', { ...storedBefore, root: projects[6].root });
  const list = workspaces.list();
  assert.equal(list.length, 7);
  for (let index = 0; index < 3; index++) {
    const row = list.find((project) => project.id === projects[index].id);
    assert.equal(row.unavailable, true);
    assert.equal(row.root, null, 'an invalid root must not be advertised as a usable working directory');
    assert(row.error);
    assert.throws(() => workspaces.read(row.id, 'index.html'));
    assert.throws(() => workspaces.write(row.id, 'index.html', 'lost work'));
  }
  workspaces.write(projects[5].id, 'notes/healthy.txt', 'independent work continues');
  assert.equal(workspaces.read(projects[5].id, 'notes/healthy.txt'), 'independent work continues');
  assert.equal(fs.readFileSync(path.join(retained, 'index.html'), 'utf8').startsWith('<!doctype html>'), true);
  assert.equal(f.runtime.store.get('project', projects[2].id).root, projects[6].root, 'inspection does not silently repair database records');
  const snapshot = await f.runtime.snapshot();
  assert.equal(snapshot.projects.length, 7);
  assert.equal(snapshot.projects.filter((project) => project.unavailable).length, 3);
  assert.equal(snapshot.projects.filter((project) => project.manifest).length, 4);
  assert.equal(f.startCalls, 0);
});

test('noisy project history cannot hide another project latest or unresolved recorded run', async (t) => {
  const f = runtimeFixture(t);
  const projects = Array.from({ length: 7 }, (_, index) => f.runtime.workspaces.create({ name: `History ${index + 1}` }));
  const latest = [], unresolved = [];
  // These are persisted status fixtures, not dispatched work or claimed results.
  const record = (project, id, created, state, extra = {}) => {
    const run = { id, projectId: project.id, created, state, origin: 'recorded-history-fixture', ...extra };
    f.runtime.store.put('run', run);
    return run;
  };
  f.runtime.store.transaction(() => {
    for (let index = 1; index < projects.length; index++) {
      record(projects[index], `quiet-${index}-old-completed`, index, 'passed');
      latest.push(record(projects[index], `quiet-${index}-latest`, 100 + index, index === 1 ? 'failed' : 'passed'));
    }
    unresolved.push(record(projects[2], 'quiet-building', 20, 'building'));
    unresolved.push(record(projects[3], 'quiet-stopping', 30, 'stopping'));
    unresolved.push(record(projects[4], 'quiet-termination-unknown', 40, 'termination_unknown', { termination: { confirmed: false } }));
    unresolved.push(record(projects[5], 'quiet-queued', 50, 'queued'));
    for (let index = 0; index < 150; index++) record(projects[0], `noisy-${index}`, 1000 + index, 'passed');
  });
  const persisted = f.runtime.store.list('run');
  const snapshot = await f.runtime.snapshot();
  const byId = new Map(snapshot.runs.map((run) => [run.id, run]));
  assert.equal(snapshot.projects.length, 7);
  for (const run of [...latest, ...unresolved]) assert.deepEqual(byId.get(run.id), run, 'quiet project current/unresolved identity and state must survive noisy history');
  assert.equal(snapshot.runs.filter((run) => run.projectId === projects[0].id).length, 100, 'the noisy project still has bounded recent history');
  assert(byId.has('noisy-149'), 'the noisy project latest run remains visible too');
  assert(!byId.has('noisy-0'), 'unprotected old completed history is not unbounded');
  assert(!byId.has('quiet-1-old-completed'), 'protecting current status does not retain every quiet historical run');
  assert.equal(byId.size, snapshot.runs.length, 'overlapping latest/recent protection cannot duplicate a run');
  assert.equal(snapshot.runs.length, 110, 'protected quiet records are additional to the recent 100, not displaced by that cap');
  for (let index = 1; index < snapshot.runs.length; index++) assert(snapshot.runs[index - 1].created >= snapshot.runs[index].created);
  assert.deepEqual(f.runtime.store.list('run'), persisted, 'snapshot projection cannot rewrite recorded states');
  assert.equal(f.runtime.active.size, 0, 'reading recorded runs cannot invent active workers');
  assert.equal(f.startCalls, 0);
});

test('seven-project selection preserves displayed order, additive/range operations and focused identity across refresh', () => {
  const ids = Array.from({ length: 7 }, (_, index) => `project-${index + 1}`);
  let state = selection.create(ids);
  state = selection.click(state, ids[3], ids);
  state = selection.toggle(state, ids[0], ids);
  state = selection.click(state, ids[6], ids, { metaKey: true });
  assert.deepEqual(state.selectedIds, [ids[0], ids[3], ids[6]]);
  state = selection.click(state, ids[4], ids, { shiftKey: true, ctrlKey: true });
  assert.deepEqual(state.selectedIds, [ids[0], ids[3], ids[4], ids[5], ids[6]]);
  const serialized = selection.serialize(state);
  const reordered = [ids[6], ids[1], ids[5], ids[4], ids[3], ids[0], ids[2]];
  const restored = selection.deserialize(serialized, reordered);
  assert.deepEqual(restored.selectedIds, [ids[6], ids[5], ids[4], ids[3], ids[0]]);
  assert.equal(restored.focusedId, ids[4]);
  const removed = selection.reconcile(restored, reordered.filter((id) => id !== ids[4]));
  assert.equal(removed.focusedId, ids[6]);
  assert(!removed.selectedIds.includes(ids[4]));
  const only = selection.click(removed, ids[1], reordered);
  assert.deepEqual(only.selectedIds, [ids[1]]);
  assert.deepEqual(selection.toggle(only, ids[1], reordered).selectedIds, [ids[1]]);
  assert(Object.isFrozen(restored.selectedIds));
});

test('top/side navigation and overview/tiled layouts persist independently without altering project selection', () => {
  const ids = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const state = selection.create(ids, ['two', 'four', 'seven']);
  const savedSelection = selection.serialize(state);
  let view = selection.createView({ navigation: 'top', layout: 'split' });
  view = selection.setView(view, { navigation: 'side' });
  assert.deepEqual(view, { navigation: 'side', layout: 'split' });
  view = selection.setView(view, { layout: 'overview' });
  assert.deepEqual(view, { navigation: 'side', layout: 'overview' });
  const savedView = selection.serializeView({ ...view, token: 'PRIVATE', projectId: 'DO-NOT-SAVE', selectedIds: ids });
  assert.deepEqual(JSON.parse(savedView), { version: 1, navigation: 'side', layout: 'overview' });
  assert.doesNotMatch(savedView, /PRIVATE|DO-NOT-SAVE|selectedIds/);
  const restored = selection.deserializeView(savedView);
  assert.deepEqual(selection.setView(restored, { layout: 'tiled' }), { navigation: 'side', layout: 'split' });
  assert.deepEqual(selection.deserialize(savedSelection, ids), state);
  assert(Object.isFrozen(restored));
  assert.deepEqual(selection.setView(restored, { navigation: 'unknown', layout: 'invalid' }), restored);
  assert.deepEqual(selection.deserializeView('split'), { navigation: 'top', layout: 'split' });
  assert.deepEqual(selection.deserializeView('tiled'), { navigation: 'top', layout: 'split' });
  for (const bad of ['', null, '{}', '[]', '{broken', '{"version":3,"navigation":"side"}', 'x'.repeat(1024 * 1024 + 1)]) {
    assert.deepEqual(selection.deserializeView(bad), { navigation: 'top', layout: 'overview' });
  }
});

test('browser selection and preference operations do not touch storage, dispatch or start timers', () => {
  const browser = {};
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('Storage belongs to the workbench'); } });
  Object.defineProperty(browser, 'bus', { get() { throw new Error('Selection cannot dispatch'); } });
  vm.runInNewContext(fs.readFileSync(path.join(appRoot, 'app/district-selection.js'), 'utf8'), {
    window: browser, setTimeout() { throw new Error('Selection cannot schedule work'); },
  }, { timeout: 1000 });
  const api = browser.DistrictSelection;
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const selected = api.click(api.create(ids), 'g', ids, { shiftKey: true });
  const view = api.deserializeView(api.serializeView(api.setView(api.createView(), { navigation: 'side', layout: 'split' })));
  assert.equal(selected.selectedIds.length, 7);
  assert.equal(view.navigation, 'side');
  assert.deepEqual(Object.keys(browser), ['DistrictSelection']);
});

test('seven actual local checks interleave without sharing run roots, previews, failures or command identity', { timeout: 30000 }, async (t) => {
  const gates = new Map(), allEntered = deferred();
  const f = runtimeFixture(t, {
    recipeRun: async (options) => {
      const gate = deferred(); gates.set(options.root, { ...gate, options });
      if (gates.size === 7) allEntered.resolve();
      await gate.promise;
      return runRecipe(options);
    },
  });
  f.beforeClose = () => { for (const gate of gates.values()) gate.resolve(); };
  const projects = [];
  for (let index = 0; index < 7; index++) {
    const receipt = await f.runtime.command(command('create_project', null, { name: `Concurrent ${index + 1}` }));
    const project = receipt.result.project;
    f.runtime.workspaces.write(project.id, 'notes/project.json', JSON.stringify({ projectId: project.id, number: index }));
    projects.push(project);
  }
  f.runtime.workspaces.write(projects[3].id, 'script.js', 'function deliberatelyBroken( {');
  const requests = projects.map((project) => command('run_checks', project.id));
  const receipts = await Promise.all(requests.map((request) => f.runtime.command(request)));
  await allEntered.promise;
  assert.equal(f.runtime.active.size, 7);
  assert.equal(new Set(receipts.map((receipt) => receipt.runId)).size, 7);
  assert.equal(new Set([...gates.values()].map((gate) => gate.options.artifactRoot)).size, 7);
  await assert.rejects(f.runtime.command(command('run_checks', projects[0].id)), /active work/);
  await assert.rejects(f.runtime.command(command('cancel_run', projects[1].id, { runId: receipts[0].runId })), /different project/);
  await assert.rejects(f.runtime.command({ ...requests[0], projectId: projects[1].id }), /different request/);
  assert.deepEqual(await f.runtime.command(requests[0]), receipts[0], 'same exact command returns original acceptance');
  const finished = new Map();
  for (const index of [5, 1, 6, 0, 4, 2, 3]) {
    gates.get(projects[index].root).resolve();
    const run = await f.runtime.waitForRun(receipts[index].runId);
    finished.set(index, run);
    assert.equal(run.projectId, projects[index].id);
    if (index === 3) { assert.equal(run.state, 'failed'); assert.equal(run.artifact, null); }
    else {
      assert.equal(run.state, 'passed', run.output);
      assert.equal(run.artifact.root, path.join(projects[index].root, '.agent-bus', 'artifacts', run.id));
      assert.equal(run.source.hash, f.runtime.workspaces.manifest(projects[index].id).hash);
      const preview = f.runtime.previewManager.list().find((item) => item.runId === run.id);
      assert.equal(preview.projectId, projects[index].id);
      const response = await fetch(new URL('notes/project.json', preview.url));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { projectId: projects[index].id, number: index });
    }
    for (const [pendingIndex] of projects.entries()) {
      if (!finished.has(pendingIndex)) assert(f.runtime.busy(projects[pendingIndex].id), 'one completion cannot finish another project');
    }
  }
  assert.equal(f.runtime.active.size, 0);
  assert.equal(f.runtime.previewManager.list().length, 6);
  assert.equal(f.runtime.store.list('run').filter((run) => run.state === 'passed').length, 6);
  const before = await f.runtime.snapshot();
  const changed = projects[1];
  f.runtime.workspaces.write(changed.id, 'notes/project.json', '{"edited":"after checks"}');
  const after = await f.runtime.snapshot();
  assert.equal(after.previews.filter((preview) => preview.stale).length, 1);
  assert.equal(after.previews.find((preview) => preview.stale).projectId, changed.id);
  assert.equal(before.projects.length, 7);
  assert.equal(f.startCalls, 0, 'all checks use real local recipes without provider calls');
  await f.runtime.close();
  f.runtime = new DistrictRuntime(f.runtimeOptions);
  const reopened = await f.runtime.snapshot();
  assert.equal(reopened.projects.length, 7);
  assert.equal(reopened.runs.length, 7);
  assert.equal(reopened.runs.filter((run) => run.state === 'failed').length, 1);
  assert.equal(reopened.previews.length, 0, 'closed preview servers are not invented after restart');
});
