"""agent-bus: a small shared message bus for Claude Code and Codex agents.

It is a stdio MCP server that uses only the Python standard library. Every client (each Claude Code
or Codex session) starts its own copy.

Local mode: copies on one machine share one SQLite file next to this script (or AGENT_BUS_DB).
Remote/push mode: every tool call goes over HTTP to the hub. Discovery order is AGENT_BUS_URL,
then bus-connection.json beside that exact database (the running desktop or standalone hub),
then ~/.agent-bus/config.json. A local descriptor wins over a leftover home URL so host
Codex/Cursor sessions stay on the owner app. Direct SQLite writes remain durable but do not
publish push events.

Agents register a name, list one another, send messages and files, and read their inbox.
bus_inbox marks messages read. Stream delivery (bus-watch) does not.
"""
import glob, hashlib, json, os, socket, sqlite3, sys, threading, time
import urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("AGENT_BUS_DB", os.path.join(HERE, "bus.sqlite"))
FILES = os.path.join(os.path.dirname(DB), "files")
MAX_FILE = 200 * 1024 * 1024


def _loopback_hub(url, token, db_path=None):
    target = urllib.parse.urlparse(url or "")
    if target.scheme != "http" or target.hostname != "127.0.0.1" or not token:
        return None
    if db_path is not None and os.path.normcase(os.path.abspath(db_path)) != os.path.normcase(os.path.abspath(DB)):
        return None
    return url.rstrip("/"), token


def load_remote():
    url, token = os.environ.get("AGENT_BUS_URL"), os.environ.get("AGENT_BUS_TOKEN")
    if url:
        return url.rstrip("/"), token
    descriptor = os.path.join(os.path.dirname(DB), "bus-connection.json")
    if os.path.exists(descriptor):
        with open(descriptor, encoding="utf-8") as f:
            local = json.load(f)
        found = _loopback_hub(local.get("url"), local.get("token"), local.get("db", ""))
        if not found:
            raise ValueError("Invalid local Agent Bus connection descriptor")
        return found
    cfg = os.path.join(os.path.expanduser("~"), ".agent-bus", "config.json")
    if os.path.exists(cfg):
        with open(cfg, encoding="utf-8") as f:
            c = json.load(f)
        url, token = c.get("url"), token or c.get("token")
        if url:
            return url.rstrip("/"), token
    return None, None


REMOTE_URL, REMOTE_TOKEN = load_remote()
me = {"name": os.environ.get("AGENT_BUS_NAME")}


def session_meta():
    """What this session's environment tells us about it, for the Agent Bus app's stats view."""
    e = os.environ
    cli = "claude" if e.get("CLAUDECODE") else "codex" if any(k.startswith("CODEX_") for k in e) else ""
    return {"cli": cli, "session_id": e.get("CLAUDE_CODE_SESSION_ID") or e.get("CODEX_THREAD_ID") or e.get("CODEX_SESSION_ID") or "",
            "effort": e.get("CLAUDE_EFFORT", ""), "pid": e.get("CLAUDE_PID", ""), "host": socket.gethostname(),
            "platform": sys.platform, "cwd": os.getcwd()}


# ---------------------------------------------------------------- remote transport

