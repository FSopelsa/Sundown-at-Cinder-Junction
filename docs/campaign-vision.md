# Campaign vision: the expanding room maze

Updated 19 September 2026 from the owner's clarifications and the playable
implementation. The original sketch is a topology reference, not a precise
floor plan. Its essential four landmarks now exist in the default campaign.

## The shared vision

A new run reveals one room. Enemies enter at its west door and try to reach
the portal on the east wall. Clearing all of that room's waves opens the door
permanently, reveals the next space, and moves the active enemy entrance
outward. The original portal, hero, towers and maze remain in the same world.

```text
            Cryo trial     Grav trial
                 \          /
Solar trial -- elemental workshop -- SUN JUNCTION -- dormant boss room
                       |                  |
                   Arc trial           ROOM 2 ------ ROOM 1 --> portal
```

The boss chamber is above Room 1 but has no door to it. Its only connection
is to the sun junction. The workshop is west of the junction, outside the
normal enemy route; it has four additional doors to independent elemental
TD encounters. The trial footprints are working blockouts, not a literal
tracing of the sketch. The sun room is currently rectangular rather than
using the sketch's irregular partitions.

## Decisions confirmed by the owner

- Only one chosen encounter is active at a time. Unlocked doors remain open
  for travel; they do not all become enemy spawners.
- The small sun is a compulsory enemy checkpoint. It grants a buff needed to
  pass the next room's door, plus seven seconds of HP regeneration.
- Build and dress the adjoining boss room, but defer the boss fight and its
  defeat/reward rules.
- No enemies spawn in the upgrade workshop. Its four elemental rooms are
  separate little TD encounters rewarding tower and hero upgrades, and
  perhaps hero items later.
- Each elemental room awards a key. All four will be required for the future
  final boss. The upper rooms/circle and what follows remain undecided.
- Ladders to another floor/tier are expansion ideas, not current work.
- Start with one long saveable run. Every completed combat room autosaves;
  other saves require the hero to reach a machine, with one in every room.
- Richer quests, talents, equipment, crafting and fusion remain ideas for
  later iterations. Existing hero movement and construction stay available
  from the beginning.

## What is playable now

The default scenario is **Expanding Cinder Junction** (`cinder-campaign`).
Threshold, Smeltworks and the older maps remain selectable development
scenarios, preserving their earlier rules.

1. **Room 1 / Portal vault:** two introductory waves, west entry, east goal,
   a save computer and a buildable maze grid. Only this room renders or
   accepts player interaction in a new campaign.
2. **Room 2 / Relay approach:** three waves. Its north entrance feeds through
   Room 2 and the original Room 1 defenses. Room 1 completion opens and
   reveals it, with camera pan/zoom and a gradual reveal.
3. **Sun junction:** three waves. Each enemy goes to the central seal before
   taking the south door toward Room 2 and the original portal. The sun has
   a suspended radial crown, light column and lightning. Gold enemy rings
   indicate regeneration; orange indicates the remaining door permission.
4. **Boss chamber:** a dormant sentinel on a dais, four pylons, a clearly
   marked arena, and a save machine. There is no boss AI, combat reward or
   invented final encounter here.
5. **Elemental workshop:** safe exploration and four physical trial doors.
   Click a door or its campaign-panel button; the hero walks to it before
   opening the chosen trial. Opening another trial is blocked until the
   current one is cleared.
6. **Solar, Cryo, Arc and Grav trials:** three waves each, with different
   enemy mixes, themed equipment, a local goal, persistent local defenses,
   a save machine and one unique key/reward. Enemy paths stay inside that
   trial; they do not pass through the workshop or bypass the sun route.

Completing a trial applies its reward immediately and once. No extra talent
screen is needed for this first version:

| Key | Tower benefit | Hero benefit |
| --- | --- | --- |
| Solar | Solar damage +20% | Damage +10% |
| Cryo | Cryo damage +20% | Incoming damage ×0.9 |
| Arc | Arc damage +20% | Damage +10% |
| Grav | Kinetic damage +20% | Incoming damage ×0.9 |

Benefits apply to existing and future towers through combat calculations,
not repeated stat mutations on load. Solar/Arc hero bonuses add to +20%;
the two defensive bonuses multiply to 19% less incoming damage. All four
keys finish the current playable chapter. The actual final gate/arena/fight
will be built after its design is settled.

## Working defaults to review, not newly attributed decisions

- The sun's door seal lasts until the enemy crosses the south door. **Only
  regeneration expires after seven seconds.** Otherwise a long valid maze
  could strand an enemy behind a timed permission check.
- Regeneration currently restores 4% maximum HP per second, capped at max HP.
  Its duration is confirmed; its amount is a tuning value.
- The early encounters have 2 / 3 / 3 waves. Higher room tiers add health;
  heavy chassis have lower authored counts than runners. Opening space does
  not automatically double HP.
