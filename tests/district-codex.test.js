'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createLaunch, parseLine } = require('../app/district/providers/codex');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'district-codex-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 }));
  const root = path.join(temp, 'project with spaces & literal'); fs.mkdirSync(root);
  const ticket = path.join(temp, 'private ticket.json');
  const configPath = path.join(temp, 'mcp config.json');
  const server = { command: process.execPath,
    args: [path.resolve(__dirname, '../app/district/project-agent-mcp.js'), '--ticket', ticket] };
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { agent_bus_project: server } }));
  return { temp, root, ticket, configPath, server, prompt: 'Change the checklist title using project tools.',
    env: { ...process.env, AGENT_BUS_CODEX_CLI: process.execPath } };
}
function configValues(args) {
  const result = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '-c') result.push(args[++i]);
  return result;
}

test('fresh Codex launch isolates integrations and authorizes exactly the scoped project tools', (t) => {
  const f = fixture(t), plan = createLaunch(f), settings = configValues(plan.args);
  assert.equal(plan.command, process.execPath); assert.equal(plan.cwd, f.root); assert.equal(plan.stdin, f.prompt);
  assert(plan.args.includes('--no-daemon')); assert(plan.args.includes('--ephemeral'));
  assert(plan.args.includes('--skip-git-repo-check')); assert(plan.args.includes('--ignore-user-config'));
  assert(plan.args.includes('--ignore-rules')); assert(plan.args.includes('--json'));
  assert.equal(plan.args[plan.args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(plan.args[plan.args.indexOf('--cd') + 1], f.root);
  assert.equal(plan.args.at(-1), '-'); assert(!plan.args.includes(f.prompt));
  for (const disabled of ['features.shell_tool=false', 'features.hooks=false', 'features.multi_agent=false',
    'features.apps=false', 'features.plugins=false', 'features.browser_use=false', 'features.computer_use=false',
    'features.image_generation=false', 'features.view_image=false', 'features.shell_snapshot=false',
    'features.workspace_dependencies=false']) assert(settings.includes(disabled), disabled);
  assert(!settings.some((s) => s.startsWith('tools.view_image=')), 'installed CLI rejects the obsolete tools.view_image key');
  assert(settings.includes('approval_policy="never"')); assert(settings.includes('web_search="disabled"'));
  const mcp = settings.find((s) => s.startsWith('mcp_servers='));
  assert(mcp.includes('"agent_bus_project"={"command"='));
  assert(mcp.includes(`"args"=[${f.server.args.map(JSON.stringify).join(',')}]`));
  assert(mcp.includes('"enabled_tools"=["project_list_files","project_read_file","project_write_file","report_activity"]'));
  assert.equal((mcp.match(/"approval_mode"="approve"/g) || []).length, 4);
  assert(mcp.includes('"project_write_file"={"approval_mode"="approve"}'));
  assert(mcp.includes('"ELECTRON_RUN_AS_NODE"="1"'));
  assert(!settings.some((s) => s.startsWith('model_reasoning_effort=')));
  assert(!plan.args.includes('--model')); assert(!plan.args.some((a) => /bypass|^resume$|^fork$/.test(a)));
});

test('explicit model and effort survive as separate validated arguments', (t) => {
  const f = fixture(t), plan = createLaunch({ ...f, model: 'gpt-6.1-sol', effort: 'high' });
  assert.equal(plan.args[plan.args.indexOf('--model') + 1], 'gpt-6.1-sol');
  assert(configValues(plan.args).includes('model_reasoning_effort="high"'));
  for (const model of ['', ' --model=x', 'x\n--config=x', 'x;echo pwned', {}, null, 'a'.repeat(201)]) {
    assert.throws(() => createLaunch({ ...f, model }), /model selection/);
  }
  for (const effort of ['', 'HIGH', 'high; echo bad', {}, null]) assert.throws(() => createLaunch({ ...f, effort }), /reasoning effort/);
  for (const effort of ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']) {
    assert(configValues(createLaunch({ ...f, effort }).args).includes(`model_reasoning_effort=${JSON.stringify(effort)}`));
  }
});

test('extra MCP integrations, HTTP/shell servers and malformed config fail closed', (t) => {
  const f = fixture(t);
  const write = (config) => fs.writeFileSync(f.configPath, JSON.stringify(config));
  write({ mcpServers: { agent_bus_project: f.server, extra: f.server } });
  assert.throws(() => createLaunch(f), /only agent_bus_project/);
  write({ mcpServers: { wrong_name: f.server } }); assert.throws(() => createLaunch(f), /only agent_bus_project/);
  write({ mcpServers: { agent_bus_project: { url: 'https://example.invalid' } } });
  assert.throws(() => createLaunch(f), /Invalid scoped/);
  write({ mcpServers: { agent_bus_project: { ...f.server, command: 'node' } } });
  assert.throws(() => createLaunch(f), /Invalid scoped/);
  write({ mcpServers: { agent_bus_project: { ...f.server, command: path.join(f.temp, 'server.cmd') } } });
  assert.throws(() => createLaunch(f), /Invalid scoped/);
  write({ mcpServers: { agent_bus_project: { ...f.server, env: { BAD: 1 } } } });
  assert.throws(() => createLaunch(f), /Invalid scoped/);
  fs.writeFileSync(f.configPath, 'x'.repeat(65537)); assert.throws(() => createLaunch(f), /under 64KB/);
});

test('launch requires explicit absolute scope and a bounded real instruction', (t) => {
  const f = fixture(t);
  assert.throws(() => createLaunch({ ...f, root: '.' }), /absolute project root/);
  assert.throws(() => createLaunch({ ...f, configPath: 'relative.json' }), /absolute project MCP/);
  for (const prompt of ['', ' ', 'a'.repeat(65537), 'null\0byte', null]) assert.throws(() => createLaunch({ ...f, prompt }), /instruction/);
  assert.throws(() => createLaunch({ ...f, env: { ...f.env, AGENT_BUS_CODEX_CLI: 'codex.cmd' } }), /absolute executable/);
  assert.throws(() => createLaunch({ ...f, env: { ...f.env, AGENT_BUS_CODEX_CLI: path.join(f.temp, 'missing.exe') } }), /unavailable/);
});

test('native process clears nesting/tickets/Electron mode and retains provider login', (t) => {
  const f = fixture(t), plan = createLaunch({ ...f, env: { ...f.env, ELECTRON_RUN_AS_NODE: '1',
    CODEX_THREAD_ID: 'old-thread', CODEX_SESSION_ID: 'old-session', CODEX_RUN_ID: 'old-run',
    CODEX_INTERNAL_ORIGINATOR_OVERRIDE: 'desktop', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'nested',
    AGENT_BUS_JOB_TICKET: 'old-ticket', AGENT_BUS_PROJECT_TICKET: 'old-project-ticket',
    AGENT_BUS_DISTRICT_TICKET: 'old-district-ticket', OPENAI_API_KEY: 'fixture-api-key', CODEX_HOME: f.temp } });
  for (const key of ['ELECTRON_RUN_AS_NODE', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CODEX_RUN_ID',
    'CODEX_INTERNAL_ORIGINATOR_OVERRIDE', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT',
    'AGENT_BUS_JOB_TICKET', 'AGENT_BUS_PROJECT_TICKET', 'AGENT_BUS_DISTRICT_TICKET']) assert.equal(plan.env[key], undefined, key);
  assert.equal(plan.env.OPENAI_API_KEY, 'fixture-api-key'); assert.equal(plan.env.CODEX_HOME, f.temp);
});

test('npm shim resolves a real native executable, otherwise uses a Node entry without a shell', (t) => {
  const f = fixture(t), shim = path.join(f.temp, 'codex.cmd'); fs.writeFileSync(shim, 'NEVER EXECUTE THIS SHELL TEXT');
  const env = { ...f.env, AGENT_BUS_CODEX_CLI: shim };
  assert.throws(() => createLaunch({ ...f, env }), /unavailable/);
  const packageRoot = path.join(f.temp, 'node_modules', '@openai', 'codex');
  const entry = path.join(packageRoot, 'bin', 'codex.js'); fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.writeFileSync(entry, '// fixture');
  const executable = path.join(f.temp, 'Renamed Agent Bus.exe');
  const plan = createLaunch({ ...f, env, executable });
  assert.equal(plan.command, executable); assert.equal(plan.args[0], entry); assert.equal(plan.env.ELECTRON_RUN_AS_NODE, '1');
  if (process.platform === 'win32' && process.arch === 'x64') {
    const native = path.join(packageRoot, 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
    fs.mkdirSync(path.dirname(native), { recursive: true }); fs.writeFileSync(native, 'fixture');
    const nativePlan = createLaunch({ ...f, env, executable });
    assert.equal(nativePlan.command, native); assert.equal(nativePlan.env.ELECTRON_RUN_AS_NODE, undefined);
  }
});

test('public parser preserves provider identity, scoped tool status and actual errors', () => {
  const parse = (event) => parseLine(JSON.stringify(event));
  assert.deepEqual(parse({ type: 'thread.started', thread_id: 'new-thread-123' }), { sessionId: 'new-thread-123' });
  assert.deepEqual(parse({ type: 'item.completed', item: { type: 'agent_message', text: 'Changed the title.' } }), { detail: 'Changed the title.' });
  assert.deepEqual(parse({ type: 'item.started', item: { type: 'mcp_tool_call', server: 'agent_bus_project',
    tool: 'project_write_file', arguments: { content: 'private source' } } }), { detail: 'Agent called project_write_file' });
  assert.deepEqual(parse({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'agent_bus_project',
    tool: 'project_write_file', error: { message: 'Path outside project' } } }),
  { detail: 'Agent failed project_write_file', error: 'Path outside project' });
  assert.deepEqual(parse({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'agent_bus_project',
    tool: 'project_write_file', status: 'failed', error: null } }),
  { detail: 'Agent failed project_write_file', error: 'Codex reported that project_write_file failed.' });
  assert.deepEqual(parse({ type: 'turn.failed', error: { message: 'Quota limit reached' } }), { error: 'Quota limit reached' });
  assert.deepEqual(parse({ type: 'error', error: 'Authentication required' }), { error: 'Authentication required' });
  assert.deepEqual(parse({ type: 'item.completed', item: { type: 'error', message: 'Tool unavailable' } }), { detail: 'Tool unavailable' });
});

test('parser ignores reasoning and malformed data, rejects unrelated tools and bounds public output', () => {
  const parse = (event) => parseLine(JSON.stringify(event));
  for (const line of [null, undefined, '', 'not json', 'null', '42']) assert.equal(parseLine(line), null);
  assert.equal(parse({ type: 'item.completed', item: { type: 'reasoning', text: 'private thinking' } }), null);
  assert.match(parse({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'foreign', tool: 'project_write_file' } }).error, /unscoped MCP operation/);
  assert.equal(parse({ type: 'thread.started', thread_id: 'spoof\nidentity' }), null);
  assert.equal(parse({ type: 'item.completed', item: { type: 'agent_message', text: 'x'.repeat(6000) } }).detail.length, 4000);
  assert.deepEqual(parseLine('x'.repeat(1000001)), { error: 'Codex emitted an oversized event.' });
});

