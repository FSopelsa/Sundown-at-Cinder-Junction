# Cinder Junction Siege — first playable

This branch defaults to **The Last Departure** (`cinder-siege`). It is a
separate hero-defense mode: the expanding campaign and original TD rules
remain available at `/?level=cinder-campaign` and `/?level=cinder-threshold`.
No Warcraft assets, names, spells or map content are used.

## Play locally

Node 24 or later, from the project folder:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Open Vite's printed URL, choose a hero and **Deploy solo**. Solo checkpoints
save every 15 seconds and on leaving the page, under `cinder.siege.v1` in this
browser. **Resume solo** restores the last checkpoint. Campaign save keys and
schema migrations are unchanged. New siege saves include every player's ID,
hero, inventory, cooldowns, RNG cursor, wave schedule and fixed-step remainder.

For co-op, keep the client running and open a second terminal:

```powershell
npm.cmd run siege:server
```

Open the game in two to four browser tabs/windows. Expand **Co-op**, leave the
server address at `ws://127.0.0.1:8787`, create a room, and share its five-character
code with the other local clients. Choose heroes, ready up, and let the host
launch. Duplicate hero choices are allowed. There are no accounts or API keys.

To test on another computer on your LAN, run Vite with `--host 0.0.0.0` and
start the server with `$env:HOST = '0.0.0.0'` set in that terminal. Other clients
use the host's LAN address for both the Vite page and the WebSocket address.
The defaults bind only to loopback. Public hosting/TLS is deliberately deferred.

## The run

- Defend the **2,600-hull Junction reactor** from west, east and north.
  Ten assaults begin 18 seconds into the run, then every 90 seconds.
- Assault 4 interrupts normal spawning with a **capacitor storm**. Reach the
  southern console and channel for five seconds within its 55-second deadline.
  Success repairs the reactor and grants Scrap, personal Marks and XP; failure
  damages the reactor and introduces an elite crawler.
- Assault 5 exposes **Ash Foundry** in the western room. Push out and attack
  its engine. Destroying it cuts western reinforcements, repairs the Junction,
  rewards the crew and removes the final boss's 92% damage reduction.
- At **15:00**, the **Black Comet** arrives through the northern approach.
  Avoid its red impact circles. Killing it wins immediately; zero reactor hull
  loses immediately. A reactor collapse begins at 20:00 to end stalled runs.
  The acceptance pilots finish in approximately 15–16 minutes.

Players gain XP individually from nearby combat and participation rewards;
level 10 is the cap. Downed heroes cannot issue combat commands. An ally can
channel a three-second revive, or the hero reconstructs at the reactor after
25 seconds. The reactor heals nearby heroes. Enemy targeting considers all
living heroes and the base, including Bastion's temporary taunt.

## Heroes, items and shared economy

| Hero | Role and active kit | Defining trait |
| --- | --- | --- |
| Singularity | Ranged controller: Gravity Well (L1), Void Rend (L2), Quantum Blink (L3) | Ability damage restores 12% hull |
| Bastion | Durable relay guardian: Cinder Pulse (L1), Time Dilation (L2), Worm Tunnel (L3) | 25% damage resistance; nearby allies regenerate 3 hull/s |

Gravity Well pulls, slows and drains; Void Rend bursts an area; Blink moves
within a reachable room and briefly protects the caster. Cinder Pulse damages
and taunts; Dilation accelerates nearby heroes and fortifications; the tunnel
creates a temporary one-way route for teammates. Ability definitions and
effect handlers are separate, rather than a switch statement per hero.

Each hero has **four inventory slots** and personal **Marks**. The quartermaster
near the reactor reliably sells Ironheart plate (+120 hull / 8% resistance),
Arc cartridge (+16 damage), Chrono regulator (20% shorter cooldowns), Railrunner
boots (+65 speed), Hull tonic (240 self-heal), and Reactor cell (300 base repair,
used near the reactor). Equipment occupies a slot and must be equipped; used
consumables disappear. Supplies also drop from enemies. Drop an item to share it.

