import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import performanceState from '../district/test-performance.js';
import routing from '../district/showcase-routing.js';
import { testActor, poseTestScene } from './test-scene.js';
import { createShowcaseOpening } from './showcase-opening.js';
import { createRobotCrew } from './robot-crew.js';

// This module only presents a world. Neither its cinematic beats nor its lighting
// can issue a command, establish progress, approve a result, or open a preview.
const LIMITS = Object.freeze({ maxDPR: 1.5, pixelBudget: 5500000, maxFPS: 60, managementFPS: 30, managementDPR: 1, managementPixelBudget: 3000000, workers: 32,
  assetBytes: 24 * 1024 * 1024, worldTriangles: 1200000, hostTriangles: 150000,
  worldMeshes: 1000, hostMeshes: 250, sceneTextures: 16, textures: 32, drawCalls: 1200, frameTriangles: 4000000 });
const LIVE = new Set();
const KNOWN = new Set(['idle', 'unknown', 'queued', 'starting', 'working', 'running', 'building', 'testing', 'passed', 'failed', 'stopping', 'cancelled', 'termination_unknown', 'interrupted', 'timed_out']);
const ACTIVE = new Set(['working', 'running', 'building', 'testing']);
const CAUTION = new Set(['failed', 'stopping', 'termination_unknown', 'interrupted', 'timed_out']);
const SHOTS = {
  hook: { position: [12, 7, 26], target: [-5, 3.6, 8], fov: 43 },
  crew: { position: [17, 10, 26], target: [-1, 3.8, 5], fov: 43 },
  make: { position: [32, 21, 29], target: [0, 3.8, -5], fov: 44 },
  turn: { position: [19, 10, 28], target: [-2, 3.6, 7], fov: 43 }
};
const MANAGEMENT = Object.freeze({ position: [60, 62, 58], target: [0, 2, -2], verticalSpan: 52, near: .2, far: 260 });
// Authored physical coordinates, mirrored from district-world.provenance.json.
const FACILITIES = {
  research: { anchor: [-11, 0, -17], entrance: [-11, 0, -9.9], pin: [-11, 10.7, -17], min: [-16.5, 0, -22], max: [-5.5, 10.5773, -10.005] },
  build: { anchor: [9, 0, -15], entrance: [9, 0, -7.9], pin: [9, 14.7, -15], min: [3.5, 0, -19.9], max: [14.5, 14.5063, -7.985] },
  test: { anchor: [-18, 0, -1], entrance: [-18, 0, 5.75], pin: [-15.6, 9.55, -.5], min: [-23.9, 0, -5.6], max: [-12.1, 9.25, 5.695] },
  review: { anchor: [-10, 0, 12], entrance: [-10, 0, 17.3], pin: [-10, 5.75, 11.2], min: [-13.9, 0, 8.6], max: [-6.1, 5.3903, 17.3] },
  preview: { anchor: [18, 0, 3], entrance: [18, 0, 10.4], pin: [18, 9.3, 2.45], min: [12.1, 0, -1.9], max: [23.9, 8.965, 10.265] }
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;

export function hardwareIdentity(context) {
  const debug = context.getExtension('WEBGL_debug_renderer_info');
  const vendor = debug ? String(context.getParameter(debug.UNMASKED_VENDOR_WEBGL) || '') : '';
  const renderer = debug ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '') : '';
  const identity = { vendor, renderer, webglVersion: String(context.getParameter(context.VERSION) || '') };
  const error = !debug || !renderer || /swiftshader|llvmpipe|softpipe|software|\bwarp\b|basic render|lavapipe|microsoft.*render/i.test(renderer) || !/nvidia|geforce|quadro|radeon|\bamd\b|\bintel\b|apple|adreno|mali|powervr/i.test(`${vendor} ${renderer}`);
  return { identity, supported: !error };
}

export function validateEmbeddedGLB(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > LIMITS.assetBytes) throw new Error('Local 3D asset size is invalid');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Local 3D asset is not a complete GLB 2 file');
  let json = null;
  for (let offset = 12; offset < buffer.byteLength;) {
    if (offset + 8 > buffer.byteLength) throw new Error('Truncated GLB chunk');
    const size = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    if (size % 4 || offset + 8 + size > buffer.byteLength) throw new Error('Invalid GLB chunk bounds');
    if (type === 0x4e4f534a) {
      if (json) throw new Error('Duplicate GLB JSON');
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset + 8, size)).replace(/[\u0000\s]+$/, ''));
    }
    offset += 8 + size;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('Missing GLB scene description');
  if ([...(json.buffers || []), ...(json.images || [])].some(item => Object.prototype.hasOwnProperty.call(item, 'uri'))) throw new Error('External GLB resources are not permitted');
  if ((json.extensionsRequired || []).some(name => /draco|basisu|meshopt/i.test(name))) throw new Error('External geometry decoders are not permitted');
  return json;
}

function disposeGraph(root) {
  if (!root) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    object.dispose?.();
  });
  textures.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); geometries.forEach(item => item.dispose());
}

function material(color, emission = 0x000000, intensity = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness: .62, roughness: .43, emissive: emission, emissiveIntensity: intensity });
}
function addMesh(group, geometry, mat, position, name) {
  const mesh = new THREE.Mesh(geometry, mat);
  if (position) mesh.position.set(...position);
  if (name) mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function box(group, dimensions, mat, position, name) { return addMesh(group, new THREE.BoxGeometry(...dimensions), mat, position, name); }
function cylinder(group, top, bottom, height, mat, position, segments = 32) { return addMesh(group, new THREE.CylinderGeometry(top, bottom, height, segments), mat, position); }
function ring(group, radius, tube, mat, position, horizontal = true) {
  const mesh = addMesh(group, new THREE.TorusGeometry(radius, tube, 8, 64), mat, position);
  if (horizontal) mesh.rotation.x = Math.PI / 2; return mesh;
}
function lineTube(group, points, radius, mat, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => V(...point)), closed, 'centripetal');
  const mesh = addMesh(group, new THREE.TubeGeometry(curve, 80, radius, 6, closed), mat); mesh.castShadow = false; return curve;
}