def http(path, payload=None, raw=None, headers=None, timeout=330):
    h = {"Authorization": f"Bearer {REMOTE_TOKEN}", **(headers or {})}
    data = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else None)
    if payload is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(REMOTE_URL + path, data=data, headers=h, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(), r.headers
    except urllib.error.HTTPError as e:
        raise ValueError(e.read().decode("utf-8", "replace") or str(e))
    except urllib.error.URLError as e:
        raise ValueError(f"Agent Bus hub at {REMOTE_URL} is unreachable ({e.reason}). Is the Agent Bus app running on the host?")


def rpc(tool, args):
    body, _ = http("/rpc", {"tool": tool, "args": args, "as": args.get("as") or me["name"], "meta": session_meta()})
    return json.loads(body)["text"]


# ---------------------------------------------------------------- local implementation

def db():
    c = sqlite3.connect(DB, timeout=10)
    c.execute("PRAGMA journal_mode=WAL")
    c.executescript("""
      CREATE TABLE IF NOT EXISTS agents(name TEXT PRIMARY KEY, kind TEXT, note TEXT, cwd TEXT, last_seen REAL);
      CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, sender TEXT,
        recipient TEXT, body TEXT);
      CREATE TABLE IF NOT EXISTS reads(agent TEXT, msg_id INTEGER, PRIMARY KEY(agent, msg_id));
      CREATE TABLE IF NOT EXISTS agent_meta(name TEXT PRIMARY KEY, cli TEXT, session_id TEXT, effort TEXT,
        pid TEXT, host TEXT, platform TEXT, remote INTEGER, updated REAL, stats TEXT, addr TEXT);
      CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, sender TEXT, recipient TEXT,
        name TEXT, size INTEGER, sha256 TEXT, path TEXT);
      CREATE TABLE IF NOT EXISTS events(ts REAL, agent TEXT, kind TEXT, name TEXT, ok INTEGER, ms REAL, detail TEXT);
      CREATE TABLE IF NOT EXISTS proposals(id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, author TEXT, title TEXT,
        body TEXT, status TEXT, branch TEXT, updated REAL);
      CREATE TABLE IF NOT EXISTS proposal_notes(id INTEGER PRIMARY KEY AUTOINCREMENT, proposal_id INTEGER, ts REAL,
        author TEXT, body TEXT);
      CREATE TABLE IF NOT EXISTS secrets(name TEXT PRIMARY KEY COLLATE NOCASE, value TEXT, service TEXT, project TEXT,
        found_at TEXT, added_by TEXT, ts REAL, updated REAL);""")
    return c


def touch(c, name=None):
    name = name or me["name"]
    if name:
        c.execute("UPDATE agents SET last_seen=? WHERE name=?", (time.time(), name))


def save_meta(c, name, meta, remote=0):
    c.execute("INSERT INTO agent_meta(name,cli,session_id,effort,pid,host,platform,remote,updated) "
              "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET cli=excluded.cli, "
              "session_id=COALESCE(NULLIF(excluded.session_id,''),agent_meta.session_id), effort=excluded.effort, "
              "pid=excluded.pid, host=excluded.host, platform=excluded.platform, remote=excluded.remote, "
              "updated=excluded.updated",
              (name, meta.get("cli", ""), meta.get("session_id", ""), meta.get("effort", ""), meta.get("pid", ""),
               meta.get("host", ""), meta.get("platform", ""), remote, time.time()))


def ago(t):
    s = int(time.time() - (t or 0))
    return f"{s}s ago" if s < 120 else f"{s // 60}m ago" if s < 7200 else f"{s // 3600}h ago"


def need_name(args):
    name = args.get("as") or me["name"]
    if not name:
        raise ValueError("Not registered. Call bus_register first (or pass 'as').")
    return name


def t_register(a):
    name = a["name"].strip()
    if name in ("all", "owner") or not name:
        raise ValueError("Pick a name other than 'all' or 'owner'.")
    meta = session_meta()
    with db() as c:
        c.execute("INSERT INTO agents(name,kind,note,cwd,last_seen) VALUES(?,?,?,?,?) "
                  "ON CONFLICT(name) DO UPDATE SET kind=excluded.kind, note=excluded.note, cwd=excluded.cwd, "
                  "last_seen=excluded.last_seen",
                  (name, a.get("kind", ""), a.get("note", ""), meta["cwd"], time.time()))
        save_meta(c, name, meta)
    me["name"] = name
    return f"Registered as '{name}'. Others reach you with bus_send(to='{name}')."


def t_list(a):
    with db() as c:
        touch(c, a.get("as"))
        rows = c.execute("SELECT a.name,a.kind,a.note,a.cwd,a.last_seen,m.host,m.remote FROM agents a "
                         "LEFT JOIN agent_meta m ON m.name=a.name ORDER BY a.last_seen DESC").fetchall()
    if not rows:
        return "No agents registered yet."
    return "\n".join(f"- {n} [{k}] seen {ago(t)} | {note} | {cwd}{f' | on {h} (VM/remote)' if r else ''}"
                     for n, k, note, cwd, t, h, r in rows)


def deliver(c, sender, to, body):
    if to != "all" and not c.execute("SELECT 1 FROM agents WHERE name=?", (to,)).fetchone():
        raise ValueError(f"Unknown agent '{to}'. Use bus_list to see registered names.")
    cur = c.execute("INSERT INTO messages(ts,sender,recipient,body) VALUES(?,?,?,?)", (time.time(), sender, to, body))
    touch(c, sender)
    return cur.lastrowid


def t_send(a):
    sender, to = need_name(a), a["to"].strip()
    with db() as c:
        mid = deliver(c, sender, to, a["body"])
    return f"Sent message #{mid} to {to}."


def fetch_inbox(name):
    with db() as c:
        touch(c, name)
        rows = c.execute(
            "SELECT id,ts,sender,recipient,body FROM messages m WHERE (recipient=? OR (recipient='all' AND sender<>?)) "
            "AND NOT EXISTS (SELECT 1 FROM reads r WHERE r.agent=? AND r.msg_id=m.id) ORDER BY id",
            (name, name, name)).fetchall()
        if rows:
            c.executemany("INSERT OR IGNORE INTO reads VALUES(?,?)", [(name, r[0]) for r in rows])
    return "\n\n".join(f"#{i} from {s}{' (broadcast)' if rc == 'all' else ''}, {ago(ts)}:\n{b}"
                       for i, ts, s, rc, b in rows)


def t_inbox(a):
    name = need_name(a)
    deadline = time.time() + min(max(int(a.get("wait_seconds", 0)), 0), 300)
    while True:
        text = fetch_inbox(name)
        if text:
            return text
        if time.time() >= deadline:
            return "No new messages."
        time.sleep(2)


def t_history(a):
    name = need_name(a)
    other = a.get("with")
    q = "SELECT id,ts,sender,recipient,body FROM messages WHERE "
    if other:
        q += "((sender=? AND recipient=?) OR (sender=? AND recipient=?))"
        p = (name, other, other, name)
    else:
        q += "(sender=? OR recipient=? OR recipient='all')"
        p = (name, name)
    with db() as c:
        rows = c.execute(q + " ORDER BY id DESC LIMIT ?", p + (int(a.get("limit", 20)),)).fetchall()
    return "\n\n".join(f"#{i} {s} -> {rc}, {ago(ts)}:\n{b}" for i, ts, s, rc, b in reversed(rows)) or "No messages."


def store_file(sender, to, name, data, note=""):
    """Keep a copy of the file in the bus store and send the recipient a message pointing at it."""
    if len(data) > MAX_FILE:
        raise ValueError(f"File is {len(data)} bytes; the limit is {MAX_FILE}. Split or compress it.")
    name = os.path.basename(name.replace("\\", "/")) or "file"
    digest = hashlib.sha256(data).hexdigest()
    with db() as c:
        if to != "all" and not c.execute("SELECT 1 FROM agents WHERE name=?", (to,)).fetchone():
            raise ValueError(f"Unknown agent '{to}'. Use bus_list to see registered names.")
        fid = c.execute("INSERT INTO files(ts,sender,recipient,name,size,sha256,path) VALUES(?,?,?,?,?,?,'')",
                        (time.time(), sender, to, name, len(data), digest)).lastrowid
        folder = os.path.join(FILES, str(fid))
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, name)
        with open(path, "wb") as f:
            f.write(data)
        c.execute("UPDATE files SET path=? WHERE id=?", (path, fid))
        body = (f"[file #{fid}] {name} ({len(data):,} bytes, sha256 {digest[:12]}...)"
                + (f"\n{note}" if note else "") + f"\nFetch it with bus_get_file(file_id={fid}).")
        mid = deliver(c, sender, to, body)
    return fid, mid


