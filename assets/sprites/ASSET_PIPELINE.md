# Elemental assets and animation exports

The canonical outputs sit one level above each `base_images` folder:

| Folder | Runtime atlas | Frames |
| --- | --- | --- |
| `cold_Iron_Longshot` | `cold-iron-longshot.png` + `.json` | 8 attack |
| `tesla_coil` | `tesla-coil.png` + `.json` | 8 attack |
| `singularity_hero` | `singularity-hero.png` + `.json` | 1 idle, 20 run, 6 cast |

Each folder also has a PNG contact sheet and animated GIF preview. Raw generated
sheets remain next to the exports for future revisions. Original supplied files
are preserved. The two hero references originally arrived directly in the hero
folder; copies are now in `singularity_hero/base_images` for a consistent layout.

AutoSprite MCP was not callable in this session. The built-in image generator
created the cryo redesign, Tesla animation, and a cast strip matching the supplied
hero. The supplied running sheet supplies the actual run cycle. Its duplicate
first frame and empty cells are not included in the runtime animation. The
original white-background cast GIF remains available as a reference.

## Rebuild

Install Python 3 and Pillow, then run from the repository root:

```text
python scripts/build_asset_atlases.py
```

This operation does not call a paid image-generation API. It repacks selected
source art, removes isolated neighbouring-cell fragments, uses one scale per
animation, and anchors the lower structure/feet consistently. Frames are
192x192 with a ground anchor at (96, 180). PNG alpha is retained. No backgrounds
are baked into the runtime PNGs.

The script copies only the runtime PNGs and JSONs into `public/assets/sprites`.
Do not place raw reference photos or preview GIFs in the runtime directory.

`meta.animations` in each JSON defines names, frame rate, and loop behavior.
BootScene reads that metadata to register animations. Keep stable runtime keys
in the asset manifest; neither atlas frame names nor Phaser objects belong in
save data. Tower attacks scale their animation playback to the upgraded firing
interval. Hero run/cast/idle playback follows movement and combat events and
obeys pause and simulation speed.

The present artwork supplies one three-quarter angle. The hero mirrors when
moving/firing left. A future rotatable view should add directional artwork or
3D models; the simulation does not need to change to add those renderers.

## Generation prompts (built-in image generator)

### Cold-Iron Longshot

Create a production-ready 2D tower-defense sprite animation sheet using the supplied snow cannon only as the mechanical reference. Transform it into Cold-Iron Longshot: cobalt-blue armored cannon housing, icy cyan bore, snow caps and visible icicles on housing and circular steel plinth; replace all tripod legs and ski feet with a compact round geared rotating turret platform. Match a polished stylized 3D-rendered RTS sprite, slight elevated three-quarter view, barrel facing upper-right/right. Transparent alpha background. EXACTLY 8 equal square cells in 4 columns x 2 rows. Each cell contains the same COMPLETE tower, same camera, scale, platform and bottom anchor; plenty of transparent padding. Frame 1 idle, 2-4 cold energy builds in bore, 5 brightest prefire, 6 short contained cyan ice discharge and slight cannon recoil on fixed platform, 7 recovery mist, 8 identical idle. No scenery, no floor shadow outside the cell, no lettering or labels, no watermark, no cell dividers. Do not rotate the entire tower between frames. All eight bases present. Clearly a TD turret, not a snowmaking appliance.

### Tesla Coil

Create a production-ready 2D tower-defense Tesla Coil sprite animation sheet inspired by the supplied Tesla coil photos. Compact space-western TD tower: wide dark steel/brass circular anchored plinth, copper coiled central column, two ceramic blue insulators, silver toroidal top electrode with a small emitter spike. Violet-white electric arcs. Polished stylized 3D-rendered RTS sprite, slightly elevated three-quarter view. Transparent alpha background. EXACTLY 8 equal square cells, 4 columns x 2 rows. Same COMPLETE tower in every cell with identical platform, position, scale and camera. 1 idle, 2-4 faint current climbs the coil and top brightens, 5 bright charged toroid, 6 short forked lightning discharge to the RIGHT contained within its cell, 7 faint residual sparks, 8 idle matching 1. Keep tower hardware stationary, only electricity changes. Wide empty padding around every tower, no cropped parts, no scenery, no labels or text, no watermark, no grid lines.

### Singularity cast

Create a production-ready animation sheet using the supplied blue Singularity hero as the exact character identity reference. Preserve its small round navy-blue hooded body, black face with two cyan eyes, gold orbital ring around head, blue boots/gloves and proportions. Transparent alpha background, no white backdrop. EXACTLY 6 equal square cells in 3 columns x 2 rows. Full body in every cell, same size and bottom-center anchor, faces RIGHT, elevated three-quarter RTS game view. Smooth casting sequence: 1 relaxed standing idle both feet planted, 2 arms draw back gathering small violet energy orb, 3 hands forward forming brighter violet singularity orb, 4 extends hands releasing short purple bolt to right contained in cell, 5 arms lower residual violet spark, 6 return to identical idle. Preserve both feet, hood and gold ring in all frames. No scenery, labels, lettering, watermarks, extra characters or grid lines.
