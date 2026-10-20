'use strict';

// One authenticated transport for CLI and MCP. Commands always go through the
// running desktop runtime; this module does not open a database or launch work.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

const MAX_COMMAND_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CONNECTION_FILE = path.resolve(__dirname, '..', '..', 'district-connection.json');

class DistrictClientError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'DistrictClientError';
    this.code = code;
    if (statusCode !== undefined) this.statusCode = statusCode;
  }
}

// Keep recovery information usable by both command-line JSON and MCP clients.
// Never serialize the request, connection descriptor or arbitrary Error fields.
function errorDetails(error, commandId) {
  const result = { error: String(error?.message || 'District request failed.') };
  if (typeof error?.code === 'string') result.code = error.code;
  if (Number.isInteger(error?.statusCode)) result.statusCode = error.statusCode;
  const id = error?.commandId || commandId;
  if (typeof id === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(id)) result.commandId = id;
  if (error?.outcomeUnknown === true) result.outcomeUnknown = true;
  return result;
}

function resolveConnectionFile(connectionFile, env = process.env) {
  const selected = connectionFile || env.AGENT_BUS_DISTRICT_CONNECTION || DEFAULT_CONNECTION_FILE;
  if (typeof selected !== 'string' || !selected.trim() || selected.includes('\0')) {
    throw new DistrictClientError('INVALID_CONNECTION', 'Choose a valid district connection file.');
  }
  return path.resolve(selected);
}

function validateConnection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 ||
      !Number.isSafeInteger(value.pid) || value.pid <= 0 ||
      typeof value.token !== 'string' || !/^[\x21-\x7e]{16,512}$/.test(value.token) ||
      typeof value.url !== 'string' || value.created == null) {
    throw new DistrictClientError('INVALID_CONNECTION', 'Invalid district connection descriptor. Reopen Agent Bus to refresh it.');
  }
  let url;
  try { url = new URL(value.url); } catch { /* Refuse below without echoing the descriptor. */ }
  if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new DistrictClientError('INVALID_CONNECTION', 'The district connection must use an explicit loopback HTTP port.');
  }
  return { version: 1, url: url.origin, token: value.token, pid: value.pid, created: value.created };
}

async function readConnection(connectionFile) {
  const file = resolveConnectionFile(connectionFile);
  let content;
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 16384) throw new Error('Invalid descriptor file.');
    content = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new DistrictClientError('NOT_CONNECTED', `No district connection at ${file}. Open Agent Bus, or use --connection PATH.`);
    }
    throw new DistrictClientError('INVALID_CONNECTION', 'Cannot read the district connection descriptor. Reopen Agent Bus to refresh it.');
  }
  let value;
  try { value = JSON.parse(content.replace(/^\uFEFF/, '')); }
  catch { throw new DistrictClientError('INVALID_CONNECTION', 'The district connection descriptor is not valid JSON.'); }
  return validateConnection(value);
}

async function connect(connectionFile) {
  const file = resolveConnectionFile(connectionFile);
  return { connectionFile: file, ...await readConnection(file) };
}

async function request(connectionFile, endpoint, body, options = {}) {
  if (!['/snapshot', '/command', '/health'].includes(endpoint) ||
      (endpoint === '/command' ? body === undefined : body !== undefined)) {
    throw new DistrictClientError('INVALID_REQUEST', 'Use GET /snapshot or /health, or POST /command with a command.');
  }
  let encoded;
  if (body !== undefined) {
    try { encoded = Buffer.from(JSON.stringify(body), 'utf8'); }
    catch { throw new DistrictClientError('INVALID_REQUEST', 'The district command must be JSON serializable.'); }
    if (encoded.length > MAX_COMMAND_BYTES) {
      throw new DistrictClientError('COMMAND_TOO_LARGE', 'The district command exceeds the 64KB limit.');
    }
  }
  const commandId = endpoint === '/command' && typeof body?.id === 'string' ? body.id : undefined;
  let descriptor;
  try { descriptor = await readConnection(connectionFile); }
  catch (error) { if (commandId) error.commandId = commandId; throw error; }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw new DistrictClientError('INVALID_REQUEST', 'The request timeout must be between 1 and 120000 milliseconds.');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        if (commandId) {
          error.commandId = commandId;
          if (['TIMEOUT', 'DISCONNECTED', 'INVALID_RESPONSE', 'RESPONSE_TOO_LARGE'].includes(error.code)) error.outcomeUnknown = true;
        }
        reject(error);
      } else resolve(result);
    };
    const safeMessage = (message) => String(message).split(descriptor.token).join('[redacted]').slice(0, 2000);
    const req = http.request(new URL(endpoint, descriptor.url), {
      method: encoded ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${descriptor.token}`, Accept: 'application/json',
        ...(encoded ? { 'Content-Type': 'application/json', 'Content-Length': encoded.length } : {}) },
      agent: false,
    }, (res) => {
      const chunks = [];
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          finish(new DistrictClientError('RESPONSE_TOO_LARGE', 'The district response exceeded its size limit.'));
          res.destroy(); req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.once('aborted', () => finish(new DistrictClientError('DISCONNECTED', 'The district connection closed before its response finished.')));
      res.once('error', () => finish(new DistrictClientError('DISCONNECTED', 'The district response could not be read.')));
      res.once('end', () => {
        let value;
        try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return finish(new DistrictClientError('INVALID_RESPONSE', 'The district bridge returned invalid JSON.', res.statusCode)); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return finish(new DistrictClientError('INVALID_RESPONSE', 'The district bridge returned an invalid response object.', res.statusCode));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = typeof value?.error === 'string' ? value.error : `District request failed (HTTP ${res.statusCode}).`;
          return finish(new DistrictClientError('HTTP_ERROR', safeMessage(detail), res.statusCode));
        }
        if (endpoint === '/command' && (!['accepted', 'completed', 'rejected'].includes(value.status) || value.id !== commandId)) {
          return finish(new DistrictClientError('INVALID_RESPONSE', 'The district bridge did not return a matching command receipt. Inspect status and retry the same request with the same command id.', res.statusCode));
        }
        finish(null, value);
      });
    });
    const timer = setTimeout(() => {
      finish(new DistrictClientError('TIMEOUT', 'The district request timed out. A command may have been accepted; inspect status and retry the same request with the same command id.'));
      req.destroy();
    }, timeoutMs);
    req.once('error', () => finish(new DistrictClientError('DISCONNECTED', 'Cannot reach the district bridge. Open Agent Bus and check its connection file.')));
    if (encoded) req.write(encoded);
    req.end();
  });
}

module.exports = { request, connect, readConnection, validateConnection, resolveConnectionFile,
  errorDetails, DistrictClientError, DEFAULT_CONNECTION_FILE, MAX_COMMAND_BYTES, MAX_RESPONSE_BYTES };
