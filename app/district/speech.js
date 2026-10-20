'use strict';

const path = require('node:path');
const { spawn: nodeSpawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');

const SCRIPT = path.join(__dirname, 'speech-recognizer.ps1');
const MAX_TEXT = 8000, MAX_LINE = 65536, MAX_OUTPUT = 262144;
const REASONS = new Set(['completed', 'cancelled', 'timeout', 'no_speech', 'error']);
const WINDOWS = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
const POWERSHELL = path.win32.join(WINDOWS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const TASKKILL = path.win32.join(WINDOWS, 'System32', 'taskkill.exe');

function clean(value, max) {
  return typeof value === 'string' && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ? value.trim() : null;
}

function reader(child, onValue, onFault) {
  const decoder = new StringDecoder('utf8');
  let pending = '', total = 0, failed = false;
  const fault = () => { if (!failed) { failed = true; onFault('The offline speech process returned an oversized response. Keep typing.'); } };
  const consume = (text) => {
    if (failed) return;
    pending += text;
    const lines = pending.split('\n'); pending = lines.pop();
    for (const line of lines) {
      if (line.length > MAX_LINE) { fault(); return; }
      try {
        const value = JSON.parse(line.replace(/^\uFEFF/, '').trim());
        if (value && typeof value === 'object' && !Array.isArray(value)) onValue(value);
      } catch { /* Diagnostic/unknown lines are never transcribed. */ }
    }
    if (pending.length > MAX_LINE) fault();
  };
  child.stdout?.on('data', (data) => {
    total += Buffer.byteLength(data);
    if (total > MAX_OUTPUT) { fault(); return; }
    consume(decoder.write(Buffer.isBuffer(data) ? data : Buffer.from(data)));
  });
  return () => {
    consume(decoder.end());
    if (pending.trim() && !failed) consume('\n');
  };
}

class SpeechInput {
  constructor({ spawn = nodeSpawn, platform = process.platform, onEvent = () => {}, timeoutMs = 60000,
    statusTimeoutMs = 10000, stopTimeoutMs = 5000 } = {}) {
    if (typeof spawn !== 'function' || typeof onEvent !== 'function') throw new TypeError('SpeechInput requires callable spawn and onEvent dependencies.');
    for (const [value, max] of [[timeoutMs, 60000], [statusTimeoutMs, 10000], [stopTimeoutMs, 5000]]) {
      if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new RangeError('Speech timeouts must be positive and within their fixed limits.');
    }
    Object.assign(this, { _spawn: spawn, platform, onEvent, timeoutMs, statusTimeoutMs, stopTimeoutMs });
    this._generation = 0; this._capture = null; this._probe = null; this._statusPromise = null; this._closed = false;
  }

  _launch(mode) {
    return this._spawn(POWERSHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Mode', mode],
      { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  }

  _emit(record, event) {
    if (this._capture !== record || record.finished) return;
    try {
      const pending = this.onEvent({ ...event, captureId: record.captureId });
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch { /* UI callback cannot hold the microphone open. */ }
  }

  async status() {
    if (this._closed) return { available: false, reason: 'Dictation is closed. Keep typing.', recognizers: [] };
    if (this.platform !== 'win32') return { available: false, reason: 'Offline dictation requires Windows. Keep typing.', recognizers: [] };
    if (this._statusPromise) return this._statusPromise;
    this._statusPromise = this._readStatus().finally(() => { this._statusPromise = null; });
    return this._statusPromise;
  }

  _readStatus() {
    return new Promise((resolve) => {
      let child, timer, done = false, value = null, outputError = '';
      const finish = (result) => {
        if (done) return; done = true; clearTimeout(timer);
        if (this._probe?.child === child) this._probe = null;
        resolve(result);
      };
      const unavailable = (reason) => finish({ available: false, reason, recognizers: [] });
      try { child = this._launch('status'); }
      catch { unavailable('Windows offline speech recognition could not start. Keep typing.'); return; }
      const record = { child, exited: false, stopPromise: null };
      this._probe = record;
      const drain = reader(child, (event) => {
        if (done || event.type !== 'status' || typeof event.available !== 'boolean' || !Array.isArray(event.recognizers) || event.recognizers.length > 64) return;
        const reason = clean(event.reason, 1200);
        const recognizers = event.recognizers.map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
          const id = clean(entry.id, 512), name = clean(entry.name, 256), culture = clean(entry.culture, 40);
          return id && name && culture ? { id, name, culture } : null;
        });
        if (reason === null || recognizers.some((entry) => entry === null)) return;
        const available = event.available && recognizers.some((entry) => entry.culture === 'en-US');
        value = { available, reason: available ? reason : reason || 'The offline en-US recognizer is not installed. Keep typing.', recognizers };
      }, (message) => { outputError = message; void this._terminate(record); });
      child.stderr?.on('data', (data) => { outputError = (outputError + String(data)).slice(-1200); });
      child.once('exit', () => { record.exited = true; });
      child.once('error', () => { void this._terminate(record); unavailable('Windows offline speech recognition could not start. Keep typing.'); });
      child.once('close', (code) => {
        record.exited = true; drain();
        if (code === 0 && value) finish(value);
        else unavailable(clean(outputError, 1200) || 'Windows offline speech recognition is unavailable. Keep typing.');
      });
      timer = setTimeout(() => {
        void this._terminate(record).finally(() => unavailable('Checking offline speech recognition timed out. Keep typing.'));
      }, this.statusTimeoutMs);
    });
  }

  async start() {
    if (this._closed) throw new Error('Dictation is closed. Keep typing.');
    if (this.platform !== 'win32') throw new Error('Offline dictation requires Windows. Keep typing.');
    if (this._capture) throw new Error('The previous dictation capture has not stopped. Stop it before starting again.');
    const record = { captureId: `speech-${++this._generation}`, child: null, listening: false, cancelled: false,
      finalText: null, error: null, reason: null, exited: false, finished: false, stopPromise: null };
    this._capture = record;
    let resolveSpawn, rejectSpawn;
    const spawned = new Promise((resolve, reject) => { resolveSpawn = resolve; rejectSpawn = reject; });
    record.rejectSpawn = rejectSpawn;
    let child;
    try { child = record.child = this._launch('capture'); }
    catch {
      this._finish(record, null, 'Windows offline dictation could not start. Keep typing.');
      throw new Error('Windows offline dictation could not start. Keep typing.');
    }
    const drain = reader(child, (event) => this._receive(record, event), (message) => {
      if (this._capture === record && !record.finished) {
        record.error = message; this._emit(record, { type: 'error', message });
        void this._cancel(record, 'error');
      }
    });
    record.stderr = '';
    child.stderr?.on('data', (data) => { record.stderr = (record.stderr + String(data)).slice(-1200); });
    child.once('spawn', () => resolveSpawn({ started: true, captureId: record.captureId }));
    child.once('exit', () => { record.exited = true; });
    child.once('error', () => {
      const message = 'Windows offline dictation could not start. Keep typing.';
      rejectSpawn(new Error(message));
      if (!child.pid) this._finish(record, null, message);
      else { record.error = message; this._emit(record, { type: 'error', message }); void this._cancel(record, 'error'); }
    });
    child.once('close', (code) => {
      record.exited = true; drain();
      rejectSpawn(new Error('Offline dictation ended before the microphone became ready. Keep typing.'));
      this._finish(record, code);
    });
    record.timer = setTimeout(() => {
      if (this._capture !== record || record.finished) return;
      record.error = 'Dictation reached its 60-second limit. Keep typing or start again.';
      this._emit(record, { type: 'error', message: record.error });
      void this._cancel(record, 'timeout');
    }, this.timeoutMs);
    return spawned;
  }

  _receive(record, event) {
    if (this._capture !== record || record.finished || record.cancelled) return;
    if (event.type === 'listening' && !record.listening && record.finalText === null) {
      record.listening = true; this._emit(record, { type: 'listening' });
    } else if (event.type === 'partial' && record.listening && record.finalText === null) {
      const text = clean(event.text, MAX_TEXT);
      if (text) this._emit(record, { type: 'partial', text });
    } else if (event.type === 'final' && record.listening && record.finalText === null) {
      const text = clean(event.text, MAX_TEXT);
      if (text) record.finalText = text; // Publish only after successful owned-process exit.
    } else if (event.type === 'error') {
      const message = clean(event.message, 1200);
      if (message) { record.error = message; this._emit(record, { type: 'error', message }); void this._cancel(record, 'error'); }
    } else if (event.type === 'stopped' && REASONS.has(event.reason)) {
      record.reason = event.reason;
    }
  }

  _finish(record, exitCode, error) {
    if (record.finished) return;
    clearTimeout(record.timer);
    const current = this._capture === record;
    const message = error || record.error || (!record.cancelled && exitCode !== 0 ? clean(record.stderr, 1200) || 'Offline dictation ended with an error. Keep typing.' : null);
    if (current) {
      if (message && message !== record.error) this._emit(record, { type: 'error', message });
      if (!record.cancelled && !message && exitCode === 0 && record.finalText) this._emit(record, { type: 'final', text: record.finalText });
      this._emit(record, { type: 'stopped', reason: record.cancelled ? record.reason || 'cancelled' : message ? 'error' : record.finalText ? 'completed' : record.reason || 'no_speech', confirmed: true });
      this._capture = null;
    }
    record.finished = true;
  }

  _terminate(record) {
    if (record.exited) return Promise.resolve({ stopped: true, confirmed: true, treeConfirmed: true, requested: false });
    if (record.stopPromise) return record.stopPromise;
    const child = record.child;
    if (!child || !Number.isSafeInteger(child.pid) || child.pid <= 1 || child.pid === process.pid) {
      return Promise.resolve({ stopped: false, confirmed: false, treeConfirmed: false, requested: false });
    }
    record.stopPromise = (async () => {
      const treeConfirmed = await new Promise((resolve) => {
        let helper, timer, done = false;
        const finish = (ok) => { if (done) return; done = true; clearTimeout(timer); resolve(ok); };
        try { helper = this._spawn(TASKKILL, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' }); }
        catch { finish(false); return; }
        helper.once('error', () => finish(false));
        helper.once('close', (code) => finish(code === 0));
        timer = setTimeout(() => { try { helper.kill('SIGKILL'); } catch {} finish(false); }, this.stopTimeoutMs);
      });
      if (!record.exited && !treeConfirmed) { try { child.kill('SIGKILL'); } catch {} }
      if (!record.exited) await new Promise((resolve) => {
        const timer = setTimeout(done, Math.min(this.stopTimeoutMs, 1000));
        function done() { clearTimeout(timer); child.removeListener('exit', done); child.removeListener('close', done); resolve(); }
        child.once('exit', done); child.once('close', done);
        if (record.exited) done();
      });
      const result = { stopped: record.exited, confirmed: record.exited, treeConfirmed, requested: true };
      if (!record.exited) record.stopPromise = null;
      return result;
    })();
    return record.stopPromise;
  }

  async _cancel(record, reason) {
    record.cancelled = true; record.finalText = null; record.reason = reason;
    record.rejectSpawn?.(new Error(reason === 'timeout' ? 'Dictation startup timed out. Keep typing.' : 'Dictation capture was cancelled. Keep typing.'));
    clearTimeout(record.timer);
    const result = await this._terminate(record);
    if (!result.stopped && this._capture === record) {
      const message = 'Stop was requested, but the offline dictation process has not confirmed exit. Keep typing; retry Stop before starting again.';
      record.error = message; this._emit(record, { type: 'error', message });
    }
    return { ...result, captureId: record.captureId };
  }

  async stop() {
    return this._capture ? this._cancel(this._capture, 'cancelled') : { stopped: true, confirmed: true, requested: false };
  }

  async close() {
    this._closed = true;
    const result = await this.stop();
    if (this._probe) await this._terminate(this._probe);
    return result;
  }
}

module.exports = { SpeechInput };
