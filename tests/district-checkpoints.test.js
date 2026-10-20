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

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const snapshotRoot = (project, checkpoint) => path.join(project.root, '.agent-bus', 'checkpoints', checkpoint.id);

function fixture(t) {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-checkpoints-')));
  const db = new DatabaseSync(':memory:');
  const store = new DistrictStore({ db });
  const workspaces = new Workspaces({ root: path.join(base, 'projects'), store });
  const checkpoints = new Checkpoints({ store, workspaces });
  const knownFiles = new Set(), knownDirs = new Set([base, path.join(base, 'projects')]);
  function trackFile(filename) {
    knownFiles.add(filename);
    for (let dir = path.dirname(filename); dir !== base && dir.startsWith(base + path.sep); dir = path.dirname(dir)) knownDirs.add(dir);
  }
  function createProject(name = 'Checkpoint fixture') {
    const project = workspaces.create({ name });
    for (const relative of workspaces.files(project.id)) trackFile(path.join(project.root, relative));
    trackFile(path.join(project.root, '.agent-bus', 'workspace.json'));
    return project;
  }
  const createCheckpoint = checkpoints.create.bind(checkpoints);
  checkpoints.create = (...args) => {
    const project = workspaces.get(args[0]);
    knownDirs.add(path.join(project.root, '.agent-bus', 'checkpoints'));
    const checkpoint = createCheckpoint(...args);
    const root = snapshotRoot(project, checkpoint);
    trackFile(path.join(root, 'manifest.json'));
    for (const relative of checkpoint.files) trackFile(path.join(root, 'files', ...relative.split('/')));
    knownDirs.add(path.join(root, 'files'));
    return checkpoint;
  };
  function write(project, relative, content) {
    const result = workspaces.write(project.id, relative, content);
    trackFile(workspaces.resolve(project.id, relative));
    return result;
  }
  t.after(() => {
    db.close();
    // Exact fixture-owned paths only. Never remove a directory recursively or
    // follow an unexpected link while cleaning a test.
    for (const filename of knownFiles) {
      try { const stat = fs.lstatSync(filename); if (stat.isFile() || stat.isSymbolicLink()) fs.unlinkSync(filename); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
    }
    for (const dir of [...knownDirs].sort((a, b) => b.length - a.length)) {
      try { fs.rmdirSync(dir); } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'ENOTDIR'].includes(error.code)) throw error; }
    }
  });
  return { base, db, store, workspaces, checkpoints, createProject, write, trackFile, knownDirs };
}

test('checkpoint saves actual source bytes, canonical manifest and a reopenable immutable baseline', (t) => {
  const f = fixture(t), project = f.createProject();
  f.write(project, 'nested/notes.txt', 'real baseline\r\n\u2603\n');
  const expected = f.workspaces.manifest(project.id);
  const metadata = { runId: 'run-fixture', artifact: { candidateHash: expected.hash } };
  const saved = f.checkpoints.create(project.id, 'Before editing', metadata);
  assert.equal(saved.hash, expected.hash);
  assert.deepEqual(saved.manifest.files, expected.files);
  const disk = path.join(snapshotRoot(project, saved), 'files', 'nested', 'notes.txt');
  assert.deepEqual(fs.readFileSync(disk), Buffer.from('real baseline\r\n\u2603\n'));
  assert.equal(hash(fs.readFileSync(disk)), saved.manifest.files['nested/notes.txt']);
  metadata.artifact.candidateHash = 'changed'; saved.manifest.files['nested/notes.txt'] = 'changed';
  f.write(project, 'nested/notes.txt', 'new source');
  const reopened = new Checkpoints({ store: f.store, workspaces: f.workspaces });
  assert.equal(reopened.list(project.id)[0].metadata.artifact.candidateHash, expected.hash);
  assert.equal(reopened.diff(project.id, saved.id).files[0].before, 'real baseline\r\n\u2603\n');
  assert.deepEqual(fs.readFileSync(disk), Buffer.from('real baseline\r\n\u2603\n'));
});

test('real diff distinguishes additions, modifications and deletions with exact hashes', (t) => {
  const f = fixture(t), project = f.createProject();
  f.write(project, 'deleted.txt', 'old deleted\n');
  f.write(project, 'modified.txt', 'old modified\n');
  const saved = f.checkpoints.create(project.id, 'Diff baseline');
  assert.equal(f.checkpoints.diff(project.id, saved.id).changed, 0);
  fs.unlinkSync(f.workspaces.resolve(project.id, 'deleted.txt'));
  f.write(project, 'modified.txt', 'new modified\n');
  f.write(project, 'added.txt', 'actually added\n');
  const result = f.checkpoints.diff(project.id, saved.id);
  assert.deepEqual(result.files.map((file) => [file.path, file.status]), [
    ['added.txt', 'added'], ['deleted.txt', 'deleted'], ['modified.txt', 'modified'],
  ]);
  assert.equal(result.files[0].before, null);
  assert.equal(result.files[0].after, 'actually added\n');
  assert.equal(result.files[1].after, null);
  assert.equal(result.files[1].beforeHash, hash('old deleted\n'));
  assert.equal(result.files[2].afterHash, hash('new modified\n'));
  assert.equal(result.afterHash, f.workspaces.manifest(project.id).hash);
});

