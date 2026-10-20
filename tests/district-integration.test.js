'use strict';
// Runtime orchestration cases substitute the agent-session or display-manager
// boundary. SQLite, generated files, recipes/checks, checkpoint bytes and HTTP
// previews execute for real. They do not establish provider or visual acceptance.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { DistrictStore } = require('../app/district/store');
const { Workspaces } = require('../app/district/workspaces');
const { Checkpoints } = require('../app/district/checkpoints');
const { runRecipe } = require('../app/district/recipes');
const { PreviewManager } = require('../app/district/preview');
const { DistrictRuntime } = require('../app/district/runtime');

const appRoot = path.resolve(__dirname, '..');
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const commandId = () => crypto.randomUUID();
const providerList = async () => [{
  id: 'codex', name: 'Fixture Codex session boundary', available: true,
  detail: 'No provider process is launched by integration tests.',
  capabilities: { projectFiles: true },
}];

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function ownedTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-district-integration-'));
}

function removeOwnedTemp(root) {
  const absolute = path.resolve(root);
  assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
  assert.match(path.basename(absolute), /^agent-bus-district-integration-/);
  fs.rmSync(absolute, { recursive: true, force: true, maxRetries: 5 });
}

function componentFixture(t) {
  const root = ownedTemp();
  const db = new DatabaseSync(path.join(root, 'district.sqlite'));
  const store = new DistrictStore({ db });
  const workspaces = new Workspaces({ root: path.join(root, 'projects'), store });
  const checkpoints = new Checkpoints({ store, workspaces });
  const previews = new PreviewManager();
  t.after(async () => { await previews.close(); db.close(); removeOwnedTemp(root); });
  return { root, db, store, workspaces, checkpoints, previews };
}

async function built(f, project, runId = commandId(), options = {}) {
  const events = [];
  const artifactRoot = path.join(project.root, '.agent-bus', 'artifacts', runId);
  const result = await runRecipe({
    root: project.root, artifactRoot, runId,
    contractId: project.starterId || project.template || 'checklist',
    onEvent: (event) => { events.push(event); options.onEvent?.(event); },
    signal: options.signal,
  });
  return { result, events, artifactRoot };
}

function runtimeFixture(t, options = {}) {
  const root = ownedTemp();
  const db = new DatabaseSync(path.join(root, 'district.sqlite'));
  const runtime = new DistrictRuntime({
    db, appRoot, workRoot: path.join(root, 'projects'), providerList,
    agentStart: () => { throw new Error('Unexpected provider fixture dispatch'); },
    ...options,
  });
  t.after(async () => { await runtime.close(); db.close(); removeOwnedTemp(root); });
  return { root, db, runtime };
}

function controlledSession() {
  const entered = deferred(), finished = deferred();
  let calls = 0, cancels = 0, current;
  return {
    entered, finished,
    get calls() { return calls; },
    get cancels() { return cancels; },
    get current() { return current; },
    start(options) {
      calls++; current = options; entered.resolve(options);
      return { finished: finished.promise, cancel() { cancels++; return Promise.resolve({ confirmed: true }); } };
    },
  };
}

function observedWrite(runtime, project, options, relative, content) {
  const saved = runtime.workspaces.write(project.id, relative, content);
  // The fixture replaces startAgent after the real session's signed-journal
  // verification boundary. It does not claim to exercise that verification.
  options.onEvent({ type: 'file_changed', path: relative, hash: saved.hash, bytes: saved.bytes });
  return saved;
}

function recordingDisplayManager({ onChecks } = {}) {
  // This is a command-routing fixture, not DisplayManager or an Electron
  // window substitute that claims to exercise rendering or browser behavior.
  const inventory = [
    { id: 'qa-monitor-1', name: 'Fixture monitor 1', primary: false,
      bounds: { x: -1200, y: 0, width: 1200, height: 800 },
      workArea: { x: -1200, y: 0, width: 1200, height: 800 }, scaleFactor: 1 },
    { id: 'qa-monitor-2', name: 'Fixture monitor 2', primary: true,
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
      workArea: { x: 0, y: 0, width: 1600, height: 900 }, scaleFactor: 1 },
  ];
  const calls = { open: [], checks: [], close: 0 };
  const fixedBounds = {
    full: { x: -1200, y: 0, width: 1200, height: 800 },
    'left-half': { x: -1200, y: 0, width: 600, height: 800 },
    'right-half': { x: -600, y: 0, width: 600, height: 800 },
    custom: { x: -1080, y: 200, width: 720, height: 400 },
  };
  function placement(options) {
    return {
      projectId: options.projectId, runId: options.preview.runId,
      previewId: options.preview.id, candidateHash: options.preview.candidateHash, requestedRegion: options.region,
      regionBounds: options.regionBounds ? structuredClone(options.regionBounds) : undefined,
      effectiveBounds: structuredClone(fixedBounds[options.region] || fixedBounds.full),
      display: structuredClone(inventory.find((display) => display.id === options.displayId)),
    };
  }
  function recorded(options) {
    return { ...options, preview: structuredClone(options.preview),
      regionBounds: options.regionBounds ? structuredClone(options.regionBounds) : undefined };
  }
  function checkResult(options, state = 'passed') {
    const contractId = options.contractId || 'checklist';
    const names = contractId === 'neon-rally'
      ? ['Preview load', 'Target display', 'Score both teams', 'Change the look', 'Reset the scores']
      : ['Preview load', 'Target display', 'Add two tasks', 'Complete a task', 'Remove a task'];
    return { ...placement(options), state, exitCode: state === 'passed' ? 0 : 1,
      contractId,
      checks: names.map((name) => ({
        name, state, detail: 'Injected fixture evidence only; no browser interaction was executed.' })) };
  }
  return {
    calls, inventory, checkResult,
    list: () => structuredClone(inventory),
    async open(options) {
      calls.open.push(recorded(options));
      const result = placement(options);
      return { id: 'fixture-window-' + calls.open.length, getBounds: () => structuredClone(result.effectiveBounds),
        districtDisplay: result };
    },
    async runChecks(options) {
      calls.checks.push(recorded(options));
      return onChecks ? onChecks(options, checkResult) : checkResult(options);
    },
    async close() { calls.close++; },
  };
}

async function create(runtime, name = 'QA checklist', starterId) {
  const receipt = await runtime.command({
    id: commandId(), type: 'create_project', origin: 'integration-test', payload: { name, ...(starterId ? { starterId } : {}) },
  });
  assert.equal(receipt.status, 'completed', JSON.stringify(receipt));
  const snapshot = await runtime.snapshot();
  const project = snapshot.projects.find((p) => p.id === receipt.projectId)
    || snapshot.projects.find((p) => p.id === receipt.result?.id);
  assert(project, 'create_project must return a persisted project identity');
  return project;
}

