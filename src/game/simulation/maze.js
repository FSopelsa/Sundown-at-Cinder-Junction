// A reverse 0-1 distance field gives every open cell its shortest travel cost
// to the exit. Normal moves cost one cell; an active Worm Tunnel costs zero.
// All enemies share this field and rebuild it only when blockers or portals change.
export function cellKey(cell) {
  return `${cell.col},${cell.row}`;
}

export function worldToCell(map, x, y) {
  return {
    col: Math.floor((x - map.grid.x) / map.grid.cellSize),
    row: Math.floor((y - map.grid.y) / map.grid.cellSize),
  };
}

export function cellCenter(map, cell) {
  return {
    x: map.grid.x + (cell.col + 0.5) * map.grid.cellSize,
    y: map.grid.y + (cell.row + 0.5) * map.grid.cellSize,
  };
}

export function isInsideGrid(map, cell) {
  return cell.col >= 0 && cell.col < map.grid.columns &&
    cell.row >= 0 && cell.row < map.grid.rows;
}

function neighbors(cell) {
  return [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col, row: cell.row - 1 },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col - 1, row: cell.row },
  ];
}

function normalizedWormholes(wormholes = []) {
  if (!Array.isArray(wormholes) || wormholes.length !== 2) return [];
  const [first, second] = wormholes;
  if (!first?.cell || !second?.cell) return [];
  return [first, second];
}

export function getWormholePeer(cell, wormholes = []) {
  const [first, second] = normalizedWormholes(wormholes);
  if (!first || !second) return null;
  if (cellKey(cell) === cellKey(first.cell)) return { ...second.cell };
  if (cellKey(cell) === cellKey(second.cell)) return { ...first.cell };
  return null;
}

export function isWormholeTransition(from, to, wormholes = []) {
  const peer = getWormholePeer(from, wormholes);
  return Boolean(peer && to && cellKey(peer) === cellKey(to));
}

export function buildDistanceField(map, towers, candidate = null, wormholes = []) {
  const blocked = new Set(towers.map((tower) => cellKey(worldToCell(map, tower.x, tower.y))));
  if (candidate) blocked.add(cellKey(candidate));
  const distances = new Map();
  if (blocked.has(cellKey(map.exit))) return distances;
  const queue = [map.exit];
  distances.set(cellKey(map.exit), 0);
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    const distance = distances.get(cellKey(cell));
    const portalPeer = getWormholePeer(cell, wormholes);
    const transitions = [
      ...neighbors(cell).map((next) => ({ next, cost: 1 })),
      ...(portalPeer ? [{ next: portalPeer, cost: 0 }] : []),
    ];
    for (const { next, cost } of transitions) {
      const key = cellKey(next);
      const nextDistance = distance + cost;
      if (!isInsideGrid(map, next) || blocked.has(key) ||
        (distances.has(key) && distances.get(key) <= nextDistance)) continue;
      distances.set(key, nextDistance);
      if (cost === 0) queue.splice(index + 1, 0, next);
      else queue.push(next);
    }
  }
  return distances;
}

export function nextRouteCell(cell, distances, wormholes = []) {
  const distance = distances.get(cellKey(cell));
  const portalPeer = getWormholePeer(cell, wormholes);
  const normalStep = neighbors(cell)
    .find((next) => distances.get(cellKey(next)) === distance - 1);
  if (normalStep) return normalStep;
  return portalPeer && distances.get(cellKey(portalPeer)) === distance
    ? portalPeer
    : null;
}

export function routePoints(map, distances, wormholes = []) {
  const points = [];
  let cell = map.entrance;
  if (!distances.has(cellKey(cell))) return points;
  while (cell) {
    points.push(cellCenter(map, cell));
    cell = nextRouteCell(cell, distances, wormholes);
  }
  return points;
}

export function validateMazePlacement(map, state, x, y, options = {}) {
  const { ignoreTowerId = null, wormholes = state.wormholes ?? [] } = options;
  const cell = worldToCell(map, x, y);
  const key = cellKey(cell);
  if (!isInsideGrid(map, cell)) return { ok: false, reason: 'Build inside the maze grid.' };
  if (key === cellKey(map.entrance) || key === cellKey(map.exit)) {
    return { ok: false, reason: 'Keep the entrance and exit clear.' };
  }
  if (Array.isArray(wormholes) && wormholes.some(
    (portal) => portal?.cell && cellKey(portal.cell) === key,
  )) {
    return { ok: false, reason: 'A Worm Tunnel endpoint occupies this cell.' };
  }
  const activeTowers = state.towers.filter((tower) => tower.id !== ignoreTowerId);
  if (activeTowers.some((tower) => cellKey(worldToCell(map, tower.x, tower.y)) === key)) {
    return { ok: false, reason: 'This cell already contains a tower.' };
  }
  // Reserve both ends of a moving enemy's segment so a new tower cannot
  // appear under it or force it to cut diagonally through a blocked cell.
  if (state.enemies.some((enemy) => [enemy.mazeCell, enemy.mazeNext, worldToCell(map, enemy.x, enemy.y)]
    .some((occupied) => occupied && cellKey(occupied) === key))) {
    return { ok: false, reason: 'An enemy is crossing this cell.' };
  }
  const distances = buildDistanceField(map, activeTowers, cell, wormholes);
  if (!distances.has(cellKey(map.entrance)) || state.enemies.some((enemy) =>
    !distances.has(cellKey(enemy.mazeNext ?? enemy.mazeCell ?? worldToCell(map, enemy.x, enemy.y))))) {
    return { ok: false, reason: 'Leave an open route to the exit for every enemy.' };
  }
  return { ok: true, ...cellCenter(map, cell) };
}
