import { cellKey, worldToCell } from '../game/simulation/maze.js';
import { isRoomMap, roomCellKey, roomCellsMatch, towerRoomCell } from '../game/simulation/roomNavigation.js';

function getTowerCell(map, tower) {
  if (!map || !tower || (!isRoomMap(map) && !map.grid)) return null;
  return isRoomMap(map) ? towerRoomCell(map, tower) : worldToCell(map, tower.x, tower.y);
}

function cellsMatch(map, first, second) {
  if (!first || !second) return false;
  return isRoomMap(map)
    ? roomCellsMatch(first, second)
    : cellKey(first) === cellKey(second);
}

function cellIdentity(map, cell) {
  return isRoomMap(map) ? roomCellKey(cell) : cellKey(cell);
}

function neighbours(map, cell) {
  if (isRoomMap(map)) {
    return {
      west: { roomId: cell.roomId, col: cell.col - 1, row: cell.row },
      east: { roomId: cell.roomId, col: cell.col + 1, row: cell.row },
      north: { roomId: cell.roomId, col: cell.col, row: cell.row - 1 },
      south: { roomId: cell.roomId, col: cell.col, row: cell.row + 1 },
    };
  }
  return {
    west: { col: cell.col - 1, row: cell.row },
    east: { col: cell.col + 1, row: cell.row },
    north: { col: cell.col, row: cell.row - 1 },
    south: { col: cell.col, row: cell.row + 1 },
  };
}

/**
 * Returns the presentational join state for a simulation-owned wall. The
 * simulation remains responsible for the cell occupancy and path validation;
 * this only tells Three.js which GLB end caps to show.
 */
export function getWallTopology(map, tower, towers = []) {
  if (!map || tower?.type !== 'wall') {
    return {
      axis: 'x',
      cross: false,
      showNegativeEndCap: true,
      showPositiveEndCap: true,
    };
  }

  const cell = getTowerCell(map, tower);
  if (!cell) return { axis: 'x', cross: false, showNegativeEndCap: true, showPositiveEndCap: true };
  const nearby = neighbours(map, cell);
  const wallCells = new Set(
    towers
      .filter((candidate) => candidate.type === 'wall')
      .map((candidate) => getTowerCell(map, candidate))
      .filter(Boolean)
      .map((candidate) => cellIdentity(map, candidate)),
  );
  const connected = Object.fromEntries(
    Object.entries(nearby).map(([direction, candidate]) => [
      direction,
      wallCells.has(cellIdentity(map, candidate)),
    ]),
  );

  // If a layout contains both axes, the presenter renders the primary core and
  // a perpendicular duplicate. Horizontal is primary only to keep this result
  // deterministic; a dedicated corner kit can supersede it later.
  const hasHorizontal = connected.west || connected.east;
  const hasVertical = connected.north || connected.south;
  const axis = hasHorizontal ? 'x' : hasVertical ? 'z' : 'x';
  const caps = axis === 'x'
    ? { negative: !connected.west, positive: !connected.east }
    : { negative: !connected.south, positive: !connected.north };

  return {
    axis,
    cross: hasHorizontal && hasVertical,
    showNegativeEndCap: caps.negative,
    showPositiveEndCap: caps.positive,
  };
}

export function wallsShareCell(map, first, second) {
  return cellsMatch(map, getTowerCell(map, first), getTowerCell(map, second));
}
