'use strict';
const $ = (id) => document.getElementById(id);
const ONLINE_S = 120;   // MCP heartbeat is every 30 s, so two minutes of silence means the session is gone
const state = {
  agents: [], profiles: new Map(), projects: [], messages: [], readers: new Map(), files: new Map(),
  stats: { sessions: {}, accounts: [] }, filter: '', query: '', lastKey: '', owner: 'owner', now: Date.now() / 1000,
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(t, now = state.now) {
  if (!t) return 'never';
  const s = Math.max(0, Math.round(now - t));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 172800 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}
function until(t) {
  if (!t) return '';
  const s = Math.max(0, Math.round(t - Date.now() / 1000));
  return s < 3600 ? `${Math.floor(s / 60)}m` : s < 172800 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDay = (t) => new Date(t * 1000).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
const fmtN = (n) => n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(0)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
const fmtBytes = (n) => n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`;
const pct = (v) => v == null ? '—' : `${Math.round(v)}%`;
function highlight(text, q) {
  const e = esc(text);
  if (!q) return e;
  const re = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return e.replace(re, (m) => `<mark>${m}</mark>`);
}
function toast(text, bad) {
  const t = $('toast');
  t.textContent = text; t.className = bad ? 'show bad' : 'show';
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.className = ''; }, 4500);
}
const errText = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const levelClass = (left) => left == null ? '' : left < 10 ? 'crit' : left < 30 ? 'low' : 'ok';

// One row per session: everything registered on the bus plus saved launch profiles that never connected.
function sessions() {
  const byName = new Map(state.agents.filter((a) => a.name !== state.owner).map((a) => [a.name, { ...a }]));
  for (const p of state.profiles.values()) if (!byName.has(p.name)) byName.set(p.name, { name: p.name, kind: p.cli === 'codex' ? 'codex-cli' : 'claude-code', cwd: p.cwd, last_seen: null, unread: 0 });
  return [...byName.values()].map((s) => {
    const p = state.profiles.get(s.name);
    const online = !!s.last_seen && state.now - s.last_seen < ONLINE_S;
    return { ...s, profile: p, project: p?.project || '', online, remote: !!s.remote, st: state.stats.sessions[s.name] };
  });
}

function statLine(st) {
  if (!st || st.source === 'none' || st.error) return '';
  const bits = [];
  if (st.model) bits.push(esc(String(st.model).replace(/^claude-/, '')));
  if (st.effort) bits.push(`effort ${esc(st.effort)}`);
  if (st.context?.window) bits.push(`<span class="ctx ${levelClass(st.context.pct == null ? null : 100 - st.context.pct)}">ctx ${pct(st.context.pct)} of ${fmtN(st.context.window)}</span>`);
  if (st.tokens?.total) bits.push(`${fmtN(st.tokens.total)} tok`);
  if (st.cost != null) bits.push(`$${st.cost.toFixed(2)}`);
  return `<div class="aStats" title="${st.guessed ? 'Matched by working folder (newest transcript there)' : ''}">${bits.join(' · ')}</div>`;
}

function sessionRow(s) {
  const p = s.profile;
  const launching = p?.last_launch && state.now - p.last_launch < 45 && !s.online;
  const status = s.online ? 'online' : launching ? 'starting…' : 'offline';
  const where = s.remote ? `<span class="kind vm" title="${esc(s.platform || '')} · ${esc(s.addr || '')}">VM: ${esc(s.host || '?')}</span>` : '';
  const action = s.online ? '<span class="state on">online</span>'
    : s.remote ? '<span class="state">offline</span>'
    : `<button class="launch" data-act="launch" title="Launch ${esc(p?.cli || (/codex/i.test(s.kind) ? 'codex' : 'claude'))} in ${esc(p?.cwd || s.cwd || 'home folder')}${/desktop/i.test(s.kind || '') ? ' (resumes this desktop thread in the CLI; close it in the desktop app first, since only one client can write to a thread)' : ''}">▶ Launch</button>`;
  return `<div class="sess ${state.filter === s.name ? 'sel' : ''}" data-name="${esc(s.name)}" title="${esc(s.cwd || '')}">
    <div class="aTop"><span class="dot ${s.online ? 'on' : launching ? 'idle' : ''}" title="${status}"></span>
      <span class="aName">${esc(s.name)}</span>
      ${s.kind ? `<span class="kind">${esc(s.kind)}</span>` : ''}${where}
      ${s.unread ? `<span class="badge" title="Messages this session hasn't read yet">${s.unread}</span>` : ''}
      ${action}
    </div>
    ${s.note ? `<div class="aNote">${esc(s.note)}</div>` : ''}
    ${statLine(s.st)}
    <div class="aSeen">${status} · seen ${ago(s.last_seen)}</div>
  </div>`;
}

function renderAgents() {
  const list = sessions().sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
  const el = $('agents');
  if (!list.length) { el.innerHTML = '<div class="empty small">No sessions yet. Use + Session, or have an agent call bus_register.</div>'; return; }
  if (!$('groupBy').checked) { el.innerHTML = list.map(sessionRow).join(''); return; }
  const groups = new Map(state.projects.map((p) => [p.name, []]));
  const loose = [];
  for (const s of list) (s.project && groups.has(s.project) ? groups.get(s.project) : loose).push(s);
  let html = '';
  for (const pr of state.projects) {
    const rows = groups.get(pr.name);
    const on = rows.filter((r) => r.online).length;
    const tok = rows.reduce((n, r) => n + (r.st?.tokens?.total || 0), 0);
    html += `<div class="proj" data-project="${esc(pr.name)}">
      <div class="projHead"><span class="caret">${pr.collapsed ? '▸' : '▾'}</span><span class="pName">${esc(pr.name)}</span>
        <span class="pCount">${on}/${rows.length} online${tok ? ` · ${fmtN(tok)} tok` : ''}</span></div>
      ${pr.collapsed ? '' : rows.map(sessionRow).join('') || '<div class="empty small">Right-click a session → Add to project</div>'}
    </div>`;
  }
  if (loose.length) html += `<div class="proj loose">${state.projects.length ? '<div class="projHead"><span class="pName">No project</span></div>' : ''}${loose.map(sessionRow).join('')}</div>`;
  el.innerHTML = html;
}

function renderQuota() {
  const q = $('quota');
  q.innerHTML = state.stats.accounts.map((a) => {
    const cells = a.windows.map((w) => {
      const left = w.used == null ? null : Math.max(0, 100 - w.used);
      return `<span class="qw ${levelClass(left)}" title="${esc(w.name)} window: ${pct(w.used)} used${w.resetsAt ? `, resets in ${until(w.resetsAt)}` : ''}">
        <span class="qn">${esc(w.name)}</span><span class="bar"><i data-w="${left ?? 0}"></i></span><b>${pct(left)}</b></span>`;
    }).join('');
    const tip = `${a.label}${a.where ? ` (reported from ${a.where})` : ''}${a.asOf ? `, as of ${ago(a.asOf, Date.now() / 1000)}` : ''}${a.note ? ` — ${a.note}` : ''}`;
    return `<span class="acct ${a.cli}" title="${esc(tip)}"><span class="an">${a.cli === 'claude' ? 'Claude' : 'Codex'}</span>${cells || `<span class="qnote">${esc(a.note || 'no data yet')}</span>`}${a.credits != null ? `<span class="qn">${fmtN(Math.round(a.credits))} cr</span>` : ''}</span>`;
  }).join('');
}

// Bar widths are set through the DOM because the page's CSP forbids inline style attributes.
function applyBars() { for (const i of document.querySelectorAll(".bar i[data-w]")) i.style.width = `${i.dataset.w}%`; }

function syncSelect(sel, options, keep) {
  const cur = sel.value || keep;
  sel.innerHTML = options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  sel.value = options.some(([v]) => v === cur) ? cur : options[0][0];
}

function renderSelects() {
  const all = sessions();
  const names = all.map((s) => s.name).filter((n) => state.agents.some((a) => a.name === n));
  const projects = state.projects.map((p) => p.name).filter((p) => all.some((s) => s.project === p));
  syncSelect($('to'), [['all', 'all sessions'], ...projects.map((p) => [`project:${p}`, `project: ${p}`]), ...names.map((n) => [n, n])], 'all');
  const f = $('filterAgent');
  syncSelect(f, [['', 'All conversations'], ...state.agents.map((a) => [a.name, `Involving ${a.name}`])], state.filter);
  state.filter = f.value;
  $('projectList').innerHTML = state.projects.map((p) => `<option value="${esc(p.name)}">`).join('');
}

function renderLog(force) {
  const log = $('log');
  const q = state.query.toLowerCase();
  const rows = state.messages.filter((m) =>
    (!state.filter || m.sender === state.filter || m.recipient === state.filter || m.recipient === 'all') &&
    (!q || m.body.toLowerCase().includes(q) || m.sender.toLowerCase().includes(q) || m.recipient.toLowerCase().includes(q)));
  const key = `${state.filter}|${q}|${rows.length}|${rows.at(-1)?.id}|${[...state.readers.values()].join(';').length}`;
  if (!force && key === state.lastKey) return;
  state.lastKey = key;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  let day = '', html = '';
  for (const m of rows) {
    const d = fmtDay(m.ts);
    if (d !== day) { day = d; html += `<div class="day">${esc(d)}</div>`; }
    const who = state.readers.get(m.id);
    const cls = m.sender === state.owner ? 'owner' : m.recipient === 'all' ? 'bcast' : '';
    const fm = m.body.match(/^\[file #(\d+)\]/);
    const file = fm && state.files.get(Number(fm[1]));
    html += `<div class="msg ${cls}">
      <div class="mHead"><span class="who">${highlight(m.sender, q)}</span><span class="arrow">→</span>
        <span>${highlight(m.recipient, q)}</span><span>${fmtTime(m.ts)}</span><span class="id">#${m.id}</span></div>
      ${file ? `<div class="fileCard"><span class="ficon">📄</span><span class="fname">${esc(file.name)}</span><span class="muted">${fmtBytes(file.size)}</span>
        <button data-file="${file.id}" data-fact="save">Save as…</button><button data-file="${file.id}" data-fact="reveal">Show in folder</button></div>` : ''}
      <div class="body">${highlight(m.body, q)}</div>
      <div class="reads">${who ? `✓ read by ${esc(who.split(',').join(', '))}` : m.recipient === state.owner ? '' : 'unread'}</div>
    </div>`;
  }
  log.innerHTML = html || `<div class="empty">${state.messages.length ? 'No messages match.' : 'No messages yet. Sessions appear on the left once they call bus_register or are launched from here.'}</div>`;
  if ($('autoscroll').checked && (atBottom || force)) log.scrollTop = log.scrollHeight;
}

async function refresh(force = false) {
  try {
    const s = await window.bus.snapshot(2000);
    Object.assign(state, { agents: s.agents, messages: s.messages, owner: s.owner, now: s.now, projects: s.projects });
    state.profiles = new Map(s.profiles.map((p) => [p.name, p]));
    state.readers = new Map(s.readers.map((r) => [r.msg_id, r.who]));
    state.files = new Map(s.files.map((f) => [f.id, f]));
    $('dbPath').textContent = s.dbPath;
    const all = sessions();
    const vms = all.filter((x) => x.remote).length;
    $('stats').textContent = `${all.filter((x) => x.online).length} of ${all.length} sessions online · ${s.total} messages`;
    $('vmBadge').textContent = vms ? String(vms) : '';
    $('btnVms').title = s.hub.listening.length > 1 ? `Hub listening on ${s.hub.listening.filter((a) => a !== '127.0.0.1').join(', ')}:${s.hub.port}` : 'Hub: no VM networks found';
    renderAgents();
    renderSelects();
    renderLog(force);
  } catch (e) {
    $('stats').textContent = `Database error: ${errText(e)}`;
  }
}

async function refreshStats() {
  try {
    state.stats = await window.bus.stats();
    renderQuota(); applyBars(); renderAgents();
    if ($('dlgStats').open) renderStats(statsFor);
  } catch {}
}

// ---------------------------------------------------------------- stats dialog
let statsFor = null;
function kv(rows) { return `<table class="kv">${rows.filter(Boolean).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</table>`; }
function renderStats(name) {
  const s = sessions().find((x) => x.name === name);
  const st = s?.st;
  $('statsTitle').textContent = `Session stats: ${name}`;
  if (!st || st.source === 'none' || st.error) {
    $('statsBody').innerHTML = `<p class="muted">${esc(st?.error || st?.note || 'No usage data found for this session yet.')}</p>`;
    return;
  }
  const t = st.tokens || {}, c = st.context || {};
  const quota = st.quotaUsed ? Object.entries(st.quotaUsed).map(([k, v]) => `${esc(k === 'five' ? '5-hour' : k === 'seven' ? '7-day' : k)}: ${v.toFixed(1)}%`).join(' · ') : '—';
  $('statsBody').innerHTML = kv([
    ['CLI', esc(st.source === 'vm' ? `Codex (in VM ${s.host || ''})` : st.source === 'claude' ? 'Claude Code' : 'Codex')],
    ['Model', esc(st.modelId && st.modelId !== st.model ? `${st.model} (${st.modelId})` : st.model || '—')],
    ['Effort', esc(st.effort || '—')],
    ['Context', c.window ? `<span class="ctx ${levelClass(c.pct == null ? null : 100 - c.pct)}">${fmtN(c.used)} of ${fmtN(c.window)} (${pct(c.pct)})</span>${c.exact ? '' : ' <span class="muted">window size assumed; enable the status line for the exact figure</span>'}` : '—'],
    ['Tokens, total', fmtN(t.total)],
    ['  input (uncached)', fmtN(t.input)],
    t.cacheWrite != null && ['  cache write', fmtN(t.cacheWrite)],
    ['  cache read', fmtN(t.cacheRead)],
    ['  output', fmtN(t.output) + (t.reasoning ? ` (of which reasoning ${fmtN(t.reasoning)})` : '')],
    ['API-equivalent cost', st.cost != null ? `$${st.cost.toFixed(4)}` : '<span class="muted">not reported</span>'],
    st.linesChanged && ['Lines changed', `+${st.linesChanged.added ?? 0} / −${st.linesChanged.removed ?? 0}`],
    ['Quota used while active', `${quota} <span class="muted">(includes other sessions on the same account running at the same time)</span>`],
    ['Turns', fmtN(st.turns)],
    ['Active', st.first ? `${new Date(st.first * 1000).toLocaleString()} → ${ago(st.last, Date.now() / 1000)}` : '—'],
    ['Session id', `<code>${esc(st.sessionId || s.session_id || '—')}</code>${st.guessed ? ' <span class="muted">(newest transcript in its folder)</span>' : ''}`],
    st.file && ['Transcript', `<code>${esc(st.file)}</code>`],
  ]);
}
function openStats(name) { statsFor = name; renderStats(name); $('dlgStats').showModal(); }
$('statsClose').addEventListener('click', () => $('dlgStats').close());

// ---------------------------------------------------------------- VMs dialog
async function renderVms() {
  const n = await window.bus.netInfo();
  const urls = n.urls;
  const one = (u) => ({
    sh: `curl -fsS "${u}/setup.sh?t=${n.token}" | sh`,
    ps: `irm "${u}/setup.ps1?t=${n.token}" | iex`,
  });
  let html = '';
  html += `<div class="hubRow"><label class="chk"><input type="checkbox" id="hubEnabled" ${n.enabled ? 'checked' : ''}> Hub on</label>
    <label class="chk" title="Also listen on this computer's LAN addresses, for bridged VMs or other PCs"><input type="checkbox" id="hubLan" ${n.lan ? 'checked' : ''}> Also allow LAN (bridged VMs, other PCs)</label>
    <span class="muted">port ${n.port}</span></div>`;
  if (n.errors.length) html += `<p class="err">Could not listen on: ${esc(n.errors.join(', '))}</p>`;
  if (!urls.length) html += `<p class="warnBox">No virtual-machine network adapters found on this computer. Start your VM software (VMware, VirtualBox, Hyper-V, Parallels, QEMU/UTM), then reopen this panel. A VM in bridged mode is reached over the LAN: tick "Also allow LAN".</p>`;
  for (const u of urls) {
    const c = one(u.url);
    html += `<div class="vmNet"><div class="vmHead"><b>${esc(u.vm || 'Network')}</b> <span class="muted">${esc(u.adapter)}</span> <code>${esc(u.url)}</code></div>
      <div class="cmdRow"><span>macOS / Linux guest</span><code>${esc(c.sh)}</code><button data-copy="${esc(c.sh)}">Copy</button></div>
      <div class="cmdRow"><span>Windows guest</span><code>${esc(c.ps)}</code><button data-copy="${esc(c.ps)}">Copy</button></div></div>`;
  }
  html += `<p class="muted">Run one of these in a terminal inside the VM, or paste it to the agent there. It installs the bus server
    (Python 3 required), adds it to Codex and Claude Code in the guest, and checks the connection. Then restart Codex / Claude in the VM.
    Agents there can also use the <code>agent-bus</code> command-line tool it installs.</p>`;
  html += '<h3>Guests seen on VM networks</h3>';
  html += n.guests.length ? `<table class="kv">${n.guests.map((g) => `<tr><th>${esc(g.ip)}</th><td>${esc(g.vendor)} <span class="muted">${esc(g.mac)} on ${esc(g.adapter)}</span></td></tr>`).join('')}</table>`
    : '<p class="muted">None yet. A running guest shows up here once it has used the network.</p>';
  html += '<h3>VM agents on the bus</h3>';
  html += n.remote.length ? `<table class="kv">${n.remote.map((r) => `<tr><th>${esc(r.name)}</th><td>${esc(r.host || '')} <span class="muted">${esc(r.platform || '')} · ${esc(r.addr || '')} · seen ${ago(r.last_seen, n.now)}</span></td></tr>`).join('')}</table>`
    : '<p class="muted">None yet.</p>';
  html += `<details><summary>Token</summary><p><code>${esc(n.token)}</code> <button data-copy="${esc(n.token)}">Copy</button> <button id="hubNewToken">New token</button></p>
    <p class="muted">A new token disconnects existing VM setups until their setup command is re-run.</p></details>`;
  $('vmBody').innerHTML = html;
  $('hubEnabled').onchange = async (e) => { await window.bus.netSet({ enabled: e.target.checked }); renderVms(); };
  $('hubLan').onchange = async (e) => { await window.bus.netSet({ lan: e.target.checked }); renderVms(); };
  $('hubNewToken').onclick = async () => { await window.bus.netSet({ newToken: true }); renderVms(); };
}
$('vmBody').addEventListener('click', async (e) => {
  const v = e.target.dataset.copy;
  if (v) { await window.bus.copy(v); toast('Copied'); }
});
$('btnVms').addEventListener('click', async () => { $('vmBody').innerHTML = '<p class="muted">Looking for VM networks…</p>'; $('dlgVms').showModal(); try { await renderVms(); } catch (e) { $('vmBody').innerHTML = `<p class="err">${esc(errText(e))}</p>`; } });
$('vmClose').addEventListener('click', () => $('dlgVms').close());

// ---------------------------------------------------------------- setup dialog
async function renderSetup() {
  const items = await window.bus.setupStatus();
  const todo = items.filter((i) => !i.ok && !i.na).length;
  $('setupBadge').textContent = todo ? String(todo) : '';
  $('setupBody').innerHTML = items.map((i) => `<div class="setupItem ${i.ok ? 'done' : i.na ? 'na' : 'todo'}">
    <span class="sIcon">${i.ok ? '✓' : i.na ? '–' : '!'}</span>
    <div class="sText"><b>${esc(i.title)}</b><div class="muted">${esc(i.detail || '')}</div></div>
    ${!i.ok && i.fix ? `<button data-fix="${esc(i.id)}" class="primary">${i.id === 'firewall' ? 'Allow (admin)' : 'Fix'}</button>` : ''}
    ${i.ok && i.fix && i.id !== 'firewall' ? `<button data-fix="${esc(i.id)}">Redo</button>` : ''}
  </div>`).join('');
}
$('setupBody').addEventListener('click', async (e) => {
  const id = e.target.dataset.fix;
  if (!id) return;
  e.target.disabled = true; e.target.textContent = 'Working…';
  try { toast(await window.bus.setupFix(id) || 'Done'); } catch (err) { toast(errText(err), true); }
  renderSetup();
});
$('btnSetup').addEventListener('click', () => { $('setupBody').innerHTML = '<p class="muted">Checking…</p>'; $('dlgSetup').showModal(); renderSetup(); });
$('setupRecheck').addEventListener('click', renderSetup);
$('setupClose').addEventListener('click', () => $('dlgSetup').close());

// ---------------------------------------------------------------- launching
async function launch(name) {
  try {
    const cmd = await window.bus.launch(name);
    toast(`Launched ${name}: ${cmd}`);
  } catch (e) { toast(`Launch failed: ${errText(e)}`, true); }
  refresh(true);
}

// Small text prompt (window.prompt is not available in Electron).
function ask(title, value = '') {
  return new Promise((resolve) => {
    const d = $('dlgAsk');
    $('askTitle').textContent = title; $('askInput').value = value;
    const done = (v) => { d.close(); $('askOk').onclick = $('askCancel').onclick = null; resolve(v); };
    $('askOk').onclick = (e) => { e.preventDefault(); done($('askInput').value.trim() || null); };
    $('askCancel').onclick = () => done(null);
    d.oncancel = () => done(null);
    d.showModal(); $('askInput').focus(); $('askInput').select();
  });
}

// ---------------------------------------------------------------- launch settings dialog
let editingOld = null;
function profileFromForm() {
  return {
    oldName: editingOld, name: $('pName').value.trim(), cli: $('pCli').value, cwd: $('pCwd').value.trim(),
    mode: $('pMode').value, session: $('pSession').value.trim(), project: $('pProject').value.trim(),
    extra: $('pExtra').value.trim(), prompt: $('pPrompt').value.trim(),
  };
}
async function updatePreview() {
  const p = profileFromForm();
  $('pSession').disabled = p.mode !== 'session';
  try { $('pPreview').textContent = p.name ? await window.bus.previewCommand(p) : '(enter a session name)'; } catch { $('pPreview').textContent = ''; }
}
function openProfile(name) {
  const s = name ? sessions().find((x) => x.name === name) : null;
  const p = s?.profile || {};
  editingOld = p.name || null;
  $('profileTitle').textContent = name ? `Launch settings: ${name}` : 'New session';
  $('pName').value = name || '';
  $('pCli').value = p.cli || (/codex/i.test(s?.kind || '') ? 'codex' : 'claude');
  $('pCwd').value = p.cwd || s?.cwd || '';
  const sid = p.session || s?.session_id || s?.st?.sessionId || '';
  $('pMode').value = p.mode || (sid ? 'session' : name ? 'pick' : 'new');
  $('pSession').value = sid;
  $('pProject').value = p.project || '';
  $('pExtra').value = p.extra || '';
  $('pPrompt').value = p.prompt || '';
  $('pErr').textContent = '';
  updatePreview();
  $('dlgProfile').showModal();
}
async function saveProfile(andLaunch) {
  $('pErr').textContent = '';
  try {
    const name = await window.bus.saveProfile(profileFromForm());
    $('dlgProfile').close();
    if (andLaunch) await launch(name); else refresh(true);
  } catch (e) { $('pErr').textContent = errText(e); }
}
for (const id of ['pName', 'pCli', 'pCwd', 'pMode', 'pSession', 'pExtra', 'pPrompt']) $(id).addEventListener('input', updatePreview);
$('pBrowse').addEventListener('click', async () => { const f = await window.bus.pickFolder($('pCwd').value); if (f) { $('pCwd').value = f; updatePreview(); } });
$('pCancel').addEventListener('click', () => $('dlgProfile').close());
$('pSave').addEventListener('click', () => saveProfile(false));
$('pSaveLaunch').addEventListener('click', () => saveProfile(true));
$('btnNewSession').addEventListener('click', () => openProfile(null));

// ---------------------------------------------------------------- sessions pane
function selectSession(name) {
  state.filter = state.filter === name ? '' : name;
  $('filterAgent').value = state.filter;
  if (state.filter && [...$('to').options].some((o) => o.value === name)) $('to').value = name;
  renderAgents(); renderLog(true);
}
$('agents').addEventListener('click', async (e) => {
  const head = e.target.closest('.projHead');
  const proj = head?.parentElement.dataset.project;
  if (proj) {
    const pr = state.projects.find((p) => p.name === proj);
    await window.bus.collapseProject(proj, !pr.collapsed);
    return refresh();
  }
  const row = e.target.closest('.sess');
  if (!row) return;
  if (e.target.dataset.act === 'launch') return launch(row.dataset.name);
  selectSession(row.dataset.name);
});
$('agents').addEventListener('dblclick', (e) => { const row = e.target.closest('.sess'); if (row) openStats(row.dataset.name); });

async function sendFileTo(name) {
  try { const r = await window.bus.sendFile(name); if (r) toast(`Sent file #${r.file_id} to ${name}`); } catch (e) { toast(errText(e), true); }
  refresh(true);
}

$('agents').addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  const row = e.target.closest('.sess');
  if (row) {
    const s = sessions().find((x) => x.name === row.dataset.name);
    const r = await window.bus.sessionMenu({ name: s.name, online: s.online, hasProfile: !!s.profile, remote: s.remote });
    if (!r) return;
    try {
      if (r.action === 'launch') return launch(s.name);
      if (r.action === 'edit') return openProfile(s.name);
      if (r.action === 'stats') return openStats(s.name);
      if (r.action === 'message') { if (state.agents.some((a) => a.name === s.name)) $('to').value = s.name; return $('body').focus(); }
      if (r.action === 'sendFile') return sendFileTo(s.name);
      if (r.action === 'assign') await window.bus.assignProject(s.name, r.project);
      if (r.action === 'newProject') { const p = await ask(`New project for ${s.name}`); if (p) await window.bus.assignProject(s.name, p); }
      if (r.action === 'forget') await window.bus.forget(s.name);
      if (r.action === 'deleteProfile') await window.bus.deleteProfile(s.name);
    } catch (err) { toast(errText(err), true); }
    return refresh(true);
  }
  const proj = e.target.closest('.proj')?.dataset.project;
  if (!proj) return;
  const r = await window.bus.projectMenu({ project: proj });
  if (!r) return;
  try {
    if (r.action === 'launchAll') for (const s of sessions().filter((x) => x.project === proj && !x.online && !x.remote)) await launch(s.name);
    if (r.action === 'message') { $('to').value = `project:${proj}`; $('body').focus(); }
    if (r.action === 'rename') { const n = await ask(`Rename project ${proj}`, proj); if (n && n !== proj) await window.bus.renameProject(proj, n); }
    if (r.action === 'delete') await window.bus.deleteProject(proj);
  } catch (err) { toast(errText(err), true); }
  refresh(true);
});
$('groupBy').addEventListener('change', () => { try { localStorage.setItem('groupBy', $('groupBy').checked ? '1' : '0'); } catch {} renderAgents(); });
try { if (localStorage.getItem('groupBy') === '0') $('groupBy').checked = false; } catch {}

