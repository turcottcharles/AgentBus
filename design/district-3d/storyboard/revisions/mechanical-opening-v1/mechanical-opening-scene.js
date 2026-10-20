import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { hardwareIdentity, validateEmbeddedGLB } from '../../../app/district-3d/world-entry.js';
import { bindFace, buildSensor } from '../../../app/district-3d/host-rig.js';

const ease=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b),mix=THREE.MathUtils.lerp;
export const shots=[
 {id:'M01',start:0,end:2.5,title:'Something arrives',action:'Drive vanes turn; the machine settles into the light.'},
 {id:'M02',start:2.5,end:4.2,title:'Precise machinery',action:'A copper shoulder turns. The mechanism holds.'},
 {id:'M03',start:4.2,end:6.2,title:'Controlled stop',action:'A low crane discovers the body. The face stays hidden.'},
 {id:'M04',start:6.2,end:12,title:'Someone helpful',action:'Profile reveal. Eyes notice first; the tiny dish investigates.'}
];

export function mount({container,readAsset}) {
 const canvas=document.createElement('canvas');container.append(canvas);
 const gl=canvas.getContext('webgl2',{antialias:true,powerPreference:'high-performance',failIfMajorPerformanceCaveat:true});
 if(!gl)throw Error('Hardware WebGL2 required');const check=hardwareIdentity(gl);if(!check.supported||!/NVIDIA/i.test(check.identity.renderer))throw Error('Verified NVIDIA GPU required');
 const renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.76;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.info.autoReset=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x06101e);scene.fog=new THREE.FogExp2(0x14253e,.009);
 const camera=new THREE.PerspectiveCamera(40,16/9,.06,260);
 const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(renderer),env=generator.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.30;room.dispose();generator.dispose();
 scene.add(new THREE.HemisphereLight(0x9ed9fa,0x132033,1.5));
 const key=new THREE.DirectionalLight(0xa0c8ff,2.1);key.position.set(-22,38,12);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-38,right:38,top:36,bottom:-32,near:1,far:100});key.shadow.bias=-.0006;key.shadow.normalBias=.06;scene.add(key);
 const rim=new THREE.DirectionalLight(0xffb56c,1.7);rim.position.set(23,16,-15);scene.add(rim);
 const practical=new THREE.PointLight(0x92e6ff,9,12,2);practical.position.set(7,5,15);scene.add(practical);
 const floorGlow=new THREE.PointLight(0x65d6df,2,4,2);floorGlow.position.set(5,1,12);scene.add(floorGlow);
 // Quiet perimeter context; the foreground remains the actual management GLB.
 const towerMat=new THREE.MeshStandardMaterial({color:0x13273d,roughness:.7,metalness:.25}),windowMat=new THREE.MeshStandardMaterial({color:0x53788d,emissive:0x53788d,emissiveIntensity:.55});
 const towers=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),towerMat,48),windows=[];const transform=new THREE.Object3D();
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2,r=53+i%3*6,x=Math.cos(a)*r,z=Math.sin(a)*r-5,h=10+i*7%23;transform.position.set(x,h/2-2,z);transform.rotation.set(0,0,0);transform.scale.set(3+i%3,h,4);transform.updateMatrix();towers.setMatrixAt(i,transform.matrix);for(let y=1;y<h-2;y+=2.8)for(let side=-1;side<=1;side+=2)windows.push([x+side*.8,y,z+2.03]);}
 const lights=new THREE.InstancedMesh(new THREE.BoxGeometry(.23,.5,.05),windowMat,windows.length);windows.forEach((p,i)=>{transform.position.set(...p);transform.scale.set(1,1,1);transform.updateMatrix();lights.setMatrixAt(i,transform.matrix)});scene.add(towers,lights);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.10,.45,1.5));composer.addPass(new OutputPass());
 let host,face,sensor,world;const rig={};let count=0,last=null,lastWidth=0,lastHeight=0;
 async function load(name){const result=await readAsset(name),raw=atob(result.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));validateEmbeddedGLB(bytes.buffer);const manager=new THREE.LoadingManager();manager.setURLModifier(()=>{throw Error('External assets denied')});return(await new GLTFLoader(manager).parseAsync(bytes.buffer,'')).scene;}
 const ready=(async()=>{
  const [district,character]=await Promise.all([load('district-world.glb'),load('district-host.glb')]);world=district;scene.add(world);host=new THREE.Group();host.add(character);scene.add(host);host.scale.setScalar(1.65);
  for(const name of ['Head','ArmL','ArmR','Core']){const node=character.getObjectByName(name);rig[name]={node,rotation:node.rotation.clone()};}
  face=bindFace(rig.Head.node);face.colorize();sensor=buildSensor(rig.Head.node);
  scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return {gpu:check.identity,face:face.audit,sensor:sensor.audit};
 })();
 function render(t){
  const shot=shots.find(s=>t>=s.start&&t<s.end)||shots.at(-1);
  for(const j of Object.values(rig))j.node.rotation.copy(j.rotation);
  const stop=ease(0,2.15,t),settle=t<4.2?Math.sin(t*4)*.025*Math.exp(-t*.9):0;
  host.position.set(5,.95+settle,10.8+1.2*stop);host.rotation.y=.45;
  rig.Core.node.rotation.y+=.9*(1-Math.exp(-t*1.4))+.05*t;
  rig.ArmR.node.rotation.x-=.12*(1-ease(2.5,3.5,t));rig.ArmR.node.rotation.z-=.035*ease(2.5,3.3,t);
  rig.ArmL.node.rotation.z+=.035;
  const question=ease(6.65,7.25,t)*(1-ease(9.1,10,t));
  rig.Head.node.rotation.y+=.22*ease(6.95,8.2,t);rig.Head.node.rotation.z-=.075*question;rig.Head.node.rotation.x+=.035*Math.sin(ease(10.8,12,t)*Math.PI);
  face.pose({aimX:.025*ease(6.65,6.8,t),aimY:.008*question,browL:.032*question,browR:.005*question,rollL:.1*question,rollR:-.025*question});
  sensor.pose({extension:ease(9,9.8,t),open:ease(9.5,10.4,t),scanYaw:t<10.4?0:mix(Math.sin((t-10.4)*8)*.2,-.3,ease(11.2,11.65,t)),scanPitch:-.12,locked:t>=11.65});
  let p,target,fov;
  if(shot.id==='M01') {const u=ease(0,2.5,t);p=[mix(6.5,6.15,u),mix(1.25,1.4,u),mix(13.65,13.45,u)];target=[5,1.62,host.position.z];fov=38;}
  if(shot.id==='M02') {const u=ease(2.5,4.2,t);p=[mix(7.8,7.55,u),3.8,12.4];target=[6.32,4.0,11.36];fov=32;}
  if(shot.id==='M03') {const u=ease(4.2,6.2,t);p=[3.2,mix(1.8,3.25,u),9.3];target=[5,mix(2.1,3.4,u),12];fov=42;}
  if(shot.id==='M04') {const u=ease(6.2,12,t);p=[mix(8.9,8.5,u),mix(5.15,5.5,u),mix(12.4,14.3,u)];target=[5,mix(5.05,5.25,u),12];fov=mix(38,46,ease(8.7,10.4,t));}
  camera.position.set(...p);camera.fov=fov;camera.lookAt(new THREE.Vector3(...target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  const bounds=container.getBoundingClientRect();if(bounds.width!==lastWidth||bounds.height!==lastHeight){lastWidth=bounds.width;lastHeight=bounds.height;renderer.setPixelRatio(1);renderer.setSize(Math.round(bounds.width),Math.round(bounds.height),false);composer.setSize(Math.round(bounds.width),Math.round(bounds.height));}camera.aspect=bounds.width/bounds.height;camera.updateProjectionMatrix();
  // Verify the optics remain outside frame until the deliberate profile cut.
  const faceVisible=[-.26,.26].some(x=>{const c=new THREE.Vector3(x,2.56,.53).applyMatrix4(host.matrixWorld).project(camera);return c.x>-1&&c.x<1&&c.y>-1&&c.y<1&&c.z>-1&&c.z<1;});
  renderer.info.reset();composer.render();count++;
  last={t,shot:shot.id,camera:{position:p,target,fov},hostPosition:host.position.toArray(),faceVisible,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpu:check.identity,face:face.audit,sensor:sensor.audit};return last;
 }
 return {ready,render,diagnostics:()=>last,destroy(){face?.dispose();const gs=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)ms.add(m)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());composer.passes.forEach(p=>p.dispose?.());composer.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
window.MechanicalOpening={mount,shots};
