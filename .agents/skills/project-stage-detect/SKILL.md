---
name: project-stage-detect
description: Read-only status review for Sundown's current playable prototype and the next practical development step.
---

# Sundown project status

Use this skill when the user asks where Sundown is, what is genuinely playable,
or what should happen next. It is a read-only review; do not create a generic
stage report or impose a studio lifecycle.

## Review

1. Read `AGENTS.md`, `README.md`, `docs/game-design.md`, relevant architecture
   notes, and the active checkout's Git status.
2. Inspect the affected simulation, Three.js, HUD, assets, and tests rather
   than inferring progress from planning documents.
3. Run the smallest relevant checks when they have not already been verified:
   `npm.cmd run check`, GLB inspection for asset work, and a browser smoke test
   for player-facing work.
4. Separate verified behaviour from intended or unverified work. Treat the
   serializable `src/game/` simulation as authoritative and `src/three/` as a
   presentation adapter.

## Output

Give a concise, findings-first answer:

- what a player can do now;
- evidence for that conclusion;
- the most consequential gaps or risks;
- the next one to three small, playable milestones.

Do not invent epics, sprints, roles, or mandatory documents. Recommend a new
design note or ADR only for a durable decision that would constrain future
work.
