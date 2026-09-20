import assert from 'node:assert/strict';
import test from 'node:test';
import { THRESHOLD_MAP } from '../../src/game/content/map.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';

test('the zip bag pickup is serialized and grants a temporary movement boost', () => {
  const simulation = createSimulation(new GameState({ levelId: THRESHOLD_MAP.id }));
  const pickup = simulation.state.pickups[0];
  assert.equal(pickup.type, 'speed-boost');
  assert.deepEqual(GameState.fromJSON(JSON.stringify(simulation.state)).pickups, [pickup]);

  Object.assign(simulation.state.hero, { x: pickup.x, y: pickup.y });
  simulation.systems.heroSystem.collectNearbyPickups();
  assert.equal(simulation.state.pickups.length, 0);
  assert.equal(simulation.state.hero.speedBoostRemainingMs, 12000);
  assert.equal(simulation.state.hero.speedBoostMultiplier, 1.65);

  simulation.systems.heroSystem.update(12001);
  assert.equal(simulation.state.hero.speedBoostRemainingMs, 0);
  assert.equal(simulation.state.hero.speedBoostMultiplier, 1);
});

test('an active pickup multiplier increases movement distance without changing base speed', () => {
  const normal = createSimulation({ levelId: THRESHOLD_MAP.id });
  const boosted = createSimulation({ levelId: THRESHOLD_MAP.id });
  const destination = { x: 620, y: 500 };
  normal.systems.heroSystem.commandMove(destination.x, destination.y);
  boosted.systems.heroSystem.commandMove(destination.x, destination.y);
  boosted.state.hero.speedBoostRemainingMs = 5000;
  boosted.state.hero.speedBoostMultiplier = 1.65;

  const normalStart = { x: normal.state.hero.x, y: normal.state.hero.y };
  const boostedStart = { x: boosted.state.hero.x, y: boosted.state.hero.y };
  normal.systems.heroSystem.updateMovement(500);
  boosted.systems.heroSystem.updateMovement(500);
  const normalDistance = Math.hypot(normal.state.hero.x - normalStart.x, normal.state.hero.y - normalStart.y);
  const boostedDistance = Math.hypot(boosted.state.hero.x - boostedStart.x, boosted.state.hero.y - boostedStart.y);
  assert.ok(boostedDistance > normalDistance);
  assert.equal(boosted.state.hero.moveSpeed, normal.state.hero.moveSpeed);
});
