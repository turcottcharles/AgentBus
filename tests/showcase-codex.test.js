'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createLaunch, parseLine } = require('../app/district/providers/codex');
const { stopProcessTree } = require('../app/district/process-control');
const MCP_ENTRY = path.resolve(__dirname, '../app/district/project-agent-mcp.js');
const parse = (event) => parseLine(JSON.stringify(event));
const tool = (patch = {}) => ({ type: 'mcp_tool_call', server: 'agent_bus_project', tool: 'project_write_file', ...patch });

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-codex-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('showcase-codex-'));
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  const root = path.join(directory, 'owned project & literal');
  fs.mkdirSync(root);
  const configPath = path.join(directory, 'mcp.json');
  const server = { command: process.execPath, args: [MCP_ENTRY, '--ticket', path.join(directory, 'ticket.json')] };
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { agent_bus_project: server } }));
  return { directory, root, configPath, server, prompt: 'Make one scoped source edit.',
    env: { ...process.env, AGENT_BUS_CODEX_CLI: process.execPath } };
}
function settings(args) {
  return args.flatMap((value, index) => value === '-c' ? [args[index + 1]] : []);
}

test('Codex launch accepts the real private-ticket server and rejects substitute programs or extra authority', (t) => {
  const f = fixture(t);
  const good = createLaunch(f);
  assert.ok(settings(good.args).some((value) => value.startsWith('mcp_servers=') && value.includes('project_write_file')));
  for (const server of [
    { ...f.server, args: [path.join(f.directory, 'project-agent-mcp.js'), '--ticket', f.server.args[2]] },
    { ...f.server, args: ['-e', 'require("fs").writeFileSync("outside.txt","bad")', f.server.args[2]] },
    { ...f.server, args: [...f.server.args, '--root', f.root] },
    { ...f.server, args: [MCP_ENTRY, '--root', f.root] },
    { ...f.server, args: [MCP_ENTRY, '--ticket', 'relative-ticket.json'] },
    { ...f.server, env: { NODE_OPTIONS: '--require external.js' } },
    { ...f.server, env: { ELECTRON_RUN_AS_NODE: '0' } },
    { ...f.server, url: 'https://example.invalid' },
    { ...f.server, type: 'http' },
    null,
  ]) {
    fs.writeFileSync(f.configPath, JSON.stringify({ mcpServers: { agent_bus_project: server } }));
    assert.throws(() => createLaunch(f), /Invalid scoped/);
  }
});

test('launch strips inherited JavaScript injection while preserving explicit account, model and effort', (t) => {
  const f = fixture(t);
  const launch = createLaunch({ ...f, model: 'gpt-6.1-sol', effort: 'high', env: { ...f.env,
    NODE_OPTIONS: '--require=unrelated-hook.cjs', NODE_PATH: 'unrelated-modules', CODEX_THREAD_ID: 'old-thread',
    CODEX_HOME: f.directory, OPENAI_API_KEY: 'dummy-local-fixture-key' } });
  assert.equal(launch.env.NODE_OPTIONS, undefined);
  assert.equal(launch.env.NODE_PATH, undefined);
  assert.equal(launch.env.CODEX_THREAD_ID, undefined);
  assert.equal(launch.env.CODEX_HOME, f.directory);
  assert.equal(launch.env.OPENAI_API_KEY, 'dummy-local-fixture-key');
  assert.equal(launch.args[launch.args.indexOf('--model') + 1], 'gpt-6.1-sol');
  assert.ok(settings(launch.args).includes('model_reasoning_effort="high"'));
  assert.equal(launch.args[launch.args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(launch.args.includes('--ignore-user-config'));
  assert.ok(settings(launch.args).includes('features.shell_tool=false'));
  assert.ok(settings(launch.args).includes('web_search="disabled"'));
  assert.ok(!launch.args.includes('resume'));
});

test('MCP failure status remains failure when transport error is null and the error lives in result content', () => {
  const failed = parse({ type: 'item.completed', item: tool({ status: 'failed', error: null,
    result: { content: [{ type: 'text', text: 'Workspace: outside project boundary.' }] } }) });
  assert.deepEqual(failed, { detail: 'Agent failed project_write_file', error: 'Workspace: outside project boundary.' });
  assert.match(parse({ type: 'item.completed', item: tool({ status: 'failed', error: null, result: null }) }).error, /project_write_file failed/);
  assert.match(parse({ type: 'item.completed', item: tool({ status: 'completed', result: { isError: true, content: [{ type: 'text', text: 'Ticket revoked' }] } }) }).error, /Ticket revoked/);
});

test('nonfatal CLI diagnostics and reconnects stay visible without poisoning a recovered turn', () => {
  const frames = [
    { type: 'thread.started', thread_id: 'fixture-thread' },
    { type: 'turn.started' },
    { type: 'item.completed', item: { type: 'error', message: 'Reconnecting… 1/5 after transient transport error' } },
    { type: 'item.completed', item: { type: 'error', message: 'Codex is ignoring an unrecognized configuration setting.' } },
    { type: 'item.completed', item: tool({ status: 'completed', error: null }) },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } },
  ].map(parse);
  assert.ok(frames.every((event) => !event?.error));
  assert.match(frames[2].detail, /Reconnecting/);
  assert.match(frames[3].detail, /unrecognized configuration/);
  assert.match(frames.at(-1).detail, /project checks are separate/);
  for (const message of ['Authentication required', 'Quota limit reached', 'Stream disconnected before completion']) {
    assert.equal(parse({ type: 'turn.failed', error: { message } }).error, message);
    assert.equal(parse({ type: 'error', message }).error, message);
  }
  // A native app-server willRetry field does not redefine the CLI fatal error schema.
  assert.equal(parse({ type: 'error', message: 'Stream failed', willRetry: true }).error, 'Stream failed');
});

