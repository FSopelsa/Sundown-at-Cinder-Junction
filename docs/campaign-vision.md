# Campaign vision: the expanding room maze

Design alignment, 16 September 2026. Based on the owner's explanation and
[`assets/map_sketch.jpg`](../assets/map_sketch.jpg), checked against the active
checkout. This records direction and proposed next work; it does not claim
the campaign is implemented. The sketch remains a visual reference, not a
precise floor plan. The image is currently ignored by Git, so this written
interpretation also preserves the essentials for another checkout.

## What the game is becoming

Start with one room to defend. Surviving its waves opens more of a connected
world, extends the maze back toward the same original goal, and eventually
lets the player choose which challenges and elemental rewards to pursue.
The hero/builder inhabits that world and later uses its services, characters,
upgrades, and discoveries between fights.

The important continuity is within the campaign: opening a room keeps the
previous battlefield relevant. Persistence between separate runs, the final
campaign duration, and the defeat/retry rules are still undecided.

## Reading the sketch

Positions below use the photograph as displayed, not compass directions.

| Feature | Reading and confidence |
| --- | --- |
| Bottom-right rectangle | **Confirmed room 1.** The oval on its right edge is the enemy goal/portal. Its left doorway admits the initial enemies. |
| Rectangle immediately left of room 1 | **Room 2, strongly supported** by the described leftward reveal. Its upper doorway connects to the central junction. |
| Irregular junction directly above room 2 | **Confirmed intended room 3 / central junction**, using the owner's example numbering. The small sun is inside this room. It is right of the oval upgrade room. |
| Small sun in that junction | **Confirmed compulsory enemy pass-through point.** Its visual resemblance to a sun does not make it a Solar reward, spawn, damage source, or second goal. The lightning reference describes the intended landmark; additional mechanics are unconfirmed. |
| Rectangle right of the junction, directly above room 1 | **Confirmed boss room.** A marked entrance joins it to the junction on its left. No doorway joins it to room 1 below. The creature drawing and apparent armor-reward note help identify it; the boss and reward mechanics await explanation. |
| Oval left of the junction | Clearly labeled **upgrade room**. Its links appear to fan toward the elemental areas. Exact access rules are unconfirmed. |
| Areas labeled Solar, Cryo, Grav, and Arc | Visible elemental branches, with key drawings and tentative effect notes. Arc lies below the upgrade room; Solar is lower-left; Cryo and Grav lie above. The crossed-out upper-left Solar label may be an abandoned arrangement. |
| Left-side ladders and “stege till 2a våning (elemental level 2)” | Suggest a second floor or second elemental tier. Literal vertical geometry versus progression notation remains unconfirmed. |
| “4 nycklar” near the lower-left | Suggests four keys tied to later access, consistent with the owner's final-boss-key idea. Which locks they open and whether they are consumed are unconfirmed. |
| Large upper-right area, long upper room, huge circle at the top | Visible later areas. The huge circle contains a **second** sun-like mark and three paired marks; its role is unknown. Do not label it the final boss arena as an established fact. |

The reliable early connection order is:

```text
                         later routes (details pending)
                                      |
upgrade room ---- junction / small sun ---- boss room
                         |
                      room 2 -------- room 1 ---- goal portal
```

Lines show connections, not enemy directions or simultaneous availability.
Enemy travel reverses the player's outward expansion:

- Stage 1: room 1 entrance -> maze in room 1 -> original portal.
- Stage 2: new entrance in room 2 -> room 2 maze -> room 1 maze -> original portal.
- At the junction and beyond: selected outer approach -> compulsory central
  point -> room 2 -> room 1 -> original portal.

The junction's initial spawning doorway and the exact route through its
drawn internal partitions are not specified. A later boss encounter may use
different movement rules; do not force all bosses into the normal wave route
before their design is explained.

## Confirmed direction versus working proposals

**Confirmed from the explanation:**

- A new game reveals only the starting room.
- Completing a level means surviving its set of waves, not just one wave.
- The enemy entrance door stays open on completion and reveals the next room.
- A reveal can zoom out, pan, and bring the room's lights up. Dimmer/faulty-light
  effects are examples, not settled art requirements.