test('restore archives current bytes first, restores/deletes only managed files, and the archive restores too', (t) => {
  const f = fixture(t), project = f.createProject();
  const baseline = f.checkpoints.create(project.id, 'Original');
  f.write(project, 'index.html', '<!doctype html><h1>Edited candidate</h1>');
  f.write(project, 'extra.txt', 'new source to preserve');
  fs.unlinkSync(f.workspaces.resolve(project.id, 'styles.css'));
  const edited = f.workspaces.manifest(project.id);
  const internal = path.join(project.root, '.agent-bus', 'keep.txt');
  fs.writeFileSync(internal, 'unrelated internal evidence'); f.trackFile(internal);
  const outside = path.join(f.base, 'outside.txt'); fs.writeFileSync(outside, 'outside bytes'); f.trackFile(outside);
  const result = f.checkpoints.restore(project.id, baseline.id);
  assert.equal(result.restored, true);
  assert.equal(result.hash, baseline.hash);
  assert.equal(f.workspaces.manifest(project.id).hash, baseline.hash);
  assert.equal(fs.existsSync(path.join(project.root, 'extra.txt')), false);
  assert(fs.existsSync(path.join(project.root, 'styles.css')));
  const archive = f.checkpoints.list(project.id).find((entry) => entry.id === result.archiveId);
  assert.equal(archive.hash, edited.hash);
  assert.equal(archive.metadata.kind, 'pre-restore');
  assert.equal(archive.metadata.targetCheckpointId, baseline.id);
  assert.equal(fs.readFileSync(internal, 'utf8'), 'unrelated internal evidence');
  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside bytes');
  assert.equal(f.checkpoints.restore(project.id, result.archiveId).hash, edited.hash);
  assert.equal(f.workspaces.read(project.id, 'extra.txt'), 'new source to preserve');
});

test('tampered saved source is refused before archiving or changing current files', (t) => {
  const f = fixture(t), project = f.createProject();
  const baseline = f.checkpoints.create(project.id, 'Baseline');
  f.write(project, 'index.html', 'current safe source');
  const current = f.workspaces.manifest(project.id);
  fs.writeFileSync(path.join(snapshotRoot(project, baseline), 'files', 'script.js'), 'tampered checkpoint bytes');
  assert.throws(() => f.checkpoints.restore(project.id, baseline.id), /integrity verification/);
  assert.throws(() => f.checkpoints.diff(project.id, baseline.id), /integrity verification/);
  assert.equal(f.checkpoints.list(project.id).length, 1);
  assert.equal(f.workspaces.manifest(project.id).hash, current.hash);
});

test('disk manifest tamper, cross-project restore and identity traversal are refused', (t) => {
  const f = fixture(t), project = f.createProject(), other = f.createProject('Other project');
  const baseline = f.checkpoints.create(project.id, 'Baseline');
  const current = f.workspaces.manifest(project.id).hash;
  assert.throws(() => f.checkpoints.restore(other.id, baseline.id), /belong/);
  assert.throws(() => f.checkpoints.restore(project.id, '../outside'), /identity/);
  assert.throws(() => f.checkpoints.restore(project.id, 'checkpoint-00000000-0000-0000-0000-000000000000'), /belong/);
  const filename = path.join(snapshotRoot(project, baseline), 'manifest.json');
  const changed = JSON.parse(fs.readFileSync(filename, 'utf8'));
  changed.projectId = other.id;
  fs.writeFileSync(filename, JSON.stringify(changed));
  assert.throws(() => f.checkpoints.restore(project.id, baseline.id), /metadata integrity/);
  assert.equal(f.workspaces.manifest(project.id).hash, current);
});

test('saved hard links are rejected and never modify their external target', (t) => {
  const f = fixture(t), project = f.createProject();
  const baseline = f.checkpoints.create(project.id, 'Baseline');
  const outside = path.join(f.base, 'outside.txt'); fs.writeFileSync(outside, 'protected outside source'); f.trackFile(outside);
  const linked = path.join(snapshotRoot(project, baseline), 'files', 'index.html');
  fs.unlinkSync(linked); fs.linkSync(outside, linked);
  assert.throws(() => f.checkpoints.restore(project.id, baseline.id), /without links/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'protected outside source');
  assert.equal(f.checkpoints.list(project.id).length, 1);
});

