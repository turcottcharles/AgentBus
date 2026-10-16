'use strict';
// The owner's shared keyring of keys, passwords and tokens: the same rules as agent_bus_mcp.py's bus_secret_*
// tools, for the hub (agents in VMs) and the app's Keyring panel.
class Keyring {
  constructor(db, ago) { this.db = db; this.ago = ago; }
  now() { return Date.now() / 1000; }
  all() { return this.db.prepare('SELECT * FROM secrets ORDER BY service, name').all(); }
  get(name) { return this.db.prepare('SELECT * FROM secrets WHERE name=?').get(String(name || '').trim()); }
  find(query) {
    const q = String(query || '').trim(), like = `%${q}%`;
    return this.db.prepare(`SELECT * FROM secrets WHERE ? = '' OR name LIKE ? OR service LIKE ? OR project LIKE ? OR found_at LIKE ?
      ORDER BY service, name`).all(q, like, like, like, like);
  }
  // Returns true when it updated an existing entry.
  add(by, e, { replace = false } = {}) {
    const name = String(e.name || '').trim(), value = String(e.value || '').trim();
    if (!name || !value) throw new Error('A keyring entry needs a name and a value.');
    const f = Object.fromEntries(['service', 'project', 'found_at'].map((k) => [k, String(e[k] || '').trim()]));
    const old = this.get(name);
    if (old && old.value !== value && !replace) {
      throw new Error(`The keyring already has '${old.name}' with a different value. Add this one under another name `
        + `(e.g. '${name}-${f.project || 'new'}'), or pass replace=true to overwrite it.`);
    }
    this.db.prepare(`INSERT INTO secrets(name,value,service,project,found_at,added_by,ts,updated) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated=excluded.updated,
      service=COALESCE(NULLIF(excluded.service,''),service), project=COALESCE(NULLIF(excluded.project,''),project),
      found_at=COALESCE(NULLIF(excluded.found_at,''),found_at)`)
      .run(name, value, f.service, f.project, f.found_at, by, this.now(), this.now());
    return !!old;
  }
  // The owner's edit from the app: every field as given, and the entry may be renamed.
  save(original, e) {
    const name = String(e.name || '').trim(), value = String(e.value || '').trim();
    if (!name || !value) throw new Error('A keyring entry needs a name and a value.');
    const clash = this.get(name);
    if (clash && (!original || clash.name.toLowerCase() !== String(original).toLowerCase())) throw new Error(`'${clash.name}' is already in the keyring.`);
    const f = ['service', 'project', 'found_at'].map((k) => String(e[k] || '').trim());
    if (original && this.get(original)) {
      this.db.prepare('UPDATE secrets SET name=?, value=?, service=?, project=?, found_at=?, updated=? WHERE name=?')
        .run(name, value, ...f, this.now(), String(original));
    } else {
      this.db.prepare('INSERT INTO secrets(name,value,service,project,found_at,added_by,ts,updated) VALUES(?,?,?,?,?,?,?,?)')
        .run(name, value, ...f, 'owner', this.now(), this.now());
    }
  }
  remove(name) { this.db.prepare('DELETE FROM secrets WHERE name=?').run(String(name)); }

  text(r) {
    const meta = [r.service && `service ${r.service}`, r.project && `project ${r.project}`, r.found_at && `found at ${r.found_at}`,
      `added by ${r.added_by}, ${this.ago(r.ts)}`].filter(Boolean).join(', ');
    return `${r.name} = ${r.value}\n  ${meta}`;
  }
  findText(query) {
    const q = String(query || '').trim(), rows = this.find(q);
    return rows.length ? rows.map((r) => this.text(r)).join('\n') : q ? `Nothing in the keyring matches '${q}'.` : 'The keyring is empty.';
  }
  getText(name, valueOnly) {
    const r = this.get(name);
    if (!r) return `No keyring entry named '${String(name).trim()}'.\n${this.findText(name)}`;
    return valueOnly ? r.value : this.text(r);
  }
}

module.exports = { Keyring };
