import assert from 'node:assert/strict';
import test from 'node:test';
import { SWITCHYARD_MAP } from '../../src/game/content/map.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { compareTowerTargets } from '../../src/game/simulation/systems/TowerSystem.js';

const enemies = [
  { id: 'front', hp: 30, maxHp: 40, progress: 0.8 },
  { id: 'tank', hp: 180, maxHp: 220, progress: 0.5 },
  { id: 'rear', hp: 50, maxHp: 60, progress: 0.2 },
];

test('each tower stores first, toughest, or last targeting independently', () => {
  const simulation = createSimulation({ scrap: 1000 });
  const first = simulation.dispatch(ACTIONS.placeTower, { towerType: 'peacemaker', x: 100, y: 350 }).tower;
  const second = simulation.dispatch(ACTIONS.placeTower, { towerType: 'sunspitter', x: 180, y: 350 }).tower;
  assert.equal(simulation.dispatch(ACTIONS.setTowerTargeting, {
    towerId: first.id, targeting: 'toughest',
  }).ok, true);
  assert.equal(first.targeting, 'toughest');
  assert.equal(second.targeting, 'first');
  assert.equal(GameState.fromJSON(JSON.stringify(simulation.state)).towers[0].targeting, 'toughest');
});

test('targeting comparators prioritize route position or hull as configured', () => {
  const sorted = (targeting) => [...enemies]
    .sort((a, b) => compareTowerTargets({ targeting }, SWITCHYARD_MAP, a, b))[0].id;
  assert.equal(sorted('first'), 'front');
  assert.equal(sorted('toughest'), 'tank');
  assert.equal(sorted('last'), 'rear');
});
