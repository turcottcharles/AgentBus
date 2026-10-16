'use strict';
// The steward: an optional agent that studies how everyone uses the bus and proposes improvements to Agent Bus
// itself. This file builds the usage digest it works from (no quota: plain SQL), runs the steward headless in
// Claude Code or Codex when it's enabled or the owner asks it something, and manages the build loop for
// approved proposals: a git worktree and branch per proposal, a builder session in a terminal, then review,
// merge or discard.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile, execFileSync } = require('node:child_process');

const DAY = 86400;
const DEFAULTS = { enabled: false, vendor: 'claude', flags: '', cadenceHours: 24, includeText: false, builder: 'claude',
  builderFlags: '', lastRun: 0, sessions: {} };
const isWin = process.platform === 'win32';

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=Agent Bus', '-c', 'user.email=agent-bus@localhost', ...args],
    { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim();
}
const gitErr = (e) => String(e.stderr || e.message || e).trim().split(/\r?\n/).slice(-3).join(' ');

class Steward {
  constructor({ db, root, dataDir, proposals, onChange, launchBuilder }) {
    Object.assign(this, { db, root, proposals, onChange: onChange || (() => {}), launchBuilder });
    this.dir = path.join(dataDir, 'steward');
    this.runsDir = path.join(this.dir, 'runs');
    this.digestPath = path.join(this.dir, 'digest.md');
    this.configPath = path.join(this.dir, 'config.json');
    fs.mkdirSync(this.runsDir, { recursive: true });
    this.running = null;   // { reason, started, pid }
    this.lastError = '';
    this.gitOk = null;
    this.checkGit();
  }
  // Polled by the UI, so never run git synchronously for it: that blocks the app's main thread.
  checkGit() {
    execFile('git', ['rev-parse', '--git-dir'], { cwd: this.root, windowsHide: true, timeout: 20000 }, (err) => { this.gitOk = !err; });
  }
  now() { return Date.now() / 1000; }

