'use strict';
// The one schema shared by the app, the hub, agent_bus_mcp.py and claude_statusline.py.
// Keep these CREATE statements identical to the ones in the Python files: whichever process
// opens the database first creates the tables.
module.exports = `
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
  CREATE TABLE IF NOT EXISTS claude_status(session_id TEXT PRIMARY KEY, ts REAL, effort TEXT, pid TEXT, json TEXT);
  CREATE TABLE IF NOT EXISTS quota_history(account TEXT, ts REAL, session_id TEXT, five REAL, seven REAL);
  -- App-only tables; the Python side never reads them.
  CREATE TABLE IF NOT EXISTS projects(name TEXT PRIMARY KEY, collapsed INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS profiles(name TEXT PRIMARY KEY, project TEXT, cli TEXT, cwd TEXT,
    mode TEXT, session TEXT, extra TEXT, prompt TEXT, last_launch REAL);
`;