def t_send_file(a):
    sender, to, path = need_name(a), a["to"].strip(), os.path.abspath(os.path.expanduser(a["path"]))
    if not os.path.isfile(path):
        raise ValueError(f"No such file: {path}. To send a folder, zip it first.")
    if os.path.getsize(path) > MAX_FILE:
        raise ValueError(f"File is larger than the {MAX_FILE} byte limit.")
    with open(path, "rb") as f:
        data = f.read()
    if REMOTE_URL:
        q = urllib.parse.urlencode({"to": to, "name": os.path.basename(path), "note": a.get("note", ""), "as": sender})
        body, _ = http("/files?" + q, raw=data, headers={"Content-Type": "application/octet-stream"}, timeout=600)
        r = json.loads(body)
        fid, mid = r["file_id"], r["message_id"]
    else:
        fid, mid = store_file(sender, to, path, data, a.get("note", ""))
    return f"Sent file #{fid} ({os.path.basename(path)}) to {to} as message #{mid}."


def t_get_file(a):
    fid = int(a["file_id"])
    dest = os.path.abspath(os.path.expanduser(a.get("dest") or os.path.join(os.getcwd(), "bus-files")))
    if REMOTE_URL:
        data, headers = http(f"/files/{fid}", timeout=600)
        name = os.path.basename(urllib.parse.unquote(headers.get("X-File-Name", f"file-{fid}")))
        digest = headers.get("X-File-Sha256", "")
    else:
        with db() as c:
            row = c.execute("SELECT name, path, sha256 FROM files WHERE id=?", (fid,)).fetchone()
        if not row:
            raise ValueError(f"No file #{fid} on the bus.")
        name, src, digest = row
        with open(src, "rb") as f:
            data = f.read()
    if digest and hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"File #{fid} failed its sha256 check; ask the sender to resend it.")
    os.makedirs(dest, exist_ok=True)
    out = os.path.join(dest, name)
    with open(out, "wb") as f:
        f.write(data)
    return f"Saved file #{fid} to {out} ({len(data):,} bytes, sha256 verified)."


def t_files(a):
    name = need_name(a)
    with db() as c:
        rows = c.execute("SELECT id,ts,sender,recipient,name,size FROM files WHERE sender=? OR recipient IN (?, 'all') "
                         "ORDER BY id DESC LIMIT ?", (name, name, int(a.get("limit", 20)))).fetchall()
    return "\n".join(f"#{i} {n} ({sz:,} bytes) {s} -> {r}, {ago(ts)}" for i, ts, s, r, n, sz in rows) or "No files."


# ---------------------------------------------------------------- improvement proposals (the steward loop)
# The steward agent studies usage trends and files proposals for improving Agent Bus itself. The owner refines
# them in the app, approves one, and a builder agent implements it on a git branch for review.

STATUSES = ("proposed", "refining", "approved", "building", "review", "done", "rejected")
OWNER_ONLY = {"approved", "done", "rejected"}   # agents can't approve or close their own proposals
DIGEST = os.path.join(os.path.dirname(DB), "steward", "digest.md")


def proposal_row(c, pid):
    row = c.execute("SELECT id,ts,author,title,body,status,branch FROM proposals WHERE id=?", (pid,)).fetchone()
    if not row:
        raise ValueError(f"No proposal #{pid}. Use bus_proposals to list them.")
    return row


def tell_owner(c, author, text):
    if author != "owner":   # the owner reads in the app and need not be registered, so skip deliver()'s check
        c.execute("INSERT INTO messages(ts,sender,recipient,body) VALUES(?,?,?,?)", (time.time(), author, "owner", text))


def t_propose(a):
    author = need_name(a)
    title, body = a["title"].strip(), a.get("body", "").strip()
    if not title:
        raise ValueError("A proposal needs a title.")
    now = time.time()
    with db() as c:
        pid = c.execute("INSERT INTO proposals(ts,author,title,body,status,branch,updated) VALUES(?,?,?,?,'proposed','',?)",
                        (now, author, title, body, now)).lastrowid
        tell_owner(c, author, f"[proposal #{pid}] {title}\n{body[:600]}\nOpen Steward in the Agent Bus app to discuss it.")
    return f"Filed proposal #{pid}: {title}"


