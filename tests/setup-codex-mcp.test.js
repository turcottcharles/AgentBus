'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Setup } = require('../app/setup');

test('Codex MCP setup writes cwd and inbox timeouts without embedding hub credentials or a shared name', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-codex-mcp-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = directory;
  try {
    const root = path.join(directory, 'repo');
    fs.mkdirSync(root);
    const setup = new Setup(root, { config: { port: 47800 } });
    setup.python = path.join(directory, 'python.exe');
    fs.writeFileSync(path.join(directory, 'config.toml'), '[other]\nkeep = true\n\n[mcp_servers.agent_bus]\ncommand = \'old\'\n');
    const result = await setup.fix('codexMcp');
    const toml = fs.readFileSync(setup.codexConfigPath(), 'utf8');
    assert.match(result, /unique name/);
    assert.match(toml, /^\[other\]$/m);
    assert.match(toml, /keep = true/);
    assert.match(toml, /tool_timeout_sec = 330/);
    assert.match(toml, new RegExp(`cwd = '${root.replace(/\\/g, '\\\\')}'`));
    assert.doesNotMatch(toml, /AGENT_BUS_NAME|AGENT_BUS_URL|AGENT_BUS_TOKEN|47800/);
    assert.doesNotMatch(toml, /command = 'old'/);
    const backups = fs.readdirSync(directory).filter((name) => name.includes('.bak-agentbus-'));
    assert.equal(backups.length, 1);
  } finally {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
    fs.rmSync(path.resolve(directory), { recursive: true, force: true });
  }
});
