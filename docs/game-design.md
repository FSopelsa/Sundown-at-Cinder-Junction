# Sundown at Cinder Junction — Game Design

This document preserves the original concept and first-playable plan for the
project.

A browser-native 3D tower-defense game about defending a battered jump-rail station on the edge of settled space.

You are the last Circuit Marshal at Cinder Junction. Raiders, war machines, and alien stampedes are converging on the station while an evacuation ship prepares to launch. You build improvised gun towers, collect elemental cores from notorious outlaws, and fuse those cores into increasingly dangerous frontier weapons.

Tagline: **Hold the line. Take the bounty. Bend the elements.**

### Design pillars

- **Elemental experimentation:** Combining elements should produce genuinely different towers, not simple damage bonuses.
- **Readable tactical combat:** Strong silhouettes, obvious status effects, and no visually muddy projectile spam.
- **Frontier improvisation:** Every tower looks built from mining gear, spaceship wreckage, ranch machinery, and outlaw weapons.
- **Player-chosen escalation:** The player chooses which elemental boss to fight—and therefore which technology becomes available next.
- **Low-micro, meaningful interaction:** Most power comes from planning, with one lightweight active ability to keep combat engaging.

## The core loop

```mermaid
flowchart LR
    A["Inspect the next raid"] --> B["Build, upgrade, and fuse towers"]
    B --> C["Start the wave"]
    C --> D["Mark priority targets and adjust targeting"]
    D --> E["Destroy enemies and collect scrap"]
    E --> F{"Bounty wave?"}
    F -- "No" --> A
    F -- "Yes" --> G["Choose an elemental outlaw"]
    G --> H["Defeat the outlaw and claim its catalyst"]
    H --> I["Unlock or rank up an element"]
    I --> B
```

A normal wave should take approximately 45–70 seconds, followed by a short planning phase. Building remains available during combat, and single-player pause is allowed.

Every fifth wave becomes a **Bounty Wave**:

1. The player chooses one of several wanted elemental outlaws.
2. That outlaw changes the next wave and acts as its boss.
3. Defeating the boss awards a catalyst for its element.
4. Repeated catalysts rank that element up.
5. Owning two different elements unlocks their fusion tower.

This makes progression part of the player’s strategy: you choose what the enemy becomes because you want what they are carrying.

## Player verbs

The essential actions are:

- Place a tower
- Select an elemental recipe
- Upgrade, fuse, or sell a tower
- Choose its targeting priority
- Inspect the next wave
- Select a bounty
- Start a wave early for bonus scrap
- Use **Deadeye** on a dangerous enemy

Deadeye is the sole active combat ability. It briefly slows time and lets the player mark one target. The marked enemy takes additional damage and pays a larger bounty when destroyed. It reinforces the gunslinger fantasy without turning the game into an action game.

## Element system

Use four foundational elements. Each should solve a different tactical problem.

| Element | Combat identity | Frontier presentation |
|---|---|---|
| Solar | Burning damage and regeneration suppression | Furnaces, flare rounds, glowing barrels |
| Cryo | Slowing and applying brittle | Refrigerant tanks, frost coils, cold smoke |
| Arc | Chaining damage and breaking shields | Tesla spurs, power lines, crackling lassos |
| Grav | Pulling enemies and stripping armor | Mining equipment, mass drivers, dark distortion |

Avoid complete elemental immunity. Resistant enemies can take roughly 30–40% less damage, but the player’s build should never become completely useless.

### Example towers

- **Peacemaker Turret:** Cheap neutral repeater; reliable but cannot scale indefinitely.
- **Sunspitter:** Solar gun that stacks burning damage.
- **Cold-Iron Longshot:** Cryo rifle that slows individual priority targets.
- **Storm Lasso:** Arc tower that chains between clustered enemies.
- **Gravhammer:** Short-range mass driver that damages armor and nudges enemies backward.

Fusion towers:

- **Boilerhouse** — Solar + Cryo: scalding bursts that expose affected enemies.
- **Railfire Battery** — Solar + Arc: beam damage that intensifies while held on one target.
- **Caldera Mortar** — Solar + Grav: launches shells that leave burning ground.
- **Whiteout Telegraph** — Cryo + Arc: chain lightning spreads brittle between enemies.
- **Undertow Well** — Cryo + Grav: pulls enemies into a freezing field.
- **Blackstar Corral** — Arc + Grav: periodically compresses a group before releasing an electrical blast.

For the first playable build, implement only three fusion towers. The others can follow after the economy and status system feel good.

## Enemy roster

Enemies should be recognized by shape before color:

- **Dust Mites:** Numerous, fragile alien creatures.
- **Rust Runners:** Fast raiders on hovering bikes.
- **Tinback Haulers:** Slow armored machines.
- **Spark Wagons:** Shield generators protecting nearby units.
- **Rift Leeches:** Regenerating creatures countered by Solar damage.
- **Siege Crawlers:** Long-range machines that temporarily disrupt a tower.
- **Elemental Outlaws:** Bounty bosses with mechanics reflecting the catalyst they carry.
- **The Black Comet:** Final raid engine and run-ending boss.

Enemy traits should encourage adaptation without prescribing one exact solution.

## Map design

The first map is a fixed-path switchyard that curls around a central buildable “corral.” This creates several satisfying crossfire locations without requiring player-created maze pathing.

Recommended first-map structure:

