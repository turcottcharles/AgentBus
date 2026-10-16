'use strict';
// Agent Bus desktop app. Shows the shared bus.sqlite that agent_bus_mcp.py writes, lets the owner read
// everything and post as "owner", launches or resumes Claude Code / Codex CLI sessions, groups sessions into
// projects, tracks token, context and quota stats, and runs the hub that agents in local VMs connect to.
const { app, BrowserWindow, ipcMain, Menu, Notification, shell, dialog, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const SCHEMA = require('./schema');
const { Hub, MAX_FILE } = require('./hub');
const { discover } = require('./net');
const { Stats } = require('./stats');
const { Setup } = require('./setup');
const { Proposals } = require('./proposals');
const { Steward } = require('./steward');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.AGENT_BUS_DB || path.join(ROOT, 'bus.sqlite');
const OWNER = 'owner';
let db, win, hub, stats, setup, proposals, steward, lastSeenId = 0, net = { adapters: [], vmAdapters: [], listenOn: [], guests: [] };

const now = () => Date.now() / 1000;
const isWin = process.platform === 'win32';

// Every IPC handler goes through here so the steward can see which app features the owner uses (and which
// fail). Polling channels are left out; only the channel name, timing and any error are kept.
const QUIET = new Set(['bus:snapshot', 'bus:stats', 'net:info', 'setup:status', 'steward:state', 'proposal:list', 'proposal:get', 'profile:preview']);
function handle(channel, fn) {
  ipcMain.handle(channel, async (...args) => {
    const t0 = Date.now();
    try {
      const r = await fn(...args);
      if (!QUIET.has(channel)) steward?.event('ui', channel, true, Date.now() - t0);
      return r;
    } catch (e) {
      steward?.event('ui', channel, false, Date.now() - t0, e.message);
      throw e;
    }
  });
}

function openDb() {
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;' + SCHEMA);
  // Older databases made before agent_meta.addr existed.
  try { db.exec('ALTER TABLE agent_meta ADD COLUMN addr TEXT'); } catch {}
  db.prepare(`INSERT INTO agents(name,kind,note,cwd,last_seen) VALUES(?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET last_seen=excluded.last_seen`)
    .run(OWNER, 'human', 'Project owner (Agent Bus app)', '', now());
  lastSeenId = db.prepare('SELECT COALESCE(MAX(id),0) AS m FROM messages').get().m;
}

// ---------------------------------------------------------------- snapshot / messages

function sessionList() {
  const agents = db.prepare(`SELECT a.*, m.cli, m.session_id, m.effort, m.host, m.platform, m.remote, m.stats, m.addr
    FROM agents a LEFT JOIN agent_meta m ON m.name=a.name WHERE a.name<>?`).all(OWNER);
  const profiles = new Map(db.prepare('SELECT * FROM profiles').all().map((p) => [p.name, p]));
  const out = agents.map((a) => {
    const p = profiles.get(a.name);
    let remoteStats = null;
    try { remoteStats = a.stats ? JSON.parse(a.stats) : null; } catch {}
    return { name: a.name, cli: a.cli || p?.cli || (/codex/i.test(a.kind) ? 'codex' : 'claude'), cwd: a.cwd || p?.cwd,
      sessionId: a.session_id || (p?.mode === 'session' ? p.session : ''), remote: !!a.remote, remoteStats, host: a.host, effort: a.effort };
  });
  for (const p of profiles.values()) if (!out.some((s) => s.name === p.name)) {
    out.push({ name: p.name, cli: p.cli, cwd: p.cwd, sessionId: p.mode === 'session' ? p.session : '', remote: false });
  }
  return out;
}

handle('bus:snapshot', (_e, limit = 2000) => {
  db.prepare('UPDATE agents SET last_seen=? WHERE name=?').run(now(), OWNER);
  const agents = db.prepare(`SELECT a.name, a.kind, a.note, a.cwd, a.last_seen, m.remote, m.host, m.platform, m.addr, m.session_id, m.effort,
      (SELECT COUNT(*) FROM messages x WHERE (x.recipient=a.name OR (x.recipient='all' AND x.sender<>a.name))
        AND NOT EXISTS (SELECT 1 FROM reads r WHERE r.agent=a.name AND r.msg_id=x.id)) AS unread
    FROM agents a LEFT JOIN agent_meta m ON m.name=a.name ORDER BY a.last_seen DESC`).all();
  // Read receipts change over time, so the whole recent window is re-read each poll. The owner only reads
  // here: nothing is written to `reads`, so agents' unread state is untouched.
  const messages = db.prepare(`SELECT * FROM (SELECT id, ts, sender, recipient, body FROM messages ORDER BY id DESC LIMIT ?)
    ORDER BY id`).all(limit);
  const minId = messages.length ? messages[0].id : 0;
  const readers = db.prepare('SELECT msg_id, group_concat(agent) AS who FROM reads WHERE msg_id>=? GROUP BY msg_id').all(minId);
  const files = db.prepare('SELECT id, ts, sender, recipient, name, size, sha256 FROM files ORDER BY id DESC LIMIT 500').all();
  return {
    agents, messages, readers, files,
    total: db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,
    profiles: db.prepare('SELECT * FROM profiles').all(),
    projects: db.prepare('SELECT name, collapsed FROM projects ORDER BY name COLLATE NOCASE').all(),
    hub: { listening: hub.listening(), port: hub.config.port, guests: net.guests.length, errors: hub.errors },
    dbPath: DB_PATH, owner: OWNER, now: now(),
  };
});

handle('bus:stats', () => stats.collect(sessionList()));

handle('bus:send', (_e, { to, body }) => {
  body = String(body || '').trim();
  if (!body) throw new Error('Message is empty');
  if (to !== 'all' && !db.prepare('SELECT 1 FROM agents WHERE name=?').get(to)) throw new Error(`Unknown agent ${to}`);
  const r = db.prepare('INSERT INTO messages(ts,sender,recipient,body) VALUES(?,?,?,?)').run(now(), OWNER, to, body);
  return Number(r.lastInsertRowid);
});

// Forgetting removes the bus registration only; a saved launch profile (and its project) is kept.
handle('bus:forget', (_e, name) => {
  if (name === OWNER) return false;
  db.prepare('DELETE FROM agents WHERE name=?').run(name);
  db.prepare('DELETE FROM agent_meta WHERE name=?').run(name);
  return true;
});

handle('bus:openFolder', () => shell.openPath(ROOT));

// ---------------------------------------------------------------- files

handle('file:send', async (e, to) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: `Send a file to ${to}`, properties: ['openFile'] });
  if (r.canceled) return null;
  const file = r.filePaths[0];
  if (fs.statSync(file).size > MAX_FILE) throw new Error('Files are limited to 200 MB; zip or split it first');
  return hub.storeFile(OWNER, to, path.basename(file), fs.readFileSync(file), '');
});
handle('file:save', async (e, id) => {
  const row = db.prepare('SELECT name, path FROM files WHERE id=?').get(id);
  if (!row || !fs.existsSync(row.path)) throw new Error(`File #${id} is no longer in the store`);
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: row.name });
  if (r.canceled) return null;
  fs.copyFileSync(row.path, r.filePath);
  return r.filePath;
});
handle('file:reveal', (_e, id) => {
  const row = db.prepare('SELECT path FROM files WHERE id=?').get(id);
  if (row && fs.existsSync(row.path)) shell.showItemInFolder(row.path);
});

