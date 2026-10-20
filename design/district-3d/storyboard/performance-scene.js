import {bindFace,buildSensor} from './performance-controls.js';
import BOARD from '../STORYBOARD.json';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// STORYBOARD ONLY. These are manually posed illustrative mechanisms, not a run,
// test result, interactive product, or implementation of the proposed gameplay.
const SHOTS = {
  S01: ['A glance finds you', 'Eyes settle', 'The sealed idea', 'A physical handoff'],
  S02: ['Research receives', 'Instrument examines', 'Courier takes custody', 'Forge cradle locks'],
  S03: ['Frame descends', 'Parts seat; collar raised', 'Verification finds the gap', 'Tool seats collar; scan clears'],
  S04: ['Gateway receives fixture', 'Copper latches release', 'A spatial reveal', 'The project responds'],
  S05: ['Look from result to you', 'An open hand', 'The invitation holds', 'Return to the first gaze'],
  P01: ['Same place, low angle', 'Choose your district', 'Lift without changing identity', 'The same place overhead']
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const mixPoint = (a, b, t) => a.map((v, i) => lerp(v, b[i], smooth(t)));
const PATH = { research: [-11, .2, -7.1], forge: [9, .9, -3.1], test: [-18, .85, 8.7], gate: [18, .85, 8.7], revealed: [18, .85, 13.8] };
export function frameCamera(shot, phase) {
  const panels=(BOARD.beats.find(beat=>beat.id===shot)||BOARD.beats[0]).panels;
  phase=clamp(Number(phase)||0,0,3);const low=Math.floor(phase),high=Math.min(3,low+1),t=phase-low;
  const a=panels[low].renderCamera,b=panels[high].renderCamera;
  return {position:mixPoint(a.position,b.position,t),target:mixPoint(a.target,b.target,t),fov:a.fov===null?null:lerp(a.fov,b.fov||a.fov,t),projection:a.projection};
}
export const FRAME_STATES = Object.freeze(Object.entries(SHOTS).flatMap(([shot, labels]) => labels.map((label, phase) => Object.freeze({ shot, phase, id: `${shot}-${phase + 1}`, label, demonstration: true, camera: frameCamera(shot, phase) }))));

function mat(color, metal = .55, rough = .34, glow = 0, power = 0) { return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: glow, emissiveIntensity: power }); }
function mesh(parent, geometry, material, position = [0, 0, 0]) { const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object; }
function box(parent, size, material, position) { return mesh(parent, new THREE.BoxGeometry(...size), material, position); }
function cyl(parent, radius, height, material, position, segments = 24) { return mesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), material, position); }
function ring(parent, radius, tube, material, position, horizontal = false) { const object = mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 48), material, position); if (horizontal) object.rotation.x = Math.PI / 2; return object; }
function group(parent, name, position = [0, 0, 0]) { const object = new THREE.Group(); object.name = name; object.position.set(...position); parent.add(object); return object; }
function disposeGraph(root) { const geometries = new Set(), materials = new Set(), textures = new Set(); root?.traverse(object => { if (object.geometry) geometries.add(object.geometry); for (const item of Array.isArray(object.material) ? object.material : [object.material]) if (item) { materials.add(item); for (const value of Object.values(item)) if (value?.isTexture) textures.add(value); } }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); }

function validateGLB(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 20 || buffer.byteLength > 24 * 1024 * 1024) throw new Error('Invalid fixed local asset size');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Invalid GLB 2 header');
  const size = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || size + 20 > buffer.byteLength) throw new Error('Invalid GLB JSON bounds');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, size)).trim());
  if ([...(json.buffers || []), ...(json.images || [])].some(item => Object.hasOwn(item, 'uri'))) throw new Error('Only embedded GLB resources are permitted');
  if ((json.extensionsRequired || []).some(name => /draco|meshopt|basisu/i.test(name))) throw new Error('External decoder denied');
}
async function loadGLB(name, readAsset) {
  if (!['district-world.glb', 'district-host.glb'].includes(name)) throw new Error('Unknown study asset');
  const response = await readAsset(name);
  let buffer;
  if (response instanceof ArrayBuffer) buffer = response;
  else {
    if (typeof response?.base64 !== 'string' || response.base64.length > 33554436) throw new Error('Invalid local byte response');
    const raw = atob(response.base64), bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i); buffer = bytes.buffer;
  }
  validateGLB(buffer); const manager = new THREE.LoadingManager(); manager.setURLModifier(() => { throw new Error('External study resource denied'); });
  return (await new GLTFLoader(manager).parseAsync(buffer, '')).scene;
}

