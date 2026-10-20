'use strict';
// Dedicated, disposable CLI sessions for the Test building. Never resumes or
// sends input to an owner's existing conversation. No shell command strings.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const VENDORS = {
  claude: { id: '@claude-worker', name: 'Claude test agent', package: '@anthropic-ai/claude-code', entry: 'cli.js' },
  codex: { id: '@codex-worker', name: 'Codex test agent', package: '@openai/codex', entry: 'bin/codex.js' },
};
const TOOLS = ['run_smoke', 'report_progress'];
const CLAUDE_AUTH_ENV = new Set(['CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN_FILE',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']);
function existingFile(file) { try { return fs.statSync(file).isFile(); } catch { return false; } }
function envValue(env, name) {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
  return key ? env[key] : undefined;
}

function codexNative(packageRoot, platform, arch) {
  const targets = { 'win32:x64': ['win32-x64', 'x86_64-pc-windows-msvc'],
    'win32:arm64': ['win32-arm64', 'aarch64-pc-windows-msvc'],
    'linux:x64': ['linux-x64', 'x86_64-unknown-linux-musl'],
    'linux:arm64': ['linux-arm64', 'aarch64-unknown-linux-musl'],
    'darwin:x64': ['darwin-x64', 'x86_64-apple-darwin'],
    'darwin:arm64': ['darwin-arm64', 'aarch64-apple-darwin'] };
  const target = targets[`${platform}:${arch}`];
  if (!target) return null;
  const [suffix, triple] = target, binary = platform === 'win32' ? 'codex.exe' : 'codex';
  const vendors = [path.join(packageRoot, 'node_modules', '@openai', `codex-${suffix}`, 'vendor'),
    path.join(path.dirname(packageRoot), `codex-${suffix}`, 'vendor'), path.join(packageRoot, 'vendor')];
  return vendors.map((dir) => path.join(dir, triple, 'bin', binary)).find(existingFile) || null;
}

function resolveCandidate(file, vendor, { platform, arch, executable }) {
  if (!existingFile(file)) return null;
  const ext = path.extname(file).toLowerCase();
  if (ext === '.cmd' || ext === '.ps1' || ext === '.bat') {
    // Resolve only known npm package layouts, never execute a shim in cmd.exe.
    const meta = VENDORS[vendor];
    const packageRoot = path.join(path.dirname(file), 'node_modules', ...meta.package.split('/'));
    const entry = path.join(packageRoot, meta.entry);
    if (!existingFile(entry)) return null;
    if (vendor === 'codex') {
      const native = codexNative(packageRoot, platform, arch);
      if (native) return { command: native, prefix: [], node: false };
    }
    return { command: executable, prefix: [entry], node: true };
  }
  let resolved = file;
  try { resolved = fs.realpathSync(file); } catch {}
  if (/\.(?:c?js|mjs)$/i.test(resolved)) {
    if (vendor === 'codex') {
      const native = codexNative(path.dirname(path.dirname(resolved)), platform, arch);
      if (native) return { command: native, prefix: [], node: false };
    }
    return { command: executable, prefix: [resolved], node: true };
  }
  if (platform === 'win32' && !/\.(?:exe|com)$/i.test(resolved)) return null;
  return { command: resolved, prefix: [], node: false };
}

function findCli(vendor, options = {}) {
  const env = options.env || process.env, platform = options.platform || process.platform;
  const arch = options.arch || process.arch, executable = options.executable || process.execPath;
  const configured = envValue(env, `AGENT_BUS_${vendor.toUpperCase()}_CLI`);
  const settings = { platform, arch, executable };
  if (configured) return resolveCandidate(path.resolve(configured), vendor, settings);
  const home = envValue(env, 'USERPROFILE') || envValue(env, 'HOME') || os.homedir();
  const dirs = String(envValue(env, 'PATH') || '').split(platform === 'win32' ? ';' : ':')
    .map((dir) => dir.replace(/^"|"$/g, '')).filter(Boolean);
  if (home) dirs.push(path.join(home, '.local', 'bin'));
  const appData = envValue(env, 'APPDATA');
  if (appData) dirs.push(path.join(appData, 'npm'));
  const names = platform === 'win32' ? [`${vendor}.exe`, `${vendor}.cmd`, `${vendor}.ps1`, vendor] : [vendor];
  // No recursive filesystem search or subprocess probes on the UI polling path.
  for (const dir of [...new Set(dirs)].slice(0, 256)) {
    if (!path.isAbsolute(dir)) continue;
    for (const name of names) {
      const found = resolveCandidate(path.join(dir, name), vendor, settings);
      if (found) return found;
    }
  }
  return null;
}

function discoverAgents(options = {}) {
  return Object.entries(VENDORS).map(([vendor, meta]) => {
    const launch = findCli(vendor, options);
    return { id: meta.id, vendor, name: meta.name, available: !!launch,
      detail: launch ? 'Installed CLI; starts a dedicated Test session using its login. Authentication is checked on assignment.' :
        `Install ${vendor === 'claude' ? 'Claude Code' : 'Codex CLI'} and sign in, then refresh.` };
  });
}

function processEnv(source, node) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if ((upper.startsWith('CLAUDE') && !CLAUDE_AUTH_ENV.has(upper)) ||
        ['ELECTRON_RUN_AS_NODE', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CODEX_RUN_ID', 'AGENT_BUS_JOB_TICKET'].includes(upper)) delete env[key];
  }
  // Harmless for node.exe; also supports renamed packaged Electron binaries.
  if (node) env.ELECTRON_RUN_AS_NODE = '1';
  return env;
}

// JSON basic strings use the same escaping needed by the TOML values below.
function toml(value) {
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toml).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}=${toml(v)}`).join(',')}}`;
  throw new Error('Unsupported MCP configuration value.');
}
function readMcpConfig(configPath) {
  if (!configPath || fs.statSync(configPath).size > 65536) throw new Error('A bounded job-scoped MCP configuration is required.');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const servers = config?.mcpServers;
  if (!servers || Object.keys(servers).length !== 1 || !servers.agent_bus_test) throw new Error('Test sessions must expose only agent_bus_test.');
  const server = servers.agent_bus_test;
  if (typeof server.command !== 'string' || !server.command || !Array.isArray(server.args) ||
      server.args.some((s) => typeof s !== 'string') ||
      (server.env && (typeof server.env !== 'object' || Array.isArray(server.env) || Object.values(server.env).some((s) => typeof s !== 'string')))) {
    throw new Error('Invalid job-scoped MCP process configuration.');
  }
  return { command: server.command, args: server.args, env: { ...server.env, ELECTRON_RUN_AS_NODE: '1' } };
}

