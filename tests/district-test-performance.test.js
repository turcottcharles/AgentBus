'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTestPerformance}=require('../app/district/test-performance');
const run=(state='running',extra={})=>({id:1,root:'D:/project-a',created:1,sha:'candidate-a',manifest:{'app.js':'hash-a'},state,steps:[],...extra});
const advance=(controller,seconds)=>{let s;for(let i=0;i<seconds*20;i++)s=controller.sample(.05);return s;};

test('time and attention cannot manufacture work or a result',()=>{
  const c=createTestPerformance();assert.equal(advance(c,30).phase,'ready');
  c.setRun(run());const waiting=advance(c,30);
  assert.equal(waiting.phase,'watch');assert.equal(waiting.state,'running');assert.equal(waiting.passed,0);assert.equal(waiting.reaction,null);
  assert.deepEqual(waiting.position,[-18,.95,7]);
});
test('a fast real result remains visible in travel and receives one acknowledgment after arrival',()=>{
  const c=createTestPerformance();c.setRun(run());advance(c,1);
  c.setRun(run('passed',{steps:[{name:'Actual check',state:'passed'}]}));
  let s=c.sample();assert.equal(s.state,'passed');assert.equal(s.passed,1);assert.equal(s.reaction,null);
  s=advance(c,11.1);assert.equal(s.reaction,'relief');
  advance(c,3);c.setRun(run('passed'));assert.equal(c.sample().reaction,null);
});
test('history, project/candidate changes and unavailable status cannot replay success',()=>{
  const c=createTestPerformance();c.setRun(run('passed'));assert.equal(c.sample().phase,'inspect');assert.equal(c.sample().reaction,null);
  c.setRun(run('running',{root:'D:/project-b'}));assert.equal(c.sample().phase,'notice');
  const at=c.sample().age;c.setRun(run('running',{root:'D:/project-b'}),{unavailable:true});
  const frozen=advance(c,30);assert.equal(frozen.age,at);assert.equal(frozen.state,'unknown');assert.equal(frozen.active,false);assert.equal(frozen.scanning,false);assert.equal(frozen.locked,false);
  c.setRun(run('passed',{sha:'candidate-b'}));assert.equal(c.sample().reaction,null);
});
test('failure is concern; cancellation, timeout and interruption never look like a pass',()=>{
  for(const state of ['failed','cancelled','timed_out','interrupted','termination_unknown']){
    const c=createTestPerformance();c.setRun(run());advance(c,13);c.setRun(run(state));
    const result=c.sample();assert.equal(result.reaction,state==='failed'?'concern':'settle');assert.equal(result.active,false);
  }
});
test('reduced motion settles the pose without changing the observed outcome',()=>{
  const c=createTestPerformance();c.setRun(run());const s=c.sample(0,true);
  assert.equal(s.arrived,true);assert.equal(s.state,'running');assert.equal(s.reaction,null);assert.equal(s.passed,0);
});

test('checkout smoke jobs keep their six-check contract when scoped into the shared isometric world',()=>{
  const c=createTestPerformance();
  c.setRun({id:'smoke-42',projectId:'checkout:D:/ASM/agent-bus',root:'D:/ASM/agent-bus',created:1,kind:'smoke',building:'test',state:'running',total:6,checks:[{name:'JavaScript syntax',state:'passed'}]},{follow:true});
  const s=c.sample(.05);assert.equal(s.checkKind,'Smoke checks');assert.equal(s.total,6);assert.equal(s.passed,1);assert.equal(s.state,'running');
  assert.equal(require('../app/district/showcase-routing').facilityFor({kind:'smoke',building:'test',state:'agent_working'}),'test');
});
