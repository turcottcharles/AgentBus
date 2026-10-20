"""Original modular creation district. Mesh authoring/export only; never renders.

Coordinates in this generator are glTF-style (X, Y-up, Z). Mesh vertices are
converted to Blender Z-up on creation and exported with Blender's Y-up glTF path.
Every visible surface is authored geometry with embedded material colors.
"""
import bpy
import math
import json
import random
import hashlib
import struct
from pathlib import Path
from collections import defaultdict
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GLB = ROOT / 'app/assets/district-v2/district-world.glb'
BLEND = HERE / 'district-world.blend'
PROVENANCE = HERE / 'district-world.provenance.json'
RNG = random.Random(20261017)
PREVIOUS = json.loads(PROVENANCE.read_text(encoding='utf-8')) if PROVENANCE.exists() else None

def glb_mesh_signatures(data):
    """Compare actual packed mesh attributes/indices by name across additions."""
    json_size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+json_size].decode('utf-8'))
    binary = data[28+json_size:]
    components = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
    widths = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}
    def accessor_bytes(index):
        item=doc['accessors'][index]; view=doc['bufferViews'][item['bufferView']]
        size=components[item['componentType']]*widths[item['type']]
        offset=view.get('byteOffset',0)+item.get('byteOffset',0)
        stride=view.get('byteStride',size)
        return b''.join(binary[offset+n*stride:offset+n*stride+size]for n in range(item['count']))
    signatures={}
    for item in doc.get('meshes',[]):
        hashed=hashlib.sha256()
        for primitive in item['primitives']:
            for semantic,index in sorted(primitive['attributes'].items()):
                hashed.update(semantic.encode());hashed.update(accessor_bytes(index))
            if 'indices'in primitive:hashed.update(accessor_bytes(primitive['indices']))
            if 'material'in primitive:hashed.update(json.dumps(doc['materials'][primitive['material']],sort_keys=True).encode())
        signatures[item['name']]=hashed.hexdigest()
    return signatures

PREVIOUS_MESHES = glb_mesh_signatures(GLB.read_bytes()) if GLB.exists() else {}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

MATERIALS = {}
def material(name, color, metallic=0.0, roughness=.55, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    if emission:
        node.inputs['Emission Color'].default_value = (*color, 1)
        node.inputs['Emission Strength'].default_value = emission
    MATERIALS[name] = mat
    return name

INK = material('Ink structural alloy', (.035, .065, .13), .65, .36)
SLATE = material('Blue slate terraces', (.085, .15, .24), .18, .68)
EDGE = material('Blue steel bevels', (.16, .27, .37), .5, .36)
TEAL = material('Patinated teal ceramic', (.12, .40, .43), .42, .38)
BLUE = material('Petrol blue enamel', (.10, .23, .39), .45, .32)
VIOLET = material('Violet enamel', (.30, .20, .44), .35, .4)
COPPER = material('Warm copper roofs', (.69, .29, .17), .62, .35)
CREAM = material('Warm ceramic trim', (.77, .72, .53), .25, .5)
GLASS = material('Deep teal glass', (.025, .20, .25), .72, .14)
CYAN = material('Cyan luminous inlay', (.12, .91, .93), .35, .28, 2.4)
AMBER = material('Amber luminous windows', (1.0, .52, .15), .2, .35, 1.8)
LILAC = material('Lilac luminous glass', (.63, .40, 1.0), .35, .28, 1.7)
WATER = material('Cyan energy water', (.025, .47, .58), .55, .16, .28)
ROAD = material('Road graphite', (.055, .095, .15), .23, .72)
PLANT = material('Terrace greenery', (.10, .32, .29), 0, .85)

WORLD = bpy.data.objects.new('DistrictWorld', None)
scene.collection.objects.link(WORLD)
WORLD['original_asset'] = 'Procedural original mesh construction, Agent Bus creation district'
WORLD['floor'] = 'XZ, Y-up in exported glTF'
BATCHES = defaultdict(lambda: [[], []])
GROUPS = {}

def group(name):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = WORLD
    GROUPS[name] = obj
    return name

TERRAIN = group('TerrainTerraces')
PLAZA = group('CentralPlaza')
OBS = group('ResearchObservatory')
FORGE = group('ConstructionForge')
LAB = group('VerificationLab')
GATE = group('PreviewGateway')
ARCHIVE = group('ReviewArchive')
ROADS = group('ElevatedRoads')
ENERGY = group('EnergyChannels')
CITY = group('RearCitySpires')
STREET = group('StreetFurniture')

def mesh(group_name, mat, vertices, faces):
    target_v, target_f = BATCHES[(group_name, mat)]
    offset = len(target_v)
    target_v.extend((float(x), float(-z), float(y)) for x, y, z in vertices)
    target_f.extend(tuple(offset + n for n in face) for face in faces)

def box(g, mat, center, size, bevel=.12, yaw=0):
    x, y, z = center
    w, h, d = size
    b = min(bevel, w * .20, d * .20, h * .22)
    footprint = [(-w/2+b, -d/2), (w/2-b, -d/2), (w/2, -d/2+b), (w/2, d/2-b),
                 (w/2-b, d/2), (-w/2+b, d/2), (-w/2, d/2-b), (-w/2, -d/2+b)]
    verts = []
    for height, inset in [(-h/2, b*.65), (-h/2+b, 0), (h/2-b, 0), (h/2, b*.65)]:
        for px, pz in footprint:
            px *= (w-2*inset)/w
            pz *= (d-2*inset)/d
            verts.append((x+px*math.cos(yaw)-pz*math.sin(yaw), y+height, z+px*math.sin(yaw)+pz*math.cos(yaw)))
    faces = []
    for ring in range(3):
        for n in range(8):
            a = ring*8+n; b0 = ring*8+(n+1)%8
            faces.append((a, b0, b0+8, a+8))
    faces.extend([tuple(reversed(range(8))), tuple(range(24, 32))])
    mesh(g, mat, verts, [tuple(reversed(face)) for face in faces])

def cylinder(g, mat, center, radius, height, sides=24, top_radius=None):
    x, y, z = center
    upper = radius if top_radius is None else top_radius
    verts = []
    for level, r in [(y-height/2, radius), (y+height/2, upper)]:
        verts.extend((x+r*math.cos(n*math.tau/sides), level, z+r*math.sin(n*math.tau/sides)) for n in range(sides))
    faces = [(n, (n+1)%sides, (n+1)%sides+sides, n+sides) for n in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range(sides, sides*2))]
    mesh(g, mat, verts, [tuple(reversed(face)) for face in faces])

