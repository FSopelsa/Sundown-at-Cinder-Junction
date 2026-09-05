# Sundown at Cinder Junction

A space-western elemental tower-defense prototype built with JavaScript,
Phaser, and Vite.

The current build is a playable first-combat beat: choose and place a
Peacemaker, Sunspitter, or Cold-Iron Longshot; start raids; defend the
switchyard; pause; and switch between 1× and 2× simulation speed. The
Sunspitter's solar burn suppresses Rift Leech regeneration, while the
Cold-Iron Longshot slows targets at long range. Placeholder shapes are
generated at runtime, so no art download is required.

Enemies gain 18% more hull for each raid after the first, with a small speed
increase. Enemies that breach the station still damage its integrity, then
return as the first reinforcements in the next raid.

## Run locally

Requirements: Node.js `^20.19.0` or `>=22.12.0`.

```powershell
npm.cmd ci
npm.cmd run dev
```

PowerShell may block `npm.ps1` on Windows. Using `npm.cmd` avoids changing the
machine execution policy.

## Controls

- Select a tower in the Build Catalogue, then click clear ground to deploy it.
- `Space` starts the next raid.
- `P` pauses or resumes.
- `1` and `2` select simulation speed.

Clearing a raid opens a result panel with a button for the next raid. If the
station falls, the failure panel offers a fresh run.

## Quality checks

```powershell
npm.cmd test
npm.cmd run build
```

## Architecture

```text
src/
  game/
    assets/       Stable asset keys
    content/      Maps, enemies, towers, recipes, and waves
    input/        Actions and physical bindings
    simulation/   Serializable state and gameplay systems
  phaser/
    boot/         Placeholder texture generation
    scenes/       Thin Phaser scene adapters
  ui/
    hud/          DOM-based HUD
```

`GameState` owns saveable gameplay data. Systems mutate that state through the
simulation boundary. Phaser owns disposable visual objects, and the DOM owns
the text-heavy HUD. No Phaser object is written into save data.

Runtime assets belong under `public/assets/` and should be referenced through
`src/game/assets/manifest.js`.

The full concept and first-playable scope are documented in
[`docs/game-design.md`](docs/game-design.md).
