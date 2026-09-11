# Technical Preferences

<!-- Populated by $setup-engine. Updated as the user makes decisions throughout development. -->
<!-- Keep the headings and bullet labels stable. Repo skills read them directly. -->

This is the shared technical configuration sheet for the current project.
Update it whenever engine, platform, performance, or testing expectations change.

## Engine & Language

- **Engine**: Three.js (imperative browser runtime)
- **Language**: JavaScript with ES modules
- **Rendering**: WebGL first; WebGPU is an optional future optimization
- **Physics**: Simulation-owned room/grid navigation and collision rules; no third-party 3D physics engine

## Input & Platform

<!-- Read by UX, testing, and team orchestration workflows. -->

- **Target Platforms**: Desktop browser
- **Input Methods**: Keyboard and mouse/pointer
- **Primary Input**: Keyboard movement plus pointer selection, placement, and camera interaction
- **Gamepad Support**: None currently
- **Touch Support**: None currently
- **Platform Notes**: Vite development and production builds; WebGL-capable browser required

## Naming Conventions

- **Classes**: PascalCase
- **Variables**: camelCase
- **Signals/Events**: camelCase action and event names
- **Files**: camelCase JavaScript modules
- **Scenes/Prefabs**: Blender-authored GLB assets and room definition JSON
- **Constants**: UPPER_SNAKE_CASE

## Performance Budgets

- **Target Framerate**: 60 FPS on a typical desktop browser
- **Frame Budget**: Keep rendering responsive while the simulation stays deterministic
- **Draw Calls**: Profile before setting a hard budget; prefer instancing and room streaming as content grows
- **Memory Ceiling**: Profile during room-streaming work; no fixed limit yet

## Testing

- **Framework**: Node's built-in test runner with Vite production builds
- **Minimum Coverage**: `npm.cmd run check` must pass for runtime changes
- **Required Tests**: Balance formulas, gameplay systems, networking (if applicable)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase. -->
- Keep simulation rules independent of Three.js scene objects.
- Do not add a renderer, engine, or physics dependency without an architecture decision.

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here as they become real project needs. -->
- Three.js and Vite are the approved runtime dependencies.

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/. -->
- Create ADRs for renderer, asset-pipeline, room-streaming, or physics changes.

## Engine Specialists

<!-- Written by $setup-engine when engine is configured. -->
<!-- Read by review, architecture, and team skills to select engine-aware agents. -->

- **Primary**: Three.js/WebGL specialist
- **Language/Code Specialist**: JavaScript/Vite specialist
- **Shader Specialist**: Three.js material and WebGL specialist
- **UI Specialist**: DOM HUD and browser-game UI specialist
- **Additional Specialists**: Blender/glTF asset and browser-playtest specialists
- **Routing Notes**: Keep simulation, renderer, asset loading, HUD, and tests separate

### File Extension Routing

<!-- If a row stays unconfigured, fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (primary language) | JavaScript/Vite specialist |
| Shader / material files | Three.js/WebGL specialist |
| UI / screen files | DOM HUD specialist |
| Scene / prefab / level files | Blender/glTF asset specialist |
| Native extension / plugin files | Architecture review first |
| General architecture review | Primary |