def pipe(g, mat, a, b, radius=.08, sides=8):
    a, b = Vector(a), Vector(b)
    along = (b-a).normalized()
    cross = along.cross(Vector((0, 1, 0)))
    if cross.length < .01: cross = along.cross(Vector((1, 0, 0)))
    cross.normalize()
    other = along.cross(cross).normalized()
    verts = []
    for point in (a, b):
        for n in range(sides):
            v = point + radius*(math.cos(n*math.tau/sides)*cross + math.sin(n*math.tau/sides)*other)
            verts.append(tuple(v))
    faces = [(n, (n+1)%sides, (n+1)%sides+sides, n+sides) for n in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range(sides, sides*2))]
    mesh(g, mat, verts, faces)

def torus(g, mat, center, radius, thickness, major=40, minor=6, axis='Y'):
    x, y, z = center
    verts, faces = [], []
    for n in range(major):
        u = n*math.tau/major
        for m in range(minor):
            v = m*math.tau/minor
            r = radius + thickness*math.cos(v)
            if axis == 'Y': point = (x+r*math.cos(u), y+thickness*math.sin(v), z+r*math.sin(u))
            elif axis == 'Z': point = (x+r*math.cos(u), y+r*math.sin(u), z+thickness*math.sin(v))
            else: point = (x+thickness*math.sin(v), y+r*math.cos(u), z+r*math.sin(u))
            verts.append(point)
    for n in range(major):
        for m in range(minor):
            faces.append((n*minor+m, ((n+1)%major)*minor+m, ((n+1)%major)*minor+(m+1)%minor, n*minor+(m+1)%minor))
    mesh(g, mat, verts, [tuple(reversed(face)) for face in faces] if axis == 'Y' else faces)

def dome(g, center, radius, rise, sides=40, rings=10):
    x, y, z = center
    for n in range(sides):
        verts = []
        for j in range(rings+1):
            theta = j*math.pi/2/rings
            for a in (n*math.tau/sides, (n+1)*math.tau/sides):
                verts.append((x+radius*math.cos(theta)*math.cos(a), y+rise*math.sin(theta), z+radius*math.cos(theta)*math.sin(a)))
        faces = [(j*2, j*2+1, j*2+3, j*2+2) for j in range(rings)]
        mesh(g, GLASS if n%5 in (1, 2, 3) else COPPER, verts, [tuple(reversed(face)) for face in faces])
    for n in range(0, sides, 5):
        a = n*math.tau/sides
        for j in range(rings):
            t1=j*math.pi/2/rings; t2=(j+1)*math.pi/2/rings
            pipe(g, EDGE, (x+radius*math.cos(t1)*math.cos(a), y+rise*math.sin(t1), z+radius*math.cos(t1)*math.sin(a)),
                 (x+radius*math.cos(t2)*math.cos(a), y+rise*math.sin(t2), z+radius*math.cos(t2)*math.sin(a)), .055, 6)