function proceduralDistrict() {
  const root = new THREE.Group(); root.name = 'ProceduralDistrict';
  const slate = material(0x142536), edge = material(0x30445b), copper = material(0x936241);
  const cyan = material(0x278d9d, 0x43e7f2, 2.0), violet = material(0x71518f, 0xbb7bff, 1.3), amber = material(0xad8143, 0xffbd62, 1.6);
  box(root, [64, 1.3, 54], slate, [0, -1.1, -1]);
  box(root, [53, .4, 45], edge, [0, -.35, -2]);
  cylinder(root, 5.1, 5.7, .6, slate, [0, .2, 0], 64);
  ring(root, 4.7, .09, cyan, [0, .57, 0]);
  const facilities = [[-11, -17, 6.5, violet], [9, -15, 8, amber], [-18, -1, 5.3, cyan], [18, 3, 5.4, violet]];
  facilities.forEach(([x, z, h, accent], index) => {
    const group = new THREE.Group(); group.position.set(x, 0, z); root.add(group);
    box(group, [8, .7, 7], edge, [0, 0, 0]);
    box(group, [6.2, h, 5.1], slate, [0, h / 2, 0]);
    box(group, [6.7, .45, 5.6], copper, [0, h * .65, 0]);
    box(group, [5.6, 1.1, 4.7], edge, [0, h + .4, 0]);
    for (let side = -1; side <= 1; side += 2) {
      box(group, [.22, h + .7, .25], accent, [side * 2.8, h / 2, 2.7]);
      for (let level = 0; level < 3; level++) box(group, [4.8, .17, .15], accent, [0, 1.4 + level * 1.5, 2.64]);
    }
    if (index === 0) { addMesh(group, new THREE.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), edge, [0, h + 1, 0]); ring(group, 2.6, .1, violet, [0, h + 1, 0]); }
    if (index === 1) for (let i = 0; i < 3; i++) { cylinder(group, .4, .5, 3.5 + i, copper, [-2 + i * 1.8, h + 1, -1.4]); ring(group, .46, .07, amber, [-2 + i * 1.8, h + 2, -1.4]); }
    if (index === 2) { const coil = ring(group, 2.1, .27, cyan, [0, h + 2, 0], false); coil.rotation.y = .3; }
    if (index === 3) { box(group, [.8, 6.8, 1.2], edge, [-2.5, 3.7, 3.8]); box(group, [.8, 6.8, 1.2], edge, [2.5, 3.7, 3.8]); box(group, [5.5, .8, 1.2], violet, [0, 7, 3.8]); }
  });
  // Instanced windows and a layered rear skyline provide genuine parallax.
  const windows = [];
  for (let i = 0; i < 18; i++) {
    const x = -27 + i * 3.15, z = -25 - (i % 3) * 1.3, h = 8 + ((i * 7) % 14);
    box(root, [2.5, h, 2.9], i % 3 ? slate : edge, [x, h / 2, z]);
    box(root, [2.8, .22, 3.2], copper, [x, h * .7, z]);
    cylinder(root, .07, .09, 2, cyan, [x, h + 1, z], 8);
    for (let row = 1; row < h - 1; row += 1.7) for (let column = -1; column <= 1; column++) windows.push([x + column * .7, row, z + 1.49]);
  }
  const instance = new THREE.InstancedMesh(new THREE.BoxGeometry(.26, .6, .06), cyan, windows.length), matrix = new THREE.Matrix4();
  windows.forEach((point, i) => { matrix.makeTranslation(...point); instance.setMatrixAt(i, matrix); }); root.add(instance);
  for (let i = -1; i <= 1; i += 2) {
    box(root, [15, .45, 2], edge, [i * 11, 4, -9]);
    box(root, [15, .09, .1], cyan, [i * 11, 4.35, -7.98]);
    for (let j = 0; j < 4; j++) box(root, [.4, 4, .6], copper, [i * (5 + j * 4), 2, -9]);
  }
  return root;
}

function infrastructure() {
  const root = new THREE.Group(); root.name = 'AmbientInfrastructure';
  const dark = material(0x183044), trim = material(0x3d696c), glow = material(0x176874, 0x38d5e6, 1.8), warm = material(0x906a3e, 0xffb854, 1.8);
  const path = lineTube(root, [[0, .8, 7], [-12, .8, 9], [-22, .8, 0], [-14, .8, -12], [8, .8, -18], [23, .8, -4], [22, .8, 12], [9, .8, 18]], .07, glow, true);
  lineTube(root, [[-26, .3, 16], [-9, .3, 20], [13, .3, 20], [27, .3, 9]], .13, dark);
  for (let i = 0; i < 16; i++) {
    const theta = i / 16 * Math.PI * 2, x = Math.cos(theta) * 25, z = Math.sin(theta) * 20;
    cylinder(root, .09, .18, 2.7, trim, [x, 1.35, z], 8);
    box(root, [.6, .14, .6], warm, [x, 2.75, z]);
  }
  ring(root, 5.65, .06, glow, [0, .75, 0]);
  const motes = new THREE.InstancedMesh(new THREE.SphereGeometry(.10, 6, 4), glow, 28); root.add(motes);
  const matrix = new THREE.Matrix4();
  return { root, update(time) { for (let i = 0; i < 28; i++) { const p = path.getPointAt((i / 28 + time * .014) % 1); matrix.makeTranslation(p.x, p.y, p.z); motes.setMatrixAt(i, matrix); } motes.instanceMatrix.needsUpdate = true; } };
}

