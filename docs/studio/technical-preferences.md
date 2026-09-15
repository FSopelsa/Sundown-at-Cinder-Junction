# Technical Preferences

This is the current technical contract for Sundown at Cinder Junction. Update
it only when an accepted runtime, platform, performance, or testing decision
changes.

## Engine & Language

- **Engine**: Three.js 0.185.x, imperative browser runtime
- **Language**: JavaScript with ES modules
- **Rendering**: WebGL first; WebGPU is an optional future optimisation
- **Physics**: Simulation-owned room/grid navigation and collision rules; no
  third-party 3D physics engine

## Input & Platform

- **Target Platforms**: Desktop browser
- **Input Methods**: Keyboard and mouse/pointer
- **Primary Input**: Keyboard movement plus pointer selection, placement, and
  camera interaction
- **Gamepad Support**: None currently
- **Touch Support**: None currently
- **Platform Notes**: Vite development and production builds; WebGL2-capable
  browser required

## Naming Conventions

- **Classes**: PascalCase
- **Variables**: camelCase
- **Signals/Events**: camelCase action and event names
- **Files**: camelCase JavaScript modules
- **Scenes/Prefabs**: Blender-authored GLB assets and room definition JSON
- **Constants**: UPPER_SNAKE_CASE

## Performance Budgets

- **Target Framerate**: 60 FPS on a typical desktop browser
- **Frame Budget**: Keep rendering responsive while the simulation stays
  deterministic
- **Draw Calls**: Profile before a hard limit; prefer instancing and room
  streaming as content grows
- **Memory Ceiling**: Profile during room-streaming work; no fixed limit yet

## Testing

- **Framework**: Node's built-in test runner with Vite production builds
- **Minimum Coverage**: `npm.cmd run check` must pass for runtime changes
- **Required Tests**: Balance formulas, gameplay systems, and browser smoke
  coverage for player-facing changes

## Forbidden Patterns

- Keep simulation rules independent of Three.js scene objects.
- Do not add a renderer, engine, or physics dependency without an architecture
  decision.
- Do not use generated/purchased art without recorded source, licence, and
  runtime-admission checks.

## Allowed Libraries / Addons

- Three.js and Vite are approved runtime dependencies.
- Blender creates source meshes; GLB is the runtime model format.

## Architecture Decisions Log

- [ADR-0001](../architecture/adr-0001-threejs-simulation-and-glb-contract.md)
  — Three.js presentation, serializable simulation, and GLB asset contract.
- Create a new ADR before changing renderer, asset pipeline, room streaming, or
  physics authority.

## Specialist Routing

| File or concern | Review focus |
| --- | --- |
| `src/game/**` | JavaScript simulation and deterministic rules |
| `src/three/**` | Three.js/WebGL presentation and coordinate conversion |
| `src/ui/**` | DOM HUD and browser-game UI |
| `assets/blender/**`, `*.glb` | Blender/glTF scale, pivots, and materials |
| Architecture or dependencies | ADR before implementation |
