'use strict';
// The network hub: lets agents in local VMs (or, if enabled, other machines on the LAN) use the bus.
// It listens only on virtual-machine adapters (plus loopback) unless LAN access is switched on, and every
// request except /health needs the bearer token. It speaks the same tools as agent_bus_mcp.py.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_FILE = 200 * 1024 * 1024;
const PORT_DEFAULT = 47800;

class Hub {
  constructor({ db, root, configPath, onChange }) {
    this.db = db; this.root = root; this.configPath = configPath; this.onChange = onChange || (() => {});
    this.filesDir = path.join(root, 'files');
    this.servers = []; this.errors = [];
    this.config = this.loadConfig();
  }

  loadConfig() {
    let c = {};
    try { c = JSON.parse(fs.readFileSync(this.configPath, 'utf8')); } catch {}
    c.port ||= PORT_DEFAULT;
    c.token ||= crypto.randomBytes(24).toString('hex');
    c.lan ??= false;
    c.enabled ??= true;
    fs.writeFileSync(this.configPath, JSON.stringify(c, null, 2));
    return c;
  }
  saveConfig(patch) {
    Object.assign(this.config, patch);
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  // (Re)bind to the given addresses. Returns what is actually listening.
  async listen(addresses) {
    await this.close();
    this.errors = [];
    if (!this.config.enabled) return [];
    const uniq = [...new Set(['127.0.0.1', ...addresses])];
    await Promise.all(uniq.map((addr) => new Promise((resolve) => {
      const s = http.createServer((req, res) => this.handle(req, res).catch((e) => this.fail(res, 500, e.message)));
      s.requestTimeout = 0; s.headersTimeout = 30000; s.keepAliveTimeout = 5000;
      s.once('error', (e) => { this.errors.push(`${addr}: ${e.code || e.message}`); resolve(); });
      s.listen(this.config.port, addr, () => { this.servers.push({ addr, server: s }); resolve(); });
    })));
    return this.listening();
  }
  listening() { return this.servers.map((s) => s.addr); }
  close() {
    const all = this.servers.splice(0);
    return Promise.all(all.map(({ server }) => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); })));
  }

  fail(res, code, msg) {
    if (res.headersSent) return res.destroy();
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(msg));
  }
  json(res, obj) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  }
  authed(req, url) {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t') || '';
    const a = Buffer.from(t), b = Buffer.from(this.config.token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error(`Body over ${limit} bytes`)); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  baseUrl(req) {
    const host = req.socket.localAddress.replace(/^::ffff:/, '');
    return `http://${host.includes(':') ? `[${host}]` : host}:${this.config.port}`;
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const peer = req.socket.remoteAddress.replace(/^::ffff:/, '');
    if (p === '/health') return this.json(res, { ok: true, service: 'agent-bus', version: '1.1' });
    if (!this.authed(req, url)) return this.fail(res, 401, 'Missing or wrong Agent Bus token');

    if (p === '/agent_bus_mcp.py') {
      res.writeHead(200, { 'Content-Type': 'text/x-python; charset=utf-8' });
      return fs.createReadStream(path.join(this.root, 'agent_bus_mcp.py')).pipe(res);
    }
    if (p === '/setup.sh') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(this.setupSh(this.baseUrl(req))); }
    if (p === '/setup.ps1') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(this.setupPs1(this.baseUrl(req))); }

    if (p === '/rpc' && req.method === 'POST') {
      const { tool, args = {}, as, meta = {} } = JSON.parse((await this.readBody(req, 4 << 20)).toString('utf8'));
      const text = await this.tool(tool, { ...args, as: args.as || as }, meta, peer);
      this.onChange();
      return this.json(res, { text });
    }
    if (p === '/heartbeat' && req.method === 'POST') {
      const { as, meta = {}, stats } = JSON.parse((await this.readBody(req, 4 << 20)).toString('utf8'));
      if (as && this.db.prepare('SELECT 1 FROM agents WHERE name=?').get(as)) {
        this.touch(as);
        this.saveMeta(as, meta, peer, stats ? JSON.stringify(stats) : null);
      }
      return this.json(res, { ok: true });
    }
    if (p === '/files' && req.method === 'POST') {
      const to = (url.searchParams.get('to') || '').trim(), as = url.searchParams.get('as') || '';
      const data = await this.readBody(req, MAX_FILE);
      const r = this.storeFile(as, to, url.searchParams.get('name') || 'file', data, url.searchParams.get('note') || '');
      this.onChange();
      return this.json(res, r);
    }
    const m = p.match(/^\/files\/(\d+)$/);
    if (m && req.method === 'GET') {
      const row = this.db.prepare('SELECT name, path, size, sha256 FROM files WHERE id=?').get(Number(m[1]));
      if (!row || !fs.existsSync(row.path)) return this.fail(res, 404, `No file #${m[1]} on the bus`);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': row.size,
        'X-File-Name': encodeURIComponent(row.name), 'X-File-Sha256': row.sha256 });
      return fs.createReadStream(row.path).pipe(res);
    }
    return this.fail(res, 404, 'Unknown endpoint');
  }

  // ---- bus operations (mirror agent_bus_mcp.py) ----
  now() { return Date.now() / 1000; }
  touch(name) { if (name) this.db.prepare('UPDATE agents SET last_seen=? WHERE name=?').run(this.now(), name); }
  saveMeta(name, meta, addr, stats = null) {
    this.db.prepare(`INSERT INTO agent_meta(name,cli,session_id,effort,pid,host,platform,remote,updated,stats,addr)
      VALUES(?,?,?,?,?,?,?,1,?,?,?) ON CONFLICT(name) DO UPDATE SET cli=excluded.cli,
      session_id=COALESCE(NULLIF(excluded.session_id,''),agent_meta.session_id), effort=excluded.effort, pid=excluded.pid,
      host=excluded.host, platform=excluded.platform, remote=1, updated=excluded.updated,
      stats=COALESCE(excluded.stats,agent_meta.stats), addr=excluded.addr`)
      .run(name, meta.cli || '', meta.session_id || '', meta.effort || '', meta.pid || '', meta.host || '',
        meta.platform || '', this.now(), stats, addr);
  }
  need(a) { if (!a.as) throw new Error("Not registered. Call bus_register first (or pass 'as')."); return a.as; }
  exists(name) { return !!this.db.prepare('SELECT 1 FROM agents WHERE name=?').get(name); }
  deliver(sender, to, body) {
    if (to !== 'all' && !this.exists(to)) throw new Error(`Unknown agent '${to}'. Use bus_list to see registered names.`);
    const r = this.db.prepare('INSERT INTO messages(ts,sender,recipient,body) VALUES(?,?,?,?)').run(this.now(), sender, to, body);
    this.touch(sender);
    return Number(r.lastInsertRowid);
  }
  ago(t) {
    const s = Math.floor(this.now() - (t || 0));
    return s < 120 ? `${s}s ago` : s < 7200 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
  }
  inboxText(name) {
    const rows = this.db.prepare(`SELECT id,ts,sender,recipient,body FROM messages m WHERE (recipient=? OR (recipient='all' AND sender<>?))
      AND NOT EXISTS (SELECT 1 FROM reads r WHERE r.agent=? AND r.msg_id=m.id) ORDER BY id`).all(name, name, name);
    this.touch(name);
    if (!rows.length) return '';
    const ins = this.db.prepare('INSERT OR IGNORE INTO reads VALUES(?,?)');
    for (const r of rows) ins.run(name, r.id);
    return rows.map((r) => `#${r.id} from ${r.sender}${r.recipient === 'all' ? ' (broadcast)' : ''}, ${this.ago(r.ts)}:\n${r.body}`).join('\n\n');
  }
  storeFile(sender, to, name, data, note) {
    if (!sender || !this.exists(sender)) throw new Error("Not registered. Call bus_register first (or pass 'as').");
    if (to !== 'all' && !this.exists(to)) throw new Error(`Unknown agent '${to}'. Use bus_list to see registered names.`);
    name = path.basename(String(name).replace(/\\/g, '/')) || 'file';
    const digest = crypto.createHash('sha256').update(data).digest('hex');
    const fid = Number(this.db.prepare("INSERT INTO files(ts,sender,recipient,name,size,sha256,path) VALUES(?,?,?,?,?,?,'')")
      .run(this.now(), sender, to, name, data.length, digest).lastInsertRowid);
    const dir = path.join(this.filesDir, String(fid));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, data);
    this.db.prepare('UPDATE files SET path=? WHERE id=?').run(file, fid);
    const body = `[file #${fid}] ${name} (${data.length.toLocaleString('en-US')} bytes, sha256 ${digest.slice(0, 12)}...)`
      + (note ? `\n${note}` : '') + `\nFetch it with bus_get_file(file_id=${fid}).`;
    return { file_id: fid, message_id: this.deliver(sender, to, body) };
  }

  async tool(tool, a, meta, peer) {
    switch (tool) {
      case 'bus_register': {
        const name = String(a.name || '').trim();
        if (!name || name === 'all' || name === 'owner') throw new Error("Pick a name other than 'all' or 'owner'.");
        this.db.prepare(`INSERT INTO agents(name,kind,note,cwd,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET
          kind=excluded.kind, note=excluded.note, cwd=excluded.cwd, last_seen=excluded.last_seen`)
          .run(name, a.kind || '', a.note || '', meta.cwd || '', this.now());
        this.saveMeta(name, meta, peer);
        return `Registered as '${name}' (via the hub from ${meta.host || peer}). Others reach you with bus_send(to='${name}').`;
      }
      case 'bus_list': {
        this.touch(a.as);
        const rows = this.db.prepare(`SELECT a.name,a.kind,a.note,a.cwd,a.last_seen,m.host,m.remote FROM agents a
          LEFT JOIN agent_meta m ON m.name=a.name ORDER BY a.last_seen DESC`).all();
        return rows.map((r) => `- ${r.name} [${r.kind}] seen ${this.ago(r.last_seen)} | ${r.note} | ${r.cwd}${r.remote ? ` | on ${r.host} (VM/remote)` : ''}`).join('\n')
          || 'No agents registered yet.';
      }
      case 'bus_send': {
        const from = this.need(a);
        return `Sent message #${this.deliver(from, String(a.to).trim(), a.body)} to ${String(a.to).trim()}.`;
      }
      case 'bus_inbox': {
        const name = this.need(a);
        const deadline = Date.now() + Math.min(Math.max(Number(a.wait_seconds) || 0, 0), 300) * 1000;
        for (;;) {
          const t = this.inboxText(name);
          if (t) return t;
          if (Date.now() >= deadline) return 'No new messages.';
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      case 'bus_history': {
        const name = this.need(a), lim = Number(a.limit) || 20;
        const rows = a.with
          ? this.db.prepare('SELECT id,ts,sender,recipient,body FROM messages WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?)) ORDER BY id DESC LIMIT ?').all(name, a.with, a.with, name, lim)
          : this.db.prepare("SELECT id,ts,sender,recipient,body FROM messages WHERE (sender=? OR recipient=? OR recipient='all') ORDER BY id DESC LIMIT ?").all(name, name, lim);
        return rows.reverse().map((r) => `#${r.id} ${r.sender} -> ${r.recipient}, ${this.ago(r.ts)}:\n${r.body}`).join('\n\n') || 'No messages.';
      }
      case 'bus_files': {
        const name = this.need(a);
        const rows = this.db.prepare("SELECT id,ts,sender,recipient,name,size FROM files WHERE sender=? OR recipient IN (?, 'all') ORDER BY id DESC LIMIT ?")
          .all(name, name, Number(a.limit) || 20);
        return rows.map((r) => `#${r.id} ${r.name} (${r.size.toLocaleString('en-US')} bytes) ${r.sender} -> ${r.recipient}, ${this.ago(r.ts)}`).join('\n') || 'No files.';
      }
      default: throw new Error(`Unknown tool ${tool}`);
    }
  }

  // ---- guest setup scripts (served to VMs; they embed the URL the guest reached us on) ----
  setupSh(base) {
    const t = this.config.token;
    return `#!/bin/sh
# Agent Bus guest setup: installs the bus MCP server for Codex and Claude Code on this machine and
# points it at the Agent Bus hub at ${base}. Safe to re-run.
set -e
PY=$(command -v python3 || command -v python || true)
[ -n "$PY" ] || { echo "Agent Bus needs Python 3 (on macOS: xcode-select --install)"; exit 1; }
D="$HOME/.agent-bus"; mkdir -p "$D"; chmod 700 "$D"
curl -fsS -H "Authorization: Bearer ${t}" "${base}/agent_bus_mcp.py" -o "$D/agent_bus_mcp.py"
umask 077; printf '{"url": "%s", "token": "%s"}\\n' "${base}" "${t}" > "$D/config.json"; umask 022
mkdir -p "$HOME/.local/bin"
printf '#!/bin/sh\\nexec "%s" "%s" "$@"\\n' "$PY" "$D/agent_bus_mcp.py" > "$HOME/.local/bin/agent-bus"; chmod 755 "$HOME/.local/bin/agent-bus"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "Note: add ~/.local/bin to PATH to use the agent-bus command";; esac
CFG="$HOME/.codex/config.toml"
if [ -d "$HOME/.codex" ] || command -v codex >/dev/null 2>&1; then
  mkdir -p "$HOME/.codex"; touch "$CFG"
  if grep -q '^\\[mcp_servers.agent_bus\\]' "$CFG"; then echo "Codex: agent_bus already configured";
  else cp "$CFG" "$CFG.bak-agentbus" 2>/dev/null || true
    printf '\\n[mcp_servers.agent_bus]\\ncommand = "%s"\\nargs = ["%s"]\\n' "$PY" "$D/agent_bus_mcp.py" >> "$CFG"
    echo "Codex: added [mcp_servers.agent_bus] to $CFG"; fi
fi
if command -v claude >/dev/null 2>&1; then
  claude mcp add agent-bus --scope user -- "$PY" "$D/agent_bus_mcp.py" 2>/dev/null && echo "Claude Code: registered agent-bus" || echo "Claude Code: agent-bus already registered"
fi
"$PY" - <<EOF
import json, urllib.request
r = urllib.request.Request("${base}/health"); print("Hub:", json.load(urllib.request.urlopen(r, timeout=5)))
EOF
echo "Done. Restart Codex / Claude Code (or open a new thread) so they load the agent-bus tools."
`;
  }
  setupPs1(base) {
    const t = this.config.token;
    return `# Agent Bus guest setup for Windows guests: points the bus MCP server at ${base}. Safe to re-run.
$ErrorActionPreference = 'Stop'
$py = (Get-Command py -ErrorAction SilentlyContinue)
$pyExe = if ($py) { & py -3 -c "import sys;print(sys.executable)" } else { (Get-Command python -ErrorAction Stop).Source }
$d = Join-Path $HOME '.agent-bus'; New-Item -ItemType Directory -Force $d | Out-Null
Invoke-WebRequest -UseBasicParsing -Headers @{ Authorization = 'Bearer ${t}' } '${base}/agent_bus_mcp.py' -OutFile (Join-Path $d 'agent_bus_mcp.py')
@{ url = '${base}'; token = '${t}' } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $d 'config.json')
$script = Join-Path $d 'agent_bus_mcp.py'
Set-Content -Encoding ascii (Join-Path $d 'agent-bus.cmd') "@\"$pyExe\" \"$script\" %*"
$up = [Environment]::GetEnvironmentVariable('Path','User'); if (($up -split ';') -notcontains $d) { [Environment]::SetEnvironmentVariable('Path', ($up.TrimEnd(';') + ';' + $d), 'User') }
$cfg = Join-Path $HOME '.codex\\config.toml'
if ((Test-Path (Split-Path $cfg)) -or (Get-Command codex -ErrorAction SilentlyContinue)) {
  New-Item -ItemType Directory -Force (Split-Path $cfg) | Out-Null
  if (-not (Test-Path $cfg)) { New-Item -ItemType File $cfg | Out-Null }
  if (Select-String -Path $cfg -Pattern '^\\[mcp_servers.agent_bus\\]' -Quiet) { 'Codex: agent_bus already configured' }
  else { Copy-Item $cfg "$cfg.bak-agentbus"; Add-Content -Encoding utf8 $cfg "\`n[mcp_servers.agent_bus]\`ncommand = '$pyExe'\`nargs = ['$script']\`n"; "Codex: added agent_bus" }
}
if (Get-Command claude -ErrorAction SilentlyContinue) { claude mcp add agent-bus --scope user -- $pyExe $script }
Invoke-RestMethod '${base}/health'
'Done. Restart Codex / Claude Code (or open a new thread) so they load the agent-bus tools.'
`;
  }
}

module.exports = { Hub, MAX_FILE };
