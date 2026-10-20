'use strict';

// Fixed local recipes: source text is checked, never executed as application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const LIMITS = Object.freeze({ files: 32, fileBytes: 1024 * 1024, totalBytes: 4 * 1024 * 1024 });
const EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg']);
const CHECK_NAMES = Object.freeze(['Required entry files', 'HTML contract', 'JavaScript syntax', 'Local asset references', 'Snapshot integrity']);
// Includes Windows executable startup, stdin delivery and process close, not
// just parser time. Keep a bound while allowing a busy desktop to start Node.
const SYNTAX_TIMEOUT_MS = 15000;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const ordered = (files) => Object.fromEntries(Object.keys(files).sort().map((name) => [name, files[name]]));
const manifestHash = (files) => sha256(Buffer.from(JSON.stringify(ordered(files)), 'utf8'));
const inside = (root, target) => target === root || (!path.relative(root, target).startsWith(`..${path.sep}`) && path.relative(root, target) !== '..' && !path.isAbsolute(path.relative(root, target)));

function cancelled() { const error = new Error('Recipe cancelled. No artifact was published.'); error.code = 'ABORT_ERR'; return error; }
function checkAbort(signal) { if (signal?.aborted) throw cancelled(); }
function safeName(name) {
  return name && !/[\u0000-\u001f<>:"|?*\\]/.test(name) && !/[. ]$/.test(name) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}

function snapshot(root, signal) {
  checkAbort(signal);
  const absolute = path.resolve(root);
  const rootStat = fs.lstatSync(absolute);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Source root must be a real directory, not a link.');
  const realRoot = fs.realpathSync(absolute), bytes = new Map(), names = new Set();
  let total = 0, folders = 0;
  function visit(folder, prefix) {
    if (++folders > 256 || prefix.split('/').length > 17) throw new Error('Public directory tree exceeds recipe scan bounds.');
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      checkAbort(signal);
      if (entry.name.toLowerCase() === '.agent-bus') continue;
      if (entry.name.toLowerCase() === '.git') throw new Error('Git metadata is not part of a generated public project.');
      if (!safeName(entry.name)) throw new Error(`Unsafe public path: ${prefix}${entry.name}`);
      const relative = `${prefix}${entry.name}`, file = path.join(folder, entry.name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !inside(realRoot, fs.realpathSync(file))) throw new Error(`Linked or escaping public path: ${relative}`);
      if (stat.isDirectory()) { visit(file, `${relative}/`); continue; }
      if (!stat.isFile() || stat.nlink > 1) throw new Error(`Public path must be an ordinary unlinked file: ${relative}`);
      if (!EXTENSIONS.has(path.extname(relative).toLowerCase())) throw new Error(`Unsupported public file type: ${relative}`);
      if (stat.size > LIMITS.fileBytes) throw new Error(`Public file exceeds 1 MB: ${relative}`);
      if (bytes.size >= LIMITS.files) throw new Error('Public project exceeds 32 files.');
      if (names.has(relative.toLowerCase())) throw new Error(`Case-colliding public path: ${relative}`);
      names.add(relative.toLowerCase());
      // Read through the checked handle; do not follow a link swapped in at open time where supported.
      const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      let data;
      try {
        const current = fs.fstatSync(fd);
        if (!current.isFile() || current.nlink > 1 || current.size > LIMITS.fileBytes) throw new Error(`Public file changed while opening: ${relative}`);
        if (!inside(realRoot, fs.realpathSync(file))) throw new Error(`Public file escaped during read: ${relative}`);
        data = Buffer.alloc(current.size);
        let offset = 0;
        while (offset < data.length) {
          checkAbort(signal);
          const count = fs.readSync(fd, data, offset, data.length - offset, offset);
          if (!count) throw new Error(`Public file changed during read: ${relative}`);
          offset += count;
        }
        const after = fs.fstatSync(fd);
        if (after.size !== current.size || after.mtimeMs !== current.mtimeMs || after.ctimeMs !== current.ctimeMs) throw new Error(`Public file changed during read: ${relative}`);
      } finally { fs.closeSync(fd); }
      total += data.length;
      if (total > LIMITS.totalBytes) throw new Error('Public project exceeds 4 MB.');
      bytes.set(relative, data);
    }
  }
  visit(realRoot, '');
  const files = Object.fromEntries([...bytes.keys()].sort().map((name) => [name, sha256(bytes.get(name))]));
  return { root: realRoot, bytes, files, hash: manifestHash(files) };
}

function text(bytes, name) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error(`Not valid UTF-8 text: ${name}`); }
}
function htmlTags(source) {
  const tags = [];
  const html = source.replace(/<!--[\s\S]*?-->/g, '').replace(/(<(script|style|textarea|title)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>)[\s\S]*?<\/\2\s*>/gi, '$1');
  const pattern = /<([a-z][a-z0-9:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attributes = {}, attribute = /([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let item;
    while ((item = attribute.exec(match[2]))) attributes[item[1].toLowerCase()] = item[2] ?? item[3] ?? item[4] ?? '';
    tags.push({ tag: match[1].toLowerCase(), attributes });
  }
  return tags;
}
function validateHtml(source, contractId = 'checklist') {
  if (contractId !== 'checklist' && contractId !== 'neon-rally') throw new Error('Unknown recipe contract. Allowed contracts: checklist, neon-rally.');
  const clean = source.replace(/<!--[\s\S]*?-->/g, ''), tags = htmlTags(source);
  if (!/<!doctype\s+html\s*>/i.test(clean) || !tags.some((tag) => tag.tag === 'html') || !tags.some((tag) => tag.tag === 'body')) throw new Error('index.html needs an HTML doctype, html element and body element.');
  // Rally's shared script creates its controls after mount. Their live existence and
  // handlers belong to browser acceptance, not this static HTML check.
  const selectors = contractId === 'checklist' ? ['task-input', 'add-task', 'task-list'] : [];
  for (const selector of selectors) {
    if (tags.filter((tag) => tag.attributes['data-testid'] === selector).length !== 1) throw new Error(`HTML contract requires exactly one data-testid="${selector}" element.`);
  }
  if (contractId === 'neon-rally' && tags.filter((tag) => Object.hasOwn(tag.attributes, 'data-neon-rally-app')).length !== 1) throw new Error('HTML contract requires exactly one data-neon-rally-app mount root.');
  if (!tags.some((tag) => tag.tag === 'script' && tag.attributes.src === 'script.js')) throw new Error('HTML contract requires the local script.js script.');
  if (!tags.some((tag) => tag.tag === 'link' && tag.attributes.href === 'styles.css' && /(?:^|\s)stylesheet(?:\s|$)/i.test(tag.attributes.rel || ''))) throw new Error('HTML contract requires the local styles.css stylesheet.');
  return tags;
}

function assetReferences(current) {
  const references = [], modules = new Set(), scripts = [];
  for (const [name, data] of current.bytes) {
    const extension = path.extname(name).toLowerCase(), content = text(data, name);
    if (extension === '.html' || extension === '.svg') {
      for (const { tag, attributes } of htmlTags(content)) {
        for (const key of ['src', 'href', 'poster']) if (attributes[key]) references.push({ from: name, value: attributes[key] });
        if (attributes.srcset) for (const candidate of attributes.srcset.split(',')) references.push({ from: name, value: candidate.trim().split(/\s+/)[0] });
        if (tag === 'script' && attributes.src && attributes.type === 'module') {
          // An invalid reference is reported by the local-asset check, not this discovery pass.
          try { modules.add(resolveReference(name, attributes.src)); } catch {}
        }
      }
      if (extension === '.html') {
        const pattern = /<script\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi;
        let match;
        while ((match = pattern.exec(content.replace(/<!--[\s\S]*?-->/g, '')))) {
          const tag = htmlTags(`<script ${match[1]}>`)[0];
          if (!tag.attributes.src && (!tag.attributes.type || /^(module|text\/javascript|application\/javascript)$/i.test(tag.attributes.type))) scripts.push({ name: `${name} inline script`, content: match[2], module: tag.attributes.type === 'module' });
        }
      }
    }
    if (extension === '.css') {
      const clean = content.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of clean.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)')/gi)) references.push({ from: name, value: match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] });
    }
    if (extension === '.js') {
      for (const match of content.matchAll(/(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g)) {
        if (match[1].startsWith('.')) references.push({ from: name, value: match[1] });
      }
    }
  }
  return { references, modules, scripts };
}
function resolveReference(from, raw) {
  const value = String(raw).trim();
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
  if (value.startsWith('/') || value.includes('\\')) throw new Error(`Use a relative local asset URL in ${from}: ${value}`);
  let decoded;
  try { decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]); } catch { throw new Error(`Malformed local asset URL in ${from}: ${value}`); }
  if (!decoded) return null;
  if (decoded.includes('\\') || decoded.includes(':') || decoded.includes('\0') || decoded.startsWith('/')) throw new Error(`Unsafe local asset URL in ${from}: ${value}`);
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded));
  if (target === '..' || target.startsWith('../') || target.split('/').some((part) => part === '.agent-bus' || part.toLowerCase() === '.git')) throw new Error(`Local asset escapes public files in ${from}: ${value}`);
  return target;
}

