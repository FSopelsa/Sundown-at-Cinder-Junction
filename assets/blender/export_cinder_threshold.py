"""Build the procedural Blender source and GLB exports for Cinder Threshold.

This is intentionally a compact first-milestone environment: two traversable
rooms, a readable doorway, PBR materials, and low-poly unit/tower silhouettes.
The browser assembles dynamic gameplay entities separately from these exported
environment modules.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIRECTORY = PROJECT_ROOT / "public" / "assets" / "models"
SOURCE_FILE = Path(__file__).resolve().with_name("cinder-threshold-prototype.blend")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def make_material(name, color, metallic=0.0, roughness=0.7, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = 2.5
    return material


MATERIALS = {}


def material(name):
    return MATERIALS[name]


def blender_location(logical_location):
    """Map runtime X/Y-up/Z coordinates into Blender's X/Z-up/Y space."""
    x, y, z = logical_location
    return (x, -z, y)


def blender_dimensions(logical_dimensions):
    x, y, z = logical_dimensions
    return (x, z, y)


def make_group(name, parent=None):
    group = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(group)
    group.parent = parent
    return group


def add_box(name, location, dimensions, material_name, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=blender_location(location))
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = blender_dimensions(dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft industrial edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    return obj


def add_cylinder(name, location, radius, depth, material_name, parent=None, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=blender_location(location),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    return obj


def add_uv_sphere(name, location, radius, material_name, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16,
        ring_count=8,
        radius=radius,
        location=blender_location(location),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    return obj


def add_room(name, floor_material, wall_material, light_material, left_door, right_door):
    """Build a 12 x 8 metre room module at a local origin."""
    room = make_group(name)
    room["cell_scale_meters"] = 1.0
    room["navigation_width_cells"] = 12
    room["navigation_depth_cells"] = 8

    add_box("Floor slab", (6, -0.10, 4), (12, 0.20, 8), floor_material, room, 0.03)
    # Uneven inset plating makes the travel surface read as a built space
    # without using bitmap placeholder textures.
    for col in range(12):
        for row in range(8):
            tone = floor_material if (col + row) % 3 else "floor_dark"
            add_box(
                f"Floor plate {col}-{row}",
                (col + 0.5, 0.015, row + 0.5),
                (0.94, 0.03, 0.94),
                tone,
                room,
                0.015,
            )

    def wall_segment(label, location, rotation=0.0):
        segment = add_box(label, location, (1, 1.5, 0.18), wall_material, room, 0.035)
        segment.rotation_euler[2] = rotation
        return segment

    for col in range(12):
        wall_segment(f"North wall {col}", (col + 0.5, 0.75, 0.0))
        wall_segment(f"South wall {col}", (col + 0.5, 0.75, 8.0))
    for row in range(8):
        if row != left_door:
            wall_segment(f"West wall {row}", (0.0, 0.75, row + 0.5), math.pi / 2)
        if row != right_door:
            wall_segment(f"East wall {row}", (12.0, 0.75, row + 0.5), math.pi / 2)

    def doorway(label, x, row, flip=False):
        direction = -1 if flip else 1
        add_box(f"{label} pillar A", (x, 0.9, row + 0.08), (0.20, 1.8, 0.22), "brass", room, 0.03)
        add_box(f"{label} pillar B", (x, 0.9, row + 0.92), (0.20, 1.8, 0.22), "brass", room, 0.03)
        add_box(f"{label} lintel", (x, 1.74, row + 0.5), (0.20, 0.20, 1.20), "brass", room, 0.03)
        lamp = add_box(f"{label} lamp", (x + direction * 0.12, 1.55, row + 0.5), (0.10, 0.10, 0.45), light_material, room, 0.02)
        lamp.rotation_euler[2] = math.pi / 2

    doorway("West entry", 0.0, left_door, True)
    doorway("East entry", 12.0, right_door)

    # A sparse, symmetric prop rhythm leaves traversal and tower cells legible.
    for x, z in ((2.0, 1.3), (2.0, 6.7), (10.0, 1.3), (10.0, 6.7)):
        add_cylinder("Signal pylon", (x, 0.75, z), 0.18, 1.5, "metal", room)
        add_box("Pylon lamp", (x, 1.52, z), (0.34, 0.12, 0.34), light_material, room, 0.03)

    return room


def add_crate(parent, location, scale, material_name="rust"):
    crate = add_box("Salvage crate", location, scale, material_name, parent, 0.04)
    for offset in (-0.30, 0.30):
        add_box("Crate band", (location[0] + offset, location[1], location[2]), (0.06, scale[1] + 0.02, scale[2] + 0.02), "brass", parent, 0.01)
    return crate


def decorate_arrival_yard(room):
    add_crate(room, (4.0, 0.38, 2.0), (0.9, 0.72, 0.8))
    add_crate(room, (4.85, 0.28, 2.15), (0.55, 0.52, 0.55), "metal")
    add_cylinder("Water tank", (8.3, 0.65, 5.8), 0.65, 1.3, "teal", room, vertices=16)
    add_box("Crane beam", (6.0, 2.1, 1.1), (3.8, 0.16, 0.16), "metal", room, 0.02)
    add_box("Crane post", (4.15, 1.1, 1.1), (0.16, 2.2, 0.16), "metal", room, 0.02)


def decorate_relay_hall(room):
    add_cylinder("Relay core", (6.0, 1.1, 4.0), 0.80, 2.2, "dark_metal", room, vertices=16)
    add_cylinder("Relay glow", (6.0, 1.1, 4.0), 0.48, 2.28, "violet", room, vertices=16)
    for x, z in ((4.2, 4.0), (7.8, 4.0)):
        add_box("Relay conduit", (x, 0.22, z), (1.4, 0.20, 0.34), "teal", room, 0.02)
    add_crate(room, (9.3, 0.32, 2.0), (0.75, 0.62, 0.75), "dark_metal")


def make_unit(parent, name, color, body_radius, height, accent=None):
    root = make_group(name, parent)
    add_cylinder(f"{name} body", (0, height * 0.48, 0), body_radius, height * 0.76, color, root, vertices=10)
    add_uv_sphere(f"{name} head", (0, height * 0.93, 0), body_radius * 0.68, accent or color, root)
    add_box(f"{name} shadow plate", (0, 0.04, 0), (body_radius * 2.1, 0.08, body_radius * 1.6), "dark_metal", root, 0.03)
    return root


def make_tower(parent, name, base_color, accent_color, barrel_length=0.9):
    root = make_group(name, parent)
    add_cylinder(f"{name} base", (0, 0.18, 0), 0.42, 0.36, "dark_metal", root, vertices=12)
    add_cylinder(f"{name} housing", (0, 0.55, 0), 0.27, 0.52, base_color, root, vertices=10)
    barrel = add_box(f"{name} barrel", (0, 0.73, -barrel_length * 0.42), (0.18, 0.18, barrel_length), accent_color, root, 0.03)
    barrel.rotation_euler[0] = math.radians(-7)
    return root


def build_units():
    kit = make_group("CinderPrototypeUnits")
    make_unit(kit, "Unit_Hero", "brass", 0.28, 1.30, "teal")
    make_unit(kit, "Unit_DustMite", "rust", 0.20, 0.45, "brass")
    make_unit(kit, "Unit_RustRunner", "rust", 0.25, 0.58, "metal")
    make_unit(kit, "Unit_TinbackHauler", "metal", 0.38, 0.72, "brass")
    make_unit(kit, "Unit_SparkWagon", "teal", 0.34, 0.64, "violet")
    make_unit(kit, "Unit_RiftLeech", "violet", 0.28, 0.42, "teal")
    make_unit(kit, "Unit_SiegeCrawler", "dark_metal", 0.45, 0.72, "rust")
    make_unit(kit, "Unit_BlackComet", "dark_metal", 0.62, 1.10, "violet")
    make_tower(kit, "Tower_Peacemaker", "rust", "brass")
    make_tower(kit, "Tower_Sunspitter", "rust", "brass", 1.05)
    make_tower(kit, "Tower_ColdIronLongshot", "teal", "teal", 1.28)
    make_tower(kit, "Tower_TeslaCoil", "metal", "violet", 0.72)
    make_tower(kit, "Tower_ScrapExchange", "rust", "teal", 0.35)
    wall = make_group("Tower_Wall", kit)
    add_box("Tower_Wall slab", (0, 0.62, 0), (0.94, 1.24, 0.20), "metal", wall, 0.03)
    return kit


def descendants(root):
    result = [root]
    for child in root.children:
        result.extend(descendants(child))
    return result


def export_group(root, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(filename),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
    )


def add_authoring_camera():
    bpy.ops.object.camera_add(location=blender_location((11.0, 14.0, 18.0)))
    camera = bpy.context.active_object
    camera.name = "PrototypeCamera"
    camera.data.lens = 42
    bpy.context.scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=blender_location((6.0, 8.0, 4.0)))
    bpy.context.active_object.data.energy = 1100
    bpy.context.active_object.data.shape = "DISK"
    bpy.context.active_object.data.size = 8.0


def main():
    EXPORT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    clear_scene()
    MATERIALS.update({
        "floor_rust": make_material("Floor_Rust", (0.22, 0.10, 0.055), metallic=0.55, roughness=0.68),
        "floor_teal": make_material("Floor_Teal", (0.055, 0.16, 0.17), metallic=0.68, roughness=0.55),
        "floor_dark": make_material("Floor_Dark", (0.035, 0.045, 0.055), metallic=0.48, roughness=0.82),
        "rust": make_material("Rust_PaintedSteel", (0.38, 0.095, 0.035), metallic=0.70, roughness=0.51),
        "metal": make_material("Oxidized_Metal", (0.20, 0.25, 0.27), metallic=0.84, roughness=0.42),
        "dark_metal": make_material("Soot_BlackMetal", (0.025, 0.032, 0.040), metallic=0.72, roughness=0.39),
        "brass": make_material("Frontier_Brass", (0.53, 0.26, 0.07), metallic=0.88, roughness=0.29),
        "teal": make_material("Oxidized_Teal", (0.03, 0.36, 0.38), metallic=0.66, roughness=0.36, emission=(0.01, 0.08, 0.09)),
        "violet": make_material("Arc_Violet", (0.24, 0.06, 0.42), metallic=0.44, roughness=0.25, emission=(0.22, 0.02, 0.55)),
    })
    arrival = add_room("CinderArrivalYard", "floor_rust", "rust", "teal", left_door=3, right_door=3)
    relay = add_room("CinderRelayHall", "floor_teal", "metal", "violet", left_door=3, right_door=3)
    decorate_arrival_yard(arrival)
    decorate_relay_hall(relay)
    unit_kit = build_units()
    add_authoring_camera()

    bpy.context.scene["asset_status"] = "functional-prototype-unapproved"
    bpy.context.scene["unit_contract"] = "one Blender metre equals one room-grid cell"
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_FILE))
    export_group(arrival, EXPORT_DIRECTORY / "cinder-arrival-yard.glb")
    export_group(relay, EXPORT_DIRECTORY / "cinder-relay-hall.glb")
    export_group(unit_kit, EXPORT_DIRECTORY / "cinder-prototype-units.glb")
    print(f"Exported GLBs to {EXPORT_DIRECTORY}")


if __name__ == "__main__":
    main()
