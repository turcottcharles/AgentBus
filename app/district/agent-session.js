'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { verifyEvent, normalizeContractId, contractInstructions, MAX_JOURNAL } = require('./project-agent-mcp');

async function revokeTicket(ticket, reason) {
  const lockPath = path.join(ticket.directory, 'operation.lock');
  const deadline = Date.now() + 2200;
  let fd;
  while (fd === undefined) {
    try { fd = fs.openSync(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  try { fs.writeFileSync(ticket.revoked, String(reason).slice(0, 500), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  finally {
    if (fd !== undefined) { fs.closeSync(fd); try { fs.unlinkSync(lockPath); } catch {} }
  }
}

function makeTicket({ root, runId, timeoutMs, contractId = 'checklist' }) {
  contractId = normalizeContractId(contractId);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-project-'));
  try { fs.chmodSync(directory, 0o700); } catch {}
  const ticket = { version: 1, root, runId, contractId, key: crypto.randomBytes(32).toString('hex'), ownerPid: process.pid,
    expiresAt: Date.now() + timeoutMs, events: path.join(directory, 'events.jsonl'), state: path.join(directory, 'state.json'), revoked: path.join(directory, 'revoked') };
  const ticketPath = path.join(directory, 'ticket.json');
  fs.writeFileSync(ticket.events, '', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(ticket.state, JSON.stringify({ seq: 0, lastMac: '', writes: 0, calls: 0, receipts: {} }), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(ticketPath, JSON.stringify(ticket), { flag: 'wx', mode: 0o600 });
  const configPath = path.join(directory, 'mcp.json');
  return Object.freeze({ ...ticket, directory, ticketPath, configPath });
}

function createJournalReader(ticket, onEvent) {
  let offset = 0, pending = '', lastSequence = 0, previousMac = '';
  const decoder = new StringDecoder('utf8');
  const original = fs.lstatSync(ticket.events);
  return function consume(final = false) {
    const stat = fs.lstatSync(ticket.events);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== original.dev || stat.ino !== original.ino || stat.size < offset || stat.size > MAX_JOURNAL) throw new Error('Project event journal was replaced, truncated or exceeded its limit.');
    if (stat.size > offset) {
      const fd = fs.openSync(ticket.events, 'r');
      try {
        while (offset < stat.size) {
          const buffer = Buffer.alloc(Math.min(65536, stat.size - offset));
          const count = fs.readSync(fd, buffer, 0, buffer.length, offset);
          if (!count) throw new Error('Project event journal could not be read.');
          offset += count;
          pending += decoder.write(buffer.subarray(0, count));
          const lines = pending.split('\n');
          pending = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            const envelope = JSON.parse(line);
            const event = verifyEvent(ticket, envelope);
            if (event.seq !== lastSequence + 1 || event.previousMac !== previousMac) throw new Error('Project journal event order or replay validation failed.');
            lastSequence = event.seq;
            previousMac = envelope.mac;
            onEvent(event);
          }
          if (pending.length > 16000) throw new Error('Project journal event exceeded its limit.');
        }
      } finally { fs.closeSync(fd); }
    }
    if (final) {
      pending += decoder.end();
      if (pending.trim()) throw new Error('Project journal ended with an incomplete event.');
    }
  };
}

async function startWithDependencies(options, dependencies = {}) {
  const { vendor, instruction, model, effort, runId, onEvent = () => {}, signal, executable = process.execPath, timeoutMs = 240000 } = options;
  const contractId = normalizeContractId(options.contractId);
  if (!['codex', 'claude'].includes(vendor)) throw new Error('Choose Codex or Claude for a project assignment.');
  if (typeof options.root !== 'string' || !path.isAbsolute(options.root)) throw new Error('A fixed generated-project root is required.');
  if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > 32000) throw new Error('Use an instruction of 1–32000 characters.');
  if (typeof runId !== 'string' || !runId || runId.length > 128) throw new Error('A run identity is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 1800000) throw new Error('Use an agent timeout between 50 ms and 30 minutes.');
  if (signal?.aborted) throw new Error('Project assignment was cancelled before launch.');
  const { ProjectFiles } = require('./workspaces');
  const projectFiles = new ProjectFiles({ root: options.root });
  projectFiles.files();
  const root = path.resolve(options.root);
  const providers = dependencies.providers || require('./providers');
  const control = dependencies.processControl || require('./process-control');
  const ticket = makeTicket({ root, runId, timeoutMs, contractId });
  fs.writeFileSync(ticket.configPath, JSON.stringify({ mcpServers: { agent_bus_project: {
    command: executable, args: [path.join(__dirname, 'project-agent-mcp.js'), '--ticket', ticket.ticketPath],
    env: { ELECTRON_RUN_AS_NODE: '1' },
  } } }), { flag: 'wx', mode: 0o600 });
  const prompt = `You are the ${vendor} worker assigned to Agent Bus project run ${runId}. `
    + 'Use ONLY the four agent_bus_project MCP tools already provided: project_list_files, project_read_file, project_write_file and report_activity. '
    + 'First report_activity with phase research and a short public description. Read the actual project files, then make the requested changes using project_write_file. '
    + `Report phase edit while editing. Application contract: ${contractId}. ${contractInstructions(contractId)} `
    + 'Do not use a shell, browser, external integrations, secrets or other agents. Do not attempt to read private .agent-bus files or paths outside this project. '
    + 'The application runs actual build/checks after you exit. Your activity reports and final prose cannot mark checks or the project as passed. '
    + 'If scoped tools are unavailable, report the failure and stop. Finish with a short summary of actual edits. '
    + `Project directory: ${root}\n\nOwner instruction:\n${instruction.trim()}`;
  let launch;
  try { launch = await providers.createLaunch(vendor, { root, configPath: ticket.configPath, prompt, model, effort, executable }); }
  catch (error) { await revokeTicket(ticket, 'Launch configuration failed.'); throw error; }
  if (signal?.aborted) { await revokeTicket(ticket, 'Cancelled before process launch.'); throw new Error('Project assignment was cancelled before launch.'); }
  if (Date.now() >= ticket.expiresAt) { await revokeTicket(ticket, 'Launch configuration exceeded the assignment deadline.'); throw new Error('Project agent time limit expired before process launch.'); }
  let child, output = '', sessionId = null, error = null, callbackError = null, stopRequested = false, finishing = false, done = false;
  let closeCode = null, closeSignal = null, closeObserved = false, stopPromise = null, poll, timer;
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  const emit = (event) => {
    try { onEvent({ ...event, runId }); }
    catch (cause) { callbackError = `Could not record agent event: ${cause.message}`; }
  };
  const append = (text) => { output = control.boundedAppend(output, String(text), 100000); };
  let signedEvents = 0;
  const consume = createJournalReader(ticket, (event) => { signedEvents += 1; emit(event); });
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const failProvider = (message) => {
    if (finishing) { error = message; emit({ type: 'error', message }); }
    else void requestStop(message);
  };
  const parseLine = (line) => {
    // Once stopping, buffered provider prose cannot change the stop reason or
    // attach a late session identity to a cancelled assignment.
    if (stopRequested || !line.trim()) return;
    const event = providers.parseLine(vendor, line);
    if (!event) return;
    if (event.sessionId) {
      if (typeof event.sessionId !== 'string' || event.sessionId.length > 300) { failProvider('Provider returned an invalid session identity.'); return; }
      if (sessionId && event.sessionId !== sessionId) { failProvider('Provider session identity changed during this project assignment.'); return; }
      if (!sessionId) { sessionId = event.sessionId; emit({ type: 'session', sessionId }); }
    }
    if (event.detail) emit({ type: 'output', text: String(event.detail).slice(0, 8000) });
    if (event.error) failProvider(String(event.error).slice(0, 8000));
  };
  const finish = async (exitCode, termination) => {
    if (finishing || done) return;
    finishing = true;
    clearInterval(poll);
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    try {
      await revokeTicket(ticket, error || 'Provider process finished.');
      try { consume(true); } catch (cause) { error = error || cause.message; emit({ type: 'error', message: cause.message }); }
      try { pending += decoder.end(); parseLine(pending); } catch (cause) { error = error || `Provider output could not be parsed: ${cause.message}`; }
      if (termination && !termination.confirmed) error = `${error || 'Process stop requested.'} Process-tree termination could not be confirmed.`;
      if (!error && exitCode !== 0) error = `${vendor} exited ${exitCode === null ? `without an exit code${closeSignal ? ` (${closeSignal})` : ''}` : `with code ${exitCode}`}. ${control.classifyProviderError(output)}: inspect provider output.`;
      if (!error && signedEvents === 0) error = 'Provider exited without signed scoped-tool activity or writes. Check that the project MCP tools were connected.';
      error = error || callbackError;
    } catch (cause) { error = error || `Could not revoke project assignment: ${cause.message}`; }
    done = true;
    resolveFinished({ exitCode, sessionId, error, output, ...(termination ? { termination } : {}) });
  };
  const requestStop = (reason) => {
    if (done || finishing) return stopPromise || Promise.resolve({ confirmed: closeObserved, requested: false });
    if (stopPromise) return stopPromise;
    stopRequested = true;
    error = reason;
    emit({ type: 'error', message: reason });
    stopPromise = (async () => {
      try {
        await revokeTicket(ticket, reason);
        const termination = await control.stopProcessTree(child, { graceMs: 1000 });
        await finish(closeObserved ? closeCode : child?.exitCode ?? null, termination);
        return termination;
      } catch (cause) {
        error = `${reason} Could not confirm process stop: ${cause.message}`;
        await finish(closeObserved ? closeCode : null, { confirmed: false, error: cause.message });
        return { confirmed: false, error: cause.message };
      }
    })();
    return stopPromise;
  };
  function abort() { void requestStop('Project assignment cancelled.'); }
  try {
    child = (dependencies.spawn || spawn)(launch.command, launch.args, { cwd: launch.cwd, env: launch.env,
      windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (cause) { error = `Could not start ${vendor}: ${cause.message}`; await finish(null); return { finished, cancel: () => requestStop('Project assignment cancelled.') }; }
  child.stdout.on('data', (chunk) => {
    if (done || finishing || stopRequested) return;
    const text = decoder.write(chunk);
    append(text);
    pending += text;
    if (pending.length > 2 * 1024 * 1024) { void requestStop('Provider emitted an oversized stream event.'); return; }
    const lines = pending.split('\n');
    pending = lines.pop();
    try { for (const line of lines) parseLine(line); }
    catch (cause) { void requestStop(`Provider output could not be parsed: ${cause.message}`); }
  });
  child.stderr.on('data', (chunk) => {
    if (done || finishing || stopRequested) return;
    const text = chunk.toString('utf8');
    append(text);
    emit({ type: 'output', text: text.slice(0, 8000) });
  });
  child.once('error', (cause) => {
    if (!done && !finishing && !stopRequested) void requestStop(`Could not start ${vendor}: ${cause.message}`);
  });
  child.once('close', (code, nativeSignal) => {
    closeObserved = true; closeCode = code; closeSignal = nativeSignal;
    if (!stopRequested) void finish(code);
  });
  child.stdin.on('error', () => {});
  child.stdin.end(launch.stdin === undefined ? prompt : launch.stdin);
  poll = setInterval(() => {
    if (done || finishing || stopRequested) return;
    try { consume(); } catch (cause) { void requestStop(cause.message); }
  }, 100);
  timer = setTimeout(() => { void requestStop(`Project agent exceeded its ${timeoutMs} ms time limit.`); }, Math.max(0, ticket.expiresAt - Date.now()));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  return { finished, cancel: () => requestStop('Project assignment cancelled.'), child };
}

const startAgent = (options) => startWithDependencies(options);
module.exports = { startAgent, _startWithDependencies: startWithDependencies, makeTicket, revokeTicket, createJournalReader };
