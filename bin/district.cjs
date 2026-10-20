#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const { request, resolveConnectionFile, errorDetails } = require('../app/district/client');
const { normalize: normalizeRegion } = require('../app/district/regions');
const { STARTERS } = require('../app/district/contracts');

const HELP = `Agent Bus District

Usage: node bin/district.cjs COMMAND [--connection PATH] [--json] [--id COMMAND_ID]

  status
  create NAME [--starter checklist|neon-rally]
  run PROJECT --agent codex|claude --instruction TEXT [--model MODEL --effort EFFORT]
  check PROJECT
  activity PROJECT --worker NAME --phase research|edit|build|test|review|idle|waiting|error --message TEXT
    [--run RUN --session SESSION --attempt ATTEMPT --seq SEQUENCE]
  checkpoint PROJECT --label TEXT
  restore PROJECT CHECKPOINT
  diff PROJECT CHECKPOINT
  cancel RUN
  preview PROJECT [--run RUN | --stop]
  display PROJECT --monitor ID --area REGION [--bounds x,y,width,height]
  visual-check PROJECT [--run RUN]
  window PROJECT [--run RUN]

Connection: --connection, then AGENT_BUS_DISTRICT_CONNECTION, then the repository's
district-connection.json. Open Agent Bus to create that private descriptor.
Accepted means queued/started, not completed. Use status to inspect actual run
states and evidence. Activity is agent-reported; it cannot grant a pass.
Reuse --id when retrying the same command after an uncertain network result.
Activity linkage is explicit; omitting --run never borrows the latest run.

Monitor IDs appear in status (or status --json) and identify actual OS displays.
Areas do not create virtual monitors. REGION: full, left-third, middle-third,
right-third, left-half, right-half, top-left, top-right, bottom-left, bottom-right,
or custom. Custom requires --bounds with four normalized fractions inside 0–1,
relative to the selected display's usable logical/DIP work area, not native pixels.
The server validates connected displays, geometry, minimum size and candidate
identity. visual-check acceptance is not a passing result; inspect status.
`;

const PHASES = new Set(['research', 'edit', 'build', 'test', 'review', 'idle', 'waiting', 'error']);
const VALUE_OPTIONS = new Set(['connection', 'id', 'agent', 'instruction', 'model', 'effort', 'worker', 'phase', 'message', 'label', 'run', 'session', 'attempt', 'seq', 'monitor', 'area', 'bounds', 'starter']);
const OPTION_LIMITS = { id: 128, run: 128, session: 128, attempt: 128, seq: 16, monitor: 128, area: 32, bounds: 256, starter: 40 };
const COMMAND_OPTIONS = {
  help: [], status: [], create: ['starter'], run: ['agent', 'instruction', 'model', 'effort'], check: [],
  activity: ['worker', 'phase', 'message', 'run', 'session', 'attempt', 'seq'], checkpoint: ['label'], restore: [], diff: [],
  cancel: [], preview: ['run', 'stop'], display: ['monitor', 'area', 'bounds'],
  'visual-check': ['run'], window: ['run'],
};

function parseArgs(args) {
  const positional = [], options = {};
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!literal && arg === '--') { literal = true; continue; }
    if (!literal && (arg === '-h' || arg === '--help')) { options.help = true; continue; }
    if (!literal && arg.startsWith('--')) {
      const equals = arg.indexOf('=');
      const key = arg.slice(2, equals < 0 ? undefined : equals);
      if (Object.hasOwn(options, key)) throw new Error(`Option --${key} was supplied twice.`);
      if (['json', 'stop'].includes(key)) {
        if (equals >= 0) throw new Error(`Option --${key} takes no value.`);
        options[key] = true;
      } else {
        if (!VALUE_OPTIONS.has(key)) throw new Error(`Unknown option --${key}.`);
        const value = equals < 0 ? args[++i] : arg.slice(equals + 1);
        if (!value || (equals < 0 && value.startsWith('--'))) throw new Error(`Option --${key} requires a value.`);
        if (OPTION_LIMITS[key] && (value.length > OPTION_LIMITS[key] || /[\x00-\x1f\x7f]/.test(value))) {
          throw new Error(`Option --${key} must contain at most ${OPTION_LIMITS[key]} characters without control characters.`);
        }
        options[key] = value;
      }
    } else positional.push(arg);
  }
  const command = options.help ? 'help' : positional.shift() || 'help';
  if (!Object.hasOwn(COMMAND_OPTIONS, command)) throw new Error(`Unknown command ${command}. Use help.`);
  for (const key of Object.keys(options)) {
    if (!['connection', 'id', 'json', 'help'].includes(key) && !COMMAND_OPTIONS[command].includes(key)) {
      throw new Error(`Option --${key} is not valid for ${command}.`);
    }
  }
  return { command, positional, options };
}

