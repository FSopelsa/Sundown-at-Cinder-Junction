# Cinder Threshold Blender source

The newer [reference-led collection](../../docs/3d/asset-collection/README.md)
contains 29 hero, tower, enemy, floor and reserve models. Its source is
`cinder-asset-collection.blend`; rebuild with `build_asset_collection.py`, then
`npm.cmd run assets:prepare`. Inspect the collection in the game at `/?assets`.
The older room/prototype workflow below remains available independently.

The separately authored [clear zip bag](../../docs/3d/zip-bag/README.md) adds an
openable transparent prop. Its source is `cinder-zip-bag.blend`; rebuild with
`build_zip_bag.py`, then `npm.cmd run assets:prepare:zip-bag`.

`export_cinder_threshold.py` builds the first 3D milestone's source scene in
Blender and exports three GLB files into `public/assets/models/`:

- `cinder-arrival-yard.glb`
- `cinder-relay-hall.glb`
- `cinder-prototype-units.glb`

The source uses **one Blender unit per navigation cell**. In the simulation,
one cell is 40 units, so the Three.js adapter converts simulation positions by
`1 / 40` when it places a model. Both room exports are currently clean,
15 × 20-cell floor-tile blockouts; temporary crates, pylons, tanks, and relay
props are intentionally omitted until authored obstacle assets are ready.

Open the generated `cinder-threshold-prototype.blend` to refine the materials,
geometry, and lighting. Re-run the script after changes that should replace the
prototype exports:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/export_cinder_threshold.py
```

These assets are a functional, unapproved first-milestone blockout. The room
brief and opening schedule live in `docs/3d/cinder-threshold/`; use that package
for the later art/form review before treating an export as final environment art.
