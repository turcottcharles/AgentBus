#!/usr/bin/env node
'use strict';
// Standalone push hub. Importing this file opens no database or listener.
// Use Bearer authentication. Realtime clients must send via AGENT_BUS_URL;
// independent local SQLite writers are durable but cannot wake this process.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Hub } = require('../app/hub');
const SCHEMA = require('../app/schema');
const ROOT = path.resolve(__dirname, '..');
function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--help' || key === '-h') { result.help = true; continue; }
    if (!['--db', '--config', '--port'].includes(key) || result[key.slice(2)] !== undefined) throw new Error('Use --db <path> --config <path> [--port <0..65535>]');
    const value = args[++index]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    result[key.slice(2)] = value;
  }
  if (result.help) return result;
  if (!result.db || !result.config) throw new Error('--db and --config are required; owner defaults are never selected automatically');
  result.db = path.resolve(result.db); result.config = path.resolve(result.config);
  if (result.db.toLowerCase() === result.config.toLowerCase()) throw new Error('Database and configuration must be different files');
  if (result.port !== undefined) {
    if (!/^(0|[1-9]\d*)$/.test(result.port) || Number(result.port) > 65535) throw new Error('Port must be an integer from 0 through 65535');
    result.port = Number(result.port);
  }
  return result;
}
async function startHub(options) {
  const database = path.resolve(options.db), config = path.resolve(options.config);
  if (database.toLowerCase() === config.toLowerCase()) throw new Error('Database and configuration must be different files');
  // Refuse corrupt/unsupported existing files before Hub.loadConfig can write.
  if (fs.existsSync(config)) {
    const saved = JSON.parse(fs.readFileSync(config, 'utf8'));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Existing hub config must be an object');
    if (saved.token !== undefined && (typeof saved.token !== 'string' || !saved.token)) throw new Error('Existing hub token is invalid');
    if (saved.port !== undefined && (!Number.isInteger(saved.port) || saved.port < 1 || saved.port > 65535)) throw new Error('Existing hub port is invalid');
    if (saved.enabled === false) throw new Error('Existing hub config is disabled; it was left unchanged');
  }
  fs.mkdirSync(path.dirname(database), { recursive: true }); fs.mkdirSync(path.dirname(config), { recursive: true });
  const db = new DatabaseSync(database); let hub, closed = false;
  const close = async () => { if (closed) return; closed = true; try { await hub?.close(); } finally { db.close(); } };
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;' + SCHEMA);
    hub = new Hub({ db, root: ROOT, configPath: config });
    hub.filesDir = path.join(path.dirname(database), 'files');
    if (options.port !== undefined) hub.config.port = options.port;
    // Never enumerate VM/LAN adapters or apply the saved LAN flag here.
    await hub.listen([]);
    if (hub.servers.length !== 1 || hub.servers[0].addr !== '127.0.0.1') throw new Error(hub.errors.join('; ') || 'Loopback hub did not bind');
    const port = hub.servers[0].server.address().port;
    const url = `http://127.0.0.1:${port}`;
    const connectionPath = path.join(path.dirname(database), 'bus-connection.json');
    const nonce = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(connectionPath, JSON.stringify({ version: 1, db: database, url, token: hub.config.token, nonce }), { mode: 0o600 });
    const closeWithDescriptor = async () => {
      try {
        if (JSON.parse(fs.readFileSync(connectionPath, 'utf8')).nonce === nonce) fs.unlinkSync(connectionPath);
      } catch {}
      await close();
    };
    return { hub, db, close: closeWithDescriptor, url, database, config, filesDir: hub.filesDir, connectionPath };
  } catch (error) { await close(); throw error; }
}
async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) { process.stdout.write('node bin/bus-hub.cjs --db <path> --config <path> [--port <port>]\nLoopback only; default port 47800. Use Authorization: Bearer <config token>.\nRoute realtime clients through AGENT_BUS_URL; direct SQLite writes do not push.\n'); return; }
  const running = await startHub(options);
  let stopping = false;
  const stop = () => { if (stopping) return; stopping = true; void running.close().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; }).finally(() => { process.off('SIGINT', stop); process.off('SIGTERM', stop); }); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  process.stdout.write(JSON.stringify({ url: running.url, db: running.database, config: running.config, files: running.filesDir, auth: 'Bearer', realtime: 'All realtime participants must use AGENT_BUS_URL' }) + '\n');
  return running;
}
if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = { parseArgs, startHub, main };
