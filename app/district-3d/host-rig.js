// Approved original host facial controls and compact sensor; source GLB remains unchanged.
import * as THREE from 'three';

// Rig existing connected surface components; never edit their vertices.
export function bindFace(root) {
  const parts=[],originals=[];let before=0,after=0;
  root.traverse(mesh=>{if(mesh.isMesh)originals.push(mesh);});
  for(const mesh of originals){
    const label=mesh.material?.name||'';
    if(!/midnight structural|pearl edge|cyan optical|lens catchlight/.test(label))continue;
    const g=mesh.geometry.clone(),p=g.attributes.position,idx=g.index;
    if(!idx)throw Error('Indexed facial surfaces required');
    const parent=Array.from({length:p.count},(_,i)=>i),same=new Map(),representatives=[];
    const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    const union=(a,b)=>{parent[find(a)]=find(b);};
    for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!same.has(k))same.set(k,i);representatives[i]=same.get(k);}
    for(let i=0;i<idx.count;i+=3){union(representatives[idx.getX(i)],representatives[idx.getX(i+1)]);union(representatives[idx.getX(i)],representatives[idx.getX(i+2)]);}
    const components=new Map();
    for(let i=0;i<idx.count;i+=3){const key=find(representatives[idx.getX(i)]);if(!components.has(key))components.set(key,[]);components.get(key).push(idx.getX(i),idx.getX(i+1),idx.getX(i+2));}
    const kept=[];before+=idx.count/3;
    for(const indices of components.values()){
      const box=new THREE.Box3();for(const i of indices)box.expandByPoint(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
      const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());let role=null;
      if(/pearl edge/.test(label)&&center.y>2.73&&center.y<2.85&&size.x<.35&&size.y<.12&&size.z<.09)role='brow';
      if(/midnight structural/.test(label)&&box.min.z>.515&&size.x<.18&&size.y<.18)role='pupil';
      if(/cyan optical/.test(label)&&center.y>2.4&&box.min.z>.49)role='iris';
      if(/lens catchlight/.test(label))role='catchlight';
      if(!role){kept.push(...indices);continue;}
      const partGeometry=new THREE.BufferGeometry();for(const [key,attribute]of Object.entries(g.attributes))partGeometry.setAttribute(key,attribute);partGeometry.setIndex(indices);
      const pivot=new THREE.Group();pivot.name='Study_'+role+'_'+(center.x<0?'L':'R');pivot.position.copy(center);
      const surface=new THREE.Mesh(partGeometry,mesh.material);surface.position.copy(center).negate();surface.castShadow=mesh.castShadow;surface.receiveShadow=mesh.receiveShadow;pivot.add(surface);
      const carrier=new THREE.Group();carrier.position.copy(mesh.position);carrier.quaternion.copy(mesh.quaternion);carrier.scale.copy(mesh.scale);carrier.add(pivot);mesh.parent.add(carrier);
      parts.push({role,side:center.x<0?-1:1,pivot,center: center.clone(),surface,triangles:indices.length/3});after+=indices.length/3;
    }
    g.setIndex(kept);mesh.geometry=g;after+=kept.length/3;
  }
  const counts=Object.fromEntries(['brow','pupil','iris','catchlight'].map(role=>[role,parts.filter(p=>p.role===role).length]));
  if(Object.values(counts).some(n=>n!==2)||before!==after)throw Error('Facial rig must find two of each existing component and conserve triangles: '+JSON.stringify(counts));
  const audit={counts,trianglesBefore:before,trianglesAfter:after,verticesEdited:0,method:'Connected-component index partition, original position/normal attributes retained; neutral pivot/mesh translations cancel.'};
  const eyeInk=new THREE.MeshBasicMaterial({color:0x123342}),irisInk=new THREE.MeshBasicMaterial({color:0x56b8c5}),browInk=new THREE.MeshStandardMaterial({color:0xe8ece7});
  return {audit,pose({aimX=0,aimY=0,browL=0,browR=0,rollL=0,rollR=0}={}){
    for(const part of parts){part.pivot.position.copy(part.center);part.pivot.rotation.set(0,0,0);if(part.role==='brow'){part.pivot.position.y+=part.side<0?browL:browR;part.pivot.rotation.z=part.side<0?rollL:rollR;}
    else{part.pivot.position.x+=THREE.MathUtils.clamp(aimX,-.032,.032);part.pivot.position.y+=THREE.MathUtils.clamp(aimY,-.022,.022);}}
  },colorize(){for(const p of parts)p.surface.material=p.role==='pupil'?eyeInk:p.role==='iris'?irisInk:browInk;},dispose(){eyeInk.dispose();irisInk.dispose();browInk.dispose();}};
}

export function buildSensor(head) {
  const root=new THREE.Group();root.name='OriginalStudyMiniDish';root.position.set(-.32,.55,-.04);head.add(root);root.visible=false;
  const shell=new THREE.MeshStandardMaterial({color:0xd7dfdc,roughness:.38,metalness:.2}),copper=new THREE.MeshStandardMaterial({color:0xa67a59,roughness:.32,metalness:.78}),dark=new THREE.MeshStandardMaterial({color:0x294754,roughness:.44,metalness:.5}),cyan=new THREE.MeshBasicMaterial({color:0x65d6df});
  shell.side=THREE.DoubleSide;
  const add=(parent,geometry,material,position)=>{const m=new THREE.Mesh(geometry,material);m.position.set(...position);parent.add(m);return m;};
  add(root,new THREE.CylinderGeometry(.105,.13,.10,16),copper,[0,0,0]);
  const mast=add(root,new THREE.CylinderGeometry(.018,.023,.34,12),shell,[0,.1,0]);
  const top=new THREE.Group();root.add(top);const yaw=new THREE.Group();top.add(yaw);const pitch=new THREE.Group();pitch.scale.setScalar(.75);yaw.add(pitch);
  add(pitch,new THREE.SphereGeometry(.08,12,8),copper,[0,0,0]);
  const petals=[];
  for(let i=0;i<6;i++){
    const radial=new THREE.Group();radial.rotation.z=i*Math.PI/3;pitch.add(radial);const hinge=new THREE.Group();radial.add(hinge);
    const geometry=new THREE.LatheGeometry([new THREE.Vector2(.035,0),new THREE.Vector2(.13,.018),new THREE.Vector2(.23,.075),new THREE.Vector2(.29,.14)],8,0,Math.PI/3*(.94*1.10));geometry.rotateX(Math.PI/2);add(hinge,geometry,shell,[0,0,0]);petals.push(hinge);
  }
  const rod=add(pitch,new THREE.CylinderGeometry(.018,.018,.26,8),dark,[0,0,.13]);rod.rotation.x=Math.PI/2;
  const feed=add(pitch,new THREE.SphereGeometry(.035,12,8),cyan,[0,0,.27]);
  let triangles=0;root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.castShadow=true;o.receiveShadow=true;}});
  return {root,audit:{originalAttachment:true,petals:6,triangles,dishScale:.75,petalCoverageMultiplier:1.10,petalSectorRadians:Math.PI/3*(.94*1.10)},pose({extension=0,open=0,scanYaw=0,scanPitch=0,locked=false}){root.visible=true;mast.scale.y=.18+.82*extension;mast.position.y=.05+.17*mast.scale.y;top.position.y=.10+.34*extension;yaw.rotation.y=scanYaw;pitch.rotation.x=scanPitch;for(const h of petals)h.rotation.x=1.15*(1-open);feed.material=cyan;feed.scale.setScalar(locked?1.15:1);},setVisible(v){root.visible=v;}};
}