  get config() {
    try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.configPath, 'utf8')) }; } catch { return { ...DEFAULTS }; }
  }
  saveConfig(patch) {
    const c = { ...this.config, ...patch };
    if (!['claude', 'codex'].includes(c.vendor) || !['claude', 'codex'].includes(c.builder)) throw new Error('Vendor must be claude or codex');
    c.cadenceHours = Math.max(1, Number(c.cadenceHours) || 24);
    fs.writeFileSync(this.configPath, JSON.stringify(c, null, 1));
    return c;
  }

  // ------------------------------------------------------------ telemetry the digest reads
  event(kind, name, ok = true, ms = 0, detail = '') {
    try {
      this.db.prepare('INSERT INTO events(ts,agent,kind,name,ok,ms,detail) VALUES(?,?,?,?,?,?,?)')
        .run(this.now(), 'owner', kind, name, ok ? 1 : 0, ms, String(detail).slice(0, 2000));
    } catch {}
  }
  // A periodic snapshot of token and quota totals, so the digest can show trends.
  snapshotStats(collected) {
    const sessions = Object.entries(collected?.sessions || {}).map(([name, s]) => ({ name, tokens: s?.tokens?.total ?? null }));
    const accounts = (collected?.accounts || []).map((a) => ({ account: `${a.cli} ${a.label || ''}`.trim(),
      left: Object.fromEntries((a.windows || []).filter((w) => w.used != null).map((w) => [w.name, Math.round(100 - w.used)])) }));
    this.event('stats', 'snapshot', true, 0, JSON.stringify({ sessions, accounts }));
  }

  // ------------------------------------------------------------ the usage digest (markdown, no quota cost)
  digest() {
    const t = this.now(), wk = t - 7 * DAY, d1 = t - DAY;
    const q = (sql, ...p) => this.db.prepare(sql).all(...p);
    const one = (sql, ...p) => this.db.prepare(sql).get(...p);
    const L = [`# Agent Bus usage digest`, `Generated ${new Date().toISOString()} for the last 7 days (last 24 h in brackets).`, ''];
    const agents = q('SELECT name, kind, last_seen FROM agents WHERE name<>? ORDER BY last_seen DESC', 'owner');
    L.push(`## Agents`, `${agents.length} registered, ${agents.filter((a) => t - (a.last_seen || 0) < 120).length} online now.`, '');

    L.push('## Messages by sender', '| sender | sent 7d | [24h] | to all | avg length |', '|---|---|---|---|---|');
    for (const r of q(`SELECT sender, COUNT(*) n, SUM(ts>?) d, SUM(recipient='all') b, AVG(LENGTH(body)) len FROM messages
        WHERE ts>? GROUP BY sender ORDER BY n DESC LIMIT 25`, d1, wk)) L.push(`| ${r.sender} | ${r.n} | ${r.d} | ${r.b} | ${Math.round(r.len)} |`);
    L.push('');
    const backlog = q(`SELECT a.name, (SELECT COUNT(*) FROM messages x WHERE (x.recipient=a.name OR (x.recipient='all' AND x.sender<>a.name))
        AND NOT EXISTS (SELECT 1 FROM reads r WHERE r.agent=a.name AND r.msg_id=x.id)) unread,
        (SELECT MIN(ts) FROM messages x WHERE x.recipient=a.name AND NOT EXISTS (SELECT 1 FROM reads r WHERE r.agent=a.name AND r.msg_id=x.id)) oldest
        FROM agents a WHERE a.name<>'owner'`).filter((r) => r.unread > 0).sort((a, b) => b.unread - a.unread);
    L.push('## Unread backlog', backlog.length ? backlog.slice(0, 20).map((r) => `- ${r.name}: ${r.unread} unread${r.oldest ? `, oldest direct ${Math.round((t - r.oldest) / 3600)} h old` : ''}`).join('\n') : 'None.', '');

    const tools = q(`SELECT kind, name, COUNT(*) n, SUM(ts>?) d, SUM(ok=0) bad, AVG(ms) ms FROM events
        WHERE ts>? AND kind IN ('mcp','cli','hub') GROUP BY kind, name ORDER BY n DESC`, d1, wk);
    L.push('## Tool use (agents)', '| via | tool | calls 7d | [24h] | errors | avg ms |', '|---|---|---|---|---|---|');
    for (const r of tools) L.push(`| ${r.kind} | ${r.name} | ${r.n} | ${r.d} | ${r.bad} | ${Math.round(r.ms)} |`);
    if (!tools.length) L.push('| – | (no tool calls logged yet) | | | | |');
    const inbox = q(`SELECT detail FROM events WHERE ts>? AND name='bus_inbox' AND ok=1`, wk);
    if (inbox.length) {
      const empty = inbox.filter((r) => /delivered=0/.test(r.detail)).length;
      const waited = inbox.map((r) => Number((/waited=(\d+)/.exec(r.detail) || [])[1] || 0));
      L.push('', `Inbox polls: ${inbox.length}, of which ${empty} (${Math.round(100 * empty / inbox.length)}%) returned nothing; `
        + `${waited.filter((w) => w > 0).length} used wait_seconds (avg ${Math.round(waited.reduce((a, b) => a + b, 0) / inbox.length)} s).`);
    }
    L.push('');
    const perAgent = q(`SELECT agent, COUNT(*) n, SUM(ok=0) bad FROM events WHERE ts>? AND kind IN ('mcp','cli','hub') GROUP BY agent ORDER BY n DESC LIMIT 20`, wk);
    if (perAgent.length) L.push('## Tool calls by agent', perAgent.map((r) => `- ${r.agent || '(unregistered)'}: ${r.n} calls, ${r.bad} errors`).join('\n'), '');
    const errs = q(`SELECT name, detail, COUNT(*) n FROM events WHERE ts>? AND ok=0 GROUP BY name, detail ORDER BY n DESC LIMIT 15`, wk);
    L.push('## Most common errors', errs.length ? errs.map((r) => `- ${r.n}× ${r.name}: ${r.detail}`).join('\n') : 'None.', '');

    const ui = q(`SELECT name, COUNT(*) n, SUM(ok=0) bad FROM events WHERE ts>? AND kind='ui' GROUP BY name ORDER BY n DESC`, wk);
    L.push('## App features the owner used', ui.length ? ui.map((r) => `- ${r.name}: ${r.n}${r.bad ? ` (${r.bad} failed)` : ''}`).join('\n') : 'None logged yet.', '');

    const f = one('SELECT COUNT(*) n, COALESCE(SUM(size),0) s FROM files WHERE ts>?', wk);
    L.push('## Files', `${f.n} files, ${(f.s / 1048576).toFixed(1)} MB in 7 days.`, '');

    const snaps = q(`SELECT ts, detail FROM events WHERE kind='stats' AND ts>? ORDER BY ts`, wk);
    if (snaps.length >= 2) {
      const parse = (s) => { try { return JSON.parse(s.detail); } catch { return {}; } };
      const a = parse(snaps[0]), b = parse(snaps[snaps.length - 1]);
      const tok = (x) => (x.sessions || []).reduce((s, r) => s + (r.tokens || 0), 0);
      L.push('## Token and quota trend', `Tokens across tracked sessions: ${tok(a).toLocaleString('en-US')} → ${tok(b).toLocaleString('en-US')} `
        + `over ${Math.round((snaps[snaps.length - 1].ts - snaps[0].ts) / 3600)} h.`);
      for (const acc of b.accounts || []) {
        const prev = (a.accounts || []).find((x) => x.account === acc.account)?.left || {};
        const w = Object.entries(acc.left || {}).map(([k, v]) => `${k} left ${prev[k] ?? '?'}% → ${v}%`);
        if (w.length) L.push(`- ${acc.account}: ${w.join(', ')}`);
      }
      L.push('');
    }
    const props = this.proposals.list(null, 50);
    L.push('## Existing proposals (do not duplicate)', props.length ? props.map((p) => `- #${p.id} [${p.status}] ${p.title}`).join('\n') : 'None yet.', '');
    if (this.config.includeText) {
      L.push('## Recent message text (the owner allowed this)');
      for (const m of q('SELECT * FROM (SELECT sender, recipient, body, id FROM messages ORDER BY id DESC LIMIT 40) ORDER BY id'))
        L.push(`- ${m.sender} → ${m.recipient}: ${m.body.replace(/\s+/g, ' ').slice(0, 240)}`);
      L.push('');
    }
    const text = L.join('\n');
    fs.writeFileSync(this.digestPath, text);
    return text;
  }

  // ------------------------------------------------------------ headless steward runs
  prompt(reason, proposalId) {
    const base = `You are the Agent Bus steward, registered on the agent bus as "steward". Agent Bus is the owner's app for `
      + `Claude Code and Codex agents to message each other and exchange files; its source is in ${this.root} `
      + `(agent_bus_mcp.py is the MCP server and CLI, app/ is the Electron app; read README.md first). `
      + `Your one job is to make Agent Bus better for the owner, based on how it is actually used. `
      + `Use only the agent-bus tools and read-only file access; never edit files. `;
    if (proposalId) {
      return base + `The owner wrote on proposal #${proposalId}. Call bus_proposal(proposal_id=${proposalId}) to read the whole `
        + `discussion, look at the code it touches if useful, then answer with bus_proposal_note: refine the design, answer `
        + `questions, revise scope or estimates. If the owner asked for a change of plan, restate the updated proposal in full in your note. `
        + `Finish with a one-line summary of what you said.`;
    }
    return base + `This is a ${reason} review. Call bus_usage_digest for the usage trends and bus_proposals for what is already `
      + `proposed. Look for friction backed by evidence: errors, empty polling, unread backlogs, slow tools, features unused or `
      + `used heavily, quota burn. File at most 3 new proposals with bus_propose, only where the evidence supports a concrete `
      + `change, never duplicating an existing one. Each body: Problem; Evidence (numbers from the digest); Change (files and `
      + `approach); Benefit; Risk. If nothing is worth proposing, propose nothing. Finish with a short summary for the owner.`;
  }

  cliCommand(vendor, flags, resumeId) {
    const extra = String(flags || '').trim().split(/\s+/).filter(Boolean);
    if (vendor === 'codex') {
      const cfg = ['-c', "mcp_servers.agent_bus.env.AGENT_BUS_NAME='steward'", '-c', "mcp_servers.agent_bus.env.AGENT_BUS_KIND='steward'"];
      return resumeId ? ['codex', 'exec', ...cfg, ...extra, '--json', '--skip-git-repo-check', 'resume', resumeId, '-']
        : ['codex', 'exec', ...cfg, ...extra, '--json', '--skip-git-repo-check', '-s', 'read-only', '-C', this.root, '-'];
    }
    return ['claude', '-p', '--output-format', 'json', '--allowedTools', 'mcp__agent-bus', 'Read', 'Glob', 'Grep',
      ...extra, ...(resumeId ? ['--resume', resumeId] : [])];
  }

  run(reason, proposalId = null) {
    if (this.running) throw new Error(`The steward is already working (${this.running.reason}).`);
    const c = this.config;
    if (!proposalId) this.digest();
    this.db.prepare(`INSERT INTO agents(name,kind,note,cwd,last_seen) VALUES('steward','steward',?,?,?)
      ON CONFLICT(name) DO UPDATE SET last_seen=excluded.last_seen`).run(`Agent Bus steward (${c.vendor})`, this.root, this.now());
    const resumeId = c.sessions?.[c.vendor] || null;
    const argv = this.cliCommand(c.vendor, c.flags, resumeId);
    const env = { ...process.env, AGENT_BUS_NAME: 'steward', AGENT_BUS_KIND: 'steward' };
    delete env.ELECTRON_RUN_AS_NODE;
    // npm installs codex as a .cmd shim, which only cmd.exe can start. Every argument here is plain (no quotes
    // or %), and the prompt goes in on stdin, so this needs no escaping beyond quoting paths with spaces.
    const q = (s) => /^[\w@+=:,./\\'-]+$/.test(s) ? s : `"${s}"`;
    const child = isWin ? spawn('cmd.exe', ['/d', '/s', '/c', argv.map(q).join(' ')], { cwd: this.root, env, windowsHide: true, windowsVerbatimArguments: true })
      : spawn(argv[0], argv.slice(1), { cwd: this.root, env });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(this.runsDir, `${stamp}-${c.vendor}${proposalId ? `-p${proposalId}` : ''}.log`);
    const log = fs.createWriteStream(logFile);
    log.write(`# ${reason}${proposalId ? ` (proposal #${proposalId})` : ''}\n# ${argv.join(' ')}\n\n`);
    let out = '';
    child.stdout.on('data', (d) => { out += d; log.write(d); });
    child.stderr.on('data', (d) => log.write(d));
    child.stdin.end(this.prompt(reason, proposalId));
    this.running = { reason, proposalId, started: this.now(), log: logFile };
    this.lastError = '';
    if (!proposalId) this.saveConfig({ lastRun: this.now() });
    this.onChange();
    const t0 = Date.now();
    const done = (code) => {
      log.end();
      const { text, session } = this.parseOutput(c.vendor, out);
      if (session) this.saveConfig({ sessions: { ...this.config.sessions, [c.vendor]: session } });
      const ok = code === 0 && !!text;
      if (!ok) this.lastError = `The ${c.vendor} steward run ended with code ${code}. Log: ${logFile}`;
      if (text) this.db.prepare('INSERT INTO messages(ts,sender,recipient,body) VALUES(?,?,?,?)').run(this.now(), 'steward', 'owner', `[steward, ${reason}] ${text}`);
      this.event('steward', `run:${reason}`, ok, Date.now() - t0, `${c.vendor} exit=${code}`);
      this.running = null;
      this.onChange();
    };
    child.on('error', (e) => { log.write(`\n${e.message}\n`); done(-1); });
    child.on('close', done);
    return logFile;
  }

  // Claude prints one JSON object; Codex prints JSONL events.
  parseOutput(vendor, out) {
    if (vendor === 'claude') {
      try { const j = JSON.parse(out.trim().split(/\r?\n/).pop()); return { text: String(j.result || '').trim(), session: j.session_id }; } catch { return { text: '', session: null }; }
    }
    let text = '', session = null;
    for (const line of out.split(/\r?\n/)) {
      let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.type === 'thread.started' && j.thread_id) session = j.thread_id;
      if (j.type === 'item.completed' && j.item?.type === 'agent_message' && j.item.text) text = j.item.text;
    }
    return { text: text.trim(), session };
  }

  tick() {
    const c = this.config;
    if (c.enabled && !this.running && this.now() - (c.lastRun || 0) > c.cadenceHours * 3600) {
      try { this.run('scheduled'); } catch (e) { this.lastError = e.message; }
    }
  }

  // ------------------------------------------------------------ build loop for approved proposals
  repoBase() {
    try { git(this.root, ['rev-parse', '--git-dir']); } catch { throw new Error(`${this.root} is not a git repository (or Git is not installed). Builds need Git so each change lands on its own branch.`); }
    return git(this.root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  }
  worktree(id) { return path.join(path.dirname(this.root), `${path.basename(this.root)}-wt`, `proposal-${id}`); }

  build(id, vendor) {
    const p = this.proposals.row(id);
    if (!['approved', 'building'].includes(p.status)) throw new Error('Approve the proposal before building it.');
    const base = this.repoBase(), branch = `proposal/${p.id}`, wt = this.worktree(p.id);
    if (!fs.existsSync(wt)) {
      fs.mkdirSync(path.dirname(wt), { recursive: true });
      try {
        const exists = git(this.root, ['branch', '--list', branch]);
        git(this.root, exists ? ['worktree', 'add', wt, branch] : ['worktree', 'add', '-b', branch, wt, base]);
      } catch (e) { throw new Error(`git worktree failed: ${gitErr(e)}`); }
      const nm = path.join(this.root, 'node_modules');
      if (fs.existsSync(nm)) try { fs.symlinkSync(nm, path.join(wt, 'node_modules'), 'junction'); } catch {}
    }
    const name = `builder-${p.id}`;
    const prompt = `You are ${name}, building Agent Bus proposal #${p.id} ("${p.title}") in this git worktree, on branch ${branch} `
      + `(the live app runs from ${this.root} on ${base}; do not touch that folder). First call bus_proposal(proposal_id=${p.id}) and `
      + `read the whole discussion, plus README.md. Implement exactly what was agreed. Rules: keep app/schema.js identical to the CREATE `
      + `statements in the Python files; test against a scratch database by setting AGENT_BUS_DB to a temp file, never the live bus.sqlite; `
      + `check with node --check on changed .js files and python -m py_compile on changed .py files; update README.md. Commit on ${branch}. `
      + `Then run: agent-bus proposal status ${p.id} review note <what changed, how you tested it, anything left open>. `
      + `Post progress or questions with bus_proposal_note.`;
    this.proposals.setStatus('owner', p.id, 'building', `Builder ${name} (${vendor}) started in ${wt}`, { owner: true, branch });
    this.launchBuilder({ name, cli: vendor, cwd: wt, prompt, extra: this.config.builderFlags });
    return { name, wt, branch };
  }

  diff(id) {
    const p = this.proposals.row(id);
    if (!p.branch) throw new Error('This proposal has no branch yet.');
    const base = this.repoBase();
    try {
      const log = git(this.root, ['log', '--oneline', `${base}..${p.branch}`]);
      const stat = git(this.root, ['diff', '--stat', `${base}...${p.branch}`]);
      let full = git(this.root, ['diff', `${base}...${p.branch}`]);
      if (full.length > 300000) full = full.slice(0, 300000) + '\n… (diff truncated)';
      const wt = this.worktree(p.id);
      let dirty = '';
      if (fs.existsSync(wt)) try { dirty = git(wt, ['status', '--short']); } catch {}
      return { base, branch: p.branch, log, stat, full, dirty };
    } catch (e) { throw new Error(`git diff failed: ${gitErr(e)}`); }
  }

  removeWorktree(p) {
    const wt = this.worktree(p.id);
    try { fs.rmSync(path.join(wt, 'node_modules'), { force: true }); } catch {}   // the junction only, never its target
    if (fs.existsSync(wt)) try { git(this.root, ['worktree', 'remove', '--force', wt]); } catch {}
    try { git(this.root, ['worktree', 'prune']); } catch {}
  }

  merge(id) {
    const p = this.proposals.row(id);
    if (!p.branch) throw new Error('This proposal has no branch to merge.');
    this.repoBase();
    if (git(this.root, ['status', '--porcelain', '--untracked-files=no'])) throw new Error(`${this.root} has uncommitted changes; commit or stash them first.`);
    if (!git(this.root, ['log', '--oneline', `HEAD..${p.branch}`])) throw new Error(`${p.branch} has no commits to merge yet.`);
    try { git(this.root, ['merge', '--no-ff', p.branch, '-m', `Merge proposal #${p.id}: ${p.title}`]); } catch (e) {
      try { git(this.root, ['merge', '--abort']); } catch {}
      throw new Error(`Merge failed and was undone: ${gitErr(e)}`);
    }
    this.removeWorktree(p);
    try { git(this.root, ['branch', '-d', p.branch]); } catch {}
    this.proposals.setStatus('owner', p.id, 'done', `Merged ${p.branch}`, { owner: true });
  }

  discard(id) {
    const p = this.proposals.row(id);
    this.removeWorktree(p);
    if (p.branch) try { git(this.root, ['branch', '-D', p.branch]); } catch {}
    this.proposals.setStatus('owner', p.id, 'rejected', 'Branch discarded', { owner: true, branch: '' });
  }

  state() {
    return { config: this.config, running: this.running, lastError: this.lastError, git: this.gitOk !== false,
      digestAt: fs.existsSync(this.digestPath) ? fs.statSync(this.digestPath).mtimeMs / 1000 : 0, runsDir: this.runsDir };
  }
}

module.exports = { Steward };