test('real workspace, recipe artifact, HTTP preview and archived baseline restore form one byte-bound pipeline',
  { timeout: 30000 }, async (t) => {
    const f = componentFixture(t);
    const project = f.workspaces.create({ name: 'Actual checklist' });
    const initial = f.workspaces.manifest(project.id);
    const baseline = f.checkpoints.create(project.id, 'Before QA edit');
    const cssBefore = f.workspaces.read(project.id, 'styles.css');
    f.workspaces.write(project.id, 'styles.css', cssBefore + '\n.qa-change { outline: 2px solid teal; }\n');
    f.workspaces.write(project.id, 'notes.txt', 'This is actual candidate-only file content.\n');
    const diff = f.checkpoints.diff(project.id, baseline.id);
    assert(diff.files.some((file) => file.path === 'styles.css'), 'diff must expose the actual edited stylesheet');
    assert(diff.files.some((file) => file.path === 'notes.txt'), 'diff must expose the added candidate file');

    const { result, events } = await built(f, project);
    assert.equal(result.state, 'passed', result.output);
    assert.equal(result.exitCode, 0);
    assert(result.checks.length >= 5);
    assert(result.checks.every((check) => check.state === 'passed'));
    assert(events.some((event) => event.type === 'check'), 'check progress must come from the actual recipe');
    assert.equal(result.artifact.candidateHash, result.source.hash);
    assert.equal(result.source.hash, f.workspaces.manifest(project.id).hash);
    for (const [relative, digest] of Object.entries(result.artifact.manifest)) {
      assert.equal(hash(fs.readFileSync(path.join(result.artifact.root, relative))), digest, relative);
    }

    const preview = await f.previews.start({
      projectId: project.id, runId: 'actual-recipe-run',
      artifactRoot: result.artifact.root, candidateHash: result.artifact.candidateHash,
    });
    const url = new URL(preview.url);
    assert.equal(url.hostname, '127.0.0.1');
    const page = await fetch(preview.url);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /data-testid=["']task-input["']/);
    assert.match(html, /data-testid=["']add-task["']/);
    assert.match(html, /data-testid=["']task-list["']/);
    const builtCss = await (await fetch(new URL('styles.css', preview.url))).text();
    assert.match(builtCss, /qa-change/);

    f.workspaces.write(project.id, 'styles.css', cssBefore + '\n/* changed after the qualified build */\n');
    assert.notEqual(f.workspaces.manifest(project.id).hash, result.source.hash);
    assert.equal(await (await fetch(new URL('styles.css', preview.url))).text(), builtCss,
      'preview bytes must remain the immutable candidate rather than mutable source');

    const restored = f.checkpoints.restore(project.id, baseline.id);
    assert.equal(restored.restored, true);
    assert(restored.archiveId, 'restore must retain a real checkpoint of replaced state');
    assert(f.checkpoints.list(project.id).some((record) => record.id === restored.archiveId));
    assert.equal(f.workspaces.manifest(project.id).hash, initial.hash);
    assert.equal(f.workspaces.read(project.id, 'styles.css'), cssBefore);
    assert(!f.workspaces.files(project.id).includes('notes.txt'));
    assert.equal(await (await fetch(new URL('styles.css', preview.url))).text(), builtCss,
      'restoring source must not relabel or mutate an older build artifact');
  });

test('planted invalid JavaScript fails the actual recipe by name; restoring baseline rebuilds successfully',
  { timeout: 30000 }, async (t) => {
    const f = componentFixture(t);
    const project = f.workspaces.create({ name: 'Syntax failure control' });
    const baseline = f.checkpoints.create(project.id, 'Known source');
    const passing = await built(f, project);
    assert.equal(passing.result.state, 'passed', passing.result.output);
    f.workspaces.write(project.id, 'script.js', 'const = ; // deliberately invalid actual source\n');
    const broken = await built(f, project);
    assert.equal(broken.result.state, 'failed', broken.result.output);
    assert.notEqual(broken.result.exitCode, 0);
    assert(broken.result.checks.some((check) => /syntax|javascript/i.test(check.name) && check.state === 'failed'),
      JSON.stringify(broken.result.checks));
    assert.equal(broken.result.artifact, null);
    f.checkpoints.restore(project.id, baseline.id);
    const recovered = await built(f, project);
    assert.equal(recovered.result.state, 'passed', recovered.result.output);
    assert.equal(recovered.result.source.hash, passing.result.source.hash);
  });

test('source mutation during the real build prevents snapshot qualification',
  { timeout: 30000 }, async (t) => {
    const f = componentFixture(t);
    const project = f.workspaces.create({ name: 'Changing source' });
    let changed = false;
    const run = await built(f, project, commandId(), {
      onEvent(event) {
        if (!changed && event.type === 'phase' && event.phase === 'build') {
          changed = true;
          fs.appendFileSync(path.join(project.root, 'script.js'), '\n// Changed during the observed build.\n');
        }
      },
    });
    assert.equal(changed, true, 'fixture must modify source during the actual build phase');
    assert.equal(run.result.state, 'failed', run.result.output);
    assert.equal(run.result.artifact, null);
    assert(run.result.checks.some((check) => /snapshot|integrity/i.test(check.name) && check.state === 'failed'),
      JSON.stringify(run.result.checks));
  });

test('an aborted real recipe never yields a passing result or artifact',
  { timeout: 10000 }, async (t) => {
    const f = componentFixture(t);
    const project = f.workspaces.create({ name: 'Cancelled recipe' });
    const controller = new AbortController();
    controller.abort();
    const { result } = await built(f, project, commandId(), { signal: controller.signal });
    assert.equal(result.state, 'cancelled');
    assert.equal(result.artifact, null);
  });

test('district transaction rollback does not leak an accepted command, event or record', (t) => {
  const f = componentFixture(t);
  assert.throws(() => f.store.transaction(() => {
    f.store.saveReceipt('aborted-command', { id: 'aborted-command', status: 'accepted' });
    f.store.appendEvent({ type: 'fixture-accepted' });
    f.store.put('run', { id: 'aborted-run', state: 'queued' });
    throw new Error('Injected transaction interruption');
  }), /Injected transaction interruption/);
  assert.equal(f.store.receipt('aborted-command'), null);
  assert.equal(f.store.get('run', 'aborted-run'), null);
  assert.deepEqual(f.store.events(), []);
  const event = f.store.appendEvent({ type: 'after-rollback' });
  assert(event.seq >= 1);
});

test('runtime duplicate task command dispatches one session and completes real checks and preview',
  { timeout: 30000 }, async (t) => {
    const session = controlledSession();
    const { runtime } = runtimeFixture(t, { agentStart: (options) => session.start(options) });
    const project = await create(runtime);
    const command = {
      id: commandId(), type: 'start_task', origin: 'integration-test', projectId: project.id,
      worker: 'codex', instruction: 'Change the checklist heading using actual files.',
    };
    const receipt = await runtime.command(command);
    assert.equal(receipt.status, 'accepted', JSON.stringify(receipt));
    assert(receipt.runId);
    assert.deepEqual(await runtime.command(command), receipt, 'duplicate identity returns the original receipt');
    const options = await session.entered.promise;
    assert.equal(session.calls, 1);
    assert.equal(path.resolve(options.root), path.resolve(project.root));
    options.onEvent({ type: 'session', sessionId: 'fixture-owned-session' });
    options.onEvent({ type: 'activity', phase: 'research', basis: 'reported', message: 'Inspecting the actual files.' });
    observedWrite(runtime, project, options, 'index.html', runtime.workspaces.read(project.id, 'index.html')
      + '\n<!-- Saved fixture change from the substituted session boundary. -->\n');
    session.finished.resolve({ exitCode: 0, sessionId: 'fixture-owned-session', error: null, output: 'Fixture session finished.' });
    const final = await runtime.waitForRun(receipt.runId);
    assert.equal(final.state, 'passed', JSON.stringify(final));
    const snapshot = await runtime.snapshot();
    assert.equal(snapshot.runs.filter((run) => run.id === receipt.runId).length, 1);
    assert(snapshot.previews.some((preview) => preview.runId === receipt.runId),
      'a real successful build must have a candidate-bound preview');
    const preview = snapshot.previews.find((item) => item.runId === receipt.runId);
    assert.match(await (await fetch(preview.url)).text(), /Saved fixture change/);
    assert.equal((await runtime.command(command)).status, 'accepted', 'a receipt is acceptance, not final run state');
    assert.equal(session.calls, 1);
  });

test('reported and replayed activity projects immediately without dispatch or a verified result',
  { timeout: 10000 }, async (t) => {
    let starts = 0;
    const { runtime } = runtimeFixture(t, { agentStart: () => { starts++; throw new Error('Observation dispatched work'); } });
    const project = await create(runtime);
    const event = {
      id: 'external-report-once', workerId: 'existing-cli-session', projectId: project.id,
      phase: 'research', basis: 'observed', origin: 'fixture-cli', sourceSeq: 1,
      message: 'External report claims research and a pass',
      evidence: { state: 'passed', verified: true },
    };
    const command = {
      id: commandId(), type: 'report_activity', origin: 'cli', projectId: project.id, payload: event,
    };
    const receipt = await runtime.command(command);
    assert.notEqual(receipt.status, 'rejected', JSON.stringify(receipt));
    assert.deepEqual(await runtime.command(command), receipt);
    const snapshot = await runtime.snapshot();
    assert.equal(starts, 0);
    assert.equal(snapshot.runs.length, 0, 'a report cannot create an execution');
    const activity = snapshot.activities.find((item) => item.workerId === event.workerId);
    assert(activity, 'external CLI report must be visible without a map drop');
    assert.equal(activity.basis, 'reported', 'self-reported claims cannot self-upgrade to observed evidence');
    assert(!activity.evidence?.verified, 'self-reported payload cannot author verification');
  });

test('provider failure blocks the automatic recipe and preserves the failure',
  { timeout: 10000 }, async (t) => {
    const session = controlledSession();
    let recipes = 0;
    const { runtime } = runtimeFixture(t, {
      agentStart: (options) => session.start(options),
      recipeRun: async () => { recipes++; throw new Error('Recipe must not run after provider failure'); },
    });
    const project = await create(runtime);
    const receipt = await runtime.command({
      id: commandId(), type: 'start_task', origin: 'integration-test', projectId: project.id,
      worker: 'codex', instruction: 'This session boundary deliberately fails.',
    });
    await session.entered.promise;
    session.finished.resolve({
      exitCode: 1, sessionId: 'fixture-failed-session', error: 'Fixture quota refusal', output: 'Fixture quota refusal',
    });
    const final = await runtime.waitForRun(receipt.runId);
    assert.equal(final.state, 'failed', JSON.stringify(final));
    assert.equal(recipes, 0);
    assert(!(await runtime.snapshot()).previews.some((preview) => preview.runId === receipt.runId));
  });

test('runtime cancellation remains terminal after a late successful session result',
  { timeout: 10000 }, async (t) => {
    const session = controlledSession();
    const { runtime } = runtimeFixture(t, { agentStart: (options) => session.start(options) });
    const project = await create(runtime);
    const receipt = await runtime.command({
      id: commandId(), type: 'start_task', origin: 'integration-test', projectId: project.id,
      worker: 'codex', instruction: 'Wait at the fixture session boundary.',
    });
    await session.entered.promise;
    const cancel = await runtime.command({
      id: commandId(), type: 'cancel_run', origin: 'integration-test', projectId: project.id,
      payload: { runId: receipt.runId },
    });
    assert.notEqual(cancel.status, 'rejected', JSON.stringify(cancel));
    session.finished.resolve({ exitCode: 0, sessionId: 'late-success', error: null, output: 'Late success is not authority.' });
    const final = await runtime.waitForRun(receipt.runId);
    assert.notEqual(final.state, 'passed', JSON.stringify(final));
    assert(['cancelled', 'interrupted', 'termination_unknown'].includes(final.state), JSON.stringify(final));
    assert(!(await runtime.snapshot()).previews.some((preview) => preview.runId === receipt.runId));
  });

test('restore while a session owns the workspace is rejected without changing source',
  { timeout: 10000 }, async (t) => {
    const session = controlledSession();
    const { runtime } = runtimeFixture(t, { agentStart: (options) => session.start(options) });
    const project = await create(runtime);
    const checkpointReceipt = await runtime.command({
      id: commandId(), type: 'create_checkpoint', origin: 'integration-test', projectId: project.id,
      payload: { label: 'Protected baseline' },
    });
    const checkpoint = checkpointReceipt.result;
    assert(checkpoint?.id, JSON.stringify(checkpointReceipt));
    const file = path.join(project.root, 'styles.css');
    fs.appendFileSync(file, '\n/* un-restored candidate */\n');
    const before = hash(fs.readFileSync(file));
    const receipt = await runtime.command({
      id: commandId(), type: 'start_task', origin: 'integration-test', projectId: project.id,
      worker: 'codex', instruction: 'Hold this workspace.',
    });
    await session.entered.promise;
    await assert.rejects(runtime.command({
      id: commandId(), type: 'restore_checkpoint', origin: 'integration-test', projectId: project.id,
      payload: { checkpointId: checkpoint.id },
    }), /active work|wait|cancel/i);
    assert.equal(hash(fs.readFileSync(file)), before);
    session.finished.resolve({ exitCode: 1, error: 'Fixture stopped', output: '' });
    await runtime.waitForRun(receipt.runId);
  });

test('real runtime check failure preserves a stale prior preview and baseline source can actually reopen',
  { timeout: 30000 }, async (t) => {
    const { runtime } = runtimeFixture(t);
    const project = await create(runtime, 'Recover a real candidate');
    const baseline = (await runtime.snapshot()).checkpoints.find((checkpoint) => checkpoint.projectId === project.id);
    assert(baseline);
    const first = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'integration-test', projectId: project.id });
    const passed = await runtime.waitForRun(first.runId);
    assert.equal(passed.state, 'passed', JSON.stringify(passed));
    const firstPreview = (await runtime.snapshot()).previews.find((preview) => preview.runId === first.runId);
    assert(firstPreview);
    assert.equal(firstPreview.stale, false);
    const knownHtml = await (await fetch(firstPreview.url)).text();
    fs.writeFileSync(path.join(project.root, 'script.js'), 'const = ; // actual planted build failure\n');
    assert.equal((await runtime.snapshot()).previews.find((preview) => preview.id === firstPreview.id).stale, true);
    const check = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'integration-test', projectId: project.id });
    const failed = await runtime.waitForRun(check.runId);
    assert.equal(failed.state, 'failed', JSON.stringify(failed));
    assert.equal(failed.artifact, null);
    const afterFailure = await runtime.snapshot();
    assert(!afterFailure.previews.some((preview) => preview.runId === check.runId));
    assert.equal(afterFailure.previews.find((preview) => preview.id === firstPreview.id).stale, true);
    assert.equal(await (await fetch(firstPreview.url)).text(), knownHtml, 'prior output remains available as prior bytes');
    const restore = await runtime.command({
      id: commandId(), type: 'restore_checkpoint', origin: 'integration-test', projectId: project.id,
      payload: { checkpointId: baseline.id },
    });
    assert.equal(restore.status, 'completed');
    assert.equal(runtime.workspaces.manifest(project.id).hash, baseline.hash);
    const rebuilt = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'integration-test', projectId: project.id });
    assert.equal((await runtime.waitForRun(rebuilt.runId)).state, 'passed');
  });

