'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TOOLS = Object.freeze(['project_list_files', 'project_read_file', 'project_write_file', 'report_activity']);
const SERVER = 'agent_bus_project';
const MCP_ENTRY = path.resolve(__dirname, '..', 'project-agent-mcp.js');
const AUTH_ENV = new Set(['CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN_FILE',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function envValue(env, name) {
  const key = Object.keys(env).find((key) => key.toUpperCase() === name.toUpperCase());
  return key ? env[key] : undefined;
}

function existingFile(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

function resolveCandidate(file, { platform, executable }) {
  if (!path.isAbsolute(file) || !existingFile(file)) return null;
  const extension = path.extname(file).toLowerCase();
  if (['.cmd', '.bat', '.ps1'].includes(extension)) {
    // Only known package entries are usable; a shim is never sent to a shell.
    const packageRoot = path.join(path.dirname(file), 'node_modules', '@anthropic-ai', 'claude-code');
    const native = path.join(packageRoot, 'bin', 'claude.exe');
    if (platform === 'win32' && existingFile(native)) return { command: native, prefix: [], node: false };
    const entry = path.join(packageRoot, 'cli.js');
    return existingFile(entry) ? { command: executable, prefix: [entry], node: true } : null;
  }
  let resolved = file;
  try { resolved = fs.realpathSync(file); } catch {}
  if (/\.(?:c?js|mjs)$/i.test(resolved)) return { command: executable, prefix: [resolved], node: true };
  if (platform === 'win32' && !/\.(?:exe|com)$/i.test(resolved)) return null;
  return { command: resolved, prefix: [], node: false };
}

function findCli({ env = process.env, executable = process.execPath, platform = process.platform } = {}) {
  const configured = envValue(env, 'AGENT_BUS_CLAUDE_CLI');
  if (configured) return path.isAbsolute(configured) ? resolveCandidate(configured, { platform, executable }) : null;
  const home = envValue(env, 'USERPROFILE') || envValue(env, 'HOME') || os.homedir();
  const dirs = String(envValue(env, 'PATH') || '').split(platform === 'win32' ? ';' : ':')
    .map((dir) => dir.replace(/^"|"$/g, '')).filter(Boolean);
  if (home) dirs.push(path.join(home, '.local', 'bin'));
  const appData = envValue(env, 'APPDATA');
  if (appData) dirs.push(path.join(appData, 'npm'));
  const names = platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.ps1', 'claude'] : ['claude'];
  for (const dir of [...new Set(dirs)].slice(0, 256)) {
    if (!path.isAbsolute(dir)) continue;
    for (const name of names) {
      const found = resolveCandidate(path.join(dir, name), { platform, executable });
      if (found) return found;
    }
  }
  return null;
}

function discover(options = {}) {
  const available = !!findCli(options);
  return { available, detail: available
    ? 'Claude Code CLI found. Sign-in and quota are checked when an assignment starts.'
    : 'Install Claude Code CLI and sign in on this machine, then refresh.' };
}

function validateConfig(configPath, executable) {
  if (typeof configPath !== 'string' || !path.isAbsolute(configPath)) {
    throw new Error('An absolute project-scoped MCP configuration is required.');
  }
  const stat = fs.statSync(configPath);
  if (!stat.isFile() || stat.size > 65536) throw new Error('A bounded project-scoped MCP configuration is required.');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const servers = config?.mcpServers;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers) ||
      Object.keys(servers).length !== 1 || !Object.hasOwn(servers, SERVER)) {
    throw new Error('Project sessions must expose only agent_bus_project.');
  }
  const server = servers[SERVER];
  if (!server || typeof server !== 'object' || Array.isArray(server) ||
      Object.keys(server).some((key) => !['command', 'args', 'env', 'type'].includes(key)) ||
      (server.type !== undefined && server.type !== 'stdio') ||
      typeof server.command !== 'string' || !path.isAbsolute(server.command) || /[\0\r\n]/.test(server.command) ||
      /\.(?:cmd|bat|ps1)$/i.test(server.command) || path.resolve(server.command) !== path.resolve(executable) ||
      !Array.isArray(server.args) || server.args.length !== 3 ||
      server.args.some((arg) => typeof arg !== 'string' || /[\0\r\n]/.test(arg)) ||
      !path.isAbsolute(server.args[0]) || path.resolve(server.args[0]) !== MCP_ENTRY ||
      server.args[1] !== '--ticket' || !path.isAbsolute(server.args[2]) ||
      (server.env !== undefined && (!server.env || typeof server.env !== 'object' || Array.isArray(server.env) ||
        Object.entries(server.env).some(([key, value]) => !key || /[=\0\r\n]/.test(key) || typeof value !== 'string' || /\0/.test(value))))) {
    throw new Error('Invalid project-scoped MCP process configuration.');
  }
}

function selection(value, name) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Claude ${name} must be a string.`);
  if (/[\0\r\n]/.test(value)) throw new Error(`Claude ${name} cannot contain control characters.`);
  const normalized = value.trim();
  if (name === 'effort') {
    if (!EFFORTS.has(normalized)) throw new Error('Claude effort must be low, medium, high, xhigh, or max.');
  } else if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\[\]-]{0,159}$/.test(normalized)) {
    throw new Error('Claude model must be one bounded model identifier.');
  }
  return normalized;
}

function cleanEnvironment(source, node) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if ((upper.startsWith('CLAUDE') && !AUTH_ENV.has(upper)) ||
        ['ELECTRON_RUN_AS_NODE', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CODEX_RUN_ID',
          'AGENT_BUS_JOB_TICKET', 'AGENT_BUS_PROJECT_TICKET', 'AGENT_BUS_DISTRICT_TICKET'].includes(upper)) delete env[key];
  }
  if (node) env.ELECTRON_RUN_AS_NODE = '1';
  return env;
}

function createLaunch({ root, configPath, prompt, model, effort, executable = process.execPath,
  env = process.env, platform = process.platform } = {}) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || /[\0\r\n]/.test(executable)) {
    throw new Error('An absolute JavaScript runtime executable is required.');
  }
  if (typeof root !== 'string' || !path.isAbsolute(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('An existing absolute project root is required.');
  }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 65536 || prompt.includes('\0')) {
    throw new Error('A bounded project assignment prompt is required.');
  }
  const selectedModel = selection(model, 'model'), selectedEffort = selection(effort, 'effort');
  validateConfig(configPath, executable);
  const cli = findCli({ env, executable, platform });
  if (!cli) throw new Error('Claude Code CLI is unavailable. Install it and sign in first.');
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence',
    '--restricted', '--strict-mcp-config', '--mcp-config', configPath, '--tools', '',
    '--allowedTools', ...TOOLS.map((tool) => `mcp__${SERVER}__${tool}`),
    '--permission-prompts', 'none', '--disable-slash-commands', '--no-chrome'];
  if (selectedModel) args.push('--model', selectedModel);
  if (selectedEffort) args.push('--effort', selectedEffort);
  return { command: cli.command, args: [...cli.prefix, ...args], env: cleanEnvironment(env, cli.node), cwd: root, stdin: prompt };
}

function clipped(value, max = 4000) {
  return typeof value === 'string' ? value.replace(/\x1b\[[0-9;]*m/g, '').replace(/\0/g, '').slice(0, max) : '';
}

function errorText(value) {
  if (typeof value === 'string') return clipped(value);
  return value && typeof value === 'object' ? clipped(value.message) : '';
}

function scopedTool(name) {
  return TOOLS.find((tool) => name === `mcp__${SERVER}__${tool}`) || null;
}

function permissionFailure(denials) {
  const names = [...new Set(denials.map((denial) => scopedTool(denial?.tool_name) || 'an unapproved tool'))];
  return `Claude denied permission for ${names.slice(0, 4).join(', ')}.`;
}

function resultFailure(event) {
  if ((event.is_error !== undefined && typeof event.is_error !== 'boolean') ||
      (event.permission_denials !== undefined && !Array.isArray(event.permission_denials)) ||
      (event.errors !== undefined && !Array.isArray(event.errors)) ||
      (event.api_error_status != null && !Number.isFinite(event.api_error_status))) {
    return 'Claude returned malformed terminal outcome fields.';
  }
  const denials = Array.isArray(event.permission_denials) ? event.permission_denials : [];
  if (denials.length) return permissionFailure(denials);
  const errors = Array.isArray(event.errors) ? clipped(event.errors.map(errorText).filter(Boolean).join('\n')) : '';
  if (errors) return errors;
  if (Number.isFinite(event.api_error_status) && event.api_error_status >= 400) {
    const message = errorText(event.error) || clipped(event.result);
    return `Claude API failed (HTTP ${event.api_error_status}).${message ? ` ${message}` : ''}`;
  }
  if (event.terminal_reason != null && event.terminal_reason !== 'completed') {
    return `Claude stopped before completion (${clipped(event.terminal_reason, 80) || 'unrecognized terminal reason'}).`;
  }
  if (event.stop_reason != null && !['end_turn', 'stop_sequence'].includes(event.stop_reason)) {
    return `Claude stopped before completion (${clipped(event.stop_reason, 80) || 'unrecognized stop reason'}).`;
  }
  if (event.is_error === true || event.error || (typeof event.subtype === 'string' && event.subtype.startsWith('error'))) {
    return errorText(event.error) || clipped(event.result) || 'Claude session failed.';
  }
  if (event.subtype !== undefined && event.subtype !== 'success') {
    return `Claude returned an unrecognized terminal subtype (${clipped(event.subtype, 80) || 'invalid'}).`;
  }
  return null;
}

function parseLine(line) {
  if (typeof line !== 'string') return null;
  if (line.length > 1048576) return { error: 'Claude emitted an oversized event.' };
  let event;
  try { event = JSON.parse(line); } catch { return null; }
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const result = {};
  if (typeof event.session_id === 'string' && event.session_id.trim()) result.sessionId = clipped(event.session_id, 160);
  if (event.type === 'assistant') {
    const content = Array.isArray(event.message?.content) ? event.message.content : [];
    const text = clipped(content.filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text).join('\n'));
    const tools = [...new Set(content.filter((block) => block?.type === 'tool_use')
      .map((block) => scopedTool(block.name)).filter(Boolean))];
    if (text) result.detail = text;
    else if (tools.length) result.detail = `Agent called ${tools.join(', ')}`;
    if (event.error || event.message?.error) result.error = text || errorText(event.error) || errorText(event.message?.error) || 'Claude reported an assistant error.';
  }
  if (event.type === 'stream_event' && event.event?.type === 'content_block_start') {
    // Completed assistant blocks carry the public text once. Partial text,
    // thinking and tool-input deltas stay out of this status-only interface.
    const block = event.event.content_block;
    if (block?.type === 'text') result.detail = 'Claude started generating a response.';
    const tool = block?.type === 'tool_use' && scopedTool(block.name);
    if (tool) result.detail = `Agent is preparing ${tool}.`;
  }
  if (event.type === 'tool_progress') {
    const tool = scopedTool(event.tool_name);
    const elapsed = Number.isFinite(event.elapsed_time_seconds) && event.elapsed_time_seconds >= 0
      ? ` (${Number(event.elapsed_time_seconds.toFixed(1))}s)` : '';
    if (tool) result.detail = `Agent reports ${tool} is running${elapsed}.`;
  }
  if (event.type === 'user') {
    const content = Array.isArray(event.message?.content) ? event.message.content : [];
    const results = content.filter((block) => block?.type === 'tool_result');
    if (results.length) result.detail = results.some((block) => block.is_error === true)
      ? 'Agent received a tool error; no edit or check is confirmed.' : 'Agent received a tool result.';
  }
  if (event.type === 'result') {
    const failure = resultFailure(event);
    if (failure) result.error = failure;
    else if (typeof event.result === 'string') result.detail = clipped(event.result);
  }
  if (event.type === 'auth_status' && event.error) result.error = errorText(event.error) || 'Claude authentication failed.';
  if (event.type === 'error') result.error = errorText(event.error) || clipped(event.message) || 'Claude session failed.';
  if (event.type === 'system' && event.subtype === 'permission_denied') result.error = permissionFailure([event]);
  if (event.type === 'system' && event.subtype === 'init') {
    if (Array.isArray(event.tools) && event.tools.some((tool) => !scopedTool(tool))) {
      result.error = 'Claude exposed an unapproved tool outside the project scope.';
    }
    if (Array.isArray(event.mcp_servers)) {
      if (event.mcp_servers.some((server) => server?.name !== SERVER)) result.error = 'Claude exposed an MCP server outside the project scope.';
      else if (event.mcp_servers.some((server) => ['failed', 'error', 'needs-auth'].includes(server.status))) {
        result.error = 'Claude could not connect to the scoped project MCP server.';
      }
    }
  }
  if (event.type === 'rate_limit_event' && event.rate_limit_info && typeof event.rate_limit_info === 'object') {
    const info = event.rate_limit_info;
    const overage = ['allowed', 'allowed_warning'].includes(info.overageStatus) || info.isUsingOverage === true || info.overageInUse === true;
    if (info.status === 'rejected' && !overage) {
      const type = clipped(info.rateLimitType, 80);
      const reset = Number.isFinite(info.resetsAt) && info.resetsAt > 0 && info.resetsAt < 8640000000000
        ? new Date(info.resetsAt * 1000).toISOString() : null;
      result.error = `Claude reported a usage limit${type ? ` (${type})` : ''}.${reset ? ` Resets at ${reset}.` : ''}`;
    }
  }
  if (event.type === 'system' && event.subtype === 'api_retry') {
    const attempt = Number.isSafeInteger(event.attempt) && event.attempt > 0 ? event.attempt : null;
    const max = Number.isSafeInteger(event.max_retries) && event.max_retries > 0 ? event.max_retries : null;
    result.detail = `Claude provider is retrying${attempt ? ` (attempt ${attempt}${max ? ` of ${max}` : ''})` : ''}.`;
  }
  return Object.keys(result).length ? result : null;
}

module.exports = { createLaunch, parseLine, discover };