function buildProps(scene) {
  const root = group(scene, 'DemonstrationMechanicalProps');
  const ink = mat(0x112b3e, .64, .36), pearl = mat(0xc3d3cd, .38, .28), copper = mat(0xb47c4e, .76, .28), violet = mat(0x6a5c91, .6, .35);
  const cyan = mat(0x3e9ba5, .4, .3, 0x42d3df, 1.15), amber = mat(0xb58c52, .5, .33, 0xffb958, .85), glass = mat(0x3e7986, .66, .18);
  const packet = group(root, 'SingleSealedWorkPacket');
  cyl(packet, .42, 1.0, copper, [0, .5, 0]); cyl(packet, .46, .12, ink, [0, .08, 0]); cyl(packet, .46, .12, pearl, [0, 1.02, 0]);
  ring(packet, .43, .035, cyan, [0, .36, 0], true); ring(packet, .43, .035, amber, [0, .76, 0], true);
  const tray = group(root, 'ResearchReceivingTray', PATH.research); box(tray, [2.2, .18, 1.8], ink, [0, .45, 0]);
  for (const x of [-.8, .8]) box(tray, [.12, .8, 1.5], copper, [x, .1, 0]);
  const probe = group(tray, 'ResearchProbe', [0, 2.1, -.55]); cyl(probe, .12, 2.2, pearl, [.8, -.5, -.2]);
  const probeRing = ring(probe, .72, .08, copper, [0, 0, 0]); ring(probe, .59, .035, cyan, [0, 0, .03]);
  const forge = group(root, 'ForgeReceivingFixture', PATH.forge); cyl(forge, 2.5, .3, ink, [0, -.4, 0]); ring(forge, 2.3, .05, amber, [0, -.22, 0], true);
  const arms = [];
  for (const side of [-1, 1]) {
    const base = group(forge, `AssemblyArm${side}`, [side * 2.7, -.1, 0]); cyl(base, .45, .55, copper, [0, 0, 0]);
    const shoulder = group(base, 'Shoulder', [0, .2, 0]); box(shoulder, [.35, 2.25, .4], pearl, [0, 1.05, 0]); cyl(shoulder, .27, .48, violet, [0, 2.15, 0]).rotation.z = Math.PI / 2;
    const elbow = group(shoulder, 'Elbow', [0, 2.15, 0]); box(elbow, [1.5, .28, .32], copper, [-side * .7, 0, 0]);
    const hand = group(elbow, 'Tool', [-side * 1.5, 0, 0]); box(hand, [.23, .7, .23], ink, [0, -.28, 0]); box(hand, [.5, .12, .2], cyan, [0, -.63, 0]);
    arms.push({ base, shoulder, elbow, side });
  }
  const project = group(root, 'SingleAssembledProjectFixture');
  cyl(project, 2.5, .3, ink, [0, .15, 0]); ring(project, 2.35, .05, copper, [0, .36, 0], true);
  const collar = ring(project, 1.7, .12, copper, [0, 1.6, 0], true);
  const columns = [], petals = [];
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(angle) * 1.65, z = Math.sin(angle) * 1.65;
    const column = group(project, `ProjectColumn${i}`, [x, .35, z]); box(column, [.24, 2.5, .24], pearl, [0, 1.25, 0]); columns.push(column);
    const hinge = group(project, `OpeningRoofPetal${i}`, [x, 2.85, z]); hinge.rotation.y = -angle;
    box(hinge, [1.75, .12, 1.25], glass, [-.65, 0, 0]); box(hinge, [1.8, .06, .10], copper, [-.65, .09, -.6]); petals.push(hinge);
  }
  const turbine = group(project, 'WorkingSpatialProject', [0, 1.3, 0]);
  for (let i = 0; i < 3; i++) { const fin = box(turbine, [.17, 1.3, .65], cyan, [Math.cos(i / 3 * Math.PI * 2) * .55, 0, Math.sin(i / 3 * Math.PI * 2) * .55]); fin.rotation.y = -i / 3 * Math.PI * 2; }
  const control = group(project, 'PhysicalProjectControl', [0, .65, 2.0]); box(control, [.5, .16, .45], copper, [0, 0, 0]); const lever = box(control, [.08, .52, .08], pearl, [0, .23, 0]); cyl(control, .13, .08, amber, [0, .52, 0]);
  const scanner = group(root, 'VerificationScanMechanism', PATH.test); cyl(scanner, 2.65, .22, ink, [0, -.3, 0]);
  const scan = ring(scanner, 2.35, .11, copper, [0, 1.8, 0]); const scanLine = ring(scanner, 2.15, .035, cyan, [0, 1.8, .04]);
  const correction = group(scanner, 'CollarCorrectionTool', [2.7, .2, 0]); box(correction, [.25, 2.1, .3], pearl, [0, 1, 0]); const push = box(correction, [1.0, .2, .2], copper, [-.45, 1.95, 0]);
  const gateway = group(root, 'GatewayMechanicalReveal', [18, 0, 2.45]);
  const gateRing = ring(gateway, 3.12, .065, cyan, [0, 4.0, .08]);
  const shutters = [];
  for (const side of [-1, 1]) { const pivot = group(gateway, `CopperGateLatch${side}`, [side * 3.2, 3.5, 2.0]); box(pivot, [.36, 3.2, .6], copper, [0, 0, 0]); box(pivot, [.16, 1.0, .12], amber, [0, .1, .34]); const hub=cyl(pivot,.34,.16,pearl,[0,.1,.48]); hub.rotation.x=Math.PI/2; ring(pivot,.35,.045,copper,[0,.1,.59]); for(let bolt=0;bolt<4;bolt++){const a=bolt*Math.PI/2;const cap=cyl(pivot,.045,.10,ink,[Math.cos(a)*.25,.1+Math.sin(a)*.25,.61],8);cap.rotation.x=Math.PI/2;} box(pivot,[.12,.80,.16],copper,[.12,.5,.65]); shutters.push({ pivot, side }); }
  const revealLight = new THREE.PointLight(0x72dce4, 0, 13, 2); revealLight.position.set(18, 4, 8); scene.add(revealLight);
  return { root, packet, tray, probe, probeRing, forge, arms, project, collar, columns, petals, turbine, lever, scanner, scan, scanLine, correction, push, gateway, gateRing, shutters, revealLight };
}

