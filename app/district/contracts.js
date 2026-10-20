'use strict';
const crypto = require('node:crypto');
const TYPES = Object.freeze(['create_project', 'start_task', 'run_checks', 'report_activity', 'create_checkpoint',
  'restore_checkpoint', 'preview_start', 'preview_stop', 'cancel_run', 'inspect_diff', 'set_project_preferences',
  'open_preview_window', 'run_visual_checks']);
const TERMINAL = Object.freeze(['passed', 'failed', 'cancelled', 'interrupted', 'timed_out', 'termination_unknown']);
const PHASES = Object.freeze(['research', 'edit', 'build', 'test', 'review', 'idle', 'waiting', 'error']);
const VISUAL_CHECKS = Object.freeze(['Preview load', 'Target display', 'Add two tasks', 'Complete a task', 'Remove a task']);
const STARTERS = Object.freeze(['checklist', 'neon-rally']);
const RALLY_VISUAL_CHECKS = Object.freeze(['Preview load', 'Target display', 'Score both teams', 'Change the look', 'Reset the scores']);
function visualChecksFor(contractId = 'checklist') {
  if (!STARTERS.includes(contractId)) throw new Error('Unknown application contract');
  return contractId === 'neon-rally' ? RALLY_VISUAL_CHECKS : VISUAL_CHECKS;
}
function text(value, name, max, required = false) {
  if (value == null && !required) return undefined;
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || value.includes('\0')) throw new Error(`Invalid ${name}`);
  return value.trim();
}
function normalizeCommand(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A command object is required');
  if (!TYPES.includes(input.type)) throw new Error('Unknown district command');
  const id = text(input.id, 'command ID', 160) || crypto.randomUUID();
  if (!/^[a-zA-Z0-9:_-]+$/.test(id)) throw new Error('Invalid command ID');
  const payload = input.payload == null ? {} : input.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Buffer.byteLength(JSON.stringify(payload)) > 48000) throw new Error('Invalid command payload');
  return { id, type: input.type, origin: ['gui', 'cli', 'mcp'].includes(input.origin) ? input.origin : 'gui',
    projectId: text(input.projectId, 'project ID', 160), worker: text(input.worker, 'worker', 160),
    instruction: text(input.instruction, 'instruction', 12000), model: text(input.model, 'model', 160),
    effort: text(input.effort, 'effort', 40), payload: JSON.parse(JSON.stringify(payload)) };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
  return value;
}
const commandHash = command => crypto.createHash('sha256').update(JSON.stringify(canonical(command))).digest('hex');
module.exports = { TYPES, TERMINAL, PHASES, STARTERS, VISUAL_CHECKS, RALLY_VISUAL_CHECKS, visualChecksFor, normalizeCommand, commandHash, text };
