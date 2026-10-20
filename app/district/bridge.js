'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { TYPES, normalizeCommand } = require('./contracts');

const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const COMMAND_TYPES = new Set(TYPES);
const COMMAND_KEYS = new Set(['id', 'type', 'origin', 'projectId', 'worker', 'instruction', 'model', 'effort', 'payload']);

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function validateCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command))
    throw new RequestError(400, 'Command must be a JSON object.');
  for (const key of Object.keys(command)) {
    if (!COMMAND_KEYS.has(key)) throw new RequestError(400, 'Command contains an unsupported field.');
    if (key === 'payload') continue;
    if (typeof command[key] !== 'string' || command[key].length > 32768 || command[key].includes('\0'))
      throw new RequestError(400, 'Command contains an invalid or oversized field.');
  }
  if (!command.id?.trim() || !COMMAND_TYPES.has(command.type))
    throw new RequestError(400, 'Command requires an id and a supported type.');
  if (command.payload !== undefined && (!command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)))
    throw new RequestError(400, 'Command payload must be a JSON object.');

  // A byte cap alone permits deeply nested or very wide JSON that downstream code cannot safely visit.
  const pending = [{ value: command.payload, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop();
    if (++count > 2048 || depth > 12) throw new RequestError(400, 'Command payload is too complex.');
    if (typeof value === 'string' && (value.length > 32768 || value.includes('\0')))
      throw new RequestError(400, 'Command payload contains an invalid or oversized string.');
    if (!value || typeof value !== 'object') continue;
    const keys = Object.keys(value);
    if (keys.length > (Array.isArray(value) ? 256 : 64))
      throw new RequestError(400, 'Command payload is too complex.');
    for (const key of keys) {
      if (key.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(key))
        throw new RequestError(400, 'Command payload contains an unsupported field.');
      pending.push({ value: value[key], depth: depth + 1 });
    }
  }
  try { normalizeCommand(command); }
  catch { throw new RequestError(400, 'Command fields do not match the district contract.'); }
  return command;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const length = Number(request.headers['content-length']);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      request.resume();
      reject(new RequestError(413, 'Command body exceeds 64 KB.'));
      return;
    }
    const chunks = [];
    let bytes = 0, settled = false;
    const fail = (error) => { if (!settled) { settled = true; reject(error); } };
    request.on('data', (chunk) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        chunks.length = 0;
        fail(new RequestError(413, 'Command body exceeds 64 KB.'));
        return;
      }
      chunks.push(chunk);
    });
    request.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, bytes).toString('utf8'));
    });
    request.once('aborted', () => fail(new RequestError(400, 'Command body was interrupted.')));
    request.once('error', () => fail(new RequestError(400, 'Command body could not be read.')));
  });
}

function sameFile(a, b) { return a.dev === b.dev && a.ino === b.ino; }

function ownedDescriptor(value) {
  const valid = value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'created,pid,token,url,version' && value.version === 1 &&
    Number.isInteger(value.pid) && value.pid > 0 && value.pid <= 0x7fffffff &&
    Number.isFinite(value.created) && value.created > 0 &&
    typeof value.token === 'string' && /^[a-f0-9]{64}$/.test(value.token) &&
    typeof value.url === 'string';
  const endpoint = valid && /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/?$/.exec(value.url);
  return !!endpoint && Number(endpoint[1]) <= 65535;
}

function endpointReachable(url) {
  return new Promise((resolve) => {
    let connected = false, finished = false;
    const finish = (reachable) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      resolve(reachable);
      request.destroy();
    };
    const deadline = setTimeout(() => finish(connected), 1000);
    const request = http.get(new URL('/health', url), { agent: false }, (response) => {
      response.resume();
      finish(true);
    });
    request.once('socket', (socket) => socket.once('connect', () => { connected = true; }));
    // Any listener is a reason to preserve the descriptor, even if its HTTP health reply fails.
    request.once('error', () => finish(connected));
    request.setTimeout(750, () => finish(connected));
  });
}

class DistrictBridge {
  constructor({ runtime, connectionFile, port = 0, recoverStale = true } = {}) {
    if (!runtime || typeof runtime.snapshot !== 'function' || typeof runtime.command !== 'function')
      throw new TypeError('DistrictBridge requires runtime.snapshot and runtime.command.');
    if (typeof connectionFile !== 'string' || !path.isAbsolute(connectionFile) || connectionFile.includes('\0'))
      throw new TypeError('DistrictBridge requires an absolute connectionFile path.');
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('Invalid DistrictBridge port.');
    this.runtime = runtime;
    this.connectionFile = path.resolve(connectionFile);
    this.port = port;
    this.recoverStale = recoverStale === true;
    this.recoveredDescriptor = null;
    this.server = null;
    this.descriptor = null;
    this._descriptorText = null;
    this._descriptorStat = null;
    this._starting = null;
    this._closing = null;
    this._closed = false;
    this._sockets = new Set();
  }

