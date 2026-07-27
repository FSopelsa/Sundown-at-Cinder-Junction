# Runtime assets

Assets in this folder are served unchanged by Vite.

- `environment/` — map backgrounds and switchyard props
- `enemies/` — enemy sprites and animation sheets
- `towers/` — tower sprites and animation sheets
- `ui/` — icons and decorative interface art
- `fx/` — projectiles, impacts, and elemental effects
- `audio/` — music and sound effects

Register stable runtime keys in `src/game/assets/manifest.js` instead of
scattering file paths through gameplay code.
