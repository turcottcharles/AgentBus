'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isUtf8 } = require('node:buffer');

const MAX_FILES = 32;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * MAX_FILE_BYTES;
const MAX_MANIFEST_BYTES = 64 * 1024;
const DIFF_TEXT_BYTES = 256 * 1024;
const DIFF_FILE_TEXT_BYTES = 64 * 1024;
const ID = /^checkpoint-[a-f0-9-]{36}$/;
const HASH = /^[a-f0-9]{64}$/;
const EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg']);
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));

function checkpointError(message, code, details = {}) {
  return Object.assign(new Error(message), { name: 'CheckpointError', code, ...details });
}

function coverage() {
  return { scope: 'managed-public-source-files',
    excluded: ['Internal artifacts and saved versions', 'Git history', 'Provider conversations and memory', 'External actions and services'] };
}

function attribution(metadata, projectId, manifest) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw checkpointError('Checkpoint metadata must be a JSON object.', 'CHECKPOINT_METADATA_INVALID');
  }
  if (Object.hasOwn(metadata, 'projectId') && metadata.projectId !== projectId) {
    throw checkpointError('Checkpoint metadata names a different project.', 'CHECKPOINT_ATTRIBUTION_MISMATCH');
  }
  if (Object.hasOwn(metadata, 'runId') && (typeof metadata.runId !== 'string' || !metadata.runId.trim() ||
      metadata.runId.length > 160 || /[\x00-\x1f\x7f]/.test(metadata.runId))) {
    throw checkpointError('Checkpoint run identity must be a bounded nonempty string.', 'CHECKPOINT_METADATA_INVALID');
  }
  for (const claimed of [metadata.sourceHash, metadata.candidateHash, metadata.artifact?.candidateHash]) {
    if (claimed !== undefined && (!HASH.test(claimed) || claimed !== manifest.hash)) {
      throw checkpointError('The checkpoint candidate claim does not match the actual saved source bytes.', 'CHECKPOINT_ATTRIBUTION_MISMATCH');
    }
  }
  if (Object.hasOwn(metadata, 'artifact')) {
    const artifact = metadata.artifact;
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) || !HASH.test(artifact.candidateHash || '')) {
      throw checkpointError('Artifact metadata needs the candidate hash of these source files.', 'CHECKPOINT_METADATA_INVALID');
    }
    if (artifact.manifest !== undefined) {
      validateManifest({ files: artifact.manifest, hash: manifestFor(artifact.manifest || {}).hash });
      if (manifestFor(artifact.manifest).hash !== manifest.hash) {
        throw checkpointError('The artifact file manifest does not match these saved source files.', 'CHECKPOINT_ATTRIBUTION_MISMATCH');
      }
    }
  }
  return { projectId, sourceHash: manifest.hash, runId: metadata.runId || null,
    artifactCandidateHash: metadata.artifact?.candidateHash || null,
    basis: 'verified-source-bytes', artifactEvidence: metadata.artifact ? 'supplied-metadata' : null };
}

function excerpt(bytes, available) {
  if (!bytes) return { text: null, encoding: null, truncated: false, consumed: 0 };
  const utf8 = isUtf8(bytes);
  let prefix = bytes.subarray(0, Math.min(bytes.length, available, DIFF_FILE_TEXT_BYTES));
  // Never present a replacement character merely because the display cap split
  // a valid UTF-8 character. The full byte hash remains the comparison authority.
  if (utf8) while (prefix.length && !isUtf8(prefix)) prefix = prefix.subarray(0, -1);
  const encoding = utf8 ? 'utf8' : 'base64';
  return { text: prefix.toString(encoding), encoding,
    truncated: prefix.length < bytes.length, consumed: prefix.length };
}

function filePath(relative) {
  if (typeof relative !== 'string' || relative.length === 0 || relative.length > 240 ||
      relative.includes('\\') || /[\x00-\x1f\x7f<>:"|?*]/.test(relative) ||
      path.posix.isAbsolute(relative)) throw new Error('Invalid checkpoint file path.');
  const parts = relative.split('/');
  if (parts.length > 9) throw new Error('Checkpoint file path is too deeply nested.');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) ||
      /^(?:\.agent-bus|\.git)$/i.test(part) ||
      /^(?:con|prn|aux|nul|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3]|conin\$|conout\$)(?:\.|$)/i.test(part))) {
    throw new Error('Invalid checkpoint file path.');
  }
  if (!EXTENSIONS.has(path.posix.extname(relative).toLowerCase())) {
    throw new Error('Unsupported checkpoint file type.');
  }
  return relative;
}

