'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listProviders, createLaunch, parseLine } = require('../app/district/providers');

function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const temp = fs.mkdtempSync(path.join(parent, 'agent-bus-provider-registry-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temp)), parent);
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
  });
  const root = path.join(temp, 'project with spaces & literal');
  fs.mkdirSync(root);
  const marker = path.join(temp, 'must-not-run.txt');
  const cli = path.join(temp, 'offline-provider.js');
  fs.writeFileSync(cli, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected execution');`);
  const configPath = path.join(temp, 'project MCP.json');
  fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { agent_bus_project: {
    command: process.execPath,
    args: [path.resolve(__dirname, '../app/district/project-agent-mcp.js'), '--ticket', path.join(temp, 'ticket.json')],
    env: { ELECTRON_RUN_AS_NODE: '1' },
  } } }));
  const env = {
    PATH: '', Path: '', USERPROFILE: temp, HOME: temp, APPDATA: temp,
    AGENT_BUS_CODEX_CLI: cli, AGENT_BUS_CLAUDE_CLI: cli,
  };
  return { temp, root, marker, cli, configPath, env, prompt: 'Literal $(not executed) & "request"\nKeep the existing checklist.' };
}

test('registry discovers only installed provider slots without claiming login, quota or models', async (t) => {
  const f = fixture(t);
  const providers = await listProviders({ env: f.env });
  assert.deepEqual(providers.map(({ id, available }) => [id, available]), [['codex', true], ['claude', true]]);
  for (const provider of providers) {
    assert.match(provider.detail, /Login, quota and model availability are unchecked/);
    assert.equal(Object.hasOwn(provider, 'models'), false);
    assert.equal(Object.hasOwn(provider, 'quota'), false);
    assert.equal(provider.capabilities.modelCatalog, false);
    assert.equal(provider.capabilities.authenticationCheck, false);
    assert.equal(provider.capabilities.quotaCheck, false);
  }
  assert.equal(fs.existsSync(f.marker), false, 'listing never starts the fixture CLI');

  const missing = await listProviders({ env: { ...f.env,
    AGENT_BUS_CLAUDE_CLI: path.join(f.temp, 'missing.js'),
  } });
  assert.equal(missing.find(({ id }) => id === 'codex').available, true);
  assert.equal(missing.find(({ id }) => id === 'claude').available, false);
  assert.match(missing.find(({ id }) => id === 'claude').detail, /Install Claude Code/);
});

test('returned capability records cannot change the next provider snapshot', async (t) => {
  const f = fixture(t), first = await listProviders({ env: f.env });
  first[0].capabilities.quotaCheck = true;
  first[0].id = 'local';
  const next = await listProviders({ env: f.env });
  assert.equal(next[0].id, 'codex');
  assert.equal(next[0].capabilities.quotaCheck, false);
  assert.equal(next[1].capabilities.quotaCheck, false);
});

test('real adapter dispatch preserves explicit models, effort and literal stdin without spawning', (t) => {
  const f = fixture(t);
  const chosen = { codex: 'owner-pinned-codex', claude: 'owner-pinned-claude' };
  for (const vendor of ['codex', 'claude']) {
    const plan = createLaunch(vendor, { ...f, model: chosen[vendor], effort: 'high' });
    assert.equal(plan.command, process.execPath);
    assert.equal(plan.args[0], f.cli);
    assert.equal(plan.cwd, f.root);
    assert.equal(plan.stdin, f.prompt);
    assert.equal(plan.args[plan.args.indexOf('--model') + 1], chosen[vendor]);
    assert.equal(plan.args.includes(f.prompt), false);
    if (vendor === 'codex') {
      assert(plan.args.includes('model_reasoning_effort="high"'));
      assert.equal(plan.args[plan.args.indexOf('--sandbox') + 1], 'read-only');
      const mcp = plan.args.find((arg) => arg.startsWith('mcp_servers='));
      assert.match(mcp, /"agent_bus_project"/);
      assert.doesNotMatch(mcp, /agent_bus_test/);
    } else {
      assert.equal(plan.args[plan.args.indexOf('--effort') + 1], 'high');
      assert.equal(plan.args[plan.args.indexOf('--mcp-config') + 1], f.configPath);
      assert(plan.args.includes('mcp__agent_bus_project__project_write_file'));
      assert(plan.args.includes('--restricted'));
    }
  }
  assert.equal(fs.existsSync(f.marker), false, 'launch plans do not start providers');
});

test('registry does not inject a model/effort default or fall back after invalid explicit choices', (t) => {
  const f = fixture(t);
  for (const vendor of ['codex', 'claude']) {
    const plan = createLaunch(vendor, f);
    assert.equal(plan.args.includes('--model'), false);
    assert.equal(plan.args.includes('--effort'), false);
    assert.equal(plan.args.some((arg) => arg.startsWith('model_reasoning_effort=')), false);
    assert.throws(() => createLaunch(vendor, { ...f, model: '--other-option' }), /model/i);
    assert.throws(() => createLaunch(vendor, { ...f, effort: 'invented-effort' }), /effort/i);
  }
  assert.equal(fs.existsSync(f.marker), false);
});

test('parsers dispatch native session identity and preserve actual login/quota errors', () => {
  assert.deepEqual(parseLine('codex', JSON.stringify({ type: 'thread.started', thread_id: 'codex_owned_session' })),
    { sessionId: 'codex_owned_session' });
  assert.deepEqual(parseLine('claude', JSON.stringify({ type: 'system', subtype: 'init', session_id: 'claude-owned-session' })),
    { sessionId: 'claude-owned-session' });
  assert.deepEqual(parseLine('codex', JSON.stringify({ type: 'turn.failed', error: { message: 'Authentication required' } })),
    { error: 'Authentication required' });
  assert.deepEqual(parseLine('claude', JSON.stringify({ type: 'result', is_error: true, result: 'Usage limit reached; retry after reset' })),
    { error: 'Usage limit reached; retry after reset' });
  for (const vendor of ['codex', 'claude']) assert.equal(parseLine(vendor, 'not JSON'), null);
});

test('unsupported provider identifiers cannot select a hidden fallback or module path', () => {
  for (const vendor of [undefined, null, '', 'local', 'smoke', '__proto__', '../../map-agents', 'CODEX']) {
    assert.throws(() => createLaunch(vendor, {}), /supported provider/);
    assert.throws(() => parseLine(vendor, '{}'), /supported provider/);
  }
});
