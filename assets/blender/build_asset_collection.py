"""Author Sundown's reference-led mesh library. No reference pixels are shipped.

Run with Blender --background --python this_file.py. Logical coordinates are
X-forward, Y-up, with one unit per navigation cell. Meshes are batched by moving
part, with shared materials and vertex paint instead of a draw call per bolt.
"""

import json
import math
import random
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/models"
SOURCE = ROOT / "assets/blender/cinder-asset-collection.blend"
RECEIPT = ROOT / "docs/3d/asset-collection/build-report.json"
TAU = math.tau
MATS = []
LIGHT_SLOTS = {}
ASSETS = []
COLLECTION = None
FLOOR_SLOT = 0

COLORS = {
    "iron": (0.22, 0.28, 0.29), "edge": (0.48, 0.55, 0.53),
    "black": (0.028, 0.038, 0.042), "rust": (0.24, 0.075, 0.026),
    "copper": (0.48, 0.22, 0.085), "gold": (0.68, 0.39, 0.12),
    "teal": (0.035, 0.25, 0.22), "blue": (0.025, 0.12, 0.36),
    "navy": (0.014, 0.035, 0.12), "ivory": (0.65, 0.72, 0.67),
    "ochre": (0.60, 0.38, 0.055), "red": (0.35, 0.045, 0.025),
    "green": (0.19, 0.28, 0.09), "stone": (0.23, 0.25, 0.23),
    "cyan": (0.06, 0.78, 1.0), "violet": (0.56, 0.09, 1.0),
    "fire": (1.0, 0.24, 0.018), "hot": (1.0, 0.72, 0.20),
}


def xyz(point):
    return (point[0], -point[2], point[1])


