'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLaunch, parseLine } = require('../app/district/providers/claude');

const parse = (event) => parseLine(JSON.stringify(event));
const scoped = (tool) => `mcp__agent_bus_project__${tool}`;

function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const temp = fs.mkdtempSync(path.join(parent, 'showcase-claude-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temp)), parent);
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
  });
  const root = path.join(temp, 'owned project & spaces'); fs.mkdirSync(root);
  const cli = path.join(temp, 'metadata-only-cli.cjs'); fs.writeFileSync(cli, 'throw new Error("Must not execute");');
  const configPath = path.join(temp, 'project-mcp.json');
  const server = { command: process.execPath,
    args: [path.resolve(__dirname, '../app/district/project-agent-mcp.js'), '--ticket', path.join(temp, 'ticket.json')],
    env: { ELECTRON_RUN_AS_NODE: '1' } };
  const config = (value) => fs.writeFileSync(configPath, JSON.stringify(value));
  config({ mcpServers: { agent_bus_project: server } });
  return { temp, root, cli, configPath, server, config, prompt: 'Only change the owned heading. Keep the app working.',
    executable: process.execPath, env: { PATH: '', HOME: temp, USERPROFILE: temp, APPDATA: temp, AGENT_BUS_CLAUDE_CLI: cli } };
}

test('Claude launch requests early block progress while retaining only the scoped tools and explicit preference', (t) => {
  const f = fixture(t), plan = createLaunch({ ...f, model: 'owner-preferred-model', effort: 'high' });
  assert.equal(plan.stdin, f.prompt); assert.equal(plan.cwd, f.root);
  assert.equal(plan.args[plan.args.indexOf('--model') + 1], 'owner-preferred-model');
  assert.equal(plan.args[plan.args.indexOf('--effort') + 1], 'high');
  assert(plan.args.includes('--include-partial-messages'));
  assert(plan.args.includes('--restricted')); assert(plan.args.includes('--strict-mcp-config'));
  assert.equal(plan.args[plan.args.indexOf('--tools') + 1], '');
  assert.equal(plan.args[plan.args.indexOf('--permission-prompts') + 1], 'none');
  assert.deepEqual(plan.args.slice(plan.args.indexOf('--allowedTools') + 1, plan.args.indexOf('--permission-prompts')),
    ['project_list_files', 'project_read_file', 'project_write_file', 'report_activity'].map(scoped));
  assert(!plan.args.some((arg) => /resume|continue|bypass|fallback-model/.test(arg)));
});

test('configured MCP cannot substitute another executable or a shell shim', (t) => {
  const f = fixture(t);
  for (const command of [path.join(f.temp, 'other.exe'), path.join(f.temp, 'runtime.cmd'), path.join(f.temp, 'runtime.ps1')]) {
    f.config({ mcpServers: { agent_bus_project: { ...f.server, command } } });
    assert.throws(() => createLaunch(f), /runtime|executable|configuration/i);
  }
});

test('streamed block progress never publishes reasoning, input JSON or a fabricated completed result', () => {
  assert.deepEqual(parse({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'text', text: '' } } }),
    { detail: 'Claude started generating a response.' });
  assert.deepEqual(parse({ type: 'stream_event', event: { type: 'content_block_start', content_block: {
    type: 'tool_use', name: scoped('project_read_file'), input: { secret: 'hidden' },
  } } }), { detail: 'Agent is preparing project_read_file.' });
  for (const event of [
    { type: 'content_block_start', content_block: { type: 'thinking', thinking: 'private' } },
    { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'private' } },
    { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"secret":"private"}' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'public but repeated in completed block' } },
    { type: 'message_stop' },
  ]) assert.equal(parse({ type: 'stream_event', event }), null);
});

test('structured scoped tool progress reports a call and a result without promoting them to evidence', () => {
  assert.deepEqual(parse({ type: 'tool_progress', tool_name: scoped('project_write_file'), elapsed_time_seconds: 3.5,
    tool_input: { content: 'hidden file body' } }), { detail: 'Agent reports project_write_file is running (3.5s).' });
  assert.equal(parse({ type: 'tool_progress', tool_name: 'Bash', elapsed_time_seconds: 2 }), null);
  assert.deepEqual(parse({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'known', content: 'private tool output' }] } }),
    { detail: 'Agent received a tool result.' });
  assert.deepEqual(parse({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'known', is_error: true, content: 'private failure' }] } }),
    { detail: 'Agent received a tool error; no edit or check is confirmed.' });
  const multiple = parse({ type: 'assistant', message: { content: [
    { type: 'tool_use', name: scoped('project_list_files'), input: {} },
    { type: 'tool_use', name: scoped('project_read_file'), input: { secret: 'hidden' } },
  ] } });
  assert.deepEqual(multiple, { detail: 'Agent called project_list_files, project_read_file' });
});

