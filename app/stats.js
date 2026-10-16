'use strict';
// Per-session usage stats and per-account quota, read from what the CLIs already write to disk:
//   Claude Code: ~/.claude/projects/<folder>/<session>.jsonl (tokens, model) plus, when the Agent Bus
//                status line is enabled, claude_status rows (context window, cost, 5h/7d quota, effort).
//   Codex:       ~/.codex/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl (tokens, context window, model,
//                effort and the account's rate-limit percentages).
// VM sessions send the same Codex figures with their heartbeat (agent_meta.stats).
// Files are read incrementally, so each poll only parses what was appended since the last one.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOME = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const CODEX_DIR = process.env.CODEX_HOME || path.join(HOME, '.codex');

class Tail {
  // Reads a JSONL file from where it left off; calls onLine for each complete new line.
  constructor(file, onLine) { this.file = file; this.onLine = onLine; this.pos = 0; this.rest = ''; }
  pump() {
    let st;
    try { st = fs.statSync(this.file); } catch { return false; }
    if (st.size < this.pos) { this.pos = 0; this.rest = ''; this.reset?.(); }
    if (st.size === this.pos) return true;
    const fd = fs.openSync(this.file, 'r');
    try {
      const CHUNK = 8 << 20;
      while (this.pos < st.size) {
        const len = Math.min(CHUNK, st.size - this.pos);
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, this.pos);
        this.pos += len;
        const text = this.rest + buf.toString('utf8');
        const lines = text.split('\n');
        this.rest = lines.pop();
        for (const l of lines) if (l) { try { this.onLine(JSON.parse(l)); } catch {} }
      }
    } finally { fs.closeSync(fd); }
    return true;
  }
}

function claudeAgg() {
  return { cli: 'claude', model: '', input: 0, cacheWrite: 0, cacheRead: 0, output: 0, turns: 0, contextUsed: 0,
    first: null, last: null, byId: new Map() };
}
function codexAgg() {
  return { cli: 'codex', model: '', effort: '', input: 0, cached: 0, output: 0, reasoning: 0, contextUsed: 0, contextWindow: 0,
    turns: 0, first: null, last: null, account: '', rate: null, quotaUsed: {}, lastPct: {} };
}

class Stats {
  constructor(db) {
    this.db = db;
    this.tails = new Map();            // file -> { tail, agg }
    this.codexIndex = new Map();       // session id -> rollout file
    this.codexIndexedAt = 0;
    this.claudeAccount = null;
  }

