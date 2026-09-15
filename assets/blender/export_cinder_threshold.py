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


ROOM_COLUMNS = 15
ROOM_ROWS = 20


def add_room(name, floor_material, wall_material, light_material, left_door, right_door):
    """Build a 15 x 20 metre room module at a local origin."""
    room = make_group(name)
    room["cell_scale_meters"] = 1.0
    room["navigation_width_cells"] = ROOM_COLUMNS
    room["navigation_depth_cells"] = ROOM_ROWS

    add_box("Floor slab", (ROOM_COLUMNS / 2, -0.10, ROOM_ROWS / 2), (ROOM_COLUMNS, 0.20, ROOM_ROWS), floor_material, room, 0.03)
    # Uneven inset plating makes the travel surface read as a built space
    # without using bitmap placeholder textures.
    for col in range(ROOM_COLUMNS):
        for row in range(ROOM_ROWS):
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

    for col in range(ROOM_COLUMNS):
        wall_segment(f"North wall {col}", (col + 0.5, 0.75, 0.0))
        wall_segment(f"South wall {col}", (col + 0.5, 0.75, ROOM_ROWS))
    for row in range(ROOM_ROWS):
        if row != left_door:
            wall_segment(f"West wall {row}", (0.0, 0.75, row + 0.5), math.pi / 2)
        if row != right_door:
            wall_segment(f"East wall {row}", (ROOM_COLUMNS, 0.75, row + 0.5), math.pi / 2)

    def doorway(label, x, row, flip=False):
        direction = -1 if flip else 1
        add_box(f"{label} pillar A", (x, 0.9, row + 0.08), (0.20, 1.8, 0.22), "brass", room, 0.03)
        add_box(f"{label} pillar B", (x, 0.9, row + 0.92), (0.20, 1.8, 0.22), "brass", room, 0.03)
        add_box(f"{label} lintel", (x, 1.74, row + 0.5), (0.20, 0.20, 1.20), "brass", room, 0.03)
        lamp = add_box(f"{label} lamp", (x + direction * 0.12, 1.55, row + 0.5), (0.10, 0.10, 0.45), light_material, room, 0.02)
        lamp.rotation_euler[2] = math.pi / 2

    doorway("West entry", 0.0, left_door, True)
    doorway("East entry", float(ROOM_COLUMNS), right_door)

    return room


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


def make_defensive_wall(parent):
    """Build one 1 x 1 metre wall cell with independently hideable end caps."""
    wall = make_group("Tower_Wall", parent)
    wall["asset_role"] = "buildable-grid-wall"
    wall["cell_width_m"] = 1.0
    wall["long_axis"] = "+X"

    core = make_group("Tower_Wall_Core", wall)
    # The core reads as a weathered industrial barricade: a heavy plinth,
    # framed open bays, oxidized plate inserts, and a reinforced top rail.
    add_box("Tower_Wall foundation", (0, 0.10, 0), (0.86, 0.20, 0.20), "dark_metal", core, 0.018)
    add_box("Tower_Wall lower rail", (0, 0.30, 0), (0.78, 0.15, 0.16), "metal", core, 0.018)
    add_box("Tower_Wall upper rail", (0, 0.90, 0), (0.78, 0.16, 0.17), "metal", core, 0.018)
    add_box("Tower_Wall left upright", (-0.34, 0.60, 0), (0.12, 0.66, 0.17), "rust", core, 0.014)
    add_box("Tower_Wall right upright", (0.34, 0.60, 0), (0.12, 0.66, 0.17), "rust", core, 0.014)
    add_box("Tower_Wall left inset", (-0.16, 0.57, -0.015), (0.18, 0.36, 0.08), "teal", core, 0.012)
    add_box("Tower_Wall right inset", (0.16, 0.57, -0.015), (0.18, 0.36, 0.08), "teal", core, 0.012)
    add_box("Tower_Wall warning plate", (0, 0.56, -0.035), (0.12, 0.42, 0.07), "brass", core, 0.010)
    add_box("Tower_Wall lower brace", (0, 0.46, 0.055), (0.62, 0.07, 0.09), "dark_metal", core, 0.010)

    def add_end_cap(name, x):
        end_cap = make_group(name, wall)
        add_box(f"{name} post", (x, 0.54, 0), (0.14, 1.08, 0.26), "dark_metal", end_cap, 0.020)
        add_box(f"{name} collar", (x, 0.37, -0.005), (0.18, 0.11, 0.29), "rust", end_cap, 0.012)
        add_box(f"{name} crown", (x, 1.08, 0), (0.20, 0.12, 0.30), "metal", end_cap, 0.016)
        add_box(f"{name} foot", (x, 0.08, 0), (0.22, 0.16, 0.34), "dark_metal", end_cap, 0.014)
        add_cylinder(f"{name} signal bolt", (x, 0.98, -0.15), 0.035, 0.08, "brass", end_cap, vertices=8)
        return end_cap

    # The posts stop precisely at the cell boundaries. When two cells touch,
    # Three.js hides their shared cap groups so a straight run becomes one rail.
    add_end_cap("Tower_Wall_End_Negative", -0.43)
    add_end_cap("Tower_Wall_End_Positive", 0.43)
    return wall


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
    make_defensive_wall(kit)
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
    arrival = add_room("CinderArrivalYard", "floor_rust", "rust", "teal", left_door=10, right_door=10)
    relay = add_room("CinderRelayHall", "floor_teal", "metal", "violet", left_door=10, right_door=10)
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
