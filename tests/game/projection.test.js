import assert from 'node:assert/strict';
import test from 'node:test';
import { BattlefieldProjection } from '../../src/phaser/presentation/BattlefieldProjection.js';
import { OVERLOOK_MAP, MAZE_MAP } from '../../src/game/content/map.js';
import { cellCenter, worldToCell } from '../../src/game/simulation/maze.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { ACTIONS } from '../../src/game/input/actions.js';

test('every isometric cell maps back to the correct build cell, including edge cells', () => {
  const projection = new BattlefieldProjection(OVERLOOK_MAP);
  for (let row = 0; row < OVERLOOK_MAP.grid.rows; row++) {
    for (let col = 0; col < OVERLOOK_MAP.grid.columns; col++) {
      const world = cellCenter(OVERLOOK_MAP, { col, row });
      const screen = projection.project(world.x, world.y);
      const roundTrip = projection.unproject(screen.x, screen.y);
      assert.ok(Math.hypot(world.x - roundTrip.x, world.y - roundTrip.y) < 1e-8);
      assert.deepEqual(worldToCell(OVERLOOK_MAP, roundTrip.x, roundTrip.y), { col, row });
    }
  }
});

test('flat projection remains identity; isometric elevation changes visuals only', () => {
  const flat = new BattlefieldProjection(MAZE_MAP);
  assert.deepEqual(flat.project(370, 210), { x: 370, y: 210 });
  const iso = new BattlefieldProjection(OVERLOOK_MAP);
  const ground = iso.project(500, 300);
  assert.deepEqual(iso.project(500, 300, 40), { x: ground.x, y: ground.y - 40 });
  const forceFlat = new BattlefieldProjection(OVERLOOK_MAP, true);
  assert.deepEqual(forceFlat.project(500, 300), { x: 500, y: 300 });
});

test('projected clicks build a maze, reroute the hero, and survive save restoration', () => {
  const sim = createSimulation({ levelId: OVERLOOK_MAP.id });
  const projection = new BattlefieldProjection(sim.map);
  const occupied = cellCenter(sim.map, { col: 4, row: 8 });
  const pointer = projection.project(occupied.x, occupied.y);
  assert.equal(sim.dispatch(ACTIONS.placeTower, { towerType: 'teslaCoil',
    ...projection.unproject(pointer.x, pointer.y) }).ok, true);
  const destination = cellCenter(sim.map, { col: 7, row: 8 });
  assert.equal(sim.dispatch(ACTIONS.moveHero, destination).ok, true);
  for (let i = 0; i < 120; i++) {
    sim.systems.heroSystem.update(20);
    assert.notDeepEqual(worldToCell(sim.map, sim.state.hero.x, sim.state.hero.y), { col: 4, row: 8 });
  }
  assert.deepEqual({ x: sim.state.hero.x, y: sim.state.hero.y }, destination);
  const restored = GameState.fromJSON(JSON.stringify(sim.state.toJSON()));
  assert.deepEqual(restored.toJSON(), sim.state.toJSON());
  sim.dispatch(ACTIONS.startWave);
  assert.ok(sim.state.wave.spawnQueue.some(spawn => spawn.enemyType === 'sparkWagon'));
});