test('preview command refuses a successful artifact from another project',
  { timeout: 30000 }, async (t) => {
    const { runtime } = runtimeFixture(t);
    const owner = await create(runtime, 'Artifact owner');
    const other = await create(runtime, 'Different workspace');
    const check = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'integration-test', projectId: owner.id });
    assert.equal((await runtime.waitForRun(check.runId)).state, 'passed');
    await assert.rejects(runtime.command({
      id: commandId(), type: 'preview_start', origin: 'integration-test', projectId: other.id,
      payload: { runId: check.runId },
    }), /build|check|project|preview/i);
    assert(!(await runtime.snapshot()).previews.some((preview) => preview.projectId === other.id));
  });

test('restart interrupts durable unfinished work without relaunching a provider',
  { timeout: 10000 }, async (t) => {
    let starts = 0;
    const { root, db, runtime } = runtimeFixture(t, {
      agentStart: () => { starts++; throw new Error('Restart must not relaunch a provider'); },
    });
    const project = await create(runtime, 'Restart recovery');
    runtime.store.put('run', {
      id: 'persisted-interrupted-run', projectId: project.id, worker: 'codex', origin: 'integration-test',
      state: 'working', created: Date.now(), updated: Date.now(), instruction: 'Persisted but not owned after restart',
    });
    await runtime.close();
    const reopened = new DistrictRuntime({
      db, appRoot, workRoot: path.join(root, 'projects'), providerList,
      agentStart: () => { starts++; throw new Error('Restart must not relaunch a provider'); },
    });
    try {
      const snapshot = await reopened.snapshot();
      assert.equal(snapshot.runs.find((run) => run.id === 'persisted-interrupted-run').state, 'interrupted');
      assert.equal(starts, 0);
      assert(reopened.store.events().some((event) => event.type === 'run_interrupted' && event.runId === 'persisted-interrupted-run'));
    } finally { await reopened.close(); }
  });


