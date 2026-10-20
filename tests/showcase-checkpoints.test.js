'use strict';

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
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-checkpoints-')));
  const db = new DatabaseSync(':memory:'), store = new DistrictStore({ db });
  const workspaces = new Workspaces({ root: path.join(base, 'projects'), store });
  const checkpoints = new Checkpoints({ store, workspaces });
  const project = workspaces.create({ name: 'Recovery showcase fixture' });
  const files = new Set(), dirs = new Set([base, path.join(base, 'projects')]);
  function track(filename) {
    files.add(filename);
    for (let parent = path.dirname(filename); parent.startsWith(base + path.sep); parent = path.dirname(parent)) dirs.add(parent);
  }
  for (const relative of workspaces.files(project.id)) track(path.join(project.root, relative));
  track(path.join(project.root, '.agent-bus', 'workspace.json'));
  const create = checkpoints.create.bind(checkpoints);
  checkpoints.create = (...args) => {
    dirs.add(path.join(project.root, '.agent-bus', 'checkpoints'));
    const saved = create(...args), root = path.join(project.root, '.agent-bus', 'checkpoints', saved.id);
    track(path.join(root, 'manifest.json')); dirs.add(path.join(root, 'files'));
    for (const relative of saved.files) track(path.join(root, 'files', ...relative.split('/')));
    return saved;
  };
  function write(relative, content) { const result = workspaces.write(project.id, relative, content); track(path.join(project.root, relative)); return result; }
  t.after(() => {
    db.close();
    // Only literal, fixture-created paths; no recursive deletion or traversal.
    for (const filename of files) {
      try { const stat = fs.lstatSync(filename); if (stat.isFile() || stat.isSymbolicLink()) fs.unlinkSync(filename); }
      catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
    }
    for (const directory of [...dirs].sort((a, b) => b.length - a.length)) {
      try { fs.rmdirSync(directory); } catch (error) { if (!['ENOENT', 'ENOTDIR', 'ENOTEMPTY'].includes(error.code)) throw error; }
    }
  });
  return { base, db, store, workspaces, checkpoints, project, write, track };
}

test('inspect verifies exact saved project/source/run identity and bytes without changing current files', (t) => {
  const f = fixture(t); f.write('notes.txt', 'Saved notes\r\n\u2603');
  const manifest = f.workspaces.manifest(f.project.id);
  const saved = f.checkpoints.create(f.project.id, 'Checked fixture', {
    projectId: f.project.id, runId: 'run-checkpoint-fixture', artifact: { candidateHash: manifest.hash, manifest: manifest.files },
  });
  f.write('notes.txt', 'Current notes');
  const current = f.workspaces.manifest(f.project.id).hash;
  const result = f.checkpoints.inspect(f.project.id, saved.id, 'notes.txt');
  assert.equal(result.projectId, f.project.id); assert.equal(result.checkpointId, saved.id);
  assert.equal(result.integrity, 'verified'); assert.equal(result.sourceHash, saved.hash);
  assert.equal(result.attribution.runId, 'run-checkpoint-fixture');
  assert.equal(result.attribution.artifactCandidateHash, manifest.hash);
  assert.equal(result.attribution.artifactEvidence, 'supplied-metadata');
  assert.equal(result.file.content, 'Saved notes\r\n\u2603');
  assert.equal(result.file.hash, hash(Buffer.from(result.file.content)));
  assert.equal(f.workspaces.manifest(f.project.id).hash, current);
  assert.equal(f.checkpoints.list(f.project.id).length, 1);
  assert.throws(() => f.checkpoints.inspect(f.project.id, saved.id, '../outside.txt'), /path/);
  assert.throws(() => f.checkpoints.inspect(f.project.id, saved.id, 'absent.txt'), error => error.code === 'CHECKPOINT_FILE_NOT_FOUND');
});

