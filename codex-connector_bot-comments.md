# 💡 Codex Review

Here are some automated review suggestions for the merging of `prel/selective-studio-workflow` into `main`. 
- The review focuses on potential issues, improvements, and best practices in the codebase.

*Reviewed commit: `f564c6d915`*

---

## [src/game/simulation/systems/TowerSystem.js]
``` 
68+| sendMarshalToConstruction(tower) {
69+|   // Commanding the existing hero-navigation system means a build order uses
70+|   // the same room doors, collision rules, and save data as a manual move.
71+|   this.heroSystem?.commandMove(tower.x, tower.y);
``` 
### @chatgpt-codex-connector Bot:
// TODO: Consider adding error handling for the `commandMove` call to ensure that if the move fails, 
the system can gracefully handle the failure and provide feedback to the user. 

<mark>P1</mark> **Reject unreachable construction orders before committing them**

When the Marshal has been enclosed by completed walls or is otherwise disconnected from the selected tower,
`commandMove()` returns a failure here, but the result is ignored after the tower and its cost have already been 
committed. The Marshal never enters the 82-unit work radius, so construction remains pending indefinitely; that 
tower cannot be sold, and `getActiveConstruction()` prevents every subsequent build or upgrade, leaving restart 
as the only recovery. Validate the route before committing the order or roll back when the simulation rejects the move.

AGENTS.md reference: [`AGENTS.md:L5-L8`](AGENTS.md)
---

---
## [src/three/RoomScene.js]
**Comment on lines +52 to +55:**
``` 
52+| wall('north', width, 0.18, width / 2, 0);
53+| wall('south', width, 0.18, width / 2, depth);
54+| wall('west', 0.18, depth, 0, depth / 2);
55+| wall('east', 0.18, depth, width, depth / 2);
```

### @chatgpt-codex-connector Bot:

<mark>P2</mark> **Open procedural perimeter walls at active doors**

On `cinder-smeltworks`, every room omits `environment.model`, so these four full-span walls are used, while the 
simulation marks `intake-sluice`, `smelt-stair`, and `gallery-causeway` open. `connectionBridge()` draws decks across 
those boundaries but does not remove wall sections, causing heroes and enemies to traverse visibly solid walls 
at every room transition. Generate perimeter segments around connection cells according to `roomState` so the 
Three.js presentation matches the authoritative door graph.

AGENTS.md reference: [`AGENTS.md:L5-L8`](AGENTS.md)
---


