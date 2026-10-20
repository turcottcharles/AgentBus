'use strict';
// Only this scoped server can turn a requested file edit into an observed event.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const { STARTERS } = require('./contracts');

const MAX_EVENTS = 256;
const MAX_WRITES = 64;
const MAX_CALLS = 512;
const MAX_JOURNAL = 2 * 1024 * 1024;
const PHASES = new Set(['research', 'edit', 'build', 'test', 'review']);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function normalizeContractId(contractId = 'checklist') {
  if (typeof contractId !== 'string' || !STARTERS.includes(contractId)) throw new Error('Unknown application contract.');
  return contractId;
}
function contractInstructions(contractId) {
  return normalizeContractId(contractId) === 'neon-rally'
    ? 'Preserve functional Neon Rally scoreboard behavior: both teams can gain points, theme can change, and reset clears both scores. Preserve data-testid selectors neon-add-comets, neon-add-bolts, neon-score-comets, neon-score-bolts, neon-theme, neon-reset and neon-status, and exactly one data-neon-rally-app mount root.'
    : 'Preserve functional checklist behavior and stable data-testid selectors task-input, add-task and task-list.';
}

function regularFile(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Private session file is invalid.');
  return stat;
}
function loadTicket(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('An absolute session ticket is required.');
  if (regularFile(file).size > 8192) throw new Error('Session ticket is too large.');
  const ticket = JSON.parse(fs.readFileSync(file, 'utf8'));
  const contractId = normalizeContractId(ticket.contractId);
  const directory = path.dirname(file);
  if (ticket.version !== 1 || typeof ticket.runId !== 'string' || !ticket.runId || ticket.runId.length > 128 ||
      !/^[a-f0-9]{64}$/.test(ticket.key || '') || !path.isAbsolute(ticket.root || '') ||
      !Number.isSafeInteger(ticket.ownerPid) || ticket.ownerPid < 1 || !Number.isFinite(ticket.expiresAt) ||
      ticket.events !== path.join(directory, 'events.jsonl') || ticket.state !== path.join(directory, 'state.json') ||
      ticket.revoked !== path.join(directory, 'revoked')) throw new Error('Invalid project session ticket.');
  return Object.freeze({ ...ticket, contractId, directory, ticketPath: file });
}
function assertActive(ticket) {
  if (fs.existsSync(ticket.revoked)) throw new Error('This project assignment has been revoked.');
  if (Date.now() >= ticket.expiresAt) throw new Error('This project assignment has expired.');
  try { process.kill(ticket.ownerPid, 0); }
  catch { throw new Error('The application that owned this assignment has stopped.'); }
}
function acquireLock(ticket) {
  const file = path.join(ticket.directory, 'operation.lock');
  const deadline = Date.now() + 2000;
  while (true) {
    try {
      const fd = fs.openSync(file, 'wx', 0o600);
      return () => { fs.closeSync(fd); fs.unlinkSync(file); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error('Another project operation did not finish. Retry this assignment.');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
}
function readState(ticket) {
  if (regularFile(ticket.state).size > 256 * 1024) throw new Error('Session operation state is too large.');
  const state = JSON.parse(fs.readFileSync(ticket.state, 'utf8'));
  if (!Number.isSafeInteger(state.seq) || state.seq < 0 || !Number.isSafeInteger(state.writes) || state.writes < 0 ||
      !Number.isSafeInteger(state.calls) || state.calls < 0 || typeof state.receipts !== 'object' || !state.receipts ||
      !/^(?:[a-f0-9]{64})?$/.test(state.lastMac || '')) throw new Error('Invalid session operation state.');
  return state;
}
function saveState(ticket, state) {
  const temporary = path.join(ticket.directory, `state-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(temporary, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
  try { fs.renameSync(temporary, ticket.state); }
  finally { try { fs.unlinkSync(temporary); } catch {} }
}
function signEvent(ticket, event) {
  const body = JSON.stringify({ ...event, contractId: normalizeContractId(ticket.contractId) });
  return { body, mac: crypto.createHmac('sha256', ticket.key).update(body).digest('hex') };
}
function verifyEvent(ticket, envelope) {
  if (!envelope || typeof envelope.body !== 'string' || envelope.body.length > 12000 || !/^[a-f0-9]{64}$/.test(envelope.mac || '')) throw new Error('Invalid project event envelope.');
  const expected = crypto.createHmac('sha256', ticket.key).update(envelope.body).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(envelope.mac, 'hex'))) throw new Error('Unverified project event signature.');
  const event = JSON.parse(envelope.body);
  if (normalizeContractId(event.contractId) !== normalizeContractId(ticket.contractId) || event.runId !== ticket.runId || typeof event.id !== 'string' || !Number.isSafeInteger(event.seq) || event.seq < 1 ||
      !Number.isFinite(event.at) || event.at > ticket.expiresAt || event.at > Date.now() + 10000 ||
      !/^(?:[a-f0-9]{64})?$/.test(event.previousMac || '')) throw new Error('Wrong project event identity.');
  if (event.type === 'activity') {
    const allowed = ['type', 'phase', 'basis', 'message', 'id', 'runId', 'seq', 'previousMac', 'at', 'contractId'];
    if (Object.keys(event).some((key) => !allowed.includes(key)) || event.basis !== 'reported' || !PHASES.has(event.phase) || typeof event.message !== 'string' || !event.message.trim() || event.message.length > 1200) throw new Error('Invalid reported project activity.');
  } else if (event.type === 'file_changed') {
    const allowed = ['type', 'phase', 'basis', 'path', 'bytes', 'hash', 'id', 'runId', 'seq', 'previousMac', 'at', 'contractId'];
    if (event.basis !== 'observed' || event.phase !== 'edit' || typeof event.path !== 'string' || event.path.length > 512 ||
        Object.keys(event).some((key) => !allowed.includes(key)) || path.isAbsolute(event.path) || /[\\:\x00-\x1f]/.test(event.path) ||
        event.path.split('/').some((part) => !part || part === '.' || part === '..' || /^(?:\.agent-bus|\.git)$/i.test(part)) ||
        !/^[a-f0-9]{64}$/.test(event.hash || '') || !Number.isSafeInteger(event.bytes) || event.bytes < 0 || event.bytes > 1024 * 1024) throw new Error('Invalid observed project file event.');
  } else throw new Error('Unknown project event type.');
  return event;
}
function recordEvent(ticket, state, event) {
  if (state.seq >= MAX_EVENTS) throw new Error('This assignment reached its activity/event limit.');
  if (regularFile(ticket.events).size >= MAX_JOURNAL) throw new Error('This assignment reached its journal limit.');
  const envelope = signEvent(ticket, { ...event, id: crypto.randomUUID(), runId: ticket.runId,
    seq: state.seq + 1, previousMac: state.lastMac, at: Date.now() });
  fs.appendFileSync(ticket.events, JSON.stringify(envelope) + '\n', { encoding: 'utf8', mode: 0o600 });
  state.seq += 1;
  state.lastMac = envelope.mac;
}
function validateArguments(args, allowed, required = []) {
  if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).some((key) => !allowed.includes(key)) || required.some((key) => !(key in args))) throw new Error('Unexpected or missing tool arguments.');
}
function createTools(ticket) {
  normalizeContractId(ticket.contractId);
  const { ProjectFiles } = require('./workspaces');
  const files = new ProjectFiles({ root: ticket.root });
  return function callTool(name, args = {}) {
    assertActive(ticket);
    const unlock = acquireLock(ticket);
    try {
      assertActive(ticket);
      const state = readState(ticket);
      if (state.calls >= MAX_CALLS) throw new Error('This assignment reached its tool-call limit.');
      state.calls += 1;
      // Reserve admission before performing any operation, including failed requests.
      saveState(ticket, state);
      if (name === 'project_list_files') {
        validateArguments(args, []);
        return { files: files.files() };
      }
      if (name === 'project_read_file') {
        validateArguments(args, ['path'], ['path']);
        if (typeof args.path !== 'string' || args.path.length > 512) throw new Error('Use a project-relative file path.');
        return { path: args.path, content: files.read(args.path) };
      }
      if (name === 'report_activity') {
        validateArguments(args, ['phase', 'message'], ['phase', 'message']);
        if (!PHASES.has(args.phase) || typeof args.message !== 'string' || !args.message.trim() || args.message.length > 1200) throw new Error('Use an allowed phase and a message of 1–1200 characters.');
        recordEvent(ticket, state, { type: 'activity', phase: args.phase, basis: 'reported', message: args.message.trim() });
        saveState(ticket, state);
        return { basis: 'reported', message: 'Activity displayed. This report does not prove edits, checks or completion.' };
      }
      if (name !== 'project_write_file') throw new Error('Unknown project tool.');
      validateArguments(args, ['path', 'content', 'request_id'], ['path', 'content']);
      if (typeof args.path !== 'string' || args.path.length > 512 || typeof args.content !== 'string' || Buffer.byteLength(args.content) > 1024 * 1024) throw new Error('Use a relative path and at most 1 MiB of UTF-8 content.');
      if (args.request_id !== undefined && (typeof args.request_id !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(args.request_id))) throw new Error('request_id must be 1–80 letters, numbers, dots, colons, underscores or dashes.');
      const absolute = files.resolve(args.path);
      const relative = path.relative(ticket.root, absolute).split(path.sep).join('/');
      const contentHash = hash(Buffer.from(args.content, 'utf8'));
      const fingerprint = hash(relative + '\0' + contentHash);
      const receiptKey = args.request_id ? hash(args.request_id) : null;
      const previous = receiptKey ? state.receipts[receiptKey] : null;
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new Error('This request_id already names a different write.');
        return { ...previous.result, repeated: true };
      }
      if (state.writes >= MAX_WRITES) throw new Error('This assignment reached its 64-write limit.');
      if (state.seq >= MAX_EVENTS || regularFile(ticket.events).size >= MAX_JOURNAL) throw new Error('This assignment reached its journal limit.');
      const result = files.write(relative, args.content);
      state.writes += 1;
      const observed = { path: relative, bytes: result.bytes, hash: result.hash };
      recordEvent(ticket, state, { type: 'file_changed', phase: 'edit', basis: 'observed', ...observed });
      if (receiptKey) state.receipts[receiptKey] = { fingerprint, result: observed };
      saveState(ticket, state);
      return observed;
    } finally { unlock(); }
  };
}

const TOOLS = Object.freeze([
  { name: 'project_list_files', description: 'List public files in this assignment’s generated project only.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'project_read_file', description: 'Read a public UTF-8 project file. Private/internal files and paths outside the project are refused.', inputSchema: { type: 'object', properties: { path: { type: 'string', maxLength: 512 } }, required: ['path'], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'project_write_file', description: 'Create or replace a bounded public project file. The application records the actual bytes and SHA-256. Optional request_id makes a retry idempotent; reuse with different content is refused. At most 64 writes per assignment.', inputSchema: { type: 'object', properties: { path: { type: 'string', maxLength: 512 }, content: { type: 'string', maxLength: 1048576 }, request_id: { type: 'string', maxLength: 80 } }, required: ['path', 'content'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } },
  { name: 'report_activity', description: 'Describe current activity. Always labeled agent-reported; cannot prove checks, file changes or completion.', inputSchema: { type: 'object', properties: { phase: { type: 'string', enum: [...PHASES] }, message: { type: 'string', minLength: 1, maxLength: 1200 } }, required: ['phase', 'message'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
]);

function serve(ticket, { input = process.stdin, output = process.stdout } = {}) {
  const callTool = createTools(ticket);
  const decoder = new StringDecoder('utf8');
  let pending = '';
  // A provider can leave its MCP stdin open after cancellation or disappear
  // without closing it. Ticket revocation must retire that owned capability,
  // not leave an idle worker waiting forever. This never launches any work.
  const retire = () => { clearInterval(authorityTimer); input.destroy(); };
  const authorityTimer = setInterval(() => {
    try { assertActive(ticket); } catch { retire(); }
  }, 500);
  authorityTimer.unref();
  input.once('close', () => clearInterval(authorityTimer));
  const reply = (id, result, error) => output.write(JSON.stringify({ jsonrpc: '2.0', id, ...(error ? { error } : { result }) }) + '\n');
  const processLine = (line) => {
    let request;
    try { request = JSON.parse(line); }
    catch { reply(null, null, { code: -32700, message: 'Invalid JSON.' }); return; }
    if (!request || request.id == null) return;
    try {
      assertActive(ticket);
      if (request.method === 'initialize') return reply(request.id, { protocolVersion: request.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'agent-bus-project', version: '1.0.0' }, instructions: `Use only the four scoped project tools. Report activity first. Application contract: ${normalizeContractId(ticket.contractId)}. ${contractInstructions(ticket.contractId)} The app runs checks after you exit; your prose cannot grant a pass.` });
      if (request.method === 'ping') return reply(request.id, {});
      if (request.method === 'tools/list') return reply(request.id, { tools: TOOLS });
      if (request.method !== 'tools/call') return reply(request.id, null, { code: -32601, message: 'Unknown method.' });
      const result = callTool(request.params?.name, request.params?.arguments ?? {});
      reply(request.id, { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
    } catch (error) { reply(request.id, { content: [{ type: 'text', text: error.message }], isError: true }); }
  };
  input.on('data', (chunk) => {
    pending += decoder.write(chunk);
    if (Buffer.byteLength(pending) > 8 * 1024 * 1024) { input.destroy(); process.exitCode = 1; return; }
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) if (line.trim()) processLine(line);
  });
  input.on('end', () => { clearInterval(authorityTimer); pending += decoder.end(); if (pending.trim()) processLine(pending); });
  output.on('error', () => { input.destroy(); process.exitCode = 1; });
}

if (require.main === module) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--ticket') throw new Error('Use --ticket with the private assignment ticket.');
    const ticket = loadTicket(process.argv[3]);
    assertActive(ticket);
    serve(ticket);
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}

module.exports = { loadTicket, assertActive, acquireLock, signEvent, verifyEvent, createTools, serve, normalizeContractId, contractInstructions, TOOLS, MAX_EVENTS, MAX_WRITES, MAX_JOURNAL };
