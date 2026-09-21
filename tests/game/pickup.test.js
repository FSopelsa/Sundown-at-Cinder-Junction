import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELS, THRESHOLD_MAP } from '../../src/game/content/map.js';
import {
  PICKUP_DEFINITIONS,
  SNABBA_SKOR_SPAWN_MAX_MS,
  SNABBA_SKOR_SPAWN_MIN_MS,
} from '../../src/game/content/pickups.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';

test('the zip bag pickup is serialized and grants a temporary movement boost', () => {
  const simulation = createSimulation(new GameState({ levelId: THRESHOLD_MAP.id }));
  assert.ok(simulation.state.snabbaSkorSpawnRemainingMs >= SNABBA_SKOR_SPAWN_MIN_MS);
  assert.ok(simulation.state.snabbaSkorSpawnRemainingMs <= SNABBA_SKOR_SPAWN_MAX_MS);
  simulation.systems.pickupSystem.update(SNABBA_SKOR_SPAWN_MAX_MS);
  const pickup = simulation.state.pickups[0];
  assert.equal(pickup.type, 'speed-boost');
  assert.deepEqual(GameState.fromJSON(JSON.stringify(simulation.state)).pickups, [pickup]);

  Object.assign(simulation.state.hero, { x: pickup.x, y: pickup.y });
  simulation.systems.heroSystem.collectNearbyPickups();
  assert.equal(simulation.state.pickups.length, 0);
  assert.equal(simulation.state.hero.speedBoostRemainingMs, PICKUP_DEFINITIONS.speedBoost.durationMs);
  assert.equal(simulation.state.hero.speedBoostMultiplier, PICKUP_DEFINITIONS.speedBoost.speedMultiplier);

  simulation.systems.heroSystem.update(PICKUP_DEFINITIONS.speedBoost.durationMs + 1);
  assert.equal(simulation.state.hero.speedBoostRemainingMs, 0);
  assert.equal(simulation.state.hero.speedBoostMultiplier, 1);
});

test('the speed pickup schedules one spawn on every level', () => {
  for (const map of LEVELS) {
    const simulation = createSimulation(new GameState({
      levelId: map.id,
      snabbaSkorSpawnRemainingMs: 0,
    }));
    simulation.systems.pickupSystem.update(0);
    assert.equal(simulation.state.pickups.length, 1, map.id);
    assert.deepEqual(
      { x: simulation.state.pickups[0].x, y: simulation.state.pickups[0].y },
      map.pickupSpawnPoint ?? map.heroSpawn,
    );
  }
});

test('the Scrap Exchange sells the speed pickup for 200 Scrap', () => {
  const simulation = createSimulation(new GameState({ levelId: THRESHOLD_MAP.id, scrap: 250 }));
  simulation.state.towers.push({ id: 'scrap-exchange-test', type: 'scrapExchange', hp: 100, maxHp: 100, construction: null, investedScrap: 100 });
  const result = simulation.dispatch('purchase-support', { towerId: 'scrap-exchange-test', item: 'snabbaSkor' });
  assert.equal(result.ok, true);
  assert.equal(result.cost, 200);
  assert.equal(simulation.state.scrap, 50);
  assert.equal(simulation.state.hero.speedBoostRemainingMs, PICKUP_DEFINITIONS.speedBoost.durationMs);
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
