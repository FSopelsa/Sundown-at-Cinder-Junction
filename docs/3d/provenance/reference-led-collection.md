# Reference-led collection provenance

Prepared 2026-09-17 for Sundown at Cinder Junction.

**Shipped source:** Original procedural meshes authored in
`assets/blender/build_asset_collection.py`, with editable Blender output at
`assets/blender/cinder-asset-collection.blend`. Shared PBR materials and vertex
paint are authored with the meshes. A packed 256-pixel floor normal map is
generated mathematically from an original diamond tread pattern. No supplied reference image, sprite frame,
watermark, screenshot, third-party mesh or downloaded texture is shipped.

**References:** User-provided local files inventoried with SHA-256 under
`docs/3d/asset-collection/source-inventory.json`. The user's request explicitly
authorised inspecting these files and making usable game models from their
technical and inspirational qualities. The earlier generated sprite sheets
provide continuity for Singularity and elemental towers; their prior prompts
are recorded in `assets/archive/legacy-2d-sprites/ASSET_PIPELINE.md`.

**Reference licences:** Not supplied. In particular, the TechSquid image has
Adobe Stock watermarks and the wall concept names an external artist. They
remain visual references only. No licence to redistribute those images or
their exact depicted third-party assets is asserted. No new external licence,
asset purchase or provider subscription was accepted. This record documents
original local authoring; it does not assign a new open-source licence to the
project or resolve ownership of the supplied historical files.

**Acquisition:** Already present in this user's checkout when inspected on
2026-09-17. No reference download was needed. The `graphicInspo` X URL returned
403, so the associated local screenshots supplied the visual evidence.

**Intended use:** Active hero, tower and enemy presentation; instanced floor
modules; reserve machinery, modular walls and boss/portal designs for later
production. MechDog currently presents Rust Runner and TechSquid presents Rift
Leech; their gameplay definitions and progression are unchanged.

**Scale:** One exported metre equals one navigation cell. Y-up, +X forward,
origin-centred roots. Ground/hover/floor allowances and exact bounds are in the
collection README and build report.

**Optimisation:** Batched geometry per rigid moving part, reused PBR materials,
vertex paint, a generated floor normal map, welded/deduplicated/pruned GLB data. No texture downloads or
decoder extensions. Reserve assets load only in the viewer. Package hashes
and measured sizes are in the build report. No final LOD or frame-rate budget
claim is made.
