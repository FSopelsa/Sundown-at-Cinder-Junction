// Room maps retain a local grid per room. A cell's room ID is part of every
// navigation key, so adjoining rooms can grow independently without turning
// the campaign into one enormous, fragile flattened grid.

export function isRoomMap(map) {
  return map?.mode === 'rooms';
}

export function roomCellKey(cell) {
  return cell ? `${cell.roomId}:${cell.col},${cell.row}` : '';
}

export function roomCellsMatch(first, second) {
  return Boolean(
    first && second &&
      first.roomId === second.roomId &&
      first.col === second.col &&
      first.row === second.row,
  );
}

export function getRoom(map, roomId) {
  return map.rooms?.find((room) => room.id === roomId) ?? null;
}

export function getRoomAtWorldPosition(map, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return map.rooms?.find((room) => {
    const { grid } = room;
    return x >= grid.x && x < grid.x + grid.columns * grid.cellSize &&
      y >= grid.y && y < grid.y + grid.rows * grid.cellSize;
  }) ?? null;
}

export function worldToRoomCell(map, x, y) {
  const room = getRoomAtWorldPosition(map, x, y);
  if (!room) return null;
  const { grid } = room;
  return {
    roomId: room.id,
    col: Math.floor((x - grid.x) / grid.cellSize),
    row: Math.floor((y - grid.y) / grid.cellSize),
  };
}

export function roomCellCenter(map, cell) {
  const room = getRoom(map, cell?.roomId);
  if (!room) return null;
  const { grid } = room;
  return {
    x: grid.x + (cell.col + 0.5) * grid.cellSize,
    y: grid.y + (cell.row + 0.5) * grid.cellSize,
  };
}

export function isInsideRoomGrid(map, cell) {
  const room = getRoom(map, cell?.roomId);
  return Boolean(
    room && cell.col >= 0 && cell.col < room.grid.columns &&
      cell.row >= 0 && cell.row < room.grid.rows,
  );
}

function gridNeighbors(cell) {
  return [
    { roomId: cell.roomId, col: cell.col + 1, row: cell.row },
    { roomId: cell.roomId, col: cell.col, row: cell.row - 1 },
    { roomId: cell.roomId, col: cell.col, row: cell.row + 1 },
    { roomId: cell.roomId, col: cell.col - 1, row: cell.row },
  ];
}

function connectionIsOpen(connection, roomState = null) {
  if (!connection) return false;
  if (Array.isArray(roomState?.openDoorIds)) {
    return roomState.openDoorIds.includes(connection.id);
  }
  return connection.initiallyOpen !== false;
}

export function isDoorCell(map, cell, roomState = null) {
  return Boolean(map.roomConnections?.some((connection) =>
    connectionIsOpen(connection, roomState) &&
      (roomCellsMatch(connection.from, cell) || roomCellsMatch(connection.to, cell)),
  ));
}

export function getRoomNeighbors(map, cell, roomState = null) {
  if (!isInsideRoomGrid(map, cell)) return [];
  const connected = map.roomConnections
    ?.filter((connection) => connectionIsOpen(connection, roomState))
    .flatMap((connection) => {
      if (roomCellsMatch(connection.from, cell)) return [{ ...connection.to }];
      if (roomCellsMatch(connection.to, cell)) return [{ ...connection.from }];
      return [];
    }) ?? [];
  return [...gridNeighbors(cell), ...connected].filter((next) => isInsideRoomGrid(map, next));
}

export function towerRoomCell(map, tower) {
  return worldToRoomCell(map, tower.x, tower.y);
}

export function isRoomCellBlocked(map, towers, cell) {
  if (!isInsideRoomGrid(map, cell)) return true;
  return towers
    .filter((tower) => !(tower.type === 'wall' && tower.ladder))
    .some((tower) => roomCellsMatch(towerRoomCell(map, tower), cell));
}

