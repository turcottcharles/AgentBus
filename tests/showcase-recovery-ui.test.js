'use strict';

// Recovery command-boundary integration for the UI. Actual SQLite, source
// bytes, recipe, immutable artifact and loopback preview execute; no fake DOM,
// provider process, browser rendering, GPU or native window is qualified here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { DistrictRuntime } = require('../app/district/runtime');

const appRoot = path.resolve(__dirname, '..');
const command = (type, projectId, payload = {}) => ({
  id: crypto.randomUUID(), type, origin: 'gui', ...(projectId ? { projectId } : {}), payload,
});

function removeFixture(root) {
  // Enumerate the literal private fixture once, never follow a link, then
  // unlink/rmdir individual paths. There is no recursive-delete operation.
  assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir()));
  assert.match(path.basename(root), /^showcase-recovery-ui-/);
  assert.equal(fs.realpathSync.native(root), root);
  const pending = [root], files = [], dirs = [];
  while (pending.length) {
    const current = pending.pop(); dirs.push(current);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      assert(filename.startsWith(root + path.sep));
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(filename);
      else files.push(filename);
    }
  }
  for (const filename of files) fs.unlinkSync(filename);
  for (const directory of dirs.sort((a, b) => b.length - a.length)) fs.rmdirSync(directory);
}

function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-recovery-ui-')));
  const db = new DatabaseSync(':memory:');
  const runtime = new DistrictRuntime({ db, appRoot, workRoot: path.join(root, 'projects'),
    providerList: async () => [], agentStart: () => { throw new Error('Recovery fixture must never launch a provider'); } });
  t.after(async () => { await runtime.close(); db.close(); removeFixture(root); });
  return { root, db, runtime };
}

async function create(runtime, name) {
  const receipt = await runtime.command(command('create_project', null, { name, starterId: 'checklist' }));
  assert.equal(receipt.status, 'completed');
  return receipt.result;
}

async function checked(runtime, projectId) {
  const accepted = await runtime.command(command('run_checks', projectId));
  assert.equal(accepted.status, 'accepted');
  let timer;
  const run = await Promise.race([runtime.waitForRun(accepted.runId), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Local recovery fixture checks did not finish')), 15000);
  })]).finally(() => clearTimeout(timer));
  assert.equal(run.state, 'passed', run.output || run.detail);
  assert.equal(run.exitCode, 0); assert(run.artifact?.candidateHash);
  const preview = runtime.previewManager.list().find(item => item.projectId === projectId && item.runId === run.id);
  assert(preview, 'real local recipe must produce its actual HTTP preview');
  return { run, preview };
}