**Scrap is shared.** Start with 420; kills and objectives replenish it. Three
team permits and three fixed pads limit fortifications. Rail repeater (300),
Cold-iron snare (320), and Mender relay (360) supply damage, control and healing.
The owner reserves the pad and Scrap atomically; construction takes five seconds.
The panel shows ownership and progress. A separate confirmation button prevents
a ground click from spending the team's resources. There is no selling or crafting.

## Controls

| Input | Action |
| --- | --- |
| Click deck | Move; automatically attack nearby enemies or the exposed foundry |
| Q / W / E | Select an ability; ground abilities then require an aimed click |
| Escape | Cancel targeting / close the drawer |
| R or click an ally/drop/console | Revive, collect, or interact; automatically walk into range |
| 1–4 | Use a consumable or toggle equipment in that slot |
| Shift + inventory click / 1–4 | Drop that item |
| I / B | Inventory/shop / fortifications |
| F / O | Follow the local hero / overview |
| Wheel / arrows / right-drag | Tactical camera zoom / pan |
| P | Solo pause; solo speed and save controls are in the field manual |

Co-op has no pause or speed changes. The HUD includes ability cooldowns,
personal XP, inventories, team Scrap/permits, base hull, event and wave state.

## Authority and rendering

`src/game/siege/` contains the plain serializable state, seeded RNG, content,
50ms simulation and validated player actions. It reuses the room navigation
graph. Legacy `GameState` and campaign systems retain their existing behavior.
Every siege command carries a player ID; gameplay never trusts client-reported
damage, inventory, construction success, rewards or currency changes.

`server/siege-server.js` owns one simulation per room. WebSockets carry commands
and 10Hz authoritative snapshots; clients smooth entity positions for display.
The server binds commands to opaque sessions, rejects replayed sequence numbers,
limits message size/rate, and detects dead connections with ping/pong. Reconnect
tokens stay out of broadcast state. A disconnected hero returns to the reactor;
the host role transfers to a connected player. Use **Reconnect** or **Rejoin
saved session** in the same tab. Empty rooms expire after five minutes; disconnected
lobby slots expire after one minute. Running-match slots remain reserved. Server
restart loses rooms; there is no persistence service or late joining after launch.

`src/three/siege/` owns ID-keyed hero/enemy views, interpolation, camera, lighting,
telegraphs and disposable scene objects. `src/ui/siege/` owns the DOM. Both heroes
use distinct existing manifest-registered models; the scene reuses the industrial
floor kit and reserve reactor, gates, pylons and machinery. No external art was added.

## Verification and scope

Run `npm.cmd run check` for unit/integration tests, production build, GLB checks
and Chromium regressions. Siege browser tests cover production startup, desktop
and phone layouts, a complete solo path with a legal-command pilot, and two live
WebSocket clients through selection, movement, shared spending, reconnect and
matching defeat. Long runs advance real simulation ticks faster than wall time;
they do not shorten game schedules or grant combat resources. Test clock controls
exist only in the test fixture, never in the production server.

Browser servers are owned through Vite's API and explicitly closed during test
teardown. This avoids the baseline Windows shell/process-tree shutdown hang.

If the bundled Chromium stalls before opening a page on Windows, select the
installed Microsoft Edge browser for the same tests:

```powershell
$env:CINDER_BROWSER_CHANNEL = 'msedge'
npm.cmd run check
Remove-Item Env:CINDER_BROWSER_CHANNEL
```

On this Windows host, an inherited process search path also caused browser
cleanup to stall after the assertions passed. A verification process launched
with a temporary path containing Windows System32, Windows and the Node install
closed cleanly. No machine-wide environment settings were changed.

The first acceptance pass passed 123 unit/integration tests, the production
build, validation of all eight GLBs, and all nine browser scenarios in Edge.
The three siege browser scenarios also passed in bundled Chromium before its
later startup problem. Dependency audit reported zero vulnerabilities.

Deferred: public deployment, matchmaking/accounts, durable co-op saves, late join,
prediction/lag compensation, full touch-control tuning, richer boss phases,
crafting and additional heroes. Full-run human balance and non-local network
latency still need playtesting. This is a complete first slice, not a finished game.