test('checkpoint internal junction/symlink escapes are rejected without touching the target', (t) => {
  const f = fixture(t), project = f.createProject();
  const outside = path.join(f.base, 'outside'); fs.mkdirSync(outside); f.knownDirs.add(outside);
  const sentinel = path.join(outside, 'keep.txt'); fs.writeFileSync(sentinel, 'outside sentinel'); f.trackFile(sentinel);
  const link = path.join(project.root, '.agent-bus', 'checkpoints');
  try { fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Directory links unavailable on this host.'); return; } throw error; }
  f.trackFile(link);
  assert.throws(() => f.checkpoints.create(project.id, 'Unsafe'), /link|directory/i);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'outside sentinel');
  assert.deepEqual(fs.readdirSync(outside), ['keep.txt']);
  assert.equal(f.store.list('checkpoint').length, 0);
});

test('capture notices an actual source edit during its copy and publishes no false checkpoint', (t) => {
  const f = fixture(t), project = f.createProject();
  const resolve = f.workspaces.resolve.bind(f.workspaces);
  let changed = false;
  f.workspaces.resolve = (projectId, relative) => {
    const filename = resolve(projectId, relative);
    if (relative === 'styles.css' && !changed) {
      changed = true; fs.writeFileSync(resolve(projectId, 'index.html'), '<h1>Concurrent edit</h1>');
    }
    return filename;
  };
  assert.throws(() => f.checkpoints.create(project.id, 'Racing capture'), /changed during checkpoint/);
  assert.equal(f.store.list('checkpoint').length, 0);
  assert.deepEqual(fs.readdirSync(path.join(project.root, '.agent-bus', 'checkpoints')), []);
  assert.equal(f.workspaces.read(project.id, 'index.html'), '<h1>Concurrent edit</h1>');
});

test('failed restore retains a verified pre-restore archive for exact recovery', (t) => {
  const f = fixture(t), project = f.createProject();
  const baseline = f.checkpoints.create(project.id, 'Baseline');
  f.write(project, 'index.html', 'edited html'); f.write(project, 'script.js', 'edited js');
  const edited = f.workspaces.manifest(project.id).hash;
  const rename = fs.renameSync;
  let caught;
  fs.renameSync = (from, to) => {
    if (to === path.join(project.root, 'script.js') && path.basename(from).startsWith('restore-')) {
      const error = new Error('Injected restore write fault'); error.code = 'EACCES'; throw error;
    }
    return rename(from, to);
  };
  try { f.checkpoints.restore(project.id, baseline.id); } catch (error) { caught = error; }
  finally { fs.renameSync = rename; }
  assert(caught); assert.match(caught.message, /Injected restore write fault/);
  assert.match(caught.archiveId, /^checkpoint-/);
  const archive = f.checkpoints.list(project.id).find((entry) => entry.id === caught.archiveId);
  assert.equal(archive.hash, edited);
  assert.equal(f.checkpoints.restore(project.id, archive.id).hash, edited);
});

test('byte snapshots and restore preserve invalid UTF-8 without silently replacing bytes', (t) => {
  const f = fixture(t), project = f.createProject();
  f.write(project, 'bytes.txt', 'placeholder');
  const filename = f.workspaces.resolve(project.id, 'bytes.txt');
  const original = Buffer.from([0, 0xff, 0xc3, 0x28, 13, 10]); fs.writeFileSync(filename, original);
  const baseline = f.checkpoints.create(project.id, 'Exact bytes');
  f.write(project, 'bytes.txt', 'new UTF-8 content');
  const diff = f.checkpoints.diff(project.id, baseline.id).files.find((entry) => entry.path === 'bytes.txt');
  assert.equal(diff.beforeEncoding, 'base64');
  assert.deepEqual(Buffer.from(diff.before, 'base64'), original);
  f.checkpoints.restore(project.id, baseline.id);
  assert.deepEqual(fs.readFileSync(filename), original);
});

test('rejected persistence cleans only newly created snapshot files and keeps the current source', (t) => {
  const f = fixture(t), project = f.createProject();
  const original = f.workspaces.manifest(project.id).hash;
  const put = f.store.put.bind(f.store);
  f.store.put = (kind, record) => { if (kind === 'checkpoint') throw new Error('Injected persistence failure'); return put(kind, record); };
  assert.throws(() => f.checkpoints.create(project.id, 'Cannot publish'), /persistence failure/);
  assert.equal(f.workspaces.manifest(project.id).hash, original);
  assert.deepEqual(fs.readdirSync(path.join(project.root, '.agent-bus', 'checkpoints')), []);
  assert.equal(f.store.list('checkpoint').length, 0);
});