def polygon_tier(g, points, bottom, top, mat):
    count=len(points)
    vertices=[(x,bottom,z) for x,z in points]+[(x,top,z) for x,z in points]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(n,(n+1)%count,(n+1)%count+count,n+count) for n in range(count)]
    mesh(g, mat, vertices, [tuple(reversed(face)) for face in faces])

def vault_roof(g, mat, center, width=6.6, depth=4.9, rise=1.05):
    """A solid barrel-vault canopy, distinct from the observatory's dome."""
    x,y,z=center; segments=20
    outline=[(x+width/2*math.cos(n*math.pi/segments),y+rise*math.sin(n*math.pi/segments))for n in range(segments+1)]
    outline += [(x+width/2*math.cos(n*math.pi/segments),y-.17+(rise-.06)*math.sin(n*math.pi/segments))for n in reversed(range(segments+1))]
    count=len(outline)
    verts=[(px,py,z+dz)for dz in (-depth/2,depth/2)for px,py in outline]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(n,(n+1)%count,(n+1)%count+count,n+count)for n in range(count)]
    mesh(g,mat,verts,faces)

def stairs(g, mat, x, z, width, count=6, rise=.17, tread=.40):
    for n in range(count):
        height=(count-n)*rise
        box(g, mat, (x, height/2, z+n*tread), (width,height,tread+.03), .045)

def vent(g, x, y, z, scale=1):
    box(g, INK, (x,y,z), (1.2*scale,.35*scale,.9*scale), .08*scale)
    for n in range(5): box(g, EDGE, (x+(n-2)*.19*scale,y+.20*scale,z), (.085*scale,.045*scale,.68*scale), .018)

def lamp(x,z,height=2.2):
    cylinder(STREET, EDGE, (x,height/2,z), .10, height, 8)
    box(STREET, INK, (x,height,z), (.65,.18,.50), .05)
    box(STREET, AMBER, (x,height-.04,z+.02), (.42,.12,.32), .035)
    cylinder(STREET, INK, (x,.1,z), .24,.2,12)

def planter(x,z,width=2.2):
    box(STREET, EDGE, (x,.35,z), (width,.70,1.0),.12)
    for n in range(5):
        cylinder(STREET, PLANT, (x-width*.36+n*width*.18,.9,z), .3,.65,7,.06)

def road(a,b,width=2.9,level=.67):
    ax,az=a; bx,bz=b
    length=math.hypot(bx-ax,bz-az)
    yaw=math.atan2(bz-az,bx-ax)
    dx,dz=math.cos(yaw),math.sin(yaw)
    normal=(-dz,dx)
    box(ROADS, EDGE, ((ax+bx)/2,level-.08,(az+bz)/2), (length+.08,.50,width+.3),.10,yaw)
    box(ROADS, ROAD, ((ax+bx)/2,level+.20,(az+bz)/2), (length,.12,width),.035,yaw)
    for sign in (-1,1):
        ox,oz=normal[0]*width*.46*sign,normal[1]*width*.46*sign
        pipe(ROADS, CYAN, (ax+ox,level+.30,az+oz), (bx+ox,level+.30,bz+oz), .045,6)
    for n in range(1,int(length/3.2)+1):
        t=n/(int(length/3.2)+1); px=ax+(bx-ax)*t; pz=az+(bz-az)*t
        box(ROADS, INK, (px,level/2-.25,pz), (.7,max(.35,level+.2),width*.65),.08,yaw)
        box(ROADS, CREAM, (px,level+.28,pz), (.45,.025,.13),.01,yaw)

# An irregular floating terrace with genuine thickness and a stepped perimeter.
island=[(-26,-16),(-17,-26),(8,-28),(24,-17),(28,5),(17,22),(-8,25),(-26,12)]
polygon_tier(TERRAIN,[(x*1.04,z*1.04)for x,z in island],-2.0,-.90,INK)
polygon_tier(TERRAIN,island,-.90,-.10,SLATE)
polygon_tier(TERRAIN,[(x*.965,z*.965)for x,z in island],-.10,.05,EDGE)
for n,(x,z) in enumerate(island):
    nx,nz=island[(n+1)%len(island)]
    pipe(TERRAIN,TEAL,(x,-.65,z),(nx,-.65,nz),.12,8)
    for t in (.20,.42,.64,.84):
        px=x+(nx-x)*t; pz=z+(nz-z)*t
        box(TERRAIN,INK,(px,-1.42,pz),(1.1,.48,.46),.05,math.atan2(nz-z,nx-x))