  // ---------------- Claude Code ----------------
  claudeFile(sessionId) {
    const root = path.join(CLAUDE_DIR, 'projects');
    try {
      for (const d of fs.readdirSync(root)) {
        const f = path.join(root, d, `${sessionId}.jsonl`);
        if (fs.existsSync(f)) return f;
      }
    } catch {}
    return null;
  }
  // Newest transcript for a working folder (used when a session never told us its id).
  claudeNewestFor(cwd) {
    const dir = path.join(CLAUDE_DIR, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
    try {
      const f = fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))
        .map((x) => ({ x, t: fs.statSync(path.join(dir, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
      return f ? { id: f.x.slice(0, -6), file: path.join(dir, f.x) } : null;
    } catch { return null; }
  }
  claudeTranscript(file) {
    let e = this.tails.get(file);
    if (!e) {
      const agg = claudeAgg();
      const tail = new Tail(file, (o) => {
        const ts = o.timestamp ? Date.parse(o.timestamp) / 1000 : null;
        if (ts) { agg.first ??= ts; agg.last = ts; }
        if (o.type === 'user' && o.message?.role === 'user' && typeof o.message.content === 'string') agg.turns++;
        const m = o.message;
        if (o.type !== 'assistant' || !m?.usage) return;
        // Streaming writes several lines per API message; the last one carries the final usage.
        const prev = agg.byId.get(m.id);
        const u = m.usage;
        const add = (k, v) => { agg[k] += (v || 0) - (prev?.[k] || 0); };
        const cur = { input: u.input_tokens, cacheWrite: u.cache_creation_input_tokens, cacheRead: u.cache_read_input_tokens, output: u.output_tokens };
        for (const k of Object.keys(cur)) add(k, cur[k]);
        if (m.id) agg.byId.set(m.id, cur);
        if (m.model && !m.model.startsWith('<')) agg.model = m.model;
        if (!o.isSidechain) agg.contextUsed = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      });
      tail.reset = () => Object.assign(agg, claudeAgg());
      e = { tail, agg };
      this.tails.set(file, e);
    }
    e.tail.pump();
    return e.agg;
  }
  claudeStatus(sessionId) {
    const r = this.db.prepare('SELECT ts, effort, json FROM claude_status WHERE session_id=?').get(sessionId);
    if (!r) return null;
    try { return { ts: r.ts, effort: r.effort, s: JSON.parse(r.json) }; } catch { return null; }
  }
  // Quota consumed while this session was active: the sum of rises it observed (resets are ignored).
  claudeQuotaUsed(sessionId) {
    const rows = this.db.prepare("SELECT five, seven FROM quota_history WHERE account='claude' AND session_id=? ORDER BY ts").all(sessionId);
    const used = { five: 0, seven: 0 };
    for (let i = 1; i < rows.length; i++) for (const k of ['five', 'seven']) {
      const d = (rows[i][k] ?? 0) - (rows[i - 1][k] ?? 0);
      if (d > 0) used[k] += d;
    }
    return rows.length > 1 ? used : null;
  }
  claudeAccountLabel() {
    if (this.claudeAccount === null) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(HOME, '.claude.json'), 'utf8'));
        const a = j.oauthAccount || {};
        this.claudeAccount = a.emailAddress || a.organizationName || 'Claude account';
      } catch { this.claudeAccount = 'Claude account'; }
    }
    return this.claudeAccount;
  }