function syntaxCheck(content, module, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(process.execPath, ['--check', `--input-type=${module ? 'module' : 'commonjs'}`], {
      windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '' },
    });
    let spawned = false;
    child.once('spawn', () => { spawned = true; });
    let output = '', reason = null, settled = false;
    const finish = (error) => {
      if (settled) return; settled = true;
      clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve();
    };
    const stop = (error) => { reason ||= error; child.kill(); killTimer ||= setTimeout(() => finish(reason), 1000); };
    const abort = () => stop(cancelled());
    let killTimer;
    const timer = setTimeout(() => stop(new Error(`JavaScript syntax check incomplete after ${Math.round(performance.now() - started)} ms (limit ${SYNTAX_TIMEOUT_MS} ms; process start ${spawned ? 'observed' : 'unconfirmed'}; exit ${child.exitCode ?? 'unconfirmed'}). No syntax pass was recorded.`)), SYNTAX_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { output = (output + chunk.toString('utf8')).slice(-16000); });
    child.once('error', (error) => finish(error));
    child.once('close', (code) => finish(reason || (code === 0 ? null : new Error(output.trim() || `Syntax subprocess exited ${code}.`))));
    child.stdin.on('error', () => {});
    child.stdin.end(content);
  });
}

function ensureDirectory(directory) {
  const absolute = path.resolve(directory), parent = path.dirname(absolute);
  if (parent !== absolute) ensureDirectory(parent);
  if (!fs.existsSync(absolute)) { try { fs.mkdirSync(absolute); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Artifact parent must not be a link: ${absolute}`);
}

async function runRecipe({ root, artifactRoot, runId, onEvent, signal, contractId = 'checklist' } = {}) {
  const checks = CHECK_NAMES.map((name) => ({ name, state: 'pending', detail: 'Not run.' }));
  const validatedContractId = contractId === 'checklist' || contractId === 'neon-rally' ? contractId : null;
  let current = null, source = { files: {}, hash: null }, activeCheck = 0, output = '', artifact = null, artifactClaimed = false;
  const written = [], directories = [], destination = artifactRoot ? path.resolve(artifactRoot) : null;
  const log = (message) => { output = (output + message + '\n').slice(-100000); };
  const emit = (event) => { checkAbort(signal); onEvent?.({ ...event, runId }); checkAbort(signal); };
  const check = async (index, action) => {
    activeCheck = index; checks[index] = { name: CHECK_NAMES[index], state: 'running', detail: 'Checking actual source.' };
    emit({ type: 'check', phase: 'test', ...checks[index] });
    const detail = await action();
    checks[index] = { name: CHECK_NAMES[index], state: 'passed', detail };
    log(`${checks[index].name}: ${detail}`); emit({ type: 'check', phase: 'test', ...checks[index] });
  };
  try {
    if (typeof root !== 'string' || !path.isAbsolute(root) || !destination || !path.isAbsolute(artifactRoot)) throw new Error('Explicit absolute source and artifact roots are required.');
    if (typeof runId !== 'string' || !runId || runId.length > 200) throw new Error('A bounded runId is required.');
    checkAbort(signal);
    emit({ type: 'phase', phase: 'test', message: 'Running five fixed source and artifact checks; browser behavior is not tested here.' });
    await check(0, () => {
      current = snapshot(root, signal); source = { files: current.files, hash: current.hash };
      for (const name of ['index.html', 'styles.css', 'script.js']) if (!current.bytes.has(name)) throw new Error(`Missing required entry file: ${name}`);
      for (const [name, bytes] of current.bytes) text(bytes, name);
      return `${current.bytes.size} bounded public files; index.html, styles.css and script.js exist.`;
    });
    await check(1, () => {
      validateHtml(text(current.bytes.get('index.html'), 'index.html'), contractId);
      return contractId === 'neon-rally'
        ? 'Rally mount and local entry references exist (static contract); live controls require separate browser verification.'
        : 'HTML document, unique checklist selectors and local entry references exist (static contract).';
    });
    const assets = assetReferences(current);
    await check(2, async () => {
      let count = 0;
      for (const [name, bytes] of current.bytes) if (path.extname(name).toLowerCase() === '.js') {
        try { await syntaxCheck(text(bytes, name), assets.modules.has(name), signal); } catch (error) { error.message = `${name}: ${error.message}`; throw error; } count++;
      }
      for (const script of assets.scripts) { try { await syntaxCheck(script.content, script.module, signal); } catch (error) { error.message = `${script.name}: ${error.message}`; throw error; } count++; }
      return `${count} JavaScript source units passed Node syntax checking; application code was not executed.`;
    });
    await check(3, () => {
      let count = 0, external = 0;
      for (const reference of assets.references) { const target = resolveReference(reference.from, reference.value); if (!target) { external++; continue; } if (!current.bytes.has(target)) throw new Error(`Missing local asset ${target} referenced by ${reference.from}.`); count++; }
      return `${count} declared local references resolve to snapshot files; ${external} fragments/external URLs were not availability-tested. Computed JavaScript URLs are not inspected.`;
    });
    activeCheck = 4;
    emit({ type: 'phase', phase: 'build', message: 'Copying checked public bytes into a fresh artifact directory.' });
    const realSource = current.root;
    if (inside(destination, realSource) || destination === realSource || (inside(realSource, destination) && !path.relative(realSource, destination).split(path.sep).includes('.agent-bus'))) throw new Error('Artifact destination must be outside public source files or under .agent-bus.');
    ensureDirectory(path.dirname(destination));
    fs.mkdirSync(destination); artifactClaimed = true; directories.push(destination);
    for (const name of Object.keys(current.files)) {
      checkAbort(signal);
      const target = path.join(destination, ...name.split('/')), parent = path.dirname(target);
      const missing = []; let cursor = parent;
      while (cursor !== destination && !fs.existsSync(cursor)) { missing.push(cursor); cursor = path.dirname(cursor); }
      for (const folder of missing.reverse()) { fs.mkdirSync(folder); directories.push(folder); }
      fs.writeFileSync(target, current.bytes.get(name), { flag: 'wx' }); written.push(target);
    }
    await check(4, () => {
      if (snapshot(root, signal).hash !== current.hash) throw new Error('Source changed during the recipe; no candidate is valid.');
      if (snapshot(destination, signal).hash !== current.hash) throw new Error('Artifact bytes do not match the checked source snapshot.');
      return 'Source is unchanged and artifact byte hashes match the checked snapshot.';
    });
    // Observers may run synchronously on check events: recheck after the final event too.
    checkAbort(signal);
    if (snapshot(root, signal).hash !== current.hash || snapshot(destination, signal).hash !== current.hash) throw new Error('Source or artifact changed before recipe completion.');
    artifact = { root: destination, manifest: { ...current.files }, candidateHash: current.hash };
    log('5/5 fixed checks passed. Artifact contains exact checked bytes. Browser interaction remains unverified.');
    return { state: 'passed', contractId: validatedContractId, checks, output, exitCode: 0, artifact, source };
  } catch (error) {
    const isCancelled = error.code === 'ABORT_ERR' || signal?.aborted, detail = isCancelled ? 'Cancelled; no artifact was published.' : error.message;
    const index = Math.min(activeCheck, checks.length - 1);
    checks[index] = { name: CHECK_NAMES[index], state: isCancelled ? 'cancelled' : 'failed', detail };
    for (let i = 0; i < checks.length; i++) if (checks[i].state === 'pending' || checks[i].state === 'running') checks[i] = { ...checks[i], state: 'skipped', detail: 'Not completed because the recipe stopped.' };
    log(`${isCancelled ? 'Cancelled' : 'Failed'}: ${detail}`);
    if (artifactClaimed) {
      // Only remove the exact files/directories this invocation created; never recursive delete.
      for (const file of written.reverse()) { if (inside(destination, file)) { try { fs.unlinkSync(file); } catch {} } }
      for (const directory of directories.reverse()) { if (inside(destination, directory)) { try { fs.rmdirSync(directory); } catch {} } }
    }
    try { onEvent?.({ type: 'check', phase: 'test', ...checks[index], runId }); } catch {}
    return { state: isCancelled ? 'cancelled' : 'failed', contractId: validatedContractId, checks, output, exitCode: isCancelled ? null : 1, artifact: null, source };
  }
}

module.exports = { runRecipe, CHECK_NAMES, LIMITS, snapshot, manifestHash, resolveReference, validateHtml };
