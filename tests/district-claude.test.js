'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createLaunch, parseLine, discover } = require('../app/district/providers/claude');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'district-claude-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'project'); fs.mkdirSync(root);
  const cli = path.join(temp, 'fixture-cli.cjs'); fs.writeFileSync(cli, '');
  const server = { command: process.execPath,
    args: [path.resolve(__dirname, '../app/district/project-agent-mcp.js'), '--ticket', path.join(temp, 'ticket.json')],
    env: { ELECTRON_RUN_AS_NODE: '1' } };
  const configPath = path.join(temp, 'mcp.json');
  const writeConfig = (config) => fs.writeFileSync(configPath, JSON.stringify(config));
  writeConfig({ mcpServers: { agent_bus_project: server } });
  return { temp, root, cli, configPath, server, writeConfig, prompt: 'Make the checklist keyboard friendly.',
    env: { PATH: '', AGENT_BUS_CLAUDE_CLI: cli }, executable: process.execPath };
}

test('Claude project launch uses only its four MCP tools and an explicit model/effort', (t) => {
  const f = fixture(t), launch = createLaunch({ ...f, model: 'claude-sonnet-5-5', effort: 'xhigh' });
  assert.equal(launch.command, process.execPath); assert.equal(launch.args[0], f.cli);
  assert.equal(launch.cwd, f.root); assert.equal(launch.stdin, f.prompt);
  assert.equal(launch.args[launch.args.indexOf('--model') + 1], 'claude-sonnet-5-5');
  assert.equal(launch.args[launch.args.indexOf('--effort') + 1], 'xhigh');
  assert.equal(launch.args[launch.args.indexOf('--mcp-config') + 1], f.configPath);
  assert.equal(launch.args[launch.args.indexOf('--tools') + 1], '');
  assert.deepEqual(launch.args.slice(launch.args.indexOf('--allowedTools') + 1, launch.args.indexOf('--permission-prompts')),
    ['project_list_files', 'project_read_file', 'project_write_file', 'report_activity'].map((name) => `mcp__agent_bus_project__${name}`));
  assert.equal(launch.args[launch.args.indexOf('--permission-prompts') + 1], 'none');
  for (const flag of ['--restricted', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands', '--no-chrome']) {
    assert(launch.args.includes(flag), flag);
  }
  assert(!launch.args.some((arg) => /resume|continue|bypass|dangerously|fallback-model/.test(arg)));
  assert(!launch.args.includes(f.prompt));
});

test('optional selection stays omitted and invalid model/effort cannot become flags', (t) => {
  const f = fixture(t), launch = createLaunch({ ...f, model: '', effort: null });
  assert(!launch.args.includes('--model')); assert(!launch.args.includes('--effort'));
  for (const model of ['--dangerously-skip-permissions', 'sonnet --resume other', 'sonnet\n', 'a'.repeat(161), {}, 4]) {
    assert.throws(() => createLaunch({ ...f, model }), /model/);
  }
  for (const effort of ['ultra', '--resume', 'HIGH', {}, 4]) assert.throws(() => createLaunch({ ...f, effort }), /effort/);
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) {
    assert.equal(createLaunch({ ...f, effort }).args.at(-1), effort);
  }
});

test('only the owned MCP entry and bounded stdio configuration can be exposed', (t) => {
  const f = fixture(t);
  const bad = [
    { mcpServers: { agent_bus_project: f.server, extra: f.server } },
    { mcpServers: { other: f.server } },
    { mcpServers: { agent_bus_project: { ...f.server, url: 'https://example.test' } } },
    { mcpServers: { agent_bus_project: { ...f.server, type: 'http' } } },
    { mcpServers: { agent_bus_project: { ...f.server, args: [f.cli, '--ticket', f.server.args[2]] } } },
    { mcpServers: { agent_bus_project: { ...f.server, args: [...f.server.args, '--extra'] } } },
    { mcpServers: { agent_bus_project: { ...f.server, args: [f.server.args[0], '--ticket', 'relative.json'] } } },
    { mcpServers: { agent_bus_project: { ...f.server, command: 'node' } } },
    { mcpServers: { agent_bus_project: { ...f.server, env: { INVALID: 1 } } } },
  ];
  for (const config of bad) {
    f.writeConfig(config);
    assert.throws(() => createLaunch(f), /only agent_bus_project|Invalid project-scoped/);
  }
  fs.writeFileSync(f.configPath, ' '.repeat(65537)); assert.throws(() => createLaunch(f), /bounded/);
});

test('discovery checks installation only and relative or arbitrary launcher overrides fail closed', (t) => {
  const f = fixture(t);
  assert.deepEqual(discover({ env: f.env }), { available: true,
    detail: 'Claude Code CLI found. Sign-in and quota are checked when an assignment starts.' });
  assert.equal(discover({ env: { PATH: '', HOME: f.temp, USERPROFILE: f.temp, AGENT_BUS_CLAUDE_CLI: 'relative.js' } }).available, false);
  const shim = path.join(f.temp, 'claude.cmd'); fs.writeFileSync(shim, '@echo bad');
  assert.throws(() => createLaunch({ ...f, platform: 'win32', env: { ...f.env, AGENT_BUS_CLAUDE_CLI: shim } }), /unavailable/);
});

