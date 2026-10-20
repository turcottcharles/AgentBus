'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const { SpeechInput } = require('../app/district/speech');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const installed = { type: 'status', available: true, reason: 'Installed; microphone checked only on Start.',
  recognizers: [{ id: 'fake-en-us', name: 'Fixture recognizer', culture: 'en-US' }] };

class FakeChild extends EventEmitter {
  constructor(pid) {
    super(); this.pid = pid; this.stdout = new PassThrough(); this.stderr = new PassThrough();
    this.exitCode = null; this.signalCode = null; this.finished = false; this.killSignals = [];
  }
  send(value) { this.stdout.write(typeof value === 'string' ? value : JSON.stringify(value) + '\n'); }
  finish(code = 0, signal = null) {
    if (this.finished) return;
    this.finished = true; this.exitCode = code; this.signalCode = signal;
    this.emit('exit', code, signal); this.emit('close', code, signal);
  }
  kill(signal) { this.killSignals.push(signal); if (!this.ignoreKill) this.finish(null, signal); return true; }
}

function fixture(t, options = {}) {
  let nextPid = 900001;
  const launches = [], captures = [], probes = [], kills = [], events = [];
  const children = new Map();
  const spawn = (command, args, settings) => {
    const child = new FakeChild(nextPid++);
    children.set(child.pid, child); launches.push({ command, args, settings, child });
    if (/taskkill\.exe$/i.test(command)) {
      kills.push({ command, args, settings, child });
      queueMicrotask(() => {
        child.emit('spawn');
        if (!options.holdOnStop) children.get(Number(args[1]))?.finish(null, 'SIGTERM');
        child.finish(options.killFailed ? 1 : 0);
      });
    } else if (args.at(-1) === 'status') {
      probes.push(child);
      queueMicrotask(() => {
        child.emit('spawn');
        if (!options.holdStatus) { child.send(options.status || installed); child.finish(options.statusExit ?? 0); }
      });
    } else {
      captures.push(child);
      if (!options.holdSpawn) queueMicrotask(() => child.emit('spawn'));
    }
    return child;
  };
  const speech = new SpeechInput({ spawn, platform: 'win32', onEvent: (event) => events.push(event),
    timeoutMs: options.timeoutMs || 1000, statusTimeoutMs: options.statusTimeoutMs || 100,
    stopTimeoutMs: options.stopTimeoutMs || 30 });
  t.after(async () => {
    for (const child of children.values()) child.finish(0);
    await speech.close();
  });
  return { speech, spawn, launches, captures, probes, kills, events };
}

test('construction never starts listening; status only probes installed offline recognizers', async (t) => {
  const f = fixture(t);
  assert.equal(f.launches.length, 0);
  const [a, b] = await Promise.all([f.speech.status(), f.speech.status()]);
  assert.deepEqual(a, { available: true, reason: installed.reason, recognizers: installed.recognizers });
  assert.deepEqual(a, b); assert.equal(f.probes.length, 1); assert.equal(f.captures.length, 0);
  assert.equal(f.events.length, 0);
  const launch = f.launches[0];
  assert.match(launch.command, /WindowsPowerShell\\v1\.0\\powershell\.exe$/i);
  assert.deepEqual(launch.args.slice(0, 7), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'app', 'district', 'speech-recognizer.ps1')]);
  assert.deepEqual(launch.args.slice(-2), ['-Mode', 'status']);
  assert.equal(launch.settings.windowsHide, true); assert.equal(launch.settings.shell, false);
});

test('unavailable platform and missing recognizer preserve typing and never launch capture', async (t) => {
  let calls = 0;
  const other = new SpeechInput({ platform: 'linux', spawn: () => { calls++; throw new Error('Do not launch.'); } });
  assert.equal((await other.status()).available, false);
  await assert.rejects(other.start(), /requires Windows/); assert.equal(calls, 0); await other.close();
  const f = fixture(t, { status: { type: 'status', available: false, reason: 'No offline en-US recognizer. Keep typing.', recognizers: [] } });
  assert.deepEqual(await f.speech.status(), { available: false, reason: 'No offline en-US recognizer. Keep typing.', recognizers: [] });
  assert.equal(f.captures.length, 0);
});

test('only explicit Start spawns capture, receipt is not a listening claim and duplicate Start is refused', async (t) => {
  const f = fixture(t);
  const result = await f.speech.start();
  assert.equal(result.started, true); assert.match(result.captureId, /^speech-/);
  assert.equal(f.captures.length, 1); assert.equal(f.events.length, 0);
  assert.deepEqual(f.launches[0].args.slice(-2), ['-Mode', 'capture']);
  await assert.rejects(f.speech.start(), /previous dictation capture/); assert.equal(f.captures.length, 1);
  f.captures[0].send({ type: 'listening' });
  assert.deepEqual(f.events, [{ type: 'listening', captureId: result.captureId }]);
});