- New waves begin farther out and travel through earlier rooms toward the
  original portal. Earlier defenses remain useful; preserving the built maze
  is the working interpretation of this continuity.
- The central small-sun point must be visited before continuing to the goal.
- The junction introduces route choice. Branches offer different bosses,
  elemental opportunities, keys, upgrades, and consequences for later play.
- Later, the hero can explore unlocked rooms and interact with objects.
  NPC quests, talents, equipment, crafting, and fusion materials/recipes are
  possibilities; neither all of them nor their detailed systems are committed.
- “Room 3” and “levels 5–10” are illustrative pacing, not fixed counts.

**Recommended defaults to test, not decisions attributed to the owner:**

- Complete a room, reveal the next space, then give control back in a planning
  phase. Do not start spawning while the reveal camera is moving.
- Initially activate one chosen challenge at a time. An open door remains a
  traversal connection; it does not automatically become a permanent spawner.
- Make exploration/services safe between raids for the first version.
- Read “levels 5–10” as the later arrival of richer exploration/services, while
  retaining the builder's existing early movement. If movement itself should
  unlock later, revisit how early construction works.
- Use a nonconsumable reward flag for the first key. General inventories and
  consumable-key rules can follow if the design needs them.
- Teach branching with two useful, completable choices. Open the other branch
  later rather than making the first choice permanently exclusive by accident.

## Where the older plan differs

These are differences in the recorded plan, not evidence that the owner
misspoke. Some older sections already predate the current implementation.

| Older assumption | Revised direction |
| --- | --- |
| One fixed switchyard route; no player-made maze | A growing maze built across connected rooms. |
| Each selectable level is a separate map | Room/challenge progression happens inside a continuing world. Keep the existing maps as development scenarios. |
| Every fifth wave presents a bounty choice | Physical doors and branches become the main progression choices. Whether periodic bounties also remain is unresolved. |
| Ten normal waves plus a finale for the slice; 25 waves / 25–35 minutes for the larger run | Wave sets per encounter, branching challenge order, and a later gated ending. Total duration and counts need fresh playtesting. |
| Low micro with Deadeye as the sole active ability | A spatial hero/builder with a growing exploration and interaction role. Desired combat complexity remains open. |
| Scrap and catalysts are the only resources | Keep those for the early slice; keys and possibly equipment/materials require distinct progression concepts later. |
| Final environment art is the next milestone | Prove progressive opening, route continuity, and the first branch before final room art. |

Elemental experimentation, readable combat, player-chosen escalation, and the
space-western setting still fit. The evacuation story and its implied time
pressure should be revisited if leisurely exploration becomes central; no
replacement fiction is assumed here.

## What the current code already provides

- Stable room IDs, local cell grids, and door connections in
  `src/game/content/rooms.js`.
- Cross-room enemy routes, hero travel, placement validation, and directional
  Worm Tunnels in the simulation.
- Persistent tower/hero state and serializable room/door IDs in `GameState`.
- A two-room Threshold scenario and a four-room Smeltworks scenario with a
  sealed shortcut. These prove connected spaces, not campaign progression.
- Builder travel/construction, tower upgrades, combat/status effects, hero XP,
  elemental content, a recipe resolver, and the existing economy/HUD.
- Three.js camera controls, room presentation, lighting, model loading, and
  procedural room shells. They can support the new direction.

Keep the simulation/Three.js/DOM boundary and the Blender/GLB asset contract.
This vision does not require an engine replacement or a whole-project rewrite.

## Focused changes needed before more content

1. **Separate the world from the encounter.** Keep a stable campaign/map ID;
   add an encounter ID, local wave index, active spawn locations, clear state,
   and selected branch. The current `levelId` selects an entire scenario,
   `map.entrance` is fixed, and `FINAL_WAVE_INDEX` drives completion. Simply
   selecting the next level would create a new simulation and lose continuity.

