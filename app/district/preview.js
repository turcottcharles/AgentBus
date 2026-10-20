'use strict';

// A browser surface for a verified build snapshot. The caller owns run approval;
// this module verifies bytes and never serves a live workspace or invokes work.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const MAX_FILES = 32;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * MAX_FILE_BYTES;
const TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
});
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const samePath = (left, right) => process.platform === 'win32'
  ? left.toLowerCase() === right.toLowerCase() : left === right;

function identifier(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${label} must be a nonempty bounded identifier.`);
  }
  return value;
}

function validPart(part) {
  return part.length > 0 && part.length <= 128 && part !== '.' && part !== '..'
    && !/[<>:"|?*\\\x00-\x1f\x7f]/.test(part) && !/[. ]$/.test(part)
    && !/^\s/.test(part) && !/^\.(?:agent-bus|git)$/i.test(part)
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part);
}

function publicPath(relative) {
  const parts = relative.split('/');
  return relative.length <= 512 && !/^__district$/i.test(parts[0]) && parts.every(validPart);
}

function captureArtifact(artifactRoot, candidateHash) {
  if (typeof artifactRoot !== 'string' || !path.isAbsolute(artifactRoot)) {
    throw new Error('Preview requires an absolute immutable artifact directory.');
  }
  if (typeof candidateHash !== 'string' || !/^[a-f0-9]{64}$/i.test(candidateHash)) {
    throw new Error('Preview requires a SHA-256 candidate identity.');
  }
  const root = path.resolve(artifactRoot);
  const rootInfo = fs.lstatSync(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || !samePath(fs.realpathSync(root), root)) {
    throw new Error('Preview artifact root must be a real directory without symlink or junction aliases.');
  }
  const files = new Map();
  const hashes = Object.create(null);
  let total = 0, entries = 0;
  function visit(directory, prefix, depth = 0) {
    if (depth > 16) throw new Error('Preview artifact exceeds the public directory depth limit.');
    for (const name of fs.readdirSync(directory).sort()) {
      if (++entries > 128) throw new Error('Preview artifact exceeds the public directory entry limit.');
      const relative = prefix ? `${prefix}/${name}` : name;
      if (!publicPath(relative)) throw new Error('Preview artifact contains an unsupported public path.');
      const absolute = path.join(directory, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink() || !samePath(fs.realpathSync(absolute), absolute)) {
        throw new Error('Preview artifact cannot contain symlinks or junctions.');
      }
      if (stat.isDirectory()) { visit(absolute, relative, depth + 1); continue; }
      if (!stat.isFile() || !Object.hasOwn(TYPES, path.extname(name).toLowerCase())) {
        throw new Error('Preview artifact contains an unsupported file type.');
      }
      if (stat.nlink > 1) throw new Error('Preview artifact cannot contain hardlinked public files.');
      if (files.size >= MAX_FILES || stat.size > MAX_FILE_BYTES || total + stat.size > MAX_TOTAL_BYTES) {
        throw new Error('Preview artifact exceeds the public file or byte limit.');
      }
      const fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      let bytes;
      try {
        const opened = fs.fstatSync(fd);
        if (!opened.isFile() || opened.nlink > 1 || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) {
          throw new Error('Preview artifact changed while it was being captured.');
        }
        bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
          const read = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
          if (!read) throw new Error('Preview artifact changed while it was being captured.');
          offset += read;
        }
        if (fs.fstatSync(fd).size !== opened.size || !samePath(fs.realpathSync(absolute), absolute)) {
          throw new Error('Preview artifact changed while it was being captured.');
        }
      } finally { fs.closeSync(fd); }
      if (path.extname(name).toLowerCase() === '.html' && !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes)) {
        throw new Error('Preview HTML must contain valid UTF-8 text.');
      }
      total += bytes.length;
      files.set(relative, bytes);
      hashes[relative] = sha256(bytes);
    }
  }
  visit(root, '');
  if (!files.has('index.html')) throw new Error('Preview artifact has no index.html entry.');
  const manifest = Object.fromEntries(Object.keys(hashes).sort().map((name) => [name, hashes[name]]));
  const actual = sha256(Buffer.from(JSON.stringify(manifest), 'utf8'));
  if (actual !== candidateHash.toLowerCase()) throw new Error('Preview artifact does not match its candidate hash.');
  return { root, files, manifest, candidateHash: actual };
}

// Runs in the sandboxed page. This is context collection, never an authority to
// edit files, launch jobs or mark a result accepted. Page scripts are untrusted.
function pickerBootstrap(binding) {
  let enabled = false, target = null, parentOrigin = null, lastSent = 0;
  const attr = 'data-district-preview-target';
  const bounded = (value, max) => String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const escape = (value) => typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char.codePointAt(0).toString(16)} `);
  function selectorFor(element) {
    const parts = [];
    for (let node = element, depth = 0; node && node.nodeType === 1 && depth < 6; node = node.parentElement, depth++) {
      const testId = node.getAttribute('data-testid');
      if (testId && testId.length <= 100) { parts.unshift(`[data-testid="${escape(testId)}"]`); break; }
      if (node.id && node.id.length <= 100) { parts.unshift(`#${escape(node.id)}`); break; }
      let part = String(node.tagName).toLowerCase();
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((sibling) => sibling.tagName === node.tagName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      parts.unshift(part);
    }
    return parts.join(' > ').slice(0, 512);
  }
  function clearTarget() {
    if (target) target.removeAttribute(attr);
    target = null;
  }
  function elementFrom(event) {
    const element = event.target && event.target.nodeType === 1 ? event.target : null;
    return element && !/^(?:HEAD|SCRIPT|STYLE|LINK|META|TITLE)$/.test(element.tagName) ? element : null;
  }
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window.parent || !data || typeof data !== 'object' || Array.isArray(data)
      || data.nonce !== binding.nonce) return;
    const inspect = data.type === 'district:inspect' && typeof data.enabled === 'boolean';
    const verify = data.type === 'district:verify' && typeof data.requestId === 'string'
      && data.requestId.trim().length > 0 && data.requestId.length <= 128 && !/[\x00-\x1f\x7f]/.test(data.requestId);
    if (!inspect && !verify) return;
    if (parentOrigin !== null && parentOrigin !== event.origin) return;
    parentOrigin = event.origin;
    if (verify) {
      window.parent.postMessage({ type: 'district:identity', nonce: binding.nonce, requestId: data.requestId,
        previewId: binding.id, projectId: binding.projectId, runId: binding.runId, candidateHash: binding.candidateHash,
      }, parentOrigin === 'null' ? '*' : parentOrigin);
      return;
    }
    enabled = data.enabled;
    document.documentElement.toggleAttribute('data-district-preview-inspecting', enabled);
    if (!enabled) clearTarget();
  });
  document.addEventListener('mouseover', (event) => {
    if (!enabled) return;
    const next = elementFrom(event);
    if (next === target) return;
    clearTarget();
    if (next) { target = next; target.setAttribute(attr, ''); }
  }, true);
  document.addEventListener('click', (event) => {
    const element = elementFrom(event);
    if (!element) return;
    const anchor = element.closest('a[href]');
    if (anchor) {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin || !url.pathname.startsWith(binding.pathPrefix)) event.preventDefault();
      } catch { event.preventDefault(); }
    }
    if (!enabled || parentOrigin === null) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const at = Date.now();
    if (at - lastSent < 80) return;
    lastSent = at;
    const rect = element.getBoundingClientRect();
    const clamp = (value, lower, upper) => Number.isFinite(value) ? Math.min(upper, Math.max(lower, value)) : 0;
    window.parent.postMessage({
      type: 'district:selection', nonce: binding.nonce, projectId: binding.projectId,
      runId: binding.runId, candidateHash: binding.candidateHash,
      selector: selectorFor(element), tag: bounded(element.tagName, 32).toLowerCase(),
      text: bounded(element.innerText || element.textContent, 500),
      rect: { x: clamp(rect.x, -100000, 100000), y: clamp(rect.y, -100000, 100000),
        width: clamp(rect.width, 0, 100000), height: clamp(rect.height, 0, 100000) },
    }, parentOrigin === 'null' ? '*' : parentOrigin);
  }, true);
}

