# Sundown at Cinder Junction

A space-western elemental tower-defense prototype built with JavaScript,
Phaser, and Vite.

The current build is a playable architecture skeleton: place Peacemaker
turrets, start raids, defend the switchyard, pause, and switch between 1× and
2× simulation speed. Placeholder shapes are generated at runtime, so no art
download is required.

## Run locally

Requirements: Node.js `^20.19.0` or `>=22.12.0`.

```powershell
npm.cmd ci
npm.cmd run dev
```

PowerShell may block `npm.ps1` on Windows. Using `npm.cmd` avoids changing the
machine execution policy.

## Controls

- Click clear ground to place a Peacemaker turret for 40 Scrap.
- `Space` starts the next raid.
- `P` pauses or resumes.
- `1` and `2` select simulation speed.

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