// ---------------------------------------------------------------- launch profiles and projects

const PROFILE_FIELDS = ['project', 'cli', 'cwd', 'mode', 'session', 'extra', 'prompt'];

handle('profile:save', (_e, p) => {
  const name = String(p.name || '').trim();
  if (!name || name === OWNER || name === 'all') throw new Error('Pick a session name other than "owner" or "all"');
  if (!['claude', 'codex'].includes(p.cli)) throw new Error('CLI must be claude or codex');
  if (p.cwd && !fs.existsSync(p.cwd)) throw new Error(`Folder does not exist: ${p.cwd}`);
  if (p.oldName && p.oldName !== name) db.prepare('DELETE FROM profiles WHERE name=?').run(p.oldName);
  db.prepare(`INSERT INTO profiles(name,${PROFILE_FIELDS}) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET ${PROFILE_FIELDS.map((f) => `${f}=excluded.${f}`)}`)
    .run(name, ...PROFILE_FIELDS.map((f) => (p[f] ?? '') === '' ? null : String(p[f])));
  if (p.project) db.prepare('INSERT OR IGNORE INTO projects(name) VALUES(?)').run(p.project);
  return name;
});

handle('profile:delete', (_e, name) => { db.prepare('DELETE FROM profiles WHERE name=?').run(name); return true; });