  // ---------------- Codex ----------------
  codexRolloutFiles() {
    const root = path.join(CODEX_DIR, 'sessions'), out = [];
    const walk = (d, depth) => {
      let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p = path.join(d, e.name);
        if (e.isDirectory() && depth < 3) walk(p, depth + 1);
        else if (e.isFile() && /^rollout-.*\.jsonl$/.test(e.name)) out.push(p);
      }
    };
    walk(root, 0);
    return out;
  }
  codexFile(id) {
    if (!this.codexIndex.has(id) && Date.now() - this.codexIndexedAt > 15000) {
      this.codexIndexedAt = Date.now();
      for (const f of this.codexRolloutFiles()) {
        const m = path.basename(f).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
        if (m) this.codexIndex.set(m[1], f);
      }
    }
    return this.codexIndex.get(id) || null;
  }
  codexRollout(file) {
    let e = this.tails.get(file);
    if (!e) {
      const agg = codexAgg();
      const tail = new Tail(file, (o) => applyCodexLine(agg, o));
      tail.reset = () => Object.assign(agg, codexAgg());
      e = { tail, agg };
      this.tails.set(file, e);
    }
    e.tail.pump();
    return e.agg;
  }
  codexNewestFor(cwd) {
    const files = this.codexRolloutFiles().map((f) => ({ f, t: fs.statSync(f).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, 40);
    for (const { f } of files) {
      const agg = this.codexRollout(f);
      if (agg.cwd && path.resolve(agg.cwd).toLowerCase() === path.resolve(cwd).toLowerCase()) return { file: f, agg };
    }
    return null;
  }

  // ---------------- public ----------------
  // sessions: [{ name, cli, cwd, sessionId, remote, remoteStats, effort }]
  collect(sessions) {
    const out = {};
    for (const s of sessions) {
      try { out[s.name] = this.forSession(s); } catch (e) { out[s.name] = { error: e.message }; }
    }
    return { sessions: out, accounts: this.accounts(sessions) };
  }

  forSession(s) {
    if (s.remote) {
      const r = s.remoteStats;
      if (!r) return { source: 'none', note: 'No stats reported from the VM yet' };
      if (r.info) return { source: 'vm', ...codexView(fromRemote(r)), effort: r.effort || s.effort || '', file: r.file };
      return { source: 'none' };
    }
    if (s.cli === 'codex') {
      let file = s.sessionId && this.codexFile(s.sessionId), guessed = false, agg;
      if (file) agg = this.codexRollout(file);
      else if (s.cwd) { const g = this.codexNewestFor(s.cwd); if (g) { file = g.file; agg = g.agg; guessed = true; } }
      if (!agg) return { source: 'none', note: 'No Codex rollout found for this session yet' };
      return { source: 'codex', guessed, file, ...codexView(agg) };
    }
    // Claude Code
    let id = s.sessionId, file = id && this.claudeFile(id), guessed = false;
    if (!file && s.cwd) { const g = this.claudeNewestFor(s.cwd); if (g) { id = g.id; file = g.file; guessed = true; } }
    if (!file) return { source: 'none', note: 'No Claude transcript found for this session yet' };
    const a = this.claudeTranscript(file);
    const st = this.claudeStatus(id);
    const cw = st?.s?.context_window || {};
    const window = cw.context_window_size || (/\[1m\]|-1m/.test(a.model) ? 1000000 : 200000);
    const used = cw.total_input_tokens != null && cw.current_usage ? cw.total_input_tokens : a.contextUsed;
    return {
      source: 'claude', guessed, sessionId: id, file,
      model: st?.s?.model?.display_name || a.model, modelId: st?.s?.model?.id || a.model,
      effort: st?.effort || s.effort || '',
      tokens: { input: a.input, cacheWrite: a.cacheWrite, cacheRead: a.cacheRead, output: a.output,
        total: a.input + a.cacheWrite + a.cacheRead + a.output },
      context: { used: a.contextUsed || used, window, pct: cw.used_percentage ?? (a.contextUsed ? 100 * a.contextUsed / window : null), exact: !!cw.context_window_size },
      cost: st?.s?.cost?.total_cost_usd ?? null,
      linesChanged: st?.s?.cost ? { added: st.s.cost.total_lines_added, removed: st.s.cost.total_lines_removed } : null,
      quotaUsed: this.claudeQuotaUsed(id),
      turns: a.turns, first: a.first, last: a.last, statusAt: st?.ts || null,
    };
  }

  accounts(sessions) {
    const acc = [];
    // Claude: the freshest status-line snapshot that carries rate limits.
    const rows = this.db.prepare('SELECT ts, json FROM claude_status ORDER BY ts DESC LIMIT 50').all();
    for (const r of rows) {
      let s; try { s = JSON.parse(r.json); } catch { continue; }
      const rl = s.rate_limits;
      if (!rl || (!rl.five_hour && !rl.seven_day)) continue;
      acc.push({ cli: 'claude', label: this.claudeAccountLabel(), asOf: r.ts, windows: [
        rl.five_hour && { name: '5-hour', used: rl.five_hour.used_percentage, resetsAt: toEpoch(rl.five_hour.resets_at) },
        rl.seven_day && { name: '7-day', used: rl.seven_day.used_percentage, resetsAt: toEpoch(rl.seven_day.resets_at) },
      ].filter(Boolean) });
      break;
    }
    if (!acc.length) acc.push({ cli: 'claude', label: this.claudeAccountLabel(), asOf: null, windows: [],
      note: rows.length ? 'Waiting for a Claude session to report its quota' : 'Turn on the status line in Setup to track Claude quota' });

    // Codex: newest rate-limit figures per account, from local rollouts and VM heartbeats.
    const byAcct = new Map();
    const consider = (agg, where) => {
      if (!agg.rate || !agg.rateTs) return;
      const key = agg.account || 'codex';
      const cur = byAcct.get(key);
      if (!cur || agg.rateTs > cur.rateTs) byAcct.set(key, { ...agg, where });
    };
    const recent = this.codexRolloutFiles().map((f) => { try { return { f, t: fs.statSync(f).mtimeMs }; } catch { return null; } })
      .filter(Boolean).sort((a, b) => b.t - a.t).slice(0, 8);
    for (const { f } of recent) consider(this.codexRollout(f), 'this PC');
    for (const s of sessions) if (s.remote && s.remoteStats?.rate_limits) consider(fromRemote(s.remoteStats), s.host || 'VM');
    for (const [key, a] of byAcct) {
      const rl = a.rate;
      acc.push({ cli: 'codex', label: `Codex ${rl.plan_type || ''} · ${key.slice(0, 8)}`.replace('  ', ' '), asOf: a.rateTs, where: a.where,
        credits: rl.credits && !rl.credits.unlimited && rl.credits.balance != null ? Number(rl.credits.balance) : null,
        windows: ['primary', 'secondary'].map((k) => rl[k] && { name: windowName(rl[k].window_minutes), used: rl[k].used_percent, resetsAt: rl[k].resets_at }).filter(Boolean) });
    }
    return acc;
  }
}

function applyCodexLine(agg, o) {
  const p = o.payload || {};
  const ts = o.timestamp ? Date.parse(o.timestamp) / 1000 : null;
  if (ts) { agg.first ??= ts; agg.last = ts; }
  if (o.type === 'session_meta') { agg.account = p.creator_account_id || agg.account; agg.cwd = p.cwd || agg.cwd; agg.id = p.id || agg.id; }
  else if (o.type === 'turn_context') { agg.model = p.model || agg.model; agg.effort = p.effort || p.reasoning_effort || agg.effort; agg.turns++; }
  else if (p.type === 'token_count') {
    if (p.info) {
      const t = p.info.total_token_usage || {}, l = p.info.last_token_usage || {};
      agg.input = t.input_tokens || 0; agg.cached = t.cached_input_tokens || 0; agg.output = t.output_tokens || 0;
      agg.reasoning = t.reasoning_output_tokens || 0;
      agg.contextUsed = l.input_tokens || agg.contextUsed;
      agg.contextWindow = p.info.model_context_window || agg.contextWindow;
    }
    if (p.rate_limits) {
      agg.rate = p.rate_limits; agg.rateTs = ts;
      for (const k of ['primary', 'secondary']) {
        const w = p.rate_limits[k];
        if (!w) continue;
        const prev = agg.lastPct[k];
        if (prev && prev.resets_at === w.resets_at && w.used_percent > prev.used) agg.quotaUsed[k] = (agg.quotaUsed[k] || 0) + (w.used_percent - prev.used);
        agg.lastPct[k] = { used: w.used_percent, resets_at: w.resets_at, window: w.window_minutes };
      }
    }
  }
}

function fromRemote(r) {
  const agg = codexAgg();
  agg.model = r.model || ''; agg.effort = r.effort || ''; agg.account = r.account || '';
  applyCodexLine(agg, { timestamp: r.ts, payload: { type: 'token_count', info: r.info, rate_limits: r.rate_limits } });
  return agg;
}

function codexView(a) {
  const quotaUsed = Object.keys(a.quotaUsed).length
    ? Object.fromEntries(Object.entries(a.quotaUsed).map(([k, v]) => [windowName(a.lastPct[k]?.window), v])) : null;
  return {
    model: a.model, effort: a.effort,
    tokens: { input: a.input - a.cached, cacheRead: a.cached, output: a.output, reasoning: a.reasoning, total: a.input + a.output },
    context: { used: a.contextUsed, window: a.contextWindow, pct: a.contextWindow ? 100 * a.contextUsed / a.contextWindow : null, exact: true },
    cost: null, quotaUsed, turns: a.turns, first: a.first, last: a.last, account: a.account, sessionId: a.id || '',
  };
}

const windowName = (min) => !min ? 'window' : min % 10080 === 0 ? (min === 10080 ? 'weekly' : `${min / 10080}-week`) : min % 1440 === 0 ? `${min / 1440}-day` : min % 60 === 0 ? `${min / 60}-hour` : `${min}-min`;
const toEpoch = (v) => v == null ? null : typeof v === 'number' ? v : Date.parse(v) / 1000;

module.exports = { Stats };
