# Working Agreement

Sundown is developed in small, playable increments. Keep the existing
simulation-first style rather than introducing a large production framework.

- Inspect the active checkout and current runtime before proposing a change.
- Keep a gameplay rule in `src/game/`; let `src/three/` translate that state to
  presentation only.
- Use a focused skill when it materially improves the task: asset audit for
  admission, the Three.js/GLB pipeline for shippable models, and browser
  playtest for player-facing changes.
- Record only durable decisions: design scope in `docs/game-design.md`, system
  rules beside their code or in a small design note, and technical boundaries
  in `docs/architecture/`.
- Before new dependencies, paid generation, or a broad scaffold, present the
  cost, ownership, and rollback path. Do not silently install or replace a
  workflow.
- Validate code and assets with `npm.cmd run check`; smoke-test any change the
  player can see or control.
- Preserve unrelated work and do not commit or push unless the user asks.
