'use strict';
// First-run checklist: everything needed for the bus on this machine, each with a fix button.
// Works from wherever the Agent Bus folder lives, so it can be copied to another computer as-is.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile, execFileSync, spawn } = require('node:child_process');

const HOME = os.homedir();
const run = (cmd, args, opts = {}) => new Promise((resolve) => {
  execFile(cmd, args, { windowsHide: true, timeout: 60000, ...opts }, (err, stdout, stderr) =>
    resolve({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || err?.message || '').trim() }));
});
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const backup = (p) => { if (fs.existsSync(p)) fs.copyFileSync(p, `${p}.bak-agentbus-${new Date().toISOString().slice(0, 10)}`); };
const which = (exe) => {
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [exe], { windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).filter(Boolean)[0] || null;
  } catch { return null; }
};

class Setup {
  constructor(root, hub) {
    this.root = root; this.hub = hub;
    this.script = path.join(root, 'agent_bus_mcp.py');
    this.statusScript = path.join(root, 'claude_statusline.py');
    this.python = null;
  }

  // A real CPython with sqlite3 (some toolchains put a stripped python first on PATH).
  async findPython() {
    if (this.python && fs.existsSync(this.python)) return this.python;
    const probe = 'import sqlite3, sys, urllib.request; print(sys.executable)';
    const cands = process.platform === 'win32'
      ? [['py', ['-3', '-c', probe]], ['python', ['-c', probe]], ['python3', ['-c', probe]]]
      : [['python3', ['-c', probe]], ['python', ['-c', probe]]];
    if (process.platform === 'win32') {
      const base = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python');
      try { for (const d of fs.readdirSync(base).sort().reverse()) cands.push([path.join(base, d, 'python.exe'), ['-c', probe]]); } catch {}
    }
    for (const [cmd, args] of cands) {
      const r = await run(cmd, args);
      const exe = r.ok && r.out.split(/\r?\n/).pop();
      if (exe && fs.existsSync(exe) && !/[\\/]llvm[\\/]/i.test(exe)) return (this.python = exe);
    }
    return null;
  }

  claudeSettingsPath() { return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude'), 'settings.json'); }
  codexConfigPath() { return path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'config.toml'); }

  async status() {
    const py = await this.findPython();
    const claudeExe = which('claude'), codexExe = which('codex');
    const claudeJson = readJson(path.join(HOME, '.claude.json')) || {};
    const claudeMcp = claudeJson.mcpServers?.['agent-bus'];
    const codexToml = fs.existsSync(this.codexConfigPath()) ? fs.readFileSync(this.codexConfigPath(), 'utf8') : '';
    const codexMcp = /^\[mcp_servers\.agent_bus\]/m.test(codexToml);
    const settings = readJson(this.claudeSettingsPath()) || {};
    const sl = settings.statusLine?.command || '';
    const items = [
      { id: 'python', title: 'Python 3', ok: !!py, detail: py || 'Not found. Install Python 3 from python.org (the bus server uses only its standard library).' },
      { id: 'claudeMcp', title: 'Claude Code: agent-bus MCP server', ok: !!claudeMcp && (claudeMcp.args || []).some((a) => path.resolve(a) === path.resolve(this.script)),
        detail: !claudeExe ? 'Claude Code is not installed (optional)' : claudeMcp ? `Registered: ${claudeMcp.command} ${(claudeMcp.args || []).join(' ')}` : 'Not registered', na: !claudeExe, fix: !!claudeExe && !!py },
      { id: 'codexMcp', title: 'Codex: agent_bus MCP server', ok: codexMcp && codexToml.includes(this.script.replace(/\\/g, '\\\\')) || codexMcp && codexToml.includes(this.script),
        detail: !codexExe && !codexToml ? 'Codex is not installed (optional)' : codexMcp ? `In ${this.codexConfigPath()}` : 'Not configured', na: !codexExe && !codexToml, fix: !!py },
      { id: 'statusline', title: 'Claude Code: quota and context tracking (status line)', ok: sl.includes('claude_statusline.py'),
        detail: sl.includes('claude_statusline.py') ? 'Enabled' : sl ? `You already have a status line (${sl}); enabling replaces it (a backup is kept).` : 'Off: Claude 5-hour and 7-day quota, context and cost will not be tracked',
        na: !claudeExe, fix: !!claudeExe && !!py },
    ];
    const cliOk = this.cliInstalled();
    items.push({ id: 'cli', title: 'agent-bus command for harnesses without MCP', ok: cliOk.ok, detail: cliOk.detail, fix: !!py });
    if (process.platform === 'win32') {
      const rule = await run('powershell.exe', ['-NoProfile', '-Command', "if (Get-NetFirewallRule -DisplayName 'Agent Bus hub' -ErrorAction SilentlyContinue) { 'yes' }"]);
      items.push({ id: 'firewall', title: 'Windows Firewall: allow VMs to reach the hub', ok: rule.out === 'yes',
        detail: rule.out === 'yes' ? `Inbound TCP ${this.hub.config.port} allowed from local subnets` : 'Needed for agents in VMs. Asks for administrator approval once.', fix: true });
      const lnk = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Agent Bus.lnk');
      items.push({ id: 'shortcuts', title: 'Start menu and desktop shortcuts', ok: fs.existsSync(lnk), detail: fs.existsSync(lnk) ? lnk : 'Not created', fix: true });
    }
    return items;
  }