  start() {
    if (this._closed) return Promise.reject(new Error('District bridge is closed.'));
    if (this.descriptor) return Promise.resolve({ url: this.descriptor.url, connectionFile: this.connectionFile });
    if (this._starting) return this._starting;
    const starting = this._start();
    this._starting = starting;
    starting.then(() => { this._starting = null; }, () => { this._starting = null; });
    return starting;
  }

  async _start() {
    const server = this.server = http.createServer((request, response) => {
      this._handle(request, response).catch((error) => {
        const status = error instanceof RequestError ? error.status : 500;
        this._json(response, status, { error: error instanceof RequestError ? error.message : 'District request failed.' }, status === 413);
      });
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 5000;
    server.keepAliveTimeout = 1000;
    server.maxHeadersCount = 32;
    server.on('connection', (socket) => {
      this._sockets.add(socket);
      socket.once('close', () => this._sockets.delete(socket));
      socket.setTimeout(15000, () => socket.destroy());
    });
    server.on('error', () => {}); // listen failures are returned below; an emitted server error must not crash Electron.
    try {
      // Recover before binding: a configured port may be the old descriptor's port, and
      // probing after binding would mistake this new server for the crashed instance.
      if (fs.existsSync(this.connectionFile)) await this._recoverExistingDescriptor();
      if (this._closed) throw new Error('District bridge closed during startup.');
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(this.port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
      });
      if (this._closed) throw new Error('District bridge closed during startup.');
      const descriptor = { version: 1, url: `http://127.0.0.1:${server.address().port}`,
        token: crypto.randomBytes(32).toString('hex'), pid: process.pid, created: Date.now() };
      const text = JSON.stringify(descriptor, null, 2) + '\n';
      let fd;
      try {
        fd = fs.openSync(this.connectionFile, 'wx', 0o600);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        await this._recoverExistingDescriptor();
        if (this._closed) throw new Error('District bridge closed during startup.');
        // Exclusive creation is still authoritative if another startup won after recovery.
        try { fd = fs.openSync(this.connectionFile, 'wx', 0o600); }
        catch (cause) {
          if (cause.code === 'EEXIST') throw new Error('Another instance claimed the district connection descriptor during recovery; its file was left unchanged.');
          throw cause;
        }
      }
      try {
        this._descriptorStat = fs.fstatSync(fd);
        fs.writeFileSync(fd, text, 'utf8');
        fs.fsyncSync(fd);
        this._descriptorText = text;
        this.descriptor = descriptor;
      } catch (error) {
        // Only the exact file exclusively created by this startup may be removed.
        try {
          const current = fs.lstatSync(this.connectionFile);
          if (current.isFile() && sameFile(current, this._descriptorStat)) fs.unlinkSync(this.connectionFile);
        } catch {}
        throw error;
      } finally { fs.closeSync(fd); }
      return { url: descriptor.url, connectionFile: this.connectionFile };
    } catch (error) {
      await this._stopServer(server);
      if (this.server === server) this.server = null;
      throw error;
    }
  }

  async _recoverExistingDescriptor() {
    let existing, original, stat;
    try {
      stat = fs.lstatSync(this.connectionFile);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error();
      original = fs.readFileSync(this.connectionFile, 'utf8');
      existing = JSON.parse(original);
      if (!ownedDescriptor(existing)) throw new Error();
    } catch { throw new Error('District connection descriptor already exists and is not a recognized owned file; it was left unchanged.'); }
    try { process.kill(existing.pid, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw new Error('District connection descriptor may belong to a live process; it was left unchanged.');
      if (!this.recoverStale) throw new Error('A stale district connection descriptor exists; recovery is disabled and its file was left unchanged.');
      if (await endpointReachable(existing.url))
        throw new Error('The previous district endpoint is still reachable; its connection descriptor was left unchanged.');
      let stillAbsent = false;
      try { process.kill(existing.pid, 0); } catch (cause) { stillAbsent = cause.code === 'ESRCH'; }
      if (!stillAbsent) throw new Error('The previous district process is no longer confirmed absent; its descriptor was left unchanged.');
      const unchanged = () => {
        const current = fs.lstatSync(this.connectionFile);
        return current.isFile() && !current.isSymbolicLink() && sameFile(stat, current) && current.size <= 8192 &&
          fs.readFileSync(this.connectionFile, 'utf8') === original;
      };
      if (!unchanged()) throw new Error('District connection descriptor changed during recovery; it was left unchanged.');
      const stalePath = `${this.connectionFile}.stale-${crypto.randomUUID()}`;
      if (fs.existsSync(stalePath)) throw new Error('District stale descriptor archive already exists; recovery stopped.');
      fs.renameSync(this.connectionFile, stalePath);
      const moved = fs.lstatSync(stalePath);
      if (!moved.isFile() || !sameFile(stat, moved) || fs.readFileSync(stalePath, 'utf8') !== original) {
        // A competing writer replaced the path between the check and rename. Restore by an
        // exclusive link, never rename over a newly claimed descriptor, and preserve the archive.
        try { fs.linkSync(stalePath, this.connectionFile); } catch {}
        throw new Error('District descriptor changed during atomic recovery; the moved file was preserved and no replacement was written.');
      }
      this.recoveredDescriptor = { file: stalePath, pid: existing.pid, created: existing.created };
      return;
    }
    throw new Error('Another live process owns the district connection descriptor; stop that instance before starting this bridge.');
  }

  _authorized(request) {
    const value = request.headers.authorization;
    if (typeof value !== 'string' || !value.startsWith('Bearer ') || !this.descriptor) return false;
    const actual = Buffer.from(value.slice(7));
    const expected = Buffer.from(this.descriptor.token);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  async _handle(request, response) {
    if (Object.hasOwn(request.headers, 'origin')) throw new RequestError(403, 'Browser origins are not allowed.');
    if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress))
      throw new RequestError(403, 'Only local connections are allowed.');
    const address = this.server?.address();
    if (!address || ![`127.0.0.1:${address.port}`, ...(address.port === 80 ? ['127.0.0.1'] : [])].includes(request.headers.host))
      throw new RequestError(403, 'Invalid local host.');
    if (request.method === 'GET' && request.url === '/health')
      return this._json(response, 200, { ok: true, service: 'agent-bus-district', version: 1 });
    if (!this._authorized(request)) throw new RequestError(401, 'District authorization required.');
    if (request.url === '/snapshot') {
      if (request.method !== 'GET') throw new RequestError(405, 'Method not allowed.');
      return this._json(response, 200, await this.runtime.snapshot());
    }
    if (request.url === '/command') {
      if (request.method !== 'POST') throw new RequestError(405, 'Method not allowed.');
      if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json')
        throw new RequestError(415, 'Commands require application/json.');
      let command;
      try { command = JSON.parse(await readBody(request)); }
      catch (error) { if (error instanceof RequestError) throw error; throw new RequestError(400, 'Command body is not valid JSON.'); }
      return this._json(response, 200, await this.runtime.command(validateCommand(command)));
    }
    throw new RequestError(404, 'District endpoint not found.');
  }

  _json(response, status, value, close = false) {
    if (response.headersSent || response.destroyed) return;
    let text;
    try {
      text = JSON.stringify(value);
      if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new Error();
    } catch { status = 500; text = JSON.stringify({ error: 'District response could not be encoded.' }); }
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...(close ? { Connection: 'close' } : {}) });
    response.end(text);
  }

  _stopServer(server) {
    if (!server) return Promise.resolve();
    return new Promise((resolve) => {
      server.close(() => resolve());
      for (const socket of this._sockets) socket.destroy();
      server.closeAllConnections?.();
    });
  }

  close() {
    if (this._closing) return this._closing;
    this._closed = true;
    this._closing = (async () => {
      if (this._starting) await this._starting.catch(() => {});
      await this._stopServer(this.server);
      this.server = null;
      if (this._descriptorText && this._descriptorStat) {
        try {
          const before = fs.lstatSync(this.connectionFile);
          if (before.isFile() && !before.isSymbolicLink() && before.size <= 8192 && sameFile(before, this._descriptorStat) &&
              fs.readFileSync(this.connectionFile, 'utf8') === this._descriptorText &&
              sameFile(fs.lstatSync(this.connectionFile), this._descriptorStat)) fs.unlinkSync(this.connectionFile);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      this.descriptor = null;
    })();
    return this._closing;
  }
}

module.exports = { DistrictBridge };
