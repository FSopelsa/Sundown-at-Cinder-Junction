# Selective Studio Adoption

This repository keeps a small process layer around the development practices
that already work for Sundown. It is not an adoption of an external studio
operating system.

## Kept and tailored

- `AGENTS.md` provides project-specific Three.js, Blender, GLB, and
  verification rules.
- `docs/studio/technical-preferences.md` is the runtime contract.
- `docs/studio/coordination-rules.md` is the working agreement for small,
  playable changes.
- `docs/studio/skills-reference.md` lists only skills useful to this project.
- `docs/architecture/` records durable rendering and asset-boundary decisions.
- Asset and browser-playtest checks are used when a change calls for them.

## Deliberately not adopted

- role hierarchies, agent rosters, and mandatory delegation
- sprint planning, story registries, release operations, or Steam templates
- broad hooks, installers, and external scaffolding
- Unity, Unreal, Godot, or other engine-specific guidance

## How to use it

For a small feature, inspect the affected simulation and presentation paths,
implement it, run the existing check, and play the critical path. Add a design
note or ADR only when the decision is durable and changes future work. Before
admitting a new third-party asset, record its provenance and validate its GLB
runtime behaviour.

The current milestone is a functional 3D prototype. GLB blockouts and the
procedural wall kit are functional art, not final art direction approval.