def group(name, parent=None, pivot=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    COLLECTION.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(pivot)
    return obj


def materials():
    global FLOOR_SLOT
    for name, metal, rough, emission in [
        ("SCJ_WornAlloy", 0.72, 0.48, 0),
        ("SCJ_PaintedArmor", 0.32, 0.57, 0),
        ("SCJ_CeramicCloth", 0.05, 0.76, 0),
        ("SCJ_OpticalVoid", 0.20, 0.22, 0),
        ("SCJ_PoweredLight", 0.1, 0.35, 2.4),
        ("SCJ_MoltenCore", 0.05, 0.65, 1.8),
    ]:
        mat = bpy.data.materials.new(name)
        mat.use_backface_culling = True
        shader = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        paint = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        paint.layer_name = "Color"
        mat.node_tree.links.new(paint.outputs["Color"], shader.inputs["Base Color"])
        shader.inputs["Metallic"].default_value = metal
        shader.inputs["Roughness"].default_value = rough
        if emission:
            mat.node_tree.links.new(paint.outputs["Color"], shader.inputs["Emission Color"])
            shader.inputs["Emission Strength"].default_value = emission
        MATS.append(mat)
    # glTF vertex colours multiply base colour, never emission. Use explicit
    # coloured emitters so the browser matches Blender instead of turning white.
    for slot in [4, 5]:
        for color in ["cyan", "violet", "fire", "hot", "ivory"]:
            mat = MATS[slot].copy()
            mat.name = "SCJ_Emission_" + str(slot) + "_" + color
            shader = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            for link in list(shader.inputs["Emission Color"].links): mat.node_tree.links.remove(link)
            shader.inputs["Emission Color"].default_value = (*COLORS[color], 1)
            LIGHT_SLOTS[(slot,color)] = len(MATS)
            MATS.append(mat)
    # Procedural tangent-space relief keeps repeated floor tiles inexpensive.
    size=256
    yy,xx=np.mgrid[0:size,0:size].astype(np.float32)
    u,v=xx/size*7,yy/size*7
    angle=np.where((np.floor(u)+np.floor(v))%2==0,1,-1)*math.pi/4
    dx,dz=u%1-0.5,v%1-0.5
    along=dx*np.cos(angle)+dz*np.sin(angle)
    across=-dx*np.sin(angle)+dz*np.cos(angle)
    height=np.exp(-(along/0.31)**6-(across/0.055)**2)*0.8
    gz,gx=np.gradient(height)
    normal=np.stack((-gx*3,-gz*3,np.ones_like(gx)),axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    rgba=np.ones((size,size,4),dtype=np.float32)
    rgba[:,:,:3]=normal*0.5+0.5
    image=bpy.data.images.new("SCJ_Original_DiamondRelief",width=size,height=size)
    image.colorspace_settings.name="Non-Color"
    image.pixels.foreach_set(rgba.ravel()); image.pack()
    mat=MATS[0].copy(); mat.name="SCJ_DiamondSteel"
    shader=next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
    texture=mat.node_tree.nodes.new("ShaderNodeTexImage"); texture.image=image
    normal_node=mat.node_tree.nodes.new("ShaderNodeNormalMap")
    normal_node.inputs["Strength"].default_value=0.75
    mat.node_tree.links.new(texture.outputs["Color"],normal_node.inputs["Color"])
    mat.node_tree.links.new(normal_node.outputs["Normal"],shader.inputs["Normal"])
    FLOOR_SLOT=len(MATS); MATS.append(mat)


class Part:
    def __init__(self, name, parent, pivot=(0, 0, 0)):
        self.node = group(parent.name + "__" + name if name.startswith("Motion_") else name, parent, pivot)
        if name.startswith("Motion_"):
            self.node["motion_role"] = name
        self.pivot = Vector(pivot)
        self.vertices, self.faces, self.paint, self.slots, self.smooth = [], [], [], [], []
        self.rng = random.Random(name)

    def shape(self, vertices, faces, color="iron", slot=0, smooth=False, weather=0.08):
        offset = len(self.vertices)
        slot = LIGHT_SLOTS.get((slot,color),slot) if isinstance(color,str) else slot
        base = COLORS.get(color, color)
        self.vertices.extend(xyz(Vector(v) - self.pivot) for v in vertices)
        for face in faces:
            variation = 1 + self.rng.uniform(-weather, weather)
            self.faces.append(tuple(offset + i for i in face))
            self.paint.append(tuple(min(1, max(0, c * variation)) for c in base) + (1,))
            self.slots.append(slot)
            self.smooth.append(smooth)

    def box(self, center, size, color="iron", bevel=0.015, slot=0, yaw=0):
        x, y, z = center
        w, h, d = (v / 2 for v in size)
        b = min(bevel, w * 0.4, h * 0.4, d * 0.4)
        if bevel == 0:
            verts=[(x+u*math.cos(yaw)-v*math.sin(yaw),y+t,z+u*math.sin(yaw)+v*math.cos(yaw)) for t in [-h,h] for u,v in [(-w,-d),(w,-d),(w,d),(-w,d)]]
            self.shape(verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color,slot)
            return
        rings, verts = [], []
        for height, inset in [(-h, b), (-h + b, 0), (h - b, 0), (h, b)]:
            a, c = w - inset, d - inset
            ring = [(-a+b,-c),(a-b,-c),(a,-c+b),(a,c-b),(a-b,c),(-a+b,c),(-a,c-b),(-a,-c+b)]
            rings.append(ring)
            for u, v in ring:
                verts.append((x + u*math.cos(yaw) - v*math.sin(yaw), y+height, z+u*math.sin(yaw)+v*math.cos(yaw)))
        faces = [tuple(reversed(range(8))), tuple(range(24, 32))]
        for r in range(3):
            for i in range(8):
                j = (i + 1) % 8
                faces.append((r*8+i,r*8+j,(r+1)*8+j,(r+1)*8+i))
        self.shape(verts, faces, color, slot)

    def lathe(self, center, rings, color="iron", slot=0, axis="y", segments=24, caps=True):
        verts = []
        for height, radius in rings:
            for i in range(segments):
                a = i * TAU / segments
                p = (radius*math.cos(a), height, radius*math.sin(a))
                if axis == "x": p = (height, radius*math.cos(a), radius*math.sin(a))
                if axis == "z": p = (radius*math.cos(a), radius*math.sin(a), height)
                verts.append(tuple(center[k]+p[k] for k in range(3)))
        faces = []
        for r in range(len(rings)-1):
            for i in range(segments):
                j = (i+1) % segments
                faces.append((r*segments+i,r*segments+j,(r+1)*segments+j,(r+1)*segments+i))
        if caps:
            faces.extend([tuple(reversed(range(segments))), tuple(range((len(rings)-1)*segments,len(rings)*segments))])
        self.shape(verts, faces, color, slot, True, 0.025)

    def cylinder(self, center, radius, length, color="iron", axis="y", slot=0, segments=20):
        b = min(0.012, radius*0.15, length*0.15)
        self.lathe(center, [(-length/2,radius-b),(-length/2+b,radius),(length/2-b,radius),(length/2,radius-b)], color, slot, axis, segments)

    def sphere(self, center, scale, color="iron", slot=0, segments=24, rings=12, rough=0):
        verts = []
        for j in range(rings+1):
            phi = 0.001 + (math.pi-0.002)*j/rings
            for i in range(segments):
                theta = TAU*i/segments
                noise = 1 + rough * (math.sin(theta*5+phi*8)*0.5 + math.cos(theta*9-phi*7)*0.5)
                verts.append((center[0]+scale[0]*math.sin(phi)*math.cos(theta)*noise,
                              center[1]+scale[1]*math.cos(phi)*noise,
                              center[2]+scale[2]*math.sin(phi)*math.sin(theta)*noise))
        faces = []
        for j in range(rings):
            for i in range(segments):
                n=(i+1)%segments
                faces.append((j*segments+i,(j+1)*segments+i,(j+1)*segments+n,j*segments+n))
        self.shape(verts, faces, color, slot, True, 0.07 if rough else 0.01)

    def tube(self, points, radius, color="iron", slot=0, sides=8, taper=1):
        verts = []
        for i, p in enumerate(points):
            tangent = Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            tangent.normalize()
            reference = Vector((0,1,0)) if abs(tangent.y)<0.9 else Vector((1,0,0))
            u = tangent.cross(reference).normalized()
            v = tangent.cross(u).normalized()
            r = radius * (1+(taper-1)*i/(len(points)-1))
            for j in range(sides):
                a=TAU*j/sides
                verts.append(Vector(p)+r*(math.cos(a)*u+math.sin(a)*v))
        faces=[]
        for i in range(len(points)-1):
            for j in range(sides):
                n=(j+1)%sides
                faces.append((i*sides+j,i*sides+n,(i+1)*sides+n,(i+1)*sides+j))
        faces.extend([tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))])
        self.shape(verts,faces,color,slot,True,0.015)

    def ring(self, center, radius, thickness, color="iron", axis="y", slot=0, scale=(1,1), segments=40, arc=TAU):
        points=[]
        for i in range(segments+1):
            a=arc*i/segments
            u,v=radius*math.cos(a)*scale[0],radius*math.sin(a)*scale[1]
            q=(u,0,v) if axis=="y" else (0,u,v) if axis=="x" else (u,v,0)
            points.append(tuple(center[k]+q[k] for k in range(3)))
        self.tube(points,thickness,color,slot,sides=8)

    def bolt(self, center, axis="y", size=0.019):
        self.cylinder(center,size,size*0.7,"edge",axis,segments=6)

    def finish(self):
        if not self.vertices: return self.node
        mesh = bpy.data.meshes.new(self.node.name+"_Geometry")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(self.node.name+"_Mesh",mesh)
        COLLECTION.objects.link(obj)
        obj.parent=self.node
        for mat in MATS: mesh.materials.append(mat)
        colors=mesh.color_attributes.new(name="Color",type="BYTE_COLOR",domain="CORNER")
        uv=mesh.uv_layers.new(name="UVMap") if FLOOR_SLOT in self.slots else None
        for p,c,slot,smooth in zip(mesh.polygons,self.paint,self.slots,self.smooth):
            p.material_index=slot
            p.use_smooth=smooth
            for loop in p.loop_indices:
                colors.data[loop].color=c
                if uv:
                    vertex=mesh.vertices[mesh.loops[loop].vertex_index].co
                    uv.data[loop].uv=(vertex.x+0.5,-vertex.y+0.5)
        # Recalculate after custom construction; all surfaces are closed solids.
        import bmesh
        bm=bmesh.new(); bm.from_mesh(mesh)
        if uv:
            bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh); bm.free()
        return self.node


