'use strict';
// Documented local client: WebSocket JSON-RPC over `codex app-server proxy`.
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function encodeFrame(payload) {
  const data = Buffer.from(payload);
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
  let header;
  if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
  else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 0x80 | 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(data.length, 6);
  }
  return Buffer.concat([header, mask, masked]);
}
function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const b0 = buffer[offset], b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f, masked = !!(b1 & 0x80);
    let len = b1 & 0x7f, hdr = 2;
    if (len === 126) {
      if (buffer.length - offset < 4) break;
      len = buffer.readUInt16BE(offset + 2); hdr = 4;
    } else if (len === 127) {
      if (buffer.length - offset < 10) break;
      len = Number(buffer.readBigUInt64BE(offset + 2)); hdr = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buffer.length - offset < hdr + maskLen + len) break;
    let payload = buffer.subarray(offset + hdr + maskLen, offset + hdr + maskLen + len);
    if (masked) {
      const mask = buffer.subarray(offset + hdr, offset + hdr + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }
    offset += hdr + maskLen + len;
    if (opcode === 0x1) messages.push(payload.toString());
    else if (opcode === 0x8) messages.push(null);
  }
  return { messages, rest: buffer.subarray(offset) };
}

function connect(options = {}) {
  const bin = options.bin || process.env.CODEX_BIN || 'C:\\Users\\Admin\\AppData\\Local\\OpenAI\\Codex\\bin\\896a0166b774037a\\codex.exe';
  const args = ['app-server', 'proxy'];
  if (options.sock) args.push('--sock', options.sock);
  const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const key = crypto.randomBytes(16).toString('base64');
  const handshake = [
    'GET / HTTP/1.1',
    'Host: localhost',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '',
    '',
  ].join('\r\n');
  let buf = Buffer.alloc(0), upgraded = false, stderr = '';
  const pending = new Map();
  const listeners = [];
  let nextId = 0;
  child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 8000) stderr = stderr.slice(-4000); });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('websocket upgrade timeout: ' + stderr.slice(-500))), 10000);
    child.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const head = buf.subarray(0, idx).toString();
        buf = buf.subarray(idx + 4);
        upgraded = true;
        clearTimeout(timer);
        if (!/101/.test(head.split('\r\n')[0] || '')) return reject(new Error('upgrade failed: ' + head.split('\r\n')[0]));
        resolve();
        if (buf.length) onData(Buffer.alloc(0));
      } else onData(Buffer.alloc(0));
    });
    function onData(extra) {
      if (extra.length) buf = Buffer.concat([buf, extra]);
      const decoded = decodeFrames(buf);
      buf = decoded.rest;
      for (const text of decoded.messages) {
        if (text == null) { child.kill(); continue; }
        let msg; try { msg = JSON.parse(text); } catch { continue; }
        if (msg.id != null && pending.has(msg.id)) {
          const p = pending.get(msg.id); pending.delete(msg.id);
          if (msg.error) p.reject(Object.assign(new Error(msg.error.message || JSON.stringify(msg.error)), { rpc: msg.error }));
          else p.resolve(msg.result);
        } else listeners.forEach((fn) => fn(msg));
      }
    }
    child.on('error', reject);
    child.stdin.write(handshake);
  });
  const request = async (method, params, timeoutMs = 20000) => {
    await ready;
    const id = ++nextId;
    const body = JSON.stringify({ method, id, ...(params !== undefined ? { params } : {}) });
    child.stdin.write(encodeFrame(body));
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout ' + method)), timeoutMs);
      pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
    });
  };
  const notify = async (method, params) => {
    await ready;
    child.stdin.write(encodeFrame(JSON.stringify({ method, params })));
  };
  const close = () => { try { child.stdin.end(); } catch {} child.kill(); };
  return { ready, request, notify, on: (fn) => listeners.push(fn), close, stderr: () => stderr };
}

module.exports = { connect, encodeFrame, decodeFrames };
