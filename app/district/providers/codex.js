'use strict';
// District-owned Codex sessions. CLI transport only; native app-server control
// remains a separately qualified follow-up, not a transplanted dependency.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER = 'agent_bus_project';
const MCP_ENTRY = path.resolve(__dirname, '..', 'project-agent-mcp.js');
const TOOLS = ['project_list_files', 'project_read_file', 'project_write_file', 'report_activity'];
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const MAX_CONFIG_BYTES = 65536;
const MAX_EVENT_BYTES = 1000000;
function fileExists(file) { try { return fs.statSync(file).isFile(); } catch { return false; } }
function envValue(env, name) {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
  return key === undefined ? undefined : env[key];
}

function nativeInPackage(packageRoot) {
  const targets = {
    'win32:x64': ['win32-x64', 'x86_64-pc-windows-msvc'],
    'win32:arm64': ['win32-arm64', 'aarch64-pc-windows-msvc'],
    'linux:x64': ['linux-x64', 'x86_64-unknown-linux-musl'],
    'linux:arm64': ['linux-arm64', 'aarch64-unknown-linux-musl'],
    'darwin:x64': ['darwin-x64', 'x86_64-apple-darwin'],
    'darwin:arm64': ['darwin-arm64', 'aarch64-apple-darwin'],
  };
  const target = targets[`${process.platform}:${process.arch}`];
  if (!target) return null;
  const [suffix, triple] = target, name = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const vendors = [path.join(packageRoot, 'node_modules', '@openai', `codex-${suffix}`, 'vendor'),
    path.join(path.dirname(packageRoot), `codex-${suffix}`, 'vendor'), path.join(packageRoot, 'vendor')];
  return vendors.map((dir) => path.join(dir, triple, 'bin', name)).find(fileExists) || null;
}

function resolveCandidate(file, executable) {
  if (!fileExists(file)) return null;
  const ext = path.extname(file).toLowerCase();
  if (['.cmd', '.ps1', '.bat'].includes(ext)) {
    // Resolve a recognized npm layout; never pass a shell shim to cmd.exe.
    const packageRoot = path.join(path.dirname(file), 'node_modules', '@openai', 'codex');
    const entry = path.join(packageRoot, 'bin', 'codex.js');
    if (!fileExists(entry)) return null;
    const native = nativeInPackage(packageRoot);
    return native ? { command: native, prefix: [], node: false } : { command: executable, prefix: [entry], node: true };
  }
  let resolved = file;
  try { resolved = fs.realpathSync(file); } catch {}
  if (/\.(?:c?js|mjs)$/i.test(resolved)) {
    const native = nativeInPackage(path.dirname(path.dirname(resolved)));
    return native ? { command: native, prefix: [], node: false } : { command: executable, prefix: [resolved], node: true };
  }
  if (process.platform === 'win32' && !/\.(?:exe|com)$/i.test(resolved)) return null;
  return { command: resolved, prefix: [], node: false };
}

function findCli(env, executable) {
  const configured = envValue(env, 'AGENT_BUS_CODEX_CLI');
  if (configured) {
    if (typeof configured !== 'string' || !path.isAbsolute(configured)) throw new Error('AGENT_BUS_CODEX_CLI must name an absolute executable or recognized npm shim.');
    return resolveCandidate(configured, executable);
  }
  const home = envValue(env, 'USERPROFILE') || envValue(env, 'HOME') || os.homedir();
  const dirs = String(envValue(env, 'PATH') || '').split(path.delimiter).map((p) => p.replace(/^"|"$/g, '')).filter(Boolean);
  if (home) dirs.push(path.join(home, '.local', 'bin'));
  const appData = envValue(env, 'APPDATA'); if (appData) dirs.push(path.join(appData, 'npm'));
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex.ps1', 'codex'] : ['codex'];
  for (const dir of [...new Set(dirs)].slice(0, 256)) {
    if (!path.isAbsolute(dir)) continue;
    for (const name of names) {
      const cli = resolveCandidate(path.join(dir, name), executable);
      if (cli) return cli;
    }
  }
  return null;
}

