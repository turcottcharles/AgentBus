'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LIMITS = Object.freeze({ maxFiles: 32, maxTotalBytes: 4 * 1024 * 1024, maxFileBytes: 1024 * 1024 });
const PUBLIC_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg']);
// Export a copy so a consumer cannot weaken this module's validation by adding
// a type to the shared inspection set.
const ALLOWED_EXTENSIONS = new Set(PUBLIC_EXTENSIONS);
const PROJECT_ID = /^project-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const INTERNAL = '.agent-bus';
const MARKER = 'workspace.json';
const MAX_ENTRIES = 256;
const MAX_DEPTH = 8;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const STARTERS = Object.freeze({ checklist: Object.freeze({ id: 'checklist', name: 'Checklist' }), 'neon-rally': Object.freeze({ id: 'neon-rally', name: 'Neon Rally' }) });

function fail(message) { throw new Error(`Workspace: ${message}`); }
function lstat(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function absoluteRoot(root) {
  if (typeof root !== 'string' || !root || !path.isAbsolute(root)) fail('an explicit absolute root is required.');
  const resolved = path.resolve(root);
  if (resolved === path.parse(resolved).root) fail('a filesystem root cannot be a projects folder.');
  return resolved;
}

// Check every ancestor, not just realpath containment: a junction inside a root is
// not an owned directory, even if its current target happens to remain inside it.
function directoryChain(directory, create = false) {
  const parsed = path.parse(directory);
  let current = parsed.root;
  for (const segment of directory.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat = lstat(current);
    if (!stat && create) { fs.mkdirSync(current); stat = fs.lstatSync(current); }
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) fail(`unsafe or missing directory: ${current}`);
  }
  if (fs.realpathSync.native(directory) !== directory) fail(`directory is not its real location: ${directory}`);
  return directory;
}

function safeSegment(segment) {
  if (!segment || segment === '.' || segment === '..' || /[\x00-\x1f\x7f<>:"|?*]/.test(segment) || /[ .]$/.test(segment)) {
    fail('invalid file path segment.');
  }
  const base = segment.split('.')[0].replace(/[ .]+$/, '');
  if (/^(?:con|prn|aux|nul|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3]|conin\$|conout\$)$/i.test(base)) fail('reserved device filename.');
  if (/^(?:\.agent-bus|\.git)$/i.test(segment)) fail('internal paths are not public files.');
}

function publicRelative(relative, directory = false) {
  if (typeof relative !== 'string' || !relative || relative.length > 240 || /[\\]/.test(relative)) {
    fail('use a bounded relative file path with forward slashes.');
  }
  if (path.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.startsWith('/')) fail('absolute paths are not allowed.');
  const segments = relative.split('/');
  if (segments.length > MAX_DEPTH + 1) fail('file path is too deeply nested.');
  segments.forEach(safeSegment);
  if (!directory && !PUBLIC_EXTENSIONS.has(path.posix.extname(relative).toLowerCase())) fail('unsupported file type.');
  return segments.join('/');
}

function regularFile(file, stat = lstat(file)) {
  if (!stat || stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) fail(`unsafe file (links are not allowed): ${file}`);
  return stat;
}

function readBounded(file, maxBytes) {
  const stat = regularFile(file);
  if (stat.size > maxBytes) fail('file exceeds its size limit.');
  // O_NOFOLLOW is used where supported; ancestor and final lstat checks also
  // cover Windows junctions. The fixed-root capability cannot select a new root.
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.size > maxBytes || opened.dev !== stat.dev || opened.ino !== stat.ino) fail('file changed while opening.');
    const bytes = Buffer.alloc(maxBytes + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(fd, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    if (count > maxBytes) fail('file exceeds its size limit.');
    return bytes.subarray(0, count);
  } finally { fs.closeSync(fd); }
}

function ownedRoot(root) {
  directoryChain(root);
  const id = path.basename(root);
  if (!PROJECT_ID.test(id)) fail('root is not a generated project.');
  const internal = path.join(root, INTERNAL);
  directoryChain(internal);
  let marker;
  try { marker = JSON.parse(readBounded(path.join(internal, MARKER), 4096).toString('utf8')); }
  catch (error) { fail(`ownership record is invalid: ${error.message}`); }
  const starterId = marker && (marker.starterId || marker.template);
  if (!marker || marker.version !== 1 || marker.id !== id || marker.root !== root || !Object.hasOwn(STARTERS, starterId) || marker.template !== starterId) {
    fail('ownership record does not match this project root.');
  }
  return marker;
}

