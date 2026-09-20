"""Original zip bag: +X front, Y up, Z width; photo pixels never shipped."""
import hashlib
import json
import math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/blender/cinder-zip-bag.blend'
OUTPUT = ROOT / 'public/assets/models/cinder-zip-bag.glb'
REPORT = ROOT / 'docs/3d/zip-bag/build-report.json'
REFERENCE = ROOT / 'assets/references/zip_bag/IMG_0548.jpeg'
WIDTH, HOLE_Y, HOLE_RADIUS = 0.62, 0.915, 0.022


def xyz(p):
    return (p[0], -p[2], p[1])


def plastic_maps():
    size = 512
    v, u = np.mgrid[0:size, 0:size].astype(np.float32) / size
    rng = np.random.default_rng(548)
    height = np.zeros_like(u)
    # Intersecting short creases, not an embossed repeating fabric pattern.
    for _ in range(110):
        cx, cy = rng.uniform(0, 1, 2)
        angle = rng.uniform(0, math.tau)
        along = (u-cx)*math.cos(angle) + (v-cy)*math.sin(angle)
        across = -(u-cx)*math.sin(angle) + (v-cy)*math.cos(angle)
        ridge = np.exp(-((across+0.1*along*along)/rng.uniform(0.0015, 0.004))**2)
        height += rng.uniform(-0.65, 0.65)*ridge*np.exp(-(along/rng.uniform(0.025, 0.12))**4)
    height += 0.07*np.sin(u*190+np.sin(v*30))*np.sin(v*221+u*30)
    gy, gx = np.gradient(height)
    normal = np.stack((-gx*2.6, -gy*2.6, np.ones_like(gx)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[:, :, :3] = normal*0.5+0.5
    image = bpy.data.images.new('ZipBag_Original_Crease_Normal', width=size, height=size)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    rough = np.clip(0.24+np.abs(height)*0.32+rng.random(u.shape)*0.035, 0.2, 0.58)
    rgba[:, :, :3] = rough[:, :, None]
    roughness = bpy.data.images.new('ZipBag_Original_Roughness', width=size, height=size)
    roughness.colorspace_settings.name = 'Non-Color'
    roughness.pixels.foreach_set(rgba.ravel())
    roughness.pack()
    return image, roughness


def material(name, color, alpha, roughness, maps=None):
    mat = bpy.data.materials.new(name)
    mat.use_backface_culling = False
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for name, value in [('Base Color', (*color, 1)), ('Alpha', alpha),
                        ('Roughness', roughness), ('IOR', 1.46),
                        ('Coat Weight', 0.22), ('Coat Roughness', 0.18)]:
        shader.inputs[name].default_value = value
    if maps:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = maps[0]
        normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        mat.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
        mat.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Coat Normal'])
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = maps[1]
        mat.node_tree.links.new(tex.outputs['Color'], shader.inputs['Roughness'])
    return mat


def surface(y, z, sign):
    u = max(0, min(1, z/WIDTH+0.5))
    edge = math.sin(math.pi*u)
    bulge = 0.012*edge*max(0, math.sin(math.pi*min(y/0.86, 1)))
    crease = 0.0018*math.sin(z*97+y*25)*math.sin(y*64-z*20)
    fold = 0.003*math.sin(z*32+y*15)+crease
    x = sign*(0.0012+bulge+(0.006+fold)*edge*min(1, y/0.045))
    yy = y+0.004*math.sin(z*27+y*11)*max(0, (y-0.85)/0.15)
    zz = z+0.003*math.sin(y*22)*abs(2*u-1)
    return (x, yy, zz)


def opened(point, sign):
    x, y, z = point
    across = max(0, math.sin(math.pi*max(0, min(1, z/WIDTH+0.5))))
    lift = max(0, min(1, (y-0.18)/0.68))**1.5
    return (x+sign*0.105*across*lift, y-0.025*across*lift, z)


class Mesh:
    def __init__(self, name, parent, mat, sign):
        self.name, self.parent, self.mat, self.sign = name, parent, mat, sign
        self.vertices, self.faces = [], []

    def patch(self, points, faces):
        offset = len(self.vertices)
        self.vertices.extend(points)
        for face in faces:
            a, b, c = (Vector(points[i]) for i in face[:3])
            if (b-a).cross(c-a).x*self.sign < 0:
                face = tuple(reversed(face))
            for i in range(1, len(face)-1):
                self.faces.append(tuple(offset+j for j in (face[0], face[i], face[i+1])))

    def grid(self, z0, z1, y0, y1, columns, rows, offset=0):
        points = []
        for row in range(rows+1):
            for col in range(columns+1):
                x, y, z = surface(y0+(y1-y0)*row/rows, z0+(z1-z0)*col/columns, self.sign)
                points.append((x+self.sign*offset, y, z))
        faces = []
        for row in range(rows):
            for col in range(columns):
                a = row*(columns+1)+col
                faces.append((a, a+1, a+columns+2, a+columns+1))
        self.patch(points, faces)

    def header(self):
        # Annular topology creates an actual hole in both header leaves.
        angles = [i*math.tau/96 for i in range(96)]
        angles += [math.atan2(y-HOLE_Y, z)%math.tau for y in (0.858, 1) for z in (-WIDTH/2, WIDTH/2)]
        angles = sorted(set(angles))
        count, points = len(angles), []
        for ring in range(5):
            for angle in angles:
                dz, dy = math.cos(angle), math.sin(angle)
                distances = [WIDTH/2/abs(dz)] if abs(dz) > 1e-8 else []
                if dy > 1e-8: distances.append((1-HOLE_Y)/dy)
                if dy < -1e-8: distances.append((0.858-HOLE_Y)/dy)
                radius = HOLE_RADIUS+(min(distances)-HOLE_RADIUS)*ring/4
                points.append(surface(HOLE_Y+radius*dy, radius*dz, self.sign))
        self.patch(points, [(r*count+i, r*count+(i+1)%count, (r+1)*count+(i+1)%count, (r+1)*count+i)
                            for r in range(4) for i in range(count)])

    def finish(self):
        mesh = bpy.data.meshes.new(self.name+'_Geometry')
        mesh.from_pydata([xyz(v) for v in self.vertices], [], self.faces)
        mesh.materials.append(self.mat)
        mesh.update()
        uv = mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            poly.use_smooth = True
            for loop in poly.loop_indices:
                point = self.vertices[mesh.loops[loop].vertex_index]
                uv.data[loop].uv = (point[2]/WIDTH+0.5, point[1])
        obj = bpy.data.objects.new(self.name, mesh)
        self.parent.users_collection[0].objects.link(obj)
        obj.parent = self.parent
        obj['cast_shadow'] = False
        obj['interaction'] = 'zip-bag-opening'
        obj.shape_key_add(name='Basis')
        key = obj.shape_key_add(name='Zip_Open')
        for i, point in enumerate(self.vertices): key.data[i].co = xyz(opened(point, 1 if point[0] > 0 else -1))
        key.value = 0
        return obj


def main():
    scene = bpy.data.scenes.new('Sundown Zip Bag')
    bpy.context.window.scene = scene
    collection = bpy.data.collections.new('Sundown_ZipBag_Source')
    scene.collection.children.link(collection)
    root = bpy.data.objects.new('Prop_ZipBag', None)
    collection.objects.link(root)
    for key, value in {'forward_axis': '+X', 'cell_scale_meters': 1,
                       'asset_role': 'reusable-prop', 'source_kind': 'original-reference-led',
                       'interaction': 'zip-bag-opening', 'opening_morph': 'Zip_Open',
                       'default_state': 'closed-empty'}.items(): root[key] = value
    film = material('ZipBag_ClearPolyethylene', (0.83, 0.87, 0.86), 0.25, 0.3, plastic_maps())
    seal = material('ZipBag_WeldedSeams', (0.83, 0.86, 0.81), 0.62, 0.34)
    green = material('ZipBag_GreenClosure', (0.005, 0.36, 0.20), 1, 0.32)
    for sign, suffix in [(1, 'Front'), (-1, 'Back')]:
        body = Mesh('ZipBag_Film'+suffix, root, film, sign)
        body.grid(-WIDTH/2, WIDTH/2, 0, 0.86, 36, 48)
        body.header()
        body.finish()
        seams = Mesh('ZipBag_Seams'+suffix, root, seal, sign)
        seams.grid(-WIDTH/2, -WIDTH/2+0.007, 0, 0.862, 1, 48, 0.0005)
        seams.grid(WIDTH/2-0.007, WIDTH/2, 0, 0.862, 1, 48, 0.0005)
        seams.grid(-WIDTH/2, WIDTH/2, 0, 0.009, 36, 1, 0.0005)
        if sign == 1:
            # Weld the two film leaves along the sides and bottom, leaving the mouth openable.
            paths = [[(0.862*i/48, z) for i in range(49)] for z in (-WIDTH/2, WIDTH/2)]
            paths.append([(0, WIDTH*(i/36-0.5)) for i in range(37)])
            for path in paths:
                points = [surface(y, z, side) for y, z in path for side in (1, -1)]
                seams.patch(points, [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(len(path)-1)])
        for y, thickness in [(0.853, 0.003), (0.861, 0.004), (0.879, 0.0015)]:
            seams.grid(-WIDTH/2, WIDTH/2, y, y+thickness, 48, 1, 0.0012)
        seams.finish()
        strip = Mesh('ZipBag_GreenSeal'+suffix, root, green, sign)
        strip.grid(-WIDTH/2, WIDTH/2, 0.959, 0.973, 48, 2, 0.001)
        strip.finish()
    for name, location in [('ZipBag_ContentAnchor', (0, 0.4, 0)), ('ZipBag_HangingAnchor', (0, HOLE_Y, 0))]:
        anchor = bpy.data.objects.new(name, None)
        collection.objects.link(anchor)
        anchor.parent = root
        anchor.location = xyz(location)
        anchor['semantic_role'] = name
    scene['reference'] = 'IMG_0548.jpeg; user-provided photo; original geometry and textures'
    scene['physical_dimensions'] = 'Unknown; height 1 game cell, width 0.62 cells'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True,
                              use_active_scene=True, export_extras=True, export_yup=True,
                              export_morph=True, export_morph_normal=True, export_tangents=True)
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.region_3d.view_location = (0, 0, 0.5)
            area.spaces.active.region_3d.view_distance = 2
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    triangles = sum(len(o.data.polygons) for o in collection.objects if o.type == 'MESH')
    receipt = {'schemaVersion': 1, 'blenderVersion': bpy.app.version_string,
               'source': str(SOURCE.relative_to(ROOT)).replace(chr(92), '/'),
               'reference': str(REFERENCE.relative_to(ROOT)).replace(chr(92), '/'),
               'referenceSha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
               'assets': [{'name': 'Prop_ZipBag', 'triangles': triangles, 'parts': 6,
                           'forwardAxis': '+X', 'heightCells': 1, 'widthCells': WIDTH,
                           'morphTarget': 'Zip_Open', 'use': 'reserve'}]}
    REPORT.write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
    print('ZIP_BAG_COMPLETE', triangles, 'triangles')


if __name__ == '__main__':
    main()
