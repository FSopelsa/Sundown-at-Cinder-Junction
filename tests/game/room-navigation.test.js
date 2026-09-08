import assert from 'node:assert/strict';
import test from 'node:test';
import { THRESHOLD_MAP } from '../../src/game/content/map.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import {
  buildRoomDistanceField,
  roomCellCenter,
  roomCellKey,
  roomCellsMatch,
  roomRoutePoints,
} from '../../src/game/simulation/roomNavigation.js';

test('Cinder Threshold keeps room IDs, an open door edge, and a global enemy route', () => {
  assert.deepEqual(THRESHOLD_MAP.rooms.map((room) => room.id), ['arrival-yard', 'relay-hall']);
  assert.equal(THRESHOLD_MAP.roomConnections[0].id, 'arrival-gate');

  const distances = buildRoomDistanceField(THRESHOLD_MAP, []);
  assert.ok(distances.has(roomCellKey(THRESHOLD_MAP.entrance)));
  const route = roomRoutePoints(THRESHOLD_MAP, distances);
  assert.ok(route.length > 20);

  const simulation = createSimulation({ levelId: THRESHOLD_MAP.id, scrap: 2000 });
  const enemy = simulation.systems.enemySystem.spawn('dustMite');
  simulation.systems.enemySystem.moveThroughRooms(enemy, 10000);
  assert.equal(enemy.progress, 1);
  assert.deepEqual(enemy.roomCell, THRESHOLD_MAP.exit);
});

test('the hero crosses the Cinder Threshold door and room-aware state round-trips', () => {
  const simulation = createSimulation({ levelId: THRESHOLD_MAP.id, scrap: 2000 });
  const destinationCell = { roomId: 'relay-hall', col: 5, row: 5 };
  const destination = roomCellCenter(THRESHOLD_MAP, destinationCell);
  const command = simulation.dispatch(ACTIONS.moveHero, destination);
  assert.equal(command.ok, true);
  assert.ok(simulation.state.hero.route.some((cell) => cell.roomId === 'arrival-yard'));
  assert.ok(simulation.state.hero.route.some((cell) => cell.roomId === 'relay-hall'));

  for (let elapsed = 0; elapsed < 12000 && simulation.state.hero.destination; elapsed += 50) {
    simulation.systems.heroSystem.update(50);
  }
  assert.ok(roomCellsMatch(simulation.state.hero.navigationCell, destinationCell));
  assert.deepEqual({ x: simulation.state.hero.x, y: simulation.state.hero.y }, destination);

  const snapshot = simulation.state.toJSON();
  const restored = GameState.fromJSON(JSON.stringify(snapshot));
  assert.deepEqual(restored.toJSON(), snapshot);
});

test('room doors remain clear while tower placement is valid in both connected rooms', () => {
  const simulation = createSimulation({ levelId: THRESHOLD_MAP.id, scrap: 2000 });
  const door = roomCellCenter(THRESHOLD_MAP, THRESHOLD_MAP.roomConnections[0].from);
  assert.match(
    simulation.dispatch(ACTIONS.placeTower, { towerType: 'wall', ...door }).reason,
    /doors clear/i,
  );
  const buildCell = roomCellCenter(THRESHOLD_MAP, { roomId: 'relay-hall', col: 4, row: 5 });
  assert.equal(simulation.dispatch(ACTIONS.placeTower, { towerType: 'teslaCoil', ...buildCell }).ok, true);
});