- One entrance and one station gate
- A long outer approach
- A tight central double-back
- 30–40 legal build cells
- Two high-value crossfire zones
- No path blocking
- A tactical-pan camera with modest zoom
- Entire route understandable at a glance

Later maps can introduce forks, moving cargo trains, low-visibility dust storms, and rail switches. Those should not enter the first prototype.

## Run structure

A complete run targets 25–35 minutes:

- Waves 1–4: establish the basic economy
- Wave 5: first bounty and first element
- Waves 6–9: introduce shields and armor
- Wave 10: second bounty; fusion towers become possible
- Waves 11–14: mixed enemy compositions
- Wave 15: third bounty and first serious build test
- Waves 16–19: elite variants
- Wave 20: final bounty
- Waves 21–24: endgame pressure
- Wave 25: The Black Comet

The station begins with a limited amount of hull integrity. Escaped enemies inflict damage based on threat level. The run ends when integrity reaches zero; victory comes from defeating the final raid engine.

## Economy

Keep the initial economy to two resources:

- **Scrap:** Earned from kills and early-wave bonuses; spent on towers and upgrades.
- **Catalysts:** Earned only from bounty bosses; unlock and rank elements.

Recommended rules:

- Selling returns approximately 70% of invested scrap.
- Starting a wave early grants a small time-based bonus.
- Bounty-marked enemies award extra scrap.
- No passive-interest system in the first prototype.
- No repair currency; station repair can appear as a rare between-wave choice later.

## Visual and audio direction

The art direction should evoke a lived-in frontier future without copying Firefly’s characters, ships, or iconography.

- Tactical 3D terrain and readable GLB silhouettes viewed from a high oblique camera
- Sun-bleached ochre, rust red, soot black, brass, and oxidized teal
- Cyan and violet reserved for advanced elemental effects
- Spaceships with covered-wagon and steam-locomotive silhouettes
- Towers made from antennae, fuel drums, ship guns, and mining machinery
- Pulp-comic shadows and slightly exaggerated silhouettes
- UI styled as a worn bounty ledger layered over imperfect holographic projections
- Slide guitar, jaw harp, analog synth drones, industrial percussion, and chunky mechanical weapon sounds

The canvas should carry the battlefield. Text-heavy tower details, bounty selection, settings, and wave information should live in a responsive DOM overlay around it.

## 3D browser implementation plan

The runtime fit is:

- Three.js with WebGL first (WebGPU is an optional later renderer upgrade)
- JavaScript and Vite
- Blender-authored glTF 2.0 / GLB environment and unit assets
- A Three.js battlefield with a responsive DOM HUD and menus
- Desktop-first mouse and keyboard controls; touch after the core loop is proven

Gameplay rules stay outside the renderer:

- `WaveSystem`
- `EnemySystem`
- `TowerSystem`
- `CombatSystem`
- `StatusEffectSystem`
- `EconomySystem`
- `ElementRecipeSystem`
- `GameState`

The Three.js layer should only translate that state into models, procedural
motion, camera movement, particles, lighting, and sound. Save data contains
serializable game state and settings—not Three.js objects.

### Room-expansion architecture

Campaign maps grow as rooms unlock. Every room has a persistent ID and a local
grid; doors are graph edges between cells in two room grids. Enemy and hero
navigation use that global graph, so a new room can be appended without
flattening the campaign into a giant fragile grid. Rendering can later stream
nearby room scenes while the complete graph remains resident for route
validation and saves.

The production order is:

1. The isometric renderer has been retired.
2. Define rooms, doors, and persistent IDs in the simulation.
3. Prove two connected rooms in 3D.
4. Make one enemy and the hero traverse both.
5. Restore placement and the raid loop.
6. Add render-room streaming once real rooms create a measurable load.
7. Perform the final authored art, materials, lighting, and animation pass.

This order is still intentional: it establishes the stable data and gameplay
seams before high-cost environment production.

## First playable milestone

Build a 10–15 minute vertical slice containing:

- One switchyard map
- Ten normal waves and one final boss wave
- Scrap economy and station integrity
- Neutral tower plus four elemental towers
- Three fusion towers
- Six enemy types
- Two bounty decisions
- Deadeye ability
- Pause and 1×/2× speed
- Basic sound, impact effects, and functional GLB prototype models

The first balancing question should be: **Does choosing a bounty create an exciting new build direction within the following two waves?** If that works, the game’s central hook works.

---

## Current prototype status

The first 3D milestone now includes:

- A serializable, versioned `GameState` as the single source of truth
- Deterministic enemy, tower, combat, economy, hero, and wave systems
- A room-aware global graph, persistent room IDs, door state, and saved routes
- Cinder Threshold: two connected Blender-authored GLB blockout rooms
- Three.js/WebGL battlefield presentation, tactical camera, lighting, shadows,
  procedural model motion, and simple hit/death/elemental effects
- A DOM-based HUD with raid, pause, speed, build-palette, and outcome controls
- Existing elemental counterplay, carryover enemies, and raid-by-raid hull scaling
- A stable model/audio manifest and a source Blender export workflow
- Tests for room traversal, save round-trips, door-safe placement, and existing
  simulation behavior

The next implementation milestone is vertical-slice polish: approve a visual
brief, replace the functional blockouts with authored environment art, establish
real model animation clips, and then stream render rooms only if profiling shows
the growing campaign needs it.