test('creation rejects contradictory project, source and artifact attribution before publishing a checkpoint', (t) => {
  const f = fixture(t), actual = f.workspaces.manifest(f.project.id);
  const bad = [
    { projectId: 'project-other' }, { candidateHash: 'a'.repeat(64) }, { sourceHash: 'b'.repeat(64) },
    { artifact: { candidateHash: 'c'.repeat(64) } },
    { artifact: { candidateHash: actual.hash, manifest: { 'script.js': 'd'.repeat(64) } } },
  ];
  for (const metadata of bad) {
    assert.throws(() => f.checkpoints.create(f.project.id, 'False attribution', metadata), error => error.code === 'CHECKPOINT_ATTRIBUTION_MISMATCH');
  }
  assert.equal(f.store.list('checkpoint').length, 0);
  assert.equal(f.workspaces.manifest(f.project.id).hash, actual.hash);
  assert.equal(fs.existsSync(path.join(f.project.root, '.agent-bus', 'checkpoints')), false);
});

test('diff has stable complete identity/hash evidence while large display text is honestly bounded', (t) => {
  const f = fixture(t); f.write('large.txt', '\u2603'.repeat(100000)); f.write('deleted.txt', 'remove this');
  const saved = f.checkpoints.create(f.project.id, 'Large comparison');
  f.write('large.txt', '\u2602'.repeat(100000)); f.write('new.txt', 'new');
  fs.unlinkSync(f.workspaces.resolve(f.project.id, 'deleted.txt'));
  const diff = f.checkpoints.diff(f.project.id, saved.id), repeated = f.checkpoints.diff(f.project.id, saved.id);
  assert.deepEqual(diff.summary, { added: 1, modified: 1, deleted: 1 });
  assert.equal(diff.diffHash, repeated.diffHash); assert.match(diff.diffHash, /^[a-f0-9]{64}$/);
  assert.equal(diff.checkpoint.sourceHash, saved.hash); assert.equal(diff.current.projectId, f.project.id);
  assert.equal(diff.truncated, true);
  const large = diff.files.find(file => file.path === 'large.txt');
  assert.equal(large.beforeBytes, 300000); assert.equal(large.afterBytes, 300000);
  assert.equal(large.beforeHash, hash('\u2603'.repeat(100000)));
  assert.equal(large.afterHash, hash('\u2602'.repeat(100000)));
  assert(large.beforeTruncated && large.afterTruncated);
  assert(!large.before.includes('\ufffd')); assert(!large.after.includes('\ufffd'));
  assert(Buffer.byteLength(large.before) <= 64 * 1024);
  f.write('new.txt', 'another change');
  assert.notEqual(f.checkpoints.diff(f.project.id, saved.id).diffHash, diff.diffHash);
});

test('guarded restore rejects a stale comparison before archive or source mutation, then accepts a fresh one', (t) => {
  const f = fixture(t), saved = f.checkpoints.create(f.project.id, 'Baseline');
  f.write('index.html', '<h1>First candidate</h1>');
  const diff = f.checkpoints.diff(f.project.id, saved.id);
  f.write('index.html', '<h1>Later candidate</h1>');
  const later = f.workspaces.manifest(f.project.id).hash;
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id, diff.restoreGuard), error => {
    assert.equal(error.code, 'CHECKPOINT_STALE_COMPARISON'); assert.equal(error.stage, 'validate');
    assert.equal(error.partial, false); assert.equal(error.archiveId, undefined);
    assert.equal(error.projectId, f.project.id); assert.equal(error.recovery.action, 'inspect_diff');
    return true;
  });
  assert.equal(f.workspaces.manifest(f.project.id).hash, later);
  assert.equal(f.checkpoints.list(f.project.id).length, 1);
  const fresh = f.checkpoints.diff(f.project.id, saved.id);
  const result = f.checkpoints.restore(f.project.id, saved.id, fresh.restoreGuard);
  assert.equal(result.hash, saved.hash); assert.equal(result.beforeHash, later);
  assert.equal(result.checkpoint.sourceHash, saved.hash);
  assert.equal(result.recovery.checkpointId, result.archiveId);
  assert.equal(f.checkpoints.inspect(f.project.id, result.archiveId).sourceHash, later);
});

test('wrong target hash and malformed restore guards fail without modifying source', (t) => {
  const f = fixture(t), saved = f.checkpoints.create(f.project.id, 'Baseline');
  const original = f.workspaces.manifest(f.project.id).hash;
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id, { expectedCheckpointHash: 'a'.repeat(64) }), error => error.code === 'CHECKPOINT_STALE_COMPARISON');
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id, { expectedCurrentHash: 'bad' }), error => error.code === 'CHECKPOINT_GUARD_INVALID');
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id, { ignored: true }), error => error.code === 'CHECKPOINT_GUARD_INVALID');
  assert.equal(f.workspaces.manifest(f.project.id).hash, original); assert.equal(f.checkpoints.list(f.project.id).length, 1);
});

