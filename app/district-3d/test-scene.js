import * as THREE from 'three';
import { bindFace, buildSensor } from './host-rig.js';

const ease = (a,b,t) => THREE.MathUtils.smoothstep(t,a,b);
const mix = THREE.MathUtils.lerp;
const vec = a => new THREE.Vector3(...a);

// T01: one original host, actual district geography, record-driven work cues.
export function testActor(host) {
  const head = host.getObjectByName('Head');
  const face = bindFace(head), sensor = buildSensor(head);
  face.colorize();
  return { face, sensor, dispose: () => face.dispose() };
}

export function poseTestScene({ sample:s, time, hostGroup, joints, actor, camera, reduced }) {
  for (const joint of joints.values()) joint.node.rotation.copy(joint.rotation);
  const t=s.age, p=s.position, traveling=s.phase==='travel';
  const heading=Number.isFinite(s.heading)?s.heading:s.travel < .25 ? Math.atan2(-4,-5) : -Math.PI/2;
  let bodyYaw = mix(mix(.45,heading,ease(6.4,7.5,t)),-Math.PI,ease(11.3,12,t));
  if(s.arrived&&s.available&&!s.active&&s.state!=='idle')bodyYaw=mix(-Math.PI,-.8,ease(0,1.1,s.reactionAge));
  hostGroup.position.set(p[0],p[1]+(reduced?0:Math.sin(time*1.7)*.035),p[2]);
  hostGroup.rotation.y=bodyYaw;
  const head=joints.get('Head'), armL=joints.get('ArmL'), armR=joints.get('ArmR');
  const question=ease(.75,1.35,t)*(1-ease(5.8,6.4,t));
  if(head){head.node.rotation.z-=question*.10;head.node.rotation.y+=mix(0,heading-.45,ease(6.4,7,t))*(1-ease(7,7.5,t));}
  const relief=s.reaction==='relief'?Math.sin(Math.PI*s.reactionAge/1.8):0;
  const concern=s.reaction==='concern'?Math.sin(Math.PI*s.reactionAge/1.8):0;
  if(head){head.node.rotation.x+=relief*.09;head.node.rotation.z-=concern*.10;}
  if(armL){armL.node.rotation.z+=.05+relief*.13;armL.node.rotation.x-=traveling?.12:.04;}
  if(armR){armR.node.rotation.z-=.05+relief*.10;armR.node.rotation.x-=traveling?.1:.04;}
  const core=joints.get('Core');if(core)core.node.rotation.y+=time*.14;
  actor?.face.pose({aimX:.025*ease(.75,1,t)*(1-ease(6,6.4,t)),aimY:concern*-.01,browL:question*.036+concern*.02,browR:question*.006+relief*.008,rollL:question*.13,rollR:question*-.03});
  const scan=s.scanning?Math.sin((t-3.4)*Math.PI*1.2)*.5:0;
  const destination=s.target||[-18,.95,7], aim=[destination[0],4,destination[2]-4];
  actor?.sensor.pose({extension:s.extension,open:s.open,scanYaw:s.locked?Math.atan2(aim[0]-p[0],aim[2]-p[2])-bodyYaw:scan,scanPitch:-.12,locked:s.locked});
  // Close intimacy -> reveal/deploy -> low tracking dolly -> lab crane.
  let position,target,fov;
  if(t<7.5&&!s.arrived){
    const out=ease(2.05,3.4,t);
    position=[p[0]+mix(1.1,3,out),mix(5.1,6.5,out),p[2]+mix(2.7,7,out)];target=[p[0],mix(4.85,5.3,out),p[2]];fov=mix(36,42,out);
  }else if(!s.arrived){
    position=[p[0]+7,5.5,p[2]+8];target=[p[0],3.8,p[2]];fov=46;
  }else{
    const crane=ease(12,14,t);
    position=[p[0]-6,mix(5.5,7.5,crane),p[2]+9];target=[destination[0],4,mix(destination[2],destination[2]-3.7,crane)];fov=46;
    // T01E/R01: give the helper a readable whole silhouette after the close
    // acknowledgment. The same lab remains behind him; no overhead cut.
    const settle=ease(14,17,t);
    position=position.map((value,index)=>mix(value,[p[0]-7,6,p[2]+11][index],settle));
    target=target.map((value,index)=>mix(value,[p[0]-2,3.6,p[2]-1][index],settle));
  }
  camera.position.copy(vec(position));camera.fov=fov;camera.updateProjectionMatrix();camera.lookAt(vec(target));
  return { ...s, camera:{position,target,fov}, faceRig:actor?.face.audit, sensor:actor?.sensor.audit };
}