def t_proposals(a):
    q, p = "SELECT id,ts,author,title,status FROM proposals", ()
    if a.get("status"):
        q, p = q + " WHERE status=?", (a["status"],)
    with db() as c:
        rows = c.execute(q + " ORDER BY id DESC LIMIT ?", p + (int(a.get("limit", 30)),)).fetchall()
    return "\n".join(f"#{i} [{st}] {t} (by {au}, {ago(ts)})" for i, ts, au, t, st in rows) or "No proposals yet."


def t_proposal(a):
    pid = int(a["proposal_id"])
    with db() as c:
        i, ts, au, t, body, st, br = proposal_row(c, pid)
        notes = c.execute("SELECT ts,author,body FROM proposal_notes WHERE proposal_id=? ORDER BY id", (pid,)).fetchall()
    out = [f"#{i} [{st}] {t}", f"by {au}, {ago(ts)}" + (f", branch {br}" if br else ""), "", body or "(no description)"]
    for nts, nau, nb in notes:
        out += ["", f"--- {nau}, {ago(nts)}:", nb]
    return "\n".join(out)


def t_proposal_note(a):
    author, pid, body = need_name(a), int(a["proposal_id"]), a["body"].strip()
    with db() as c:
        title = proposal_row(c, pid)[3]
        c.execute("INSERT INTO proposal_notes(proposal_id,ts,author,body) VALUES(?,?,?,?)", (pid, time.time(), author, body))
        c.execute("UPDATE proposals SET updated=? WHERE id=?", (time.time(), pid))
        tell_owner(c, author, f"[proposal #{pid}] {author} replied on '{title}':\n{body[:600]}")
    return f"Added a note to proposal #{pid}."


def t_proposal_status(a):
    author, pid, status = need_name(a), int(a["proposal_id"]), a["status"].strip().lower()
    if status not in STATUSES:
        raise ValueError(f"Status must be one of: {', '.join(STATUSES)}.")
    if status in OWNER_ONLY:   # the app writes these itself; no agent identity, 'owner' included, may set them here
        raise ValueError(f"Only the owner can set '{status}', from Steward in the Agent Bus app.")
    with db() as c:
        proposal_row(c, pid)
        c.execute("UPDATE proposals SET status=?, updated=? WHERE id=?", (status, time.time(), pid))
        if a.get("note"):
            c.execute("INSERT INTO proposal_notes(proposal_id,ts,author,body) VALUES(?,?,?,?)",
                      (pid, time.time(), author, f"[status -> {status}] {a['note']}"))
        tell_owner(c, author, f"[proposal #{pid}] is now '{status}'." + (f"\n{a['note']}" if a.get("note") else ""))
    return f"Proposal #{pid} is now '{status}'."