function ensureProfile(name) {
  if (db.prepare('SELECT 1 FROM profiles WHERE name=?').get(name)) return;
  const a = db.prepare('SELECT a.kind, a.cwd, m.cli, m.session_id FROM agents a LEFT JOIN agent_meta m ON m.name=a.name WHERE a.name=?').get(name) || {};
  const cli = a.cli || (/codex/i.test(a.kind || name) ? 'codex' : 'claude');
  db.prepare('INSERT INTO profiles(name,cli,cwd,mode,session) VALUES(?,?,?,?,?)')
    .run(name, cli, a.cwd || null, a.session_id ? 'session' : 'pick', a.session_id || null);
}

handle('project:assign', (_e, { name, project }) => {
  ensureProfile(name);
  if (project) db.prepare('INSERT OR IGNORE INTO projects(name) VALUES(?)').run(project);
  db.prepare('UPDATE profiles SET project=? WHERE name=?').run(project || null, name);
  return true;
});
handle('project:collapse', (_e, { project, collapsed }) => {
  db.prepare('UPDATE projects SET collapsed=? WHERE name=?').run(collapsed ? 1 : 0, project);
});
handle('project:rename', (_e, { from, to }) => {
  to = String(to || '').trim();
  if (!to) throw new Error('Project name is empty');
  db.prepare('INSERT OR IGNORE INTO projects(name) VALUES(?)').run(to);
  db.prepare('UPDATE profiles SET project=? WHERE project=?').run(to, from);
  db.prepare('DELETE FROM projects WHERE name=?').run(from);
});
handle('project:delete', (_e, project) => {
  db.prepare('UPDATE profiles SET project=NULL WHERE project=?').run(project);
  db.prepare('DELETE FROM projects WHERE name=?').run(project);
});

// Native right-click menus; they resolve with the chosen action so the renderer can open its own dialogs.
function popup(e, tmpl) {
  return new Promise((resolve) => {
    let picked = null;
    const wire = (items) => items.map((i) => ({ ...i, ...(i.pick ? { click: () => { picked = i.pick; } } : {}), ...(i.submenu ? { submenu: wire(i.submenu) } : {}), pick: undefined }));
    Menu.buildFromTemplate(wire(tmpl)).popup({ window: BrowserWindow.fromWebContents(e.sender), callback: () => setImmediate(() => resolve(picked)) });
  });
}
handle('menu:session', (e, { name, online, hasProfile, remote }) => {
  const projects = db.prepare('SELECT name FROM projects ORDER BY name COLLATE NOCASE').all().map((r) => r.name);
  const current = db.prepare('SELECT project FROM profiles WHERE name=?').get(name)?.project || null;
  return popup(e, [
    ...(remote ? [{ label: 'Runs in a VM (start it there)', enabled: false }]
      : [{ label: online ? 'Launch (already online)' : 'Launch session', enabled: !online, pick: { action: 'launch' } },
        { label: 'Launch settings…', pick: { action: 'edit' } }]),
    { label: 'Session stats…', pick: { action: 'stats' } },
    { label: 'Message this session', pick: { action: 'message' } },
    { label: 'Send a file…', pick: { action: 'sendFile' } },
    { type: 'separator' },
    { label: 'Add to project', submenu: [
      ...projects.map((p) => ({ label: p, type: 'radio', checked: p === current, pick: { action: 'assign', project: p } })),
      ...(projects.length ? [{ type: 'separator' }] : []),
      { label: 'New project…', pick: { action: 'newProject' } },
    ] },
    { label: 'Remove from project', enabled: !!current, pick: { action: 'assign', project: null } },
    { type: 'separator' },
    { label: 'Forget bus registration', pick: { action: 'forget' } },
    { label: 'Delete launch profile', enabled: hasProfile, pick: { action: 'deleteProfile' } },
  ]);
});
handle('menu:project', (e) => popup(e, [
  { label: 'Launch all offline sessions', pick: { action: 'launchAll' } },
  { label: 'Message the whole project', pick: { action: 'message' } },
  { type: 'separator' },
  { label: 'Rename project…', pick: { action: 'rename' } },
  { label: 'Delete project (keeps its sessions)', pick: { action: 'delete' } },
]));