export function findNearestOpenRoomCell(map, towers, cell, roomState = null) {
  if (!isInsideRoomGrid(map, cell)) return null;
  const queue = [{ ...cell }];
  const seen = new Set([roomCellKey(cell)]);

  for (let index = 0; index < queue.length; index += 1) {
    const candidate = queue[index];
    if (!isRoomCellBlocked(map, towers, candidate)) return candidate;
    for (const next of getRoomNeighbors(map, candidate, roomState)) {
      const key = roomCellKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return null;
}

export function findRoomHeroPath(map, towers, startPosition, targetPosition, roomState = null) {
  const start = findNearestOpenRoomCell(
    map,
    towers,
    worldToRoomCell(map, startPosition.x, startPosition.y),
    roomState,
  );
  const destination = findNearestOpenRoomCell(
    map,
    towers,
    worldToRoomCell(map, targetPosition.x, targetPosition.y),
    roomState,
  );
  if (!start || !destination) return null;

  const queue = [start];
  const previous = new Map([[roomCellKey(start), null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (roomCellsMatch(current, destination)) break;
    for (const next of getRoomNeighbors(map, current, roomState)) {
      const key = roomCellKey(next);
      if (!isRoomCellBlocked(map, towers, next) && !previous.has(key)) {
        previous.set(key, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(roomCellKey(destination))) return null;

  const cells = [];
  for (let cursor = destination; cursor; cursor = previous.get(roomCellKey(cursor))) {
    cells.unshift({ ...cursor });
  }
  return { cells, destination: roomCellCenter(map, destination) };
}

function getRoomWormholePeer(cell, wormholes = []) {
  if (!Array.isArray(wormholes) || wormholes.length !== 2) return null;
  const [first, second] = wormholes;
  if (!first?.cell || !second?.cell) return null;
  if (roomCellsMatch(first.cell, cell)) return { ...second.cell };
  if (roomCellsMatch(second.cell, cell)) return { ...first.cell };
  return null;
}

export function isRoomWormholeTransition(from, to, wormholes = []) {
  return roomCellsMatch(getRoomWormholePeer(from, wormholes), to);
}

function roomTransitions(map, cell, wormholes, roomState) {
  const portalPeer = getRoomWormholePeer(cell, wormholes);
  return [
    ...getRoomNeighbors(map, cell, roomState).map((next) => ({ next, cost: 1 })),
    ...(portalPeer ? [{ next: portalPeer, cost: 0 }] : []),
  ];
}

export function buildRoomDistanceField(
  map,
  towers,
  candidate = null,
  wormholes = [],
  roomState = null,
) {
  const blocked = new Set(
    towers
      .map((tower) => towerRoomCell(map, tower))
      .filter(Boolean)
      .map(roomCellKey),
  );
  if (candidate) blocked.add(roomCellKey(candidate));
  const distances = new Map();
  if (blocked.has(roomCellKey(map.exit))) return distances;

  const frontier = [{ cell: { ...map.exit }, distance: 0 }];
  distances.set(roomCellKey(map.exit), 0);
  while (frontier.length > 0) {
    frontier.sort((first, second) => first.distance - second.distance);
    const { cell, distance } = frontier.shift();
    if (distance !== distances.get(roomCellKey(cell))) continue;
    for (const { next, cost } of roomTransitions(map, cell, wormholes, roomState)) {
      const key = roomCellKey(next);
      const nextDistance = distance + cost;
      if (blocked.has(key) || (distances.has(key) && distances.get(key) <= nextDistance)) continue;
      distances.set(key, nextDistance);
      frontier.push({ cell: next, distance: nextDistance });
    }
  }
  return distances;
}

export function nextRoomRouteCell(cell, distances, wormholes = [], map, roomState = null) {
  const distance = distances.get(roomCellKey(cell));
  if (!Number.isFinite(distance)) return null;
  return roomTransitions(map, cell, wormholes, roomState)
    .find(({ next, cost }) => distances.get(roomCellKey(next)) === distance - cost)?.next ?? null;
}

export function roomRoutePoints(map, distances, wormholes = [], roomState = null) {
  const points = [];
  let cell = { ...map.entrance };
  const seen = new Set();
  while (cell && !seen.has(roomCellKey(cell))) {
    seen.add(roomCellKey(cell));
    const point = roomCellCenter(map, cell);
    if (!point) break;
    points.push(point);
    cell = nextRoomRouteCell(cell, distances, wormholes, map, roomState);
  }
  return points;
}

export function validateRoomPlacement(map, state, x, y, options = {}) {
  const { ignoreTowerId = null, roomState = state.roomState } = options;
  const cell = worldToRoomCell(map, x, y);
  if (!cell) return { ok: false, reason: 'Build inside an unlocked room.' };
  if (roomCellsMatch(cell, map.entrance) || roomCellsMatch(cell, map.exit) || isDoorCell(map, cell, roomState)) {
    return { ok: false, reason: 'Keep room entrances, exits, and doors clear.' };
  }

  const activeTowers = state.towers.filter((tower) => tower.id !== ignoreTowerId);
  if (activeTowers.some((tower) => roomCellsMatch(towerRoomCell(map, tower), cell))) {
    return { ok: false, reason: 'This cell already contains a tower.' };
  }
  if (state.enemies.some((enemy) =>
    [enemy.roomCell, enemy.roomNext, worldToRoomCell(map, enemy.x, enemy.y)]
      .some((occupied) => roomCellsMatch(occupied, cell)))) {
    return { ok: false, reason: 'An enemy is crossing this cell.' };
  }

  const distances = buildRoomDistanceField(map, activeTowers, cell, state.wormholes, roomState);
  const currentCells = state.enemies
    .map((enemy) => enemy.roomNext ?? enemy.roomCell ?? worldToRoomCell(map, enemy.x, enemy.y));
  if (!distances.has(roomCellKey(map.entrance)) ||
    currentCells.some((enemyCell) => enemyCell && !distances.has(roomCellKey(enemyCell)))) {
    return { ok: false, reason: 'Leave an open route through every unlocked room.' };
  }
  return { ok: true, cell, ...roomCellCenter(map, cell) };
}
