'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const CHECKS = Object.freeze(['JavaScript syntax', 'Python syntax and local messaging', 'Hub messaging and read receipts',
  'File bytes and integrity hash', 'HTTP authentication and RPC', 'Owner approval and keyring overwrite guards']);
const ACTIVE = Object.freeze(['assigned', 'starting_agent', 'agent_working', 'running', 'agent_review']);
function signEvent(ticket, event) {
  const body = JSON.stringify({ ...event, id: crypto.randomUUID(), jobId: ticket.jobId, at: Date.now() });
  return { body, mac: crypto.createHmac('sha256', ticket.key).update(body).digest('hex') };
}
function verifyEvent(ticket, envelope) {
  if (typeof envelope.body !== 'string' || envelope.body.length > 40000 || !/^[a-f0-9]{64}$/.test(envelope.mac || '')) throw new Error('Invalid agent event envelope');
  const expected = crypto.createHmac('sha256', ticket.key).update(envelope.body).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(envelope.mac, 'hex'))) throw new Error('Unverified agent event signature');
  const event = JSON.parse(envelope.body);
  if (event.jobId !== ticket.jobId || typeof event.id !== 'string') throw new Error('Wrong agent job identity');
  return event;
}
function emitEvent(ticket, event) {
  fs.appendFileSync(ticket.events, JSON.stringify(signEvent(ticket, event)) + '\n', { encoding: 'utf8' });
}
function validResult(steps, summary, code) {
  return code === 0 && summary?.state === 'passed' && steps.length === CHECKS.length &&
    CHECKS.every((name) => steps.filter((s) => s.name === name && s.state === 'passed').length === 1);
}
module.exports = { CHECKS, ACTIVE, signEvent, verifyEvent, emitEvent, validResult };
