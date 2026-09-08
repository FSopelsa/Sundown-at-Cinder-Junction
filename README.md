# Sundown at Cinder Junction

A space-western elemental tower-defense prototype. The battlefield now uses
**Three.js + WebGL**, with Blender-authored GLB assets, while the game rules
remain in the existing serializable JavaScript simulation.

## First 3D milestone

The default level, **Cinder Threshold · 3D Trial**, contains two connected
rooms: Arrival Yard and Relay Hall. They retain separate grid coordinates and
are joined by the open Arrival Gate. This proves the intended expansion model:

- enemy routing crosses the room-aware graph from the first room to the final
  exit;
- Singularity can route through the same door connection;
- tower placement preserves one global route and keeps doors clear;
- `GameState` persists room IDs, open doors, hero routes, and the existing
  wave/economy/progression state;
- Three.js presents GLB rooms, units, shadows, camera controls, procedural
  idle/movement motion, hit/death effects, and elemental combat beams;
- the DOM HUD and HTML-audio system remain independent of the renderer.

The GLBs are deliberately **functional blockouts**, not final environment art.
Their Blender source is at [`assets/blender/`](assets/blender/), and the room
package at [`docs/3d/cinder-threshold/`](docs/3d/cinder-threshold/) records the
unapproved art-review gates before a final environment pass.

## Run locally

Requirements: Node.js `^20.19.0` or `>=22.12.0`, plus Blender only when you
want to edit or re-export models.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the displayed local Vite URL. The default route opens the 3D trial. The
level selector still exposes the older simulation maps; they use a simple 3D
fallback room until each receives authored environment assets.

PowerShell may block `npm.ps1`; `npm.cmd` avoids changing execution policy.

## Play

- Select a tower in the Build Catalogue, then click clear room ground to
  deploy it. Click a deployed tower to inspect, upgrade, or sell it.
- Do not block an entrance, exit, or door; the global room graph must retain a
  route to the final exit.
- **Move Singularity** (or `H`) arms hero movement. Click any reachable room
  cell and the hero will cross open doors as needed.
- **Start raid** (or `Space`) begins the next raid. `P`, `1`, and `2` control
  pause and simulation speed.
- Use the mouse wheel, camera buttons, arrow keys, or right/middle drag to pan
  and zoom. **Overview** recenters both rooms.

Escaped enemies still reduce station integrity, then return first in the next
raid. Enemy hull grows by 18% per completed raid, and the DOM HUD preserves the
raid-result and failure states.

## Blender and GLB exports

The current source scene uses one Blender unit per navigation cell (a game cell
is 40 simulation units). After editing the source, generate the runtime GLBs:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/export_cinder_threshold.py
```

The exporter writes to `public/assets/models/`. Add or change runtime entries
only through [`src/game/assets/manifest.js`](src/game/assets/manifest.js), so
content systems use stable semantic keys rather than filenames.

## Quality checks

```powershell
npm.cmd run check
```

This runs the simulation test suite and a production Vite build. The room
navigation tests cover a cross-room enemy route, hero traversal/save round
trip, and path-safe placement on both sides of the Arrival Gate.

## Architecture

```text
src/
  game/
    assets/       Stable model and audio keys
    content/      Room maps, enemies, towers, waves, and hero data
    input/        Actions and physical bindings
    simulation/   Serializable state and gameplay systems
  three/          Disposable Three.js scene, camera, GLB presentation, effects
  ui/             DOM HUD and responsive styles
assets/blender/   Editable Blender source and deterministic GLB exporter
public/assets/    Runtime GLBs and audio served by Vite
```

`GameState` is the source of truth. Simulation systems mutate only serializable
state; the Three.js layer owns disposable render objects, and the DOM owns
text-heavy UI. No scene or Three.js object enters save data.

The broader design and the 3D migration direction are documented in
[`docs/game-design.md`](docs/game-design.md).