// ---------------------------------------------------------------- launching CLI sessions

function defaultPrompt(name) {
  return `You were launched from the Agent Bus app as "${name}" and are registered on the agent bus under that name. `
    + 'Call bus_inbox to read any waiting messages and reply with bus_send.';
}
// Argument list for the CLI; the session name reaches the bus server through AGENT_BUS_NAME.
function cliArgs(p) {
  const prompt = (p.prompt || defaultPrompt(p.name)).replace(/"/g, "'");
  const extra = (p.extra || '').trim().split(/\s+/).filter(Boolean);
  if (p.cli === 'codex') {
    // Codex starts MCP servers with a filtered environment, so the name also goes in as a config override.
    const env = ['-c', `mcp_servers.agent_bus.env.AGENT_BUS_NAME='${p.name}'`, '-c', "mcp_servers.agent_bus.env.AGENT_BUS_KIND='codex-cli'"];
    if (p.mode === 'session' && p.session) return ['codex', 'resume', ...env, ...extra, p.session, prompt];
    if (p.mode === 'continue') return ['codex', 'resume', ...env, ...extra, '--last', prompt];
    if (p.mode === 'pick') return ['codex', 'resume', ...env, ...extra];
    return ['codex', ...env, ...extra, prompt];
  }
  if (p.mode === 'session' && p.session) return ['claude', '--resume', p.session, ...extra, prompt];
  if (p.mode === 'continue') return ['claude', '--continue', ...extra, prompt];
  if (p.mode === 'pick') return ['claude', '--resume', ...extra];
  return ['claude', ...extra, prompt];
}
// One argument on a line of a .cmd file: inside double quotes only % is special to cmd.
const cmdQuote = (s) => /^[\w@+=:,./\\-]+$/.test(s) ? s : `"${String(s).replace(/%/g, '%%')}"`;
const shQuote = (s) => /^[\w@+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
const commandLine = (p) => (isWin ? cliArgs(p).map(cmdQuote) : cliArgs(p).map(shQuote)).join(' ');

handle('profile:preview', (_e, p) => commandLine(p));

function launchSession(name) {
  ensureProfile(name);
  const p = db.prepare('SELECT * FROM profiles WHERE name=?').get(name);
  const home = app.getPath('home');
  const cwd = p.cwd && fs.existsSync(p.cwd) ? p.cwd : home;
  const kind = p.cli === 'codex' ? 'codex-cli' : 'claude-code';
  const line = commandLine(p);
  // Registering now lets the session be messaged right away; its own MCP server then keeps it online
  // with a heartbeat for as long as it runs.
  db.prepare(`INSERT INTO agents(name,kind,note,cwd,last_seen) VALUES(?,?,?,?,NULL)
    ON CONFLICT(name) DO UPDATE SET cwd=excluded.cwd`).run(name, kind, `launched from Agent Bus (${p.cli})`, cwd);
  const env = { ...process.env, AGENT_BUS_NAME: name, AGENT_BUS_KIND: kind };
  delete env.ELECTRON_RUN_AS_NODE;
  const dir = path.join(app.getPath('userData'), 'launch');
  fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^\w.-]/g, '_');
  if (isWin) {
    // A generated .cmd file keeps wt.exe/start from re-quoting anything. The env vars are set inside it as
    // well, because a Windows Terminal tab may be hosted by an already-running terminal that lacks ours.
    const file = path.join(dir, `${safe}.cmd`);
    fs.writeFileSync(file, ['@echo off', `title ${name.replace(/[&|<>^%]/g, '')}`, `cd /d "${cwd}"`,
      `set "AGENT_BUS_NAME=${name.replace(/[%"]/g, '')}"`, `set "AGENT_BUS_KIND=${kind}"`,
      `echo [Agent Bus] starting ${p.cli} session ${name.replace(/[&|<>^%"]/g, '')}`, line, ''].join('\r\n'));
    const wt = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe');
    const child = fs.existsSync(wt)
      ? spawn(wt, ['-w', 'agent-bus', 'new-tab', '--title', name, '--suppressApplicationTitle', '-d', cwd, 'cmd.exe', '/k', file], { cwd, env, detached: true, stdio: 'ignore' })
      : spawn('cmd.exe', ['/k', file], { cwd, env, detached: true, stdio: 'ignore' });
    child.unref();
  } else {
    const file = path.join(dir, `${safe}.sh`);
    fs.writeFileSync(file, `#!/bin/sh\ncd ${shQuote(cwd)}\nexport AGENT_BUS_NAME=${shQuote(name)} AGENT_BUS_KIND=${kind}\nprintf '\\033]0;%s\\007' ${shQuote(name)}\nexec ${line}\n`, { mode: 0o755 });
    const child = process.platform === 'darwin'
      ? spawn('osascript', ['-e', `tell application "Terminal" to do script "${file.replace(/(["\\])/g, '\\$1')}"`, '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' })
      : spawn('x-terminal-emulator', ['-e', file], { cwd, env, detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  }
  db.prepare('UPDATE profiles SET last_launch=? WHERE name=?').run(now(), name);
  return line;
}
handle('session:launch', (_e, name) => launchSession(name));

handle('dialog:pickFolder', async (e, start) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openDirectory'], defaultPath: start || undefined });
  return r.canceled ? null : r.filePaths[0];
});

// ---------------------------------------------------------------- network hub / VMs / setup

async function refreshNetwork(force = false) {
  const prev = net.listenOn.join(',');
  net = await discover({ lan: !!hub.config.lan });
  if (force || prev !== net.listenOn.join(',') || hub.listening().length === 0) await hub.listen(net.listenOn);
}

handle('net:info', async () => {
  await refreshNetwork();
  const listening = hub.listening();
  const urls = listening.filter((a) => a !== '127.0.0.1').map((a) => {
    const ad = net.adapters.find((x) => x.address === a);
    return { url: `http://${a}:${hub.config.port}`, adapter: ad?.name || a, vm: ad?.vm || (ad?.lan ? 'LAN' : '') };
  });
  const remote = db.prepare(`SELECT a.name, a.last_seen, m.host, m.platform, m.addr FROM agents a JOIN agent_meta m ON m.name=a.name
    WHERE m.remote=1 ORDER BY a.last_seen DESC`).all();
  return { port: hub.config.port, token: hub.config.token, lan: hub.config.lan, enabled: hub.config.enabled, urls, errors: hub.errors,
    vmAdapters: net.vmAdapters, guests: net.guests, remote, now: now() };
});
handle('net:set', async (_e, patch) => {
  const p = {};
  if ('lan' in patch) p.lan = !!patch.lan;
  if ('enabled' in patch) p.enabled = !!patch.enabled;
  if (patch.port) { const n = Number(patch.port); if (!(n > 1024 && n < 65536)) throw new Error('Port must be 1025-65535'); p.port = n; }
  if (patch.newToken) p.token = crypto.randomBytes(24).toString('hex');
  hub.saveConfig(p);
  await refreshNetwork(true);
  return true;
});
handle('clipboard:write', (_e, text) => clipboard.writeText(String(text)));

handle('setup:status', () => setup.status());
handle('setup:fix', (_e, id) => setup.fix(id));

// ---------------------------------------------------------------- steward and improvement proposals

handle('steward:state', () => steward.state());
handle('steward:config', (_e, patch) => {
  const allowed = ['enabled', 'vendor', 'flags', 'cadenceHours', 'includeText', 'builder', 'builderFlags'];
  return steward.saveConfig(Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.includes(k))));
});
handle('steward:digest', () => steward.digest());
handle('steward:run', () => steward.run('on-demand'));
handle('steward:openRuns', () => shell.openPath(steward.runsDir));
handle('proposal:list', () => proposals.list(null, 200).map((p) => ({ ...p,
  notes: db.prepare('SELECT COUNT(*) AS n FROM proposal_notes WHERE proposal_id=?').get(p.id).n })));
