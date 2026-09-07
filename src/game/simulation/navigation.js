// The hero navigates on a grid so both maps can give towers solid collision.
// Maze cells match enemy pathing; Switchyard uses a finer invisible grid.
export function getHeroGrid(map) {
  return map.mode === 'maze' ? map.grid : map.heroGrid;
}

export function heroCellKey(cell) {
  return `${cell.col},${cell.row}`;
}

export function cellsMatch(first, second) {
  return Boolean(first && second && first.col === second.col && first.row === second.row);
}

export function worldToHeroCell(map, x, y) {
  const grid = getHeroGrid(map);
  return {
    col: Math.floor((x - grid.x) / grid.cellSize),
    row: Math.floor((y - grid.y) / grid.cellSize),
  };
}

export function heroCellCenter(map, cell) {
  const grid = getHeroGrid(map);
  return {
    x: grid.x + (cell.col + 0.5) * grid.cellSize,
    y: grid.y + (cell.row + 0.5) * grid.cellSize,
  };
}

export function isInsideHeroGrid(map, cell) {
  const grid = getHeroGrid(map);
  return cell.col >= 0 && cell.col < grid.columns && cell.row >= 0 && cell.row < grid.rows;
}

function neighbors(cell) {
  return [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col, row: cell.row - 1 },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col - 1, row: cell.row },
  ];
}

export function isHeroCellBlocked(map, towers, cell) {
  towers = towers.filter((tower) => !(tower.type === 'wall' && tower.ladder));
  if (map.mode === 'maze') {
    return towers.some((tower) => cellsMatch(worldToHeroCell(map, tower.x, tower.y), cell));
  }

  const point = heroCellCenter(map, cell);
  const clearance = map.heroTowerClearance ?? 30;
  return towers.some((tower) => Math.hypot(tower.x - point.x, tower.y - point.y) < clearance);
}

export function findNearestOpenHeroCell(map, towers, cell) {
  if (!isInsideHeroGrid(map, cell)) {
    return null;
  }

  const queue = [{ ...cell }];
  const seen = new Set([heroCellKey(cell)]);

  for (let index = 0; index < queue.length; index += 1) {
    const candidate = queue[index];
    if (!isHeroCellBlocked(map, towers, candidate)) {
      return candidate;
    }

    for (const next of neighbors(candidate)) {
      const key = heroCellKey(next);
      if (isInsideHeroGrid(map, next) && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }

  return null;
}

export function findHeroPath(map, towers, startPosition, targetPosition) {
  const start = findNearestOpenHeroCell(
    map,
    towers,
    worldToHeroCell(map, startPosition.x, startPosition.y),
  );
  const destination = findNearestOpenHeroCell(
    map,
    towers,
    worldToHeroCell(map, targetPosition.x, targetPosition.y),
  );

  if (!start || !destination) {
    return null;
  }

  const queue = [start];
  const previous = new Map([[heroCellKey(start), null]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (cellsMatch(current, destination)) {
      break;
    }

    for (const next of neighbors(current)) {
      const key = heroCellKey(next);
      if (
        isInsideHeroGrid(map, next) &&
        !isHeroCellBlocked(map, towers, next) &&
        !previous.has(key)
      ) {
        previous.set(key, current);
        queue.push(next);
      }
    }
  }

  if (!previous.has(heroCellKey(destination))) {
    return null;
  }

  const cells = [];
  for (let cursor = destination; cursor; cursor = previous.get(heroCellKey(cursor))) {
    cells.unshift({ ...cursor });
  }

  return {
    cells,
    destination: heroCellCenter(map, destination),
  };
}

export function getTowerNavigationRevision(towers) {
  return towers.map((tower) => `${tower.id}:${tower.x}:${tower.y}:${Boolean(tower.ladder)}`).join('|');
}
