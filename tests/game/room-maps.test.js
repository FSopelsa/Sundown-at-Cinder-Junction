import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, SMELTWORKS_MAP } from '../../src/game/content/map.js';
import { ROOM_PALETTES, getRoomPalette } from '../../src/game/content/rooms.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import {
  buildRoomDistanceField,
  isRoomMap,
  roomCellCenter,
  roomCellKey,
  roomCellsMatch,
  roomRoutePoints,
  validateRoomMap,
} from '../../src/game/simulation/roomNavigation.js';
import { getRoomPerimeterWallSegments } from '../../src/three/RoomScene.js';

const ROOM_MAPS = LEVELS.filter(isRoomMap);

test('every room level validates and names a known palette per room', () => {
  assert.deepEqual(ROOM_MAPS.map((map) => map.id), ['cinder-threshold', 'cinder-smeltworks']);

  for (const map of ROOM_MAPS) {
    assert.deepEqual(validateRoomMap(map), { ok: true, problems: [] });
    for (const room of map.rooms) {
      assert.ok(room.environment.palette in ROOM_PALETTES, `${room.id} uses an unknown palette`);
      assert.equal(getRoomPalette(room.environment.palette), ROOM_PALETTES[room.environment.palette]);
    }
  }
});

test('validateRoomMap rejects overlapping rooms, stray doors, and an unreachable exit', () => {
  const broken = {
    mode: 'rooms',
    rooms: [
      { id: 'intake', grid: { x: 0, y: 0, columns: 4, rows: 4, cellSize: 40 } },
      { id: 'annex', grid: { x: 80, y: 0, columns: 4, rows: 4, cellSize: 40 } },
    ],
    roomConnections: [
      { id: 'stray-door', from: { roomId: 'intake', col: 9, row: 0 }, to: { roomId: 'annex', col: 0, row: 0 } },
    ],
    entrance: { roomId: 'intake', col: 0, row: 0 },
    exit: { roomId: 'ghost-room', col: 0, row: 0 },
    heroSpawn: { x: 5000, y: 5000 },
    roomState: { unlockedRoomIds: ['intake', 'annex'], openDoorIds: ['stray-door'] },
  };

  const result = validateRoomMap(broken);
  const report = result.problems.join('\n');
  assert.equal(result.ok, false);
  assert.match(report, /Rooms intake and annex overlap/);
  assert.match(report, /Door stray-door points outside room intake/);
  assert.match(report, /The exit cell is outside every room grid/);
  assert.match(report, /The hero spawn is outside every room/);
  assert.match(report, /No open route leads from the entrance to the exit/);
});

test('Cinder Smeltworks routes enemies through all four rooms', () => {
  const distances = buildRoomDistanceField(SMELTWORKS_MAP, [], null, [], SMELTWORKS_MAP.roomState);
  assert.ok(roomRoutePoints(SMELTWORKS_MAP, distances, [], SMELTWORKS_MAP.roomState).length > 50);

  const simulation = createSimulation({ levelId: SMELTWORKS_MAP.id });
  const enemy = simulation.systems.enemySystem.spawn('dustMite');
  const visited = new Set([enemy.roomCell.roomId]);
  for (let step = 0; step < 400 && !roomCellsMatch(enemy.roomCell, SMELTWORKS_MAP.exit); step += 1) {
    simulation.systems.enemySystem.moveThroughRooms(enemy, 40);
    visited.add(enemy.roomCell.roomId);
  }

  assert.deepEqual([...visited], ['intake-bay', 'smelt-floor', 'slag-gallery', 'tapline-terrace']);
  assert.equal(enemy.progress, 1);
});

test('the sealed Slag Shutter stays shut yet shortens the route once opened', () => {
  const entranceKey = roomCellKey(SMELTWORKS_MAP.entrance);
  assert.equal(SMELTWORKS_MAP.roomState.openDoorIds.includes('slag-shutter'), false);

  const sealed = buildRoomDistanceField(SMELTWORKS_MAP, [], null, [], SMELTWORKS_MAP.roomState);
  const unlocked = buildRoomDistanceField(SMELTWORKS_MAP, [], null, [], {
    unlockedRoomIds: SMELTWORKS_MAP.roomState.unlockedRoomIds,
    openDoorIds: [...SMELTWORKS_MAP.roomState.openDoorIds, 'slag-shutter'],
  });

  assert.ok(unlocked.get(entranceKey) < sealed.get(entranceKey));
});

test('manual hero commands use the current open-door state', () => {
  const simulation = createSimulation({ levelId: SMELTWORKS_MAP.id });
  simulation.state.roomState.openDoorIds = [
    ...simulation.state.roomState.openDoorIds,
    'slag-shutter',
  ];
  const destination = roomCellCenter(SMELTWORKS_MAP, {
    roomId: 'tapline-terrace', col: 7, row: 1,
  });
  assert.equal(simulation.dispatch(ACTIONS.moveHero, destination).ok, true);
  const rooms = new Set(simulation.state.hero.route.map((cell) => cell.roomId));
  assert.equal(rooms.has('tapline-terrace'), true);
  assert.equal(rooms.has('smelt-floor'), false);
});

test('procedural room shells leave only simulation-open door cells unobstructed', () => {
  const intake = SMELTWORKS_MAP.rooms.find((room) => room.id === 'intake-bay');
  const sealed = getRoomPerimeterWallSegments(SMELTWORKS_MAP, intake, SMELTWORKS_MAP.roomState);
  assert.deepEqual(sealed.east, [[0, 240], [280, 480]]);
  assert.deepEqual(sealed.south, [[0, 560]]);

  const openState = {
    ...SMELTWORKS_MAP.roomState,
    openDoorIds: [...SMELTWORKS_MAP.roomState.openDoorIds, 'slag-shutter'],
  };
  const unlocked = getRoomPerimeterWallSegments(SMELTWORKS_MAP, intake, openState);
  assert.deepEqual(unlocked.south, [[0, 280], [320, 560]]);
});

test('a fresh Smeltworks run builds, walks the room graph, and round-trips', () => {
  const simulation = createSimulation({ levelId: SMELTWORKS_MAP.id });
  assert.equal(simulation.state.scrap, SMELTWORKS_MAP.startingScrap);
  assert.deepEqual(
    simulation.state.roomState.openDoorIds,
    ['intake-sluice', 'smelt-stair', 'gallery-causeway'],
  );

  const buildCell = roomCellCenter(SMELTWORKS_MAP, { roomId: 'slag-gallery', col: 4, row: 4 });
  assert.equal(simulation.dispatch(ACTIONS.placeTower, { towerType: 'peacemaker', ...buildCell }).ok, true);

  const destination = roomCellCenter(SMELTWORKS_MAP, { roomId: 'tapline-terrace', col: 3, row: 5 });
  assert.equal(simulation.dispatch(ACTIONS.moveHero, destination).ok, true);
  assert.deepEqual(
    [...new Set(simulation.state.hero.route.map((cell) => cell.roomId))],
    ['intake-bay', 'smelt-floor', 'slag-gallery', 'tapline-terrace'],
  );

  const snapshot = simulation.state.toJSON();
  assert.deepEqual(GameState.fromJSON(JSON.stringify(snapshot)).toJSON(), snapshot);
});
