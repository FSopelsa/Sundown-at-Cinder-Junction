import { getEncounter } from '../content/campaign.js';
import { buildRoomDistanceField, roomCellKey, roomCellCenter, roomRoutePoints, roomCellsMatch, findRoomHeroPath } from './roomNavigation.js';

// Each enemy route has an explicit scope and objective. Side chambers never
// become shortcuts through the trunk, and the sun must be visited first.
export function campaignRouteMap(map, encounter, beforeSun = false) {
  if (!encounter) return map;
  const ids = encounter.element ? [encounter.roomId] : beforeSun ? ['sun'] : ['room-1', 'room-2', 'sun'];
  return { ...map, rooms: map.rooms.filter(room => ids.includes(room.id)),
    roomConnections: map.roomConnections.filter(door => ids.includes(door.from.roomId) && ids.includes(door.to.roomId)),
    entrance: beforeSun ? encounter.spawn : encounter.id === 'sun' ? map.campaign.checkpoint : encounter.spawn,
    exit: beforeSun ? map.campaign.checkpoint : encounter.goal ?? map.exit };
}

export function campaignWormholes(map, wormholes) {
  // A temporary shortcut cannot cross a checkpoint boundary or a trial wall.
  return wormholes?.length === 2 && wormholes.every(p => map.rooms.some(r => r.id === p.cell?.roomId)) &&
    wormholes[0].cell.roomId === wormholes[1].cell.roomId ? wormholes : [];
}

export function campaignRoutePoints(map, state) {
  const encounter = getEncounter(map, state);
  if (!encounter || state.campaign.completed.includes(encounter.id)) return [];
  return (encounter.id === 'sun' ? [true, false] : [false]).flatMap(before => {
    const route = campaignRouteMap(map, encounter, before);
    const portals = campaignWormholes(route, state.wormholes);
    return roomRoutePoints(route, buildRoomDistanceField(route, state.towers, null, portals, state.roomState), portals, state.roomState);
  });
}

export function validateCampaignPlacement(map, state, cell, towers) {
  const room = map.rooms.find(r => r.id === cell.roomId);
  if (!state.roomState.unlockedRoomIds.includes(cell.roomId)) return { ok: false, reason: 'That room has not been revealed.' };
  if (['workshop', 'boss'].includes(room.kind)) return { ok: false, reason: 'This is an exploration room. Build defenses in the combat rooms.' };
  const reserved = [...map.rooms.map(r => r.terminal), map.campaign.checkpoint,
    ...map.campaign.encounters.flatMap(e => [e.spawn, e.goal].filter(Boolean))];
  if (reserved.some(c => roomCellsMatch(c, cell))) return { ok: false, reason: 'Keep machines, checkpoints and spawn gates clear.' };
  // Validate permanent walking routes without relying on an expiring tunnel.
  for (const encounter of map.campaign.encounters.filter(e => state.roomState.unlockedRoomIds.includes(e.roomId))) {
    for (const before of encounter.id === 'sun' ? [true, false] : [false]) {
      const route = campaignRouteMap(map, encounter, before);
      const field = buildRoomDistanceField(route, towers, cell, [], state.roomState);
      const live = state.enemies.filter(e => before === (e.encounterId === 'sun' && !e.sunVisited) && e.encounterId === encounter.id);
      if (![route.entrance, ...live.map(e => e.roomNext ?? e.roomCell)].every(c => field.has(roomCellKey(c)))) {
        return { ok: false, reason: 'Keep the spawn → sun → goal route open, including enemies already in the maze.' };
      }
    }
  }
  const withCandidate = [...towers, { type: 'wall', ...roomCellCenter(map, cell) }];
  const anchors = [...map.rooms.filter(r => state.roomState.unlockedRoomIds.includes(r.id)).map(r => r.terminal),
    ...map.roomConnections.flatMap(d => [d.from, d.to]).filter(c => state.roomState.unlockedRoomIds.includes(c.roomId))];
  if (anchors.some(anchor => !findRoomHeroPath(map, withCandidate, state.hero, roomCellCenter(map, anchor), state.roomState))) {
    return { ok: false, reason: 'Leave Singularity a route to every save machine and doorway.' };
  }
  return { ok: true };
}