test('two project runs stay independent while one is cancelled and the other completes its real candidate',
  { timeout: 30000 }, async (t) => {
    const sessions = new Map();
    const { runtime } = runtimeFixture(t, {
      agentStart(options) {
        const session = sessions.get(path.resolve(options.root));
        assert(session, 'dispatch must choose one explicitly registered project root');
        return session.start(options);
      },
    });
    const left = await create(runtime, 'Concurrent project A');
    const right = await create(runtime, 'Concurrent project B');
    const leftSession = controlledSession(), rightSession = controlledSession();
    sessions.set(path.resolve(left.root), leftSession);
    sessions.set(path.resolve(right.root), rightSession);
    const before = await runtime.snapshot();
    const leftBaseline = before.checkpoints.find((checkpoint) => checkpoint.projectId === left.id);
    const rightBaseline = before.checkpoints.find((checkpoint) => checkpoint.projectId === right.id);
    const [leftReceipt, rightReceipt] = await Promise.all([left, right].map((project) => runtime.command({
      id: commandId(), type: 'start_task', origin: 'gui', projectId: project.id,
      worker: 'codex', instruction: 'Change only this explicit project checklist.',
    })));
    assert.notEqual(leftReceipt.runId, rightReceipt.runId);
    const [leftOptions, rightOptions] = await Promise.all([leftSession.entered.promise, rightSession.entered.promise]);
    assert.equal(leftOptions.runId, leftReceipt.runId);
    assert.equal(rightOptions.runId, rightReceipt.runId);
    leftOptions.onEvent({ type: 'session', sessionId: 'concurrent-owned-left' });
    rightOptions.onEvent({ type: 'session', sessionId: 'concurrent-owned-right' });
    leftOptions.onEvent({ type: 'activity', phase: 'research', basis: 'reported', message: 'Researching project A only.' });
    rightOptions.onEvent({ type: 'activity', phase: 'research', basis: 'reported', message: 'Researching project B only.' });
    observedWrite(runtime, left, leftOptions, 'index.html', runtime.workspaces.read(left.id, 'index.html')
      + '\n<!-- isolated-project-A-change -->\n');
    observedWrite(runtime, right, rightOptions, 'index.html', runtime.workspaces.read(right.id, 'index.html')
      + '\n<!-- isolated-project-B-change -->\n');
    const rightHash = runtime.workspaces.manifest(right.id).hash;
    const simultaneous = await runtime.snapshot();
    assert.equal(simultaneous.runs.filter((run) => [leftReceipt.runId, rightReceipt.runId].includes(run.id)
      && !run.finished).length, 2, 'both distinct projects must be active simultaneously');
    for (const [receipt, project, sessionId] of [
      [leftReceipt, left, 'concurrent-owned-left'], [rightReceipt, right, 'concurrent-owned-right'],
    ]) {
      const activity = simultaneous.activities.find((item) => item.runId === receipt.runId);
      assert(activity, 'each run must have independent automatically projected activity');
      assert.equal(activity.projectId, project.id);
      assert.equal(activity.sessionId, sessionId);
    }
    assert(!runtime.workspaces.read(left.id, 'index.html').includes('isolated-project-B-change'));
    assert(!runtime.workspaces.read(right.id, 'index.html').includes('isolated-project-A-change'));

    await assert.rejects(runtime.command({
      id: commandId(), type: 'report_activity', origin: 'cli', projectId: left.id,
      payload: { id: 'wrong-scope-report', workerId: 'codex', runId: rightReceipt.runId,
        phase: 'research', message: 'Must not attach project B work to project A.' },
    }), /different project/i);
    await assert.rejects(runtime.command({
      id: commandId(), type: 'cancel_run', origin: 'gui', projectId: right.id,
      payload: { runId: leftReceipt.runId },
    }), /different project/i);
    for (const [project, baseline] of [[left, leftBaseline], [right, rightBaseline]]) {
      await assert.rejects(runtime.command({
        id: commandId(), type: 'restore_checkpoint', origin: 'gui', projectId: project.id,
        payload: { checkpointId: baseline.id },
      }), /active work|wait|cancel/i);
    }
    await runtime.command({
      id: commandId(), type: 'cancel_run', origin: 'gui', projectId: left.id,
      payload: { runId: leftReceipt.runId },
    });
    assert.equal(leftOptions.signal.aborted, true);
    assert.equal(rightOptions.signal.aborted, false, 'cancelling A must not abort B');
    assert.equal(rightSession.cancels, 0);
    leftSession.finished.resolve({ exitCode: 0, sessionId: 'concurrent-owned-left', error: null, output: 'Late A exit.' });
    const cancelled = await runtime.waitForRun(leftReceipt.runId);
    assert.equal(cancelled.state, 'cancelled', JSON.stringify(cancelled));
    const restored = await runtime.command({
      id: commandId(), type: 'restore_checkpoint', origin: 'gui', projectId: left.id,
      payload: { checkpointId: leftBaseline.id },
    });
    assert.equal(restored.status, 'completed', 'inactive A can recover while B is still active');
    assert.equal(runtime.workspaces.manifest(left.id).hash, leftBaseline.hash);
    assert.equal(runtime.workspaces.manifest(right.id).hash, rightHash, 'A recovery must not touch B source');
    await assert.rejects(runtime.command({
      id: commandId(), type: 'restore_checkpoint', origin: 'gui', projectId: right.id,
      payload: { checkpointId: rightBaseline.id },
    }), /active work|wait|cancel/i);
    rightSession.finished.resolve({ exitCode: 0, sessionId: 'concurrent-owned-right', error: null, output: 'B edit saved.' });
    const completed = await runtime.waitForRun(rightReceipt.runId);
    assert.equal(completed.state, 'passed', JSON.stringify(completed));
    assert.equal(completed.projectId, right.id);
    assert.equal(completed.source.hash, rightHash);
    const final = await runtime.snapshot();
    assert.equal(final.runs.find((run) => run.id === leftReceipt.runId).state, 'cancelled');
    assert(!final.previews.some((preview) => preview.runId === leftReceipt.runId));
    const preview = final.previews.find((item) => item.runId === rightReceipt.runId);
    assert(preview);
    assert.equal(preview.projectId, right.id);
    assert.equal(preview.candidateHash, rightHash);
    const html = await (await fetch(preview.url)).text();
    assert.match(html, /isolated-project-B-change/);
    assert.doesNotMatch(html, /isolated-project-A-change/);
  });

