# Snabba skor Verification

Verified 2026-09-18 using Blender 5.2.1 LTS and Chromium WebGL.

`npm.cmd run check` completed with exit code 0:

- 85 Node tests passed, including material/export receipts, real hole raycasts,
  bottom weld, scale, both attachment anchors, independent opening on clones,
  clamped values and invalid-input handling.
- Production build passed with the existing non-blocking large-chunk warning.
- All seven GLBs validated with zero errors and zero warnings. The bag also had
  zero informational notices.
- All three browser suites passed. The collection viewer now renders 30 models.
- Bag screenshots and pixel comparisons covered closed/open desktop states,
  a front view and an open mobile view. The opening slider changes the rendered
  mesh, hides for other models and does not overlap the mobile statistics.

`node scripts/review-snabba-skor.mjs http://127.0.0.1:5174` passed a temporary
in-game placement test with closed and open instances. Both sat 0.004 units
above the floor, their opening values were independent, and all bag meshes
respected the no-opaque-shadow flag. Adding the presentation objects did not
change serialized simulation state. A raid started with no console or request
errors. These review-only instances are not saved or added to a level definition.

Blender MCP imported and displayed both final states in a separate review scene:
two bag roots, 18 objects total. Existing scenes were preserved, safe mode stayed
enabled, and the editable source remains in the separate saved `.blend` file.

Evidence is under `artifacts/playtest/snabba-skor/` (ignored generated outputs),
including the check log, browser review receipt and desktop/mobile/battlefield
captures. The final GLB size and SHA-256 are in `build-report.json`.

This verifies a reusable openable visual prop, not an inventory/pickup system,
cloth physics, liquid-tight simulation, measured physical dimensions or a
frame-rate guarantee. See README for those deliberate scope boundaries.
