import { getEncounter } from '../content/campaign.js';
import { campaignRouteMap, campaignWormholes } from './campaignRouting.js';
import { buildRoomDistanceField, roomCellKey, roomCellCenter, roomCellsMatch, nextRoomRouteCell, isRoomWormholeTransition } from './roomNavigation.js';

export function refreshCampaignRoutes(system) {
  const { map, gameState: state } = system;
  const encounter = getEncounter(map, state);
  const revision = JSON.stringify([encounter?.id, state.towers.map(t => [t.id, t.x, t.y]), state.roomState,
    state.wormholes.map(p => [p.cell, p.remainingMs > 0])]);
  if (revision === system.roomRevision) return;
  system.roomRevision = revision;
  system.campaignFields = [false, true].map(before => {
    const route = campaignRouteMap(map, encounter, before && encounter?.id === 'sun');
    const portals = campaignWormholes(route, state.wormholes);
    return { map: route, portals, distances: buildRoomDistanceField(route, state.towers, null, portals, state.roomState) };
  });
  system.roomDistances = system.campaignFields[encounter?.id === 'sun' ? 1 : 0].distances;
}

export function moveCampaignEnemy(system, enemy, distance) {
  const { map, gameState: state } = system;
  const visitSun = () => {
    if (enemy.encounterId !== 'sun' || enemy.sunVisited || !roomCellsMatch(enemy.roomCell, map.campaign.checkpoint)) return;
    enemy.sunVisited = true;
    enemy.sunDoorPermission = true;
    enemy.sunRegenRemainingMs = map.campaign.regenMs;
    enemy.roomNext = null;
  };
  visitSun();
  let route;
  let iterations = 0;
  while (distance > 0 && iterations++ < 256) {
    route = system.campaignFields[enemy.encounterId === 'sun' && !enemy.sunVisited ? 1 : 0];
    if (roomCellsMatch(enemy.roomCell, route.map.exit)) break;
    // Keep an ordinary in-flight step; discard a cached expired portal jump.
    if (enemy.roomNext && enemy.roomNext.roomId === enemy.roomCell.roomId &&
      Math.abs(enemy.roomNext.col - enemy.roomCell.col) + Math.abs(enemy.roomNext.row - enemy.roomCell.row) > 1 &&
      !isRoomWormholeTransition(enemy.roomCell, enemy.roomNext, route.portals)) enemy.roomNext = null;
    enemy.roomNext ??= nextRoomRouteCell(enemy.roomCell, route.distances, route.portals, route.map, state.roomState);
    if (!enemy.roomNext) break;
    const passingSunDoor = enemy.roomCell.roomId === 'sun' && enemy.roomNext.roomId === 'room-2';
    if (passingSunDoor && !enemy.sunDoorPermission) { enemy.roomNext = null; break; }
    const target = roomCellCenter(map, enemy.roomNext);
    const segment = isRoomWormholeTransition(enemy.roomCell, enemy.roomNext, route.portals) ? 0 : Math.hypot(target.x - enemy.x, target.y - enemy.y);
    if (distance < segment) {
      enemy.x += (target.x - enemy.x) * distance / segment;
      enemy.y += (target.y - enemy.y) * distance / segment;
      distance = 0;
    } else {
      enemy.x = target.x;
      enemy.y = target.y;
      distance -= segment;
      enemy.roomCell = enemy.roomNext;
      enemy.roomNext = null;
      if (passingSunDoor) enemy.sunDoorPermission = false;
      visitSun();
    }
  }
  route = system.campaignFields[enemy.encounterId === 'sun' && !enemy.sunVisited ? 1 : 0];
  const cell = enemy.roomNext ?? enemy.roomCell;
  const target = roomCellCenter(map, cell);
  const extra = enemy.encounterId === 'sun' && !enemy.sunVisited
    ? system.campaignFields[0].distances.get(roomCellKey(map.campaign.checkpoint)) ?? 0 : 0;
  enemy.remainingDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y) + ((route.distances.get(roomCellKey(cell)) ?? Infinity) + extra) * 40;
  enemy.progress = roomCellsMatch(enemy.roomCell, system.campaignFields[0].map.exit) &&
    (enemy.encounterId !== 'sun' || enemy.sunVisited) ? 1 : 0;
}
