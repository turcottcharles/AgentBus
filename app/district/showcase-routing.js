'use strict';
// Authored district entrances and clear approach roads; no work is dispatched.
const TARGETS={test:[-18,.95,7],build:[9,.95,-6.5],research:[-11,.95,-8.6],review:[-10,.95,18.5],preview:[18,.95,11.7],hub:[0,.95,6]};
function facilityFor(run,activity){
  if(run?.kind==='smoke'&&run.building==='test')return 'test';
  if(activity&&activity.projectId===run?.projectId&&activity.runId===run?.id&&!activity.stale&&activity.status!=='stale'&&!['passed','failed','cancelled','interrupted','timed_out','termination_unknown'].includes(run.state)){
    const phase=activity.phase==='edit'?'build':activity.phase;if(Object.hasOwn(TARGETS,phase))return phase;
  }
  if(run?.state==='building')return 'build';
  if(['testing','passed'].includes(run?.state)||run?.kind==='visual')return 'test';
  if(run?.state==='failed'&&run?.checks?.length)return 'test';
  return 'hub';
}
function routeFor(start,facility){
  const end=TARGETS[facility]||TARGETS.hub,points=[[...start]],push=(x,z)=>points.push([x,.95,z]);
  // Always leave northern facilities by their open frontage before crossing.
  if(start[2]<6){push(start[0],7);}
  if(facility==='test'){push(1,7);}
  else if(facility==='build'){push(6,7);push(6,-6.5);}
  else if(facility==='research'){push(-4,7);push(-4,-7);}
  else if(facility==='review'){push(-4,7);push(-4,18.5);}
  else if(facility==='preview'){push(6,7);push(6,12);push(18,12);}
  points.push([...end]);return points.filter((p,i)=>!i||Math.hypot(...p.map((v,j)=>v-points[i-1][j]))>.01);
}
function sampleRoute(points,progress){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j]))),total=lengths.reduce((a,b)=>a+b,0);let left=Math.max(0,Math.min(1,progress))*total;
  for(let i=0;i<lengths.length;i++){if(left<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],u=lengths[i]?Math.min(1,left/lengths[i]):1;return{position:a.map((v,j)=>v+(b[j]-v)*u),heading:Math.atan2(b[0]-a[0],b[2]-a[2]),distance:total};}left-=lengths[i];}
  return{position:[...points[0]],heading:0,distance:0};
}
module.exports={TARGETS,facilityFor,routeFor,sampleRoute};