for (const mode of ['no-event-no-delta', 'file-event-without-delta', 'source-delta-without-file-event']) {
  test('exit zero cannot qualify an agent edit: ' + mode, { timeout: 10000 }, async (t) => {
    const session = controlledSession();
    let recipeCalls = 0;
    const { runtime } = runtimeFixture(t, {
      agentStart: (options) => session.start(options),
      recipeRun: async () => { recipeCalls++; throw new Error('Unqualified edit must not reach recipe'); },
    });
    const project = await create(runtime, 'Edit proof ' + mode);
    const initial = runtime.workspaces.manifest(project.id).hash;
    const receipt = await runtime.command({
      id: commandId(), type: 'start_task', origin: 'gui', projectId: project.id,
      worker: 'codex', instruction: 'Please make an actual source edit.',
    });
    const options = await session.entered.promise;
    options.onEvent({ type: 'activity', phase: 'edit', basis: 'reported', message: 'The agent claims that its edit is complete.' });
    if (mode === 'file-event-without-delta') {
      options.onEvent({ type: 'file_changed', path: 'index.html',
        hash: hash(runtime.workspaces.read(project.id, 'index.html')) });
    } else if (mode === 'source-delta-without-file-event') {
      runtime.workspaces.write(project.id, 'index.html', runtime.workspaces.read(project.id, 'index.html')
        + '\n<!-- changed bytes without a trusted session file event -->\n');
    }
    session.finished.resolve({ exitCode: 0, sessionId: 'unqualified-edit', error: null, output: 'Everything is done.' });
    const result = await runtime.waitForRun(receipt.runId);
    assert.equal(result.state, 'failed', JSON.stringify(result));
    assert.match(result.detail, /observed saved source change|commentary|edit/i);
    assert.equal(recipeCalls, 0);
    assert.equal(result.artifact, null);
    assert(!(await runtime.snapshot()).previews.some((preview) => preview.runId === receipt.runId));
    if (mode !== 'source-delta-without-file-event') assert.equal(runtime.workspaces.manifest(project.id).hash, initial);
    else assert.notEqual(runtime.workspaces.manifest(project.id).hash, initial);
  });
}

test('a current real preview selection reaches the agent instruction with candidate identity; stale reuse is denied',
  { timeout: 30000 }, async (t) => {
    const session = controlledSession();
    const { runtime } = runtimeFixture(t, { agentStart: (options) => session.start(options) });
    const project = await create(runtime, 'Candidate-bound feedback');
    const first = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'gui', projectId: project.id });
    assert.equal((await runtime.waitForRun(first.runId)).state, 'passed');
    const preview = (await runtime.snapshot()).previews.find((item) => item.runId === first.runId);
    assert(preview);
    const selection = {
      projectId: project.id, runId: first.runId, candidateHash: preview.candidateHash,
      selector: '[data-testid="add-task"]', tag: 'button', text: 'Add checklist item',
    };
    const receipt = await runtime.command({
      id: commandId(), type: 'start_task', origin: 'gui', projectId: project.id,
      worker: 'codex', instruction: 'Give the selected Add button an amber border.', payload: { selection },
    });
    const options = await session.entered.promise;
    assert.match(options.instruction, /Give the selected Add button an amber border/);
    assert.match(options.instruction, /untrusted page content/i);
    const contextLabel = options.instruction.indexOf('Selected element context from the built preview');
    assert(contextLabel >= 0);
    const forwardedContext = JSON.parse(options.instruction.slice(options.instruction.indexOf('\n', contextLabel) + 1));
    assert.deepEqual(forwardedContext, selection,
      'the actual forwarded JSON preserves selector and exact project/run/candidate identity');
    const acceptedRun = (await runtime.snapshot()).runs.find((run) => run.id === receipt.runId);
    assert.deepEqual(acceptedRun.selection, selection);
    observedWrite(runtime, project, options, 'styles.css', runtime.workspaces.read(project.id, 'styles.css')
      + '\n[data-testid="add-task"] { border: 2px solid #ffc15d; }\n');
    session.finished.resolve({ exitCode: 0, sessionId: 'feedback-owned-session', error: null, output: 'Saved actual stylesheet edit.' });
    const finished = await runtime.waitForRun(receipt.runId);
    assert.equal(finished.state, 'passed', JSON.stringify(finished));
    assert.notEqual(finished.source.hash, selection.candidateHash);
    const current = await runtime.snapshot();
    const freshPreview = current.previews.find((item) => item.runId === receipt.runId);
    assert(freshPreview);
    assert.equal(freshPreview.candidateHash, finished.source.hash);
    assert.match(await (await fetch(new URL('styles.css', freshPreview.url))).text(), /#ffc15d/);
    const beforeRetryCount = current.runs.length;
    await assert.rejects(runtime.command({
      id: commandId(), type: 'start_task', origin: 'gui', projectId: project.id, worker: 'codex',
      instruction: 'This old selection must be rejected.', payload: { selection },
    }), /stale|different project preview/i);
    assert.equal(session.calls, 1, 'stale feedback must not start another provider session');
    assert.equal((await runtime.snapshot()).runs.length, beforeRetryCount);
  });