test('nonfatal configuration warnings remain visible while genuine provider errors remain fatal', () => {
  const message = 'Codex is ignoring 1 unrecognized configuration setting. Check for typos or deprecated settings.\n  session-flags: `tools.view_image` is ignored.';
  assert.deepEqual(parseLine(JSON.stringify({ type: 'item.completed', item: { type: 'error', message } })), { detail: message });
  assert.deepEqual(parseLine(JSON.stringify({ type: 'error', message: 'Account quota exhausted' })), { error: 'Account quota exhausted' });
});

test('real harmless subprocess consumes literal arguments/stdin without interpreting shell text', { timeout: 10000 }, async (t) => {
  const f = fixture(t), script = path.join(f.temp, 'harmless codex fixture.cjs');
  fs.writeFileSync(script, `let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify({args:process.argv.slice(2),input,cwd:process.cwd()})));`);
  const prompt = 'literal $(never_run) & "quotes"\nchange title';
  const plan = createLaunch({ ...f, prompt, model: 'gpt-6.1-sol', effort: 'high', env: { ...f.env, AGENT_BUS_CODEX_CLI: script } });
  const child = spawn(plan.command, plan.args, { cwd: plan.cwd, env: plan.env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let out = '', err = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { err += c; });
  child.stdin.end(plan.stdin); const [code] = await once(child, 'close'); assert.equal(code, 0, err);
  const seen = JSON.parse(out); assert.equal(seen.input, prompt); assert.equal(seen.cwd, f.root);
  assert.equal(seen.args[seen.args.indexOf('--cd') + 1], f.root);
  assert.equal(seen.args[seen.args.indexOf('--model') + 1], 'gpt-6.1-sol');
  assert(configValues(seen.args).includes('model_reasoning_effort="high"'));
});