test('Windows known npm layouts resolve native executable first then the script without a shell', (t) => {
  const f = fixture(t), shim = path.join(f.temp, 'claude.cmd'); fs.writeFileSync(shim, '@echo bad');
  const packageRoot = path.join(f.temp, 'node_modules', '@anthropic-ai', 'claude-code');
  fs.mkdirSync(path.join(packageRoot, 'bin'), { recursive: true });
  const entry = path.join(packageRoot, 'cli.js'), native = path.join(packageRoot, 'bin', 'claude.exe');
  fs.writeFileSync(entry, ''); fs.writeFileSync(native, '');
  const options = { ...f, platform: 'win32', env: { ...f.env, AGENT_BUS_CLAUDE_CLI: shim } };
  const n = createLaunch(options); assert.equal(n.command, native); assert.equal(n.args[0], '-p');
  assert.equal(n.env.ELECTRON_RUN_AS_NODE, undefined);
  fs.unlinkSync(native);
  const js = createLaunch(options); assert.equal(js.command, process.execPath); assert.equal(js.args[0], entry);
  assert.equal(js.env.ELECTRON_RUN_AS_NODE, '1');
});

test('owned launch clears inherited session state while keeping login credentials and source environment unchanged', (t) => {
  const f = fixture(t), env = { ...f.env, CLAUDE_CODE_SESSION_ID: 'owner-session', CLAUDE_CONFIG_DIR: 'owner-customization',
    CLAUDE_CODE_OAUTH_TOKEN: 'fixture-login', ANTHROPIC_API_KEY: 'fixture-api-key', CODEX_THREAD_ID: 'owner-codex',
    AGENT_BUS_JOB_TICKET: 'old-ticket', ELECTRON_RUN_AS_NODE: 'bad' };
  const launch = createLaunch({ ...f, env });
  for (const key of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CONFIG_DIR', 'CODEX_THREAD_ID', 'AGENT_BUS_JOB_TICKET']) assert.equal(launch.env[key], undefined);
  assert.equal(launch.env.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-login'); assert.equal(launch.env.ANTHROPIC_API_KEY, 'fixture-api-key');
  assert.equal(launch.env.ELECTRON_RUN_AS_NODE, '1'); assert.equal(env.CLAUDE_CODE_SESSION_ID, 'owner-session');
});

test('launch contract feeds the prompt through stdin and exact args to an owned fake CLI', (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.cli, "const fs=require('node:fs');process.stdout.write(JSON.stringify({argv:process.argv.slice(2),input:fs.readFileSync(0,'utf8'),cwd:process.cwd()}));");
  const launch = createLaunch({ ...f, model: 'sonnet', effort: 'high' });
  const result = spawnSync(launch.command, launch.args, { input: launch.stdin, env: launch.env, cwd: launch.cwd,
    shell: false, windowsHide: true, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  const seen = JSON.parse(result.stdout); assert.equal(seen.input, f.prompt); assert.equal(seen.cwd, f.root);
  assert.equal(seen.argv[seen.argv.indexOf('--model') + 1], 'sonnet');
  assert.equal(seen.argv[seen.argv.indexOf('--mcp-config') + 1], f.configPath);
});

const parse = (event) => parseLine(JSON.stringify(event));
test('parsing exposes public activity/session identity without private reasoning or tool inputs', () => {
  assert.deepEqual(parse({ type: 'system', subtype: 'init', session_id: 'owned-session' }), { sessionId: 'owned-session' });
  assert.equal(parse({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'private' }] } }), null);
  assert.deepEqual(parse({ type: 'assistant', session_id: 'owned', message: { content: [
    { type: 'thinking', thinking: 'private' }, { type: 'text', text: 'Changing the heading.' }] } }),
  { sessionId: 'owned', detail: 'Changing the heading.' });
  assert.deepEqual(parse({ type: 'assistant', message: { content: [{ type: 'tool_use',
    name: 'mcp__agent_bus_project__project_write_file', input: { secret: 'hidden' } }] } }), { detail: 'Agent called project_write_file' });
  assert.equal(parse({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'hidden' } }] } }), null);
  assert.equal(parseLine('not json'), null); assert.equal(parseLine('[]'), null); assert.match(parseLine('a'.repeat(1048577)).error, /oversized/);
});

test('real result, assistant, login and quota diagnostics override apparent success', () => {
  assert.deepEqual(parse({ type: 'result', subtype: 'success', result: 'Done.' }), { detail: 'Done.' });
  assert.deepEqual(parse({ type: 'result', subtype: 'error_during_execution', errors: ['Login required'], session_id: 'failed' }),
    { sessionId: 'failed', error: 'Login required' });
  assert.deepEqual(parse({ type: 'result', subtype: 'success', is_error: true, result: 'Session limit reached' }), { error: 'Session limit reached' });
  assert.deepEqual(parse({ type: 'result', subtype: 'success', api_error_status: 403, result: 'Permission denied' }), { error: 'Claude API failed (HTTP 403). Permission denied' });
  assert.deepEqual(parse({ type: 'assistant', error: 'authentication_failed', message: { content: [{ type: 'text', text: 'Please sign in.' }] } }),
    { detail: 'Please sign in.', error: 'Please sign in.' });
  assert.deepEqual(parse({ type: 'error', error: { message: 'Tool connection failed' } }), { error: 'Tool connection failed' });
  assert.deepEqual(parse({ type: 'assistant', error: { code: 'unknown_provider_code' } }), { error: 'Claude reported an assistant error.' });
  assert.equal(parse({ type: 'result', is_error: true, result: '\x1b[31m' + 'x'.repeat(5000) }).error.length, 4000);
});

test('quota reset stays unknown when absent and allowed overage never becomes a blocking refusal', () => {
  assert.deepEqual(parse({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour' } }),
    { error: 'Claude reported a usage limit (five_hour).' });
  const known = parse({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1800000000 } });
  assert.match(known.error, /Resets at 2027-01-15T08:00:00.000Z/);
  assert.equal(parse({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning' } }), null);
  assert.equal(parse({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', overageStatus: 'allowed' } }), null);
  assert.deepEqual(parse({ type: 'system', subtype: 'api_retry', attempt: 2, max_retries: 10 }),
    { detail: 'Claude provider is retrying (attempt 2 of 10).' });
});