function addAtmosphere(scene) {
  const root = group(scene, 'StudyDistrictSurroundings');
  const skyMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: 'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec3 d;void main(){float h=normalize(d).y;vec3 c=mix(vec3(.035,.09,.135),vec3(.004,.01,.032),smoothstep(-.02,.7,h));c+=vec3(.018,.028,.045)*exp(-abs(h-.08)*8.);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const sky = mesh(root, new THREE.SphereGeometry(145, 24, 16), skyMaterial); sky.castShadow = false;
  const slate = mat(0x12263b, .5, .5), cap = mat(0x314c60), light = mat(0x366d80, .35, .5, 0x68c6d4, .7);
  const ground = cyl(root, 105, 2.5, slate, [0, -4, 0], 80); ground.castShadow = false;
  const windows = [];
  for (let i = 0; i < 38; i++) {
    const x = -72 + i * 3.9, z = -47 - (i % 4) * 5.8, height = 12 + i * 13 % 34;
    const tower = box(root, [3.1, height, 4.5], slate, [x, height / 2 - 2, z]); tower.castShadow = false;
    box(root, [3.4, .24, 4.8], cap, [x, height - 2, z]).castShadow = false;
    for (let y = 2; y < height - 2; y += 3) for (let col = -1; col <= 1; col++) windows.push([x + col * .7, y, z + 2.28]);
  }
  const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(.23, .58, .06), light, windows.length), matrix = new THREE.Matrix4();
  windows.forEach((p, i) => { matrix.makeTranslation(...p); instances.setMatrixAt(i, matrix); }); root.add(instances);
  return root;
}

function captureRig(root) { const rig = {}; for (const name of ['Head', 'ArmL', 'ArmR', 'Core']) { const node = root.getObjectByName(name); if (node) rig[name] = { node, rotation: node.rotation.clone() }; } return rig; }
function resetRig(rig) { for (const entry of Object.values(rig)) entry.node.rotation.copy(entry.rotation); }
function setAngle(rig, name, x = 0, y = 0, z = 0) { const item = rig[name]; if (item) { item.node.rotation.x += x; item.node.rotation.y += y; item.node.rotation.z += z; } }