- A trial defends a local relay, but leaks consume the run's shared integrity.
  This makes each trial a separate route within the same saveable run. The
  original portal remains the goal of the main three-room route.
- A room clear grants 240 Scrap, repairs 12 integrity up to 100, and restores
  the hero. First entry into each trial grants 420 Scrap. These are provisional
  economy values, with no repeat-clear or abandon/reopen reward farming.
- A dead hero returns for the next wave, following existing behavior. A lost
  portal stops the run; loading a checkpoint restores that earlier snapshot.
  There is no permanent between-run currency or automatic defeat rollback.
- Direct tower/hero/enemy attacks stay inside their current combat room.
  Directional enemy Worm Tunnels work within a room; a tunnel cannot jump
  across the sun gate or turn a workshop into an enemy shortcut.
- Exploration rooms do not accept towers. Machines, props, future entrances,
  doors and the sun are reserved; placement must preserve enemy routes and
  the hero's access to machines and doorways.

These defaults resolve implementation gaps while leaving the long-term
choices open for review. In particular, local trial relays, clear rewards,
repair amounts and the seal's lifetime deserve a playtest decision.

## Saving and reviewing

Normal saves use two browser-local slots: the latest room autosave and the
latest machine save. Reload resumes whichever is newer. The campaign panel
also lets you explicitly load either slot or start a new campaign. Loading
rolls back unsaved changes; starting fresh retains the old checkpoints until
the new run saves. Failed writes report an error, and unreadable records are
preserved while a valid other slot can still load.

Saves contain the active encounter, completed IDs, keys, room/door state,
hero navigation, construction, enemies and their sun state, pending machine
interaction, wave schedule and fixed-step time remainder. Schema 2 accepts
schema-1 simulation saves through an explicit migration. Browser saves are
local to the browser and origin (including port); cloud sync and export are
not implemented.

For normal play, use the Vite URL. For an immediate review of the four
landmarks, use **`/?review=junction` on the development server**. This starts
at the cleared junction and uses a separate save namespace. It is excluded
from production builds. Use **Rooms, elemental keys & checkpoints** to focus
individual rooms, or **Find hero** to return to the builder. Camera focus
changes only the view; it does not teleport the hero. **Overview** frames
all discovered rooms. Wheel, arrows and right-drag still work. Reduced-motion
preferences suppress animated camera transitions and the reveal veil.

## Architecture kept and extended

No engine rewrite. `src/game` owns serializable rules; `src/three` owns
presentation; `src/ui` owns controls. Authored GLBs are resolved through the
existing semantic manifest and named nodes. The sentinel, gates, computers,
reactors, pylons, floor kit, hero, enemies and towers reuse the existing
Blender collection; no external assets or paid generation were needed.

- `content/campaign.js`: topology, encounters, waves and rewards.
- `simulation/systems/CampaignSystem.js`: progression and physical interactions.
- `simulation/campaignRouting.js` and `campaignEnemies.js`: route scopes,
  waypoint phases, gate permission and preview agreement.
- `GameState.js` and `saves.js`: versioned snapshots and storage boundary.
- `CampaignScene.js` / `CampaignHud.js`: landmarks and contextual controls.

Locked rooms are absent from rendering and input, rather than merely dark.
Room rebuilds release owned GPU resources without disposing shared GLB data.
Room point lights no longer each cast an additional shadow map; the main
light follows the tactical view. Rendering and reveal timing are not save
or navigation authority.

## Verification and next work

Automated campaign checks cover hidden-room restrictions, reward idempotency,
spawn migration, waypoint/door permission, exactly seven seconds of regen,
tunnel bypasses, route-preserving construction, machine proximity, corrupt
or failed saves, key effects and deterministic mid-wave restoration.

A simulation playthrough uses legal construction and upgrades to clear all
three main encounters, with no forced clears. Each elemental trial is also
exercised as the first branch using a local defense. These establish a
workable baseline, not a claim that every maze or branch order is balanced.
Browser tests use actual pointer placement, wave controls, machine travel,
reload and trial selection. Late-room screenshots use an explicitly prepared
checkpoint; they are not presented as a manual full-campaign playthrough.

Next, play the main route with different mazes and review leaks, travel time,
Scrap and the sun's regeneration. Then tune the four trials and decide the
boss encounter's rules. Keep the big northern/final rooms, floor two, items,
quests, crafting and alternative persistence modes deferred. The room graph
and encounter separation support those additions without replacing the
current simulation.

Validation on 19 September 2026: `npm.cmd run check` passed 108 unit tests,
the production build, GLB validation and all 5 Chromium browser tests.
Screenshots were inspected at 1440×1000 and 1280×720. The existing Three.js
bundle-size advisory remains; GLB validation reports no errors or warnings.