# Fine-scale paving, sparse in the near/left title region.
for x in range(-19,22,3):
    for z in range(-19,19,3):
        if math.hypot(x,z)<6 or (x<-4 and z>5): continue
        box(TERRAIN,SLATE,(x,.09,z),(2.60,.10,2.60),.065)

# Central calm host plaza. No tall object obstructs its five-unit clear radius.
cylinder(PLAZA,INK,(0,.13,0),5.6,.38,64)
cylinder(PLAZA,TEAL,(0,.37,0),5.25,.16,64)
cylinder(PLAZA,SLATE,(0,.49,0),4.85,.13,64)
torus(PLAZA,CYAN,(0,.58,0),4.90,.045,80,6)
torus(PLAZA,EDGE,(0,.58,0),3.35,.035,64,6)
for n in range(12):
    a=n*math.tau/12
    box(PLAZA,CREAM,(5.28*math.cos(a),.51,5.28*math.sin(a)),(.40,.045,.16),.015,a)
for x,z in [(-4,5.2),(4,5.2)]: stairs(PLAZA,EDGE,x,z,1.4,3,.15,.34)

# Channels are mesh troughs with recessed luminous water, crossed by real bridges.
for a,b in [((-24,-9),(-7,-9)),((-7,-9),(5,-6)),((5,-6),(23,-7)),((23,-7),(23,9)),((-22,8),(-5,8)),((6,10),(22,10))]:
    ax,az=a;bx,bz=b;length=math.hypot(bx-ax,bz-az);yaw=math.atan2(bz-az,bx-ax)
    box(ENERGY,INK,((ax+bx)/2,.15,(az+bz)/2),(length+.25,.30,1.6),.08,yaw)
    box(ENERGY,WATER,((ax+bx)/2,.32,(az+bz)/2),(length,.08,1.05),.03,yaw)
    pipe(ENERGY,CYAN,(ax,.40,az),(bx,.40,bz),.04,6)
    for n in range(max(2,int(length/2))):
        t=(n+.5)/max(2,int(length/2));px=ax+(bx-ax)*t;pz=az+(bz-az)*t
        box(ENERGY,TEAL,(px,.39,pz),(.12,.08,1.30),.015,yaw)

for a,b in [((-6,-3),(-10,-11)),((5,-3),(9,-10)),((-6,1),(-13,0)),((5,2),(13,3)),((-10,-11),(7,-11)),((-13,0),(-13,7)),((13,3),(13,11))]: road(a,b)
road((-5,5),(5,12),3.1,.45)

# Research: buttressed circular observatory, segmented glass dome, real telescope.
ox,oz=-11,-17
box(OBS,INK,(ox,.4,oz),(11,.8,10),.35)
box(OBS,TEAL,(ox,.95,oz),(10.3,.35,9.3),.20)
cylinder(OBS,EDGE,(ox,1.70,oz),4.40,1.25,12)
cylinder(OBS,BLUE,(ox,3.55,oz),3.90,2.90,24)
torus(OBS,CYAN,(ox,2.17,oz),3.95,.055,64,6)
torus(OBS,COPPER,(ox,5.18,oz),4.03,.20,40,8)
for n in range(12):
    a=n*math.tau/12
    box(OBS,CREAM,(ox+3.90*math.cos(a),3.60,oz+3.90*math.sin(a)),(.29,2.8,.40),.08,a)
    box(OBS,AMBER,(ox+3.94*math.cos(a),4.0,oz+3.94*math.sin(a)),(.30,.78,.09),.025,a)
dome(OBS,(ox,5.22,oz),3.76,2.90)
cylinder(OBS,INK,(ox,8.10,oz),.90,.45,16)
pipe(OBS,INK,(ox-.4,7.7,oz-.3),(ox+3.5,9.7,oz+3.8),.65,16)
pipe(OBS,CREAM,(ox+1.5,8.67,oz+1.69),(ox+3.85,9.88,oz+4.15),.74,16)
pipe(OBS,GLASS,(ox+3.87,9.89,oz+4.17),(ox+3.98,9.95,oz+4.29),.63,24)
for x in (ox-4.55,ox+4.55):
    box(OBS,INK,(x,1.8,oz+3.7),(1.0,2.2,1.1),.20)
    box(OBS,CYAN,(x,2.65,oz+4.21),(.50,.12,.07),.02)