2. **Make discovery and access actual rules.** Distinguish revealed rooms,
   traversable doors, completed encounters, and active enemy entrances.
   An initial entrance may visually admit enemies while the room beyond is
   undiscovered and unavailable to the hero; a single open/closed flag cannot
   express all of those permissions.
   `unlockedRoomIds` is serialized but currently does not gate room rendering,
   hero navigation, or placement. A direct probe confirmed that removing a
   room from that list alone still permits movement and placement validation
   there. Hiding a room requires hiding models, grids, labels, routes, targeting
   and picking too; merely turning its lights off leaves other light sources
   and input paths. Reserve closed door endpoints and mandatory landmarks
   before they open: a second probe confirmed a sealed Slag Shutter endpoint
   currently passes placement validation.

3. **Route through ordered objectives.** Normal enemies beyond the junction
   need a route contract such as `[junction checkpoint, original portal]`.
   Store the next required objective per enemy; use it in movement, placement
   checks, route previews, saves, and “first” targeting. The existing field
   computes only distance to the final exit. A graphic at the sun will not
   enforce visiting it. Worm Tunnels, later shortcuts, and teleporting enemies
   must not silently skip a required objective. Enemies already past it must
   not be sent back when a tower changes the route.

4. **Make progression transitions safe and repeatable.** Clear an encounter
   only after its last wave and all remaining enemies resolve while the goal
   survives. Award a reward/unlock once, validate the next encounter's routes,
   then update state. Keep the next raid behind a player action. Saving,
   loading, skipping the reveal, or repeating an input must not duplicate a
   key, replay rewards, or leave progression stuck.

5. **Support the sketch's geometry and combat boundaries.** Rooms are currently
   full rectangles. Add walkable/buildable masks for the irregular junction,
   fixed partitions, safe services, and reserved cells. Establish separate
   traversal policies where hero shortcuts must not shorten the enemy maze.
   Tower targeting currently uses world distance without wall occlusion;
   nearby rooms could exchange fire through walls. Decide and enforce room
   boundaries/line of sight before placing a boss directly above room 1.
   Distinguish permanent architecture from player maze walls when choosing
   which attacks can cross which barriers.

6. **Add a real resume path early.** `GameState` can serialize, but the browser
   entry point always constructs a fresh simulation; no storage/resume flow
   is wired in the inspected source. Save campaign progression, active
   encounter, rewarded IDs, keys/unlocks, hero and construction state, and
   enemy route objectives. Version and migrate saves deliberately. Start with
   reliable between-encounter checkpoints; do not promise exact mid-combat
   resume until it is verified, including the fixed-step timing remainder.

7. **Drive the reveal from state.** Keep the unlock in simulation and the camera,
   door motion, lights, audio, and effects in presentation. Frame the new room
   plus its connection to known space. Permit a skip/reduced-motion version;
   loading a save should restore the correct state without depending on a
   finished animation. Longer term, navigate locally and use a discovered-map
   overview: continuously zooming out to fit every room will make towers tiny.

## Problems worth anticipating

**Extra distance is not automatically extra difficulty or extra defense.**
A second empty room adds walking time; only the portions covered by towers
add meaningful damage. New building space also costs scrap to use. Avoid
automatically doubling enemy HP with room area, or adjusting enemies to
neutralize every maze improvement. Tune authored encounter tiers using weak,
ordinary, and strong test mazes. Track clear time, leaks, spend, and damage
by room. Mix durability, numbers, spawn rhythm, armor/shields, and mechanics;
avoid making universal speed increases undermine readable tactics.

**The junction may become the only worthwhile kill zone.** All ordinary
routes converge there, so splash damage and slows may dominate. Test that
deliberately before scattering rewards everywhere. Preserve branch identity
with useful rewards, room rules, or encounter differences. Do not add a tax
that arbitrarily makes earlier towers useless.

**Choice needs consequences without a progression dead end.** Validate that
each offered branch is beatable using what is available before choosing it.
Avoid keys locked behind their own doors, mandatory full immunities, infinite
reward farming, and one overwhelmingly best first branch. Separate the graph
of physical doors from reward prerequisites; they answer different questions.
Encounter order and each encounter's baseline tier may both affect difficulty;
the appropriate mix needs testing rather than one global wave number.

**Exploration competes with defending and building.** The current builder
physically travels to each construction job and only one job runs at a time.
Across many rooms that can become waiting rather than a decision. Test travel
time before adding queues or fast travel. Later shortcuts can be hero-only.
Decide whether opening a talent/crafting interface pauses active combat, and
whether enemies may attack the hero inside a supposedly safe service room.