test('partials never commit; actual final is published once only after successful process exit', async (t) => {
  const f = fixture(t); const result = await f.speech.start(); const child = f.captures[0];
  child.send({ type: 'listening' }); child.send({ type: 'partial', text: 'unfinished words', isFinal: true });
  assert.equal(f.events.some((event) => event.type === 'final'), false);
  child.send({ type: 'final', text: 'Completed phrase.' }); child.send({ type: 'final', text: 'Duplicate result must be ignored.' });
  child.send({ type: 'stopped', reason: 'completed' });
  assert.equal(f.events.some((event) => event.type === 'final'), false, 'Buffered final waits for actual owned-process exit.');
  child.finish(0);
  assert.deepEqual(f.events.map((event) => event.type), ['listening', 'partial', 'final', 'stopped']);
  assert.deepEqual(f.events[2], { type: 'final', text: 'Completed phrase.', captureId: result.captureId });
  assert.deepEqual(f.events[3], { type: 'stopped', reason: 'completed', confirmed: true, captureId: result.captureId });
  assert.equal(f.kills.length, 0, 'Natural single-utterance process already stopped.');
});

test('explicit Stop discards partial and late final, kills only owned PID tree and coalesces requests', async (t) => {
  const f = fixture(t); const result = await f.speech.start(); const child = f.captures[0];
  child.send({ type: 'listening' }); child.send({ type: 'partial', text: 'Do not submit this' });
  const first = f.speech.stop(), second = f.speech.stop();
  child.send({ type: 'final', text: 'Late result must not commit.' });
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.stopped, true); assert.equal(a.confirmed, true); assert.deepEqual(a, b); assert.equal(f.kills.length, 1);
  assert.deepEqual(f.kills[0].args, ['/PID', String(child.pid), '/T', '/F']);
  assert.equal(f.kills[0].settings.shell, false); assert.equal(f.kills[0].settings.windowsHide, true);
  assert.equal(f.events.some((event) => event.type === 'final'), false);
  assert.deepEqual(f.events.at(-1), { type: 'stopped', reason: 'cancelled', confirmed: true, captureId: result.captureId });
});

test('generation fence ignores prior-process events after cancellation and a fresh Start', async (t) => {
  const f = fixture(t); const old = await f.speech.start(); const oldChild = f.captures[0];
  oldChild.send({ type: 'listening' }); await f.speech.stop();
  const next = await f.speech.start(); const child = f.captures[1];
  assert.notEqual(old.captureId, next.captureId);
  oldChild.send({ type: 'listening' }); oldChild.send({ type: 'final', text: 'Stale final.' });
  child.send({ type: 'listening' }); child.send({ type: 'final', text: 'Current final.' }); child.finish(0);
  assert.deepEqual(f.events.filter((event) => event.type === 'final'), [{ type: 'final', text: 'Current final.', captureId: next.captureId }]);
});

test('unknown/malformed events and oversized transcript fields cannot become dictated text', async (t) => {
  const f = fixture(t); await f.speech.start(); const child = f.captures[0];
  child.send({ type: 'final', text: 'Before listening is ignored.' });
  child.send('not-json\n'); child.send('null\n'); child.send('[]\n');
  child.send({ type: 'listening' }); child.send({ type: 'execute', text: 'Never a command.' });
  child.send({ type: 'partial', text: { fake: true } }); child.send({ type: 'final', text: 'x'.repeat(8001) });
  child.send({ type: 'final', text: 'bad\u0000text' }); child.send({ type: 'stopped', reason: 'invented' }); child.finish(0);
  assert.equal(f.events.some((event) => event.type === 'final' || event.type === 'partial'), false);
  assert.equal(f.events.at(-1).reason, 'no_speech');
});

test('failed process exit suppresses a buffered final and reports a plain typing fallback', async (t) => {
  const f = fixture(t); await f.speech.start(); const child = f.captures[0];
  child.send({ type: 'listening' }); child.send({ type: 'final', text: 'Unqualified transcript' });
  child.stderr.write('Offline recognizer failed. Keep typing.'); child.finish(1);
  assert.equal(f.events.some((event) => event.type === 'final'), false);
  assert.match(f.events.find((event) => event.type === 'error').message, /Keep typing/);
  assert.equal(f.events.at(-1).reason, 'error');
});

test('recognizer errors stop capture without converting prior hypotheses into final', async (t) => {
  const f = fixture(t); await f.speech.start(); const child = f.captures[0];
  child.send({ type: 'listening' }); child.send({ type: 'partial', text: 'A hypothesis' });
  child.send({ type: 'error', message: 'No default audio input is available. Keep typing.' });
  await tick();
  assert.equal(f.events.filter((event) => event.type === 'error').length, 1);
  assert.equal(f.events.some((event) => event.type === 'final'), false);
  assert.equal(f.events.at(-1).reason, 'error'); assert.equal(f.kills.length, 1);
});

