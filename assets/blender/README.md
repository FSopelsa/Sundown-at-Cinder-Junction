# Cinder Threshold Blender source

`export_cinder_threshold.py` builds the first 3D milestone's source scene in
Blender and exports three GLB files into `public/assets/models/`:

- `cinder-arrival-yard.glb`
- `cinder-relay-hall.glb`
- `cinder-prototype-units.glb`

The source uses **one Blender unit per navigation cell**. In the simulation,
one cell is 40 units, so the Three.js adapter converts simulation positions by
`1 / 40` when it places a model.

Open the generated `cinder-threshold-prototype.blend` to refine the materials,
geometry, and lighting. Re-run the script after changes that should replace the
prototype exports:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/export_cinder_threshold.py
```

These assets are a functional, unapproved first-milestone blockout. The room
brief and opening schedule live in `docs/3d/cinder-threshold/`; use that package
for the later art/form review before treating an export as final environment art.