**Future door openings can invalidate a valid maze.** Reserve door/checkpoint
access, validate every active spawn and every live enemy's remaining route,
and verify newly activated entrances before spending keys. Future branches
must not silently bypass the sun or strand the builder. State changes that
alter walkability must invalidate cached routes.

**A second floor needs more than raising the artwork.** Room IDs are useful,
but current world-position lookup, overlap validation, combat distances, and
ground picking assume one flat layer. If the ladder note means literal stacked
rooms, use explicit floor/elevation and actor room identity before authoring
overlapping floors. It can be deferred beyond the first branch.

**Revealed rooms keep simulating even when off camera.** Preserve old towers
and enemies while limiting rendering work. Current room rebuilding clears
scene groups and recreates geometry/lights; inspect GPU resource disposal
before frequent reveals. Each room also adds a shadow-casting light. Measure
draw calls, shadows, route rebuild cost, and save size on a representative
larger blockout before choosing streaming, pooling, or pathfinding changes.

## Next three playable milestones

### 1. The first door opens

Build a separate campaign scenario using simple rooms. Initially show only
room 1, with its portal on the right and enemy entrance on the left. Complete
a short authored set of waves, keep the door open, reveal room 2 to the left,
and move the next encounter's spawn there. Preserve the hero, towers, scrap,
and damaged goal. Return to planning after the reveal.

Done when a player can build, clear, watch/skip the reveal, build in the new
space, and see enemies traverse both mazes to the same portal. Hidden-room
actions fail. Save/refresh/resume between stages restores the same world.
Keep Threshold and Smeltworks available as regression scenarios.

### 2. The junction actually matters

Add the third room and its mandatory central point, with an unmistakable
temporary beacon/lightning effect. Protect its approach from construction.
Offer two modest branch encounters with different useful rewards; one can
stand in for the drawn boss room without inventing its final mechanics.
Include one simple upgrade-room interaction to prove hero approach and UI.

Done when either branch can be chosen first, the resulting unlock changes
play, every ordinary enemy obeys the required waypoint, and the earlier maze
continues working. Reloading neither duplicates rewards nor loses the chosen
branch. Test shortcuts, Worm Tunnels, and rebuilding before/after the beacon.

### 3. Prove that the choice stays interesting

Implement one properly differentiated elemental encounter, its key/unlock,
and one upgrade or fusion outcome. Play both branch orders with contrasting
mazes. Measure travel time and downstream tower usefulness. Then decide the
scope of hero talents, crafting, quests, multiple floors, and final-boss locks.
Expand one system at a time after this loop earns it.

Final art can follow approved room functions and topology. Light prototypes
are useful now; a full asset pass before these milestones would bake in
dimensions and door layouts we may need to change.

## Questions to revisit when the owner explains the rest

These do not block the first two-room milestone.

- Does choosing a branch activate only that encounter, or can multiple
  unlocked entrances threaten the portal simultaneously?
- Is the small sun only a required pass-through landmark, or does visiting it
  transform, damage, reward, or otherwise affect enemies?
- Are the upgrade room and boss rooms off the normal enemy route? How does a
  boss fight end, and what happens if the hero dies there?
- Do the ladders mean an actual second floor, a second elemental tier, or both?
- What are the upper large rooms, huge circle, paired marks, and four-key lock?
- Is this one long saveable run, a persistent campaign with retries, or a
  shorter replayable run with optional exploration? Which progress survives
  defeat or a new game?

## Verification for this review

The current baseline passed `npm.cmd run check`: 80 simulation tests, the Vite
production build, shipped GLB validation, and the existing Chromium raid-start
test. The build still reports its large-chunk advisory. The direct unlock and
closed-door probes above exposed missing campaign rules; passing baseline
tests does not imply those unimplemented rules work.

A separate live Chromium check confirmed that Threshold initially displays
both rooms and starts a raid without console or page errors. Its initial and
raid screenshots were inspected. This was a startup check, not a full campaign
playthrough; the proposed campaign does not yet exist.

No gameplay code or runtime assets were changed for this design alignment.