def asset(name, category, title, references, use="reserve"):
    root=group(name)
    root["asset_role"]=category
    root["forward_axis"]="+X"
    root["cell_scale_meters"]=1.0
    root["source_kind"]="original-procedural-reference-led"
    ASSETS.append({"node":name,"title":title,"category":category,"use":use,"references":references,"root":root})
    return root


def plinth(p, radius=0.43):
    p.cylinder((0,0.075,0),radius,0.15,"black",segments=32)
    p.cylinder((0,0.175,0),radius*0.89,0.08,"iron",segments=32)
    p.ring((0,0.22,0),radius*0.78,0.025,"copper")
    for i in range(8):
        a=TAU*i/8
        p.bolt((math.cos(a)*radius*0.85,0.223,math.sin(a)*radius*0.85))


def hero():
    root=asset("Unit_Hero","hero","Singularity",["singularity_hero"],"active")
    p=Part("Singularity_Body",root)
    p.sphere((-0.055,0.53,0),(0.23,0.28,0.24),"navy",1)
    p.sphere((-0.06,0.98,0),(0.31,0.36,0.32),"navy",1,32,16)
    p.sphere((0.214,0.96,0),(0.075,0.22,0.245),"black",3,32,16)
    p.ring((0.25,0.96,0),0.23,0.018,"gold","x",scale=(1,1.08))
    p.ring((0.025,0.81,0),0.365,0.035,"gold",scale=(1,1.04))
    p.ring((0.03,0.80,0),0.395,0.01,"hot",slot=4,scale=(1,1.02))
    for z in [-0.09,0.09]:
        p.sphere((0.288,0.98,z),(0.019,0.065,0.035),"cyan",4,16,8)
        p.sphere((0.304,1.007,z-0.008),(0.01,0.017,0.012),"ivory",4,12,6)
    for sign in [-1,1]:
        p.tube([(-0.1,1.27,sign*0.11),(0.02,1.24,sign*0.21),(0.16,1.14,sign*0.25)],0.008,"gold")
        arm=Part("Motion_Arm_"+("L" if sign<0 else "R"),root,(0,0.65,sign*0.26))
        arm.sphere((0,0.51,sign*0.30),(0.10,0.18,0.09),"blue",1)
        arm.sphere((0.06,0.40,sign*0.31),(0.105,0.10,0.10),"navy",1)
        arm.ring((0.05,0.43,sign*0.31),0.092,0.009,"gold")
        arm.finish()
        leg=Part("Motion_Leg_"+("L" if sign<0 else "R"),root,(0,0.32,sign*0.13))
        leg.sphere((0,0.23,sign*0.13),(0.095,0.18,0.095),"navy",1)
        leg.sphere((0.07,0.087,sign*0.13),(0.16,0.086,0.105),"blue",1)
        leg.box((0.07,0.025,sign*0.13),(0.25,0.05,0.18),"black")
        leg.tube([(0.17,0.08,sign*0.13-0.07),(0.21,0.08,sign*0.13),(0.17,0.08,sign*0.13+0.07)],0.009,"gold")
        leg.finish()
    p.finish()