export function mount({ container, readAsset = window.bus?.districtReadAsset, lineArt = true } = {}) {
  if (!container?.appendChild || typeof readAsset !== 'function') throw new Error('Study container and fixed local asset reader required');
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'GPU storyboard composition study; illustrative mechanical actions'); canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none'; container.appendChild(canvas);
  let renderer, composer, scene, camera, ortho, activeCamera, envTarget, observer, props, host, rig, courier, courierRig, helper, helperRig, disposed = false, loaded = false;
  let faceRig,sensor;
  let current = { shot: 'S01', phase: 0 };
  const state = { ready: false, demonstration: true, deterministic: true, style: lineArt ? 'line-art' : 'material', timers: 0, frames: 0, frame: current, gpu: {}, assets: {}, error: null, drawCalls: 0, triangles: 0, width: 0, height: 0, dpr: 1 };
  const diagnostics = () => JSON.parse(JSON.stringify(state));
  function fail(error) { state.ready = false; state.error = String(error?.message || error); }
  function makeLineArt(world) {
    const contextFill = new THREE.MeshBasicMaterial({ color: 0xe1e6e9 }), figureFill = new THREE.MeshLambertMaterial({ color: 0xc6d1d6 });
    const contextInk = new THREE.LineBasicMaterial({ color: 0x70818c, transparent: true, opacity: .52 }), figureInk = new THREE.LineBasicMaterial({ color: 0x152f3f, transparent: true, opacity: .95 });
    const cache = new Map(), replaced = new Set();
    const targets = []; scene.traverse(object => { if (object.isMesh) targets.push(object); });
    for (const object of targets) {
      let isContext = false; for (let parent = object; parent; parent = parent.parent) if (parent === world) isContext = true;
      for (const old of Array.isArray(object.material) ? object.material : [object.material]) replaced.add(old);
      object.material = isContext ? contextFill : figureFill;
      if (!cache.has(object.geometry)) cache.set(object.geometry, new THREE.EdgesGeometry(object.geometry, isContext ? 24 : 13));
      const outline = new THREE.LineSegments(cache.get(object.geometry), isContext ? contextInk : figureInk); outline.name = 'StoryboardContour'; object.add(outline);
    }
    replaced.forEach(material => material?.dispose());
    const accent = new THREE.MeshBasicMaterial({ color: 0x4298a7 }); props.scanLine.material = accent; props.gateRing.material = accent;
    props.packet.traverse(object => { if (object.isMesh && object.geometry.type === 'TorusGeometry') object.material = accent; });
  }
  function resize() {
    if (!renderer || disposed) return;
    const rect = container.getBoundingClientRect(), width = Math.max(1, container.clientWidth || Math.round(rect.width)), height = Math.max(1, container.clientHeight || Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(8300000 / (width * height)));
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false); composer?.setPixelRatio(ratio); composer?.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix(); ortho.left = -34 * width / height; ortho.right = 34 * width / height; ortho.updateProjectionMatrix();
    Object.assign(state, { width, height, dpr: ratio, backbufferWidth: canvas.width, backbufferHeight: canvas.height });
    if (loaded) pose(current);
  }
  function pose(spec) {
    if (!loaded || disposed) return;
    if(spec.performance){posePerformance(spec);return;}
    const shot = Object.hasOwn(SHOTS, spec.shot) ? spec.shot : 'S01', phase = clamp(Number(spec.phase) || 0, 0, 3), t = phase / 3;
    const moving=Number.isFinite(spec.progress),u=clamp(Number(spec.progress)||0,0,1),e=smooth(u),seconds=Number(spec.seconds)||0;
    state.frame = moving ? {shot,phase,progress:u,seconds} : {shot,phase}; current = state.frame;
    resetRig(rig); resetRig(courierRig); resetRig(helperRig);
    host.visible = true; host.position.set(5, .95, 12); host.scale.setScalar(1.65);
    courier.visible = false; helper.visible = false; props.packet.visible = true; props.project.visible = false;
    props.tray.visible = true; props.forge.visible = true; props.scanner.visible = true; props.gateway.visible = true;
    props.project.scale.setScalar(.55); props.project.rotation.set(0, 0, 0); props.packet.scale.setScalar(.65); props.packet.rotation.set(0, 0, 0);
    props.probe.rotation.set(0, 0, 0); props.probeRing.rotation.y = 0; props.scan.rotation.set(0, 0, 0); props.scanLine.rotation.set(0, 0, 0); props.scanLine.position.z = .04; props.correction.rotation.y = 0;
    props.collar.rotation.set(Math.PI / 2, 0, 0); props.push.position.x = -.45; props.push.position.y=1.95;
    props.columns.forEach(part => { part.scale.y = 1; part.rotation.z = 0; }); props.petals.forEach(part => { part.rotation.z = 0; }); props.turbine.rotation.y = 0; props.lever.rotation.z = 0;
    props.arms.forEach(({ shoulder, elbow, side }) => { shoulder.rotation.z = side * .12; elbow.rotation.z = -side * .22; });
    props.shutters.forEach(({ pivot }) => { pivot.rotation.y = 0; }); props.gateRing.scale.setScalar(.98); props.gateRing.material.emissiveIntensity = .4; props.revealLight.intensity = 0;
    let position = [12, 7, 26], target = [-5, 3.6, 8], fov = 43, overview = false;
    const at = (object, point) => object.position.set(...point);
    const carry = point => { courier.visible = true; at(courier, [point[0] - .8, .35, point[2]]); courier.scale.setScalar(.8); courier.rotation.y = Math.PI / 2; setAngle(courierRig, 'ArmL', -1.0, 0, -.22); setAngle(courierRig, 'ArmR', -1.0, 0, .22); };
    if (shot === 'S01') {
      position = mixPoint([12, 7, 26], [11.3, 6.7, 24.7], t); target = [-4.4, 3.7, 8.1];
      setAngle(rig, 'Head', 0, lerp(-.28, .04, smooth(phase)), lerp(-.08, .02, t));
      const raise = smooth((phase - .7) / 1.4); setAngle(rig, 'ArmL', -1.12 * raise, 0, -.28 * raise);
      at(props.packet, [6.25 + raise * .25, 2.15 + raise * 1.45, 12.4]); props.packet.rotation.z = -.08 * raise;
      if (phase > 2) setAngle(rig, 'Head', 0, -.16 * (phase - 2), -.04);
    } else if (shot === 'S02') {
      host.visible = false;
      if (phase <= 1) {
        position = mixPoint([1, 9, 2], [-3, 6.5, -.2], phase); target = [-11, 2.1, -7.5]; fov = 42;
        at(props.packet, [-11, .9, -7.1]); props.probe.rotation.z = -.24 + phase * .48; props.probeRing.rotation.y = -.4 + phase * .8;
        helper.visible = true; helper.scale.setScalar(.8); helper.position.set(-13, .2, -5.8); helper.rotation.y = 1.1; setAngle(helperRig, 'ArmR', -.5, 0, -.2);
      } else {
        const move = (phase - 1) / 2, p = mixPoint([-11, 1.4, -7.1], [9, 1.5, -3.1], move);
        at(props.packet, p); carry(p); position = mixPoint([3, 10, 13], [19, 8, 8], move); target = [p[0], 2.1, p[2]]; fov = 46;
        if (phase > 2.7) { props.packet.position.y = lerp(1.5, 1.0, (phase - 2.7) / .3); setAngle(courierRig, 'ArmL', .35, 0, 0); }
      }
    } else if (shot === 'S03') {
      host.visible = false; props.project.visible = true;
      if (phase <= 1) {
        at(props.project, PATH.forge); at(props.packet, [9, 1.25, -3.1]);
        position = mixPoint([20, 10, 9], [17, 7, 6], t); target = [9, 2.2, -3.1]; fov = 43;
        const assemble = smooth(phase);
        props.columns.forEach((part, i) => { part.scale.y = .25 + assemble * .75; part.rotation.z = (1 - assemble) * (i % 2 ? .5 : -.5); });
        props.petals.forEach((part, i) => { part.rotation.z = (1 - assemble) * (i % 2 ? 1.15 : -1.15); });
        props.arms.forEach(({ shoulder, elbow, side }) => { shoulder.rotation.z = side * lerp(.22, -.4, smooth(phase)); elbow.rotation.z = -side * lerp(.15, -.50, assemble); });
        props.collar.rotation.z = .23 * assemble;
      } else {
        const p = mixPoint(PATH.forge, PATH.test, phase - 1); at(props.project, p); at(props.packet, [p[0], p[1] + .35, p[2]]); carry(p);
        position = mixPoint([8, 14, 20], [-7, 8, 20], phase - 2); target = [p[0], 2, p[2]]; fov = 45;
        props.collar.rotation.z = .32 * (1 - smooth(phase - 2)); props.scanLine.rotation.y = Math.max(0, phase - 2) * Math.PI;
        props.scanLine.position.z = .04 + Math.max(0, phase - 2) * .35;
        props.push.position.x = -.45 - smooth(phase - 2) * .6;
        if (phase >= 2) courier.position.set(-15.6, .2, 9.5);
      }
    } else if (shot === 'S04') {
      host.visible = false; props.project.visible = true;
      const p = phase <= 1 ? [18, 1.75, 3.5] : mixPoint([18, 1.75, 3.5], PATH.revealed, phase - 1);
      at(props.project, p); props.project.scale.setScalar(lerp(.55, .94, smooth(phase - 1))); at(props.packet, [p[0], p[1] + .4, p[2]]);
      if (phase < .5) carry([18, .3, 7]);
      props.shutters.forEach(({ pivot, side }) => { pivot.rotation.y = side * smooth(phase) * 1.25; });
      props.gateRing.material.emissiveIntensity = lerp(.4, 1.45, smooth(phase)); props.revealLight.intensity = lineArt ? 0 : 15 * smooth(phase / 2);
      props.petals.forEach((part, i) => { part.rotation.z = (i % 2 ? 1 : -1) * smooth(phase - 2) * .65; });
      props.turbine.rotation.y = smooth(phase - 2) * 2.0; props.lever.rotation.z = -.55 * smooth(phase - 2);
      if (phase > 2.35) { helper.visible = true; helper.scale.setScalar(.72); helper.position.set(18.8, .3, 16); helper.rotation.y = Math.PI; setAngle(helperRig, 'ArmR', -.9 * smooth((phase - 2.35) / .65), 0, -.1); }
    } else {
      props.project.visible = true; at(props.project, PATH.revealed); props.project.scale.setScalar(.94); at(props.packet, [18, 1.25, 13.8]); props.petals.forEach((part, i) => { part.rotation.z = (i % 2 ? 1 : -1) * .65; }); props.turbine.rotation.y = 2; props.lever.rotation.z = -.55;
      props.shutters.forEach(({ pivot, side }) => { pivot.rotation.y = side * 1.25; }); props.gateRing.material.emissiveIntensity = 1.2; props.revealLight.intensity = 10;
      position = mixPoint([14, 7.8, 28], [12, 7, 26], t); target = mixPoint([-1, 3.8, 8], [-5, 3.6, 8], t);
      setAngle(rig, 'Head', 0, lerp(-.4, 0, smooth(phase)), -.025 * Math.sin(t * Math.PI)); setAngle(rig, 'ArmL', -.9 * Math.sin(t * Math.PI), 0, -.4 * Math.sin(t * Math.PI));
      if (shot === 'P01') { overview = phase >= 2.9; position = mixPoint([12, 7, 26], [60, 62, 58], t); target = mixPoint([-5, 3.6, 8], [0, 2, -2], t); host.visible = phase < 2; }
    }
    if(moving){
      const hover=.035*Math.sin(seconds*Math.PI/2);host.position.y+=hover;
      setAngle(rig,'Core',0,seconds*.25,0);
      if(shot==='S01'){
        if(phase===0)setAngle(rig,'Head',0,.055*e,0);
        if(phase===1)setAngle(rig,'Head',0,-.045*Math.sin(u*Math.PI),-.025*Math.sin(u*Math.PI));
        if(phase===2)setAngle(rig,'ArmL',.16*(1-e),0,0);
        if(phase===3)setAngle(rig,'Head',0,-.12*e,0);
      }
      if(shot==='S02'){
        if(phase===0)props.packet.position.y+=.35*(1-e);
        if(phase===1){props.probeRing.rotation.y=-.65+1.3*e;props.probe.rotation.z=-.24+.48*e;}
        if(phase===2){const dx=-2.3+4.6*e,dz=-.46+.92*e;courier.position.x+=dx;courier.position.z+=dz;courier.position.y+=.035*Math.sin(u*Math.PI*2);}
        if(phase===3)props.packet.position.y+=.3*(1-e);
      }
      if(shot==='S03'){
        if(phase===0)props.arms.forEach(({shoulder,elbow,side})=>{shoulder.rotation.z+=side*.22*e;elbow.rotation.z-=side*.18*e;});
        if(phase===1){props.columns.forEach(part=>part.scale.y=.86+.14*e);props.petals.forEach((part,i)=>part.rotation.z=(i%2?1:-1)*.3*(1-e));}
        if(phase===2){props.scanLine.rotation.y=-.35+.7*e;props.scanLine.position.z=-.35+.7*e;props.collar.rotation.z=.32;}
        if(phase===3){const press=smooth(u/.45),withdraw=smooth((u-.65)/.35);props.collar.rotation.z=.32*(1-press);props.push.position.set(-.45-.8*press+.8*withdraw,.68,0);props.scanLine.rotation.y=Math.PI*smooth((u-.5)/.5);props.scanLine.position.z=-.35+.7*smooth((u-.5)/.5);}
      }
      if(shot==='S04'){
        if(phase===0){props.project.position.y+=.3*(1-e);props.packet.position.y+=.3*(1-e);}
        if(phase===1)props.shutters.forEach(({pivot,side})=>pivot.rotation.y=side*1.25*e);
        if(phase===2){props.project.scale.setScalar(.82+.12*e);props.turbine.rotation.y=.25*Math.sin(u*Math.PI);}
        if(phase===3){props.petals.forEach((part,i)=>part.rotation.z=(i%2?1:-1)*.65*e);props.turbine.rotation.y=2+u*Math.PI*2;props.lever.rotation.z=-.55*e;}
      }
      if(shot==='S05'){
        if(phase===0)setAngle(rig,'Head',0,.12*e,0);
        if(phase===1)setAngle(rig,'ArmL',-.10*Math.sin(u*Math.PI),0,.04*Math.sin(u*Math.PI));
        if(phase===2)setAngle(rig,'Head',0,.018*Math.sin(u*Math.PI*2),.018*Math.sin(u*Math.PI*2));
        if(phase===3){setAngle(rig,'Head',0,-.28*e,-.08*e);}
      }
    }
    host.rotation.y = shot === 'S01' && phase >= 2.9 ? Math.atan2(-16,-19.1) : Math.atan2(position[0] - host.position.x, position[2] - host.position.z);
    if (shot === 'S01' && rig.ArmL) {
      // The actual authored gripper is near the ArmL geometry's minimum Y.
      // Resolve it after the raised rig/world transforms: visible custody stays
      // attached to the hand instead of appearing bolted to a shoulder.
      host.updateMatrixWorld(true);
      const hand = rig.ArmL.node.localToWorld(V(-.25, -1.02, .38)); props.packet.position.copy(hand); props.packet.position.y += .04;
    }
    if (shot === 'S02' && phase > 1 && phase < 2.9 && courierRig.ArmR) {
      courier.updateMatrixWorld(true); props.packet.position.copy(courierRig.ArmR.node.localToWorld(V(.25, -1.02, .38))); props.packet.position.y += .03;
    }
    if (shot === 'S04' && phase > 2.35 && helperRig.ArmR) { helper.updateMatrixWorld(true); props.project.updateMatrixWorld(true); const grip=helperRig.ArmR.node.localToWorld(V(.25,-1.02,.38)); const contact=props.project.localToWorld(V(0,1.17,2)); helper.position.add(contact.sub(grip)); helper.updateMatrixWorld(true); }
    if (!moving && shot === 'S03' && phase >= 2.9) props.push.position.set(-1.25,.68,0);
    const framing = frameCamera(shot, phase); position = framing.position; target = framing.target;
    if(moving){const plan=BOARD.beats.find(b=>b.id===shot).panels[Math.round(phase)].motionCamera;position=mixPoint(plan.from.position,plan.to.position,u);target=mixPoint(plan.from.target,plan.to.target,u);state.motion={panel:shot+String.fromCharCode(65+phase),progress:u,seconds};} fov = framing.fov || 43; overview = framing.projection === 'orthographic';
    if (scene.fog) scene.fog.density = overview ? .0035 : .0105;
    camera.fov = fov; camera.position.set(...position); camera.lookAt(V(...target)); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    activeCamera = overview ? ortho : camera; activeCamera.updateMatrixWorld(true); if (composer) composer.passes[0].camera = activeCamera;
    renderer.info.reset(); if (composer) composer.render(); else renderer.render(scene, activeCamera); state.frames++; state.ready = true; state.drawCalls = renderer.info.render.calls; state.triangles = renderer.info.render.triangles;
    state.camera = { type: overview ? 'orthographic' : 'perspective', position: activeCamera.position.toArray(), target, fov: overview ? null : fov };
    state.packetWorld = props.packet.position.toArray(); state.projectWorld = props.project.visible ? props.project.position.toArray() : null;
    state.memory = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  }
  function posePerformance(spec){
    const seconds=clamp(Number(spec.seconds)||0,0,10),ease=(start,end)=>smooth((seconds-start)/(end-start));
    current={performance:true,seconds};state.frame=current;resetRig(rig);resetRig(courierRig);resetRig(helperRig);
    host.visible=true;courier.visible=false;helper.visible=false;props.root.visible=false;host.scale.setScalar(1.65);faceRig.colorize();
    const notice=ease(.75,1.05),question=ease(1.35,1.7)*(1-ease(6,6.5)),deploy=ease(2.2,3),open=ease(2.75,3.4),locked=seconds>=5.8,resolve=ease(5.8,6.4);
    const headLead=ease(6.35,7),bodyFollow=ease(6.8,8),travel=ease(8.2,10);
    const direction=V(Math.sin(1.1),0,Math.cos(1.1)),delta=direction.clone().multiplyScalar(2.2*travel);
    host.position.set(5+delta.x,.95+.025*Math.sin(seconds*1.4),12+delta.z);host.rotation.set(0,lerp(.45,1.1,bodyFollow),0);
    const checking=seconds<1.75?0:seconds<2.0?-.025*ease(1.75,2):-.025+.025*ease(2,2.2);
    const scan=seconds<3.4?0:seconds<4.05?lerp(0,-.55,ease(3.4,4.05)):seconds<4.8?lerp(-.55,.5,ease(4.05,4.8)):seconds<5.35?lerp(.5,-.12,ease(4.8,5.35)):lerp(-.12,.65,ease(5.35,5.8));
    const aimX=.028*notice+checking+(seconds>3.4&&seconds<5.8?.008*Math.sin(seconds*3):0);
    faceRig.pose({aimX:aimX*(1-.65*resolve),aimY:.005*question,browL:.036*question+.012*resolve,browR:.006*question+.012*resolve,rollL:.13*question,rollR:-.03*question});
    const headYaw=.65*headLead*(1-bodyFollow);setAngle(rig,'Head',-.035*Math.sin(resolve*Math.PI),headYaw,-.10*question);
    setAngle(rig,'ArmL',-.09*resolve,0,.035*resolve);setAngle(rig,'Core',0,seconds*.2,0);
    sensor.pose({extension:deploy,open,scanYaw:locked?1.1-host.rotation.y-headYaw:scan,scanPitch:-.10+.04*Math.sin(seconds*2)*(1-resolve),locked});
    const widen=ease(2.05,3.4),startPosition=[6.1,5.1,14.7],endPosition=[8,6.5,19],startTarget=[5,4.85,12],endTarget=[5,5.3,12];
    const position=mixPoint(startPosition,endPosition,widen).map((v,i)=>v+delta.getComponent(i)),target=mixPoint(startTarget,endTarget,widen).map((v,i)=>v+delta.getComponent(i));
    camera.fov=lerp(36,42,widen);camera.position.set(...position);camera.lookAt(V(...target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);activeCamera=camera;
    if(composer)composer.passes[0].camera=camera;renderer.info.reset();if(composer)composer.render();else renderer.render(scene,camera);
    state.frames++;state.ready=true;state.camera={type:'perspective',position,target,fov:camera.fov};state.performance={seconds,notice,question,deploy,open,locked,resolve,headYaw,bodyYaw:host.rotation.y,travel:delta.toArray(),opticalAim:aimX,sensorWorldYaw:locked?1.1:host.rotation.y+headYaw+scan};state.packetWorld=null;state.projectWorld=null;state.drawCalls=renderer.info.render.calls;state.triangles=renderer.info.render.triangles;
  }
  const api = Object.freeze({ ready: null, setFrame(spec) { if (disposed) return diagnostics(); current = {shot:spec?.shot,phase:spec?.phase,progress:spec?.progress,seconds:spec?.seconds,performance:spec?.performance}; if (loaded) pose(current); return diagnostics(); }, diagnostics,
    project(point) { if (!activeCamera || !Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return { x: 0, y: 0, visible: false }; const p = V(...point).project(activeCamera); return { x: (p.x + 1) * state.width / 2, y: (1 - p.y) * state.height / 2, visible: p.x >= -1 && p.x <= 1 && p.y >= -1 && p.y <= 1 && p.z >= -1 && p.z <= 1 }; },
    destroy() { if (disposed) return; disposed = true; observer?.disconnect(); canvas.removeEventListener('webglcontextlost', onLost); disposeGraph(scene); composer?.passes.forEach(pass => pass.dispose?.()); composer?.dispose(); envTarget?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); canvas.remove(); state.ready = false; state.disposed = true; } });
  function onLost(event) { event.preventDefault(); fail(new Error('GPU context lost; storyboard capture stopped')); }
  const ready = (async () => {
    try {
      const context = canvas.getContext('webgl2', { antialias: true, alpha: false, failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' });
      if (!context) throw new Error('Hardware WebGL2 is required');
      const debug = context.getExtension('WEBGL_debug_renderer_info'), vendor = debug && context.getParameter(debug.UNMASKED_VENDOR_WEBGL), identity = debug && context.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      state.gpu = { vendor: String(vendor || ''), renderer: String(identity || '') };
      if (!debug || !/nvidia/i.test(`${vendor} ${identity}`) || /swiftshader|llvmpipe|software|warp|basic render/i.test(String(identity))) throw new Error('Verified NVIDIA hardware required for this GPU study');
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .98; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.info.autoReset = false;
      scene = new THREE.Scene(); scene.background = new THREE.Color(lineArt ? 0xf1f3f4 : 0x071221); scene.fog = lineArt ? null : new THREE.FogExp2(0x14253e, .0105);
      camera = new THREE.PerspectiveCamera(43, 1, .2, 260); ortho = new THREE.OrthographicCamera(-51, 51, 34, -34, .2, 260); ortho.position.set(60, 62, 58); ortho.lookAt(V(0, 2, -2));
      if (!lineArt) { const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(renderer); envTarget = generator.fromScene(room, .04); scene.environment = envTarget.texture; scene.environmentIntensity = .42; room.dispose(); generator.dispose(); }
      scene.add(new THREE.HemisphereLight(0x9ed9fa, 0x132033, 2.15)); const moon = new THREE.DirectionalLight(0xa0c8ff, 3); moon.position.set(-22, 38, 12); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -38, right: 38, top: 36, bottom: -32, near: 1, far: 100 }); moon.shadow.bias = -.0006; moon.shadow.normalBias = .08; scene.add(moon);
      const rim = new THREE.DirectionalLight(0xffb56c, 2.1); rim.position.set(23, 16, -15); scene.add(rim); const hostKey = new THREE.PointLight(0x92e6ff, 26, 15, 2); hostKey.position.set(7, 6, 15); scene.add(hostKey);
      if (!lineArt) addAtmosphere(scene); props = buildProps(scene);
      const [world, character] = await Promise.all([loadGLB('district-world.glb', readAsset), loadGLB('district-host.glb', readAsset)]);
      if (disposed) { disposeGraph(world); disposeGraph(character); return diagnostics(); }
      let worldTriangles = 0, hostTriangles = 0;
      world.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; worldTriangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; } });
      character.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; hostTriangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; } });
      if (worldTriangles > 1200000 || hostTriangles > 150000) { disposeGraph(world); disposeGraph(character); throw new Error('Study asset geometry budget exceeded'); }
      scene.add(world); host = group(scene, 'HeroHost'); host.add(character); rig = captureRig(host); courier = character.clone(true); helper = character.clone(true); scene.add(courier, helper); courierRig = captureRig(courier); helperRig = captureRig(helper);
      faceRig=bindFace(rig.Head.node);
      state.assets = { world: { loaded: true, triangles: worldTriangles }, host: { loaded: true, triangles: hostTriangles } };
      if (lineArt) { makeLineArt(world); scene.children.filter(item => item.isPointLight).forEach(light => { light.intensity = 0; }); }
      else { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .15, .5, 1.4)); composer.addPass(new OutputPass()); }
      sensor=buildSensor(rig.Head.node);state.faceRig=faceRig.audit;state.sensor=sensor.audit;
      canvas.addEventListener('webglcontextlost', onLost); loaded = true; resize(); observer = new ResizeObserver(resize); observer.observe(container); return diagnostics();
    } catch (error) { fail(error); throw error; }
  })();
  // The externally returned object has a genuine readiness promise, while its
  // synchronous director methods can stage the first pose before assets arrive.
  return Object.freeze({ ...api, ready });
}

if (typeof window !== 'undefined') window.DistrictPerformanceStudy = Object.freeze({ mount, frames: FRAME_STATES });
