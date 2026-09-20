# Sundown reference-led asset collection

The original 29-model collection below is joined in the library by the
separately built [Snabba skor](../snabba-skor/README.md), for 30 models total.

29 editable, original 3D models built from the visual ideas in the local asset
folders. Open `/?assets` in the running game to inspect each model, switch views,
check its wireframe and motion, or download its GLB kit. The game HUD links there.

These are stylized procedural production candidates, not a claim to match the
finished realism of the `graphicInspo` screenshots. Shapes, layered mechanical
parts, bevels, a procedural floor normal map and material separation are established.
Hand-painted wear, character normal bakes, skinning, authored animation clips and LODs remain future
art work. Runtime motion currently uses named rigid parts, not an armature.

## Collection

| Source family | Models | Current use |
| --- | --- | --- |
| `singularity_hero/` and its `base_images/` | Singularity: dark hood, black face, cyan eyes, gold orbital collar, boots and gloves | Hero |
| `cold_Iron_Longshot/`, including unnamed snow-machine photos and wireframes | Cold-Iron Longshot, cryogenic cooling plant | Tower plus reserve prop |
| `sunspitter/`, including unnamed fusion-reactor references | Sunspitter, fusion containment reactor, toroidal fusion engine | Tower plus two reserve props |
| Archived `tesla_coil/` and coil photos | Tesla Coil, tall arc relay pylon, Faraday service cage | Tower plus two reserve props |
| `MechDog_enemy/` | MechDog / Rust Runner, armored Tinback Hauler | Existing enemy types, visual replacements only |
| `TechSquid_enemy/` | Small TechSquid / Rift Leech, large TechSquid sentinel | Existing Rift Leech plus reserve model |
| `BlackComet_wave-boss/` | Black Comet, Death Comet relic, Horned Comet, Eye of Cinder | Existing boss plus three reserve models |
| `floor'ground_tiles/` | Diamond steel, service grating, hazard edge plate | Instanced room flooring |
| `walls/` | Windowed defensive wall, reinforced fortress module | Buildable wall plus reserve module |
| `map_sketch.jpg` | Threshold gate, upgrade workbench | Reserve props; the sketch does not change navigation |
| Related mechanical vocabulary | Peacemaker, Scrap Exchange, Dust Mite, Spark Wagon, Siege Crawler | Remaining current entities |
| `graphicInspo/` | Collection-wide material and construction direction | Reference only |

Duplicate images under `assets/sprites/` and `assets/archive/` are retained and
mapped to the same models. JSON atlases, raw sheets, previews and GIFs remain
source records; they are not additional distinct characters or runtime textures.
The existing Blender room/prototype source and its three exports are preserved.

## Art Direction

The three local inspiration screenshots show weathered industrial construction,
readable silhouettes, layered metal, open negative space and directional shadows.
Those are the relevant targets for this game. The linked X post could not be
fetched (403); the local screenshots were actually reviewed.

The 2D Singularity identity is retained. The cryo tower keeps the snow-cannon
mechanics but has a cell-sized turret base. Solar equipment uses containment
hardware and contrasting hot/cool components. Tesla hardware retains copper
windings, ceramic insulators and a toroidal electrode. Enemy silhouettes are
distinct at a tactical camera distance. The reference's watermarks, text,
branding and exact third-party model designs are not embedded in the exports.

## Files And Rebuild

- `assets/blender/build_asset_collection.py`: deterministic mesh authoring.
- `assets/blender/cinder-asset-collection.blend`: editable, laid-out source scene.
- `public/assets/models/cinder-authored-units.glb`: 14 active entity models.
- `public/assets/models/cinder-industrial-kit.glb`: three floor modules.
- `public/assets/models/cinder-production-reserve.glb`: 12 future-use models.
- `src/game/assets/catalogue.js`: model names, categories and activation status.
- `build-report.json`: dimensions, triangle counts, package hashes and sizes.
- `source-inventory.json`: every local source file, hash, duplicates and model mapping.

From the project root, using the installed Blender or its equivalent path on
another machine:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/build_asset_collection.py
npm.cmd run assets:prepare
npm.cmd run check
```

Rebuilding regenerates the new collection files only. Edits made directly to
the generated `.blend` need to be incorporated into the authoring script or
exported separately before a rebuild. `assets:prepare` welds, deduplicates and
prunes the new GLBs without flattening their semantic or movable hierarchy.
It also refreshes hashes and the source inventory. No remote generation service
or paid asset generation is used. Blender MCP was used for live import, scene
inspection and viewport review; the bulk build is reproducible without MCP.

## Runtime Contract

GLBs are Y-up, +X forward, one navigation cell per unit. Every model's root is
at the origin. Unit bases are at ground level; hovering parts have authored
clearance. Floor slabs extend from Y=-0.10 up to approximately Y=0, with tread
detail no higher than 0.004. Layout offsets exist only in the `.blend` review
scene. Runtime geometry does not determine navigation, damage or collision.

`Tower_Wall_Core`, `Tower_Wall_End_Negative` and
`Tower_Wall_End_Positive` retain the wall-topology contract. Movable parts have
an explicit `motion_role` extra. The presenter animates only those parts and
orients +X toward actual travel. Tower aiming follows existing combat events.

The reserve kit and old prototype units use `preload: false`; ordinary play
does not download them. All runtime filenames resolve through the manifest.
Floor geometry is instanced, six material draws per room, sharing GLB data.
Its packed 256-pixel normal map is generated from a mathematical tread pattern;
it contains none of the supplied photograph's pixels.
No additional renderer, physics engine or runtime dependency was introduced.

See [provenance](../provenance/reference-led-collection.md) for reference usage
and [verification](verification.md) for checks and remaining limitations.