stairs(OBS,CREAM,ox,oz+5.0,3.5,6,.18,.36)
for x in (ox-2.0,ox+2.0): vent(OBS,x,1.30,oz-3.5,.75)

# Construction: heavy forge, orange recessed bays, multilevel roofs and sky crane.
fx,fz=9,-15
box(FORGE,INK,(fx,.5,fz),(11,1,9.8),.32)
box(FORGE,EDGE,(fx,1.08,fz),(10.3,.28,9.2),.15)
box(FORGE,VIOLET,(fx,3.90,fz),(8.1,5.4,6.5),.35)
box(FORGE,INK,(fx,3.2,fz+3.29),(6.35,3.7,.22),.12)
for n in range(4):
    x=fx-2.30+n*1.53
    box(FORGE,AMBER,(x,3.18,fz+3.43),(1.12,2.50,.10),.10)
    box(FORGE,EDGE,(x,2.90,fz+3.57),(.15,3.2,.20),.04)
box(FORGE,COPPER,(fx,6.82,fz),(8.6,.55,7.2),.20)
box(FORGE,INK,(fx-1.1,7.85,fz-1.0),(4.6,1.5,4.2),.18)
box(FORGE,CREAM,(fx-1.1,8.65,fz-1.0),(4.9,.3,4.5),.09)
for x in (fx-2.4,fx-.8): vent(FORGE,x,8.94,fz-1.0,.85)
for x in (fx+3.05,fx+4.05):
    cylinder(FORGE,INK,(x,6.2,fz-2.2),.52,8.1,10)
    torus(FORGE,COPPER,(x,10.3,fz-2.2),.55,.16,20,6)
    cylinder(FORGE,AMBER,(x,10.5,fz-2.2),.36,.12,12)
box(FORGE,INK,(fx-3.0,7.6,fz+1.6),(1.25,12.8,1.25),.12)
box(FORGE,COPPER,(fx+.5,13.9,fz+1.6),(9.2,.70,.8),.14)
for n in range(6): box(FORGE,CREAM,(fx-3+n*1.45,14.32,fz+1.6),(.22,.20,.82),.03)
pipe(FORGE,EDGE,(fx-3.0,14.45,fz+1.6),(fx+4.6,14.45,fz+1.6),.065,6)
pipe(FORGE,INK,(fx+3.7,13.5,fz+1.6),(fx+3.7,10.0,fz+1.6),.075,8)
torus(FORGE,COPPER,(fx+3.7,9.7,fz+1.6),.42,.12,16,6,'Z')
stairs(FORGE,EDGE,fx,fz+4.8,5.7,6,.18,.40)
for n in range(3): box(FORGE,TEAL,(fx+4.5,1.6+n*.55,fz+2.5),(1.0,.45,1.1),.08)

# Verification: two low capsule-like wings and an unmistakable upright instrument.
lx,lz=-18,-1
box(LAB,INK,(lx,.45,lz),(11.8,.9,9.2),.38)
box(LAB,TEAL,(lx,1.0,lz),(11.0,.3,8.5),.22)
for dx,dz,height in [(-2.5,-.7,3.4),(2.4,.5,4.5)]:
    box(LAB,BLUE,(lx+dx,1.3+height/2,lz+dz),(4.6,height,5.9),.45)
    box(LAB,CREAM,(lx+dx,1.45+height,lz+dz),(4.9,.35,6.2),.16)
    box(LAB,GLASS,(lx+dx,2.6,lz+dz+3.0),(3.75,1.95,.16),.18)
    for n in range(4):
        box(LAB,EDGE,(lx+dx-1.5+n,2.62,lz+dz+3.13),(.11,2.0,.18),.03)
    box(LAB,CYAN,(lx+dx,1.60,lz+dz+3.15),(3.7,.09,.08),.02)
    vent(LAB,lx+dx,1.9+height,lz+dz-1.4,.85)
torus(LAB,INK,(lx+2.4,7.45,lz+.5),1.45,.35,32,8,'Z')
torus(LAB,LILAC,(lx+2.4,7.45,lz+.72),1.14,.075,48,6,'Z')
pipe(LAB,CREAM,(lx+2.4,6.35,lz+.54),(lx+2.4,8.55,lz+.54),.065,6)
pipe(LAB,CREAM,(lx+1.30,7.45,lz+.54),(lx+3.5,7.45,lz+.54),.065,6)
for x in (lx-4.7,lx+4.7):
    cylinder(LAB,INK,(x,2.0,lz+3.6),.24,2.3,8)
    cylinder(LAB,CYAN,(x,3.24,lz+3.6),.22,.28,10)