test('monitor/custom-region preferences persist and invalid updates cannot corrupt the saved project',
  { timeout: 10000 }, async (t) => {
    const displayManager = recordingDisplayManager();
    const { runtime, db, root } = runtimeFixture(t, { displayManager, defaultTestDisplayId: 'qa-monitor-2' });
    const project = await create(runtime, 'Persistent display preference');
    const bounds = { x: 0.1, y: 0.25, width: 0.6, height: 0.5 };
    const receipt = await runtime.command({
      id: commandId(), type: 'set_project_preferences', origin: 'gui', projectId: project.id,
      payload: { testDisplayId: 'qa-monitor-1', testRegion: 'custom', testBounds: bounds },
    });
    assert.equal(receipt.status, 'completed');
    const expected = { testDisplayId: 'qa-monitor-1', testRegion: 'custom', testBounds: { ...bounds } };
    assert.deepEqual(receipt.result.preferences, expected);
    bounds.x = 0.8;
    const saved = runtime.workspaces.get(project.id);
    assert.deepEqual(saved.preferences, expected, 'command input is not a mutable reference into persisted geometry');
    const invalidId = commandId();
    await assert.rejects(runtime.command({
      id: invalidId, type: 'set_project_preferences', origin: 'gui', projectId: project.id,
      payload: { testDisplayId: 'qa-monitor-2', testRegion: 'custom',
        testBounds: { x: 0.9, y: 0.1, width: 0.4, height: 0.5 } },
    }), /custom area|inside|positive|region/i);
    assert.deepEqual(runtime.workspaces.get(project.id), saved,
      'an invalid rectangle must not partly save its valid monitor change');
    assert.equal(runtime.store.receipt(invalidId), null);
    await assert.rejects(runtime.command({
      id: commandId(), type: 'set_project_preferences', origin: 'gui', projectId: project.id,
      payload: { testDisplayId: 'qa-disconnected-monitor' },
    }), /display|connected/i);
    assert.deepEqual(runtime.workspaces.get(project.id), saved);
    const snapshot = await runtime.snapshot();
    assert.deepEqual(snapshot.displays, displayManager.list());
    assert.equal(snapshot.defaultTestDisplayId, 'qa-monitor-2');
    await runtime.close();
    const reopened = new DistrictRuntime({
      db, appRoot, workRoot: path.join(root, 'projects'), providerList,
      displayManager: recordingDisplayManager(), defaultTestDisplayId: 'qa-monitor-2',
      agentStart: () => { throw new Error('Preferences must not dispatch provider work'); },
    });
    try {
      const restored = await reopened.snapshot();
      assert.deepEqual(restored.projects.find((item) => item.id === project.id).preferences, expected);
      assert.equal(restored.defaultTestDisplayId, 'qa-monitor-2');
      assert.equal(restored.displays.length, 2);
    } finally { await reopened.close(); }
  });

test('preview-window and visual-check commands forward the chosen candidate and retain identical custom geometry',
  { timeout: 30000 }, async (t) => {
    const displayManager = recordingDisplayManager();
    const { runtime } = runtimeFixture(t, { displayManager, defaultTestDisplayId: 'qa-monitor-2' });
    const project = await create(runtime, 'Display routing actual candidate');
    const bounds = { x: 0.1, y: 0.25, width: 0.6, height: 0.5 };
    await runtime.command({
      id: commandId(), type: 'set_project_preferences', origin: 'gui', projectId: project.id,
      payload: { testDisplayId: 'qa-monitor-1', testRegion: 'custom', testBounds: bounds },
    });
    const build = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'gui', projectId: project.id });
    const candidate = await runtime.waitForRun(build.runId);
    assert.equal(candidate.state, 'passed');
    const open = await runtime.command({
      id: commandId(), type: 'open_preview_window', origin: 'gui', projectId: project.id,
      payload: { runId: build.runId },
    });
    assert.equal(open.status, 'completed');
    assert.equal(open.runId, build.runId);
    const opened = displayManager.calls.open[0];
    assert.equal(opened.projectId, project.id);
    assert.equal(opened.preview.projectId, project.id);
    assert.equal(opened.preview.runId, build.runId);
    assert.equal(opened.preview.candidateHash, candidate.artifact.candidateHash);
    assert.equal(opened.displayId, 'qa-monitor-1', 'project preference overrides runtime default monitor 2');
    assert.equal(opened.region, 'custom');
    assert.deepEqual(opened.regionBounds, bounds);
    assert.equal(opened.mode, 'preview');
    assert.match(await (await fetch(opened.preview.url)).text(), /data-testid=["']task-list["']/);
    const visual = await runtime.command({
      id: commandId(), type: 'run_visual_checks', origin: 'gui', projectId: project.id,
      payload: { runId: build.runId },
    });
    assert.equal(visual.status, 'accepted');
    const result = await runtime.waitForRun(visual.runId);
    assert.equal(result.state, 'passed', 'this verdict qualifies runtime routing of the injected display result only');
    assert.equal(result.kind, 'visual');
    assert.equal(result.projectId, project.id);
    assert.equal(result.candidateRunId, build.runId);
    const checked = displayManager.calls.checks[0];
    for (const key of ['projectId', 'displayId', 'region']) assert.equal(checked[key], opened[key], key);
    assert.deepEqual(checked.regionBounds, opened.regionBounds);
    assert.equal(checked.preview.runId, build.runId);
    assert.equal(checked.preview.candidateHash, candidate.artifact.candidateHash);
    assert.deepEqual(result.visualChecks.regionBounds, open.result.placement.regionBounds);
    assert.deepEqual(result.visualChecks.effectiveBounds, open.result.bounds,
      'actual manager-returned geometry must survive both receipt and persisted visual evidence');
    assert.deepEqual(result.visualChecks.effectiveBounds, { x: -1080, y: 200, width: 720, height: 400 });
    assert.equal(result.visualChecks.display.id, 'qa-monitor-1');
    assert.equal(result.visualChecks.requestedRegion, 'custom');
  });

