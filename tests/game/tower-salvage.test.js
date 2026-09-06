import assert from 'node:assert/strict';
import test from 'node:test';
import { MAZE_MAP } from '../../src/game/content/map.js';
import { getTowerSellValue } from '../../src/game/content/towers.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { cellCenter, worldToCell } from '../../src/game/simulation/maze.js';

test('selling returns 80 percent of the full base-and-upgrade investment', () => {
  const simulation = createSimulation({ scrap: 1000 });
  const placed = simulation.dispatch(ACTIONS.placeTower, { x: 100, y: 350 });
  const tower = placed.tower;
  assert.equal(simulation.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'damage' }).ok, true);
  assert.equal(simulation.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'speed' }).ok, true);
  const expectedRefund = getTowerSellValue(tower);
  const before = simulation.state.scrap;

  const sold = simulation.dispatch(ACTIONS.sellTower, { towerId: tower.id });
  assert.equal(sold.ok, true);
  assert.equal(sold.refund, expectedRefund);
  assert.equal(simulation.state.scrap, before + expectedRefund);
  assert.equal(simulation.state.towers.length, 0);
});

test('placing on a wall replaces it and returns wall salvage without breaking maze routing', () => {
  const simulation = createSimulation({ levelId: MAZE_MAP.id, scrap: 1000 });
  const position = cellCenter(MAZE_MAP, { col: 6, row: 2 });
  const wall = simulation.dispatch(ACTIONS.placeTower, { towerType: 'wall', ...position }).tower;
  const before = simulation.state.scrap;
  const replacement = simulation.dispatch(ACTIONS.placeTower, {
    towerType: 'teslaCoil', ...position,
  });

  assert.equal(replacement.ok, true);
  assert.equal(replacement.replacedWall.id, wall.id);
  assert.equal(replacement.wallRefund, getTowerSellValue(wall));
  assert.equal(simulation.state.scrap, before + replacement.wallRefund - 115);
  assert.equal(simulation.state.towers.length, 1);
  assert.equal(simulation.state.towers[0].type, 'teslaCoil');
  assert.deepEqual(worldToCell(MAZE_MAP, simulation.state.towers[0].x, simulation.state.towers[0].y), { col: 6, row: 2 });
});