function createAgentLaunch({ vendor, root, executable = process.execPath, configPath, prompt, env = process.env,
  platform = process.platform, arch = process.arch } = {}) {
  if (!VENDORS[vendor]) throw new Error('Choose a Claude or Codex test agent.');
  if (!root || !path.isAbsolute(root)) throw new Error('An absolute project root is required.');
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('A Test assignment prompt is required.');
  const server = readMcpConfig(configPath);
  const cli = findCli(vendor, { env, platform, arch, executable });
  if (!cli) throw new Error(`${VENDORS[vendor].name} CLI is unavailable. Install and sign in first.`);
  const cleanEnv = processEnv(env, cli.node);
  let args;
  if (vendor === 'claude') {
    args = ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
      '--restricted', '--strict-mcp-config', '--mcp-config', configPath, '--tools', '',
      '--allowedTools', ...TOOLS.map((tool) => `mcp__agent_bus_test__${tool}`), '--permission-prompts', 'none'];
  } else {
    const settings = { approval_policy: 'never', web_search: 'disabled',
      'features.shell_tool': false, 'features.hooks': false, 'features.multi_agent': false,
      'features.plugins': false, 'features.apps': false, 'features.browser_use': false,
      'features.computer_use': false, 'features.image_generation': false,
      'features.code_mode': false, 'features.memories': false, 'features.skill_mcp_dependency_install': false,
      mcp_servers: { agent_bus_test: { ...server, enabled_tools: TOOLS,
        // The drag authorizes only these fixed job tools. Other operations
        // retain approval_policy=never and cannot obtain broader approval.
        tools: { run_smoke: { approval_mode: 'approve' }, report_progress: { approval_mode: 'approve' } },
        required: true, startup_timeout_sec: 20, tool_timeout_sec: 180 } } };
    args = ['exec', '--json', '--color', 'never', '--ephemeral', '--ignore-user-config', '--ignore-rules',
      '--sandbox', 'read-only', '--cd', root];
    for (const [key, value] of Object.entries(settings)) args.push('-c', `${key}=${toml(value)}`);
    args.push('-');
  }
  return { command: cli.command, args: [...cli.prefix, ...args], env: cleanEnv, cwd: root };
}

function launchAgent(options) {
  const launch = createAgentLaunch(options);
  const child = spawn(launch.command, launch.args, { cwd: launch.cwd, env: launch.env,
    windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  // Errors are emitted on the returned ChildProcess. Avoid an unhandled EPIPE
  // when a CLI refuses its configuration before reading the assignment.
  child.stdin.on('error', () => {});
  child.stdin.end(options.prompt);
  return child;
}

function parseAgentEvent(vendor, line) {
  let event;
  try { event = JSON.parse(line); } catch { return null; }
  if (!event || typeof event !== 'object') return null;
  const result = {}, clipped = (value) => typeof value === 'string' ? value.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 2000) : '';
  if (vendor === 'claude') {
    if (typeof event.session_id === 'string') result.sessionId = event.session_id.slice(0, 160);
    if (event.type === 'assistant') {
      const content = Array.isArray(event.message?.content) ? event.message.content : [];
      const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      const tool = content.find((c) => c.type === 'tool_use' && /^mcp__agent_bus_test__(run_smoke|report_progress)$/.test(c.name));
      if (text) result.detail = clipped(text);
      else if (tool) result.detail = `Agent called ${tool.name.replace('mcp__agent_bus_test__', '')}`;
    }
    if (event.type === 'result') {
      if (event.is_error || (typeof event.subtype === 'string' && event.subtype.startsWith('error'))) {
        result.error = clipped(event.result || event.errors?.join('\n') || 'Claude session failed.');
      } else if (typeof event.result === 'string') result.detail = clipped(event.result);
    }
    if (event.type === 'error') result.error = clipped(event.error?.message || event.message || 'Claude session failed.');
  } else if (vendor === 'codex') {
    if (event.type === 'thread.started' && typeof event.thread_id === 'string') result.sessionId = event.thread_id.slice(0, 160);
    if (event.item?.type === 'agent_message' && typeof event.item.text === 'string') result.detail = clipped(event.item.text);
    if (event.item?.type === 'mcp_tool_call' && event.item.server === 'agent_bus_test' && TOOLS.includes(event.item.tool)) {
      result.detail = `Agent ${event.type === 'item.completed' ? 'completed' : 'called'} ${event.item.tool}`;
    }
    if (event.type === 'error' || event.type === 'turn.failed') result.error = clipped(event.error?.message || event.message || 'Codex session failed.');
  }
  return Object.keys(result).length ? result : null;
}

module.exports = { discoverAgents, createAgentLaunch, launchAgent, parseAgentEvent };
