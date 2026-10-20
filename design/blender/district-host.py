"""Original District hovering service host; editable geometry, no borrowed assets.

Blender Z-up source exports to glTF Y-up, facing +Z, floor zero, height 3.
No offline render is performed. Any later Cycles render is configured GPU-only.
Run: D:/Blender/blender.exe --background --factory-startup --disable-autoexec
     --python-exit-code 17 --python <this file>
"""
import bpy
import hashlib
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GLB = ROOT / "app/assets/district-v2/district-host.glb"
BLEND = HERE / "district-host.blend"
PROVENANCE = HERE / "district-host.provenance.json"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
scene.cycles.samples = 32
scene.render.resolution_x = 3840
scene.render.resolution_y = 2160
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.world.color = (0.025, 0.035, 0.065)
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
devices = prefs.get_devices_for_type("OPTIX")
gpus = [d for d in devices if d.type == "OPTIX" and "NVIDIA" in d.name]
if not gpus:
    raise RuntimeError("NVIDIA OPTIX required; CPU rendering is forbidden.")
for device in prefs.devices:
    device.use = device.type == "OPTIX" and device.id in {d.id for d in gpus}
assert not any(d.use and d.type == "CPU" for d in prefs.devices)


def material(name, color, metal=0.0, rough=0.4, emission=0.0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1.0)
        shader.inputs["Emission Strength"].default_value = emission
    return result


pearl = material("Host | warm ceramic alloy", (0.72, 0.77, 0.72), 0.38, 0.31)
white = material("Host | pearl edge enamel", (0.91, 0.91, 0.79), 0.25, 0.27)
ink = material("Host | midnight structural alloy", (0.023, 0.038, 0.075), 0.72, 0.34)
violet = material("Host | anodized violet", (0.20, 0.095, 0.36), 0.62, 0.3)
copper = material("Host | copper hinge alloy", (0.51, 0.25, 0.09), 0.76, 0.32)
rubber = material("Host | soft joint bellows", (0.031, 0.047, 0.064), 0.04, 0.69)
face = material("Host | deep sapphire lens surround", (0.012, 0.055, 0.085), 0.34, 0.21)
cyan = material("Host | cyan optical emitter", (0.08, 0.85, 0.95), 0.25, 0.25, 2.3)
soft_cyan = material("Host | frosted cyan shell inlay", (0.12, 0.58, 0.65), 0.3, 0.35, 0.7)
amber = material("Host | amber service beacon", (1.0, 0.39, 0.08), 0.2, 0.28, 2.0)
lilac = material("Host | violet core light", (0.54, 0.24, 0.98), 0.2, 0.26, 1.8)
glint = material("Host | lens catchlight", (0.80, 1.0, 0.98), 0.0, 0.3, 3.0)


def empty(name, point=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = point
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.2
    if parent:
        obj.parent = parent
    return obj


host = empty("HostRoot")
head = empty("Head", (0, 0, 2.31), host)
arm_l = empty("ArmL", (-0.80, 0, 1.88), host)
arm_r = empty("ArmR", (0.80, 0, 1.88), host)
core = empty("Core", (0, 0.03, 0.48), host)
bpy.context.view_layer.update()
parts = {host: [], head: [], arm_l: [], arm_r: [], core: []}


def finish(obj, name, mat, group=host, bevel=0.0, smooth=False):
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft machined edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.affect = "EDGES"
        obj.modifiers.new("Weighted surface normals", "WEIGHTED_NORMAL")
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    world = obj.matrix_world.copy()
    obj.parent = group
    obj.matrix_world = world
    parts[group].append(obj)
    return obj


def box(name, point, size, mat, group=host, bevel=0.035, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point, rotation=rotation)
    obj = bpy.context.object
    obj.dimensions = size
    return finish(obj, name, mat, group, bevel)


def ellipsoid(name, point, size, mat, group=host, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=point)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name, mat, group, smooth=True)


def cylinder(name, point, radius, depth, mat, group=host, axis=(0, 0, 1), vertices=32, bevel=0.018):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=point)
    obj = bpy.context.object
    obj.rotation_euler = Vector(axis).to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, mat, group, bevel)


def link(name, start, end, radius, mat, group, vertices=20):
    a, b = Vector(start), Vector(end)
    return cylinder(name, (a + b) * 0.5, radius, (b - a).length, mat, group, b - a, vertices)


