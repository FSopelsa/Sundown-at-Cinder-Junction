import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIONS } from '../../src/game/input/actions.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';

test('systems mutate GameState instead of keeping parallel entity arrays', () => {
  const simulation = createSimulation();
  const placement = simulation.dispatch(ACTIONS.placeTower, {
    towerType: 'peacemaker',
    x: 100,
    y: 350,
  });

  assert.equal(placement.ok, true);
  assert.equal(simulation.state.towers.length, 1);
  assert.equal(simulation.state.scrap, 80);
  assert.equal('towers' in simulation.systems.towerSystem, false);
  assert.equal('enemies' in simulation.systems.enemySystem, false);
});

test('tower placement validates rails, spacing, and economy', () => {
  const simulation = createSimulation();
  const onRail = simulation.dispatch(ACTIONS.placeTower, {
    x: 100,
    y: 118,
  });

  assert.equal(onRail.ok, false);
  assert.match(onRail.reason, /rail route/i);
  assert.equal(simulation.state.scrap, 120);
});

test('starting a raid stores its queue in GameState and spawns into GameState', () => {
  const simulation = createSimulation();
  const started = simulation.dispatch(ACTIONS.startWave);

  assert.equal(started.ok, true);
  assert.ok(simulation.state.wave.spawnQueue.length > 0);

  simulation.update(20);

  assert.equal(simulation.state.enemies.length, 1);
  assert.equal(simulation.state.wave.index, 1);
});

test('combat pays a reward once and rejects invalid damage', () => {
  const simulation = createSimulation();
  const enemy = simulation.systems.enemySystem.spawn('dustMite');
  const scrapBefore = simulation.state.scrap;

  const result = simulation.systems.combatSystem.applyDamage(enemy.id, enemy.hp);

  assert.equal(result.killed, true);
  assert.equal(simulation.state.enemies.length, 0);
  assert.equal(simulation.state.scrap, scrapBefore + enemy.reward);
  assert.equal(
    simulation.systems.combatSystem.applyDamage(enemy.id, 1).applied,
    0,
  );
  assert.throws(
    () => simulation.systems.combatSystem.applyDamage(enemy.id, -1),
    /positive finite number/,
  );
});

test('speed and pause are explicit simulation actions', () => {
  const simulation = createSimulation();

  assert.equal(
    simulation.dispatch(ACTIONS.setSpeed, { speed: 2 }).speed,
    2,
  );
  assert.equal(simulation.dispatch(ACTIONS.togglePause).paused, true);
  assert.equal(
    simulation.dispatch(ACTIONS.setSpeed, { speed: 3 }).ok,
    false,
  );
});
