const path = [
  { x: 0, y: 118 },
  { x: 250, y: 118 },
  { x: 250, y: 520 },
  { x: 590, y: 520 },
  { x: 590, y: 220 },
  { x: 930, y: 220 },
  { x: 930, y: 590 },
  { x: 1280, y: 590 },
].map(Object.freeze);

export const SWITCHYARD_MAP = Object.freeze({
  id: 'cinder-switchyard',
  name: 'Cinder Switchyard',
  startingScrap: 120,
  width: 1280,
  height: 720,
  path: Object.freeze(path),
  buildMargin: 26,
  pathClearance: 55,
  towerSpacing: 38,
  heroSpawn: Object.freeze({ x: 84, y: 228 }),
  heroGrid: Object.freeze({ x: 0, y: 0, columns: 53, rows: 30, cellSize: 24 }),
  heroTowerClearance: 30,
});

export const MAZE_MAP = Object.freeze({
  id: 'cinder-maze',
  name: 'Cinder Maze',
  mode: 'maze',
  width: 1280,
  height: 720,
  startingScrap: 480,
  grid: Object.freeze({ x: 160, y: 120, columns: 24, rows: 10, cellSize: 40 }),
  entrance: Object.freeze({ col: 0, row: 4 }),
  exit: Object.freeze({ col: 23, row: 4 }),
  heroSpawn: Object.freeze({ x: 260, y: 420 }),
});

export const OVERLOOK_MAP = Object.freeze({
  id: 'cinder-overlook',
  name: 'Cinder Overlook · Isometric',
  mode: 'maze',
  width: 1280,
  height: 720,
  startingScrap: 650,
  grid: Object.freeze({ x: 280, y: 100, columns: 18, rows: 12, cellSize: 40 }),
  entrance: Object.freeze({ col: 0, row: 5 }),
  exit: Object.freeze({ col: 17, row: 5 }),
  heroSpawn: Object.freeze({ x: 380, y: 440 }),
  waveSet: 'elemental-trial',
  presentation: Object.freeze({ type: 'isometric', originX: 553, originY: 128,
    halfWidth: 29, halfHeight: 12 }),
});

export const LEVELS = Object.freeze([SWITCHYARD_MAP, MAZE_MAP, OVERLOOK_MAP]);

export function getMap(levelId) {
  return LEVELS.find((map) => map.id === levelId) ?? SWITCHYARD_MAP;
}

export function getPathLength(points = SWITCHYARD_MAP.path) {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }

  return length;
}

export function pointAlongPath(progress, points = SWITCHYARD_MAP.path) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const totalLength = getPathLength(points);
  let remaining = totalLength * clampedProgress;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (remaining <= segmentLength) {
      const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }

    remaining -= segmentLength;
  }

  return { ...points.at(-1) };
}

function distanceToSegment(x, y, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(x - start.x, y - start.y);
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      ((x - start.x) * segmentX + (y - start.y) * segmentY) /
        segmentLengthSquared,
    ),
  );

  return Math.hypot(
    x - (start.x + projection * segmentX),
    y - (start.y + projection * segmentY),
  );
}

export function closestPointOnPath(x, y, points = SWITCHYARD_MAP.path) {
  const totalLength = getPathLength(points);
  let travelled = 0;
  let closest = {
    x: points[0]?.x ?? 0,
    y: points[0]?.y ?? 0,
    distance: Number.POSITIVE_INFINITY,
    progress: 0,
  };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLength = Math.hypot(segmentX, segmentY);
    const segmentLengthSquared = segmentLength * segmentLength;
    const ratio = segmentLengthSquared === 0 ? 0 : Math.min(1, Math.max(0,
      ((x - start.x) * segmentX + (y - start.y) * segmentY) / segmentLengthSquared,
    ));
    const point = { x: start.x + segmentX * ratio, y: start.y + segmentY * ratio };
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < closest.distance) {
      closest = {
        ...point,
        distance,
        progress: totalLength === 0 ? 0 : (travelled + segmentLength * ratio) / totalLength,
      };
    }
    travelled += segmentLength;
  }

  return closest;
}

export function distanceToPath(x, y, points = SWITCHYARD_MAP.path) {
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < points.length; index += 1) {
    shortestDistance = Math.min(
      shortestDistance,
      distanceToSegment(x, y, points[index - 1], points[index]),
    );
  }

  return shortestDistance;
}