  binDir() { return process.platform === 'win32' ? path.join(this.root, 'bin') : path.join(HOME, '.local', 'bin'); }
  cliInstalled() {
    const f = path.join(this.binDir(), process.platform === 'win32' ? 'agent-bus.cmd' : 'agent-bus');
    if (!fs.existsSync(f)) return { ok: false, detail: 'Not installed. Agents could then run: agent-bus msg inbox' };
    const onPath = (process.env.PATH || '').split(path.delimiter).some((d) => path.resolve(d || '.') === path.resolve(this.binDir()));
    const userPath = process.platform === 'win32' ? this.userPath() : '';
    const ok = onPath || userPath.split(';').some((d) => d && path.resolve(d) === path.resolve(this.binDir()));
    return { ok, detail: ok ? `${f} (on PATH for new terminals)` : `${f} exists, but ${this.binDir()} is not on PATH` };
  }
  userPath() {
    try {
      return execFileSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path','User')"], { windowsHide: true, encoding: 'utf8' }).trim();
    } catch { return ''; }
  }

  async fix(id, opts = {}) {
    const py = await this.findPython();
    if (id === 'cli') {
      const dir = this.binDir();
      fs.mkdirSync(dir, { recursive: true });
      if (process.platform === 'win32') {
        fs.writeFileSync(path.join(dir, 'agent-bus.cmd'), `@"${py}" "${this.script}" %*
`);
        const cur = this.userPath();
        if (!cur.split(';').some((d) => d && path.resolve(d) === path.resolve(dir))) {
          const next = cur ? `${cur.replace(/;$/, '')};${dir}` : dir;
          const r = await run('powershell.exe', ['-NoProfile', '-Command', `[Environment]::SetEnvironmentVariable('Path', '${next.replace(/'/g, "''")}', 'User')`]);
          if (!r.ok) throw new Error(r.err);
        }
      } else {
        fs.writeFileSync(path.join(dir, 'agent-bus'), `#!/bin/sh
exec "${py}" "${this.script}" "$@"
`, { mode: 0o755 });
      }
      return 'Installed. New terminals and agent sessions can run: agent-bus ?';
    }
    if (id === 'claudeMcp') {
      await run('claude', ['mcp', 'remove', 'agent-bus', '--scope', 'user'], { shell: process.platform === 'win32' });
      const r = await run('claude', ['mcp', 'add', 'agent-bus', '--scope', 'user', '--', py, this.script], { shell: process.platform === 'win32' });
      if (!r.ok) throw new Error(r.err || r.out);
      return 'Registered. Restart running Claude Code sessions (or use /mcp) to load it.';
    }
    if (id === 'codexMcp') {
      const p = this.codexConfigPath();
      fs.mkdirSync(path.dirname(p), { recursive: true });
      let toml = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      backup(p);
      // Drop an older agent_bus block (up to the next table header), then append the current one.
      toml = toml.replace(/\n?\[mcp_servers\.agent_bus(\.[^\]]*)?\][\s\S]*?(?=\n\[|$)/g, '');
      toml = `${toml.trimEnd()}\n\n[mcp_servers.agent_bus]\ncommand = '${py}'\nargs = ['${this.script}']\n`;
      fs.writeFileSync(p, toml);
      return 'Added. Restart Codex Desktop (or start a new thread / CLI session) to load it.';
    }
    if (id === 'statusline') {
      const p = this.claudeSettingsPath();
      const s = readJson(p) || {};
      backup(p);
      s.statusLine = { type: 'command', command: `"${py}" "${this.statusScript}"`, padding: 0 };
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(s, null, 2));
      return 'Enabled. Claude Code picks it up on its next status refresh.';
    }
    if (id === 'firewall') {
      const port = this.hub.config.port;
      const cmd = `New-NetFirewallRule -DisplayName 'Agent Bus hub' -Direction Inbound -Protocol TCP -LocalPort ${port} -RemoteAddress LocalSubnet -Action Allow -Profile Any | Out-Null`;
      const r = await run('powershell.exe', ['-NoProfile', '-Command',
        `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',"${cmd.replace(/"/g, '`"')}"`]);
      if (!r.ok) throw new Error(r.err || 'Administrator approval was declined');
      return 'Firewall rule added.';
    }
    if (id === 'shortcuts') {
      const r = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.root, 'install-shortcuts.ps1')]);
      if (!r.ok) throw new Error(r.err || r.out);
      return r.out;
    }
    throw new Error(`Nothing to fix for ${id}`);
  }
}

module.exports = { Setup, which, spawn };
