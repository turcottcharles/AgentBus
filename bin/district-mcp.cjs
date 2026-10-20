#!/usr/bin/env node
'use strict';

const { request, resolveConnectionFile, errorDetails, MAX_COMMAND_BYTES } = require('../app/district/client');
const { TYPES, PHASES } = require('../app/district/contracts');

const COMMAND_TYPES = TYPES;
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string', minLength: 1, maxLength: 16000 };
const identity = { type: 'string', minLength: 1, maxLength: 160 };
const activityLink = { runId: identity, sessionId: identity, attemptId: identity,
  sourceSeq: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } };
const commandProperties = { id: { ...identity, pattern: '^[a-zA-Z0-9:_-]+$' }, type: { type: 'string', enum: COMMAND_TYPES },
  projectId: identity, worker: identity, instruction: { ...string, maxLength: 12000 }, model: identity,
  effort: { ...string, maxLength: 40 }, payload: { type: 'object' } };
const TOOLS = [
  { name: 'district_snapshot', description: 'Read the same district snapshot as the GUI: project, run, activity, provider, checkpoint and candidate preview state. An online/available worker is not evidence that work ran.',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, inputSchema: object({}) },
  { name: 'district_command', description: 'Send an owner-authorized district command through the authenticated running app. Supply a stable id and reuse it on retry. Include projectId for every command except create_project and cancel_run (which requires a specific payload.runId). An accepted receipt is not completion or a successful check; inspect district_snapshot for actual state and evidence. Restore changes only the managed project. Activity cannot grant execution or a pass.',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true }, inputSchema: object(commandProperties, ['id', 'type']) },
  { name: 'district_activity', description: 'Attach an agent-reported activity to an explicit project on the live map. Optional run/session/attempt identities link this exact report; missing identities never borrow the latest run. sourceSeq orders one reporting stream. This records a report only; it does not start a job, change files, produce observed evidence or grant a pass. Reuse id on retry.',
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    inputSchema: object({ id: commandProperties.id, projectId: identity, workerId: identity,
      phase: { type: 'string', enum: PHASES }, message: { ...string, maxLength: 1200 }, ...activityLink }, ['id', 'projectId', 'workerId', 'phase', 'message']) },
];

function validateArguments(args, keys, required) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.');
  if (Object.keys(args).some((key) => !keys.includes(key))) throw new Error('Unknown tool argument.');
  for (const key of required) if (typeof args[key] !== 'string' || !args[key].trim()) throw new Error(`A nonempty ${key} is required.`);
  for (const [key, value] of Object.entries(args)) {
    if (key === 'payload') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('payload must be an object.');
    } else if (key === 'sourceSeq') {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid sourceSeq.');
    } else if (typeof value !== 'string' || !value.trim() || value.includes('\0') ||
      value.length > (['id', 'projectId', 'worker', 'workerId', 'model', 'runId', 'sessionId', 'attemptId'].includes(key) ? 160 :
        key === 'message' ? 1200 : key === 'effort' ? 40 : key === 'instruction' ? 12000 : 16000)) throw new Error(`Invalid ${key}.`);
  }
  if (args.id !== undefined && !/^[a-zA-Z0-9:_-]+$/.test(args.id)) throw new Error('Invalid id.');
}

function reportedActivity(command, origin) {
  const event = command.payload;
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      typeof event.workerId !== 'string' || !event.workerId.trim() ||
      !PHASES.includes(event.phase) || typeof event.message !== 'string' || !event.message.trim()) {
    throw new Error('Activity requires payload.workerId, phase and message.');
  }
  validateArguments({ workerId: event.workerId, message: event.message,
    ...Object.fromEntries(Object.keys(activityLink).filter((key) => event[key] !== undefined).map((key) => [key, event[key]])) },
  ['workerId', 'message', ...Object.keys(activityLink)], ['workerId', 'message']);
  if (command.worker && command.worker !== event.workerId) throw new Error('Activity worker does not match command worker.');
  // Caller-controlled evidence/basis/timing cannot manufacture observed work.
  // Keep the event identity bounded even for the longest valid command ID.
  const payload = { id: command.id.length <= 151 ? `${command.id}:activity` : command.id, projectId: command.projectId,
    workerId: event.workerId, phase: event.phase, message: event.message, basis: 'reported', origin };
  for (const key of Object.keys(activityLink)) if (event[key] !== undefined) payload[key] = event[key];
  return { ...command, payload };
}