test('late external file edit is preserved instead of overwritten after restore starts', (t) => {
  const f = fixture(t), saved = f.checkpoints.create(f.project.id, 'Baseline');
  f.write('index.html', 'Edited HTML'); f.write('script.js', 'Edited script before archive');
  const rename = fs.renameSync; let caught, planted = false;
  fs.renameSync = (from, to) => {
    const result = rename(from, to);
    if (!planted && to === path.join(f.project.root, 'index.html') && path.basename(from).startsWith('restore-')) {
      planted = true; fs.writeFileSync(path.join(f.project.root, 'script.js'), 'Late edit that must survive');
    }
    return result;
  };
  try { f.checkpoints.restore(f.project.id, saved.id); } catch (error) { caught = error; }
  finally { fs.renameSync = rename; }
  assert(caught); assert.equal(caught.code, 'CHECKPOINT_SOURCE_CHANGED');
  assert.equal(caught.stage, 'restore-files'); assert.equal(caught.partial, true);
  assert.deepEqual(caught.changedPaths, ['index.html']); assert.equal(caught.path, 'script.js');
  assert.equal(f.workspaces.read(f.project.id, 'script.js'), 'Late edit that must survive');
  assert.equal(caught.recovery.action, 'inspect_saved_version');
  assert.equal(f.checkpoints.inspect(f.project.id, caught.archiveId, 'script.js').file.content, 'Edited script before archive');
});

test('saved baseline stays inspectable when current public files are unsafe to archive', (t) => {
  const f = fixture(t), saved = f.checkpoints.create(f.project.id, 'Baseline');
  const unsafe = path.join(f.project.root, 'unsupported.bin'); fs.writeFileSync(unsafe, 'preserve me'); f.track(unsafe);
  const inspected = f.checkpoints.inspect(f.project.id, saved.id, 'index.html');
  assert.equal(inspected.integrity, 'verified'); assert.equal(inspected.file.hash, saved.manifest.files['index.html']);
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id), error => {
    assert.equal(error.stage, 'validate'); assert.equal(error.partial, false); assert.equal(error.archiveId, undefined);
    assert.match(error.recovery.message, /No restore was applied/); return true;
  });
  assert.equal(fs.readFileSync(unsafe, 'utf8'), 'preserve me');
});

test('immutable saved attribution cannot be substituted through the mutable record store', (t) => {
  const f = fixture(t), saved = f.checkpoints.create(f.project.id, 'Baseline', { runId: 'actual-run' });
  const altered = f.store.get('checkpoint', saved.id); altered.metadata.runId = 'different-run';
  f.store.put('checkpoint', altered);
  assert.throws(() => f.checkpoints.inspect(f.project.id, saved.id), error => error.code === 'CHECKPOINT_RECORD_MISMATCH');
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id), error => error.code === 'CHECKPOINT_RECORD_MISMATCH' && error.partial === false);
});

test('archive storage failure provides an actionable no-mutation recovery state', (t) => {
  const f = fixture(t), saved = f.checkpoints.create(f.project.id, 'Baseline');
  f.write('index.html', 'Keep this edited source'); const before = f.workspaces.manifest(f.project.id).hash;
  const put = f.store.put.bind(f.store);
  f.store.put = (kind, record) => { if (kind === 'checkpoint' && record.metadata.kind === 'pre-restore') throw Object.assign(new Error('Injected storage fault'), { code: 'ENOSPC' }); return put(kind, record); };
  assert.throws(() => f.checkpoints.restore(f.project.id, saved.id), error => {
    assert.equal(error.code, 'CHECKPOINT_RESTORE_FAILED'); assert.equal(error.causeCode, 'ENOSPC');
    assert.equal(error.stage, 'archive'); assert.equal(error.partial, false); assert.equal(error.archiveId, undefined);
    assert.equal(error.recovery.action, 'inspect_diff'); return true;
  });
  assert.equal(f.workspaces.manifest(f.project.id).hash, before);
  assert.equal(f.checkpoints.list(f.project.id).length, 1);
});