def torus(name, point, major, minor, mat, group=host, rotation=(0, 0, 0), segments=40):
    bpy.ops.mesh.primitive_torus_add(major_segments=segments, minor_segments=8,
                                   location=point, major_radius=major, minor_radius=minor,
                                   rotation=rotation)
    return finish(bpy.context.object, name, mat, group, smooth=True)


def tube(name, points, radius, mat, group=host):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for dest, src in zip(spline.points, points):
        dest.co = (*src, 1)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return finish(obj, name, mat, group, smooth=True)


def loft(name, rings, mat, group=host, sides=48):
    # Elliptical ring mesh supplies a deliberate swept shell, not a stock box.
    verts, faces = [], []
    for z, rx, ry, cy in rings:
        for i in range(sides):
            angle = 2 * math.pi * i / sides
            verts.append((rx * math.cos(angle), cy + ry * math.sin(angle), z))
    for j in range(len(rings) - 1):
        for i in range(sides):
            faces.append((j*sides+i, j*sides+(i+1)%sides,
                          (j+1)*sides+(i+1)%sides, (j+1)*sides+i))
    faces.extend([tuple(reversed(range(sides))), tuple((len(rings)-1)*sides+i for i in range(sides))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return finish(obj, name, mat, group, smooth=True)


# Body: tapered buoyant torso, layered shoulders and open illuminated belly.
loft("Body | swept ceramic carapace", [(0.65,.30,.26,.07),(.82,.48,.34,.07),
     (1.12,.61,.40,.05),(1.63,.70,.42,.04),(1.91,.62,.37,.04),(2.05,.42,.29,.03)], pearl)
loft("Body | midnight shoulder collar", [(1.83,.65,.40,.03),(1.96,.74,.43,.03),
     (2.08,.61,.36,.03),(2.15,.35,.24,.03)], ink)
loft("Body | pearl shoulder crown", [(1.99,.65,.37,.03),(2.09,.61,.34,.03),
     (2.16,.37,.23,.03)], white)
box("Body | recessed chest shield", (0,-.363,1.51), (.92,.18,.64), ink, bevel=.16)
box("Body | violet chest insert", (0,-.464,1.52), (.66,.075,.39), violet, bevel=.105)
box("Body | copper service latch", (0,-.512,1.45), (.29,.035,.07), copper, bevel=.017)
for x in (-.38,.38):
    box("Body | chest cyan seam", (x,-.47,1.53), (.035,.035,.36), soft_cyan, bevel=.012)
    cylinder("Body | tactile collar bolt", (x,-.38,1.99), .038,.025,copper,axis=(0,-1,0),vertices=12,bevel=.006)
for z in (1.15,1.25):
    box("Body | lower cooling slit", (0,-.355,z), (.32,.035,.028), ink, bevel=.008)
# A simple original three-dot service mark, physical studs rather than text/logo.
for x, z in ((-.09,1.65),(.01,1.65),(.11,1.65)):
    cylinder("Body | service status stud", (x,-.514,z), .021,.018,amber,axis=(0,-1,0),vertices=12,bevel=.004)
box("Body | rear battery spine", (0,.398,1.43), (.55,.29,.85), ink, bevel=.12)
for z in (1.14,1.39,1.64):
    box("Body | rear battery cartridge", (0,.56,z), (.41,.13,.15), violet, bevel=.035)
    box("Body | cartridge amber indicator", (.14,.63,z), (.045,.016,.055), amber, bevel=.008)
for side in (-1,1):
    box("Body | flank layered cheek", (side*.54,.025,1.17), (.16,.55,.44), violet, bevel=.07,
        rotation=(0,side*-.16,0))
    tube("Body | copper circulation line", [(side*.41,.35,1.82),(side*.55,.39,1.56),
         (side*.44,.36,1.04)], .027,copper)
    box("Body | hip service patch", (side*.47,-.23,1.03), (.12,.10,.21), white, bevel=.035)
cylinder("Body | neck ceramic piston", (0,.01,2.17), .19,.32,copper)
torus("Body | neck dark bearing", (0,.01,2.25), .19,.045,ink)

# Low hovering core: tapered impeller, exposed layered power rings, three vanes.
loft("Core | conical impeller housing", [(.00,.10,.10,.03),(.12,.19,.19,.03),
     (.30,.28,.28,.03),(.54,.33,.31,.03),(.73,.31,.28,.03)], ink, core, sides=32)
cylinder("Core | luminous turbine rim", (0,.03,.32), .275,.08,cyan,core)
torus("Core | copper protection ring", (0,.03,.43), .32,.045,copper,core)
torus("Core | violet upper impeller", (0,.03,.60), .31,.045,lilac,core)
for angle in (30,150,270):
    radians = math.radians(angle)
    x,y = .30*math.cos(radians), .03+.30*math.sin(radians)
    box("Core | ceramic stabilizer vane", (x,y,.47), (.12,.26,.40), pearl,core,.045,
        rotation=(0,0,radians-math.pi/2))
    box("Core | vane light", (x*1.12,.03+(y-.03)*1.12,.42), (.035,.17,.10), soft_cyan,core,.014,
        rotation=(0,0,radians-math.pi/2))

# Head: wide swept shell with separate cheek/jaw panels and recessed optical face.
loft("Head | sculpted indigo under-shell", [(2.28,.43,.26,0),(2.35,.65,.37,0),
     (2.64,.73,.41,.015),(2.81,.61,.34,.025),(2.88,.37,.23,.035)], ink,head)
loft("Head | floating pearl crown", [(2.64,.72,.40,.025),(2.76,.68,.38,.03),
     (2.88,.51,.30,.04),(2.92,.24,.16,.045)], pearl,head)
box("Head | sculpted sapphire face recess", (0,-.351,2.54), (1.16,.18,.40), face,head,.15)
box("Head | pearl lower jaw", (0,-.315,2.30), (.92,.19,.12), white,head,.055)
for side in (-1,1):
    box("Head | violet temple armor", (side*.65,.025,2.52), (.19,.45,.32), violet,head,.07,
        rotation=(0,side*.11,side*.08))
    cylinder("Head | copper temple pivot", (side*.747,.02,2.54), .096,.045,copper,head,axis=(1,0,0),vertices=24)
    cylinder("Head | temple beacon", (side*.775,.02,2.54), .047,.052,amber,head,axis=(1,0,0),vertices=20,bevel=.008)
    for z in (2.43,2.50,2.57):
        box("Head | rear temple vent", (side*.54,.335,z), (.16,.035,.018), rubber,head,.005)
# Distinct optical sockets: a round main lens and a subtly squashed companion.
for x,z,r,companion in ((-.255,2.56,.176,False),(.255,2.56,.156,True)):
    cylinder("Head | optical socket shadow", (x,-.454,z), r+.052,.075,ink,head,axis=(0,-1,0))
    torus("Head | machined copper optical bezel", (x,-.501,z), r+.016,.023,copper,head,
          rotation=(math.pi/2,0,0),segments=40)
    cylinder("Head | sapphire optical glass", (x,-.503,z), r,.027,face,head,axis=(0,-1,0),vertices=40,bevel=.01)
    torus("Head | cyan iris ring", (x+.013,-.523,z+.009), r*.63,.018,cyan,head,
          rotation=(math.pi/2,0,0),segments=36)
    cylinder("Head | expressive dark pupil", (x+.013,-.527,z+.009), r*.40,.012,ink,head,axis=(0,-1,0),vertices=32,bevel=.005)
    ellipsoid("Head | lens catchlight", (x-.040,-.540,z+.064), (.023,.008,.030),glint,head,segments=16,rings=8)
    brow = box("Head | friendly raised brow", (x,-.463,z+r+.065), (r*1.65,.07,.052),white,head,.023,
               rotation=(0,math.radians(7 if x<0 else -7),0))
# Gentle luminous smile curve, a narrow physical inlay rather than a face screen.
tube("Head | soft service smile", [(-.18,-.429,2.358),(-.09,-.449,2.339),
     (0,-.454,2.333),(.09,-.449,2.339),(.18,-.429,2.358)], .012,soft_cyan,head)
box("Head | asymmetric small antenna foot", (-.42,.10,2.85), (.16,.17,.09),violet,head,.035)
link("Head | short copper antenna", (-.42,.10,2.89),(-.49,.12,2.985),.018,copper,head,12)
ellipsoid("Head | amber antenna tip", (-.49,.12,2.985), (.04,.04,.04),amber,head,segments=16,rings=8)

# Arms: shoulder pivots, exposed twin links, layered forearms, open soft grippers.
for side,group in ((-1,arm_l),(1,arm_r)):
    shoulder = (side*.81,0,1.88)
    elbow = (side*1.10,-.015,1.50)
    wrist = (side*1.17,-.31,1.12)
    ellipsoid("Arm | rubber shoulder bearing",shoulder,(.22,.22,.22),rubber,group,segments=24,rings=12)
    cylinder("Arm | copper shoulder axis",(side*.91,0,1.88),.15,.20,copper,group,axis=(1,0,0),vertices=24)
    box("Arm | pearl shoulder petal",(side*.94,.025,1.95),(.26,.39,.29),pearl,group,.09,
        rotation=(0,side*.28,0))
    link("Arm | upper midnight spar",shoulder,elbow,.105,ink,group)
    for y in (-.095,.095):
        link("Arm | copper parallel tendon",(side*.83,y,1.82),(side*1.08,y-.015,1.52),.028,copper,group,12)
    ellipsoid("Arm | violet elbow bearing",elbow,(.15,.16,.15),violet,group,segments=24,rings=12)
    cylinder("Arm | elbow face pin",(side*1.10,-.18,1.50),.07,.045,amber,group,axis=(0,-1,0),vertices=20,bevel=.01)
    link("Arm | ceramic forearm sleeve",elbow,wrist,.135,pearl,group,24)
    link("Arm | forearm cyan accent",(side*1.11,-.115,1.44),(side*1.17,-.36,1.17),.024,soft_cyan,group,12)
    ellipsoid("Arm | soft wrist joint",wrist,(.12,.12,.12),rubber,group,segments=20,rings=12)
    palm = (side*1.18,-.38,.99)
    box("Arm | layered open palm",palm,(.24,.16,.22),violet,group,.055,rotation=(.16,side*.11,0))
    box("Arm | pearl hand back",(side*1.18,-.287,1.00),(.20,.04,.15),white,group,.03)
    for dx in (-.065,.065):
        a=(side*1.18+dx,-.395,.91)
        b=(side*1.18+dx,-.46,.82)
        c=(side*1.18+dx,-.515,.845)
        link("Arm | rounded service finger",a,b,.038,pearl,group,12)
        ellipsoid("Arm | soft finger knuckle",b,(.039,.039,.039),rubber,group,segments=12,rings=8)
        link("Arm | curled soft fingertip",b,c,.033,white,group,12)
    link("Arm | thumb root",(side*1.28,-.38,1.02),(side*1.34,-.43,.94),.041,pearl,group,12)
    link("Arm | inward thumb pad",(side*1.34,-.43,.94),(side*1.31,-.49,.90),.034,white,group,12)
    for y in (.01,.08):
        box("Arm | shoulder maintenance seam",(side*1.071,y,1.97),(.018,.023,.10),ink,group,.004)

# Normalize geometry and pivots together. The source stays Z-up; GLB uses Y-up.
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
points = []
for obj in bpy.data.objects:
    if obj.type == "MESH":
        evaluated = obj.evaluated_get(depsgraph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
minimum = min(p.z for p in points)
maximum = max(p.z for p in points)
scale = 3.0 / (maximum - minimum)
host.scale = (scale, scale, scale)
host.location.z = -minimum * scale
bpy.context.view_layer.update()

# Apply bevels, then consolidate each rig group into a single mesh with material
# primitives. Exact rig names remain as empties; individual parts stay editable
# as disconnected mesh islands with their authored material slots.
source_object_count = sum(len(p) for p in parts.values())
for group, objects in parts.items():
    for obj in objects:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = group.name + "_Surfaces"
    # Remove duplicate material slots created by joining, preserving indices.
    original = list(merged.data.materials)
    unique = []
    for mat in original:
        if mat not in unique:
            unique.append(mat)
    remap = {i:unique.index(mat) for i,mat in enumerate(original)}
    indices = [remap[poly.material_index] for poly in merged.data.polygons]
    merged.data.materials.clear()
    for mat in unique:
        merged.data.materials.append(mat)
    for poly,index in zip(merged.data.polygons,indices):
        poly.material_index = index

bpy.context.view_layer.update()
triangles = 0
vertices = 0
all_points = []
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
        all_points.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
assert triangles <= 40000, f"Triangle budget exceeded: {triangles}"
assert len([o for o in bpy.data.objects if o.type == "MESH"]) == 5
blender_min = [min(p[i] for p in all_points) for i in range(3)]
blender_max = [max(p[i] for p in all_points) for i in range(3)]
gltf_min = [blender_min[0],blender_min[2],-blender_max[1]]
gltf_max = [blender_max[0],blender_max[2],-blender_min[1]]
assert abs(gltf_min[1]) < .00001
assert abs(gltf_max[1] - 3) < .00001
host["design_role"] = "Original hovering construction and service companion; illustrative host, never agent work status"
host["front_axis"] = "+Z in exported glTF"
host["runtime_animation"] = "Rotate named groups modestly; pulse Core child emissive material; hover HostRoot"
host["asset_version"] = "district-host-1"
for group in (head,arm_l,arm_r,core):
    group["animation_pivot"] = True

# Save an immediately editable model. No camera, environment, embedded program,
# texture file or animation is required by the runtime.
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = host
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True)
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB", export_yup=True,
    export_apply=True, export_animations=False, export_materials="EXPORT",
    export_cameras=False, export_lights=False, export_extras=True,
    export_texcoords=False, export_normals=True, export_tangents=False)

export_bytes = GLB.read_bytes()
export_json_length = struct.unpack_from("<I", export_bytes, 12)[0]
export_doc = json.loads(export_bytes[20:20+export_json_length])
assert all("uri" not in buf for buf in export_doc.get("buffers", []))
assert not export_doc.get("images") and not export_doc.get("textures")
assert len(export_doc.get("materials", [])) == 12


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


provenance = {
    "schemaVersion":1,
    "asset":"app/assets/district-v2/district-host.glb",
    "title":"District service host",
    "status":"exported; runtime artistic acceptance remains owner judgment",
    "originality":{
        "method":"Original scripted Blender geometry authored for District; no reference asset imported",
        "design":"Swept pearl carapace, indigo optical face, copper articulated utility arms, open service grippers, conical hovering core with three stabilizer vanes",
        "resources":"Embedded PBR colors, normals and emissive materials only; no external textures, logos, text, audio or executable logic",
        "capabilityHonesty":"Character is an illustrative host. Animation carries no provider, operation, progress or completion claim"
    },
    "source":{"script":"design/blender/district-host.py","blend":"design/blender/district-host.blend",
              "scriptSha256":sha(Path(__file__)),"blendSha256":sha(BLEND)},
    "export":{"tool":"Blender","version":bpy.app.version_string,
              "format":"glTF 2.0 GLB","sha256":sha(GLB),"bytes":GLB.stat().st_size,
              "upAxis":"Y","frontAxis":"+Z","floor":0,"height":3,
              "bounds":{"min":gltf_min,"max":gltf_max},
              "triangles":triangles,"sourceVertices":vertices,"meshNodes":5,
              "materialCount":len(export_doc.get("materials", [])),"sourcePartCount":source_object_count,
              "primitiveDraws":sum(len(mesh.get("primitives", [])) for mesh in export_doc.get("meshes", [])),
              "embeddedBuffers":len(export_doc.get("buffers", [])),"externalResources":0,
              "triangleBudget":40000,"animations":0},
    "rig":{"root":"HostRoot","directChildren":["Head","ArmL","ArmR","Core"],
           "semantics":{"Head":"neck pivot; gentle look and nod","ArmL":"left shoulder pivot",
                        "ArmR":"right shoulder pivot","Core":"power impeller pivot; rotate subtly or pulse emissive child material"},
           "coordinateNote":"Blender source Z-up and forward -Y; exporter converts to runtime Y-up and forward +Z",
           "recommendation":"Small idle oscillations only; do not bind personality animation to invented productivity"},
    "rendering":{"offlineRenderPerformed":False,
                 "runtime":"GPU WebGL2 renderer owned by Scene16",
                 "editableSceneRenderEngine":"CYCLES GPU OPTIX",
                 "enabledGpuDevices":[d.name for d in gpus],
                 "cpuRenderDevicesEnabled":False,
                 "note":"Geometry generation and export are CPU tasks; no CPU rasterization or offline light transport used"},
    "audit":{"sourceBoundsFinite":all(math.isfinite(x) for x in gltf_min+gltf_max),
             "heightAndFloorAsserted":True,"triangleBudgetAsserted":True,
             "namedGroupsDirectUnderRoot":all(group.parent==host for group in (head,arm_l,arm_r,core)),
             "runtimeVisualValidation":"pending parent 4K isolated-display integration"}
}
PROVENANCE.write_text(json.dumps(provenance,indent=2)+"\n",encoding="utf-8")
print("DISTRICT_HOST_READY="+json.dumps(provenance["export"]))
