'use strict';
// Improvement proposals for Agent Bus itself: the same rules as agent_bus_mcp.py's bus_propose & co, for the hub
// (agents in VMs) and the app (the owner). Agents can file, discuss and move a proposal to refining, building or
// review; only the owner, from the app, can approve, close or reject one.
const STATUSES = ['proposed', 'refining', 'approved', 'building', 'review', 'done', 'rejected'];
const OWNER_ONLY = new Set(['approved', 'done', 'rejected']);

class Proposals {
  constructor(db, ago) { this.db = db; this.ago = ago; }
  now() { return Date.now() / 1000; }
  row(id) {
    const r = this.db.prepare('SELECT * FROM proposals WHERE id=?').get(Number(id));
    if (!r) throw new Error(`No proposal #${id}. Use bus_proposals to list them.`);
    return r;
  }
  tellOwner(author, text) {
    if (author !== 'owner') this.db.prepare('INSERT INTO messages(ts,sender,recipient,body) VALUES(?,?,?,?)').run(this.now(), author, 'owner', text);
  }
  propose(author, title, body) {
    title = String(title || '').trim(); body = String(body || '').trim();
    if (!title) throw new Error('A proposal needs a title.');
    const id = Number(this.db.prepare("INSERT INTO proposals(ts,author,title,body,status,branch,updated) VALUES(?,?,?,?,'proposed','',?)")
      .run(this.now(), author, title, body, this.now()).lastInsertRowid);
    this.tellOwner(author, `[proposal #${id}] ${title}\n${body.slice(0, 600)}\nOpen Steward in the Agent Bus app to discuss it.`);
    return id;
  }
  note(author, id, body) {
    body = String(body || '').trim();
    if (!body) throw new Error('The note is empty.');
    const p = this.row(id);
    this.db.prepare('INSERT INTO proposal_notes(proposal_id,ts,author,body) VALUES(?,?,?,?)').run(p.id, this.now(), author, body);
    this.db.prepare('UPDATE proposals SET updated=? WHERE id=?').run(this.now(), p.id);
    this.tellOwner(author, `[proposal #${p.id}] ${author} replied on '${p.title}':\n${body.slice(0, 600)}`);
  }
  setStatus(author, id, status, note, { owner = false, branch } = {}) {
    status = String(status || '').trim().toLowerCase();
    if (!STATUSES.includes(status)) throw new Error(`Status must be one of: ${STATUSES.join(', ')}.`);
    if (OWNER_ONLY.has(status) && !owner) throw new Error(`Only the owner can set '${status}', from Steward in the Agent Bus app.`);
    const p = this.row(id);
    this.db.prepare('UPDATE proposals SET status=?, updated=?, branch=COALESCE(?, branch) WHERE id=?').run(status, this.now(), branch ?? null, p.id);
    if (note) this.db.prepare('INSERT INTO proposal_notes(proposal_id,ts,author,body) VALUES(?,?,?,?)').run(p.id, this.now(), author, `[status -> ${status}] ${note}`);
    this.tellOwner(author, `[proposal #${p.id}] is now '${status}'.${note ? `\n${note}` : ''}`);
  }
  list(status, limit = 30) {
    return status
      ? this.db.prepare('SELECT * FROM proposals WHERE status=? ORDER BY id DESC LIMIT ?').all(status, Number(limit) || 30)
      : this.db.prepare('SELECT * FROM proposals ORDER BY id DESC LIMIT ?').all(Number(limit) || 30);
  }
  notes(id) { return this.db.prepare('SELECT * FROM proposal_notes WHERE proposal_id=? ORDER BY id').all(Number(id)); }
  listText(status, limit) {
    return this.list(status, limit).map((p) => `#${p.id} [${p.status}] ${p.title} (by ${p.author}, ${this.ago(p.ts)})`).join('\n') || 'No proposals yet.';
  }
  showText(id) {
    const p = this.row(id);
    const out = [`#${p.id} [${p.status}] ${p.title}`, `by ${p.author}, ${this.ago(p.ts)}${p.branch ? `, branch ${p.branch}` : ''}`, '', p.body || '(no description)'];
    for (const n of this.notes(p.id)) out.push('', `--- ${n.author}, ${this.ago(n.ts)}:`, n.body);
    return out.join('\n');
  }
}

module.exports = { Proposals, STATUSES, OWNER_ONLY };
