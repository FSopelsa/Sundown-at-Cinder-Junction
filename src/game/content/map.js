import { CAMPAIGN_MAP } from './campaign.js';
import { MODEL_KEYS } from '../assets/manifest.js';
import {
  defineRoom,
  defineRoomConnection,
  defineRoomMap,
  roomCell,
} from './rooms.js';

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

const THRESHOLD_ROOMS = Object.freeze([
  defineRoom({
    id: 'arrival-yard',
    name: 'Arrival Yard',
    x: 40,
    y: 80,
    columns: 15,
    rows: 20,
    environment: { palette: 'rust', model: MODEL_KEYS.environment.arrivalYard, hero: 'scrap-crane' },
  }),
  defineRoom({
    id: 'relay-hall',
    name: 'Relay Hall',
    x: 760,
    y: 80,
    columns: 15,
    rows: 20,
    environment: { palette: 'teal', model: MODEL_KEYS.environment.relayHall, hero: 'power-relay' },
  }),
]);

const THRESHOLD_CONNECTIONS = Object.freeze([
  defineRoomConnection({
    id: 'arrival-gate',
    name: 'Arrival Gate',
    from: roomCell('arrival-yard', 14, 10),
    to: roomCell('relay-hall', 0, 10),
  }),
]);

// Four rooms in a loop. Every room carries a palette instead of bespoke
// renderer code, and the sealed Slag Shutter is the shortcut a future
// progression unlock can open through `roomState.openDoorIds`.
const SMELTWORKS_ROOMS = Object.freeze([
  defineRoom({
    id: 'intake-bay',
    name: 'Intake Bay',
    x: 40,
    y: 80,
    columns: 14,
    rows: 12,
    environment: { palette: 'basalt', hero: 'ore-hopper' },
  }),
  defineRoom({
    id: 'smelt-floor',
    name: 'Smelt Floor',
    x: 680,
    y: 80,
    columns: 16,
    rows: 12,
    environment: { palette: 'ember', hero: 'crucible' },
  }),
  defineRoom({
    id: 'slag-gallery',
    name: 'Slag Gallery',
    x: 680,
    y: 640,
    columns: 16,
    rows: 10,
    environment: { palette: 'slag', hero: 'slag-rake' },
  }),
  defineRoom({
    id: 'tapline-terrace',
    name: 'Tapline Terrace',
    x: 40,
    y: 640,
    columns: 14,
    rows: 10,
    environment: { palette: 'teal', hero: 'tap-valve' },
  }),
]);

const SMELTWORKS_CONNECTIONS = Object.freeze([
  defineRoomConnection({
    id: 'intake-sluice',
    name: 'Intake Sluice',
    from: roomCell('intake-bay', 13, 6),
    to: roomCell('smelt-floor', 0, 6),
  }),
  defineRoomConnection({
    id: 'smelt-stair',
    name: 'Smelt Stair',
    from: roomCell('smelt-floor', 8, 11),
    to: roomCell('slag-gallery', 8, 0),
  }),
  defineRoomConnection({
    id: 'gallery-causeway',
    name: 'Gallery Causeway',
    from: roomCell('slag-gallery', 0, 5),
    to: roomCell('tapline-terrace', 13, 5),
  }),
  defineRoomConnection({
    id: 'slag-shutter',
    name: 'Slag Shutter',
    from: roomCell('intake-bay', 7, 11),
    to: roomCell('tapline-terrace', 7, 0),
    initiallyOpen: false,
  }),
]);

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
  name: 'Cinder Overlook',
  mode: 'maze',
  width: 1280,
  height: 720,
  startingScrap: 650,
  grid: Object.freeze({ x: 280, y: 100, columns: 18, rows: 12, cellSize: 40 }),
  entrance: Object.freeze({ col: 0, row: 5 }),
  exit: Object.freeze({ col: 17, row: 5 }),
  heroSpawn: Object.freeze({ x: 380, y: 440 }),
  waveSet: 'elemental-trial',
});

// First 3D migration level. Each room retains its own grid and a stable ID;
// connections are graph edges rather than a large flattened grid. The door is
// intentionally open for this milestone so traversal can be tested end-to-end.
export const THRESHOLD_MAP = defineRoomMap({
  id: 'cinder-threshold',
  name: 'Cinder Threshold · 3D Trial',
  startingScrap: 560,
  rooms: THRESHOLD_ROOMS,
  connections: THRESHOLD_CONNECTIONS,
  entrance: roomCell('arrival-yard', 0, 10),
  exit: roomCell('relay-hall', 14, 10),
  heroSpawn: { x: 140, y: 520 },
  pickupSpawns: [{
    id: 'threshold-slipstream-bag',
    type: 'speed-boost',
    x: 220,
    y: 620,
  }],
});

// Second 3D level: a four-room loop that proves the room graph scales past a
// single doorway without touching simulation or renderer code.
export const SMELTWORKS_MAP = defineRoomMap({
  id: 'cinder-smeltworks',
  name: 'Cinder Smeltworks · Four Rooms',
  startingScrap: 620,
  rooms: SMELTWORKS_ROOMS,
  connections: SMELTWORKS_CONNECTIONS,
  entrance: roomCell('intake-bay', 0, 6),
  exit: roomCell('tapline-terrace', 0, 5),
  heroSpawn: { x: 180, y: 460 },
});

export const LEVELS = Object.freeze([
  CAMPAIGN_MAP,
  THRESHOLD_MAP,
  SMELTWORKS_MAP,
  SWITCHYARD_MAP,
  MAZE_MAP,
  OVERLOOK_MAP,
]);

export const DEFAULT_3D_LEVEL_ID = CAMPAIGN_MAP.id;

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
