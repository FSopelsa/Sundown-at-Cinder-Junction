# Runtime assets

Vite serves this directory unchanged at `/assets/...`.

- `models/` — shipped glTF 2.0 / GLB room and unit assets.
- `audio/` — music and effects used by the DOM HUD and Three.js audio adapter.
- `environment/`, `enemies/`, `towers/`, `fx/`, and `ui/` — reserved for
  future shipped assets.
- `sprites/` — retained source-era 2D exports; they are not loaded by the
  Three.js renderer.

Register every runtime asset in `src/game/assets/manifest.js`. Gameplay code
must use the semantic manifest key, not a filename. Editable Blender sources
and their export instructions live in `assets/blender/`.