def cryo(name="Tower_ColdIronLongshot", utility=False):
    root=asset(name,"prop" if utility else "tower","Cryogenic cooling plant" if utility else "Cold-Iron Longshot",["cold_Iron_Longshot"],"reserve" if utility else "active")
    p=Part(name+"_Base",root); plinth(p)
    color="ochre" if utility else "blue"
    p.box((0,0.39,0),(0.42,0.36,0.42),color,0.055,1)
    for z in [-0.28,0.28]:
        p.tube([(-0.12,0.25,z),(0,0.69,z),(0.12,0.79,z)],0.045,"edge")
        p.cylinder((0,0.72,z),0.082,0.08,"copper","z")
        p.tube([(-0.2,0.4,z),(-0.34,0.5,z),(-0.35,0.87,z),(-0.2,0.96,z)],0.021,"black")
    p.finish()
    p=Part("Motion_Turret",root,(0,0.74,0))
    p.lathe((0,0.83,0),[(-0.34,0.19),(-0.29,0.23),(0.14,0.26),(0.35,0.29),(0.36,0.23),(0.15,0.19),(-0.29,0.155)],color,1,"x",32,False)
    p.ring((0.35,0.83,0),0.263,0.026,"edge","x")
    p.ring((0.362,0.83,0),0.217,0.012,"cyan","x",4)
    p.cylinder((0.07,0.83,0),0.17,0.018,"black","x")
    p.sphere((0.15,0.83,0),(0.06,0.07,0.07),"cyan",4)
    for i in range(6):
        a=TAU*i/6
        p.tube([(0.13,0.83+0.06*math.cos(a),0.06*math.sin(a)),(0.13,0.83+0.18*math.cos(a+0.4),0.18*math.sin(a+0.4))],0.028,"edge")
        p.bolt((0.374,0.83+0.266*math.cos(a),0.266*math.sin(a)),"x")
    for x in [-0.25,-0.17,-0.09]: p.ring((x,0.83,0),0.235,0.01,"iron","x")
    if not utility:
        for z in [-0.13,0,0.13]:
            p.tube([(0.29,1.058,z),(0.22,1.08,z),(-0.12,1.075,z)],0.024,"ivory",2)
            p.tube([(0.31,0.69,z),(0.32,0.57,z)],0.015,"cyan",2,taper=0.05)
    p.finish()


def solar(name="Tower_Sunspitter", reactor=False):
    root=asset(name,"prop" if reactor else "tower","Fusion containment reactor" if reactor else "Sunspitter",["sunspitter"],"reserve" if reactor else "active")
    p=Part(name+"_Housing",root); plinth(p,0.49 if reactor else 0.43)
    p.cylinder((0,0.34,0),0.31,0.24,"black",segments=32)
    p.ring((0,0.49,0),0.34,0.027,"copper")
    for i in range(8):
        a=TAU*i/8; x,z=0.3*math.cos(a),0.3*math.sin(a)
        p.cylinder((x,0.38,z),0.039,0.22,"edge",segments=12)
        p.cylinder((x*1.06,0.38,z*1.06),0.019,0.14,"cyan",slot=4,segments=10)
        p.box((x*1.3,0.11,z*1.3),(0.12,0.13,0.14),"copper",yaw=-a)
    p.ring((0,0.57,0),0.30,0.035,"gold")
    p.finish()
    p=Part("Motion_Core",root,(0,0.81,0))
    p.sphere((0,0.81,0),(0.26,0.26,0.26),"fire",5,40,24,0.035)
    for i in range(22):
        a=TAU*i/22
        points=[]
        for j in range(12):
            b=-1.2+2.4*j/11
            r=0.266+0.007*math.sin(j*2+i)
            points.append((r*math.cos(b)*math.cos(a+b*0.5),0.81+r*math.sin(b),r*math.cos(b)*math.sin(a+b*0.5)))
        p.tube(points,0.006,"hot",5,sides=4)
    p.finish()
    p=Part(name+"_Emitter",root)
    p.ring((0.23,0.81,0),0.135,0.028,"copper","x")
    if reactor:
        for axis in ["x","z"]:
            p.ring((0,0.81,0),0.37,0.045,"iron",axis)
            p.ring((0,0.81,0),0.38,0.011,"cyan",axis,4)
        p.cylinder((0,1.24,0),0.24,0.10,"iron")
    p.finish()


def tesla(name="Tower_TeslaCoil", tall=False):
    root=asset(name,"prop" if tall else "tower","Arc relay pylon" if tall else "Tesla Coil",["tesla_coil"],"reserve" if tall else "active")
    p=Part(name+"_Assembly",root); plinth(p)
    height=1.85 if tall else 1.08
    p.cylinder((0,0.54,0),0.12,0.60,"copper")
    p.cylinder((0,height/2+0.22,0),0.093,height-0.28,"copper")
    for i in range(24 if tall else 16):
        y=0.30+i*(height-0.38)/(24 if tall else 16)
        p.ring((0,y,0),0.102,0.013,"copper",segments=24)
    for y in [0.28,height-0.12]:
        for k in range(3): p.cylinder((0,y+k*0.026,0),0.145,0.016,"ivory",slot=2)
    p.ring((0,height,0),0.24,0.082,"edge")
    p.ring((0,height+0.012,0),0.27,0.009,"violet",slot=4)
    p.tube([(0,height,0),(0,height+0.20,0)],0.017,"copper",taper=0.1)
    for i in range(4):
        a=i*TAU/4; x,z=0.29*math.cos(a),0.29*math.sin(a)
        p.cylinder((x,0.27,z),0.06,0.12,"black")
        p.ring((x,0.33,z),0.044,0.013,"gold",segments=16)
        p.tube([(x,0.33,z),(x*0.75,0.43,z*0.75),(0,0.47,0)],0.012,"copper")
    p.finish()


