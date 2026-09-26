// A reverse 0-1 distance field gives every open cell its shortest travel cost
// to the exit. Normal moves cost one cell; an active Worm Tunnel costs zero
// from its first endpoint (entry) to its second endpoint (exit).
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
  const [entry, exit] = wormholes;
  if (!entry?.cell || !exit?.cell || entry.remainingMs <= 0 || exit.remainingMs <= 0) return [];
  return [entry, exit];
}

export function getWormholePeer(cell, wormholes = []) {
  const [entry, exit] = normalizedWormholes(wormholes);
  if (!entry || !exit) return null;
  if (cellKey(cell) === cellKey(entry.cell)) return { ...exit.cell };
  return null;
}

function getWormholeEntryForExit(cell, wormholes = []) {
  const [entry, exit] = normalizedWormholes(wormholes);
  if (!entry || !exit || cellKey(cell) !== cellKey(exit.cell)) return null;
  return { ...entry.cell };
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
    // The field is calculated from the exit backwards. A directed entry ->
    // exit tunnel therefore contributes its reverse edge only while building
    // the field; movement still only ever travels entry -> exit.
    const portalEntry = getWormholeEntryForExit(cell, wormholes);
    const transitions = [
      ...neighbors(cell).map((next) => ({ next, cost: 1 })),
      ...(portalEntry ? [{ next: portalEntry, cost: 0 }] : []),
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
  if (portalPeer && distances.get(cellKey(portalPeer)) === distance) return portalPeer;
  const normalStep = neighbors(cell)
    .find((next) => distances.get(cellKey(next)) === distance - 1);
  if (normalStep) return normalStep;
  return null;
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
  const hasRouteForCurrentActors = (distances) => distances.has(cellKey(map.entrance)) &&
    !state.enemies.some((enemy) =>
      !distances.has(cellKey(enemy.mazeNext ?? enemy.mazeCell ?? worldToCell(map, enemy.x, enemy.y))));

  const distances = buildDistanceField(map, activeTowers, cell, wormholes);
  if (!hasRouteForCurrentActors(distances)) {
    return { ok: false, reason: 'Leave an open route to the exit for every enemy.' };
  }

  // A temporary tunnel may shorten the route, but it must never be the only
  // thing keeping a permanent tower layout playable after the tunnel expires.
  if (wormholes.length === 2 && wormholes.every((portal) => portal?.remainingMs > 0) &&
    !hasRouteForCurrentActors(buildDistanceField(map, activeTowers, cell))) {
    return { ok: false, reason: 'Leave an open route after the Worm Tunnel expires.' };
  }

  return { ok: true, ...cellCenter(map, cell) };
}