stairs(LAB,CREAM,lx,lz+4.7,3.1,6,.18,.36)

# Preview: an open dimensional ring, not a flat illustration or fake app screen.
gx,gz=18,3
box(GATE,INK,(gx,.55,gz),(11.8,1.1,9.8),.42)
box(GATE,VIOLET,(gx,1.25,gz),(10.8,.45,8.9),.28)
box(GATE,EDGE,(gx,1.56,gz),(9.8,.25,7.8),.18)
for side in (-1,1):
    box(GATE,INK,(gx+side*4.1,4.3,gz-.7),(1.50,5.4,2.6),.35)
    box(GATE,CREAM,(gx+side*4.1,7.15,gz-.7),(1.85,.50,3.0),.16)
    box(GATE,CYAN,(gx+side*4.1,4.3,gz+.64),(.21,3.8,.12),.04)
    box(GATE,COPPER,(gx+side*4.0,2.3,gz+2.3),(1.2,1.1,1.8),.18)
torus(GATE,INK,(gx,5.04,gz-.55),3.14,.58,8,8,'Z')
torus(GATE,TEAL,(gx,5.04,gz-.10),3.17,.29,40,8,'Z')
torus(GATE,CYAN,(gx,5.04,gz+.20),2.89,.075,72,6,'Z')
torus(GATE,LILAC,(gx,5.04,gz-.85),2.87,.045,64,6,'Z')
box(GATE,INK,(gx,8.64,gz-.55),(7.5,.65,2.1),.20)
for n in range(7): box(GATE,AMBER,(gx-2.7+n*.9,8.68,gz+.54),(.47,.12,.06),.02)
stairs(GATE,CREAM,gx,gz+4.7,6.0,8,.18,.34)
for dx in (-2.8,2.8): vent(GATE,gx+dx,1.92,gz-2.8,.9)

# Review archive: low rounded steel cases beneath a warm-framed violet vault.
# This occupies the approved open front-left plot, clear of host [5,.95,12].
rx,rz=-10,12
box(ARCHIVE,INK,(rx,.32,rz-.50),(7.8,.64,5.8),.30)
box(ARCHIVE,EDGE,(rx,.73,rz-.50),(7.3,.20,5.35),.16)
box(ARCHIVE,TEAL,(rx,2.30,rz-.80),(6.55,3.0,4.35),.42)
box(ARCHIVE,INK,(rx,2.70,rz+1.43),(5.70,2.55,.15),.20)
for n in range(4):
    cx=rx-2.12+n*1.415
    box(ARCHIVE,VIOLET,(cx,2.76,rz+1.57),(1.10,2.26,.32),.24)
    box(ARCHIVE,EDGE,(cx,2.80,rz+1.77),(.72,1.67,.15),.16)
    for shelf in range(3):
        box(ARCHIVE,CREAM,(cx,2.19+shelf*.57,rz+1.87),(.64,.095,.10),.035)
    box(ARCHIVE,AMBER,(cx,3.55,rz+1.86),(.22,.10,.07),.025)
for side in (-1,1):
    box(ARCHIVE,CREAM,(rx+side*3.20,2.56,rz+1.58),(.26,3.50,.52),.10)
    box(ARCHIVE,COPPER,(rx+side*3.43,1.48,rz+.8),(.42,1.36,1.02),.12)
box(ARCHIVE,CREAM,(rx,4.25,rz+1.58),(6.65,.32,.57),.12)
vault_roof(ARCHIVE,VIOLET,(rx,4.27,rz-.80),6.85,4.95,1.05)
for dz in (-2.50,-.80,.90):
    for n in range(16):
        a=n*math.pi/16;b=(n+1)*math.pi/16
        pipe(ARCHIVE,EDGE,(rx+3.45*math.cos(a),4.31+1.05*math.sin(a),rz+dz),
             (rx+3.45*math.cos(b),4.31+1.05*math.sin(b),rz+dz),.035,6)
box(ARCHIVE,LILAC,(rx,4.29,rz+1.91),(4.5,.075,.06),.02)
for dx in (-2.4,2.4):vent(ARCHIVE,rx+dx,1.10,rz-2.4,.65)
stairs(ARCHIVE,CREAM,rx,rz+2.85,3.3,4,.17,.32)
# A short archive-owned approach preserves every existing road mesh unchanged.
box(ARCHIVE,ROAD,(rx, .12,rz+4.70),(3.10,.18,1.2),.06)
for dx in (-1.35,1.35):
    cylinder(ARCHIVE,EDGE,(rx+dx,.48,rz+3.55),.09,.9,8)
    cylinder(ARCHIVE,AMBER,(rx+dx,.96,rz+3.55),.12,.14,8)