test('tool progress is public-only and never becomes signed write, check or pass authority', () => {
  const privateText = 'PRIVATE_SOURCE_AND_REASONING_SENTINEL';
  for (const type of ['item.started', 'item.updated', 'item.completed']) {
    const result = parse({ type, item: tool({ status: type === 'item.completed' ? 'completed' : 'in_progress',
      arguments: { content: privateText }, result: { content: [{ type: 'text', text: privateText }] } }) });
    assert.ok(result.detail.includes('project_write_file'));
    assert.ok(!JSON.stringify(result).includes(privateText));
    assert.ok(Object.keys(result).every((key) => ['sessionId', 'detail', 'error'].includes(key)));
    assert.equal(result.error, undefined);
  }
  assert.match(parse({ type: 'item.updated', item: tool() }).detail, /is running/);
  assert.equal(parse({ type: 'item.completed', item: { type: 'reasoning', text: privateText } }), null);
  assert.equal(parse({ type: 'unknown.frame', item: tool() }), null);
});

test('unexpected native or foreign tool execution surfaces a scope failure without exposing arguments', () => {
  const secret = 'DO_NOT_EXPOSE_ARGUMENTS';
  for (const type of ['command_execution', 'file_change', 'web_search', 'collab_tool_call']) {
    const result = parse({ type: 'item.started', item: { type, command: secret, changes: [{ path: secret }], query: secret } });
    assert.match(result.error, /unscoped/);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  assert.match(parse({ type: 'item.started', item: tool({ server: 'foreign', arguments: { secret } }) }).error, /unscoped MCP/);
  assert.match(parse({ type: 'item.started', item: tool({ tool: 'run_shell' }) }).error, /unscoped MCP/);
});

test('parser bounds malformed frames and strips control sequences from diagnostics', () => {
  for (const value of ['[]', '{}', 'null', '42', 'garbled', undefined]) assert.equal(parseLine(value), null);
  assert.deepEqual(parseLine('x'.repeat(1000001)), { error: 'Codex emitted an oversized event.' });
  assert.equal(parse({ type: 'error', message: '\u001b[31mQuota\u001b[0m\u0000 blocked' }).error, 'Quota blocked');
  assert.equal(parse({ type: 'item.completed', item: { type: 'error', message: 'x'.repeat(5000) } }).detail.length, 4000);
  assert.equal(parse({ type: 'thread.started', thread_id: 'wrong\nidentity' }), null);
});

test('historical recorded Codex frames remain parseable without implying a current authenticated qualification', () => {
  const recorded = path.resolve(__dirname, '../evidence/district-v2/attract-live/codex-run.json');
  const record = JSON.parse(fs.readFileSync(recorded, 'utf8'));
  const frames = String(record.agentOutput).split('\n').filter(Boolean).map(parseLine).filter(Boolean);
  assert.ok(frames.some((event) => event.sessionId));
  assert.ok(frames.some((event) => /called project_write_file/.test(event.detail || '')));
  assert.ok(frames.some((event) => /completed project_write_file/.test(event.detail || '')));
  assert.ok(frames.every((event) => !event.error));
});

test('real harmless Node fixture streams through the launch plan and owned-tree stop stays bounded', { timeout: 15000 }, async (t) => {
  const f = fixture(t);
  const entry = path.join(f.directory, 'harmless fixture.cjs');
  fs.writeFileSync(entry, `let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>input+=v);process.stdin.on('end',()=>{process.stdout.write(JSON.stringify({type:'thread.started',thread_id:'fixture-process'})+'\\n');process.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({args:process.argv.slice(2),input,cwd:process.cwd()})}})+'\\n');setInterval(()=>{},1000);});`);
  const prompt = 'literal $(must_not_run) & "quotes"\nOnly scoped edits.';
  const launch = createLaunch({ ...f, prompt, env: { ...f.env, AGENT_BUS_CODEX_CLI: entry } });
  const child = spawn(launch.command, launch.args, { cwd: launch.cwd, env: launch.env, shell: false, windowsHide: true,
    detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) await stopProcessTree(child, { graceMs: 100 }); });
  let pending = '', result;
  const received = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.on('data', (chunk) => {
      pending += chunk.toString('utf8');
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        const parsed = parseLine(line);
        if (parsed?.detail) { result = JSON.parse(parsed.detail); resolve(); }
      }
    });
  });
  child.stdin.end(launch.stdin);
  await received;
  assert.equal(result.input, prompt);
  assert.equal(result.cwd, f.root);
  assert.equal(result.args[result.args.indexOf('--cd') + 1], f.root);
  const closed = once(child, 'close');
  const stopped = await stopProcessTree(child, { graceMs: 100 });
  await closed;
  assert.equal(stopped.confirmed, true);
  assert.equal(stopped.pid, child.pid);
});