def mech(name="Unit_RustRunner", heavy=False):
    root=asset(name,"enemy","MechDog" if not heavy else "Tinback armored hauler",["MechDog_enemy"],"active")
    p=Part(name+"_Armor",root)
    p.box((-0.08,0.51,0),(0.63,0.29,0.40),"iron",0.08)
    p.box((-0.1,0.685,0),(0.52,0.10,0.42),"green" if heavy else "rust",0.03,1)
    for x in [-0.29,-0.15,-0.01]:
        p.box((x,0.715,0),(0.075,0.06,0.31),"edge",0.012)
    p.box((0.28,0.58,0),(0.26,0.27,0.35),"iron",0.05)
    p.box((0.43,0.5,0),(0.19,0.12,0.25),"black",0.028)
    p.box((0.44,0.405,0),(0.16,0.055,0.23),"edge")
    for z in [-0.135,0.135]:
        p.box((0.417,0.617,z),(0.021,0.039,0.055),"cyan",slot=4)
        for x in [-0.22,0.05]: p.bolt((x,0.56,z*1.6),"z",0.025)
        for x in [0.37,0.46]: p.tube([(x,0.477,z*0.6),(x,0.445,z*0.6)],0.018,"ivory",2,taper=0.1)
    p.tube([(-0.38,0.55,0),(-0.56,0.54,0),(-0.66,0.65,0)],0.033,"black",taper=0.4)
    if heavy:
        p.box((-0.13,0.83,0),(0.52,0.21,0.44),"green",0.025,1)
        for z in [-0.24,0.24]: p.box((-0.12,0.46,z),(0.63,0.27,0.07),"edge",0.028)
    p.finish()
    for x in [-0.29,0.19]:
        for z in [-0.245,0.245]:
            label=("F" if x>0 else "B")+("L" if z<0 else "R")
            p=Part("Motion_Leg_"+label,root,(x,0.48,z))
            p.cylinder((x,0.48,z),0.095,0.09,"copper","z")
            p.tube([(x,0.46,z),(x-0.075,0.25,z),(x+0.04,0.10,z)],0.047,"iron")
            p.tube([(x+0.05,0.40,z),(x-0.025,0.24,z)],0.020,"edge")
            p.box((x+0.06,0.065,z),(0.19,0.13,0.13),"black",0.025)
            p.box((x+0.115,0.038,z),(0.1,0.066,0.145),"edge",0.012)
            p.finish()


def squid(name="Unit_RiftLeech", large=False):
    root=asset(name,"enemy" if not large else "prop","TechSquid sentinel" if large else "TechSquid / Rift Leech",["TechSquid_enemy"],"reserve" if large else "active")
    p=Part(name+"_Carapace",root)
    p.lathe((0,0.82,0),[(-0.12,0.12),(-0.06,0.33),(0,0.39),(0.025,0.29),(0.21,0.08)],"teal",1,segments=32)
    p.ring((0,0.81,0),0.34,0.024,"iron")
    p.cylinder((0,0.63,0),0.12,0.18,"black")
    for z in [-0.11,0,0.11]:
        p.sphere((0.332,0.84,z),(0.025,0.036,0.036),"violet",4,12,8)
    for i in range(8):
        a=TAU*i/8
        p.tube([(0.09*math.cos(a),1.01,0.09*math.sin(a)),(0.33*math.cos(a),0.86,0.33*math.sin(a))],0.014,"edge")
    p.finish()
    for i in range(6):
        a=i*TAU/6
        p=Part("Motion_Tendril_"+str(i),root,(0,0.67,0))
        points=[]
        for j in range(10):
            t=j/9; r=0.10+0.26*t+0.04*math.sin(t*TAU+i)
            points.append((r*math.cos(a+0.3*t),0.65-0.60*t,r*math.sin(a+0.3*t)))
        p.tube(points,0.027,"black",taper=0.24)
        p.tube(points[:5],0.009,"cyan",4,taper=0.8)
        p.finish()
    if large:
        for c in root.children:
            c.location *= 2.1; c.scale *= 2.1