const PICKER_CSS = Buffer.from('html[data-district-preview-inspecting] *{cursor:crosshair!important}[data-district-preview-target]{outline:3px solid #52efcb!important;outline-offset:3px!important}', 'utf8');

function pickerSource(binding, pathPrefix) {
  const encoded = JSON.stringify({ ...binding, pathPrefix }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return Buffer.from(`'use strict';(${pickerBootstrap.toString()})(${encoded});\n`, 'utf8');
}

function instrumentHtml(bytes, prefix, nonce) {
  const bridge = `<link rel="stylesheet" href="${prefix}__district/${nonce}.css"><script src="${prefix}__district/${nonce}.js"></script>`;
  const text = bytes.toString('utf8');
  // Install capture listeners before application scripts. Installing at </body>
  // lets an app's earlier document-capture handler swallow inspection clicks.
  const markup = text.replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length))
    .replace(/(<(script|style|textarea|title)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>)[\s\S]*?<\/\2\s*>/gi,
      (whole, tag) => tag + ' '.repeat(whole.length - tag.length));
  const opening = /<head\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/i.exec(markup)
    || /<html\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/i.exec(markup)
    || /<!doctype[^>]*>/i.exec(markup);
  const at = opening ? opening.index + opening[0].length : 0;
  return Buffer.from(text.slice(0, at) + bridge + text.slice(at), 'utf8');
}