$('filterAgent').addEventListener('change', (e) => { state.filter = e.target.value; refresh(true); });
$('search').addEventListener('input', (e) => { state.query = e.target.value; renderLog(true); });
$('log').addEventListener('click', async (e) => {
  const id = Number(e.target.dataset.file);
  if (!id) return;
  try {
    if (e.target.dataset.fact === 'save') { const p = await window.bus.saveFile(id); if (p) toast(`Saved to ${p}`); }
    else await window.bus.revealFile(id);
  } catch (err) { toast(errText(err), true); }
});

// ---------------------------------------------------------------- compose
$('compose').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('sendErr').textContent = '';
  const to = $('to').value, body = $('body').value;
  try {
    if (to.startsWith('project:')) {
      const proj = to.slice(8);
      const targets = sessions().filter((s) => s.project === proj && state.agents.some((a) => a.name === s.name));
      if (!targets.length) throw new Error('No sessions in that project are registered on the bus yet');
      for (const s of targets) await window.bus.send(s.name, `[project ${proj}] ${body}`);
    } else await window.bus.send(to, body);
    $('body').value = '';
    await refresh(true);
  } catch (err) { $('sendErr').textContent = errText(err); }
});
$('btnAttach').addEventListener('click', () => {
  const to = $('to').value;
  if (to.startsWith('project:')) return toast('Pick one session (or all) to send a file to', true);
  sendFileTo(to);
});
$('body').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); $('compose').requestSubmit(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' && e.ctrlKey) { e.preventDefault(); $('search').focus(); $('search').select(); }
});

// ---------------------------------------------------------------- theme / help
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
try { applyTheme(localStorage.getItem('theme')); } catch {}
// Theme cycles Tron (cyan) -> Clu (orange) -> Light; the choice is remembered per machine.
const THEMES = ['', 'clu', 'light'];
$('btnTheme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || '';
  const t = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  applyTheme(t);
  $('btnTheme').title = `Theme: ${t || 'tron'} (click to change)`;
  try { localStorage.setItem('theme', t); } catch {}
});
$('btnHelp').addEventListener('click', () => $('help').showModal());
$('btnCloseHelp').addEventListener('click', () => $('help').close());
$('btnFolder').addEventListener('click', () => window.bus.openFolder());

refresh(true);
refreshStats();
window.bus.setupStatus().then((items) => { const n = items.filter((i) => !i.ok && !i.na).length; $('setupBadge').textContent = n ? String(n) : ''; }).catch(() => {});
setInterval(refresh, 2000);
setInterval(refreshStats, 5000);