function regularFile(filename, maxBytes = MAX_FILE_BYTES) {
  const stat = fs.lstatSync(filename);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes) {
    throw new Error('Checkpoint requires a bounded regular file without links.');
  }
  return stat;
}

function readFile(filename, maxBytes = MAX_FILE_BYTES) {
  const before = regularFile(filename, maxBytes);
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.size > maxBytes ||
        opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error('Checkpoint file changed while it was opened.');
    }
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    const bytes = buffer.subarray(0, length);
    const after = fs.fstatSync(fd);
    if (bytes.length > maxBytes || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) {
      throw new Error('Checkpoint file changed while it was read.');
    }
    return bytes;
  } finally { fs.closeSync(fd); }
}

function writeNew(filename, bytes) {
  const fd = fs.openSync(filename, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function directory(filename) {
  const stat = fs.lstatSync(filename);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Checkpoint directory must not be a link.');
  if (path.resolve(fs.realpathSync(filename)) !== path.resolve(filename)) {
    throw new Error('Checkpoint directory escaped its owned workspace.');
  }
}

function manifestFor(files) {
  const sorted = Object.create(null);
  for (const name of Object.keys(files).sort()) sorted[name] = files[name];
  return { files: sorted, hash: digest(JSON.stringify(sorted)), at: Date.now() };
}

function validateManifest(manifest) {
  if (!manifest || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files) ||
      !HASH.test(manifest.hash || '')) throw new Error('Invalid checkpoint manifest.');
  const names = Object.keys(manifest.files);
  if (names.length > MAX_FILES) throw new Error('Checkpoint file count exceeds the workspace limit.');
  const folded = new Set();
  for (const name of names) {
    filePath(name);
    const key = name.toLowerCase();
    if (folded.has(key)) throw new Error('Checkpoint has colliding file names.');
    folded.add(key);
    if (!HASH.test(manifest.files[name])) throw new Error('Invalid checkpoint file hash.');
  }
  if (manifestFor(manifest.files).hash !== manifest.hash) throw new Error('Checkpoint manifest hash does not match.');
}

class Checkpoints {
  constructor({ store, workspaces }) {
    if (!store || !workspaces) throw new Error('Checkpoints needs a store and owned workspaces.');
    this.store = store;
    this.workspaces = workspaces;
  }

  _scope(projectId, create = false) {
    const project = this.workspaces.get(projectId);
    if (!project || project.id !== projectId || typeof project.root !== 'string' || !path.isAbsolute(project.root)) {
      throw new Error('Unknown owned project.');
    }
    // get() revalidates the generated-root ownership marker. Inspecting a good
    // saved version must remain possible when current public files are broken.
    directory(project.root);
    const internal = path.join(project.root, '.agent-bus');
    directory(internal);
    const checkpoints = path.join(internal, 'checkpoints');
    if (!fs.existsSync(checkpoints)) {
      // existsSync is false for a dangling symlink, so lstat must distinguish it.
      try { fs.lstatSync(checkpoints); throw new Error('Invalid checkpoint directory.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (create) fs.mkdirSync(checkpoints, { mode: 0o700 });
    }
    if (fs.existsSync(checkpoints)) directory(checkpoints);
    return { project, checkpoints };
  }

  _capture(projectId) {
    const { project } = this._scope(projectId);
    const names = this.workspaces.files(projectId).slice().sort();
    if (names.length > MAX_FILES) throw new Error('Checkpoint file count exceeds the workspace limit.');
    const files = Object.create(null), bytes = new Map();
    let total = 0;
    for (const relative of names) {
      filePath(relative);
      const filename = this.workspaces.resolve(projectId, relative);
      const content = readFile(filename);
      total += content.length;
      if (total > MAX_TOTAL_BYTES) throw new Error('Checkpoint bytes exceed the workspace limit.');
      files[relative] = digest(content);
      bytes.set(relative, content);
    }
    const manifest = manifestFor(files);
    validateManifest(manifest);
    return { project, bytes, manifest };
  }

  create(projectId, label, metadata = {}) {
    if (typeof label !== 'string' || !label.trim() || label.length > 160) {
      throw new Error('Checkpoint label must contain 1 to 160 characters.');
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid checkpoint metadata.');
    const metadataText = JSON.stringify(metadata);
    if (Buffer.byteLength(metadataText) > 16 * 1024) throw new Error('Checkpoint metadata is too large.');
    const snapshot = this._capture(projectId);
    const copiedMetadata = JSON.parse(metadataText);
    attribution(copiedMetadata, projectId, snapshot.manifest);
    const { checkpoints } = this._scope(projectId, true);
    const id = `checkpoint-${crypto.randomUUID()}`;
    if (this.store.get('checkpoint', id)) throw new Error('Checkpoint identity already exists.');
    const root = path.join(checkpoints, id);
    const filesRoot = path.join(root, 'files');
    const createdFiles = [], createdDirs = [];
    const mkdir = (dir) => {
      if (fs.existsSync(dir)) { directory(dir); return; }
      fs.mkdirSync(dir, { mode: 0o700 }); createdDirs.push(dir);
    };
    try {
      // Snapshot identities are create-only, including abandoned disk folders.
      fs.mkdirSync(root, { mode: 0o700 }); createdDirs.push(root);
      mkdir(filesRoot);
      for (const [relative, content] of snapshot.bytes) {
        let parent = filesRoot;
        for (const component of relative.split('/').slice(0, -1)) { parent = path.join(parent, component); mkdir(parent); }
        const filename = path.join(filesRoot, ...relative.split('/'));
        writeNew(filename, content); createdFiles.push(filename);
        if (digest(readFile(filename)) !== snapshot.manifest.files[relative]) throw new Error('Checkpoint copy verification failed.');
      }
      const now = this._capture(projectId);
      if (now.manifest.hash !== snapshot.manifest.hash) throw new Error('Workspace changed during checkpoint capture.');
      const record = {
        version: 1, id, projectId, label: label.trim(), created: Date.now(),
        hash: snapshot.manifest.hash, manifest: snapshot.manifest,
        files: Object.keys(snapshot.manifest.files), metadata: copiedMetadata,
      };
      const text = JSON.stringify(record);
      const manifestPath = path.join(root, 'manifest.json');
      writeNew(manifestPath, text); createdFiles.push(manifestPath);
      record.manifestHash = digest(text);
      this.store.put('checkpoint', clone(record));
      return clone(record);
    } catch (error) {
      // Remove only the exact internal files this failed capture created; never recurse.
      for (const filename of createdFiles.reverse()) { try { fs.unlinkSync(filename); } catch {} }
      for (const dir of createdDirs.reverse()) { try { fs.rmdirSync(dir); } catch {} }
      throw error;
    }
  }

  list(projectId) {
    this._scope(projectId);
    return this.store.list('checkpoint').filter((record) => record.projectId === projectId)
      .sort((a, b) => b.created - a.created || a.id.localeCompare(b.id)).map(clone);
  }

  _load(projectId, checkpointId) {
    if (!ID.test(checkpointId || '')) throw checkpointError('Invalid checkpoint identity.', 'CHECKPOINT_ID_INVALID');
    const { checkpoints } = this._scope(projectId);
    const record = this.store.get('checkpoint', checkpointId);
    if (!record || record.id !== checkpointId || record.projectId !== projectId) {
      throw checkpointError('Checkpoint does not belong to this project.', 'CHECKPOINT_SCOPE_MISMATCH');
    }
    const root = path.join(checkpoints, checkpointId);
    directory(root);
    const filesRoot = path.join(root, 'files');
    directory(filesRoot);
    const text = readFile(path.join(root, 'manifest.json'), MAX_MANIFEST_BYTES);
    if (!HASH.test(record.manifestHash || '') || digest(text) !== record.manifestHash) {
      throw checkpointError('Checkpoint metadata integrity verification failed.', 'CHECKPOINT_INTEGRITY_FAILED');
    }
    const saved = JSON.parse(text.toString('utf8'));
    if (saved.version !== 1 || saved.id !== checkpointId || saved.projectId !== projectId ||
        saved.hash !== record.hash || JSON.stringify(saved.manifest) !== JSON.stringify(record.manifest)) {
      throw checkpointError('Checkpoint scope or manifest verification failed.', 'CHECKPOINT_INTEGRITY_FAILED');
    }
    for (const key of ['label', 'created', 'files', 'metadata']) {
      if (JSON.stringify(saved[key]) !== JSON.stringify(record[key])) {
        throw checkpointError('Checkpoint record no longer matches its immutable saved metadata.', 'CHECKPOINT_RECORD_MISMATCH');
      }
    }
    validateManifest(saved.manifest);
    if (saved.hash !== saved.manifest.hash) throw new Error('Checkpoint identity hash does not match.');
    attribution(saved.metadata, projectId, saved.manifest);
    const bytes = new Map();
    let total = 0;
    for (const relative of Object.keys(saved.manifest.files)) {
      let parent = filesRoot;
      for (const component of relative.split('/').slice(0, -1)) { parent = path.join(parent, component); directory(parent); }
      const content = readFile(path.join(filesRoot, ...relative.split('/')));
      total += content.length;
      if (total > MAX_TOTAL_BYTES || digest(content) !== saved.manifest.files[relative]) {
        throw checkpointError(`Checkpoint source integrity verification failed: ${relative}`, 'CHECKPOINT_INTEGRITY_FAILED');
      }
      bytes.set(relative, content);
    }
    return { record, bytes, manifest: saved.manifest };
  }

  _identity(saved) {
    const { record, manifest } = saved;
    return { projectId: record.projectId, checkpointId: record.id, label: record.label, created: record.created,
      sourceHash: manifest.hash, integrity: 'verified',
      attribution: attribution(record.metadata, record.projectId, manifest) };
  }

  inspect(projectId, checkpointId, relative) {
    const saved = this._load(projectId, checkpointId);
    const result = { ...this._identity(saved), hash: saved.manifest.hash, coverage: coverage(),
      manifest: clone(saved.manifest), metadata: clone(saved.record.metadata),
      files: [...saved.bytes].map(([name, bytes]) => ({ path: name, bytes: bytes.length, hash: digest(bytes) })) };
    if (relative !== undefined) {
      filePath(relative);
      const bytes = saved.bytes.get(relative);
      if (!bytes) throw checkpointError('That file is not in this saved version.', 'CHECKPOINT_FILE_NOT_FOUND', { projectId, checkpointId });
      const encoding = isUtf8(bytes) ? 'utf8' : 'base64';
      result.file = { path: relative, content: bytes.toString(encoding), encoding, bytes: bytes.length, hash: digest(bytes) };
    }
    return result;
  }

  diff(projectId, checkpointId) {
    const before = this._load(projectId, checkpointId);
    const after = this._capture(projectId);
    const names = [...new Set([...before.bytes.keys(), ...after.bytes.keys()])].sort();
    const files = [];
    let available = DIFF_TEXT_BYTES;
    for (const relative of names) {
      const left = before.bytes.get(relative), right = after.bytes.get(relative);
      if (left && right && left.equals(right)) continue;
      const beforeText = excerpt(left, available); available -= beforeText.consumed;
      const afterText = excerpt(right, available); available -= afterText.consumed;
      files.push({
        path: relative, status: !left ? 'added' : !right ? 'deleted' : 'modified',
        before: beforeText.text, after: afterText.text,
        beforeEncoding: beforeText.encoding, afterEncoding: afterText.encoding,
        beforeTruncated: beforeText.truncated, afterTruncated: afterText.truncated,
        beforeHash: left ? digest(left) : null, afterHash: right ? digest(right) : null,
        beforeBytes: left ? left.length : 0, afterBytes: right ? right.length : 0,
      });
    }
    const summary = { added: 0, modified: 0, deleted: 0 };
    for (const file of files) summary[file.status]++;
    const diffHash = digest(JSON.stringify({ projectId, checkpointId,
      beforeHash: before.manifest.hash, afterHash: after.manifest.hash,
      files: files.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash })) }));
    return { projectId, checkpointId, beforeHash: before.manifest.hash, afterHash: after.manifest.hash,
      changed: files.length, files, summary, comparedAt: Date.now(), basis: 'observed', coverage: coverage(),
      diffHash, truncated: files.some(file => file.beforeTruncated || file.afterTruncated), textSourceByteLimit: DIFF_TEXT_BYTES,
      checkpoint: this._identity(before), current: { projectId, sourceHash: after.manifest.hash },
      restoreGuard: { expectedCurrentHash: after.manifest.hash, expectedCheckpointHash: before.manifest.hash } };
  }

  restore(projectId, checkpointId, options = {}) {
    let archive = null, stage = 'validate', changedPaths = [];
    try {
      if (!options || typeof options !== 'object' || Array.isArray(options) ||
          Object.keys(options).some(key => !['expectedCurrentHash', 'expectedCheckpointHash'].includes(key))) {
        throw checkpointError('Invalid restore comparison guard. Compare the saved version again.', 'CHECKPOINT_GUARD_INVALID');
      }
      for (const value of Object.values(options)) {
        if (!HASH.test(value)) throw checkpointError('Invalid restore comparison hash.', 'CHECKPOINT_GUARD_INVALID');
      }
      // Fully verify the immutable target before saving or changing public bytes.
      const target = this._load(projectId, checkpointId);
      const current = this._capture(projectId);
      if ((options.expectedCurrentHash && options.expectedCurrentHash !== current.manifest.hash) ||
          (options.expectedCheckpointHash && options.expectedCheckpointHash !== target.manifest.hash)) {
        throw checkpointError('Files changed since this comparison. Inspect the diff again before restoring.', 'CHECKPOINT_STALE_COMPARISON');
      }
      const names = Object.keys(target.manifest.files);
      for (const relative of names) this.workspaces.resolve(projectId, relative);
      stage = 'archive';
      archive = this.create(projectId, `Before restoring ${target.record.label}`.slice(0, 160), {
        kind: 'pre-restore', targetCheckpointId: checkpointId, sourceHash: current.manifest.hash,
      });
      stage = 'preflight';
      const latest = this._capture(projectId);
      if (latest.manifest.hash !== archive.hash || current.manifest.hash !== archive.hash) {
        throw checkpointError('Workspace changed before restore; no restore was applied.', 'CHECKPOINT_SOURCE_CHANGED');
      }
      // Revalidate the disk snapshot after the archive operation too.
      const checked = this._load(projectId, checkpointId);
      if (checked.manifest.hash !== target.manifest.hash) throw new Error('Checkpoint changed before restore.');
      const { checkpoints } = this._scope(projectId);
      const removed = [];
      const checkCurrentFile = (relative) => {
        const filename = this.workspaces.resolve(projectId, relative);
        const expected = current.manifest.files[relative];
        let bytes;
        try { bytes = readFile(filename); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if ((bytes ? digest(bytes) : undefined) !== expected) {
          throw checkpointError(`File changed during restore: ${relative}. It was left in place.`, 'CHECKPOINT_SOURCE_CHANGED', { path: relative });
        }
        return filename;
      };
      stage = 'restore-files';
      for (const relative of Object.keys(current.manifest.files)) {
        if (Object.hasOwn(target.manifest.files, relative)) continue;
        const filename = checkCurrentFile(relative);
        fs.unlinkSync(filename); removed.push(relative); changedPaths.push(relative);
      }
      for (const [relative, content] of target.bytes) {
        const filename = this.workspaces.resolve(projectId, relative);
        const root = this.workspaces.get(projectId).root;
        let parent = root;
        for (const component of relative.split('/').slice(0, -1)) {
          parent = path.join(parent, component);
          if (!fs.existsSync(parent)) fs.mkdirSync(parent);
          directory(parent);
        }
        const temp = path.join(checkpoints, `restore-${crypto.randomUUID()}.tmp`);
        try {
          writeNew(temp, content);
          this._scope(projectId);
          checkCurrentFile(relative);
          fs.renameSync(temp, filename);
          changedPaths.push(relative);
        } finally { try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
      }
      stage = 'verify';
      const restored = this._capture(projectId);
      if (restored.manifest.hash !== target.manifest.hash) throw new Error('Restored source verification failed.');
      return { restored: true, projectId, checkpointId, archiveId: archive.id,
        hash: restored.manifest.hash, manifest: clone(restored.manifest), files: names, removed,
        checkpoint: this._identity(target), beforeHash: archive.hash, coverage: coverage(),
        recovery: { projectId, checkpointId: archive.id, sourceHash: archive.hash } };
    } catch (error) {
      if (!String(error.code || '').startsWith('CHECKPOINT_')) {
        error.causeCode = error.code || null;
        error.code = 'CHECKPOINT_RESTORE_FAILED';
      }
      error.projectId = projectId; error.checkpointId = checkpointId;
      error.operation = 'restore'; error.stage = stage; error.partial = changedPaths.length > 0;
      error.changedPaths = changedPaths.slice();
      if (archive) {
        error.archiveId = archive.id;
        error.recovery = { projectId, checkpointId: archive.id, sourceHash: archive.hash,
          action: 'inspect_saved_version', message: 'Inspect this preserved version before choosing another restore.' };
        error.message = `${error.message} Current files were archived as ${archive.id}.`;
      } else {
        error.recovery = { projectId, action: 'inspect_diff', checkpointId,
          message: 'No restore was applied. Inspect the saved version and current file problem before retrying.' };
      }
      throw error;
    }
  }
}

module.exports = { Checkpoints };
