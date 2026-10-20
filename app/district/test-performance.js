'use strict';
const {routeFor,sampleRoute,TARGETS}=require('./showcase-routing');

// Presentation only. No clock, pose or reported prose can create a test result.
const ACTIVE = new Set(['assigned', 'starting_agent', 'agent_working', 'running', 'agent_review', 'queued', 'starting', 'working', 'testing']);
const ENDED = new Set(['passed', 'failed', 'cancelled', 'interrupted', 'timed_out', 'stopping', 'termination_unknown']);
const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const candidateOf = run => run?.artifact?.candidateHash || run?.source?.hash || '';
const baseKeyOf = run => run && JSON.stringify([run.projectId || '', run.root || '', run.id, run.created, run.sha || '', run.manifest || {}]);
const keyOf = run => run && JSON.stringify([baseKeyOf(run), candidateOf(run)]);

function createTestPerformance() {
  let key = '', record = null, age = 0, reactionAge = 100, pendingReaction = false, available = true, live = false;
  let route=null,facility='test',legStart=7.5,lastPosition=[5,.95,12];
  function setRun(run, { follow = false, unavailable = false, startPosition } = {}) {
    available = !unavailable;
    if (!run) { record = null; key = ''; age = 0; pendingReaction = false; reactionAge = 100; live = false; route=null;return; }
    const nextKey = keyOf(run);
    const enrichment = record && baseKeyOf(record) === baseKeyOf(run) && !candidateOf(record) && candidateOf(run);
    const changed = nextKey !== key && !enrichment;
    if (changed) {
      key = nextKey; age = 0; reactionAge = 100; pendingReaction = false;
      // Opening a saved result is a settled inspection, never a fresh celebration.
      live = follow || ACTIVE.has(run.state);
      pendingReaction = follow && ENDED.has(run.state);
      if (!live) age = 12;
      lastPosition=Array.isArray(startPosition)&&startPosition.length===3&&startPosition.every(Number.isFinite)?[...startPosition]:[5,.95,12];
      facility=run.presentationFacility||'test';route=run.projectId?routeFor(lastPosition,facility):null;legStart=7.5;
    } else if (available && record && ACTIVE.has(record.state) && ENDED.has(run.state) && live) pendingReaction = true;
    if(!changed&&run.projectId&&run.presentationFacility&&run.presentationFacility!==facility){facility=run.presentationFacility;route=routeFor(lastPosition,facility);legStart=Math.max(7.5,age);}
    key = nextKey;
    record = { ...run, steps: Array.isArray(run.steps) ? run.steps : Array.isArray(run.checks) ? run.checks : [] };
  }
  function sample(dt = 0, reducedMotion = false) {
    const halted = ['cancelled', 'stopping', 'interrupted', 'timed_out', 'termination_unknown'].includes(record?.state);
    if (available && record && !halted) age += Math.max(0, Math.min(.1, dt));
    if (reducedMotion && record) age = Math.max(age, 12);
    const legProgress=route?smooth(legStart,legStart+4.5,age):smooth(7.5,12,age);
    const navigation=route?sampleRoute(route,legProgress):null;
    if(navigation)lastPosition=navigation.position;
    const arrived = !!record && legProgress>=1;
    if (available && pendingReaction && arrived) { reactionAge = 0; pendingReaction = false; }
    else reactionAge += Math.max(0, Math.min(.1, dt));
    const state = available ? record?.state || 'idle' : 'unknown';
    const phase = !record ? 'ready' : !available ? 'unknown' : halted ? 'stopped' : !live ? 'inspect' : age < .75 ? 'notice' : age < 2.2 ? 'uncertain' : age < 3.4 ? 'deploy' : age < 5.8 ? 'search' : age < 6.4 ? 'lock' : age < 7.5 ? 'turn' : !arrived ? 'travel' : ACTIVE.has(state) ? 'watch' : 'result';
    const travel = record ? legProgress : 0;
    const passed = record?.steps.filter(s => s.state === 'passed').length || 0;
    const total = Array.isArray(record?.checkPlan) && record.checkPlan.length ? record.checkPlan.length
      : Number.isInteger(record?.total) && record.total > 0 ? record.total
        : !record?.projectId ? 6 : ENDED.has(state) && record.steps.length ? record.steps.length : null;
    const checkKind = record?.kind === 'visual' ? 'Browser checks' : record?.kind === 'smoke' ? 'Smoke checks' : record?.projectId ? 'Source checks' : 'Smoke checks';
    const reaction = available && reactionAge < 1.8 && !reducedMotion ? state === 'passed' ? 'relief' : state === 'failed' ? 'concern' : 'settle' : null;
    return { phase, age, state, arrived, live, available, reaction, reactionAge, travel,
      // Turn onto the clear front road before passing the Review Archive.
      position: navigation?.position || [5 - 4 * Math.min(travel / .25, 1) - 19 * Math.max(0, (travel - .25) / .75), .95, 12 - 5 * Math.min(travel / .25, 1)],
      heading: navigation?.heading, facility, basis: record?.presentationBasis||'observed',target: TARGETS[facility]||TARGETS.test,
      passed, total, checkKind, candidateHash: candidateOf(record), projectId: record?.projectId || '', current: available ? record?.steps.find(s => s.state === 'running')?.name || '' : '',
      runId: record?.id ?? null, root: record?.root || '', sha: record?.sha || '',
      extension: record ? smooth(2.2, 3, age) : 0, open: record ? smooth(2.75, 3.4, age) : 0,
      locked: available && !!record && age >= 5.8,
      scanning: available && phase === 'search',
      active: available && ACTIVE.has(state),
      // Result words and counts always reflect the record, including before arrival.
      label: !available ? 'Status unavailable' : !record ? 'Ready for an assignment' : `${total ? passed+'/'+total : passed} ${checkKind.toLowerCase()} · ${state.replaceAll('_', ' ')}` };
  }
  return { setRun, sample };
}
module.exports = { createTestPerformance, keyOf };