function atmosphere() {
  const root = new THREE.Group(); root.name = 'DistantCityAtmosphere';
  // This sky is shaded on the GPU inside a real enclosing sphere. No picture,
  // texture download, CPU raster, or image plane stands in for the environment.
  const sky = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } }, vertexShader: `varying vec3 vDirection;
      void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vDirection; uniform float uTime;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      void main(){vec3 d=normalize(vDirection);float h=clamp(d.y*.8+.23,0.,1.);
      vec3 c=mix(vec3(.035,.10,.145),vec3(.005,.013,.044),smoothstep(.0,.72,h));
      float horizon=exp(-abs(d.y-.035)*11.);c+=vec3(.035,.075,.09)*horizon;
      float aurora=sin(d.x*5.+d.z*3.+uTime*.018)*.5+.5;
      c+=vec3(.029,.012,.062)*pow(aurora,5.)*exp(-abs(d.y-.24)*6.);
      float stars=step(.9985,hash(floor(d*950.)))*smoothstep(.08,.45,d.y);
      c+=vec3(.48,.66,.8)*stars*.36;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` });
  addMesh(root, new THREE.SphereGeometry(130, 32, 20), sky, [0, 0, 0]).castShadow = false;
  const foundation = material(0x101e30), tower = material(0x14273d), cap = material(0x263b52), neon = material(0x297781, 0x55c7db, 1.25), gold = material(0x705a43, 0xe9af70, .85);
  const ground = cylinder(root, 104, 108, 2.5, foundation, [0, -4.0, 0], 96); ground.castShadow = false;
  const towers = [], lights = [];
  for (let i = 0; i < 58; i++) {
    const angle = -.26 + i / 57 * Math.PI * 1.58;
    const radius = 55 + (i % 4) * 8, x = Math.cos(angle) * radius, z = -Math.sin(angle) * radius - 7;
    // Keep the foreground approach open while extending both skyline wings.
    if (z > 24 && Math.abs(x) < 45) continue;
    const height = 10 + ((i * 17) % 33), width = 3 + i % 4;
    towers.push([x, height, z, width]);
    for (let row = 2; row < height; row += 3) for (let col = -1; col <= 1; col++) lights.push([x + col * width * .24, row - 2, z + 2.3]);
    box(root, [width + .6, .3, 4.6], cap, [x, height - 2, z]);
    if (i % 4 === 0) cylinder(root, .06, .1, 4, gold, [x, height, z], 6);
  }
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tower, towers.length), matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), point = new THREE.Vector3(), quat = new THREE.Quaternion();
  towers.forEach(([x, h, z, w], i) => { point.set(x, h / 2 - 2, z); scale.set(w, h, 4.5); matrix.compose(point, quat, scale); blocks.setMatrixAt(i, matrix); }); root.add(blocks);
  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .65, .06), neon, lights.length);
  lights.forEach((p, i) => { matrix.makeTranslation(...p); windows.setMatrixAt(i, matrix); }); root.add(windows);
  for (const [x, z] of [[-24, -29], [16, -30], [31, -15]]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(5.8, 36, 24, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;void main(){float a=pow(sin(vUv.x*3.14159265),2.)*pow(1.-vUv.y,2.)*.035;gl_FragColor=vec4(.12,.48,.66,a);}` }));
    beam.position.set(x, 18, z); beam.rotation.z = .11; root.add(beam);
  }
  return { root, update(time) { sky.uniforms.uTime.value = time; } };
}

function demonstration() {
  // An explicitly illustrative stage prop follows trailer beats only. It is
  // hidden as soon as the owner engages and never represents actual run work.
  const root = new THREE.Group(); root.name = 'IllustrativeIdeaSculpture';
  const glow = material(0x66a3ad, 0x76edee, 2.1), gold = material(0xb47e42, 0xffbe71, 1.6), dark = material(0x1a3b53);
  const core = new THREE.Group(); root.add(core);
  addMesh(core, new THREE.IcosahedronGeometry(.46, 1), gold);
  ring(core, .76, .035, glow, [0, 0, 0], false).rotation.y = .7;
  ring(core, .66, .025, gold, [0, 0, 0]).rotation.z = .5;
  const panels = [];
  for (let i = 0; i < 12; i++) {
    const group = new THREE.Group(); root.add(group);
    box(group, [.88, .60, .14], dark, [0, 0, 0]);
    box(group, [.79, .045, .04], i % 4 ? glow : gold, [0, .22, .09]);
    box(group, [.52, .035, .04], glow, [-.11, -.06, .09]);
    panels.push(group);
  }
  const halo = ring(root, 3, .055, glow, [0, 1, 0]);
  return { root, update(time, age, beat, engaged) {
    root.visible = !engaged; if (engaged) return;
    const launch = beat === 'crew' ? clamp(age / 2.7, 0, 1) : beat === 'hook' ? 0 : 1;
    const ease = launch * launch * (3 - 2 * launch);
    core.position.set(THREE.MathUtils.lerp(6.9, 0, ease), THREE.MathUtils.lerp(4, 3.5, ease) + Math.sin(launch * Math.PI) * 4 + Math.sin(time * 1.2) * .12, THREE.MathUtils.lerp(12.1, 0, ease));
    core.rotation.set(time * .22, time * .7, .3);
    const assembled = beat === 'make' || beat === 'turn', amount = beat === 'turn' ? 1 : clamp(age / 2.1, 0, 1), smooth = amount * amount * (3 - 2 * amount);
    panels.forEach((panel, i) => {
      panel.visible = assembled;
      const theta = i / 12 * Math.PI * 2, targetX = (i % 4 - 1.5) * 1.03, targetY = 2.5 + Math.floor(i / 4) * .76;
      panel.position.set(THREE.MathUtils.lerp(Math.cos(theta) * 6, targetX, smooth), THREE.MathUtils.lerp(1.2 + i % 3, targetY, smooth), THREE.MathUtils.lerp(Math.sin(theta) * 6, 1.8, smooth));
      panel.rotation.set((1 - smooth) * Math.sin(theta), (1 - smooth) * theta, (1 - smooth) * .3);
    });
    halo.visible = assembled; halo.scale.setScalar(1 + Math.sin(time * 1.6) * .025); halo.rotation.z = time * .04;
  } };
}

export function workerLayout(values) {
  const records = new Map();
  for (const value of Array.isArray(values) ? values.slice(0, LIMITS.workers) : []) {
    if (!value || typeof value.id !== 'string' || !value.id.trim()) continue;
    const id = String(value.activityKey || value.renderId || value.id).slice(0, 96), state = String(value.state || 'idle').slice(0, 40);
    records.set(id, { id, workerId: String(value.workerId || value.id).slice(0, 96), motionAllowed: value.motionAllowed !== false, quietReason: String(value.quietReason || '').slice(0,120), facility: Object.hasOwn(FACILITIES, value.facility) ? value.facility : null, phase: String(value.phase || '').slice(0, 40),
      basis: ['observed', 'reported', 'inferred'].includes(value.basis) ? value.basis : null, state, stale: value.stale === true,
      terminal: value.terminal === true || ['passed', 'failed', 'cancelled', 'interrupted', 'timed_out', 'termination_unknown'].includes(state) });
  }
  const list = [...records.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), groups = new Map();
  for (const record of list) { const key = record.facility || 'hub'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); }
  for (const [key, group] of groups) group.forEach((record, index) => {
    if (key === 'hub') { const angle = index / Math.max(group.length, 4) * Math.PI * 2; record.position = [Math.cos(angle) * 3.3, .68, Math.sin(angle) * 3.3]; }
    else { const entrance = FACILITIES[key].entrance, columns = Math.min(group.length, 4); record.position = [entrance[0] + (index % 4 - (columns - 1) / 2) * .95, .12, entrance[2] + 1.0 + Math.floor(index / 4) * .9]; }
  });
  return list;
}

function worldWorkers() {
  const root = new THREE.Group(); root.name = 'ProjectedRealCrew';
  const shell = material(0x91b8c5), dark = material(0x10283a), trim = material(0x8e6a47), lens = material(0x6cd7e2, 0x4ad4e6, .65);
  const parts = [
    [new THREE.SphereGeometry(.37, 12, 8), shell, [0, .78, 0], [1, 1.18, .8]],
    [new THREE.SphereGeometry(.43, 12, 8), shell, [0, 1.43, 0], [1.12, .65, .78]],
    [new THREE.BoxGeometry(.67, .25, .13), dark, [0, 1.44, .30], [1, 1, 1]],
    [new THREE.SphereGeometry(.075, 8, 6), lens, [-.17, 1.46, .40], [1, 1, 1]],
    [new THREE.SphereGeometry(.075, 8, 6), lens, [.17, 1.46, .40], [1, 1, 1]],
    [new THREE.BoxGeometry(.16, .58, .19), trim, [-.48, .88, 0], [1, 1, 1]],
    [new THREE.BoxGeometry(.16, .58, .19), trim, [.48, .88, 0], [1, 1, 1]],
    [new THREE.TorusGeometry(.30, .035, 6, 20), lens, [0, .27, 0], [1, 1, 1]]
  ].map(([geometry, mat, offset, scale], i) => {
    const mesh = new THREE.InstancedMesh(geometry, mat, LIMITS.workers); mesh.count = 0; mesh.castShadow = i < 3; mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh);
    return { mesh, offset: V(...offset).applyAxisAngle(V(0, 1, 0), Math.PI / 4), scale: V(...scale), ring: i === 7, arm: i === 5 || i === 6 };
  });
  let records = [], dynamic = false;
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), p = new THREE.Vector3(), palette = [0x7ddce6, 0xffc179, 0xbea1e8, 0x9dd5b9];
  function update(time, force = false) {
    if (!dynamic && !force) return;
    records.forEach((record, index) => {
      const active = record.motionAllowed && !record.stale && !record.terminal && ACTIVE.has(record.state), hash = [...record.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
      const hover = active ? Math.sin(time * 2 + hash % 13) * .065 : 0;
      for (const part of parts) {
        p.set(...record.position).add(part.offset); p.y += hover;
        euler.set(part.ring ? Math.PI / 2 : 0, Math.PI / 4, part.arm && active ? Math.sin(time * 1.1 + index) * .10 : 0); rotation.setFromEuler(euler);
        matrix.compose(p, rotation, part.scale); part.mesh.setMatrixAt(index, matrix);
        if (force) part.mesh.setColorAt(index, new THREE.Color(record.stale || record.terminal ? 0x88949d : CAUTION.has(record.state) ? 0xffc179 : palette[hash % palette.length]));
      }
    });
    for (const part of parts) { part.mesh.instanceMatrix.needsUpdate = true; if (force && part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true; part.mesh.computeBoundingSphere(); }
  }
  return { root, update, set(values) { records = values; dynamic = records.some(record => record.motionAllowed && !record.stale && !record.terminal && ACTIVE.has(record.state)); for (const part of parts) part.mesh.count = records.length; update(0, true); } };
}

function proceduralHost() {
  const root = new THREE.Group(); root.name = 'ProceduralHost';
  const body = material(0x426071), dark = material(0x101e2d), gold = material(0xa37343), cyan = material(0x88dfe9, 0x4edfed, 1.8);
  const head = new THREE.Group(); head.name = 'Head'; head.position.y = 2.25; root.add(head);
  addMesh(head, new THREE.SphereGeometry(.78, 24, 16), body, [0, 0, 0]).scale.set(1.25, .74, .67);
  box(head, [1.35, .52, .18], dark, [0, 0, .49]);
  for (let side = -1; side <= 1; side += 2) addMesh(head, new THREE.SphereGeometry(.16, 16, 12), cyan, [side * .34, .03, .61]);
  lineTube(head, [[-.22, -.17, .62], [0, -.23, .65], [.22, -.17, .62]], .025, cyan);
  addMesh(root, new THREE.DodecahedronGeometry(.75, 1), body, [0, 1.25, 0]).scale.set(1, 1.06, .65);
  const core = addMesh(root, new THREE.SphereGeometry(.25, 16, 12), cyan, [0, 1.3, .47], 'Core');
  for (let side = -1; side <= 1; side += 2) {
    const arm = new THREE.Group(); arm.name = side < 0 ? 'ArmL' : 'ArmR'; arm.position.set(side * .82, 1.65, 0); root.add(arm);
    box(arm, [.24, .85, .29], gold, [side * .12, -.37, 0]);
    addMesh(arm, new THREE.SphereGeometry(.20, 12, 8), body, [side * .15, -.83, .1]);
  }
  cylinder(root, .54, .34, .24, gold, [0, .5, 0]); ring(root, .65, .055, cyan, [0, .24, 0]);
  return { root, head, core, armL: root.getObjectByName('ArmL'), armR: root.getObjectByName('ArmR') };
}

function inspectAsset(scene, kind) {
  let triangles = 0, meshes = 0; const textures = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return; meshes++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3 * (object.isInstancedMesh ? object.count : 1);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(mat || {})) if (value?.isTexture) textures.add(value);
    }
    object.castShadow = true; object.receiveShadow = true;
  });
  if (triangles > LIMITS[kind === 'world' ? 'worldTriangles' : 'hostTriangles'] || meshes > LIMITS[kind === 'world' ? 'worldMeshes' : 'hostMeshes'] || textures.size > LIMITS.sceneTextures) throw new Error('Local 3D asset exceeds the scene budget');
  return { triangles, meshes, textures: textures.size };
}

async function localAsset(name) {
  if (!['district-world.glb', 'district-host.glb'].includes(name)) throw new Error('Unknown district asset');
  // Only the fixed local, owner-main-frame byte bridge is allowed. No fetch,
  // arbitrary paths, external decoder, provider, command or network fallback.
  if (typeof window.bus?.districtReadAsset !== 'function') throw new Error('Local asset bridge unavailable; procedural 3D retained');
  const result = await window.bus.districtReadAsset(name);
  if (typeof result?.base64 !== 'string' || result.base64.length > Math.ceil(LIMITS.assetBytes / 3) * 4 + 4) throw new Error('Invalid local asset response');
  const raw = atob(result.base64), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  validateEmbeddedGLB(bytes.buffer); return bytes.buffer;
}

export function mount({ container, view = 'cinematic', showcase = false } = {}) {
  if (!container?.appendChild) throw new TypeError('District world requires a container');
  const wrapper = document.createElement('div'); wrapper.className = 'daw-world'; wrapper.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); wrapper.appendChild(canvas); container.prepend(wrapper);
  const diagnostics = { ready: false, phase: 'initializing', renderer: 'webgl2', frames: 0, renderedFrames: 0, fps: 0, cpuFrameMs: 0, cpuFrameEMA: 0,
    width: 0, height: 0, dpr: 0, maxDPR: LIMITS.maxDPR, maxFPS: LIMITS.maxFPS, pixelBudget: LIMITS.pixelBudget,
    drawCalls: 0, triangles: 0, memory: { geometries: 0, textures: 0 }, gpu: { vendor: '', renderer: '', webglVersion: '' },
    paused: false, contextLost: false, disposed: false, worldAsset: 'procedural', hostAsset: 'procedural', assetErrors: {}, assetStats: {},
    beat: 'hook', view: view === 'management' ? 'management' : 'cinematic', engaged: false, activity: { state: 'idle', label: '' }, workerCount: 0, gpuWorkersReady: false, bloom: false, limits: LIMITS, error: null };
  let renderer, composer, renderPass, bloom, environmentTarget, scene, camera, cinematicCamera, managementCamera, resizeObserver, intersectionObserver, raf = 0, disposed = false, lost = false;
  let paused = false, visible = !document.hidden && document.visibilityState !== 'hidden', nativeVisible = true, removeNativeVisibility, intersecting = true, reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let renderRequested = false, time = 0, beatAge = 0, lastStamp = 0, nextFrame = 0, fpsStamp = 0, fpsFrames = 0, transition = 1, host, architecture, ambient, horizon, demo, crew, workerRecords = [], workerSignature = '';
  let shotFrom, shotTargetFrom, shotFovFrom, activitySeen = false, cueAge = 100, actualState = 'idle';
  const hostGroup = new THREE.Group(), hostShadow = new THREE.Group();
  const cameraTarget = V(...SHOTS.hook.target), cameraBase = V(...SHOTS.hook.position), targetPosition = V(...SHOTS.hook.position), targetLook = V(...SHOTS.hook.target);
  const joints = new Map();
  const testPerformance = performanceState.createTestPerformance();
  let testSceneEnabled = false, testRig = null;
  let showcaseEnabled = showcase === true, opening = null, openingAge = 0, openingPose = null, warmAge = 0;
  let showcaseOutput = false, outputOffset = 0;
  let overviewAge = 0, overviewFrom = null, overviewReady = false;
  let authoredCrew = false;
  function updateCrew() {
    if(!crew)return;
    if(authoredCrew){
      crew.set(workerRecords);
      diagnostics.ambientTraffic={count:0,representsAgentWork:false};
      diagnostics.robotFamily={source:'district-host.glb',scale:.65,sharedAntennaAndRockets:true};
    }
    crew.update(time,!!reduced?.matches);
  }
  let showcaseProject = '', showcaseRun = null, showcaseUnavailable = false, showcaseKey = '', handoff = null, handoffAge = 0, showcaseLive = false;
  const lamps = {};
  const capturePose = () => ({ position: hostGroup.position.clone(), quaternion: hostGroup.quaternion.clone(), cameraPosition: camera.position.clone(), cameraQuaternion: camera.quaternion.clone(), fov: camera.fov,
    joints: new Map([...joints].map(([name,joint])=>[name,joint.node.quaternion.clone()])), sensor: openingPose?.sensorPose || null, welcome: openingPose?.lighting?.welcome ?? 1, power: openingPose?.thrustPower ?? .1 });
  const getDiagnostics = () => JSON.parse(JSON.stringify(diagnostics));
  const emit = () => canvas.dispatchEvent(new CustomEvent('district-world-state', { detail: getDiagnostics() }));
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; lastStamp = 0; nextFrame = 0; };
  const disposeComposer = () => {
    if (!composer) return;
    for (const pass of composer.passes) pass.dispose?.();
    composer.dispose(); composer = null; renderPass = null; diagnostics.bloom = false;
  };
  const canPresent = () => !!renderer && !!camera && !diagnostics.error && !disposed && !lost && !paused && visible && nativeVisible && intersecting;
  const canAnimate = () => canPresent() && !reduced?.matches && diagnostics.ready;
  const requestDraw = () => { renderRequested = true; if (canPresent() && !raf) raf = requestAnimationFrame(tick); };
  const fail = error => { stop(); diagnostics.ready = false; diagnostics.gpuWorkersReady = false; diagnostics.paused = true; diagnostics.phase = 'error'; diagnostics.error = String(error?.message || error).slice(0, 240); wrapper.classList.remove('is-ready'); wrapper.dataset.state = 'error'; emit(); };
  const setReady = () => { if(showcaseEnabled&&(diagnostics.worldAsset!=='loaded'||diagnostics.hostAsset!=='loaded'))return; diagnostics.gpuWorkersReady = !!crew; if (!diagnostics.ready) { diagnostics.ready = true; diagnostics.phase = diagnostics.paused ? 'paused' : 'ready'; wrapper.classList.add('is-ready'); wrapper.dataset.state = 'ready'; emit(); } };
  const updatePause = () => {
    diagnostics.nativeVisible = nativeVisible;
    diagnostics.paused = paused || !visible || !nativeVisible || !intersecting || !!reduced?.matches;
    if (diagnostics.ready) diagnostics.phase = diagnostics.paused ? 'paused' : 'ready';
    if (canAnimate() || canPresent() && renderRequested) { if (!raf) raf = requestAnimationFrame(tick); } else stop();
  };
  function createEnvironment() {
    // One bounded GPU-only irradiance/prefilter pass gives the authored metals
    // and pearl shell real reflected light. No CPU image generation is used.
    const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer);
    try {
      environmentTarget?.dispose(); environmentTarget = generator.fromScene(room, .04);
      scene.environment = environmentTarget.texture; scene.environmentIntensity = .42; diagnostics.ibl = true;
    } catch { scene.environment = null; diagnostics.ibl = false; }
    finally { room.dispose(); generator.dispose(); }
  }
  function createComposer() {
    if (composer || diagnostics.view !== 'cinematic') return;
    try { composer = new EffectComposer(renderer); renderPass = new RenderPass(scene, camera); composer.addPass(renderPass); bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .27, .6, 1.2); composer.addPass(bloom); composer.addPass(new OutputPass()); diagnostics.bloom = true; } catch { disposeComposer(); }
  }
  function captureJoints() {
    joints.clear();
    for (const name of ['Head', 'ArmL', 'ArmR', 'Core']) { const node = host?.root?.getObjectByName(name); if (node) joints.set(name, { node, rotation: node.rotation.clone(), scale: node.scale.clone() }); }
  }
  function updateProjection(width, height) {
    const aspect = width / height;
    cinematicCamera.aspect = aspect; cinematicCamera.updateProjectionMatrix();
    const halfHeight = MANAGEMENT.verticalSpan / 2;
    managementCamera.left = -halfHeight * aspect; managementCamera.right = halfHeight * aspect;
    managementCamera.top = halfHeight; managementCamera.bottom = -halfHeight; managementCamera.updateProjectionMatrix();
  }
  function applyView() {
    const managing = diagnostics.view === 'management';
    wrapper.dataset.view = diagnostics.view;
    diagnostics.maxFPS = managing ? LIMITS.managementFPS : LIMITS.maxFPS;
    diagnostics.maxDPR = managing ? LIMITS.managementDPR : LIMITS.maxDPR;
    diagnostics.pixelBudget = managing ? LIMITS.managementPixelBudget : LIMITS.pixelBudget;
    diagnostics.camera = managing ? { type: 'orthographic', position: [...MANAGEMENT.position], target: [...MANAGEMENT.target], verticalSpan: MANAGEMENT.verticalSpan } : { type: 'perspective' };
    if (!cinematicCamera || !managementCamera) return;
    camera = managing ? managementCamera : cinematicCamera;
    camera.updateMatrixWorld(true);
    if (managing) disposeComposer(); else createComposer();
    if (renderPass) renderPass.camera = camera;
    hostGroup.visible = true; hostShadow.visible = !managing;
    if (demo) demo.root.visible = !managing && !diagnostics.engaged;
    resize(); requestDraw(); emit();
  }
  function animate(dt) {
    const frozenPose=showcaseEnabled&&showcaseLive&&showcaseUnavailable&&opening?capturePose():null;
    time += dt; beatAge += dt; cueAge += dt; transition = Math.min(1, transition + dt / 2.6);
    const blend = transition * transition * (3 - 2 * transition);
    if (diagnostics.view === 'cinematic' && !overviewReady) {
      cameraBase.lerpVectors(shotFrom || cameraBase, targetPosition, blend);
      cameraTarget.lerpVectors(shotTargetFrom || cameraTarget, targetLook, blend);
      camera.position.copy(cameraBase); camera.position.x += Math.sin(time * .13) * .6; camera.position.y += Math.sin(time * .17) * .25;
      camera.fov = THREE.MathUtils.lerp(shotFovFrom || camera.fov, SHOTS[diagnostics.beat].fov + (diagnostics.engaged ? 2 : 0), blend); camera.updateProjectionMatrix(); camera.lookAt(cameraTarget);
    }
    const caution = CAUTION.has(actualState), active = ACTIVE.has(actualState), amplitude = caution ? .025 : .11;
    hostGroup.position.y = .95 + Math.sin(time * 1.7) * amplitude;
    hostGroup.rotation.y = Math.atan2(camera.position.x - hostGroup.position.x, camera.position.z - hostGroup.position.z) + Math.sin(time * .45) * .035;
    const head = joints.get('Head'); if (head) { head.node.rotation.copy(head.rotation); head.node.rotation.y += Math.sin(time * .55) * .10; head.node.rotation.z += Math.sin(time * .7) * .035; }
    for (const name of ['ArmL', 'ArmR']) {
      const joint = joints.get(name); if (!joint) continue; joint.node.rotation.copy(joint.rotation);
      const side = name === 'ArmL' ? 1 : -1;
      joint.node.rotation.z += side * (.05 + Math.sin(time * 1.15 + side) * (caution ? .015 : .055));
      if (!diagnostics.engaged && diagnostics.beat === 'hook' && !caution && !active && name === 'ArmL') {
        // A welcoming idle gesture is scenery, never a simulated work result.
        joint.node.rotation.z += Math.max(0, Math.sin(time * .65)) * .42;
        joint.node.rotation.x -= Math.max(0, Math.sin(time * .65)) * .3;
      }
      if (active) joint.node.rotation.x -= .16 + Math.sin(time * .8) * .035;
      if (cueAge < 1.8 && actualState === 'passed') joint.node.rotation.z += side * Math.sin(cueAge / 1.8 * Math.PI) * .18;
    }
    const core = joints.get('Core'); if (core) { core.node.rotation.copy(core.rotation); core.node.rotation.y += time * .25; }
    ambient.update(time);
    horizon.update(time);
    updateCrew();
    demo.update(time, beatAge, diagnostics.beat, diagnostics.engaged || diagnostics.view === 'management');
    const light = scene.getObjectByName('ActualWorkAccent');
    light.intensity = actualState === 'building' || actualState === 'testing' ? 9 : caution ? 3 : 0;
    light.color.set(caution ? 0xffb45a : actualState === 'building' ? 0xffb75f : 0x64e4ed);
    light.position.set(actualState === 'building' ? 9 : actualState === 'testing' ? -18 : 5, 4, actualState === 'building' ? -15 : actualState === 'testing' ? -1 : 12);
    if (testSceneEnabled && diagnostics.view === 'cinematic') {
      const sample = testPerformance.sample(dt, !!reduced?.matches);
      diagnostics.testScene = poseTestScene({sample,time,hostGroup,joints,actor:testRig,camera,reduced:!!reduced?.matches});
      demo.root.visible = false; hostShadow.visible = false;
      light.position.set(-18,4,5); light.intensity = sample.active ? 9 : sample.state === 'failed' ? 3 : 0;
      light.color.set(sample.state === 'failed' ? 0xffb45a : 0x64e4ed);
      scene.getObjectByName('HostPracticalLight')?.position.set(hostGroup.position.x+2,6,hostGroup.position.z+3);
    }
    if(showcaseEnabled && diagnostics.view==='cinematic') {
      demo.root.visible=false;hostShadow.visible=false;hostGroup.visible=!!opening;
      if(opening) {
        if(!showcaseLive) {
          openingAge=Math.min(opening.duration,openingAge+dt);
          openingPose=opening.pose(openingAge,{reducedMotion:!!reduced?.matches});renderer.toneMappingExposure=openingPose.lighting.exposure;
          diagnostics.showcase={elapsed:openingAge,phase:showcaseUnavailable?'unknown':openingAge<opening.duration?'opening':'ready',shotId:openingAge>=opening.duration?'W01':openingPose.shotId,projectId:showcaseProject,runId:showcaseRun?.id||null,candidateHash:showcaseRun?.artifact?.candidateHash||showcaseRun?.source?.hash||'',handoff:false,camera:{position:camera.position.toArray(),target:camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6).add(camera.position).toArray(),fov:camera.fov},hostPosition:hostGroup.position.toArray(),muted:true,faceVisible:openingPose.faceVisible,lighting:openingPose.lighting};
        }else{
          if(!handoff){if(!openingPose)openingPose=opening.pose(openingAge,{reducedMotion:!!reduced?.matches});handoff=capturePose();handoffAge=0;}
          const sample=testPerformance.sample(showcaseUnavailable?0:dt,!!reduced?.matches);
          if(!showcaseUnavailable){
            if(handoff.sensor){sample.extension=Math.max(sample.extension,handoff.sensor.extension);sample.open=Math.max(sample.open,handoff.sensor.open);}
            const staged=poseTestScene({sample,time,hostGroup,joints,actor:testRig,camera:cinematicCamera,reduced:!!reduced?.matches});
            const blend=reduced?.matches?1:THREE.MathUtils.smoothstep(handoffAge,0,1.8);
            hostGroup.position.lerpVectors(handoff.position,hostGroup.position.clone(),blend);hostGroup.quaternion.slerpQuaternions(handoff.quaternion,hostGroup.quaternion.clone(),blend);
            camera.position.lerpVectors(handoff.cameraPosition,camera.position.clone(),blend);camera.quaternion.slerpQuaternions(handoff.cameraQuaternion,camera.quaternion.clone(),blend);camera.fov=THREE.MathUtils.lerp(handoff.fov,camera.fov,blend);camera.updateProjectionMatrix();
            for(const [name,joint]of joints){const from=handoff.joints.get(name);if(from)joint.node.quaternion.slerpQuaternions(from,joint.node.quaternion.clone(),blend);}
            const mood=opening.setMood(THREE.MathUtils.lerp(handoff.welcome,1,blend));renderer.toneMappingExposure=mood.exposure;
            opening.thrusters.pose(time,THREE.MathUtils.lerp(handoff.power,.1,blend),{reducedMotion:!!reduced?.matches});
            diagnostics.testScene=staged;handoffAge+=dt;
          }else{if(frozenPose){hostGroup.position.copy(frozenPose.position);hostGroup.quaternion.copy(frozenPose.quaternion);camera.position.copy(frozenPose.cameraPosition);camera.quaternion.copy(frozenPose.cameraQuaternion);camera.fov=frozenPose.fov;camera.updateProjectionMatrix();for(const [name,q]of frozenPose.joints)joints.get(name)?.node.quaternion.copy(q);}diagnostics.testScene={...sample};opening.thrusters.pose(time,.1,{reducedMotion:!!reduced?.matches});}
          light.position.set(sample.target?.[0]??-18,4,(sample.target?.[2]??7)-4);light.intensity=sample.active?5:0;
          const look=camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6).add(camera.position).toArray();
          const shotId=({notice:'T01A',uncertain:'T01A',deploy:'T01B',search:'T01B',lock:'T01B',turn:'T01C',travel:'T01C',watch:'T01D',result:'T01E',stopped:'T01E',inspect:'R01',ready:'W01'})[sample.phase]||'W01';
          diagnostics.showcase={elapsed:openingAge,phase:sample.phase,shotId,projectId:showcaseProject,runId:sample.runId,candidateHash:sample.candidateHash,handoff:true,handoffAge,camera:{position:camera.position.toArray(),target:look,fov:camera.fov},hostPosition:hostGroup.position.toArray(),state:sample.state,passed:sample.passed,total:sample.total,checkKind:sample.checkKind,facility:sample.facility,basis:sample.basis,muted:true};
        }
      }
      if(opening && (openingAge>=opening.duration || showcaseLive)) {
        if(!overviewFrom)overviewFrom={position:camera.position.clone(),target:camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3).add(camera.position),fov:camera.fov||43};
        overviewAge+=dt;
        const pullback=reduced?.matches?1:THREE.MathUtils.smoothstep(overviewAge,0,5.5);
        const destination=new THREE.Vector3(...MANAGEMENT.position), look=new THREE.Vector3(...MANAGEMENT.target);
        if(pullback<1){
          camera=cinematicCamera;
          camera.position.lerpVectors(overviewFrom.position,destination,pullback);
          camera.lookAt(overviewFrom.target.clone().lerp(look,pullback));
          const isoFov=THREE.MathUtils.radToDeg(2*Math.atan((MANAGEMENT.verticalSpan/2)/destination.distanceTo(look)));
          camera.fov=THREE.MathUtils.lerp(overviewFrom.fov,isoFov,pullback);camera.updateProjectionMatrix();
        }else{
          overviewReady=true;camera=managementCamera;
          camera.position.copy(destination);camera.lookAt(look);camera.updateProjectionMatrix();
        }
        if(renderPass)renderPass.camera=camera;
        diagnostics.camera={type:overviewReady?'orthographic':'perspective',position:camera.position.toArray(),target:look.toArray(),verticalSpan:overviewReady?MANAGEMENT.verticalSpan:null};
        diagnostics.showcase={...diagnostics.showcase,overview:true,pullback,shotId:showcaseLive?diagnostics.showcase?.shotId:'W02',workerScale:.65};
      }
      if(camera.isPerspectiveCamera){
        outputOffset=0;
        camera.filmOffset=outputOffset;camera.updateProjectionMatrix();
        if(diagnostics.showcase)diagnostics.showcase.outputFraming={open:showcaseOutput,filmOffset:outputOffset};
      }
    }
  }
  function draw() {
    if (disposed || lost || !renderer) return false;
    const begin = performance.now();
    try {
      renderer.info.reset();
      if (composer) { try { composer.render(); } catch { disposeComposer(); renderer.setRenderTarget(null); renderer.info.reset(); renderer.render(scene, camera); } }
      else renderer.render(scene, camera);
      const info = renderer.info;
      diagnostics.frames++; diagnostics.renderedFrames = diagnostics.frames; diagnostics.drawCalls = info.render.calls; diagnostics.triangles = info.render.triangles;
      diagnostics.memory = { geometries: info.memory.geometries, textures: info.memory.textures };
      diagnostics.cpuFrameMs = performance.now() - begin; diagnostics.cpuFrameEMA = diagnostics.cpuFrameEMA ? diagnostics.cpuFrameEMA * .94 + diagnostics.cpuFrameMs * .06 : diagnostics.cpuFrameMs;
      // Measured submission limits include shadows and postprocessing. A newly
      // loaded scene gets one measured frame; an excess freezes it immediately
      // and reveals the illustrated view rather than repeating costly frames.
      if (info.render.calls > LIMITS.drawCalls || info.render.triangles > LIMITS.frameTriangles || info.memory.textures > LIMITS.textures) throw new Error('GPU scene exceeded its measured resource budget');
      setReady(); return true;
    } catch (error) { fail(error); return false; }
  }
  function tick(stamp) {
    raf = 0; if (!canPresent() || !canAnimate() && !renderRequested) return;
    if (stamp + .2 < nextFrame) { raf = requestAnimationFrame(tick); return; }
    const dt = lastStamp ? Math.min(.05, (stamp - lastStamp) / 1000) : 1 / 60;
    lastStamp = stamp; renderRequested = false;
    nextFrame = Math.max(nextFrame + 1000 / diagnostics.maxFPS, stamp + 1000 / diagnostics.maxFPS - 1);
    animate(canAnimate() ? dt : 0); if (!draw()) return;
    fpsFrames++; if (!fpsStamp) fpsStamp = stamp;
    if (stamp - fpsStamp >= 1000) { diagnostics.fps = fpsFrames * 1000 / (stamp - fpsStamp); fpsFrames = 0; fpsStamp = stamp; }
    if (canAnimate() || renderRequested) raf = requestAnimationFrame(tick);
  }
  function resize() {
    if (!renderer || disposed || lost) return;
    const rect = container.getBoundingClientRect(), width = Math.max(1, Math.round(container.clientWidth || rect.width)), height = Math.max(1, Math.round(container.clientHeight || rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, diagnostics.maxDPR, Math.sqrt(diagnostics.pixelBudget / (width * height)));
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); composer?.setPixelRatio(dpr); composer?.setSize(width, height);
    updateProjection(width, height);
    Object.assign(diagnostics, { width, height, dpr, backbufferWidth: canvas.width, backbufferHeight: canvas.height });
    camera.updateMatrixWorld(true);
    requestDraw();
    emit();
  }
  async function loadAsset(kind, name) {
    diagnostics[`${kind}Asset`] = 'loading'; emit();
    let loaded;
    try {
      const buffer = await localAsset(name);
      if (disposed) return;
      const manager = new THREE.LoadingManager(); manager.setURLModifier(() => { throw new Error('External asset resource denied'); });
      loaded = (await new GLTFLoader(manager).parseAsync(buffer, '')).scene;
      if (disposed) { disposeGraph(loaded); return; }
      const stats = inspectAsset(loaded, kind);
      const otherKind = kind === 'world' ? 'host' : 'world';
      if (stats.textures + (diagnostics.assetStats[otherKind]?.textures || 0) > LIMITS.sceneTextures) throw new Error('Combined scene texture budget exceeded');
      if (kind === 'world') { scene.remove(architecture); disposeGraph(architecture); architecture = loaded; scene.add(loaded); }
      else { opening?.destroy();testRig?.dispose(); hostGroup.remove(host.root); disposeGraph(host.root); host = { root: loaded }; hostGroup.add(loaded); captureJoints(); testRig = testActor(loaded);opening=createShowcaseOpening({scene,hostGroup,joints,actor:testRig,camera:cinematicCamera,lights:lamps});
        if(crew){scene.remove(crew.root);if(authoredCrew)crew.dispose();else disposeGraph(crew.root);}
        // Snapshot the same approved hardware for every district worker.
        testRig.sensor.pose({extension:1,open:1,scanYaw:0,scanPitch:-.12,locked:false});
        crew=createRobotCrew({template:hostGroup,scale:.65});authoredCrew=true;scene.add(crew.root);updateCrew();
      }
      diagnostics[`${kind}Asset`] = 'loaded'; diagnostics.assetStats[kind] = stats;
      requestDraw(); emit();
    } catch (error) { if (loaded && !loaded.parent) disposeGraph(loaded); if (disposed) return; diagnostics[`${kind}Asset`] = 'error'; diagnostics.assetErrors[kind] = String(error?.message || error).slice(0, 180); emit(); }
  }
  function onVisibility() { visible = !document.hidden && document.visibilityState !== 'hidden'; updatePause(); }
  function onLost(event) { event.preventDefault(); lost = true; diagnostics.contextLost = true; fail(new Error('Graphics context lost; illustrated view retained')); }
  function onRestored() {
    if (disposed) return;
    const check = hardwareIdentity(renderer.getContext()); diagnostics.gpu = check.identity;
    if (!check.supported) { fail(new Error('Restored graphics backend is not verified hardware')); return; }
    lost = false; diagnostics.contextLost = false; diagnostics.error = null; createEnvironment(); resize(); requestDraw(); updatePause();
  }
  const api = Object.freeze({
    setShowcaseContext(value={}) {
      if(disposed)return;showcaseEnabled=true;
      const projectId=typeof value.projectId==='string'?value.projectId.slice(0,160):'';
      const run=value.run&&value.run.projectId===projectId?value.run:null;
      const unavailable=value.unavailable===true||!!(value.run&&!run);
      const nextKey=JSON.stringify([projectId,run?.id||'',run?.created||0]);
      const fresh=!!run&&(ACTIVE.has(run.state)||['queued','starting','assigned','starting_agent','agent_working','agent_review'].includes(run.state)||value.follow===true);
      if(nextKey!==showcaseKey){if(opening)handoff=capturePose();else handoff=null;handoffAge=0;showcaseLive=fresh||showcaseLive&&!!run;if(!showcaseLive&&openingAge>0)openingAge=Math.min(12,openingAge);showcaseKey=nextKey;}
      showcaseProject=projectId;showcaseRun=run;showcaseUnavailable=unavailable;showcaseOutput=value.outputVisible===true;
      const activity=value.activity&&value.activity.projectId===projectId&&(!run||value.activity.runId===run.id)?value.activity:null;
      testPerformance.setRun(run?{...run,presentationFacility:routing.facilityFor(run,activity),presentationBasis:activity?.basis||'observed'}:null,{follow:value.follow===true,unavailable,startPosition:handoff?.position?.toArray()});
      requestDraw();
    },
    setTestRun(run, options) { if(disposed)return; testSceneEnabled=true; testPerformance.setRun(run,options); requestDraw(); },
    setBeat(name) { if (disposed || !SHOTS[name] || diagnostics.beat === name) return; diagnostics.beat = name; beatAge = 0; if (!cinematicCamera) return; shotFrom = cameraBase.clone(); shotTargetFrom = cameraTarget.clone(); shotFovFrom = cinematicCamera.fov; targetPosition.set(...SHOTS[name].position); targetLook.set(...SHOTS[name].target); transition = reduced?.matches?1:0; requestDraw(); },
    setView(name) { if (disposed || !['management', 'cinematic'].includes(name) || name === diagnostics.view) return; diagnostics.view = name; nextFrame = 0; applyView(); },
    setWorkers(values) { if (disposed) return; const records = workerLayout((Array.isArray(values)?values:[]).filter(value=>value&&(value.runId||value.sessionId))), signature = JSON.stringify(records); if (signature === workerSignature) return; workerSignature = signature; workerRecords = records; crew?.set(workerRecords); diagnostics.workerCount = workerRecords.length; diagnostics.gpuWorkersReady = !!crew && diagnostics.ready; requestDraw(); emit(); },
    getLayout() {
      const facilityDetails = Object.fromEntries(Object.entries(FACILITIES).map(([id, value]) => [id, { entrance: value.entrance, pin: value.pin, bounds: { min: value.min, max: value.max }, footprint: [[value.min[0], 0, value.min[2]], [value.max[0], 0, value.min[2]], [value.max[0], 0, value.max[2]], [value.min[0], 0, value.max[2]]] }]));
      return JSON.parse(JSON.stringify({ hub: [0, 0, 0], hubDetails: { anchor: [0, .55, 0], entrance: [0, .55, 5.4], pin: [0, .7, 0] },
        facilities: Object.fromEntries(Object.entries(FACILITIES).map(([id, value]) => [id, value.anchor])), facilityDetails,
        featuredHost:{position:hostGroup.position.toArray(),scale:hostGroup.scale.x},
        workers: Object.fromEntries(workerRecords.map(record => [record.id, record.position])) }));
    },
    projectPoint(point) {
      if (disposed || !camera || !Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return { x: 0, y: 0, visible: false };
      camera.updateMatrixWorld(true);
      const projected = V(...point).project(camera);
      return { x: (projected.x + 1) * diagnostics.width / 2, y: (1 - projected.y) * diagnostics.height / 2,
        visible: Number.isFinite(projected.x + projected.y + projected.z) && projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1 && projected.z >= -1 && projected.z <= 1 };
    },
    setEngaged(value) { if (disposed) return; diagnostics.engaged = !!value; requestDraw(); },
    setActivity(value = {}) { if (disposed) return; const state = KNOWN.has(value.state) ? value.state : 'unknown'; const changed = actualState !== state; actualState = state; diagnostics.activity = { state, label: String(value.label || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 180) }; if (changed) cueAge = activitySeen ? 0 : 100; activitySeen = true; requestDraw(); },
    setPaused(value) { if (disposed) return; paused = !!value; updatePause(); },
    getDiagnostics,
    destroy() {
      if (disposed) return; disposed = true; stop(); resizeObserver?.disconnect(); intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); reduced?.removeEventListener?.('change', updatePause);
      removeNativeVisibility?.();
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      opening?.destroy();testRig?.dispose(); disposeGraph(scene); disposeComposer(); environmentTarget?.dispose(); renderer?.renderLists.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
      diagnostics.ready = false; diagnostics.gpuWorkersReady = false; diagnostics.disposed = true; diagnostics.paused = true; diagnostics.phase = 'destroyed'; diagnostics.memory = { geometries: 0, textures: 0 };
      LIVE.delete(api); if (window.__districtWorld === api) window.__districtWorld = null; wrapper.remove(); emit();
    }
  });
  Object.defineProperty(canvas, '__districtWorldDiagnostics', { value: getDiagnostics, configurable: false });
  LIVE.add(api); window.__districtWorld = api;
  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true, preserveDrawingBuffer: false });
    if (!context) throw new Error('Hardware WebGL2 is unavailable');
    const check = hardwareIdentity(context); diagnostics.gpu = check.identity;
    if (!check.supported) throw new Error('A verified hardware GPU is required; illustrated view retained');
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .98;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x06101e); scene.fog = new THREE.FogExp2(0x14253e, .0105);
    createEnvironment();
    cinematicCamera = new THREE.PerspectiveCamera(SHOTS.hook.fov, 1, .2, 220); cinematicCamera.position.copy(cameraBase); cinematicCamera.lookAt(cameraTarget);
    managementCamera = new THREE.OrthographicCamera(-51, 51, 34, -34, MANAGEMENT.near, MANAGEMENT.far); managementCamera.position.set(...MANAGEMENT.position); managementCamera.lookAt(V(...MANAGEMENT.target));
    camera = diagnostics.view === 'management' ? managementCamera : cinematicCamera;
    lamps.ambient=new THREE.HemisphereLight(0x9ed9fa, 0x132033, 2.15);scene.add(lamps.ambient);
    const moon = new THREE.DirectionalLight(0xa0c8ff, 3.0); moon.position.set(-22, 38, 12); moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -38, right: 38, top: 36, bottom: -32, near: 1, far: 95 }); moon.shadow.bias = -.0006; moon.shadow.normalBias = .08; scene.add(moon);
    lamps.key=moon;
    const rim = new THREE.DirectionalLight(0xffb56c, 2.1); rim.position.set(23, 16, -15); scene.add(rim);lamps.rim=rim;
    const hostLight = new THREE.PointLight(0x92e6ff, 26, 15, 2); hostLight.name='HostPracticalLight'; hostLight.position.set(7, 6, 15); scene.add(hostLight);lamps.practical=hostLight;
    const realAccent = new THREE.PointLight(0x64e4ed, 0, 14, 2); realAccent.name = 'ActualWorkAccent'; scene.add(realAccent);
    architecture = proceduralDistrict(); scene.add(architecture); ambient = infrastructure(); scene.add(ambient.root);
    horizon = atmosphere(); scene.add(horizon.root);
    crew = worldWorkers(); scene.add(crew.root); crew.set(workerRecords);
    demo = demonstration(); scene.add(demo.root);
    host = proceduralHost(); hostGroup.name = 'AnimatedHost'; hostGroup.position.set(5, .95, 12); hostGroup.scale.setScalar(.65); hostGroup.add(host.root); scene.add(hostGroup); captureJoints();
    // The levitation plinth is actual geometry; its steady emission is ambience.
    const plinth = material(0x254658), halo = material(0x1d6574, 0x48d7e9, 1.5);
    cylinder(hostShadow, 2.5, 2.8, .18, plinth, [5, .65, 12], 48); ring(hostShadow, 2.35, .045, halo, [5, .77, 12]); scene.add(hostShadow);
    canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored); document.addEventListener('visibilitychange', onVisibility); reduced?.addEventListener?.('change', updatePause);
    if (typeof window.bus?.onDistrictWindowVisibility === 'function') removeNativeVisibility = window.bus.onDistrictWindowVisibility(value => { nativeVisible = typeof value === 'boolean' ? value : value?.visible === true; updatePause(); });
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
    if (typeof IntersectionObserver !== 'undefined') { intersectionObserver = new IntersectionObserver(entries => { intersecting = entries[0]?.isIntersecting !== false; updatePause(); }); intersectionObserver.observe(wrapper); }
    applyView(); animate(0); renderRequested = false; draw(); updatePause();
    void loadAsset('world', 'district-world.glb'); void loadAsset('host', 'district-host.glb');
  } catch (error) { fail(error); }
  return api;
}

if (typeof window !== 'undefined') window.DistrictAttractWorld = Object.freeze({ mount, instances: () => [...LIVE].map(instance => instance.getDiagnostics()) });
