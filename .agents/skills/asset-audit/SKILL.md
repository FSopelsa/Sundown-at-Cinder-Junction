---
name: asset-audit
description: Read-only GLB admission and runtime-asset audit for Sundown at Cinder Junction.
---

# Sundown asset audit

Use this skill before admitting or materially changing a runtime asset. It is a
small review aid, not an asset-production pipeline and never writes or deletes
files.

## Scope

- Editable authored sources belong in `assets/blender/`.
- Shipped 3D assets are `.glb` files in `public/assets/models/`.
- `src/game/assets/manifest.js` is the only place that associates a runtime
  filename with a stable semantic key.
- `assets/archive/legacy-2d-sprites/` is historical source material, not a
  shipped Three.js runtime path.

## Audit

1. Read `AGENTS.md`, `public/assets/README.md`, the applicable Blender export
   note, and `src/game/assets/manifest.js`.
2. Run `npm.cmd run assets:validate`; it must pass before the asset can ship.
   Run `npm.cmd run assets:inspect` to report mesh, material, texture, and
   file-size information without modifying anything.
3. Check each changed GLB has one manifest entry and that the entry uses a
   semantic key rather than leaking a filename into gameplay or presentation
   code. Check that every manifest model path exists.
4. Confirm the source of each model is either the matching Blender source in
   `assets/blender/` or an explicitly documented external-source exception in
   `docs/3d/provenance/`. An external record must state source, licence,
   acquisition date, intended use, scale, and optimisation state. A visual
   reference is not a shippable asset.
5. Review reported GLB sizes rather than imposing an invented universal cap.
   Flag unexpected growth and ask for a budget decision when an asset would
   make the runtime meaningfully heavier.
6. Inspect the source/export for the project coordinate contract: one Blender
   unit per navigation cell, pivot at the cell centre, local ground at `Y=0`,
   and logical facing along local `+X`. Reusable modules need stable semantic
   node names.
7. For a player-visible model change, smoke-test it in a browser raid. Verify
   room seams, ground contact, facing, scale, and that it does not alter
   serializable simulation or navigation data.

## Report

Return a compact report with:

- files and manifest keys checked;
- GLB validation result and observed sizes;
- source/provenance status;
- pivot, node-name, and browser-review status;
- only concrete warnings and the next action.

Do not recommend renaming, optimising, or deleting an asset without evidence
from this audit and the user's approval.