test('stale or wrong-project candidates are blocked before any display-window or visual-check dispatch',
  { timeout: 30000 }, async (t) => {
    const displayManager = recordingDisplayManager();
    const { runtime } = runtimeFixture(t, { displayManager, defaultTestDisplayId: 'qa-monitor-1' });
    const owner = await create(runtime, 'Visual candidate owner');
    const other = await create(runtime, 'Equal bytes different project');
    assert.equal(runtime.workspaces.manifest(owner.id).hash, runtime.workspaces.manifest(other.id).hash,
      'ownership rejection must be exercised even when independent starter bytes have the same hash');
    const build = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'gui', projectId: owner.id });
    assert.equal((await runtime.waitForRun(build.runId)).state, 'passed');
    const countBefore = (await runtime.snapshot()).runs.length;
    for (const type of ['open_preview_window', 'run_visual_checks']) {
      await assert.rejects(runtime.command({
        id: commandId(), type, origin: 'gui', projectId: other.id, payload: { runId: build.runId },
      }), /build|check|project|preview/i);
    }
    runtime.workspaces.write(owner.id, 'styles.css', runtime.workspaces.read(owner.id, 'styles.css')
      + '\n/* Source changed after its actual artifact qualified. */\n');
    for (const type of ['open_preview_window', 'run_visual_checks']) {
      await assert.rejects(runtime.command({
        id: commandId(), type, origin: 'gui', projectId: owner.id, payload: { runId: build.runId },
      }), /current source|build|testing/i);
    }
    assert.equal(displayManager.calls.open.length, 0);
    assert.equal(displayManager.calls.checks.length, 0);
    assert.equal((await runtime.snapshot()).runs.length, countBefore,
      'invalid candidate identity must not mint a visual run');
  });

test('two project zones dispatch visual work in parallel with independent candidate and result scope',
  { timeout: 30000 }, async (t) => {
    const leftEntered = deferred(), rightEntered = deferred();
    const leftFinished = deferred(), rightFinished = deferred();
    let left, right;
    const displayManager = recordingDisplayManager({
      onChecks(options, result) {
        if (options.projectId === left.id) { leftEntered.resolve({ options, result }); return leftFinished.promise; }
        if (options.projectId === right.id) { rightEntered.resolve({ options, result }); return rightFinished.promise; }
        throw new Error('Unexpected project at injected display boundary');
      },
    });
    const { runtime } = runtimeFixture(t, { displayManager, defaultTestDisplayId: 'qa-monitor-2' });
    left = await create(runtime, 'Left visual zone');
    right = await create(runtime, 'Right visual zone');
    await Promise.all([[left, 'left-half'], [right, 'right-half']].map(([project, region]) => runtime.command({
      id: commandId(), type: 'set_project_preferences', origin: 'gui', projectId: project.id,
      payload: { testDisplayId: 'qa-monitor-1', testRegion: region },
    })));
    const [leftBuild, rightBuild] = await Promise.all([left, right].map((project) => runtime.command({
      id: commandId(), type: 'run_checks', origin: 'gui', projectId: project.id,
    })));
    for (const receipt of [leftBuild, rightBuild]) assert.equal((await runtime.waitForRun(receipt.runId)).state, 'passed');
    const [leftVisual, rightVisual] = await Promise.all([[left, leftBuild], [right, rightBuild]].map(([project, build]) => runtime.command({
      id: commandId(), type: 'run_visual_checks', origin: 'gui', projectId: project.id,
      payload: { runId: build.runId },
    })));
    const [leftDispatch, rightDispatch] = await Promise.all([leftEntered.promise, rightEntered.promise]);
    assert.equal(displayManager.calls.checks.length, 2, 'both project dispatches enter before either fixture result finishes');
    const active = (await runtime.snapshot()).runs.filter((run) => [leftVisual.runId, rightVisual.runId].includes(run.id));
    assert.equal(active.length, 2);
    assert(active.every((run) => run.state === 'testing' && !run.finished));
    for (const [dispatch, project, build, region] of [
      [leftDispatch, left, leftBuild, 'left-half'], [rightDispatch, right, rightBuild, 'right-half'],
    ]) {
      assert.equal(dispatch.options.projectId, project.id);
      assert.equal(dispatch.options.preview.projectId, project.id);
      assert.equal(dispatch.options.preview.runId, build.runId);
      assert.equal(dispatch.options.preview.candidateHash, runtime.workspaces.manifest(project.id).hash);
      assert.equal(dispatch.options.displayId, 'qa-monitor-1');
      assert.equal(dispatch.options.region, region);
      assert.equal(dispatch.options.signal.aborted, false);
    }
    rightFinished.resolve(rightDispatch.result(rightDispatch.options));
    const rightResult = await runtime.waitForRun(rightVisual.runId);
    assert.equal(rightResult.state, 'passed');
    assert.equal(rightResult.projectId, right.id);
    assert.equal(rightResult.candidateRunId, rightBuild.runId);
    assert.equal((await runtime.snapshot()).runs.find((run) => run.id === leftVisual.runId).state, 'testing');
    leftFinished.resolve(leftDispatch.result(leftDispatch.options, 'failed'));
    const leftResult = await runtime.waitForRun(leftVisual.runId);
    assert.equal(leftResult.state, 'failed');
    assert.equal(leftResult.projectId, left.id);
    assert.equal(leftResult.candidateRunId, leftBuild.runId);
    assert.equal(leftResult.visualChecks.requestedRegion, 'left-half');
    assert.equal(rightResult.visualChecks.requestedRegion, 'right-half');
    assert.notDeepEqual(leftResult.visualChecks.effectiveBounds, rightResult.visualChecks.effectiveBounds);
    assert.equal((await runtime.snapshot()).runs.find((run) => run.id === rightVisual.runId).state, 'passed');
  });


test('claimed visual success cannot pass with mismatched candidate, display, geometry or missing check evidence',
  { timeout: 30000 }, async (t) => {
    let corrupt;
    const displayManager = recordingDisplayManager({
      onChecks(options, result) {
        const value = result(options);
        corrupt(value);
        return value;
      },
    });
    const { runtime } = runtimeFixture(t, { displayManager, defaultTestDisplayId: 'qa-monitor-1' });
    const project = await create(runtime, 'Reject forged visual identity');
    const build = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'gui', projectId: project.id });
    assert.equal((await runtime.waitForRun(build.runId)).state, 'passed');
    const cases = [
      ['preview identity', (result) => { result.previewId = 'another-preview'; }],
      ['candidate run identity', (result) => { result.runId = 'another-build-run'; }],
      ['candidate byte identity', (result) => { result.candidateHash = '0'.repeat(64); }],
      ['target monitor', (result) => { result.display.id = 'qa-monitor-2'; }],
      ['target geometry', (result) => { result.effectiveBounds.x += 1; }],
      ['complete named checks', (result) => { result.checks.pop(); }],
    ];
    for (const [label, mutation] of cases) {
      corrupt = mutation;
      const receipt = await runtime.command({
        id: commandId(), type: 'run_visual_checks', origin: 'gui', projectId: project.id, payload: { runId: build.runId },
      });
      const run = await runtime.waitForRun(receipt.runId);
      assert.equal(run.state, 'failed', label + ': a claimed passed state cannot compensate for wrong/missing evidence');
      assert.equal(run.visualChecks.state, 'passed', 'the negative fixture must claim success to exercise the runtime guard');
      assert.equal(run.projectId, project.id);
      assert.equal(run.candidateRunId, build.runId);
    }
    assert.equal(displayManager.calls.checks.length, cases.length);
  });