async function previewText(url) {
  const response = await fetch(url, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  return response.text();
}

test('GUI command authority rejects a stale comparison, then restores exact compared source and closes its old HTTP preview', { timeout: 25000 }, async (t) => {
  const { runtime } = fixture(t), { project, baseline } = await create(runtime, 'Guarded recovery');
  const before = runtime.workspaces.read(project.id, 'styles.css');
  runtime.workspaces.write(project.id, 'styles.css', before + '\n/* checked edited candidate */\n');
  const { run, preview } = await checked(runtime, project.id);
  assert.match(await previewText(preview.url), /data-testid="task-input"/);
  const compared = await runtime.command(command('inspect_diff', project.id, { checkpointId: baseline.id }));
  assert.equal(compared.result.projectId, project.id);
  assert.equal(compared.result.checkpoint.checkpointId, baseline.id);
  assert.equal(compared.result.current.sourceHash, run.artifact.candidateHash);
  assert.equal(compared.result.restoreGuard.expectedCheckpointHash, baseline.hash);

  runtime.workspaces.write(project.id, 'styles.css', before + '\n/* later source after comparison */\n');
  const laterHash = runtime.workspaces.manifest(project.id).hash;
  const countBefore = runtime.checkpoints.list(project.id).length;
  await assert.rejects(runtime.command(command('restore_checkpoint', project.id, {
    checkpointId: baseline.id, ...compared.result.restoreGuard,
  })), error => {
    assert.equal(error.code, 'CHECKPOINT_STALE_COMPARISON');
    assert.equal(error.partial, false); assert.equal(error.projectId, project.id);
    assert.equal(error.checkpointId, baseline.id); assert.equal(error.archiveId, undefined);
    assert.match(error.message, /comparison|diff/i); return true;
  });
  assert.equal(runtime.workspaces.manifest(project.id).hash, laterHash);
  assert.equal(runtime.checkpoints.list(project.id).length, countBefore);
  const prior = (await runtime.snapshot()).previews.find(item => item.id === preview.id);
  assert.equal(prior.stale, true, 'failed restore preserves but marks the prior output stale');
  assert.match(await previewText(preview.url), /data-testid="task-input"/);

  const fresh = await runtime.command(command('inspect_diff', project.id, { checkpointId: baseline.id }));
  const restoreCommand = command('restore_checkpoint', project.id, {
    checkpointId: baseline.id, ...fresh.result.restoreGuard, expectedDiffHash: fresh.result.diffHash,
  });
  const restored = await runtime.command(restoreCommand);
  assert.equal(restored.status, 'completed'); assert.equal(restored.projectId, project.id);
  assert.equal(restored.result.hash, baseline.hash); assert.equal(restored.result.beforeHash, laterHash);
  assert.equal(runtime.workspaces.manifest(project.id).hash, baseline.hash);
  assert.equal(runtime.checkpoints.inspect(project.id, restored.result.archiveId).sourceHash, laterHash);
  assert.equal(runtime.previewManager.list().some(item => item.projectId === project.id), false);
  await assert.rejects(fetch(preview.url, { signal: AbortSignal.timeout(3000) }), /fetch failed|ECONNREFUSED/);
  const after = await runtime.snapshot();
  assert.equal(after.runs.length, 1, 'restore creates no synthetic check run or pass');
  assert.equal(after.runs[0].id, run.id); assert.equal(after.runs[0].artifact.candidateHash, preview.candidateHash);
  assert.notEqual(after.runs[0].artifact.candidateHash, after.projects[0].manifest.hash,
    'earlier successful checks remain attached to their historical source candidate');
  const savedCount = after.checkpoints.length;
  assert.deepEqual(await runtime.command(restoreCommand), restored, 'duplicate UI submission reuses its actual receipt');
  assert.equal((await runtime.snapshot()).checkpoints.length, savedCount);
  assert.equal(runtime.store.events(0, 10000).filter(event => event.type === 'workspace_restored').length, 1);
});

test('GUI comparison and restore reject a checkpoint owned by another project without changing either source', async (t) => {
  const { runtime } = fixture(t), left = await create(runtime, 'Left'), right = await create(runtime, 'Right');
  const leftHash = runtime.workspaces.manifest(left.project.id).hash, rightHash = runtime.workspaces.manifest(right.project.id).hash;
  await assert.rejects(runtime.command(command('inspect_diff', right.project.id, { checkpointId: left.baseline.id })), error => error.code === 'CHECKPOINT_SCOPE_MISMATCH');
  await assert.rejects(runtime.command(command('restore_checkpoint', right.project.id, {
    checkpointId: left.baseline.id, expectedCurrentHash: rightHash, expectedCheckpointHash: left.baseline.hash,
  })), error => error.code === 'CHECKPOINT_SCOPE_MISMATCH' && error.partial === false);
  assert.equal(runtime.workspaces.manifest(left.project.id).hash, leftHash);
  assert.equal(runtime.workspaces.manifest(right.project.id).hash, rightHash);
  assert.equal((await runtime.snapshot()).checkpoints.length, 2);
});

test('a displayed comparison cannot authorize another checkpoint even when its saved source hash is identical', async (t) => {
  const { runtime } = fixture(t), { project, baseline } = await create(runtime, 'Comparison identity');
  const second = await runtime.command(command('create_checkpoint', project.id, { label: 'Same bytes, another baseline' }));
  assert.equal(second.result.hash, baseline.hash); assert.notEqual(second.result.id, baseline.id);
  runtime.workspaces.write(project.id, 'index.html', '<h1>Current compared source</h1>');
  const current = runtime.workspaces.manifest(project.id).hash;
  const firstDiff = await runtime.command(command('inspect_diff', project.id, { checkpointId: baseline.id }));
  await assert.rejects(runtime.command(command('restore_checkpoint', project.id, {
    checkpointId: second.result.id, ...firstDiff.result.restoreGuard, expectedDiffHash: firstDiff.result.diffHash,
  })), /comparison changed|Compare this baseline again/i);
  assert.equal(runtime.workspaces.manifest(project.id).hash, current);
  assert.equal(runtime.checkpoints.list(project.id).length, 2, 'wrong comparison must not even create a recovery archive');
  const secondDiff = await runtime.command(command('inspect_diff', project.id, { checkpointId: second.result.id }));
  assert.equal(secondDiff.result.beforeHash, firstDiff.result.beforeHash);
  assert.equal(secondDiff.result.afterHash, firstDiff.result.afterHash);
  assert.notEqual(secondDiff.result.diffHash, firstDiff.result.diffHash,
    'the compared checkpoint identity is part of the authority evidence');
});

test('partial restore failure at the GUI command boundary retains inspectable project-bound archive diagnostics', async (t) => {
  const { runtime } = fixture(t), { project, baseline } = await create(runtime, 'Interrupted restore');
  runtime.workspaces.write(project.id, 'index.html', '<h1>Edited local source</h1>');
  runtime.workspaces.write(project.id, 'script.js', '// keep edited source in archive\n');
  const compared = await runtime.command(command('inspect_diff', project.id, { checkpointId: baseline.id }));
  const beforeHash = runtime.workspaces.manifest(project.id).hash;
  const rename = fs.renameSync; let failure;
  fs.renameSync = (from, to) => {
    if (path.basename(from).startsWith('restore-') && to === path.join(project.root, 'script.js')) {
      throw Object.assign(new Error('Injected owned-file write refusal'), { code: 'EACCES' });
    }
    return rename(from, to);
  };
  try { await runtime.command(command('restore_checkpoint', project.id, {
    checkpointId: baseline.id, ...compared.result.restoreGuard, expectedDiffHash: compared.result.diffHash,
  })); }
  catch (error) { failure = error; }
  finally { fs.renameSync = rename; }
  assert(failure); assert.equal(failure.partial, true); assert.equal(failure.stage, 'restore-files');
  assert.equal(failure.code, 'CHECKPOINT_RESTORE_FAILED'); assert.equal(failure.causeCode, 'EACCES');
  assert.equal(failure.projectId, project.id); assert.equal(failure.checkpointId, baseline.id);
  assert.deepEqual(failure.changedPaths, ['index.html']);
  assert.match(failure.message, /archived as checkpoint-/); assert.match(failure.message, /write refusal/);
  assert.equal(failure.recovery.projectId, project.id); assert.equal(failure.recovery.checkpointId, failure.archiveId);
  assert.equal(failure.recovery.action, 'inspect_saved_version');
  assert.equal(runtime.checkpoints.inspect(project.id, failure.archiveId).sourceHash, beforeHash);
  assert.equal(runtime.checkpoints.inspect(project.id, failure.archiveId, 'script.js').file.content, '// keep edited source in archive\n');
  assert.equal(runtime.store.events(0, 10000).filter(event => event.type === 'workspace_restored').length, 0,
    'partial failure cannot publish successful recovery');
});