function buildCommand(parsed) {
  const { command, positional: p, options: o } = parsed;
  const counts = { create: 1, run: 1, check: 1, activity: 1, checkpoint: 1, restore: 2, diff: 2, cancel: 1, preview: 1,
    display: 1, 'visual-check': 1, window: 1 };
  if (p.length !== counts[command]) throw new Error(`${command} expects ${counts[command]} positional argument(s). Quote names or instructions containing spaces.`);
  const required = (key) => {
    if (typeof o[key] !== 'string' || !o[key].trim()) throw new Error(`${command} requires --${key}.`);
    return o[key];
  };
  const identifier = (value, label) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 128 || /[\x00-\x1f\x7f]/.test(value)) {
      throw new Error(`${label} must contain 1–128 characters without control characters.`);
    }
    return value.trim();
  };
  const result = { id: o.id || crypto.randomUUID(), type: '', origin: 'cli' };
  if (typeof result.id !== 'string' || result.id.length > 128 || !/^[a-zA-Z0-9:_-]+$/.test(result.id)) {
    throw new Error('Command id must contain 1–128 letters, digits, colons, underscores or hyphens.');
  }
  if (command !== 'create' && command !== 'cancel') result.projectId = identifier(p[0], 'Project ID');
  switch (command) {
    case 'create':
      result.type = 'create_project'; result.payload = { name: p[0] };
      if (o.starter !== undefined) {
        if (!STARTERS.includes(o.starter)) throw new Error(`Unknown starter. Choose ${STARTERS.join(' or ')}.`);
        result.payload.starterId = o.starter;
      }
      break;
    case 'run':
      result.type = 'start_task'; result.worker = required('agent'); result.instruction = required('instruction');
      if (!['codex', 'claude'].includes(result.worker)) throw new Error('--agent must be codex or claude.');
      if (o.model) result.model = o.model;
      if (o.effort) result.effort = o.effort;
      break;
    case 'check': result.type = 'run_checks'; break;
    case 'activity': {
      result.type = 'report_activity'; result.worker = required('worker');
      const phase = required('phase');
      if (!PHASES.has(phase)) throw new Error('Choose a supported activity phase. Use help.');
      result.payload = { id: `${result.id}:activity`, projectId: result.projectId, workerId: result.worker,
        phase, message: required('message'), basis: 'reported', origin: 'cli' };
      for (const [option, key] of [['run', 'runId'], ['session', 'sessionId'], ['attempt', 'attemptId']]) {
        if (o[option] !== undefined) result.payload[key] = identifier(o[option], `${option} ID`);
      }
      if (o.seq !== undefined) {
        if (!/^\d+$/.test(o.seq) || !Number.isSafeInteger(Number(o.seq))) throw new Error('--seq must be a nonnegative safe integer.');
        result.payload.sourceSeq = Number(o.seq);
      }
      break;
    }
    case 'checkpoint': result.type = 'create_checkpoint'; result.payload = { label: required('label') }; break;
    case 'restore': result.type = 'restore_checkpoint'; result.payload = { checkpointId: p[1] }; break;
    case 'diff': result.type = 'inspect_diff'; result.payload = { checkpointId: p[1] }; break;
    case 'cancel': result.type = 'cancel_run'; result.payload = { runId: p[0] }; break;
    case 'preview':
      if (o.stop && o.run) throw new Error('Choose --run or --stop for preview.');
      result.type = o.stop ? 'preview_stop' : 'preview_start';
      if (o.run) result.payload = { runId: o.run };
      break;
    case 'display': {
      const testDisplayId = identifier(required('monitor'), 'Monitor ID');
      const region = required('area');
      let custom;
      if (region === 'custom') {
        const raw = required('bounds');
        const parts = raw.split(',').map((part) => part.trim());
        const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
        if (parts.length !== 4 || parts.some((part) => !decimal.test(part))) {
          throw new Error('--bounds must be four finite decimal fractions: x,y,width,height.');
        }
        custom = Object.fromEntries(['x', 'y', 'width', 'height'].map((key, index) => [key, Number(parts[index])]));
      } else if (o.bounds !== undefined) throw new Error('--bounds is only valid with --area custom.');
      const normalized = normalizeRegion(region, custom);
      result.type = 'set_project_preferences';
      result.payload = { testDisplayId, testRegion: normalized.region,
        testBounds: normalized.region === 'custom' ? normalized.bounds : null };
      break;
    }
    case 'visual-check':
    case 'window':
      result.type = command === 'visual-check' ? 'run_visual_checks' : 'open_preview_window';
      if (o.run) result.payload = { runId: identifier(o.run, 'Run ID') };
      break;
  }
  return result;
}

