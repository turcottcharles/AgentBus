import * as THREE from 'three';

const bounded = (value, fallback, min, max) => Number.isFinite(value) ? THREE.MathUtils.clamp(value, min, max) : fallback;

// Original, additive hardware. The caller owns time, rendering and the host.
// Pictures, exhaust falloff and dust are shaded by the caller's hardware GPU.
export function createHostThrusters({ hostGroup, scene }) {
  if (!hostGroup?.add || !scene?.add) throw new TypeError('Thrusters require a host group and scene');
  const root = new THREE.Group(); root.name = 'OriginalIndustrialThrusterPack'; hostGroup.add(root);
  const steel = new THREE.MeshStandardMaterial({ color: 0x26313c, metalness: .88, roughness: .34 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x625c61, metalness: .83, roughness: .44 });
  const copper = new THREE.MeshStandardMaterial({ color: 0x98603d, metalness: .8, roughness: .33 });
  const guards = new THREE.MeshStandardMaterial({ color: 0x101a26, metalness: .68, roughness: .48 });
  const hot = new THREE.MeshStandardMaterial({ color: 0x702a15, emissive: 0xff6b21, emissiveIntensity: .1, metalness: .5, roughness: .35, side: THREE.DoubleSide });
  const jetMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;void main(){vUv=uv;vN=mat3(modelMatrix)*normal;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',
    fragmentShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;uniform float uTime;uniform float uPower;
      void main(){float y=vUv.y;float bands=.62+.38*sin(y*48.-uTime*38.);float taper=smoothstep(0.,.25,y);
      float flicker=.86+.14*sin(uTime*91.+vUv.x*19.);float softEdge=pow(abs(dot(normalize(vN),normalize(cameraPosition-vWorld))),1.5);
      vec3 col=mix(vec3(1.,.19,.015),vec3(.10,.40,1.),smoothstep(.10,.8,y));col=mix(col,vec3(.75,.92,1.),pow(y,4.)*.7);
      gl_FragColor=vec4(col*1.2,taper*bands*flicker*softEdge*uPower*.24);}` });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x8adfff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const geometries = new Set(), materials = new Set([steel, rim, copper, guards, hot, jetMaterial, coreMaterial]);
  const jets = [], cores = [];
  const add = (parent, geometry, material, position) => { geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3 + .2, x = Math.cos(angle) * .40, z = Math.sin(angle) * .40;
    const pod = new THREE.Group(); pod.name = `IndustrialExhaustBell${i + 1}`; pod.position.set(x, 0, z); root.add(pod);
    const profile = [[.12, .55], [.13, .4], [.14, .25], [.23, .10], [.235, .06], [.205, .055], [.13, .24], [.105, .4], [.10, .55]].map(p => new THREE.Vector2(...p));
    add(pod, new THREE.LatheGeometry(profile, 32), steel, [0, 0, 0]);
    for (const y of [.35, .42, .49]) add(pod, new THREE.TorusGeometry(.146, .023, 8, 32), copper, [0, y, 0]).rotation.x = Math.PI / 2;
    add(pod, new THREE.TorusGeometry(.22, .021, 8, 32), rim, [0, .075, 0]).rotation.x = Math.PI / 2;
    add(pod, new THREE.CylinderGeometry(.108, .17, .1, 24, 1, true), hot, [0, .18, 0]);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; add(pod, new THREE.BoxGeometry(.055, .31, .13), guards, [Math.cos(a) * .18, .29, Math.sin(a) * .18]).rotation.y = -a; }
    const line = new THREE.CatmullRomCurve3([new THREE.Vector3(x * .8, .79, z * .8), new THREE.Vector3(x * 1.25, .63, z * 1.25), new THREE.Vector3(x, .48, z)]);
    add(root, new THREE.TubeGeometry(line, 12, .022, 6, false), copper, [0, 0, 0]);
    const geometry = new THREE.CylinderGeometry(.105, .17, 1, 24, 6, true); geometry.translate(0, -.5, 0);
    const jet = add(pod, geometry, jetMaterial, [0, .06, 0]); jet.castShadow = jet.receiveShadow = false; jets.push(jet);
    const coreGeometry = new THREE.CylinderGeometry(.035, .055, 1, 16, 4, true); coreGeometry.translate(0, -.5, 0);
    const core = add(pod, coreGeometry, coreMaterial, [0, .06, 0]); core.castShadow = core.receiveShadow = false; cores.push(core);
  }
  const wash = new THREE.PointLight(0xff6b25, 0, 6, 2); wash.name = 'ThrusterAmberWash'; scene.add(wash);
  const dustGeometry = new THREE.BufferGeometry(), positions = [];
  for (let i = 0; i < 40; i++) positions.push(i / 40 * Math.PI * 2, (i * 17 % 41) / 41, (i * 13 % 37) / 37);
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometries.add(dustGeometry);
  const dustMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uForward: { value: new THREE.Vector3(0, 0, 1) }, uUp: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: `uniform float uTime;uniform float uPower;uniform vec3 uOrigin;uniform vec3 uRight;uniform vec3 uForward;uniform vec3 uUp;varying float vFade;
      void main(){float life=fract(uTime*.8+position.y);float r=.2+life*2.8;vec3 p=uOrigin+uRight*cos(position.x)*r+uForward*sin(position.x)*r+uUp*(sin(life*3.14159)*.14);
      vFade=(1.-life)*uPower*.35;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);gl_PointSize=7.+position.z*10.;}`,
    fragmentShader: 'varying float vFade;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.66,.57,.43,smoothstep(.5,.1,d)*vFade);}' });
  materials.add(dustMaterial);
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.name = 'ThrusterGroundDust'; dust.frustumCulled = false; scene.add(dust);
  let triangles = 0; root.traverse(object => { if (object.isMesh) triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; });
  const audit = Object.freeze({ originalAttachment: true, nozzles: 3, triangles, dustPoints: 40, sourceHostModified: false, timers: 0, ownsRenderer: false });
  const origin = new THREE.Vector3(), sceneLocal = new THREE.Vector3(), floor = new THREE.Vector3();
  let disposed = false, last = null;
  function pose(seconds = 0, requestedPower = .10, { reducedMotion = false, groundY = .10 } = {}) {
    if (disposed) return { disposed: true, audit };
    const time = reducedMotion ? 0 : bounded(seconds, 0, 0, 86400), power = bounded(requestedPower, .10, 0, 1);
    jetMaterial.uniforms.uTime.value = time; jetMaterial.uniforms.uPower.value = power; hot.emissiveIntensity = .15 + power * 2.3; coreMaterial.opacity = power * .6;
    jets.forEach((jet, i) => { jet.scale.y = .08 + power * .50 * (1 + (reducedMotion ? 0 : .04 * Math.sin(time * 61 + i))); jet.scale.x = jet.scale.z = .7 + power * .3; cores[i].scale.y = jet.scale.y * .85; });
    hostGroup.updateWorldMatrix(true, false); scene.updateWorldMatrix(true, false); hostGroup.getWorldPosition(origin);
    // Lights live in the owning scene; convert from the actual host world pose.
    sceneLocal.copy(origin); scene.worldToLocal(sceneLocal); wash.position.copy(sceneLocal); wash.position.y -= .1; wash.intensity = power * 9; wash.visible = power > 0;
    floor.copy(sceneLocal); floor.y = bounded(groundY, .10, -10000, 10000); scene.localToWorld(floor);
    dustMaterial.uniforms.uTime.value = time; dustMaterial.uniforms.uPower.value = reducedMotion ? 0 : Math.max(0, power - .12); dustMaterial.uniforms.uOrigin.value.copy(floor);
    dustMaterial.uniforms.uRight.value.setFromMatrixColumn(scene.matrixWorld, 0); dustMaterial.uniforms.uUp.value.setFromMatrixColumn(scene.matrixWorld, 1); dustMaterial.uniforms.uForward.value.setFromMatrixColumn(scene.matrixWorld, 2);
    dust.visible = !reducedMotion && power > .12;
    last = { seconds: time, power, reducedMotion: !!reducedMotion, idle: power <= .12, worldOrigin: origin.toArray(), washScenePosition: wash.position.toArray(), dustWorldOrigin: floor.toArray(), flameLengths: jets.map(jet => jet.scale.y), dustVisible: dust.visible, audit };
    return last;
  }
  function destroy() { if (disposed) return; disposed = true; root.removeFromParent(); wash.removeFromParent(); dust.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); }
  pose(0, .10);
  return { root, wash, dust, audit, pose, diagnostics: () => last, destroy };
}

export function buildThrusters(hostGroup, scene) { return createHostThrusters({ hostGroup, scene }); }
