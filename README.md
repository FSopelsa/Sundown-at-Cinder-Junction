# Sundown at Cinder Junction

A hobby project where I'm building a space-western elemental tower-defense
game. It currently uses **Three.js + WebGL**, Blender-made GLB assets, and a
plain JavaScript simulation for the game rules.

### Quick start

Start with `main`:

```powershell
git clone https://github.com/FSopelsa/Sundown-at-Cinder-Junction.git
Set-Location Sundown-at-Cinder-Junction
npm.cmd ci
npm.cmd run check
npm.cmd run dev -- --host 127.0.0.1
```
Open the URL printed by Vite.

Expect a playable prototype with unfinished environments and UI. There is no
hosted build yet. The **Asset library** link opens the reference-led 3D model collection,
including the active hero/towers/enemies and reserve props for later use. See
[the asset collection](docs/3d/asset-collection/README.md) for source and rebuild notes.

## Contributing

If you want to help me try or improve something, see
[`CONTRIBUTING.md`](CONTRIBUTING.md). It is intentionally short.

### Branches

- `main` is the best place to start.
- `prel/selective-studio-workflow` has the newer wall experiment.
- `prel/isometric-proving-ground` is an archived Phaser/isometric proof of
  concept. Do not develop new work there; it is retained only as historical
  comparison material. See [`docs/archive/isometric-proving-ground.md`](docs/archive/isometric-proving-ground.md).

### Expanding campaign

The default now starts in **Room 1**. Clear its two waves to reveal **Room 2**,
then clear that room to open the **sun junction**. Enemies retain the original
portal goal and cross your earlier defenses. The sun grants its required
door seal and seven seconds of regeneration.

Clear the junction to explore the **dormant boss chamber** and **elemental
workshop**. Choose one of four local TD trials at a time, earning elemental
upgrades and four keys for the future final boss. The boss fight itself is
intentionally deferred.

Each completed combat room autosaves. Otherwise, click its computer or **Go
to save machine**: Singularity must reach it before saving. Reload resumes
the newest checkpoint; the campaign panel can load either save slot. Saves
are local to this browser and server address, including its port.

Want to inspect the landmarks immediately? On the development server, open
`/?review=junction`. This review sandbox uses separate saves. The normal
campaign remains available at `/`. See [the campaign vision](docs/campaign-vision.md)
for confirmed rules, tuning assumptions and deferred ideas.

Rooms remain functional blockouts. The industrial floors, gates, consoles,
reactors, pylons, dormant sentinel and active units reuse the Blender/GLB
collection. Threshold, Smeltworks and the older maps remain selectable.

## Run locally

Requirements: Node.js 24 LTS (the version pinned in [`.nvmrc`](.nvmrc)), plus
Blender only when you want to edit or re-export models.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the displayed local Vite URL. The default route opens or resumes the expanding campaign. The
level selector still exposes the older simulation maps; they use a simple 3D
fallback room until each receives authored environment assets.

PowerShell may block `npm.ps1`; `npm.cmd` avoids changing execution policy.

### Play

- Select a tower in the Build Catalogue, then click clear room ground to
  deploy it. Click a deployed tower to inspect, upgrade, or sell it.
- Do not block an entrance, exit, or door; the global room graph must retain a
  route to the final exit.
- **Move Singularity** (or `H`) arms hero movement. Click any reachable room
  cell and the hero will cross open doors as needed. Hold `Shift` while
  building for one temporary move order, or hold `Ctrl` to queue construction.
- **Start wave** (or `Space`) begins the next raid. `P`, `1`, and `2` control
  pause and simulation speed.
- The top-right audio control mutes/unmutes HTML audio and sets the master
  volume. Select a Scrap Exchange to buy its relay aura, then expand the aura
  twice; the final 360-unit radius reaches roughly a quarter of the threshold.
- Use the mouse wheel, camera buttons, arrow keys, or right/middle drag to pan
  and zoom. **Overview** frames discovered rooms. Use the campaign panel to focus a room.

Campaign leaks reduce shared integrity and do not return in later waves.
Campaign waves scale by encounter tier and enemy type; towers and the hero
persist as rooms open. Legacy scenarios retain their returning-enemy rules.
Their enemy hull grows by 22% per completed raid, hero auto-attack damage
gains a small late-level acceleration, and the DOM HUD preserves the
raid-result and failure states.

### Blender and GLB exports

The current source scene uses one Blender unit per navigation cell (a game cell
is 40 simulation units). After editing the source, generate the runtime GLBs:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/export_cinder_threshold.py
```

The exporter writes to `public/assets/models/`. Add or change runtime entries
only through [`src/game/assets/manifest.js`](src/game/assets/manifest.js), so
content systems use stable semantic keys rather than filenames.

### Quality checks

```powershell
npm.cmd run check
```

This runs the simulation test suite and a production Vite build. The room
navigation tests cover a cross-room enemy route, hero traversal/save round
trip, and path-safe placement on both sides of the Arrival Gate. It also
validates shipped GLBs and runs a Chromium check that starts a Smeltworks raid.

To print GLB structure and size details without changing files:

```powershell
npm.cmd run assets:inspect
```

Pull requests run the same check automatically. For visual changes, also open
the game and make sure the changed part actually looks right. The previous
multi-skill hero experiment is intentionally dormant in the HUD while the
tower, bounty, and room loops are refined; its implementation is retained for
a later focused pass.

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