def comet(name="Unit_BlackComet", variant="crown"):
    title={"crown":"The Black Comet","skull":"Death Comet relic","horn":"Horned Comet"}[variant]
    root=asset(name,"boss",title,["BlackComet_wave-boss"],"active" if name=="Unit_BlackComet" else "reserve")
    p=Part(name+"_Core",root)
    p.sphere((-0.04,0.85,0),(0.51,0.62,0.53),"black",1,32,20,0.14)
    p.sphere((0.40,0.67,0),(0.21,0.31,0.35),"stone" if variant=="skull" else "black",1,24,14,0.15)
    for sign in [-1,1]:
        p.sphere((0.46,0.98,sign*0.24),(0.06,0.145,0.16),"black",3)
        p.sphere((0.508,0.98,sign*0.24),(0.036,0.074,0.09),"fire" if variant!="skull" else "violet",4)
        p.tube([(0.23,1.13,sign*0.20),(0.48,1.16,sign*0.30),(0.5,1.05,sign*0.39)],0.065,"stone" if variant=="skull" else "iron",taper=0.6)
        if variant!="skull":
            p.tube([(-0.1,1.24,sign*0.32),(-0.12,1.49,sign*0.51),(0.09,1.73,sign*0.59),(0.30,1.83,sign*0.49)],0.13,"black",sides=12,taper=0.03)
        for j in range(4):
            z=sign*(0.035+j*0.055)
            p.tube([(0.565,0.69,z),(0.61,0.55,z)],0.026,"ivory",2,taper=0.08)
    p.sphere((0.57,0.53,0),(0.04,0.12,0.18),"black",3)
    for i in range(12):
        a=TAU*i/12
        p.tube([(-0.28,0.85+0.47*math.cos(a),0.45*math.sin(a)),(-0.51,0.90+0.33*math.cos(a),0.35*math.sin(a)),(-0.80,1.04+0.13*math.cos(a),0.17*math.sin(a))],0.032,"fire",4,taper=0.06)
    p.finish()


def utility_units():
    for name,title,wheels,color in [
        ("Unit_DustMite","Dust Mite scavenger",False,"rust"),
        ("Unit_SparkWagon","Spark Wagon capacitor carrier",True,"teal"),
        ("Unit_SiegeCrawler","Siege Crawler",True,"iron"),
    ]:
        root=asset(name,"enemy",title,["MechDog_enemy","tesla_coil"],"active")
        p=Part(name+"_Chassis",root)
        length=0.8 if name=="Unit_SiegeCrawler" else 0.54
        p.box((0,0.30,0),(length,0.27,0.37),color,0.06,1)
        p.box((0.16,0.48,0),(0.28,0.13,0.25),"iron",0.03)
        p.box((length/2+0.005,0.35,0),(0.04,0.055,0.24),"cyan",slot=4)
        if name=="Unit_SparkWagon":
            for x in [-0.16,0.04]:
                p.cylinder((x,0.64,0),0.095,0.38,"copper")
                p.ring((x,0.82,0),0.105,0.025,"violet",slot=4,segments=20)
        if name=="Unit_SiegeCrawler":
            for z in [-0.10,0.10]: p.cylinder((0.29,0.54,z),0.045,0.48,"black","x")
            p.box((-0.1,0.55,0),(0.33,0.23,0.36),"rust",0.025,1)
        p.finish()
        for sign in [-1,1]:
            p=Part("Motion_Wheel_"+str(sign) if wheels else "Motion_Leg_"+("L" if sign<0 else "R"),root,(0,0.17,sign*0.24))
            for x in [-length*0.32,0,length*0.32]:
                if wheels:
                    p.cylinder((x,0.16,sign*0.24),0.155,0.11,"black","z")
                    p.cylinder((x,0.16,sign*0.303),0.078,0.017,"copper","z")
                else:
                    p.tube([(x,0.28,sign*0.15),(x-0.09,0.21,sign*0.32),(x+0.06,0.025,sign*0.38)],0.026,"iron")
            p.finish()


def support_towers():
    root=asset("Tower_Peacemaker","tower","Peacemaker",["cold_Iron_Longshot"],"active")
    p=Part("Peacemaker_Base",root); plinth(p)
    p.cylinder((0,0.38,0),0.17,0.31,"rust"); p.finish()
    p=Part("Motion_Turret",root,(0,0.60,0))
    p.box((-0.08,0.60,0),(0.35,0.24,0.36),"rust",0.04,1)
    for z in [-0.1,0.1]:
        p.cylinder((0.26,0.63,z),0.047,0.65,"iron","x")
        p.cylinder((0.58,0.63,z),0.061,0.07,"black","x")
        p.ring((0.62,0.63,z),0.042,0.009,"copper","x",segments=16)
    p.box((-0.08,0.75,0),(0.30,0.07,0.18),"gold")
    p.finish()
    root=asset("Tower_ScrapExchange","tower","Scrap Exchange",["walls","graphicInspo"],"active")
    p=Part("ScrapExchange_Foundry",root); plinth(p)
    p.box((0,0.45,0),(0.55,0.46,0.52),"teal",0.045,1)
    p.box((0.29,0.45,0),(0.055,0.25,0.30),"black")
    p.box((0.32,0.46,0),(0.016,0.10,0.23),"fire",slot=4)
    for z in [-0.15,0.15]:
        p.cylinder((-0.13,0.83,z),0.065,0.39,"iron")
        p.ring((-0.13,1.015,z),0.073,0.014,"copper",segments=20)
    for x in [-0.21,0,0.21]: p.box((x,0.71,0.04),(0.05,0.06,0.43),"copper")
    p.finish()


