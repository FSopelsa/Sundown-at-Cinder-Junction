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
  const [entry, exit] = wormholes;
  if (!entry?.cell || !exit?.cell || entry.remainingMs <= 0 || exit.remainingMs <= 0) return null;
  if (roomCellsMatch(entry.cell, cell)) return { ...exit.cell };
  return null;
}

function getRoomWormholeEntryForExit(cell, wormholes = []) {
  if (!Array.isArray(wormholes) || wormholes.length !== 2) return null;
  const [entry, exit] = wormholes;
  if (!entry?.cell || !exit?.cell || entry.remainingMs <= 0 || exit.remainingMs <= 0) return null;
  if (roomCellsMatch(exit.cell, cell)) return { ...entry.cell };
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

function reverseRoomTransitions(map, cell, wormholes, roomState) {
  const portalEntry = getRoomWormholeEntryForExit(cell, wormholes);
  return [
    ...getRoomNeighbors(map, cell, roomState).map((next) => ({ next, cost: 1 })),
    ...(portalEntry ? [{ next: portalEntry, cost: 0 }] : []),
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
    for (const { next, cost } of reverseRoomTransitions(map, cell, wormholes, roomState)) {
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
  const portalExit = getRoomWormholePeer(cell, wormholes);
  if (portalExit && distances.get(roomCellKey(portalExit)) === distance) return portalExit;
  return getRoomNeighbors(map, cell, roomState)
    .find((next) => distances.get(roomCellKey(next)) === distance - 1) ?? null;
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

function roomBounds(room) {
  const { grid } = room;
  return {
    minX: grid.x,
    maxX: grid.x + grid.columns * grid.cellSize,
    minY: grid.y,
    maxY: grid.y + grid.rows * grid.cellSize,
  };
}

function boundsOverlap(first, second) {
  return first.minX < second.maxX && second.minX < first.maxX &&
    first.minY < second.maxY && second.minY < first.maxY;
}

// Room reachability ignoring door state: a room no unlock could ever connect
// is dead content rather than locked content.
function connectedRoomIds(map) {
  const start = map.entrance?.roomId;
  const seen = new Set(start ? [start] : []);
  const queue = [...seen];
  for (let index = 0; index < queue.length; index += 1) {
    for (const connection of map.roomConnections ?? []) {
      const pair = [connection.from?.roomId, connection.to?.roomId];
      if (!pair.includes(queue[index])) continue;
      const next = pair.find((roomId) => roomId !== queue[index]);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

// Authoring guard for room maps. Every problem here would otherwise surface
// only at runtime as an unreachable exit, a stuck enemy, or a room the pointer
// silently resolves to the wrong grid.
export function validateRoomMap(map) {
  const problems = [];
  if (!isRoomMap(map)) problems.push('Map mode must be "rooms".');
  const rooms = map.rooms ?? [];
  if (rooms.length === 0) problems.push('A room map needs at least one room.');

  const seenRoomIds = new Set();
  for (const room of rooms) {
    if (seenRoomIds.has(room.id)) problems.push(`Duplicate room ID: ${room.id}.`);
    seenRoomIds.add(room.id);
    const { grid } = room;
    if (!(grid?.columns > 0 && grid?.rows > 0 && grid?.cellSize > 0)) {
      problems.push(`Room ${room.id} needs positive grid dimensions.`);
    }
  }
  for (let index = 0; index < rooms.length; index += 1) {
    for (let other = index + 1; other < rooms.length; other += 1) {
      if (boundsOverlap(roomBounds(rooms[index]), roomBounds(rooms[other]))) {
        problems.push(`Rooms ${rooms[index].id} and ${rooms[other].id} overlap in world space.`);
      }
    }
  }

  const seenDoorIds = new Set();
  for (const connection of map.roomConnections ?? []) {
    if (seenDoorIds.has(connection.id)) problems.push(`Duplicate door ID: ${connection.id}.`);
    seenDoorIds.add(connection.id);
    for (const cell of [connection.from, connection.to]) {
      if (!isInsideRoomGrid(map, cell)) {
        problems.push(`Door ${connection.id} points outside room ${cell?.roomId ?? 'unknown'}.`);
      }
    }
    if (connection.from?.roomId === connection.to?.roomId) {
      problems.push(`Door ${connection.id} must join two different rooms.`);
    }
  }

  for (const [label, cell] of [['entrance', map.entrance], ['exit', map.exit]]) {
    if (!isInsideRoomGrid(map, cell)) problems.push(`The ${label} cell is outside every room grid.`);
  }
  if (roomCellsMatch(map.entrance, map.exit)) problems.push('The entrance and the exit share a cell.');
  if (!worldToRoomCell(map, map.heroSpawn?.x, map.heroSpawn?.y)) {
    problems.push('The hero spawn is outside every room.');
  }

  const connected = connectedRoomIds(map);
  for (const room of rooms) {
    if (!connected.has(room.id)) {
      problems.push(`Room ${room.id} is not connected to the entrance room.`);
    }
  }
  const distances = buildRoomDistanceField(map, [], null, [], map.roomState);
  if (!distances.has(roomCellKey(map.entrance))) {
    problems.push('No open route leads from the entrance to the exit.');
  }

  return { ok: problems.length === 0, problems };
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
