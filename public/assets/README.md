# Runtime assets

Vite serves this directory unchanged at `/assets/...`.

- `models/` — shipped glTF 2.0 / GLB room and unit assets.
- `audio/` — music and effects used by the DOM HUD and Three.js audio adapter.
- `environment/`, `enemies/`, `towers/`, `fx/`, and `ui/` — reserved for
  future shipped assets.
- Legacy 2D source exports belong in `assets/archive/legacy-2d-sprites/`; they
  are not shipped by the Three.js renderer.

Register every runtime asset in `src/game/assets/manifest.js`. Gameplay code
must use the semantic manifest key, not a filename. Editable Blender sources
and their export instructions live in `assets/blender/`.

## Admitting a GLB

For every model added or changed:

1. Keep its editable source in `assets/blender/` (or document the approved
   external-source exception). A Blender unit is one navigation cell; the pivot
   is cell-centre at local ground `Y=0`, with logical facing along local `+X`.
2. Register the runtime path once in `src/game/assets/manifest.js`, using a
   stable semantic key. Give reusable GLB nodes stable semantic names.
3. For a third-party source, add a short record under `docs/3d/provenance/`
   with source, licence, acquisition date, intended use, scale, and any
   optimisation performed. Reference images are not runtime assets.
4. Run `npm.cmd run assets:validate` and `npm.cmd run assets:inspect`, review
   the reported GLB sizes, then verify the model's alignment in a browser raid.

The automated check validates glTF structure. Pivot, scale, semantic node
names, manifest intent, provenance, and player-facing alignment remain deliberate
human review points.
