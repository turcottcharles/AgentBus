import * as THREE from 'three';

// Original additive hardware. Keep the approved host GLB and facial rig intact.
export function buildThrusters(host,scene) {
 const root=new THREE.Group();root.name='OriginalIndustrialThrusterPack';host.add(root);
 const steel=new THREE.MeshStandardMaterial({color:0x26313c,metalness:.88,roughness:.34});
 const rim=new THREE.MeshStandardMaterial({color:0x625c61,metalness:.83,roughness:.44});
 const copper=new THREE.MeshStandardMaterial({color:0x98603d,metalness:.8,roughness:.33});
 const guards=new THREE.MeshStandardMaterial({color:0x101a26,metalness:.68,roughness:.48});
 const hot=new THREE.MeshStandardMaterial({color:0x702a15,emissive:0xff6b21,emissiveIntensity:.1,metalness:.5,roughness:.35,side:THREE.DoubleSide});
 const jetMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uPower:{value:0}},vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;void main(){vUv=uv;vN=mat3(modelMatrix)*normal;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',
  fragmentShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;uniform float uTime;uniform float uPower;
   void main(){float y=vUv.y;float bands=.62+.38*sin(y*48.-uTime*38.);float taper=smoothstep(0.,.25,y);float flicker=.86+.14*sin(uTime*91.+vUv.x*19.);float softEdge=pow(abs(dot(normalize(vN),normalize(cameraPosition-vWorld))),1.5);vec3 col=mix(vec3(1.,.19,.015),vec3(.10,.40,1.),smoothstep(.10,.8,y));col=mix(col,vec3(.75,.92,1.),pow(y,4.)*.7);gl_FragColor=vec4(col*1.2,taper*bands*flicker*softEdge*uPower*.24);}`});
 const coreMaterial=new THREE.MeshBasicMaterial({color:0x8adfff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
 const jets=[],cores=[],pods=[];
 const mesh=(parent,g,m,p)=>{const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3+.2,x=Math.cos(a)*.40,z=Math.sin(a)*.40;const pod=new THREE.Group();pod.position.set(x,0,z);root.add(pod);pods.push(pod);
  const profile=[[.12,.55],[.13,.4],[.14,.25],[.23,.10],[.235,.06],[.205,.055],[.13,.24],[.105,.4],[.10,.55]].map(p=>new THREE.Vector2(...p));
  mesh(pod,new THREE.LatheGeometry(profile,32),steel,[0,0,0]);
  for(const y of [.35,.42,.49]){const r=mesh(pod,new THREE.TorusGeometry(.146,.023,8,32),copper,[0,y,0]);r.rotation.x=Math.PI/2;}
  const lip=mesh(pod,new THREE.TorusGeometry(.22,.021,8,32),rim,[0,.075,0]);lip.rotation.x=Math.PI/2;
  const throat=mesh(pod,new THREE.CylinderGeometry(.108,.17,.1,24,1,true),hot,[0,.18,0]);
  for(let k=0;k<3;k++){const b=k*Math.PI*2/3;const fin=mesh(pod,new THREE.BoxGeometry(.055,.31,.13),guards,[Math.cos(b)*.18,.29,Math.sin(b)*.18]);fin.rotation.y=-b;}
  const line=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.8,.79,z*.8),new THREE.Vector3(x*1.25,.63,z*1.25),new THREE.Vector3(x,.48,z)]);
  mesh(root,new THREE.TubeGeometry(line,12,.022,6,false),copper,[0,0,0]);
  const g=new THREE.CylinderGeometry(.105,.17,1,24,6,true);g.translate(0,-.5,0);const flame=mesh(pod,g,jetMaterial,[0,.06,0]);flame.castShadow=false;flame.receiveShadow=false;jets.push(flame);
  const cg=new THREE.CylinderGeometry(.035,.055,1,16,4,true);cg.translate(0,-.5,0);const core=mesh(pod,cg,coreMaterial,[0,.06,0]);core.castShadow=false;core.receiveShadow=false;cores.push(core);
 }
 const wash=new THREE.PointLight(0xff6b25,0,6,2);scene.add(wash);
 const dustG=new THREE.BufferGeometry(),positions=[];for(let i=0;i<40;i++)positions.push(i/40*Math.PI*2,(i*17%41)/41,(i*13%37)/37);dustG.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const dustM=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uPower:{value:0},uOrigin:{value:new THREE.Vector3()}},
  vertexShader:`uniform float uTime;uniform float uPower;uniform vec3 uOrigin;varying float vFade;void main(){float life=fract(uTime*.8+position.y);float r=.2+life*2.8;vec3 p=uOrigin+vec3(cos(position.x)*r,.10+sin(life*3.14159)*.14,sin(position.x)*r);vFade=(1.-life)*uPower*.35;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);gl_PointSize=7.+position.z*10.;}`,
  fragmentShader:'varying float vFade;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.66,.57,.43,smoothstep(.5,.1,d)*vFade);}'});
 const dust=new THREE.Points(dustG,dustM);dust.frustumCulled=false;scene.add(dust);
 let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
 return {root,audit:{originalAttachment:true,nozzles:3,triangles,sourceHostModified:false},pose(t,power){jetMaterial.uniforms.uTime.value=t;jetMaterial.uniforms.uPower.value=power;hot.emissiveIntensity=.15+power*2.3;
  coreMaterial.opacity=power*.6;
  jets.forEach((j,i)=>{j.scale.y=.08+power*.50*(1+.04*Math.sin(t*61+i));j.scale.x=j.scale.z=.7+power*.3;cores[i].scale.y=j.scale.y*.85;});
  const origin=host.position;wash.position.set(origin.x,origin.y-.1,origin.z);wash.intensity=power*9;dustM.uniforms.uTime.value=t;dustM.uniforms.uPower.value=Math.max(0,power-.12);dustM.uniforms.uOrigin.value.set(origin.x,.1,origin.z);
 }};
}