test('bounded capture timeout stops owned process and emits timeout rather than a final', async (t) => {
  const f = fixture(t, { timeoutMs: 20 }); await f.speech.start(); f.captures[0].send({ type: 'listening' });
  await pause(60);
  assert.equal(f.kills.length, 1); assert.equal(f.events.at(-1).reason, 'timeout');
  assert.equal(f.events.some((event) => event.type === 'final'), false);
  assert.match(f.events.find((event) => event.type === 'error').message, /limit/);
});

test('status probe timeout is bounded and never starts a microphone capture', async (t) => {
  const f = fixture(t, { holdStatus: true, statusTimeoutMs: 15 });
  const result = await f.speech.status();
  assert.equal(result.available, false); assert.equal(f.captures.length, 0); assert.equal(f.kills.length, 1);
});

test('unconfirmed Stop remains explicit and blocks overlapping capture until actual exit', async (t) => {
  const f = fixture(t, { holdOnStop: true, stopTimeoutMs: 10 }); await f.speech.start();
  const result = await f.speech.stop();
  assert.equal(result.stopped, false); assert.equal(result.confirmed, false);
  assert.equal(f.events.some((event) => event.type === 'stopped'), false);
  assert.match(f.events.at(-1).message, /has not confirmed exit/);
  await assert.rejects(f.speech.start(), /previous dictation capture/);
  f.captures[0].finish(null, 'SIGTERM');
  assert.equal(f.events.at(-1).type, 'stopped');
});

test('oversized process output is cancelled and a pending startup cannot hang after timeout', async (t) => {
  const f = fixture(t); await f.speech.start(); f.captures[0].send('x'.repeat(300000));
  await tick(); assert.equal(f.kills.length, 1); assert.match(f.events.find((event) => event.type === 'error').message, /oversized/);
  const waiting = fixture(t, { holdSpawn: true, timeoutMs: 15 });
  await assert.rejects(waiting.speech.start(), /timed out/);
  await tick(); assert.equal(waiting.kills.length, 1);
});

test('close cancels current capture; repeated close/status/start stay safely closed', async (t) => {
  const f = fixture(t); await f.speech.start();
  assert.equal((await f.speech.close()).stopped, true); assert.equal(f.kills.length, 1);
  assert.equal((await f.speech.close()).stopped, true); assert.equal(f.kills.length, 1);
  assert.equal((await f.speech.status()).available, false);
  await assert.rejects(f.speech.start(), /closed/);
});

test('spawn failures and invalid options fail plainly without a listening claim', async () => {
  const events = [];
  const speech = new SpeechInput({ platform: 'win32', spawn: () => { throw new Error('Missing executable.'); }, onEvent: (event) => events.push(event) });
  assert.equal((await speech.status()).available, false);
  await assert.rejects(speech.start(), /could not start/); assert.equal(events.some((event) => event.type === 'listening'), false);
  await speech.close();
  for (const options of [{ timeoutMs: 60001 }, { statusTimeoutMs: 10001 }, { stopTimeoutMs: 5001 }, { timeoutMs: 0 }]) {
    assert.throws(() => new SpeechInput(options), /fixed limits/);
  }
});

test('owned PowerShell source defaults to status and finalizes only recognized single-utterance speech', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'district', 'speech-recognizer.ps1'), 'utf8');
  assert.match(source, /\[string\]\$Mode = 'status'/);
  assert.match(source, /InstalledRecognizers\(\)/);
  assert.match(source, /Culture\.Name -eq 'en-US'/);
  assert.equal((source.match(/SetInputToDefaultAudioDevice\(\)/g) || []).length, 1);
  assert(source.indexOf("if ($Mode -eq 'status') {") < source.indexOf('$engine.SetInputToDefaultAudioDevice()'));
  assert.match(source, /EndSilenceTimeout = \[TimeSpan\]::FromMilliseconds\(1000\)/);
  assert.match(source, /EndSilenceTimeoutAmbiguous = \[TimeSpan\]::FromMilliseconds\(1000\)/);
  assert.match(source, /RecognizeMode\]::Single/);
  assert(source.indexOf('try { Unregister-Event') < source.indexOf('try { $engine.Dispose()'), 'Detach handlers before disposing the recognizer to preserve the completed phrase.');
  assert(source.indexOf('$engine.Dispose()') < source.indexOf("if ($finalText -and -not $errorText)"));
  assert.doesNotMatch(source, /Invoke-Expression|Invoke-WebRequest|Start-Process|https?:\/\/(?!learn\.microsoft\.com)/);
});