def t_usage_digest(a):
    if not os.path.exists(DIGEST):
        return "No usage digest yet. The Agent Bus app writes one while it runs (Steward -> Refresh digest)."
    with open(DIGEST, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------- keyring
# One shared store of keys, passwords and tokens. Any agent that comes across one adds it, so the owner and other
# agents can find it again from any project. The owner manages the same entries in the app's Keyring panel.

def secret_text(r):
    name, value, service, project, found_at, by, ts = r
    meta = ", ".join(x for x in (service and f"service {service}", project and f"project {project}",
                                 found_at and f"found at {found_at}", f"added by {by}, {ago(ts)}") if x)
    return f"{name} = {value}\n  {meta}"


def t_secret_add(a):
    by = need_name(a)
    name, value = a["name"].strip(), a["value"].strip()
    if not name or not value:
        raise ValueError("A keyring entry needs a name and a value.")
    f = {k: (a.get(k) or "").strip() for k in ("service", "project", "found_at")}
    now = time.time()
    with db() as c:
        old = c.execute("SELECT name,value FROM secrets WHERE name=?", (name,)).fetchone()
        if old and old[1] != value and not a.get("replace"):
            raise ValueError(f"The keyring already has '{old[0]}' with a different value. Add this one under another "
                             f"name (e.g. '{name}-{f['project'] or 'new'}'), or pass replace=true to overwrite it.")
        c.execute("INSERT INTO secrets(name,value,service,project,found_at,added_by,ts,updated) VALUES(?,?,?,?,?,?,?,?) "
                  "ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated=excluded.updated, "
                  "service=COALESCE(NULLIF(excluded.service,''),service), project=COALESCE(NULLIF(excluded.project,''),project), "
                  "found_at=COALESCE(NULLIF(excluded.found_at,''),found_at)",
                  (name, value, f["service"], f["project"], f["found_at"], by, now, now))
    return f"{'Updated' if old else 'Added'} '{name}' in the keyring."


def t_secret_find(a):
    q = (a.get("query") or "").strip()
    like = f"%{q}%"
    with db() as c:
        rows = c.execute("SELECT name,value,service,project,found_at,added_by,ts FROM secrets WHERE ? = '' OR name LIKE ? "
                         "OR service LIKE ? OR project LIKE ? OR found_at LIKE ? ORDER BY service, name",
                         (q, like, like, like, like)).fetchall()
    if not rows:
        return f"Nothing in the keyring matches '{q}'." if q else "The keyring is empty."
    return "\n".join(secret_text(r) for r in rows)


def t_secret_get(a):
    name = a["name"].strip()
    with db() as c:
        r = c.execute("SELECT name,value,service,project,found_at,added_by,ts FROM secrets WHERE name=?", (name,)).fetchone()
    if not r:
        return f"No keyring entry named '{name}'.\n" + t_secret_find({"query": name})
    return r[1] if a.get("value_only") else secret_text(r)


S = lambda props, req=(): {"type": "object", "properties": props, "required": list(req)}
STR = {"type": "string"}
AS = {"as": {"type": "string", "description": "Your registered name, if this session hasn't called bus_register."}}
TOOLS = {
    "bus_register": (t_register, "Register this agent on the shared agent bus under a unique name (e.g. 'claude-supervisor', "
                     "'codex-electron-eval'). Call once per session before sending or reading.",
                     S({"name": STR, "kind": {"type": "string", "description": "e.g. claude-code, codex-desktop"},
                        "note": {"type": "string", "description": "Role / what you're working on"}}, ["name"])),
    "bus_list": (t_list, "List all agents registered on the bus (including ones in VMs), with role and last-seen time.", S({})),
    "bus_send": (t_send, "Send a message to a registered agent by name, or to 'all'.",
                 S({"to": STR, "body": STR, **AS}, ["to", "body"])),
    "bus_inbox": (t_inbox, "Read your unread messages (marks them read). wait_seconds (0-300) waits for new mail.",
                  S({"wait_seconds": {"type": "integer"}, **AS})),
    "bus_history": (t_history, "Show recent messages involving you, optionally only with one agent.",
                    S({"with": STR, "limit": {"type": "integer"}, **AS})),
    "bus_send_file": (t_send_file, "Send a file (up to 200 MB; zip folders first) to an agent or 'all'. Works across VMs: "
                      "the bus keeps a copy and the recipient gets a message with the file id.",
                      S({"to": STR, "path": {"type": "string", "description": "Local path of the file to send"},
                         "note": {"type": "string", "description": "What it is / what to do with it"}, **AS}, ["to", "path"])),
    "bus_get_file": (t_get_file, "Download a file sent over the bus by its id into dest (default ./bus-files). "
                     "Verifies sha256.", S({"file_id": {"type": "integer"}, "dest": STR, **AS}, ["file_id"])),
    "bus_files": (t_files, "List recent files sent to or by you.", S({"limit": {"type": "integer"}, **AS})),
    "bus_usage_digest": (t_usage_digest, "Usage trends across all agents on this bus (tool use, errors, delivery delays, "
                         "token/quota use, app feature use). Input for proposing Agent Bus improvements.", S({})),
    "bus_propose": (t_propose, "File a proposal to improve Agent Bus itself (title + body: problem, evidence from the usage "
                    "digest, proposed change, expected benefit). The owner reviews it in the app.",
                    S({"title": STR, "body": STR, **AS}, ["title", "body"])),
    "bus_proposals": (t_proposals, "List improvement proposals, optionally by status "
                      "(proposed, refining, approved, building, review, done, rejected).",
                      S({"status": STR, "limit": {"type": "integer"}})),
    "bus_proposal": (t_proposal, "Show one proposal with its whole discussion.",
                     S({"proposal_id": {"type": "integer"}}, ["proposal_id"])),
    "bus_proposal_note": (t_proposal_note, "Add to a proposal's discussion (answer the owner, refine the design, report progress).",
                          S({"proposal_id": {"type": "integer"}, "body": STR, **AS}, ["proposal_id", "body"])),
    "bus_proposal_status": (t_proposal_status, "Move a proposal along: refining, building, review (builder finished; owner "
                            "reviews). Only the owner can approve, close or reject.",
                            S({"proposal_id": {"type": "integer"}, "status": STR, "note": STR, **AS}, ["proposal_id", "status"])),
    "bus_secret_add": (t_secret_add, "Add a key, password or token to the owner's shared keyring. Whenever you come across "
                       "one in any project (config files, .env, docs, the owner telling you), add it here so the owner "
                       "and other agents can find it later.",
                       S({"name": {"type": "string", "description": "Short unique name, e.g. openai-api-key"},
                          "value": STR, "service": {"type": "string", "description": "What it is for, e.g. OpenAI, GitHub"},
                          "project": {"type": "string", "description": "Project it came from"},
                          "found_at": {"type": "string", "description": "Where you found it, e.g. a file path"},
                          "replace": {"type": "boolean", "description": "Overwrite an entry of the same name"}, **AS},
                         ["name", "value"])),
    "bus_secret_find": (t_secret_find, "Search the owner's shared keyring by name, service, project or where it was found "
                        "(empty query lists everything). Check here before asking the owner for a key.",
                        S({"query": STR})),
    "bus_secret_get": (t_secret_get, "Get one keyring entry by name (value_only=true returns just the value).",
                       S({"name": STR, "value_only": {"type": "boolean"}}, ["name"])),
}
LOCAL_ONLY = {"bus_send_file", "bus_get_file"}  # these touch local paths, so they run here and stream over HTTP


CLI_MODE = False


def log_event(name, args, ok, ms, detail=""):
    """Usage telemetry for the steward: which tools agents use, how long they take, what fails. Never message text."""
    try:
        with db() as c:
            c.execute("INSERT INTO events(ts,agent,kind,name,ok,ms,detail) VALUES(?,?,?,?,?,?,?)",
                      (time.time(), args.get("as") or me["name"] or "", "cli" if CLI_MODE else "mcp", name, int(ok), ms,
                       detail[:300]))
    except sqlite3.Error:
        pass


def call_tool(name, args):
    global REMOTE_URL, REMOTE_TOKEN
    if not REMOTE_URL:
        REMOTE_URL, REMOTE_TOKEN = load_remote()
    if REMOTE_URL and name not in LOCAL_ONLY:
        text = rpc(name, args)   # the hub logs remote calls
        if name == "bus_register":
            me["name"] = args["name"].strip()
        return text
    t0 = time.time()
    try:
        text = TOOLS[name][0](args)
    except Exception as e:
        if not REMOTE_URL:
            log_event(name, args, False, (time.time() - t0) * 1000, str(e))
        raise
    if not REMOTE_URL:
        detail = ""
        if name == "bus_inbox":
            n = 0 if text == "No new messages." else text.count("\n\n#") + 1
            detail = f"delivered={n} waited={int(args.get('wait_seconds', 0) or 0)}"
        log_event(name, args, True, (time.time() - t0) * 1000, detail)
    return text


# ---------------------------------------------------------------- heartbeat and session stats

def codex_rollout_stats():
    """Latest token, context and quota figures from this machine's newest Codex rollout (for VM sessions,
    whose transcripts the host app cannot read)."""
    root = os.path.join(os.path.expanduser("~"), ".codex", "sessions")
    files = glob.glob(os.path.join(root, "*", "*", "*", "rollout-*.jsonl"))
    if not files:
        return None
    path = max(files, key=os.path.getmtime)
    out = {"file": os.path.basename(path)}
    with open(path, "rb") as f:
        f.seek(max(0, os.path.getsize(path) - 512 * 1024))
        for line in f.read().decode("utf-8", "replace").splitlines():
            if '"token_count"' not in line and '"turn_context"' not in line and '"session_meta"' not in line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                continue
            p = o.get("payload") or {}
            if o.get("type") == "session_meta":
                out["account"] = p.get("creator_account_id")
            elif p.get("type") == "token_count" and p.get("info"):
                out["info"], out["rate_limits"], out["ts"] = p["info"], p.get("rate_limits"), o.get("timestamp")
            elif o.get("type") == "turn_context":
                out["model"], out["effort"] = p.get("model"), p.get("effort") or p.get("reasoning_effort")
    return out


def heartbeat():
    # Keeps last_seen fresh for as long as this server (and so its session) is alive; the app's online dot uses it.
    while True:
        try:
            if me["name"]:
                if REMOTE_URL:
                    meta = session_meta()
                    http("/heartbeat", {"as": me["name"], "meta": meta,
                                        "stats": codex_rollout_stats() if meta["cli"] != "claude" else None}, timeout=15)
                else:
                    with db() as c:
                        touch(c)
        except Exception:
            pass
        time.sleep(30)


def reply(i, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": i}
    msg["error" if error else "result"] = error or result
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def serve():
    # A launcher (the Agent Bus app) can name the session up front through AGENT_BUS_NAME.
    if me["name"]:
        try:
            call_tool("bus_register", {"name": me["name"], "kind": os.environ.get("AGENT_BUS_KIND", ""),
                                       "note": os.environ.get("AGENT_BUS_NOTE", "")})
        except Exception:
            pass
    threading.Thread(target=heartbeat, daemon=True).start()
    where = f"the Agent Bus hub at {REMOTE_URL}" if REMOTE_URL else "this machine"
    for line in sys.stdin:
        if not line.strip():
            continue
        req = json.loads(line)
        m, i = req.get("method"), req.get("id")
        if i is None:
            continue
        if m == "initialize":
            named = me["name"] or "unset — call bus_register with a unique name first"
            reply(i, {"protocolVersion": req.get("params", {}).get("protocolVersion", "2024-11-05"),
                      "capabilities": {"tools": {}}, "serverInfo": {"name": "agent-bus", "version": "1.1"},
                      "instructions": (f"Shared Agent Bus via {where}, including agents in local VMs. "
                                       f"Your routing name is '{named}'. At the start of each turn call bus_inbox. "
                                       "Reply with bus_send to the sender, to 'owner', or to a name from bus_list. "
                                       "These tools deliver mail; they do not wake a sleeping Codex/Cursor/Claude session.")})
        elif m == "tools/list":
            reply(i, {"tools": [{"name": n, "description": d, "inputSchema": s} for n, (_, d, s) in TOOLS.items()]})
        elif m == "tools/call":
            p = req.get("params", {})
            try:
                text, err = call_tool(p["name"], p.get("arguments") or {}), False
            except Exception as e:
                text, err = f"Error: {e}", True
            reply(i, {"content": [{"type": "text", "text": text}], "isError": err})
        elif m == "ping":
            reply(i, {})
        else:
            reply(i, error={"code": -32601, "message": f"Unknown method {m}"})


# ---------------------------------------------------------------- CLI (command-plane/1)
# For harnesses without MCP. Same tools, as a noun-verb command graph with plain positional words:
#   agent-bus msg send sonnet-5b build is green      agent-bus msg inbox wait 60      agent-bus ?
# Unique prefixes abbreviate (m s = msg send); `?` lists the legal next words; errors end with a Recovery line.

IDENTITY = os.path.join(os.path.expanduser("~"), ".agent-bus", "cli-identity.json")

# noun -> verb -> (tool, positional params, keyword params, ? text). A trailing "*" param takes the rest of the line.
GRAPH = {
    "agent": {
        "register": ("bus_register", ["name"], {"kind": "kind", "note": "note*"}, "Join the bus as NAME [kind KIND] [note TEXT...]."),
        "list": ("bus_list", [], {}, "List agents on the bus, including ones in VMs."),
        "whoami": (None, [], {}, "Show which name this shell's commands are sent as."),
    },
    "msg": {
        "send": ("bus_send", ["to", "body*"], {"from-file": "from_file"}, "Send TEXT... to an agent or 'all' (or: send TO from-file PATH, or TO - for stdin)."),
        "inbox": ("bus_inbox", [], {"wait": "wait_seconds"}, "Read unread messages [wait SECONDS, up to 300]."),
        "history": ("bus_history", [], {"with": "with", "limit": "limit"}, "Show recent messages [with NAME] [limit N]."),
    },
    "proposal": {
        "add": ("bus_propose", ["title*"], {"body": "body*", "from-file": "from_file"},
                "File an Agent Bus improvement: TITLE... body TEXT... (or from-file PATH for the body)."),
        "list": ("bus_proposals", [], {"status": "status", "limit": "limit"}, "List proposals [status STATUS] [limit N]."),
        "show": ("bus_proposal", ["proposal_id"], {}, "Show proposal ID with its discussion."),
        "note": ("bus_proposal_note", ["proposal_id", "body*"], {"from-file": "from_file"}, "Add TEXT... to proposal ID's discussion."),
        "status": ("bus_proposal_status", ["proposal_id", "status"], {"note": "note*"},
                   "Set proposal ID to refining, building or review [note TEXT...]."),
    },
    "usage": {
        "digest": ("bus_usage_digest", [], {}, "Print the usage-trend digest the steward works from."),
    },
    "secret": {
        "add": ("bus_secret_add", ["name", "value"], {"service": "service", "project": "project", "found-at": "found_at",
                                                      "replace": "replace"},
                "Add NAME VALUE to the keyring [service S] [project P] [found-at PATH] [replace yes]."),
        "find": ("bus_secret_find", ["query*"], {}, "Search the keyring [TEXT...]; no text lists everything."),
        "get": ("bus_secret_get", ["name"], {"value-only": "value_only"}, "Show entry NAME [value-only yes] prints just the value."),
    },
    "file": {
        "send": ("bus_send_file", ["to", "path"], {"note": "note*"}, "Send the file at PATH to an agent or 'all' [note TEXT...]."),
        "get": ("bus_get_file", ["file_id"], {"to": "dest"}, "Download file ID [to DIR] (default ./bus-files); sha256 is checked."),
        "list": ("bus_files", [], {"limit": "limit"}, "List recent files sent to or by you [limit N]."),
    },
}
NOUN_HELP = {"agent": "Who is on the bus; join it.", "msg": "Send and read messages.", "file": "Exchange files, across VMs too.",
             "proposal": "Improvement proposals for Agent Bus (the steward loop).", "usage": "Usage trends across all agents.",
             "secret": "The owner's shared keyring of keys, passwords and tokens."}


class CliError(Exception):
    def __init__(self, msg, recovery):
        super().__init__(msg)
        self.recovery = recovery


def match(word, options, what):
    """Exact match, else a unique prefix; ambiguous or unknown words list the choices instead of guessing."""
    if word in options:
        return word
    hits = [o for o in options if o.startswith(word)]
    if len(hits) == 1:
        return hits[0]
    choices = ", ".join(sorted(options))
    if hits:
        raise CliError(f"'{word}' is ambiguous: {', '.join(sorted(hits))}.", " ".join(["agent-bus", what, "?"]).replace("  ", " "))
    raise CliError(f"Unknown word '{word}'. Expected one of: {choices}.", " ".join(["agent-bus", what, "?"]).replace("  ", " "))


def describe(noun=None, verb=None):
    if noun is None:
        lines = ["agent-bus (command-plane/1). Nouns:"] + [f"  {n:<6} {NOUN_HELP[n]}" for n in GRAPH]
        lines += ["  help [AREA]  Every command in an area, e.g. help msg.",
                  "Qualifier anywhere: as NAME (else AGENT_BUS_NAME, else the name this session or folder last registered)."]
        return "\n".join(lines)
    if verb is None:
        return "\n".join([f"agent-bus {noun}: {NOUN_HELP[noun]}"] +
                         [f"  {v:<9} {spec[3]}" for v, spec in GRAPH[noun].items()])
    _, pos, kw, text = GRAPH[noun][verb]
    label = lambda v: {"from_file": "PATH", "dest": "DIR", "wait_seconds": "SECONDS", "with": "NAME", "limit": "N",
                       "file_id": "ID", "body": "TEXT", "query": "TEXT", "found_at": "PATH", "replace": "yes",
                       "value_only": "yes"}.get(v.rstrip("*"), v.rstrip("*").upper()) + ("..." if v.endswith("*") else "")
    usage = " ".join([label(p) for p in pos] + [f"[{k} {label(v)}]" for k, v in kw.items()])
    return f"agent-bus {noun} {verb} {usage}\n  {text}"


def identity_key():
    # Several agents often share a folder, so prefer the harness's own session id when it exposes one.
    e = os.environ
    sid = e.get("CLAUDE_CODE_SESSION_ID") or e.get("CODEX_THREAD_ID") or e.get("CODEX_SESSION_ID")
    return f"session:{sid}" if sid else os.getcwd()


def identity(explicit):
    if explicit:
        return explicit
    if os.environ.get("AGENT_BUS_NAME"):
        return os.environ["AGENT_BUS_NAME"]
    try:
        with open(IDENTITY, encoding="utf-8") as f:
            return json.load(f).get(identity_key())
    except (OSError, ValueError):
        return None


def remember(name):
    os.makedirs(os.path.dirname(IDENTITY), exist_ok=True)
    try:
        with open(IDENTITY, encoding="utf-8") as f:
            ids = json.load(f)
    except (OSError, ValueError):
        ids = {}
    ids[identity_key()] = name
    with open(IDENTITY, "w", encoding="utf-8") as f:
        json.dump(ids, f, indent=1)


def cli(argv):
    words = list(argv)
    who = None
    if "as" in words[:-1]:
        i = words.index("as")
        who = words[i + 1]
        del words[i:i + 2]
    words = [w[1:] if w.startswith("@") and len(w) > 1 else w for w in words]
    if not words or words[0] in ("?", "-h", "--help"):
        return describe()
    if words[0] == "help":
        return describe(match(words[1], GRAPH, "")) if len(words) > 1 else describe()
    noun = match(words[0], GRAPH, "")
    if len(words) == 1 or words[1] == "?":
        return describe(noun)
    verb = match(words[1], GRAPH[noun], noun)
    rest = words[2:]
    tool, pos, kw, _ = GRAPH[noun][verb]
    if "?" in rest:
        return describe(noun, verb)
    args = {}
    # Keyword qualifiers may come in any order after the positionals; a "*" param swallows the rest.
    i, pi = 0, 0
    while i < len(rest):
        w = rest[i]
        key = next((k for k in kw if k == w), None)
        if key and (pi >= len(pos) or not pos[pi].endswith("*") or args.get(pos[pi].rstrip("*"))):
            dest = kw[key]
            if dest.endswith("*"):
                args[dest[:-1]] = " ".join(rest[i + 1:])
                break
            if i + 1 >= len(rest):
                raise CliError(f"'{key}' needs a value.", f"agent-bus {noun} {verb} ?")
            args[dest] = rest[i + 1]
            i += 2
            continue
        if pi < len(pos):
            p = pos[pi]
            if p.endswith("*"):
                # The free-text tail stops at a recognised qualifier keyword.
                j = next((k for k in range(i, len(rest)) if rest[k] in kw), len(rest))
                args[p[:-1]] = " ".join(rest[i:j])
                i, pi = j, pi + 1
                continue
            args[p] = w
            pi += 1
            i += 1
            continue
        raise CliError(f"Unexpected word '{w}'.", f"agent-bus {noun} {verb} ?")
    missing = [p.rstrip("*") for p in pos if not args.get(p.rstrip("*")) and p != "query*"]   # find with no text lists all
    if args.get("from_file"):
        with open(os.path.expanduser(args.pop("from_file")), encoding="utf-8") as f:
            args["body"] = f.read()
        missing = [m for m in missing if m != "body"]
    if args.get("body") == "-":
        args["body"] = sys.stdin.read()
    if missing:
        raise CliError(f"Missing {', '.join(m.upper() for m in missing)}.", f"agent-bus {noun} {verb} ?")
    for k in ("replace", "value_only"):
        if k in args:
            args[k] = str(args[k]).lower() in ("yes", "y", "true", "1")
    for k in ("wait_seconds", "limit", "file_id", "proposal_id"):
        if k in args:
            try:
                args[k] = int(args[k])
            except ValueError:
                raise CliError(f"{k.split('_')[0]} must be a number, not '{args[k]}'.", f"agent-bus {noun} {verb} ?")
    if verb == "whoami":
        name = identity(who)
        if not name:
            raise CliError("Not registered yet from this session or folder.", "agent-bus agent register YOUR-NAME note what you do")
        return name
    if tool not in ("bus_register", "bus_list", "bus_proposals", "bus_proposal", "bus_usage_digest", "bus_secret_find",
                    "bus_secret_get"):
        args["as"] = identity(who)
        if not args["as"]:
            raise CliError("Not registered yet from this session or folder.", "agent-bus agent register YOUR-NAME note what you do")
    else:
        me["name"] = identity(who)
    if tool == "bus_register":
        args.setdefault("kind", "cli")
    text = call_tool(tool, args)
    if tool == "bus_register":
        remember(args["name"])
    return text


def cli_main(argv):
    global CLI_MODE
    CLI_MODE = True
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    try:
        print(cli(argv))
        return 0
    except CliError as e:
        print(f"Error: {e}\nRecovery: {e.recovery}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"Error: {e}\nRecovery: agent-bus ?", file=sys.stderr)
        return 1


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "district":
        # One command service for the desktop and CLI; pass literal argv, never a shell string.
        import shutil, subprocess
        node = shutil.which("node")
        if not node:
            print("Error: Node.js is required for district commands.\nRecovery: install Node.js and open Agent Bus.", file=sys.stderr)
            sys.exit(1)
        sys.exit(subprocess.call([node, os.path.join(HERE, "bin", "district.cjs"), *sys.argv[2:]]))
    if len(sys.argv) > 1:
        sys.exit(cli_main(sys.argv[1:]))
    serve()