class ProjectFiles {
  constructor({ root } = {}) {
    this.root = absoluteRoot(root);
    ownedRoot(this.root);
  }

  resolve(relative) {
    ownedRoot(this.root);
    const normalized = publicRelative(relative);
    const pieces = normalized.split('/');
    let current = this.root;
    for (let index = 0; index < pieces.length; index++) {
      current = path.join(current, pieces[index]);
      const stat = lstat(current);
      if (!stat) continue;
      if (stat.isSymbolicLink()) fail('symlinks and junctions are not allowed.');
      if (index < pieces.length - 1) {
        if (!stat.isDirectory()) fail('a parent path is not a directory.');
      } else { regularFile(current, stat); }
    }
    return current;
  }

  files() {
    ownedRoot(this.root);
    const found = [];
    let entries = 0;
    let total = 0;
    const visit = (directory, prefix, depth) => {
      if (depth > MAX_DEPTH) fail('workspace directory is too deeply nested.');
      const stream = fs.opendirSync(directory);
      try {
        let entry;
        while ((entry = stream.readSync())) {
          if (++entries > MAX_ENTRIES) fail('workspace has too many directory entries.');
          if (!prefix && entry.name === INTERNAL) continue;
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
          const absolute = path.join(directory, entry.name);
          const stat = fs.lstatSync(absolute);
          if (stat.isSymbolicLink()) fail('symlinks and junctions are not allowed.');
          if (stat.isDirectory()) {
            publicRelative(relative, true);
            visit(absolute, relative, depth + 1);
          } else {
            publicRelative(relative);
            regularFile(absolute, stat);
            if (stat.size > LIMITS.maxFileBytes) fail('file exceeds its size limit.');
            total += stat.size;
            found.push(relative);
            if (found.length > LIMITS.maxFiles || total > LIMITS.maxTotalBytes) fail('workspace exceeds its file count or total size limit.');
          }
        }
      } finally { stream.closeSync(); }
    };
    visit(this.root, '', 0);
    return found.sort();
  }