handle('proposal:get', (_e, id) => ({ ...proposals.row(id), notes: proposals.notes(id) }));
handle('proposal:new', (_e, { title, body }) => proposals.propose(OWNER, title, body));
handle('proposal:note', (_e, { id, body, ask }) => {
  proposals.note(OWNER, id, body);
  const p = proposals.row(id);
  if (ask) {
    if (p.status === 'proposed') proposals.setStatus(OWNER, id, 'refining', null, { owner: true });
    steward.run('owner reply', p.id);
  }
  return true;
});
handle('proposal:status', (_e, { id, status, note }) => { proposals.setStatus(OWNER, id, status, note, { owner: true }); return true; });
handle('proposal:build', (_e, { id, vendor }) => steward.build(id, vendor || steward.config.builder));
handle('proposal:diff', (_e, id) => steward.diff(id));
handle('proposal:discard', (_e, id) => { steward.discard(id); return true; });
handle('proposal:merge', (_e, id) => {
  steward.merge(id);
  setTimeout(() => { app.relaunch(); app.exit(0); }, 800);   // restart on the merged code
  return true;
});

function launchBuilder({ name, cli, cwd, prompt, extra }) {
  db.prepare('INSERT OR IGNORE INTO projects(name) VALUES(?)').run('Agent Bus builds');
  db.prepare(`INSERT INTO profiles(name,project,cli,cwd,mode,session,extra,prompt) VALUES(?,?,?,?,'new',NULL,?,?)
    ON CONFLICT(name) DO UPDATE SET cli=excluded.cli, cwd=excluded.cwd, mode='new', extra=excluded.extra, prompt=excluded.prompt`)
    .run(name, 'Agent Bus builds', cli, cwd, extra || null, prompt);
  return launchSession(name);
}