async function callTool(name, args, connectionFile) {
  if (name === 'district_snapshot') {
    validateArguments(args, [], []);
    return request(connectionFile, '/snapshot');
  }
  if (name === 'district_activity') {
    validateArguments(args, ['id', 'projectId', 'workerId', 'phase', 'message', ...Object.keys(activityLink)], ['id', 'projectId', 'workerId', 'phase', 'message']);
    return request(connectionFile, '/command', reportedActivity({ id: args.id, type: 'report_activity', origin: 'mcp',
      projectId: args.projectId, worker: args.workerId, payload: args }, 'mcp'));
  }
  if (name !== 'district_command') throw new Error('Unknown district tool.');
  validateArguments(args, Object.keys(commandProperties), ['id', 'type']);
  if (!COMMAND_TYPES.includes(args.type)) throw new Error('Unknown district command type.');
  if (!['create_project', 'cancel_run'].includes(args.type) && !args.projectId?.trim()) throw new Error('An explicit projectId is required for this command.');
  let command = { ...args, origin: 'mcp' };
  if (command.type === 'report_activity') command = reportedActivity(command, 'mcp');
  return request(connectionFile, '/command', command);
}

function serve({ connectionFile, input = process.stdin, output = process.stdout } = {}) {
  const file = resolveConnectionFile(connectionFile);
  let pending = Buffer.alloc(0), closed = false;
  const reply = (id, result, error) => {
    if (!closed && !output.destroyed) output.write(JSON.stringify({ jsonrpc: '2.0', id, ...(error ? { error } : { result }) }) + '\n');
  };
  const receive = async (line) => {
    let req;
    try { req = JSON.parse(line); } catch { return reply(null, null, { code: -32700, message: 'Invalid JSON.' }); }
    if (!req || typeof req !== 'object' || Array.isArray(req) || req.jsonrpc !== '2.0' || typeof req.method !== 'string' ||
        (req.id !== undefined && typeof req.id !== 'string' && typeof req.id !== 'number' && req.id !== null)) {
      return reply(null, null, { code: -32600, message: 'Invalid JSON-RPC request.' });
    }
    if (req.id === undefined || req.id === null) return;
    if (req.method === 'initialize') {
      const requested = req.params?.protocolVersion;
      const protocolVersion = ['2024-11-05', '2025-03-26', '2025-06-18'].includes(requested) ? requested : '2024-11-05';
      return reply(req.id, { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'agent-bus-district', version: '1.0.0' },
        instructions: 'Use stable command ids. Accepted is not completed. Read snapshots for actual execution evidence; reports are always labeled agent-reported.' });
    }
    if (req.method === 'ping') return reply(req.id, {});
    if (req.method === 'tools/list') return reply(req.id, { tools: TOOLS });
    if (req.method !== 'tools/call') return reply(req.id, null, { code: -32601, message: 'Unknown method.' });
    try {
      const result = await callTool(req.params?.name, req.params?.arguments ?? {}, file);
      const content = [{ type: 'text', text: JSON.stringify(result) }];
      if (result?.status === 'accepted') content.push({ type: 'text', text: 'Accepted only. Execution is not yet completed; read district_snapshot for actual state and evidence.' });
      reply(req.id, { content, structuredContent: result, isError: result?.status === 'rejected' });
    } catch (error) {
      const detail = errorDetails(error, req.params?.arguments?.id);
      reply(req.id, { content: [{ type: 'text', text: JSON.stringify(detail) }], structuredContent: detail, isError: true });
    }
  };
  input.on('data', (data) => {
    if (closed) return;
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let start = 0;
    for (let index = 0; index < chunk.length; index++) {
      if (chunk[index] !== 10) continue;
      const part = chunk.subarray(start, index);
      if (pending.length + part.length > MAX_COMMAND_BYTES) {
        reply(null, null, { code: -32600, message: 'MCP request exceeds 64KB.' }); closed = true; input.pause(); return;
      }
      const line = Buffer.concat([pending, part]).toString('utf8').trim();
      pending = Buffer.alloc(0); start = index + 1;
      if (line) void receive(line);
    }
    const remainder = chunk.subarray(start);
    if (pending.length + remainder.length > MAX_COMMAND_BYTES) {
      reply(null, null, { code: -32600, message: 'MCP request exceeds 64KB.' }); closed = true; input.pause(); return;
    }
    pending = Buffer.concat([pending, remainder]);
  });
  input.once('end', () => {
    if (!closed && pending.length) void receive(pending.toString('utf8'));
    pending = Buffer.alloc(0);
  });
  input.once('error', () => { closed = true; });
  output.once('error', () => { closed = true; input.pause(); });
  return { close() { closed = true; input.pause(); } };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && (args.length !== 2 || args[0] !== '--connection' || !args[1])) throw new Error('Use --connection PATH, or AGENT_BUS_DISTRICT_CONNECTION.');
    serve({ connectionFile: args[1] });
  } catch (error) { process.stderr.write(`District MCP: ${error.message}\n`); process.exitCode = 1; }
}
module.exports = { serve, callTool, TOOLS, COMMAND_TYPES };
