---
name: playtest-report
description: Turn actual Sundown playtest notes into concise, actionable prototype findings.
---

# Sundown playtest notes

Use this skill after a person has played the game and supplied observations.
It turns real notes into decisions; it does not fabricate a formal QA report or
create files unless the user explicitly asks.

## Review

1. Capture the tested build or branch, level, intended player loop, and any
   relevant settings.
2. Preserve the player's observation in plain language. Separate it from the
   likely cause and from an unverified interpretation.
3. Group findings by the smallest useful area: core loop, clarity/HUD, control,
   balance, performance, visual/readability, or defect.
4. Prioritise only concrete next actions. A change that threatens route safety,
   save compatibility, or the simulation/presentation boundary is high impact.

## Output

For each meaningful finding, provide:

- observation;
- severity: blocking, important, or polish;
- confidence: reproduced, reported, or uncertain;
- recommended next action.

Finish with the single best next test or change. Do not summon reviews, require
testers, prescribe a reporting template, or write `production/` files by
default.