# Rear skyline: stepped original towers, open left skyline and taller center/right.
for n,(x,z,w,d,height) in enumerate([(-2,-24,4,4,17),(4,-24,4.2,4.5,21.4),(12,-23,3.8,4.2,16.2),(19,-20,3.5,4.1,12),(-19,-20,3.2,3.4,11.2)]):
    box(CITY,INK,(x,.5,z),(w+1.1,1.0,d+1.1),.22)
    box(CITY,BLUE if n%2 else VIOLET,(x,height*.40+.7,z),(w,height*.80,d),.27)
    box(CITY,TEAL,(x,height*.88,z),(w*.72,height*.22,d*.75),.20)
    box(CITY,EDGE,(x,height+0.2,z),(w*.84,.45,d*.85),.16)
    cylinder(CITY,INK,(x,height+.75,z),.12,1.0,8)
    cylinder(CITY,CYAN,(x,height+1.3,z),.13,.14,8)
    for row in range(2,int(height)-1,2):
        for col in range(3):
            if (row+col+n)%4==0: continue
            box(CITY,AMBER if (col+n)%3 else CYAN,(x+(col-1)*w*.24,row,z+d/2+.05),(w*.13,.56,.08),.02)
        box(CITY,EDGE,(x+w/2+.04,row+.1,z),(.08,.16,d*.87),.02)
    for side in (-1,1):
        pipe(CITY,INK,(x+side*w*.50,.6,z-d*.2),(x+side*w*.50,height*.78,z-d*.2),.085,8)

# Surface storytelling: vents, warm lamps, planters, bollards, cable runs, crates.
for x,z in [(-6,-6),(5,-7),(-7,4),(8,6),(12,10),(-13,8),(-22,-10),(23,-10)]: lamp(x,z)
for x,z in [(-7,-18),(1,-17),(-21,7),(9,5),(-7,15)]: planter(x,z)
for x,z in [(8,12),(-5,12),(3,16),(-21,-12),(24,6)]:
    for n in range(3):
        box(STREET,INK,(x+n*.55,.50,z),(.28,1,.28),.06)
        box(STREET,CYAN,(x+n*.55,.86,z),(.30,.12,.30),.025)
for x,z in [(-23,-6),(-21,-6),(3,-19),(24,-13),(24,-11)]:
    box(STREET,TEAL,(x,.56,z),(1.3,1.1,1.1),.13)
    box(STREET,CREAM,(x,.59,z+.57),(.65,.10,.03),.015)
for a,b in [((-7,2,-14),(2,3,-17)),((11,7,-11),(17,5,-1)),((-15,4,-10),(-21,4,-5))]:
    av,bv=Vector(a),Vector(b)
    points=[]
    for n in range(13):
        t=n/12;v=av.lerp(bv,t);v.y-=math.sin(t*math.pi)*.75;points.append(v)
    for n in range(12):pipe(STREET,INK,points[n],points[n+1],.065,6)

# Build one mesh per material per semantic group: bounded runtime draw calls.
all_positions=[]
for (group_name,mat_name),(vertices,faces) in sorted(BATCHES.items()):
    data=bpy.data.meshes.new(group_name+' / '+mat_name)
    data.from_pydata(vertices,[],faces)
    data.materials.append(MATERIALS[mat_name])
    data.update()
    obj=bpy.data.objects.new(group_name+'__'+mat_name.replace(' ','_'),data)
    scene.collection.objects.link(obj)
    obj.parent=GROUPS[group_name]
    obj['semantic_group']=group_name
    obj['source']='district-world.py original authored geometry'
    all_positions.extend((x,z,-y)for x,y,z in vertices)