def wall(name="Tower_Wall", fortress=False):
    root=asset(name,"wall","Fortress wall module" if fortress else "Windowed defensive wall",["walls"],"reserve" if fortress else "active")
    height=1.65 if fortress else 0.92
    p=Part("Tower_Wall_Core" if not fortress else name+"_Core",root)
    p.box((0,0.08,0),(0.86,0.16,0.24),"black")
    p.box((0,0.27,0),(0.79,0.27,0.13),"teal",0.015,1)
    p.box((0,height,0),(0.84,0.14,0.21),"edge",0.025)
    p.box((0,height*0.59,0),(0.12,height*0.68,0.18),"iron",0.022)
    for sign in [-1,1]:
        p.box((sign*0.34,height*0.60,0),(0.065,height*0.72,0.15),"iron")
        if fortress:
            p.box((sign*0.20,0.95,0),(0.32,1.19,0.12),"stone",0.02,2)
            p.tube([(sign*0.05,0.35,-0.095),(sign*0.32,0.95,-0.095),(sign*0.05,1.52,-0.095)],0.035,"edge")
        p.box((sign*0.22,0.39,-0.074),(0.18,0.025,0.012),"ochre",slot=1)
        p.bolt((sign*0.32,0.28,-0.086),"z")
    p.finish()
    for sign,label in [(-1,"Negative"),(1,"Positive")]:
        p=Part("Tower_Wall_End_"+label if not fortress else name+"_"+label,root)
        p.box((sign*0.43,height/2,0),(0.14,height,0.26),"iron",0.025)
        p.box((sign*0.43,0.07,0),(0.14,0.14,0.36),"black")
        p.box((sign*0.43,height+0.05,0),(0.14,0.10,0.30),"edge")
        p.box((sign*0.43,height-0.15,-0.142),(0.045,0.075,0.015),"cyan",slot=4)
        p.finish()


def floor_tile(name, kind):
    root=asset(name,"floor",{"plate":"Diamond steel plate","grate":"Service grating","hazard":"Hazard edge plate"}[kind],["floor'ground_tiles"],"kit")
    p=Part(name+"_Surface",root)
    p.box((0,-0.053,0),(1,0.094,1),"black",0.007)
    if kind=="grate":
        for i in range(12):
            p.box((-0.44+i*0.08,-0.012,0),(0.035,0.025,0.89),"iron",0)
        for z in [-0.4,0,0.4]: p.box((0,-0.030,z),(0.94,0.02,0.035),"edge",0)
    else:
        p.box((0,-0.019,0),(0.945,0.032,0.945),"iron",0.006,FLOOR_SLOT)
        if kind=="hazard":
            for i in range(7): p.box((-0.36+i*0.12,0.002,0.39),(0.065,0.004,0.1),"ochre",0,1,yaw=-0.45)
    for x in [-0.445,0.445]:
        for z in [-0.445,0.445]: p.lathe((x,-0.006,z),[(-0.006,0.017),(0.006,0.017)],"edge",segments=6)
    p.finish()


def portal(name="Prop_EyeOfCinder", eye=True):
    root=asset(name,"prop","Eye of Cinder" if eye else "Threshold gate",["BlackComet_wave-boss/Eye.webp"] if eye else ["map_sketch.jpg"],"reserve")
    p=Part(name+"_Frame",root)
    for z in [-0.55,0.55]: p.box((0,0.10,z),(0.45,0.20,0.3),"iron")
    p.ring((0,0.86,0),0.72,0.095,"black" if eye else "iron","x",segments=56)
    p.ring((0.08,0.86,0),0.68,0.019,"fire" if eye else "cyan","x",4)
    for i in range(12):
        a=i*TAU/12
        p.box((0,0.86+0.76*math.cos(a),0.76*math.sin(a)),(0.24,0.09,0.09),"copper")
    if eye:
        p.sphere((0,0.86,0),(0.20,0.60,0.60),"black",3,32,16)
        p.ring((0.20,0.86,0),0.25,0.035,"fire","x",4)
        for i in range(28):
            a=i*TAU/28
            points=[(0.21-0.04*j,0.86+(0.29+0.09*j)*math.cos(a+0.13*j),(0.29+0.09*j)*math.sin(a+0.13*j)) for j in range(4)]
            p.tube(points,0.012,"rust",1,taper=0.2)
    p.finish()


