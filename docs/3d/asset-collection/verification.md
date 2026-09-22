# Asset Collection Verification

Verified locally on 2026-09-17 with Blender 5.2.1 LTS and Chromium on the host
NVIDIA GeForce RTX 2060. This is a usable prototype collection, not final art
approval against the higher-fidelity `graphicInspo` references.

## Automated Checks

`npm.cmd run check` completed with exit code 0:

- 83 Node tests passed, including collection naming, model bounds, origin pivots,
  vertex colours, package hashes, independent motion and shared instanced floors.
- Production build passed. Vite still reports the non-blocking large-chunk warning.
- All six manifest GLBs validated with zero errors and zero warnings. The floor
  kit has informational unused-tangent notices on primitives without normal maps.
- Both browser suites passed. The existing four-room raid flow still works.
- All 29 models loaded and produced nonblank canvas pixels in the asset viewer.
  Search, selection, turntable, wireframe, desktop and mobile layout were exercised.

Browser checks use full Chromium headless to get host GPU rendering. The first
restricted runs completed assertions but stalled while shutting down the preview
server; rerunning with normal local process permissions exited cleanly. The
headless-shell software renderer was unsuitable for this local WebGL workload.

## Player-Facing Review

`node scripts/review-asset-collection.mjs`, after the browser tests and with the
development server on port 5173, captures the model contact sheet and a normal
HUD-driven game smoke test. It built and selected a Peacemaker, built a defensive
wall and started a raid without console errors, failed asset requests or model
load failures. Singularity used `Unit_Hero`. Both rooms used the new floor kit,
with 12 instance batches total and the old overlapping floor plates hidden.

Reviewed screenshots include all 29 models, the 1440x1000 desktop viewer,
390x844 mobile viewer and 1600x1000 live battlefield. Local evidence is under
`artifacts/playtest/asset-collection/`; per-model browser captures are under
`test-results/`. These generated review files are intentionally ignored by Git.

Blender MCP imported all three finished kits into a separate live review scene:
29 model roots and 169 objects. Viewport screenshot and scene inspection passed.
The original scene and earlier review scene were retained. Safe mode remains on;
the editable source is saved separately at
`assets/blender/cinder-asset-collection.blend`.

## Remaining Art Work

- The 12 reserve models are inspectable and reusable, but have no new gameplay
  behavior and are not downloaded during normal play.
- Motion is presentation-only, using rigid parts. There are no skeletal rigs,
  authored animation clips or LOD chains yet.
- The floor has an original procedural normal map. Characters and machinery use
  vertex-colour PBR materials; detailed wear and baked surface textures remain.
- No frame-rate benchmark or low-end-device performance claim is made. The live
  smoke frame measured 565 render calls and 230,848 triangles, including the
  existing environment and shadows; further batching remains useful.
- Reference images and watermarks are not shipped as runtime textures. Source
  licensing is unknown where not supplied. See the provenance record before
  considering any direct reuse of the original images.
