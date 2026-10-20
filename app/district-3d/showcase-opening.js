import * as THREE from 'three';
import { createHostThrusters } from './host-thrusters.js';

const ease = (a, b, time) => THREE.MathUtils.smoothstep(time, a, b);
const mix = THREE.MathUtils.lerp;
const DURATION = 12;
export const OPENING_SHOTS = Object.freeze([
  Object.freeze({ id: 'M01', start: 0, end: 2.5, title: 'Ignition' }),
  Object.freeze({ id: 'M02', start: 2.5, end: 4.2, title: 'Precise machinery' }),
  Object.freeze({ id: 'M03', start: 4.2, end: 6.2, title: 'Controlled stop' }),
  Object.freeze({ id: 'M04', start: 6.2, end: 12, title: 'Someone helpful' })
]);

// The approved twelve-second performance, sampled by the owning world. This
// controller has no clock, renderer, asset loader, work command or audio path.
export function createShowcaseOpening({ scene, hostGroup, joints, actor, camera, lights = {} }) {
  if (!scene?.add || !hostGroup?.position || !camera?.position) throw new TypeError('Opening requires the existing scene, host and camera');
  const rig = joints instanceof Map ? joints : new Map();
  const lamps = lights || {};
  const warmKey = new THREE.PointLight(0xffd8a6, 0, 14, 2); warmKey.name = 'OpeningWarmFaceKey'; warmKey.position.set(7.5, 6.5, 15); scene.add(warmKey);
  const thrusters = createHostThrusters({ hostGroup, scene });
  const targetVector = new THREE.Vector3(), opticalWorld = new THREE.Vector3(), cameraWorld = new THREE.Vector3(), normal = new THREE.Vector3(), orientation = new THREE.Quaternion();
  let disposed = false, last = null;
  const lamp = (name, intensity) => { if (lamps[name] && typeof lamps[name].intensity === 'number') lamps[name].intensity = intensity; };
  function setMood(value = 1) {
    if (disposed) return { disposed: true, exposure: last?.lighting.exposure ?? .8 };
    const welcome = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 1;
    const lighting = { welcome, ambient: mix(.55, 1.5, welcome), key: mix(1.15, 2.1, welcome), rim: mix(.7, 1.7, welcome), practical: mix(3, 6, welcome), warmKeyIntensity: welcome * 14,
      environmentIntensity: mix(.16, .30, welcome), exposure: mix(.62, .8, welcome), missing: ['ambient', 'key', 'rim', 'practical'].filter(name => !lamps[name] || typeof lamps[name].intensity !== 'number') };
    for (const name of ['ambient', 'key', 'rim', 'practical']) lamp(name, lighting[name]);
    warmKey.intensity = lighting.warmKeyIntensity; scene.environmentIntensity = lighting.environmentIntensity;
    return lighting;
  }
  function pose(seconds = 0, { reducedMotion = false } = {}) {
    if (disposed) return { disposed: true, duration: DURATION };
    const requested = Number(seconds), time = reducedMotion ? DURATION : Number.isFinite(requested) ? THREE.MathUtils.clamp(requested, 0, DURATION) : requested === Infinity ? DURATION : 0;
    const shot = OPENING_SHOTS.find(item => time >= item.start && time < item.end) || OPENING_SHOTS[OPENING_SHOTS.length - 1];
    for (const joint of rig.values()) { if (joint.rotation) joint.node.rotation.copy(joint.rotation); if (joint.scale) joint.node.scale.copy(joint.scale); }
    const stop = ease(.25, 1.1, time), settle = time < 4.2 && !reducedMotion ? Math.sin(time * 4) * .025 * Math.exp(-time * .9) : 0;
    const ignition = reducedMotion ? 0 : ease(.2, .45, time) * (1 - ease(1.1, 2.15, time));
    const power = .10 + .90 * ignition, welcome = ease(6.2, 7.5, time);
    const lighting = setMood(welcome);
    hostGroup.position.set(5, .95 + settle + .24 * ignition, 10.8 + 1.2 * stop); hostGroup.rotation.set(0, .45, 0);
    const core = rig.get('Core'), armR = rig.get('ArmR'), armL = rig.get('ArmL'), head = rig.get('Head');
    if (core) core.node.rotation.y += .9 * (1 - Math.exp(-time * 1.4)) + .05 * time;
    if (armR) { armR.node.rotation.x -= .12 * (1 - ease(2.5, 3.5, time)); armR.node.rotation.z -= .035 * ease(2.5, 3.3, time); }
    if (armL) armL.node.rotation.z += .035;
    const question = ease(6.65, 7.25, time) * (1 - ease(9.1, 10, time));
    if (head) { head.node.rotation.y += .22 * ease(6.95, 8.2, time); head.node.rotation.z -= .075 * question; head.node.rotation.x += .035 * Math.sin(ease(10.8, 12, time) * Math.PI); }
    const facePose = { aimX: .025 * ease(6.65, 6.8, time), aimY: .008 * question, browL: .032 * question, browR: .005 * question, rollL: .1 * question, rollR: -.025 * question };
    const sensorPose = { extension: ease(9, 9.8, time), open: ease(9.5, 10.4, time), scanYaw: time < 10.4 ? 0 : mix(Math.sin((time - 10.4) * 8) * .2, -.3, ease(11.2, 11.65, time)), scanPitch: -.12, locked: time >= 11.65 };
    actor?.face?.pose?.(facePose); actor?.sensor?.pose?.(sensorPose);
    let position, target, fov;
    if (shot.id === 'M01') { const u = ease(0, 2.5, time); position = [mix(6.5, 6.15, u), mix(1.25, 1.4, u), mix(13.65, 13.45, u)]; target = [5, 1.62, hostGroup.position.z]; fov = 38; }
    else if (shot.id === 'M02') { const u = ease(2.5, 4.2, time); position = [mix(7.8, 7.55, u), 3.8, 12.4]; target = [6.32, 4.0, 11.36]; fov = 32; }
    else if (shot.id === 'M03') { const u = ease(4.2, 6.2, time); position = [3.2, mix(1.8, 3.25, u), 9.3]; target = [5, mix(2.1, 3.4, u), 12]; fov = 42; }
    else { const u = ease(6.2, 12, time); position = [mix(8.9, 8.5, u), mix(5.15, 5.5, u), mix(12.4, 14.3, u)]; target = [5, mix(5.05, 5.25, u), 12]; fov = mix(38, 46, ease(8.7, 10.4, time)); }
    // The worker stays at its district scale even in the macro reveal. Bring
    // the lens closer instead of enlarging the robot relative to its city.
    const lensScale = hostGroup.scale.x / 1.65, pivot = [5, .95, 12];
    position = position.map((value, index) => pivot[index] + (value - pivot[index]) * lensScale);
    target = target.map((value, index) => pivot[index] + (value - pivot[index]) * lensScale);
    camera.position.set(...position); camera.fov = fov; camera.lookAt(targetVector.set(...target)); camera.updateProjectionMatrix(); camera.updateWorldMatrix(true, false); hostGroup.updateWorldMatrix(true, true);
    const thrust = thrusters.pose(time, power, { reducedMotion });
    // Frustum/front-facing probes describe staging, not a GPU occlusion proof.
    camera.getWorldPosition(cameraWorld); (head?.node || hostGroup).getWorldQuaternion(orientation); normal.set(0, 0, 1).applyQuaternion(orientation);
    let inFrame = false, frontFacing = false;
    for (const x of [-.26, .26]) {
      opticalWorld.set(x, 2.56, .53).applyMatrix4(hostGroup.matrixWorld); frontFacing ||= normal.dot(targetVector.copy(cameraWorld).sub(opticalWorld)) > .02;
      const point = opticalWorld.clone().project(camera); inFrame ||= point.x > -1 && point.x < 1 && point.y > -1 && point.y < 1 && point.z > -1 && point.z < 1;
    }
    last = { duration: DURATION, requestedSeconds: Number.isFinite(requested) ? requested : null, seconds: time, shotId: shot.id, complete: time >= DURATION, reducedMotion: !!reducedMotion,
      camera: { position, target, fov }, hostPosition: hostGroup.position.toArray(), hostRotation: hostGroup.rotation.toArray().slice(0, 3),
      faceVisible: inFrame && frontFacing, faceVisibility: { inFrame, frontFacing, method: 'Optics frustum and front-facing probes; native occlusion/artistic qualification remains required' },
      facePose, sensorPose, face: actor?.face?.audit || null, sensor: actor?.sensor?.audit || null, lighting, thrustPower: power, thrusters: thrust,
      handoff: { position: hostGroup.position.toArray(), quaternion: hostGroup.quaternion.toArray(), camera: { position: [...position], target: [...target], fov }, joints: Object.fromEntries([...rig].map(([name, value]) => [name, { rotation: value.node.rotation.toArray().slice(0, 3), scale: value.node.scale.toArray() }])) },
      audit: { presentationOnly: true, duration: DURATION, timers: 0, ownsRenderer: false, loadsAssets: false, sourceHostModified: false, muted: true } };
    return last;
  }
  function destroy() { if (disposed) return; disposed = true; thrusters.destroy(); warmKey.removeFromParent(); }
  return { duration: DURATION, pose, setMood, thrusters, diagnostics: () => last, destroy };
}
