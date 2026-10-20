"""Six-second toy-commercial assembly. GPU-only OptiX path tracing/denoising."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FRAMES = HERE / 'attract-portal-reveal-frames'
FRAMES.mkdir(exist_ok=True)
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
devices = prefs.get_devices_for_type('OPTIX')
gpus = [d for d in devices if d.type == 'OPTIX' and 'NVIDIA' in d.name]
if not gpus: raise RuntimeError('OptiX GPU required; no CPU fallback permitted.')
for d in prefs.devices: d.use = d.type == 'OPTIX' and d.id in {g.id for g in gpus}
if any(d.use and d.type == 'CPU' for d in prefs.devices): raise RuntimeError('CPU enabled; refused.')
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'GPU'; scene.cycles.samples = 16
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = True; scene.cycles.denoiser = 'OPTIX'; scene.cycles.denoising_use_gpu = True
scene.render.use_compositing = False; scene.render.film_transparent = False
scene.render.resolution_x = 1280; scene.render.resolution_y = 720; scene.render.resolution_percentage = 100
scene.render.fps = 20; scene.frame_start = 1; scene.frame_end = 120
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGB'
scene.render.filepath = str(FRAMES / 'frame-')
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.015, .018, .055, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .18
bpy.context.preferences.filepaths.save_version = 0

def group(name, members, pivot):
    obj = bpy.data.objects.new(name, None); scene.collection.objects.link(obj); obj.location = pivot
    bpy.context.view_layer.update()
    for child in members:
        matrix = child.matrix_world.copy(); child.parent = obj; child.matrix_world = matrix
    return obj

objects = list(scene.objects)
roof = group('Assembly · rising roof', [o for o in objects if o.name.startswith(('Header', 'Roof'))], (0, .15, 1.82))
left = group('Assembly · left hinged tower', [o for o in objects if o.name.startswith('Left')], (-.98, .2, .4))
right = group('Assembly · right hinged tower', [o for o in objects if o.name.startswith('Right')], (.98, .2, .4))
pane = group('Assembly · aperture', [o for o in objects if o.name.startswith('Portal')], (0, .2, 1.1))
for obj, sign in ((left,-1),(right,1)):
    for frame, angle in ((1,72),(18,72),(56,-4),(68,0),(144,0)):
        obj.rotation_euler.y = math.radians(angle*sign); obj.keyframe_insert('rotation_euler',frame=frame)
for frame,z in ((1,.62),(16,.62),(53,2.02),(67,1.82),(144,1.82)):
    roof.location.z=z; roof.keyframe_insert('location',frame=frame)
for frame,scale in ((1,.02),(43,.02),(73,1.04),(88,1),(144,1)):
    pane.scale=(scale,1,scale); pane.keyframe_insert('scale',frame=frame)

teal=bpy.data.materials.get('Teal · portal light')
for material,end in ((teal,3.2),(bpy.data.materials.get('Portal · inactive display backing'),.7)):
    emission=material.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
    for frame,value in ((1,0),(50,0),(76,end*1.6),(95,end),(144,end)):
        emission.default_value=value; emission.keyframe_insert('default_value',frame=frame)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.19,location=(0,-.03,1.13))
core=bpy.context.object;core.name='Assembly · faceted creation core';core.data.materials.append(teal)
for frame,scale in ((1,.001),(60,.001),(82,1.3),(102,1),(144,1)):
    core.scale=(scale,scale,scale);core.keyframe_insert('scale',frame=frame)
core.rotation_euler=(.2,.3,0);core.keyframe_insert('rotation_euler',frame=1)
core.rotation_euler.z=math.pi*1.2;core.keyframe_insert('rotation_euler',frame=144)

# A tangible stage, not a flat poster pan or a claim about actual software work.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
floor=bpy.context.object;floor.name='Attract · midnight stage';floor.data.materials.append(bpy.data.materials['Ink · structural steel'])
camera=scene.camera
aim=bpy.data.objects.new('Camera · assembly target',None);scene.collection.objects.link(aim);aim.location=(0,0,1)
constraint=camera.constraints.new('TRACK_TO');constraint.target=aim;constraint.track_axis='TRACK_NEGATIVE_Z';constraint.up_axis='UP_Y'
for frame,location,size in ((1,(7,-10,6.8),7.8),(45,(6.6,-9,6.2),7.0),(90,(5.4,-8.8,5.7),6.3),(144,(4.8,-9.2,5.9),6.4)):
    camera.location=location;camera.keyframe_insert('location',frame=frame);camera.data.ortho_scale=size;camera.data.keyframe_insert('ortho_scale',frame=frame)
scene['attract_meaning']='Illustrative assembly of the Preview facility. Not live application, agent progress or a completed test.'
scene['gpu_only']=True;scene['animation_source']='design/blender/attract-portal-reveal.py'
scene.frame_set(1)
blend=HERE/'attract-portal-reveal.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend),check_existing=False)
print('ATTRACT_GPU_ONLY='+json.dumps(dict(backend='OPTIX',devices=[g.name for g in gpus],cpu_enabled=False,denoiser='OPTIX',frames=120,resolution=[1280,720],fps=20,delivery_fps=24)))
if scene.cycles.device!='GPU':raise RuntimeError('GPU setting lost; no render permitted.')
bpy.ops.render.render(animation=True)
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(FRAMES.glob('frame-*.png'))}
(HERE/'attract-portal-reveal.frames.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('ATTRACT_RENDER_COMPLETE='+str(len(manifest)))
