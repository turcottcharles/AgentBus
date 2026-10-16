"""Claude Code status line that also records session stats for the Agent Bus app.

Claude Code runs this on every status update and passes a JSON snapshot on stdin: session id, model,
context window use, cost, and the account's 5-hour / 7-day rate-limit use. We store the latest
snapshot per session in bus.sqlite and print a one-line status for the terminal.
"""
import json, os, sqlite3, sys, time

DB = os.environ.get("AGENT_BUS_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "bus.sqlite"))


def g(d, *path, default=None):
    for p in path:
        if not isinstance(d, dict) or p not in d:
            return default
        d = d[p]
    return d


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    raw = sys.stdin.buffer.read().decode("utf-8", "replace")
    try:
        s = json.loads(raw)
    except ValueError:
        print("agent-bus: no status")
        return
    sid = s.get("session_id") or ""
    now = time.time()
    effort = os.environ.get("CLAUDE_EFFORT") or g(s, "effort") or ""
    five = g(s, "rate_limits", "five_hour", "used_percentage")
    seven = g(s, "rate_limits", "seven_day", "used_percentage")
    try:
        c = sqlite3.connect(DB, timeout=2)
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript("""
          CREATE TABLE IF NOT EXISTS claude_status(session_id TEXT PRIMARY KEY, ts REAL, effort TEXT, pid TEXT, json TEXT);
          CREATE TABLE IF NOT EXISTS quota_history(account TEXT, ts REAL, session_id TEXT, five REAL, seven REAL);""")
        with c:
            c.execute("INSERT INTO claude_status VALUES(?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET "
                      "ts=excluded.ts, effort=excluded.effort, pid=excluded.pid, json=excluded.json",
                      (sid, now, effort, os.environ.get("CLAUDE_PID", ""), raw))
            if five is not None or seven is not None:
                last = c.execute("SELECT five, seven FROM quota_history WHERE account='claude' AND session_id=? "
                                 "ORDER BY ts DESC LIMIT 1", (sid,)).fetchone()
                if last != (five, seven):
                    c.execute("INSERT INTO quota_history VALUES('claude',?,?,?,?)", (now, sid, five, seven))
        c.close()
    except sqlite3.Error:
        pass

    model = g(s, "model", "display_name") or g(s, "model", "id") or "?"
    parts = [model + (f" ({effort})" if effort else "")]
    ctx = g(s, "context_window", "used_percentage")
    if ctx is not None:
        parts.append(f"ctx {ctx:.0f}%")
    cost = g(s, "cost", "total_cost_usd")
    if cost:
        parts.append(f"${cost:.2f}")
    if five is not None:
        parts.append(f"5h {100 - five:.0f}% left")
    if seven is not None:
        parts.append(f"7d {100 - seven:.0f}% left")
    name = os.environ.get("AGENT_BUS_NAME")
    if name:
        parts.append(f"bus:{name}")
    print(" · ".join(parts))


main()
