# Sundown at Cinder Junction

A space-western elemental tower-defense prototype built with JavaScript,
Phaser, and Vite.

Choose Cinder Switchyard, Cinder Maze, or Cinder Overlook in the level selector, then press
**Start level** to begin a fresh run (this resets the current run).

The current build lets you choose and place a
Peacemaker, Sunspitter, Cold-Iron Longshot, Tesla Coil, or Defensive Wall; start raids; defend the
switchyard; pause; and switch between 1× and 2× simulation speed. The
Sunspitter's solar burn suppresses Rift Leech regeneration, while the
Cold-Iron Longshot slows targets at long range. Tesla Coil uses Arc lightning
to chain to four targets with 28% less damage per jump (110-unit jump range),
and deals double damage to shields. Spark Wagons carry shields that scale with
raids; violet rings and bars show their remaining capacity. Unspent damage
reaches hull when a shield breaks.

Every run also includes **Singularity**, the player-commanded hero. The
hero moves on the same tower-blocked navigation grid as the enemies,
auto-casts at hostiles within 120 units, and can be attacked in return. A fallen
hero stays down until the next raid begins.

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
- Click any deployed tower to inspect its range, stats, and upgrade choices.
- Upgrade from level 1 to 3, choosing **+50% damage** or **+50% attack speed**
  at each step. Choices stack and may be mixed. Damage also boosts Sunspitter
  burn damage. Upgrades cost 75%, then 150%, of the tower's base price, rounded up.
- Use **Sell** in a selected tower’s details to reclaim 80% of every Scrap cost
  invested in that tower, including its upgrades. While building, click a
  Defensive Wall to replace it in one action; its 80% salvage is applied toward
  the new tower’s cost.
- Use **Back to build** to return to the catalogue and **Refit towers** to dismiss
  a cleared-raid panel before building or upgrading.
- `Space` starts the next raid.
- `P` pauses or resumes.
- `1` and `2` select simulation speed.
- The **Move Singularity** control is active when a level begins. Click clear ground
  to issue a movement order, or press `H` to return to hero commands after
  choosing a tower. The route redirects around towers.

Clearing a raid opens a result panel with a button for the next raid. If the
station falls, the failure panel offers a fresh run.

## Cinder Maze

Start with 480 Scrap on an open 24×10 grid. Each tower occupies one cell.
Enemies follow the shortest open route from IN to OUT using horizontal and
vertical movement. The lit line shows the current shortest entrance route;
enemies already on the field recalculate from their own positions as you build.
The hover cell turns red for invalid placement. You cannot seal the route,
trap an enemy, build on the entrance/exit, or build across an enemy's current
step. This level uses the same eleven raids, elemental effects, and upgrade
rules as the original switchyard. A linked Worm Tunnel is a real route edge,
so it can shorten an otherwise long maze without bypassing path validation.

## Singularity hero and abilities

Singularity gains a small amount of XP for nearby enemy deaths, even if a tower
gets the final hit. A hero kill grants the larger kill-XP award. Each hero
level raises maximum hull and damage so the hero can keep pace with stronger
later raids; level-up healing preserves the gain immediately. The HUD shows
current hull, XP, level, and attack stats.

The ability bar is saved with the run. Skills unlock from level 1 through 5:

- **Gravity Well** (level 1): targets open ground, slows nearby enemies, drains
  hull, grows from the hull stolen, and collapses into a Scrap pile. Walking
  Singularity over that pile converts it into Scrap and restores hull.
- **Time Dilation** (level 2): temporarily gives all deployed towers 1.65×
  attack speed.
- **Void Rend** (level 3): targets a nearby hostile with a damage-over-time
  singularity effect.
- **Quantum Blink** (level 4): teleports Singularity to an empty grid cell.
- **Worm Tunnel** (level 5): click two endpoints. Maze enemies include the
  portal link in their shortest-path field; on Switchyard, enemies take the
  forward portal on the rail route.

## Cinder Overlook: isometric trial

This new 18x12 maze starts with 650 Scrap. Its first raid mixes ordinary enemies
with shielded Spark Wagons so Tesla chaining and shield breaking are immediately
testable. Select **Cinder Overlook · Isometric**, then **Start level**. Build a
Tesla Coil and a Cold-Iron Longshot near the IN route, move Singularity closer
to the route, and start the raid. The original maps remain selectable.

The view uses diamond tiles, elevated sprite anchors, shadows, and depth sorting.
`src/phaser/presentation/BattlefieldProjection.js` owns the forward and inverse
transforms. Clicking, placement previews, range overlays, paths, and attack
effects all use that boundary. Simulation coordinates, navigation, saves, and
combat distances stay in the original rectangular grid.

For a comparison with identical map rules, open `?level=cinder-overlook&view=top-down`.
Normal isometric view uses `?level=cinder-overlook`. Each URL starts a fresh run.

## Sprite sources and browser checks

The new atlases, JSONs, and previews are under `assets/sprites/`, immediately above
their `base_images` folders. Selected runtime copies are in `public/assets/sprites`.
See [the asset pipeline](assets/sprites/ASSET_PIPELINE.md) for reproducible packing
and generation prompts. Source photos/GIFs remain unchanged.

The opt-in `&debug` URL parameter exposes local diagnostics only during Vite
development. It is excluded from production builds. With Playwright installed,
run `node scripts/playtest-assets.cjs`, `node scripts/playtest-isometric.cjs`, and
`node scripts/playtest-hero-skills.cjs`
against the dev server (default port 5174; pass your base URL as the first argument).
Set `PLAYWRIGHT_CHANNEL` if using a browser other than the default installed Edge.
Screenshots/results go to ignored `artifacts/playtest/`.

`node scripts/benchmark-presentation.cjs` compares the same 100-enemy/24-tower
workload in both views. Timings are local headless diagnostics, not a frame-rate
guarantee for other devices.

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
