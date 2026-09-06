# Runtime assets

Assets in this folder are served unchanged by Vite.

- `environment/` — map backgrounds and switchyard props
- `enemies/` — enemy sprites and animation sheets
- `towers/` — tower sprites and animation sheets
- `ui/` — icons and decorative interface art
- `fx/` — projectiles, impacts, and elemental effects
- `audio/` — music and sound effects
- `sprites/` — shared PNG/JSON animation atlases for cryo, Tesla, and Singularity

Register stable runtime keys in `src/game/assets/manifest.js` instead of
scattering file paths through gameplay code.

Editable sprite exports and their atlas JSON live under `assets/sprites/`.
Copy the selected runtime PNG and JSON atlas into this folder only when the
asset is ready to ship in the game.

See `assets/sprites/ASSET_PIPELINE.md` for sources, generation prompts, and the
repeatable packing command. Phaser reads animation definitions from the JSON.