// ---------------------------------------------------------------- notifications and window

function pollForOwnerMail() {
  const rows = db.prepare(`SELECT id, sender, body FROM messages WHERE id>? AND sender<>? AND recipient IN (?, 'all') ORDER BY id`)
    .all(lastSeenId, OWNER, OWNER);
  for (const m of rows) {
    if (win && win.isFocused()) continue;
    const n = new Notification({ title: `Agent Bus: ${m.sender}`, body: m.body.slice(0, 240) });
    n.on('click', () => { win.show(); win.focus(); });
    n.show();
  }
  lastSeenId = Math.max(lastSeenId, db.prepare('SELECT COALESCE(MAX(id),0) AS m FROM messages').get().m);
}

function createWindow() {
  const icon = path.join(__dirname, 'icon.ico');
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 900, minHeight: 540,
    title: 'Agent Bus', backgroundColor: '#02060b', autoHideMenuBar: true,
    ...(fs.existsSync(icon) ? { icon } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // Links in messages open in the system browser rather than inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.setAppUserModelId('local.agent-bus');
  app.whenReady().then(async () => {
    openDb();
    hub = new Hub({ db, root: ROOT, configPath: path.join(path.dirname(DB_PATH), 'hub.json') });
    stats = new Stats(db);
    setup = new Setup(ROOT, hub);
    proposals = new Proposals(db, (t) => hub.ago(t));
    steward = new Steward({ db, root: ROOT, dataDir: path.dirname(DB_PATH), proposals, launchBuilder });
    createWindow();
    await refreshNetwork(true).catch(() => {});
    setInterval(pollForOwnerMail, 3000);
    setInterval(() => refreshNetwork().catch(() => {}), 30000);  // VMs that start later get picked up
    // The digest and stats snapshots are plain SQL and cost no quota; the steward itself only runs when enabled
    // (on its cadence) or when the owner asks it something.
    const hourly = async () => {
      try { steward.snapshotStats(await stats.collect(sessionList())); } catch {}
      try { steward.digest(); } catch {}
    };
    setTimeout(hourly, 60000);
    setInterval(hourly, 3600000);
    setInterval(() => steward.tick(), 600000);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { hub?.close(); });
}