min_bounds=[min(v[axis]for v in all_positions)for axis in range(3)]
max_bounds=[max(v[axis]for v in all_positions)for axis in range(3)]
radius=max(math.hypot(x,z)for x,y,z in all_positions)
triangles=sum(len(poly.vertices)-2 for obj in scene.objects if obj.type=='MESH' for poly in obj.data.polygons)
mesh_count=sum(obj.type=='MESH'for obj in scene.objects)
if triangles>180000:raise RuntimeError(f'Triangle budget exceeded: {triangles}')
if radius>35 or max_bounds[1]>24:raise RuntimeError(f'Bounds exceeded radius={radius}, max={max_bounds}')
FACILITY_LAYOUT = {
    'ResearchObservatory': {'anchor':[-11,0,-17],'entrance':[-11,0,-9.9],'pin':[-11,10.7,-17]},
    'ConstructionForge': {'anchor':[9,0,-15],'entrance':[9,0,-7.9],'pin':[9,14.7,-15]},
    'VerificationLab': {'anchor':[-18,0,-1],'entrance':[-18,0,5.75],'pin':[-15.6,9.55,-.5]},
    'PreviewGateway': {'anchor':[18,0,3],'entrance':[18,0,10.4],'pin':[18,9.3,2.45]},
    'ReviewArchive': {'anchor':[-10,0,12],'entrance':[-10,0,17.3],'pin':[-10,5.75,11.2]},
    'CentralPlaza': {'anchor':[0,.55,0],'entrance':[0,.55,5.4],'pin':[0,.7,0]}
}
for name,details in FACILITY_LAYOUT.items():
    center=details['anchor']
    GROUPS[name]['anchor_yup']=center
    GROUPS[name]['entrance_yup']=details['entrance']
    GROUPS[name]['pin_yup']=details['pin']
    positions=[(x,z,-y)for(g,m),(vertices,faces)in BATCHES.items()if g==name for x,y,z in vertices]
    lo=[min(v[a]for v in positions)for a in range(3)];hi=[max(v[a]for v in positions)for a in range(3)]
    details['bounds_yup']={'min':lo,'max':hi}
    details['footprint']=[[lo[0],0,lo[2]],[hi[0],0,lo[2]],[hi[0],0,hi[2]],[lo[0],0,hi[2]]]
scene['asset_contract']='Y-up exported glTF, central plaza, +X/+Z view, embedded materials only'
scene['illustrative_only']='District architecture does not represent real execution or test outcomes'
GLB.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',export_yup=True,export_apply=True,
    export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False,export_extras=True)

def file_record(file):
    data=file.read_bytes()
    return {'path':str(file.relative_to(ROOT)).replace('\\','/'),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
glb_bytes=GLB.read_bytes()
json_length,json_type=struct.unpack_from('<II',glb_bytes,12)
gltf=json.loads(glb_bytes[20:20+json_length].decode('utf-8'))
external=[record.get('uri')for key in ('buffers','images')for record in gltf.get(key,[])if record.get('uri')]
if external:raise RuntimeError(f'External resources refused: {external}')
mesh_signatures=glb_mesh_signatures(glb_bytes)
changed_existing=[name for name,digest in PREVIOUS_MESHES.items()if mesh_signatures.get(name)!=digest]
if changed_existing:raise RuntimeError(f'Accepted geometry changed unexpectedly: {changed_existing}')
record={'version':1,'title':'Original dimensional creation district','scope':'Original Blender-authored environment meshes. Asset export only; no offline render. GPU runtime/visual acceptance is separate.',
    'blender':bpy.app.version_string,'blender_build':bpy.app.build_hash.decode(),'coordinates':{'export':'XZ floor, Y up','camera_view_from':['+X','+Z'],'central_plaza':[0,.55,0]},
    'bounds_yup':{'min':min_bounds,'max':max_bounds,'radius_xz':radius},'triangles':triangles,'mesh_batches':mesh_count,'materials':len(MATERIALS),'gltf_meshes':len(gltf.get('meshes',[])),
    'gltf_primitives':sum(len(m.get('primitives',[]))for m in gltf.get('meshes',[])),'external_resources':external,'textures':len(gltf.get('textures',[])),
    'notable_groups':list(GROUPS),'facility_anchors':{name:list(GROUPS[name]['anchor_yup'])for name in GROUPS if 'anchor_yup'in GROUPS[name]},
    'facility_layout':FACILITY_LAYOUT,'mesh_signatures':mesh_signatures,
    'accepted_geometry_preserved':{'compared_meshes':len(PREVIOUS_MESHES),'changed_existing_meshes':changed_existing,'added_meshes':sorted(set(mesh_signatures)-set(PREVIOUS_MESHES))},
    'files':[file_record(Path(__file__)),file_record(BLEND),file_record(GLB)]}
history=list(PREVIOUS.get('revision_history',[]))if PREVIOUS else []
if PREVIOUS:
    previous_glb=next((item for item in PREVIOUS['files']if item['path'].endswith('.glb')),None)
    if previous_glb and previous_glb['sha256']!=hashlib.sha256(glb_bytes).hexdigest():
        history.append({'reason':'Before additive ReviewArchive at approved [-10,0,12]','files':PREVIOUS['files'],'bounds_yup':PREVIOUS['bounds_yup'],'triangles':PREVIOUS['triangles'],'mesh_batches':PREVIOUS['mesh_batches']})
record['revision_history']=history
PROVENANCE.write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print('DISTRICT_WORLD_READY '+json.dumps(record))