function toml(value) {
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toml).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}=${toml(v)}`).join(',')}}`;
  throw new Error('Unsupported project MCP configuration value.');
}

function scopedConfig(configPath) {
  if (typeof configPath !== 'string' || !path.isAbsolute(configPath) || /[\0\r\n]/.test(configPath)) throw new Error('An absolute project MCP configuration path is required.');
  const info = fs.lstatSync(configPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_CONFIG_BYTES) throw new Error('Project MCP configuration must be a file under 64KB.');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const servers = config?.mcpServers;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers) || Object.keys(servers).length !== 1 || !Object.hasOwn(servers, SERVER)) throw new Error(`District sessions must expose only ${SERVER}.`);
  const server = servers[SERVER];
  if (!server || typeof server !== 'object' || Array.isArray(server) ||
      Object.keys(server).some((key) => !['command', 'args', 'env', 'type'].includes(key)) ||
      (server.type !== undefined && server.type !== 'stdio') ||
      typeof server.command !== 'string' || /[\0\r\n]/.test(server.command) || !path.isAbsolute(server.command) || /\.(?:cmd|bat|ps1)$/i.test(server.command) ||
      !Array.isArray(server.args) || server.args.length !== 3 || server.args.some((a) => typeof a !== 'string' || /[\0\r\n]/.test(a)) ||
      !path.isAbsolute(server.args[0]) || path.resolve(server.args[0]) !== MCP_ENTRY ||
      server.args[1] !== '--ticket' || !path.isAbsolute(server.args[2]) ||
      (server.env !== undefined && (!server.env || typeof server.env !== 'object' || Array.isArray(server.env) ||
        Object.entries(server.env).some(([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' || value !== '1')))) {
    throw new Error('Invalid scoped project MCP process configuration.');
  }
  return { command: server.command, args: server.args, env: { ...server.env, ELECTRON_RUN_AS_NODE: '1' } };
}

function createLaunch({ root, configPath, prompt, model, effort, executable = process.execPath, env = process.env } = {}) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || /[\0\r\n]/.test(executable)) throw new Error('An absolute JavaScript runtime executable is required.');
  if (typeof root !== 'string' || /[\0\r\n]/.test(root) || !path.isAbsolute(root) || !fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new Error('An existing absolute project root is required.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 65536 || prompt.includes('\0')) throw new Error('A project instruction under 64KB is required.');
  if (model !== undefined && (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/.test(model))) throw new Error('Invalid Codex model selection.');
  if (effort !== undefined && !EFFORTS.has(effort)) throw new Error('Invalid Codex reasoning effort.');
  const server = scopedConfig(configPath), cli = findCli(env, executable);
  if (!cli) throw new Error('Codex CLI is unavailable. Install Codex and sign in using its CLI.');
  const cleanEnv = { ...env };
  for (const key of Object.keys(cleanEnv)) {
    const upper = key.toUpperCase();
    if (upper.startsWith('CLAUDE') || ['ELECTRON_RUN_AS_NODE', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CODEX_RUN_ID',
      'CODEX_INTERNAL_ORIGINATOR_OVERRIDE', 'NODE_OPTIONS', 'NODE_PATH', 'AGENT_BUS_JOB_TICKET', 'AGENT_BUS_PROJECT_TICKET', 'AGENT_BUS_DISTRICT_TICKET'].includes(upper)) delete cleanEnv[key];
  }
  if (cli.node) cleanEnv.ELECTRON_RUN_AS_NODE = '1';
  const settings = {
    approval_policy: 'never', web_search: 'disabled',
    // These are feature flags in the installed CLI; tools.view_image is ignored.
    'features.view_image': false, 'features.shell_snapshot': false,
    'tools.update_plan.enabled': false, 'features.shell_tool': false, 'features.hooks': false,
    'features.multi_agent': false, 'features.plugins': false, 'features.apps': false,
    'features.browser_use': false, 'features.computer_use': false, 'features.image_generation': false,
    'features.code_mode': false, 'features.memories': false, 'features.goals': false,
    'features.skill_mcp_dependency_install': false, 'features.skill_search': false,
    'features.workspace_dependencies': false,
    mcp_servers: { [SERVER]: { ...server, enabled_tools: TOOLS,
      // Only these root-scoped file/activity tools are authorized by Run.
      tools: Object.fromEntries(TOOLS.map((name) => [name, { approval_mode: 'approve' }])),
      required: true, startup_timeout_sec: 20, tool_timeout_sec: 60 } },
  };
  if (effort !== undefined) settings.model_reasoning_effort = effort;
  const args = ['--no-daemon', 'exec', '--json', '--color', 'never', '--ephemeral', '--ignore-user-config',
    '--ignore-rules', '--skip-git-repo-check', '--sandbox', 'read-only', '--cd', root];
  if (model !== undefined) args.push('--model', model);
  for (const [key, value] of Object.entries(settings)) args.push('-c', `${key}=${toml(value)}`);
  args.push('-');
  return { command: cli.command, args: [...cli.prefix, ...args], env: cleanEnv, cwd: root, stdin: prompt };
}

function parseLine(line) {
  if (typeof line !== 'string') return null;
  if (Buffer.byteLength(line, 'utf8') > MAX_EVENT_BYTES) return { error: 'Codex emitted an oversized event.' };
  let event;
  try { event = JSON.parse(line); } catch { return null; }
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const publicText = (value) => typeof value === 'string' ? value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 4000) : '';
  const errorText = (value) => publicText(typeof value === 'string' ? value : value?.message);
  const result = {};
  if (event.type === 'thread.started' && typeof event.thread_id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(event.thread_id)) result.sessionId = event.thread_id;
  if (event.type === 'turn.started') result.detail = 'Codex turn started.';
  if (event.type === 'turn.completed') result.detail = 'Codex turn completed; project checks are separate.';
  const itemEvent = ['item.started', 'item.updated', 'item.completed'].includes(event.type);
  const item = itemEvent && event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? event.item : null;
  if (item?.type === 'agent_message' && typeof item.text === 'string') result.detail = publicText(item.text);
  if (item?.type === 'mcp_tool_call') {
    if (item.server !== SERVER || !TOOLS.includes(item.tool)) {
      return { error: 'Codex emitted an unscoped MCP operation. This assignment permits only the four project tools.' };
    }
    const failed = item.status === 'failed' || item.result?.isError === true || item.result?.is_error === true;
    const toolError = errorText(item.error);
    if (failed || toolError) {
      // The CLI can report status=failed with error=null and an error result body.
      // Successful result/argument bodies never become public progress text.
      const diagnostic = failed && Array.isArray(item.result?.content)
        ? item.result.content.slice(0, 16).filter((block) => block?.type === 'text').map((block) => publicText(block.text)).filter(Boolean).join('\n') : '';
      result.detail = `Agent failed ${item.tool}`;
      result.error = toolError || publicText(diagnostic) || `Codex reported that ${item.tool} failed.`;
    } else {
      result.detail = `Agent ${event.type === 'item.completed' ? 'completed' : event.type === 'item.updated' ? 'is running' : 'called'} ${item.tool}`;
    }
  }
  if (item && ['command_execution', 'file_change', 'web_search', 'collab_tool_call'].includes(item.type)) {
    return { error: `Codex emitted an unscoped ${item.type} operation. This assignment permits only the four project tools.` };
  }
  if (event.type === 'error' || event.type === 'turn.failed') {
    result.error = errorText(event.error) || publicText(event.message) || 'Codex session failed.';
  }
  // codex exec distinguishes nonfatal error items from fatal error/turn.failed.
  // Preserve diagnostic/reconnect text without poisoning an otherwise valid turn.
  if (item?.type === 'error') result.detail = publicText(item.message) || errorText(item.error) || 'Codex reported a nonterminal diagnostic.';
  return Object.keys(result).length ? result : null;
}

module.exports = { createLaunch, parseLine };
