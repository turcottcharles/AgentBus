'use strict';
// Canonical qualification -> derived task/shot/board labels. Import is inert.
// Never edits the frozen SHOT-LIST.json or direction Markdown.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname,'../..');
const QUALIFICATION = 'evidence/showcase/qualification.json';
const OUTPUTS = Object.freeze(['design/showcase/tasks.json','design/showcase/tracking-data.js','design/showcase/qualification-status.json','design/district-3d/IMPLEMENTATION-STATE.json','design/showcase/CAPABILITIES.json']);
const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = (root,relative) => JSON.parse(fs.readFileSync(path.join(root,relative),'utf8').replace(/^\uFEFF/,''));
const label = state => ({passed:'passed within the recorded scope',pending:'current acceptance pending',failed:'current acceptance failed',
  partially_qualified:'partial current evidence',carried_forward_component_only:'historical backend component only',historical_not_current:'historical; current evidence pending'}[state] || 'current acceptance pending');
function projectStatus({qualification,tasks,direction,at,qualificationSha256}) {
  if (qualification?.schemaVersion !== 2 || !qualification.candidate?.productionDigest || !Array.isArray(qualification.checks)) throw new Error('Reconcile the current schema-2 qualification receipt first; no old qualified label is projected.');
  const data = copy(tasks), current = qualification.state === 'local_showcase_qualified';
  const check = id => qualification.checks.find(item => item.id === id);
  const laneCheck = {'SC-04':'codex','SC-07':'multi','SC-13':'claude-component','SC-16':'lifecycle','SC-17':'multi','SC-19':'handoff'};
  data.status = current ? 'local_showcase_qualified' : 'current_candidate_acceptance_pending';
  data.updatedAt = at || qualification.at;
  const remaining = Array.isArray(qualification.remaining) ? qualification.remaining : [];
  for (const task of data.tasks || []) {
    const scoped = check(laneCheck[task.id]);
    const state = scoped?.state || (current ? 'partially_qualified' : 'pending');
    task.implementationSummary ??= task.summary || '';
    task.currentQualification = {
      state, candidate:qualification.productionSourceDigest, receipt:QUALIFICATION,
      scope:scoped?.detail?.scope || 'Lane implementation receipts and focused tests are separate from current whole-product native acceptance.',
      wholeCandidateState:qualification.state,
      currentUIQualified:task.id === 'SC-13' ? false : null,
    };
    task.summary = 'Current qualification: ' + label(state) + '. ' + task.implementationSummary;
  }
  const previous = qualification.history?.previous;
  data.integration = {
    owner:'/root',status:data.status,candidate:qualification.productionSourceDigest,
    runtimeSourceHash:qualification.sourceHash,qualification:QUALIFICATION,qualificationSha256:qualificationSha256 || null,
    gates:qualification.checks.map(item => ({id:item.id,title:item.name,state:item.state,status:label(item.state),
      required:item.required,evidence:QUALIFICATION,scope:item.detail?.scope || '',receipt:item.detail?.receipt || item.detail?.tap || null})),
    evidence:[QUALIFICATION],historicalEvidence:qualification.historicalEvidence || [],
    previousQualification:previous?.path || null,remaining,
    shots:{},
  };
  data.shots = (direction.shots || []).map(shot => {
    const record = qualification.shots?.[shot.id] || {state:'pending',summary:'Current-candidate acceptance is not recorded for this shot. No historical pass is inherited.'};
    const message = label(record.state) + ': ' + record.summary;
    data.integration.shots[shot.id] = message;
    return {id:shot.id,title:shot.title,phase:shot.phase,action:shot.direction?.action || shot.continuity || '',
      owners:shot.ownerTaskIds || [],acceptance:shot.acceptance || [],qualification:message,
      currentQualification:{...record,candidate:qualification.productionSourceDigest,receipt:QUALIFICATION}};
  });
  const status = {schemaVersion:1,at:data.updatedAt,source:{path:QUALIFICATION,sha256:qualificationSha256 || null,candidate:qualification.productionSourceDigest},
    state:qualification.state,metrics:qualification.metrics,integration:data.integration,
    tasks:(data.tasks || []).map(task => ({id:task.id,implementationState:task.status,currentQualification:task.currentQualification})),
    shots:data.shots.map(shot => ({id:shot.id,...shot.currentQualification})),limits:qualification.limits};
  return {tasks:data,status,trackingData:'window.SHOWCASE_TRACKING='+JSON.stringify(data,null,2)+';\n'};
}
function generate(options = {}) {
  const root = options.root || ROOT;
  const bytes = fs.readFileSync(path.join(root,QUALIFICATION));
  const qualification = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  const production = require(path.join(root,'evidence/showcase/production-startup.cjs'));
  const before = production.sourceManifest();
  if (qualification.productionSourceDigest !== before.digest) throw new Error('Canonical qualification belongs to different production bytes. Reconcile again; no derived files changed.');
  const result = projectStatus({qualification,tasks:read(root,'design/showcase/tasks.json'),direction:read(root,'design/showcase/SHOT-LIST.json'),
    at:options.at,qualificationSha256:hash(bytes)});
  if (!options.write) return result;
  if (production.sourceManifest().digest !== before.digest || hash(fs.readFileSync(path.join(root,QUALIFICATION))) !== hash(bytes)) throw new Error('Candidate or canonical receipt changed during generation; no derived files changed.');
  const implementation = {schemaVersion:2,at:qualification.at,status:qualification.state,
    generatedFrom:{path:QUALIFICATION,sha256:hash(bytes),candidate:qualification.productionSourceDigest},
    ownerDirection:'Accepted foundation: close single-robot reveal automatically pulls back into the isometric build area. No filler bots; additional workers require real sessions or assignments.',
    blueprint:'design/district-3d/STORYBOARD.md',canonicalShots:'design/showcase/SHOT-LIST.json',
    designLanguage:'design/district-3d/DESIGN-LANGUAGE.md',assetRegistry:'design/district-3d/ASSET-REGISTRY.json',
    current:Object.fromEntries(['app/district-attract-world.js','app/district-3d/world-entry.js','app/assets/district-v2/district-world.glb','app/assets/district-v2/district-host.glb'].map(file=>[file,{sha256:before.files[file]}])),
    checks:qualification.checks,remaining:qualification.remaining,limits:qualification.limits};
  const capabilities=read(root,'design/showcase/CAPABILITIES.json');
  capabilities.qualification={generatedFrom:QUALIFICATION,sha256:hash(bytes),at:qualification.at,state:qualification.state,
    candidate:qualification.productionSourceDigest,checks:qualification.checks,remaining:qualification.remaining,
    scope:'Capability rows are source inventory, not whole-product acceptance. Current acceptance comes only from the canonical qualification record.'};
  const values = [JSON.stringify(result.tasks,null,2)+'\n',result.trackingData,JSON.stringify(result.status,null,2)+'\n',JSON.stringify(implementation,null,2)+'\n',JSON.stringify(capabilities,null,2)+'\n'];
  const staged = [];
  try {
    OUTPUTS.forEach((relative,index) => {
      const target=path.join(root,relative),temporary=target+'.'+process.pid+'-'+crypto.randomUUID()+'.tmp';
      fs.writeFileSync(temporary,values[index],{flag:'wx'});staged.push({target,temporary});
    });
    for(const file of staged)fs.renameSync(file.temporary,file.target);
  } finally {for(const file of staged)if(fs.existsSync(file.temporary))fs.unlinkSync(file.temporary);}
  return result;
}
module.exports={ROOT,QUALIFICATION,OUTPUTS,label,projectStatus,generate};
if(require.main===module){
  const args=process.argv.slice(2);
  if(args.length!==1||!['--check','--write'].includes(args[0])){console.error('Use --check (read-only preview) or --write after canonical qualify.cjs. Imports never mutate files.');process.exitCode=1;}
  else try{
    const result=generate({write:args[0]==='--write'});
    console.log(JSON.stringify({state:result.status.state,candidate:result.status.source.candidate,metrics:result.status.metrics,
      outputs:OUTPUTS,written:args[0]==='--write',remaining:result.status.integration.remaining},null,2));
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
