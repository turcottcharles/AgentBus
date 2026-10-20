"""Editable Preview portal. Geometry is scripted; Cycles rendering is GPU-only.

Run in a hidden owned background Blender process, never against an open scene:
  D:/Blender/blender.exe --background --factory-startup --python <this file>
The script refuses CPU rendering and does not save Blender user preferences.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PNG = ROOT / "app/assets/district-v2/preview-portal.png"
BLEND = HERE / "preview-portal.blend"
PROVENANCE = HERE / "preview-portal.provenance.json"

# Fail closed before any render. The CPU entry may be enumerated, never enabled.
prefs = bpy.context.preferences.addons["cycles"].preferences
backend = None
gpu = []
for candidate in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = candidate
        candidates = prefs.get_devices_for_type(candidate)
        gpu = [d for d in candidates if d.type == candidate and "NVIDIA" in d.name]
        if gpu:
            backend = candidate
            break
    except Exception:
        continue
if not backend or not gpu:
    raise RuntimeError("No NVIDIA Cycles GPU is available. CPU fallback is forbidden.")
for device in prefs.devices:
    device.use = device.type == backend and device.id in {d.id for d in gpu}
if any(d.use and d.type == "CPU" for d in prefs.devices):
    raise RuntimeError("CPU device unexpectedly enabled; refusing render.")
print("DISTRICT_GPU_ONLY=" + json.dumps({"backend": backend, "devices": [d.name for d in gpu]}))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
scene.cycles.samples = 96
scene.cycles.use_denoising = False
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.04
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 2
scene.cycles.transmission_bounces = 1
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.use_compositing = False
scene.render.use_sequencer = False
scene.render.filepath = str(PNG)
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.world.color = (0.035, 0.045, 0.08)
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.12, 0.16, 0.25, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass


def mat(name, color, metallic=0.0, roughness=0.55, emission=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = emission
    return material


ink = mat("Ink · structural steel", (0.035, 0.05, 0.085), 0.55, 0.5)
slate = mat("Slate · painted armor", (0.21, 0.26, 0.34), 0.35, 0.6)
edge = mat("Lavender-grey · edge plates", (0.34, 0.32, 0.43), 0.25, 0.55)
deck = mat("Platform · warm concrete", (0.25, 0.27, 0.30), 0.05, 0.85)
teal = mat("Teal · portal light", (0.12, 0.82, 0.89), 0.15, 0.3, 3.2)
amber = mat("Amber · service lamps", (1.0, 0.43, 0.10), 0.15, 0.4, 2.5)
brass = mat("Copper · conduit", (0.33, 0.19, 0.12), 0.65, 0.45)
glass = mat("Portal · inactive display backing", (0.015, 0.065, 0.09), 0.2, 0.3, 0.12)
white = mat("Header · pale cyan lettering", (0.55, 0.95, 0.98), 0.0, 0.5, 0.8)


def box(name, location, scale, material, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Machined edge bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj


def cylinder(name, location, radius, depth, material, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Rounded rim", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


# Small autonomous structure: a real model, with no fake browser screenshot.
box("Grounding · ink foundation", (0, 0, 0.10), (2.9, 2.10, 0.20), ink, 0.12)
box("Grounding · raised deck", (0, 0, 0.24), (2.78, 2.00, 0.20), deck, 0.10)
box("Front step", (0, -1.03, 0.17), (1.35, 0.42, 0.20), slate, 0.06)
box("Step inlay", (0, -1.23, 0.24), (1.13, 0.035, 0.025), amber, 0.008)

for x in (-0.98, 0.98):
    side = "Left" if x < 0 else "Right"
    box(side + " · column shadow", (x, 0.22, 1.13), (0.44, 0.75, 1.70), ink, 0.07)
    box(side + " · column shell", (x, 0.15, 1.14), (0.34, 0.66, 1.65), slate, 0.05)
    box(side + " · foot armor", (x, 0.12, 0.51), (0.48, 0.82, 0.36), edge, 0.05)
    box(side + " · cyan aperture rail", (x * 0.82, -0.225, 1.13), (0.045, 0.035, 1.38), teal, 0.012)
    for z in (0.79, 1.42):
        box(side + " · bolted collar", (x, -0.205, z), (0.36, 0.10, 0.12), edge, 0.015)
        box(side + " · amber bolt", (x, -0.268, z), (0.065, 0.022, 0.045), amber, 0.008)

box("Portal · backing frame", (0, 0.33, 1.14), (1.70, 0.20, 1.51), ink, 0.08)
box("Portal · dark unbound pane", (0, 0.205, 1.14), (1.49, 0.035, 1.30), glass, 0.045)
for z in (0.45, 1.81):
    box("Portal · aperture cross rail", (0, -0.225, z), (1.64, 0.035, 0.045), teal, 0.012)
box("Header · structural cap", (0, 0.15, 2.03), (2.55, 0.96, 0.41), ink, 0.09)
box("Header · slate roof", (0, 0.16, 2.10), (2.45, 0.89, 0.29), edge, 0.07)
box("Header · inset sign", (0, -0.355, 2.03), (1.76, 0.06, 0.27), ink, 0.03)
bpy.ops.object.text_add(location=(0, -0.393, 1.963), rotation=(math.radians(90), 0, 0))
title = bpy.context.object
title.name = "Header · PREVIEW editable text"
title.data.body = "PREVIEW"
title.data.align_x = "CENTER"
title.data.size = 0.185
title.data.extrude = 0.004
title.data.materials.append(white)

for x in (-0.88, 0.88):
    cylinder("Roof · service hub", (x, 0.22, 2.30), 0.17, 0.15, ink)
    cylinder("Roof · cyan cap", (x, 0.22, 2.385), 0.115, 0.025, teal)
for x in (-0.40, 0, 0.40):
    box("Roof · cooling fin", (x, 0.28, 2.31), (0.16, 0.37, 0.10), slate, 0.02)

# Service cabinet, physical conduit, a compact control console and deck studs.
box("Left · service cabinet", (-1.29, 0.45, 0.78), (0.34, 0.57, 0.90), ink, 0.04)
for z in (0.63, 0.85, 1.07):
    box("Left · cabinet plate", (-1.30, 0.14, z), (0.29, 0.055, 0.14), slate, 0.015)
    box("Left · service indicator", (-1.30, 0.105, z), (0.17, 0.02, 0.022), amber, 0.005)
for x in (-1.31, 1.31):
    cylinder("Side · copper conduit", (x, 0.65, 1.29), 0.045, 1.62, brass)
    for z in (0.74, 1.52):
        cylinder("Side · conduit collar", (x, 0.65, z), 0.075, 0.07, ink)
box("Console · pedestal", (0.94, -0.80, 0.60), (0.26, 0.27, 0.64), ink, 0.04)
console = box("Console · tilted housing", (0.94, -0.87, 0.96), (0.45, 0.35, 0.17), edge, 0.035)
console.rotation_euler.x = math.radians(18)
screen = box("Console · diagnostic surface", (0.94, -0.92, 1.055), (0.32, 0.22, 0.02), teal, 0.015)
screen.rotation_euler.x = math.radians(18)
for x in (-1.19, 1.19):
    for y in (-0.81, 0.83):
        cylinder("Deck · anchor stud", (x, y, 0.37), 0.055, 0.05, brass, 8)


def area(name, location, color, energy, size, target):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.color = color
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (Vector(target) - light.location).to_track_quat("-Z", "Y").to_euler()


area("Warm window key", (-3.5, -4.5, 6.0), (1.0, 0.64, 0.32), 530, 4.0, (0, 0, 1))
area("Cool district fill", (4.5, -1.0, 4.0), (0.28, 0.67, 1.0), 390, 3.0, (0, 0, 1))
area("Violet roof rim", (-1.0, 4.0, 5.0), (0.64, 0.43, 1.0), 460, 3.0, (0, 0, 1))
area("Portal floor spill", (0, -0.34, 1.20), (0.12, 0.87, 1.0), 28, 0.9, (0, -0.85, 0.3))
bpy.ops.object.camera_add(location=(6.0, -8.0, 6.8))
camera = bpy.context.object
camera.name = "Camera · isometric preview facility"
target = Vector((0, 0, 1.04))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 4.55
scene.camera = camera

scene["district_role"] = "Preview locator; never a rendered candidate screenshot or execution verdict."
scene["gpu_only"] = True
scene["render_backend"] = backend
scene["render_devices"] = ", ".join(d.name for d in gpu)
scene["camera_note"] = "Orthographic, elevated three-quarter; approved district plate remains unchanged."
scene["rebuild_source"] = "design/blender/create-preview-portal.py"
PNG.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), check_existing=False)

# Blender throws on unavailable GPU/kernel failure; there is no retry to CPU.
if scene.cycles.device != "GPU":
    raise RuntimeError("GPU render setting lost; refusing render.")
bpy.ops.render.render(write_still=True)
base_point = world_to_camera_view(scene, camera, Vector((0, 0, 0.10)))
provenance = {
    "version": 1,
    "blender": bpy.app.version_string,
    "build_hash": bpy.app.build_hash.decode(),
    "engine": "CYCLES",
    "device": scene.cycles.device,
    "backend": backend,
    "devices": [{"name": d.name, "id": d.id, "type": d.type} for d in gpu],
    "cpu_devices_enabled": [d.name for d in prefs.devices if d.use and d.type == "CPU"],
    "denoising": False,
    "compositing": False,
    "resolution": [1024, 1024],
    "samples": 96,
    "transparent": True,
    "camera": {"type": "ORTHO", "location": list(camera.location), "target": list(target), "scale": 4.55},
    "anchor": {"kind": "ground/base-center", "world": [0, 0, 0.10], "normalized_x": base_point.x, "normalized_y": 1 - base_point.y, "note": "Normalized image coordinates measured from upper left. Align this point to landing-pad base center."},
    "files": {},
    "scope": "This is a static 3D facility locator. It does not show or validate an actual software preview.",
}
for path in (Path(__file__), BLEND, PNG):
    content = path.read_bytes()
    provenance["files"][path.relative_to(ROOT).as_posix()] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
PROVENANCE.write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
print("DISTRICT_RENDER_COMPLETE=" + json.dumps({"png": str(PNG), "blend": str(BLEND), "backend": backend, "cpu_enabled": False}))