  read(relative) {
    this.files();
    const absolute = this.resolve(relative);
    const bytes = readBounded(absolute, LIMITS.maxFileBytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { fail('file is not valid UTF-8 text.'); }
  }

  write(relative, content) {
    const normalized = publicRelative(relative);
    if (typeof content !== 'string') fail('file content must be UTF-8 text.');
    const bytes = Buffer.from(content, 'utf8');
    if (bytes.length > LIMITS.maxFileBytes) fail('file exceeds its size limit.');
    let absolute = this.resolve(normalized);
    const existing = lstat(absolute);
    const names = this.files();
    const total = names.reduce((sum, name) => sum + regularFile(this.resolve(name)).size, 0);
    if (names.length + (existing ? 0 : 1) > LIMITS.maxFiles || total - (existing ? existing.size : 0) + bytes.length > LIMITS.maxTotalBytes) {
      fail('workspace exceeds its file count or total size limit.');
    }
    directoryChain(path.dirname(absolute), true);
    absolute = this.resolve(normalized);
    const temporary = path.join(this.root, INTERNAL, `write-${crypto.randomUUID()}.tmp`);
    let created = false;
    try {
      fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
      created = true;
      absolute = this.resolve(normalized);
      fs.renameSync(temporary, absolute);
      created = false;
      const actual = readBounded(this.resolve(normalized), LIMITS.maxFileBytes);
      if (!actual.equals(bytes)) fail('written bytes changed before verification.');
      return { path: normalized, bytes: bytes.length, hash: sha256(bytes) };
    } finally {
      if (created) {
        // Only unlink the exact private temporary file created by this call.
        try { regularFile(temporary); fs.unlinkSync(temporary); } catch { /* Preserve ambiguous state. */ }
      }
    }
  }

  manifest() {
    const files = {};
    let total = 0;
    for (const relative of this.files()) {
      const bytes = readBounded(this.resolve(relative), LIMITS.maxFileBytes);
      total += bytes.length;
      if (total > LIMITS.maxTotalBytes) fail('workspace exceeds its total size limit.');
      files[relative] = sha256(bytes);
    }
    return { files, hash: sha256(JSON.stringify(files)), at: Date.now() };
  }
}

const STARTER = {
  'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>My checklist</title>
  <link rel="stylesheet" href="styles.css">
  <script src="script.js" defer></script>
</head>
<body>
  <main class="checklist">
    <p class="eyebrow">A little progress, every day</p>
    <h1>My checklist<span aria-hidden="true">.</span></h1>
    <p class="intro">Make room for what matters. Add a task, then tick it off.</p>
    <form id="task-form" class="task-form">
      <label for="task-input">What would you like to do?</label>
      <div class="input-row">
        <input id="task-input" data-testid="task-input" type="text" maxlength="200" placeholder="Write a task…" autocomplete="off" required>
        <button data-testid="add-task" type="submit">Add task <span aria-hidden="true">+</span></button>
      </div>
    </form>
    <p id="task-status" class="status" role="status" aria-live="polite">Your list is ready for its first task.</p>
    <ul id="task-list" data-testid="task-list" aria-label="Your tasks"></ul>
    <p id="empty-state" class="empty">A fresh start. Your first task goes here.</p>
    <footer>Checklist starter · Edit this project to make it yours.</footer>
  </main>
</body>
</html>
`,
  'styles.css': `:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #e8f4f5; background: #09161d; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; padding: 64px 20px; background: radial-gradient(ellipse at 10% 0%, #154047 0%, transparent 55%), radial-gradient(ellipse at 95% 95%, #30274b 0%, transparent 50%), #09161d; }
.checklist { width: min(100%, 680px); margin: 0 auto; padding: 42px; border: 1px solid #31515a; border-radius: 24px; background: #10232be6; box-shadow: 0 22px 80px #02090e66; }
.eyebrow { color: #88ded3; font-size: .75rem; font-weight: 650; letter-spacing: .13em; text-transform: uppercase; }
h1 { margin: 18px 0 12px; font-size: clamp(2.2rem, 6vw, 3.3rem); letter-spacing: -.05em; line-height: 1.12; }
h1 span { color: #b8a1ef; }
.intro { color: #b1c7cb; line-height: 1.65; margin-bottom: 32px; }
.task-form label { display: block; margin-bottom: 10px; font-size: .85rem; font-weight: 600; }
.input-row { display: flex; gap: 10px; }
input[type="text"] { width: 100%; min-width: 0; border: 1px solid #47636d; border-radius: 12px; padding: 14px; background: #0b1b23; color: #effafa; font: inherit; }
input::placeholder { color: #819da6; }
button { border: 1px solid #aadcd7; border-radius: 12px; padding: 12px 18px; background: #a5e2d8; color: #112f31; font: inherit; font-weight: 650; cursor: pointer; white-space: nowrap; }
button:hover { background: #c8f3eb; }
button span { margin-left: 10px; }
input:focus-visible, button:focus-visible { outline: 3px solid #c5a9ff; outline-offset: 3px; }
.status { min-height: 1.4em; color: #b6cbd0; font-size: .82rem; margin: 18px 0 12px; }
ul { padding: 0; margin: 0; list-style: none; }
.task { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #29414b; }
.task label { flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0; cursor: pointer; line-height: 1.5; }
.task input { width: 20px; height: 20px; flex: 0 0 auto; accent-color: #9bdfd0; }
.task-text { overflow-wrap: anywhere; }
.task.is-complete .task-text { color: #8da9ac; text-decoration: line-through; }
.remove-task { padding: 8px 10px; border-color: #52616e; background: transparent; color: #c7bfdc; font-size: .75rem; }
.remove-task:hover { background: #342b43; color: #f3e5ff; }
.empty { padding: 28px 16px; border: 1px dashed #36525c; border-radius: 12px; color: #9ab6bf; text-align: center; line-height: 1.6; }
[hidden] { display: none !important; }
footer { margin-top: 30px; color: #9bb5bd; font-size: .72rem; line-height: 1.6; }
@media (max-width: 520px) { body { padding: 20px 12px; } .checklist { padding: 25px 20px; border-radius: 18px; } .input-row { flex-direction: column; } .input-row button { align-self: flex-end; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
`,
  'script.js': `'use strict';
(() => {
  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const list = document.getElementById('task-list');
  const status = document.getElementById('task-status');
  const empty = document.getElementById('empty-state');
  let tasks = [];
  let nextId = 1;
  function render() {
    list.replaceChildren();
    for (const task of tasks) {
      const item = document.createElement('li');
      item.className = task.done ? 'task is-complete' : 'task';
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.setAttribute('aria-label', 'Complete ' + task.text);
      checkbox.addEventListener('change', () => { task.done = checkbox.checked; render(); });
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;
      label.append(checkbox, text);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-task';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + task.text);
      remove.addEventListener('click', () => { tasks = tasks.filter((entry) => entry.id !== task.id); render(); });
      item.append(label, remove);
      list.append(item);
    }
    empty.hidden = tasks.length > 0;
    const remaining = tasks.filter((task) => !task.done).length;
    status.textContent = tasks.length === 0 ? 'Your list is ready for its first task.' : remaining === 0 ? 'All done. Enjoy the moment.' : remaining + ' task' + (remaining === 1 ? '' : 's') + ' left to do.';
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim().slice(0, 200);
    if (!text) { input.focus(); return; }
    if (tasks.length >= 200) { status.textContent = 'Your list has 200 tasks. Remove one before adding another.'; return; }
    tasks.push({ id: nextId++, text, done: false });
    input.value = '';
    render();
    input.focus();
  });
  render();
})();
`
};

class Workspaces {
  constructor({ root, store } = {}) {
    this.root = absoluteRoot(root);
    if (!store || typeof store.get !== 'function' || typeof store.put !== 'function' || typeof store.list !== 'function') fail('a project store is required.');
    this.store = store;
    directoryChain(this.root, true);
  }

  create(input = {}, options = {}) {
    const name = typeof input === 'string' ? input : input && input.name;
    const starterId = options.starterId ?? (typeof input === 'object' && input && input.starterId) ?? 'checklist';
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || /[\x00-\x1f\x7f]/.test(name)) fail('project name must contain 1 to 80 readable characters.');
    if (typeof starterId !== 'string' || !Object.hasOwn(STARTERS, starterId)) fail('unknown starter.');
    const starter = starterId === 'checklist' ? STARTER : {
      'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'">
  <meta name="color-scheme" content="light">
  <title>Neon Rally</title>
  <link rel="stylesheet" href="styles.css">
  <script src="script.js" defer></script>
</head>
<body data-neon-rally-app></body>
</html>
`,
      'styles.css': readBounded(path.join(__dirname, '..', 'district-attract-demo.css'), LIMITS.maxFileBytes),
      'script.js': readBounded(path.join(__dirname, '..', 'district-attract-demo.js'), LIMITS.maxFileBytes)
    };
    directoryChain(this.root);
    const id = `project-${crypto.randomUUID()}`;
    const root = path.join(this.root, id);
    const at = Date.now();
    const project = { id, name: name.trim(), root, created: at, updated: at, template: starterId, starterId };
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(root, INTERNAL));
    fs.writeFileSync(path.join(root, INTERNAL, MARKER), JSON.stringify({ version: 1, ...project }), { flag: 'wx', mode: 0o600 });
    for (const [relative, content] of Object.entries(starter)) fs.writeFileSync(path.join(root, relative), content, { flag: 'wx', mode: 0o600 });
    // A failed persistence keeps this uniquely owned folder for recovery. It must
    // never cause cleanup of an existing project or any external directory.
    this.store.put('project', project);
    return { ...project };
  }

  get(id) {
    if (typeof id !== 'string' || !PROJECT_ID.test(id)) return null;
    const project = this.store.get('project', id);
    if (!project) return null;
    if (project.id !== id || project.root !== path.join(this.root, id)) fail('stored project is outside the generated parent.');
    const marker = ownedRoot(project.root);
    if (marker.id !== project.id || marker.created !== project.created) fail('stored project does not match its ownership record.');
    if ((project.starterId || project.template) !== (marker.starterId || marker.template)) fail('stored project starter identity changed.');
    return { ...project };
  }

  list() {
    return this.store.list('project').map((project) => {
      try { return this.get(project.id); }
      catch (error) {
        // Reading one unavailable workspace must not hide every other project.
        // This is a display record only: get/read/write still validate the
        // persisted ownership record, and no guessed/fallback root is exposed.
        return { ...project, root: null, unavailable: true, error: String(error.message || error).slice(0, 1500) };
      }
    }).filter(Boolean).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  }

  _files(id) {
    const project = this.get(id);
    if (!project) fail('unknown project.');
    return new ProjectFiles({ root: project.root });
  }
  files(id) { return this._files(id).files(); }
  resolve(id, relative) { return this._files(id).resolve(relative); }
  read(id, relative) { return this._files(id).read(relative); }
  manifest(id) { return this._files(id).manifest(); }
  write(id, relative, content) {
    const result = this._files(id).write(relative, content);
    const project = this.get(id);
    this.store.put('project', { ...project, updated: Date.now() });
    return result;
  }
}

module.exports = { Workspaces, ProjectFiles, LIMITS, ALLOWED_EXTENSIONS, STARTERS };