class PreviewManager {
  constructor() {
    this._sessions = new Map();
    this._queues = new Map();
    this._closed = false;
  }
  _enqueue(projectId, operation) {
    const pending = (this._queues.get(projectId) || Promise.resolve()).then(operation);
    const tail = pending.catch(() => {});
    this._queues.set(projectId, tail);
    tail.then(() => { if (this._queues.get(projectId) === tail) this._queues.delete(projectId); });
    return pending;
  }
  async start({ projectId, runId, artifactRoot, candidateHash } = {}) {
    identifier(projectId, 'Project ID'); identifier(runId, 'Run ID');
    if (this._closed) throw new Error('Preview manager is closed.');
    return this._enqueue(projectId, async () => {
      if (this._closed) throw new Error('Preview manager is closed.');
      const artifact = captureArtifact(artifactRoot, candidateHash);
      const existing = this._sessions.get(projectId);
      if (existing?.binding.runId === runId) {
        if (existing.binding.candidateHash !== artifact.candidateHash || !samePath(existing.artifactRoot, artifact.root)) {
          throw new Error('A preview run cannot be rebound to a different candidate or artifact directory.');
        }
        // Reopening an identical verified run is not a reload command. Retaining
        // the URL/nonce preserves meaningful in-page interaction and selection.
        return { ...existing.binding };
      }
      const id = crypto.randomUUID(), nonce = crypto.randomBytes(24).toString('hex');
      const prefix = `/${crypto.randomBytes(24).toString('hex')}/`;
      const binding = { id, projectId, runId, candidateHash: artifact.candidateHash, url: '', nonce, created: Date.now() };
      const picker = pickerSource(binding, prefix);
      const headers = {
        // Form events must reach local JS handlers; form-action still forbids
        // actual submissions/navigation if a handler fails to prevent default.
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; sandbox allow-scripts allow-same-origin allow-forms",
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'X-District-Preview-Id': id,
        'X-District-Candidate-Hash': artifact.candidateHash,
      };
      const sockets = new Set();
      const respond = (res, status, bytes, type, head = false, extra = {}) => {
        res.writeHead(status, { ...headers, 'Content-Type': type, 'Content-Length': bytes.length,
          'X-District-Response-SHA256': sha256(bytes), ...extra });
        res.end(head ? undefined : bytes);
      };
      let origin = '';
      const server = http.createServer({ maxHeaderSize: 8192 }, (req, res) => {
        try {
          if (req.headers.host !== origin.slice('http://'.length)) return respond(res, 400, Buffer.from('Invalid host.'), 'text/plain');
          if (req.method !== 'GET' && req.method !== 'HEAD') return respond(res, 405, Buffer.from('Read-only preview.'), 'text/plain', false, { Allow: 'GET, HEAD' });
          const head = req.method === 'HEAD';
          if (!req.url || req.url.length > 4096 || !req.url.startsWith('/') || req.url.startsWith('//') || req.url.includes('#')) {
            return respond(res, 400, Buffer.from('Invalid request.'), 'text/plain', head);
          }
          let requested;
          try { requested = decodeURIComponent(req.url.split('?')[0]); }
          catch { return respond(res, 400, Buffer.from('Invalid request.'), 'text/plain', head); }
          if (requested.includes('\\') || requested.includes('\0') || requested.split('/').some((part) => part === '.' || part === '..')) {
            return respond(res, 400, Buffer.from('Invalid public path.'), 'text/plain', head);
          }
          if (!requested.startsWith(prefix)) return respond(res, 404, Buffer.from('Not found.'), 'text/plain', head);
          let relative = requested.slice(prefix.length);
          if (!relative || relative.endsWith('/')) relative += 'index.html';
          if (relative === `__district/${nonce}.js`) return respond(res, 200, picker, TYPES['.js'], head);
          if (relative === `__district/${nonce}.css`) return respond(res, 200, PICKER_CSS, TYPES['.css'], head);
          if (relative === '__district/identity.json') {
            const identity = Buffer.from(JSON.stringify({ id, projectId, runId, candidateHash: artifact.candidateHash, created: binding.created, files: artifact.manifest,
              instrumentation: { kind: 'district-element-picker', sourceFilesUnchanged: true } }), 'utf8');
            return respond(res, 200, identity, TYPES['.json'], head);
          }
          if (!publicPath(relative) || !artifact.files.has(relative)) return respond(res, 404, Buffer.from('Not found.'), 'text/plain', head);
          const original = artifact.files.get(relative);
          const type = TYPES[path.extname(relative).toLowerCase()];
          const bytes = path.extname(relative).toLowerCase() === '.html' ? instrumentHtml(original, prefix, nonce) : original;
          respond(res, 200, bytes, type, head, { 'X-District-Source-SHA256': artifact.manifest[relative] });
        } catch {
          if (!res.headersSent) respond(res, 500, Buffer.from('Preview could not read this artifact.'), 'text/plain');
          else res.destroy();
        }
      });
      server.maxConnections = 16;
      server.maxHeadersCount = 32;
      server.keepAliveTimeout = 1000;
      server.headersTimeout = 5000;
      server.requestTimeout = 5000;
      server.on('connection', (socket) => {
        sockets.add(socket); socket.setTimeout(5000, () => socket.destroy());
        socket.on('close', () => sockets.delete(socket));
      });
      server.on('clientError', (_error, socket) => socket.destroy());
      await new Promise((resolve, reject) => {
        const fail = (error) => { server.removeListener('listening', ready); reject(error); };
        const ready = () => {
          server.removeListener('error', fail);
          const address = server.address();
          origin = `http://127.0.0.1:${address.port}`;
          binding.url = `${origin}${prefix}index.html`;
          resolve();
        };
        server.once('error', fail); server.once('listening', ready);
        server.listen(0, '127.0.0.1');
      });
      server.on('error', () => {});
      const session = { binding, server, sockets, artifactRoot: artifact.root };
      if (this._closed) { await this._stopSession(session); throw new Error('Preview manager is closed.'); }
      const previous = this._sessions.get(projectId);
      if (previous) await this._stopSession(previous);
      if (this._closed) { await this._stopSession(session); throw new Error('Preview manager is closed.'); }
      this._sessions.set(projectId, session);
      return { ...binding };
    });
  }
  async _stopSession(session) {
    if (this._sessions.get(session.binding.projectId) === session) this._sessions.delete(session.binding.projectId);
    await new Promise((resolve) => {
      if (!session.server.listening) return resolve();
      session.server.close(resolve);
      for (const socket of session.sockets) socket.destroy();
    });
  }
  async stop(projectId, { previewId, runId, candidateHash } = {}) {
    identifier(projectId, 'Project ID');
    if (previewId !== undefined) identifier(previewId, 'Preview ID');
    if (runId !== undefined) identifier(runId, 'Run ID');
    if (candidateHash !== undefined && (typeof candidateHash !== 'string' || !/^[a-f0-9]{64}$/i.test(candidateHash))) throw new Error('Preview stop candidate must be a SHA-256 identity.');
    return this._enqueue(projectId, async () => {
      const session = this._sessions.get(projectId);
      if (!session) return false;
      // A delayed cancellation must never close a newer run's replacement.
      if ((previewId !== undefined && session.binding.id !== previewId)
        || (runId !== undefined && session.binding.runId !== runId)
        || (candidateHash !== undefined && session.binding.candidateHash !== candidateHash.toLowerCase())) return false;
      await this._stopSession(session);
      return true;
    });
  }
  list() { return Array.from(this._sessions.values(), ({ binding }) => ({ ...binding })); }
  async close() {
    if (!this._closePromise) {
      this._closed = true;
      this._closePromise = (async () => {
        await Promise.all(Array.from(this._queues.values()));
        await Promise.all(Array.from(this._sessions.values(), (session) => this._stopSession(session)));
      })();
    }
    return this._closePromise;
  }
}

module.exports = { PreviewManager };
