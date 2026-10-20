'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { discoverAgents, createAgentLaunch, launchAgent, parseAgentEvent } = require('../app/map-agents');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-cli-test-'));
  const root = path.join(temp, 'project & literal spaces'); fs.mkdirSync(root);
  t.after(() => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 }));
  const configPath = path.join(temp, 'job config.json');
  const ticket = path.join(temp, 'ticket secret.json');
  const server = { command: process.execPath, args: [path.join(root, 'app', 'agent-test-mcp.js')],
    env: { AGENT_BUS_JOB_TICKET: ticket, ELECTRON_RUN_AS_NODE: '1' } };
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { agent_bus_test: server } }));
  const env = { ...process.env, PATH: '', Path: '', USERPROFILE: temp, HOME: temp, APPDATA: temp,
    AGENT_BUS_CLAUDE_CLI: process.execPath, AGENT_BUS_CODEX_CLI: process.execPath };
  return { temp, root, configPath, ticket, server, env, prompt: 'Run the smoke test; report public progress.' };
}
function configArgs(args) {
  const values = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '-c') values.push(args[++i]);
  return values;
}

test('discovery returns distinct dedicated slots and does no command execution', (t) => {
  const f = fixture(t);
  const agents = discoverAgents({ env: f.env });
  assert.deepEqual(agents.map((a) => [a.id, a.vendor, a.available]),
    [['@claude-worker', 'claude', true], ['@codex-worker', 'codex', true]]);
  const missing = discoverAgents({ env: { ...f.env, AGENT_BUS_CLAUDE_CLI: path.join(f.temp, 'missing.exe'),
    AGENT_BUS_CODEX_CLI: path.join(f.temp, 'missing.exe') } });
  assert(missing.every((a) => !a.available));
});