test('Neon Rally starter builds its real shared app bytes and preview with a trusted project-specific visual contract',
  { timeout: 30000 }, async (t) => {
    const displayManager = recordingDisplayManager();
    const recipeCalls = [];
    const { runtime } = runtimeFixture(t, {
      displayManager, defaultTestDisplayId: 'qa-monitor-1',
      recipeRun: async (options) => {
        recipeCalls.push({ contractId: options.contractId, root: options.root, runId: options.runId });
        return runRecipe(options);
      },
    });
    const project = await create(runtime, 'Actual Neon Rally', 'neon-rally');
    assert.equal(project.starterId, 'neon-rally');
    assert.equal(project.template, 'neon-rally');
    const html = runtime.workspaces.read(project.id, 'index.html');
    const script = runtime.workspaces.read(project.id, 'script.js');
    const styles = runtime.workspaces.read(project.id, 'styles.css');
    assert.match(html, /data-neon-rally-app/);
    assert.match(html, /<title>Neon Rally<\/title>/);
    const checklistControls = /data-testid=["'](?:task-input|add-task|task-list)["']/;
    assert.doesNotMatch(html, checklistControls, 'Rally must not add hidden checklist controls to satisfy another contract');
    assert.doesNotMatch(script, checklistControls);
    assert.equal(hash(script), hash(fs.readFileSync(path.join(appRoot, 'app', 'district-attract-demo.js'))),
      'starter uses the exact shared playable app implementation');
    assert.equal(hash(styles), hash(fs.readFileSync(path.join(appRoot, 'app', 'district-attract-demo.css'))));
    const build = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'gui', projectId: project.id });
    const candidate = await runtime.waitForRun(build.runId);
    assert.equal(candidate.state, 'passed', JSON.stringify(candidate));
    assert.equal(recipeCalls.length, 1);
    assert.equal(recipeCalls[0].contractId, 'neon-rally');
    assert.equal(path.resolve(recipeCalls[0].root), path.resolve(project.root));
    assert.equal(recipeCalls[0].runId, build.runId);
    assert.equal(candidate.source.hash, runtime.workspaces.manifest(project.id).hash);
    assert.equal(candidate.artifact.candidateHash, candidate.source.hash);
    assert(candidate.checks.every((check) => check.state === 'passed'));
    const preview = (await runtime.snapshot()).previews.find((item) => item.runId === build.runId);
    assert(preview);
    assert.equal(preview.projectId, project.id);
    assert.equal(preview.candidateHash, candidate.source.hash);
    const servedHtml = await (await fetch(preview.url)).text();
    assert.match(servedHtml, /data-neon-rally-app/);
    assert.doesNotMatch(servedHtml, checklistControls);
    assert.equal(hash(await (await fetch(new URL('script.js', preview.url))).text()), hash(script));
    assert.equal(hash(await (await fetch(new URL('styles.css', preview.url))).text()), hash(styles));

    await runtime.command({
      id: commandId(), type: 'set_project_preferences', origin: 'gui', projectId: project.id,
      payload: { starterId: 'checklist', testDisplayId: 'qa-monitor-1' },
    });
    assert.equal(runtime.workspaces.get(project.id).starterId, 'neon-rally',
      'preferences cannot mutate the app contract bound to the owned workspace marker');
    const visual = await runtime.command({
      id: commandId(), type: 'run_visual_checks', origin: 'gui', projectId: project.id,
      payload: { runId: build.runId, contractId: 'checklist' },
    });
    const checked = await runtime.waitForRun(visual.runId);
    assert.equal(checked.state, 'passed', 'injected manager result qualifies routing only, not browser behavior');
    assert.equal(checked.candidateRunId, build.runId);
    assert.equal(checked.visualChecks.contractId, 'neon-rally');
    assert.deepEqual(checked.checks.map((check) => check.name),
      ['Preview load', 'Target display', 'Score both teams', 'Change the look', 'Reset the scores']);
    const call = displayManager.calls.checks[0];
    assert.equal(call.contractId, 'neon-rally', 'trusted immutable project contract overrides untrusted command payload');
    assert.equal(call.projectId, project.id);
    assert.equal(call.preview.runId, build.runId);
    assert.equal(call.preview.candidateHash, candidate.source.hash);
  });

test('Neon Rally visual results reject a wrong or missing app contract and checklist-shaped checks',
  { timeout: 30000 }, async (t) => {
    let corrupt;
    const displayManager = recordingDisplayManager({
      onChecks(options, result) {
        const value = result(options);
        corrupt(value);
        return value;
      },
    });
    const { runtime } = runtimeFixture(t, { displayManager, defaultTestDisplayId: 'qa-monitor-1' });
    const project = await create(runtime, 'Rally visual evidence boundaries', 'neon-rally');
    const build = await runtime.command({ id: commandId(), type: 'run_checks', origin: 'gui', projectId: project.id });
    assert.equal((await runtime.waitForRun(build.runId)).state, 'passed');
    const variants = [
      ['wrong app contract', (result) => { result.contractId = 'checklist'; }],
      ['missing explicit Rally contract', (result) => { delete result.contractId; }],
      ['unknown app contract', (result) => { result.contractId = 'other-app'; }],
      ['checklist names under Rally contract', (result) => {
        result.checks = ['Preview load', 'Target display', 'Add two tasks', 'Complete a task', 'Remove a task']
          .map((name) => ({ name, state: 'passed', detail: 'Deliberately wrong app behavior evidence.' }));
      }],
    ];
    for (const [label, mutation] of variants) {
      corrupt = mutation;
      const receipt = await runtime.command({
        id: commandId(), type: 'run_visual_checks', origin: 'gui', projectId: project.id, payload: { runId: build.runId },
      });
      const result = await runtime.waitForRun(receipt.runId);
      assert.equal(result.state, 'failed', label);
      assert.equal(result.visualChecks.state, 'passed', 'negative fixture claims success so the contract guard must decide');
      assert.equal(result.projectId, project.id);
      assert.equal(result.candidateRunId, build.runId);
    }
    assert(displayManager.calls.checks.every((options) => options.contractId === 'neon-rally'));
    assert.equal(displayManager.calls.checks.length, variants.length);
    assert.equal(runtime.workspaces.get(project.id).starterId, 'neon-rally');
  });