function formatReceipt(receipt) {
  if (!receipt || !['accepted', 'completed', 'rejected'].includes(receipt.status)) {
    throw new Error('The bridge did not return a recognized command receipt. Inspect status before retrying.');
  }
  const lines = [`${receipt.status === 'accepted' ? 'Accepted' : receipt.status === 'completed' ? 'Completed' : 'Rejected'} command ${receipt.id || '(unknown id)'}.`];
  if (receipt.projectId) lines.push(`Project: ${receipt.projectId}`);
  if (receipt.runId) lines.push(`Run: ${receipt.runId}`);
  if (receipt.status === 'accepted') lines.push('Execution is not yet completed. Use status --json to inspect the real run state and evidence.');
  if (receipt.error) lines.push(`Error: ${typeof receipt.error === 'string' ? receipt.error : JSON.stringify(receipt.error)}`);
  if (receipt.result !== undefined) lines.push(JSON.stringify(receipt.result, null, 2));
  return lines.join('\n');
}

function formatSnapshot(snapshot) {
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
  const displays = Array.isArray(snapshot.displays) ? snapshot.displays : [];
  const lines = [`District state · event sequence ${snapshot.seq ?? 'unknown'}`,
    `Projects: ${projects.length} · Runs: ${runs.length}`];
  for (const project of projects) lines.push(`Project ${project.id}: ${project.name || project.id}`);
  for (const run of runs) lines.push(`Run ${run.id}: ${run.state || run.status || 'unknown'}${run.projectId ? ` · project ${run.projectId}` : ''}`);
  for (const display of displays) lines.push(`OS monitor ${display.id}: ${display.name || display.id}${display.primary ? ' · primary' : ''}`);
  if (!displays.length) lines.push(Array.isArray(snapshot.displays) ? 'No OS displays are currently reported.' : 'OS display inventory is unavailable in this snapshot.');
  for (const provider of snapshot.providers || []) lines.push(`${provider.name || provider.id}: ${provider.available ? 'CLI available' : 'unavailable'}${provider.detail ? ` · ${provider.detail}` : ''}`);
  lines.push('CLI availability is not login or quota confirmation. Use --json for complete activity and execution evidence.');
  return lines.join('\n');
}

async function main(args = process.argv.slice(2), io = process) {
  let parsed, command;
  try {
    parsed = parseArgs(args);
    if (parsed.command === 'help') { io.stdout.write(HELP); return 0; }
    if (parsed.command === 'status' && parsed.positional.length) throw new Error('status takes no positional arguments.');
    if (parsed.command !== 'status') command = buildCommand(parsed);
    const file = resolveConnectionFile(parsed.options.connection);
    const value = parsed.command === 'status' ? await request(file, '/snapshot') : await request(file, '/command', command);
    io.stdout.write((parsed.options.json ? JSON.stringify(value, null, 2) : parsed.command === 'status' ? formatSnapshot(value) : formatReceipt(value)) + '\n');
    return value?.status === 'rejected' ? 1 : 0;
  } catch (error) {
    const detail = errorDetails(error, command?.id);
    if (parsed?.options.json || args.includes('--json')) {
      io.stdout.write(JSON.stringify(detail) + '\n');
    } else io.stderr.write(`District: ${detail.error}${detail.commandId ? `\nCommand: ${detail.commandId}. Reuse this id for the same request.` : ''}\n`);
    return 1;
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code; });
module.exports = { main, parseArgs, buildCommand, formatReceipt, formatSnapshot, HELP };