test('Windows npm shim resolves known Codex native package without a shell', (t) => {
  const f = fixture(t), dir = path.join(f.temp, 'npm with spaces'); fs.mkdirSync(dir);
  const shim = path.join(dir, 'codex.cmd'); fs.writeFileSync(shim, '@echo deliberately never executed');
  const packageRoot = path.join(dir, 'node_modules', '@openai', 'codex');
  fs.mkdirSync(path.join(packageRoot, 'bin'), { recursive: true }); fs.writeFileSync(path.join(packageRoot, 'bin', 'codex.js'), '// entry');
  const native = path.join(packageRoot, 'node_modules', '@openai', 'codex-win32-x64', 'vendor',
    'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
  fs.mkdirSync(path.dirname(native), { recursive: true }); fs.writeFileSync(native, 'fixture');
  const plan = createAgentLaunch({ ...f, vendor: 'codex', platform: 'win32', arch: 'x64',
    env: { ...f.env, AGENT_BUS_CODEX_CLI: shim } });
  assert.equal(plan.command, native); assert.equal(plan.args[0], 'exec');
  assert.equal(plan.cwd, f.root);
  fs.rmSync(native);
  const fallback = createAgentLaunch({ ...f, vendor: 'codex', platform: 'win32', arch: 'x64',
    env: { ...f.env, AGENT_BUS_CODEX_CLI: shim } });
  assert.equal(fallback.command, process.execPath);
  assert.equal(fallback.args[0], path.join(packageRoot, 'bin', 'codex.js'));
});

test('unrecognized Windows shell shims fail closed', (t) => {
  const f = fixture(t), shim = path.join(f.temp, 'claude.cmd'); fs.writeFileSync(shim, '@echo bad');
  assert.throws(() => createAgentLaunch({ ...f, vendor: 'claude', platform: 'win32',
    env: { ...f.env, AGENT_BUS_CLAUDE_CLI: shim } }), /unavailable/);
});

test('Claude exposes only the two job tools and starts a fresh restricted session', (t) => {
  const f = fixture(t), plan = createAgentLaunch({ ...f, vendor: 'claude' });
  assert.equal(plan.args[plan.args.indexOf('--tools') + 1], '');
  assert.equal(plan.args[plan.args.indexOf('--mcp-config') + 1], f.configPath);
  assert(plan.args.includes('--restricted')); assert(plan.args.includes('--strict-mcp-config'));
  assert(plan.args.includes('--no-session-persistence'));
  assert.equal(plan.args[plan.args.indexOf('--permission-prompts') + 1], 'none');
  assert.deepEqual(plan.args.slice(plan.args.indexOf('--allowedTools') + 1, plan.args.indexOf('--permission-prompts')),
    ['mcp__agent_bus_test__run_smoke', 'mcp__agent_bus_test__report_progress']);
  assert(!plan.args.some((arg) => /resume|bypass|--model/.test(arg)));
  assert(!plan.args.includes(f.prompt));
});

test('Codex restricts commands and configured integrations, serializing MCP as TOML', (t) => {
  const f = fixture(t), plan = createAgentLaunch({ ...f, vendor: 'codex' }), settings = configArgs(plan.args);
  assert.equal(plan.args[0], 'exec'); assert.equal(plan.args.at(-1), '-');
  assert(plan.args.includes('--ignore-user-config')); assert(plan.args.includes('--ignore-rules'));
  assert(plan.args.includes('--ephemeral')); assert(plan.args.includes('--json'));
  assert.equal(plan.args[plan.args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(plan.args[plan.args.indexOf('--cd') + 1], f.root);
  assert(settings.includes('features.shell_tool=false')); assert(settings.includes('features.hooks=false'));
  assert(settings.includes('features.multi_agent=false')); assert(settings.includes('features.plugins=false'));
  assert(settings.includes('web_search="disabled"')); assert(settings.includes('approval_policy="never"'));
  const mcp = settings.find((arg) => arg.startsWith('mcp_servers='));
  assert(mcp.includes('"agent_bus_test"={"command"='));
  assert(mcp.includes(`"AGENT_BUS_JOB_TICKET"=${JSON.stringify(f.ticket)}`));
  assert(mcp.includes('"enabled_tools"=["run_smoke","report_progress"]'));
  assert(mcp.includes('"tools"={"run_smoke"={"approval_mode"="approve"},"report_progress"={"approval_mode"="approve"}}'));
  assert.equal((mcp.match(/"approval_mode"="approve"/g) || []).length, 2, 'only the two authorized fixed job tools receive approval');
  assert(!settings.some((arg) => arg.startsWith('default_tools_approval_mode=') || arg.startsWith('tools.')));
  assert(!plan.args.some((arg) => /resume|bypass|^model=|^--model$/.test(arg)));
  assert.equal(plan.env.AGENT_BUS_JOB_TICKET, undefined);
});

test('native CLI environment removes nesting markers and Electron mode while retaining provider auth', (t) => {
  const f = fixture(t), plan = createAgentLaunch({ ...f, vendor: 'claude', env: { ...f.env,
    CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'nested', CLAUDE_CODE_SESSION_ID: 'existing',
    CLAUDE_CODE_OAUTH_TOKEN: 'fixture-token', CLAUDE_CODE_USE_BEDROCK: '1',
    ANTHROPIC_API_KEY: 'fixture-api-key', OPENAI_API_KEY: 'fixture-openai-key',
    ELECTRON_RUN_AS_NODE: '1', CODEX_THREAD_ID: 'existing-thread', AGENT_BUS_JOB_TICKET: f.ticket } });
  for (const key of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'ELECTRON_RUN_AS_NODE', 'CODEX_THREAD_ID', 'AGENT_BUS_JOB_TICKET']) assert.equal(plan.env[key], undefined, key);
  assert.equal(plan.env.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-token');
  assert.equal(plan.env.CLAUDE_CODE_USE_BEDROCK, '1'); assert.equal(plan.env.ANTHROPIC_API_KEY, 'fixture-api-key');
  assert.equal(plan.env.OPENAI_API_KEY, 'fixture-openai-key');
});

test('JS npm fallback can use Electron as Node while native CLI clears Electron mode', (t) => {
  const f = fixture(t), script = path.join(f.temp, 'fixture.js'); fs.writeFileSync(script, '// fixture');
  const executable = path.join(f.temp, 'electron.exe');
  const js = createAgentLaunch({ ...f, vendor: 'claude', executable,
    env: { ...f.env, AGENT_BUS_CLAUDE_CLI: script } });
  assert.equal(js.command, executable); assert.equal(js.env.ELECTRON_RUN_AS_NODE, '1');
  const native = createAgentLaunch({ ...f, vendor: 'claude', executable,
    env: { ...f.env, ELECTRON_RUN_AS_NODE: '1' } });
  assert.equal(native.env.ELECTRON_RUN_AS_NODE, undefined);
});

test('invalid job configurations cannot expose an additional MCP server', (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.configPath, JSON.stringify({ mcpServers: { agent_bus_test: f.server, unrelated: f.server } }));
  assert.throws(() => createAgentLaunch({ ...f, vendor: 'codex' }), /only agent_bus_test/);
  fs.writeFileSync(f.configPath, JSON.stringify({ mcpServers: { agent_bus_test: { ...f.server, env: { BAD: 1 } } } }));
  assert.throws(() => createAgentLaunch({ ...f, vendor: 'claude' }), /Invalid/);
});

test('parsers expose public progress, session IDs and errors, excluding thinking and tool arguments', () => {
  const parse = (vendor, obj) => parseAgentEvent(vendor, JSON.stringify(obj));
  assert.equal(parseAgentEvent('codex', 'not json'), null);
  assert.deepEqual(parse('codex', { type: 'thread.started', thread_id: 'dedicated' }), { sessionId: 'dedicated' });
  assert.equal(parse('codex', { type: 'item.completed', item: { type: 'reasoning', text: 'private' } }), null);
  assert.equal(parse('claude', { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'private' }] } }), null);
  assert.deepEqual(parse('claude', { type: 'assistant', session_id: 'fresh', message: { content: [
    { type: 'thinking', thinking: 'private' }, { type: 'text', text: 'Starting checks' }] } }),
  { sessionId: 'fresh', detail: 'Starting checks' });
  assert.deepEqual(parse('codex', { type: 'item.started', item: { type: 'mcp_tool_call', server: 'agent_bus_test', tool: 'run_smoke', arguments: { secret: 'do not display' } } }), { detail: 'Agent called run_smoke' });
  assert.deepEqual(parse('claude', { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'mcp__agent_bus_test__run_smoke', input: { secret: 'hidden' } }] } }), { detail: 'Agent called run_smoke' });
  assert.deepEqual(parse('codex', { type: 'turn.failed', error: { message: 'Login required' } }), { error: 'Login required' });
  assert.deepEqual(parse('claude', { type: 'result', is_error: true, result: 'Login required' }), { error: 'Login required' });
  assert.equal(parse('codex', { type: 'item.completed', item: { type: 'agent_message', text: 'a'.repeat(3000) } }).detail.length, 2000);
});

test('spawn sends metacharacters as literal argv and prompt through stdin without invoking a shell', async (t) => {
  const f = fixture(t), cli = path.join(f.temp, 'harmless cli fixture.js');
  fs.writeFileSync(cli, `let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', c=>input+=c); process.stdin.on('end',()=>process.stdout.write(JSON.stringify({argv:process.argv.slice(2),input,cwd:process.cwd(),ticket:process.env.AGENT_BUS_JOB_TICKET||null})));`);
  const prompt = 'literal $(never_execute) & "quoted"\nsecond line';
  const child = launchAgent({ ...f, vendor: 'claude', prompt, env: { ...f.env, AGENT_BUS_CLAUDE_CLI: cli } });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '', stderr = ''; child.stdout.on('data', (c) => { output += c; }); child.stderr.on('data', (c) => { stderr += c; });
  const [code] = await once(child, 'close'); assert.equal(code, 0, stderr);
  const seen = JSON.parse(output); assert.equal(seen.input, prompt); assert.equal(seen.cwd, f.root);
  assert.equal(seen.argv[seen.argv.indexOf('--mcp-config') + 1], f.configPath);
  assert.equal(seen.argv[seen.argv.indexOf('--tools') + 1], ''); assert.equal(seen.ticket, null);
});
