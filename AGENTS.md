# AGENTS.md

## Active architecture

Sundown at Cinder Junction is a browser-native 3D tower-defense prototype.
Keep gameplay authority in the serializable JavaScript simulation; Three.js is
the presentation adapter. The DOM owns the HUD and Vite owns development,
building, and tests.

## 3D art pipeline

- Use Blender source files under `assets/blender/` for authored or procedural
  meshes. Export runtime assets as `.glb` under `public/assets/models/`.
- Treat a Blender unit as one navigation cell. Keep model pivots at the cell
  centre, ground contact at local Y=0, and logical facing along local +X.
- Give reusable modules stable, semantic node names so Three.js can select or
  vary them without parsing mesh order.
- Prefer procedural geometry for grid walls, floors, trim, and repeated kit
  pieces. Reserve generated or purchased models for distinctive props.
- Do not ship 2D sprite sheets in the runtime path. Preserve legacy source
  exports only in the archive unless a design decision restores them.

## Source references and provenance

- Store visual references separately from shippable assets. A reference image
  is not a game texture or model licence.
- Record source, licence, scale, intended use, and optimisation state before
  admitting a third-party asset to `public/assets/`.
- Keep asset loading semantic through `src/game/assets/manifest.js`; never
  scatter filename paths through gameplay or presentation code.

## Verification

- After presentation or asset changes, run `npm.cmd run check` and perform a
  browser smoke test of the player-facing loop.
- Keep WebGL as the shipping baseline. Treat WebGPU as an optional later
  optimisation, not a gameplay dependency.
