import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_DEFINITIONS } from '../../src/game/content/enemies.js';
import { getRaidScaling } from '../../src/game/content/waves.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { WAVE_START_DELAY_MS } from '../../src/game/simulation/systems/WaveSystem.js';

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

test('elemental towers apply their distinct status effects', () => {
  const solarSimulation = createSimulation();
  const solarEnemy = solarSimulation.systems.enemySystem.spawn('dustMite');
  solarEnemy.x = 110;
  solarEnemy.y = 350;

  assert.equal(
    solarSimulation.dispatch(ACTIONS.placeTower, {
      towerType: 'sunspitter',
      x: 100,
      y: 350,
    }).ok,
    true,
  );
  solarSimulation.update(20);
  assert.ok(solarEnemy.effects.some((effect) => effect.type === 'burn'));

  const cryoSimulation = createSimulation();
  const cryoEnemy = cryoSimulation.systems.enemySystem.spawn('tinbackHauler');
  cryoEnemy.x = 110;
  cryoEnemy.y = 350;

  assert.equal(
    cryoSimulation.dispatch(ACTIONS.placeTower, {
      towerType: 'coldIronLongshot',
      x: 100,
      y: 350,
    }).ok,
    true,
  );
  cryoSimulation.update(20);
  assert.ok(cryoEnemy.effects.some((effect) => effect.type === 'slow'));
});

test('tower fire events include the Sunspitter and target positions for visual effects', () => {
  const simulation = createSimulation();
  const enemy = simulation.systems.enemySystem.spawn('dustMite');
  enemy.x = 110;
  enemy.y = 350;

  const placement = simulation.dispatch(ACTIONS.placeTower, {
    towerType: 'sunspitter',
    x: 100,
    y: 350,
  });
  simulation.systems.towerSystem.update(0);

  const fire = simulation.systems.combatSystem
    .drainEvents()
    .find((event) => event.type === 'tower-fire');

  assert.deepEqual(fire, {
    type: 'tower-fire',
    towerId: placement.tower.id,
    towerType: 'sunspitter',
    x: 100,
    y: 350,
    targetX: 110,
    targetY: 350,
  });
});

test('Rift Leech regeneration is suppressed by burn', () => {
  const simulation = createSimulation();
  const leech = simulation.systems.enemySystem.spawn('riftLeech');
  leech.hp = 20;

  simulation.systems.enemySystem.update(1000);
  assert.equal(leech.hp, 35);

  simulation.systems.statusEffectSystem.apply(leech.id, {
    type: 'burn',
    magnitude: 8,
    durationMs: 1000,
  });
  const hpWhileBurning = leech.hp;
  simulation.systems.enemySystem.update(1000);

  assert.equal(leech.hp, hpWhileBurning);
});

test('starting a raid stores its queue in GameState and spawns into GameState', () => {
  const simulation = createSimulation();
  const started = simulation.dispatch(ACTIONS.startWave);

  assert.equal(started.ok, true);
  assert.ok(simulation.state.wave.spawnQueue.length > 0);

  for (let elapsedMs = 0; elapsedMs < WAVE_START_DELAY_MS + 20; elapsedMs += 20) {
    simulation.update(20);
  }

  assert.equal(simulation.state.enemies.length, 1);
  assert.equal(simulation.state.wave.index, 1);
});

test('escaped enemies return first in the next raid', () => {
  const simulation = createSimulation();
  simulation.state.wave.index = 1;
  const escapedEnemy = simulation.systems.enemySystem.spawn('dustMite');
  escapedEnemy.progress = 0.99;

  simulation.systems.enemySystem.update(1000);

  assert.equal(simulation.state.enemies.length, 0);
  assert.deepEqual(simulation.state.carryoverEnemies, [
    { enemyType: 'dustMite', sourceWaveIndex: 1 },
  ]);

  const nextRaid = simulation.dispatch(ACTIONS.startWave);

  assert.equal(nextRaid.ok, true);
  assert.equal(nextRaid.wave.index, 2);
  assert.equal(nextRaid.wave.carryoverCount, 1);
  assert.equal(simulation.state.carryoverEnemies.length, 0);
  assert.deepEqual(nextRaid.wave.spawnQueue[0], {
    enemyType: 'dustMite',
    atMs: WAVE_START_DELAY_MS,
    isCarryover: true,
  });
});

test('enemy hull scales up for every raid', () => {
  const simulation = createSimulation();
  simulation.state.wave.index = 1;
  const firstRaidEnemy = simulation.systems.enemySystem.spawn('dustMite');

  simulation.state.wave.index = 4;
  const fourthRaidEnemy = simulation.systems.enemySystem.spawn('dustMite');

  assert.equal(firstRaidEnemy.maxHp, ENEMY_DEFINITIONS.dustMite.maxHp);
  assert.equal(
    fourthRaidEnemy.maxHp,
    Math.round(
      ENEMY_DEFINITIONS.dustMite.maxHp * getRaidScaling(4).healthMultiplier,
    ),
  );
  assert.ok(fourthRaidEnemy.maxHp > firstRaidEnemy.maxHp);
  assert.ok(fourthRaidEnemy.speed > firstRaidEnemy.speed);
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
  assert.deepEqual(
    simulation.systems.combatSystem.drainEvents().map((event) => event.type),
    ['hit', 'death'],
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