def industrial_props():
    root=asset("Prop_Tokamak","prop","Toroidal fusion engine",["sunspitter/base_images/article2_05d149956c.png","sunspitter/base_images/img6_article_e25339a262.png"])
    p=Part("Tokamak_Assembly",root)
    p.box((0,0.11,0),(1.5,0.22,1.5),"black")
    p.cylinder((0,0.70,0),0.16,1.18,"iron")
    p.ring((0,0.7,0),0.49,0.105,"violet",slot=4)
    for i in range(12):
        a=TAU*i/12
        points=[]
        for j in range(21):
            t=TAU*j/20; r=0.5+0.21*math.cos(t)
            points.append((r*math.cos(a),0.70+0.42*math.sin(t),r*math.sin(a)))
        p.tube(points,0.055,"copper",sides=8)
    for y in [0.25,1.12]: p.ring((0,y,0),0.54,0.06,"edge")
    p.finish()
    root=asset("Prop_FaradayCage","prop","Faraday service cage",["tesla_coil/base_images/arcattack-cage.webp"])
    p=Part("FaradayCage_Assembly",root)
    p.cylinder((0,0.07,0),0.47,0.14,"iron",segments=32)
    for y in [0.17,0.55,0.92,1.29]: p.ring((0,y,0),0.43,0.025,"edge")
    for i in range(12):
        a=TAU*i/12
        p.tube([(0.43*math.cos(a),0.14,0.43*math.sin(a)),(0.43*math.cos(a),1.29,0.43*math.sin(a))],0.016,"iron")
    p.cylinder((0,1.32,0),0.47,0.07,"copper")
    p.finish()
    root=asset("Prop_UpgradeStation","prop","Upgrade workbench",["map_sketch.jpg","walls/wall_template.jpg"])
    p=Part("UpgradeStation_Assembly",root)
    for x in [-0.38,0.38]:
        for z in [-0.22,0.22]: p.box((x,0.35,z),(0.08,0.70,0.08),"iron")
    p.box((0,0.73,0),(0.94,0.10,0.63),"teal",0.025,1)
    p.box((-0.22,0.86,0),(0.24,0.16,0.31),"iron")
    p.box((-0.08,0.85,0),(0.055,0.10,0.20),"copper")
    p.box((0.21,0.81,0.02),(0.24,0.05,0.32),"cyan",slot=4)
    p.tube([(-0.36,0.79,-0.20),(-0.36,1.20,-0.20),(0.02,1.20,-0.20)],0.025,"iron")
    p.box((0.02,1.17,-0.20),(0.23,0.05,0.12),"ivory",slot=4)
    p.finish()


def descendants(root):
    return [root] + [n for child in root.children for n in descendants(child)]


def export_assets(entries, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for entry in entries:
        for obj in descendants(entry["root"]): obj.select_set(True)
    bpy.context.view_layer.objects.active=entries[0]["root"]
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format="GLB",use_selection=True,use_active_scene=True,
                              export_yup=True,export_apply=True,export_extras=True,export_tangents=True)


def main():
    global COLLECTION
    # This script owns a fresh scene only; source images and the original .blend stay intact.
    scene=bpy.data.scenes.new("Sundown Asset Collection")
    bpy.context.window.scene=scene
    COLLECTION=bpy.data.collections.new("Sundown_Authored_Assets")
    scene.collection.children.link(COLLECTION)
    materials()
    hero(); cryo(); solar(); tesla(); mech(); mech("Unit_TinbackHauler",True)
    squid(); comet(); utility_units(); support_towers(); wall()
    cryo("Prop_CryogenicPlant",True); solar("Prop_ContainmentReactor",True)
    tesla("Prop_ArcPylon",True); squid("Prop_TechSquidSentinel",True)
    comet("Prop_DeathComet","skull"); comet("Prop_HornedComet","horn")
    portal(); portal("Prop_ThresholdGate",False); industrial_props()
    wall("Kit_FortressWall",True)
    for name,kind in [("Kit_FloorPlate","plate"),("Kit_FloorGrate","grate"),("Kit_FloorHazard","hazard")]: floor_tile(name,kind)
    OUT.mkdir(parents=True,exist_ok=True); RECEIPT.parent.mkdir(parents=True,exist_ok=True)
    scene["status"]="reference-led production candidates; local review required"
    scene["coordinate_contract"]="Y-up GLB; +X forward; one cell per unit"
    bpy.context.view_layer.update()
    for entry in ASSETS:
        points=[obj.matrix_world @ Vector(corner) for obj in descendants(entry["root"]) if obj.type=="MESH" for corner in obj.bound_box]
        logical=[(v.x,v.z,-v.y) for v in points]
        entry["bounds"]={"min":[round(min(v[i] for v in logical),5) for i in range(3)],"max":[round(max(v[i] for v in logical),5) for i in range(3)]}
        entry["triangles"]=sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in descendants(entry["root"]) if obj.type=="MESH")
        entry["parts"]=sum(obj.type=="MESH" for obj in descendants(entry["root"]))
    for use,filename in [("active","cinder-authored-units.glb"),("reserve","cinder-production-reserve.glb"),("kit","cinder-industrial-kit.glb")]:
        entries=[a for a in ASSETS if a["use"]==use]
        export_assets(entries,filename)
        for a in entries: a["file"]=filename
    # Layout only the editable source scene. GLB roots were exported at (0,0,0).
    for i,entry in enumerate(ASSETS): entry["root"].location=xyz(((i%6)*2.5,0,(i//6)*2.6))
    scene.world=bpy.data.worlds.new("Collection Review World")
    scene.world.color=(0.22,0.22,0.22)
    for area in bpy.context.screen.areas:
        if area.type=="VIEW_3D":
            area.spaces.active.shading.type="MATERIAL"
            area.spaces.active.region_3d.view_distance=18
            area.spaces.active.region_3d.view_location=xyz((6.2,0,5.2))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    report={"schemaVersion":1,"blenderVersion":bpy.app.version_string,"source":str(SOURCE.relative_to(ROOT)).replace("\\","/"),
            "method":"Original procedural meshes and vertex-painted PBR materials; reference pixels excluded",
            "assets":[{k:v for k,v in a.items() if k!="root"} for a in ASSETS]}
    RECEIPT.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("SUNDOWN_COLLECTION_COMPLETE",len(ASSETS),"assets")


if __name__=="__main__": main()