test('permission failures remain failures despite a success subtype and optimistic model prose', () => {
  assert.match(parse({ type: 'system', subtype: 'permission_denied', tool_name: scoped('project_write_file'),
    decision_reason: 'Private rule text', message: 'Private tool input' }).error, /permission.*project_write_file/i);
  const denied = parse({ type: 'result', subtype: 'success', is_error: false, result: 'Everything passed',
    permission_denials: [{ tool_name: scoped('project_write_file'), tool_input: { secret: 'hidden' } }] });
  assert.match(denied.error, /permission.*project_write_file/i);
  assert.doesNotMatch(JSON.stringify(denied), /Everything passed|hidden/);
});

test('every explicit noncompleted terminal and refusal stop cannot masquerade as success', () => {
  const reasons = ['aborted_streaming', 'aborted_tools', 'stop_hook_prevented', 'hook_stopped', 'tool_deferred',
    'blocking_limit', 'max_turns', 'background_requested', 'budget_exhausted', 'structured_output_retry_exhausted',
    'tool_deferred_unavailable', 'turn_setup_failed', 'future_unknown_terminal'];
  for (const terminal_reason of reasons) {
    const result = parse({ type: 'result', subtype: 'success', is_error: false, terminal_reason, result: 'Done' });
    assert(result?.error, terminal_reason);
    assert.equal(result.detail, undefined, terminal_reason);
  }
  for (const stop_reason of ['refusal', 'max_tokens', 'model_context_window_exceeded', 'tool_deferred']) {
    assert(parse({ type: 'result', subtype: 'success', terminal_reason: 'completed', stop_reason, result: 'Done' }).error, stop_reason);
  }
  assert.deepEqual(parse({ type: 'result', subtype: 'success', terminal_reason: 'completed', stop_reason: 'end_turn', is_error: false, result: 'Saved the requested source.' }),
    { detail: 'Saved the requested source.' });
});

test('native auth and terminal diagnostic fields take priority over claimed success without exposing credentials', () => {
  assert.deepEqual(parse({ type: 'auth_status', isAuthenticating: false, error: 'Authentication required', output: ['Do not publish this login URL'] }),
    { error: 'Authentication required' });
  assert.match(parse({ type: 'result', subtype: 'success', api_error_status: 429, result: 'Done' }).error, /429|API/);
  assert.deepEqual(parse({ type: 'result', subtype: 'success', api_error_status: 403, result: 'Permission denied' }),
    { error: 'Claude API failed (HTTP 403). Permission denied' });
  assert.deepEqual(parse({ type: 'result', subtype: 'success', errors: ['Login expired'], result: 'Done' }), { error: 'Login expired' });
  assert.match(parse({ type: 'result', subtype: 'future_result_shape', result: 'Done' }).error, /future_result_shape|unrecognized/i);
  assert.equal(parse({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', overageStatus: 'allowed' } }), null);
});

test('native init refuses explicit out-of-scope tools and a failed scoped MCP connection', () => {
  assert.match(parse({ type: 'system', subtype: 'init', tools: [scoped('project_read_file'), 'Bash'] }).error, /scope|unapproved/i);
  assert.match(parse({ type: 'system', subtype: 'init', tools: [scoped('project_read_file')],
    mcp_servers: [{ name: 'agent_bus_project', status: 'failed' }] }).error, /MCP|connect/i);
  assert.deepEqual(parse({ type: 'system', subtype: 'init', session_id: 'owned', tools: [scoped('project_read_file')],
    mcp_servers: [{ name: 'agent_bus_project', status: 'connected' }] }), { sessionId: 'owned' });
});

test('malformed terminal fields fail closed instead of becoming optimistic success', () => {
  for (const patch of [{ is_error: 'false' }, { permission_denials: {} }, { errors: 'Permission denied' }, { api_error_status: '429' }]) {
    const event = parse({ type: 'result', subtype: 'success', result: 'Done', ...patch });
    assert.match(event.error, /malformed terminal/);
    assert.equal(event.detail, undefined);
  }
});

test('late parser frames cannot grant process exit, cancellation confirmation or successful checks', () => {
  const frames = [
    { type: 'stream_event', event: { type: 'message_stop' }, success: true, cancelled: true },
    { type: 'result', subtype: 'success', is_error: false, result: 'All checks passed', checks: [{ state: 'passed' }], termination: { confirmed: true } },
  ];
  for (const frame of frames) {
    const parsed = parse(frame);
    if (parsed) assert(Object.keys(parsed).every((key) => ['sessionId', 'detail', 'error'].includes(key)));
  }
});

test('oversized provider JSON fails visibly rather than discarding a possible refusal', () => {
  assert.match(parseLine(JSON.stringify({ type: 'result', is_error: true, result: 'x'.repeat(1048576) })).error, /oversized|large/i);
});
