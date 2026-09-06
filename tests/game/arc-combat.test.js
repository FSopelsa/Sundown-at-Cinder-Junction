import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { ACTIONS } from '../../src/game/input/actions.js';

function setup() {
  const sim = createSimulation({ scrap: 2000 });
  const placed = sim.dispatch(ACTIONS.placeTower, { towerType: 'teslaCoil', x: 100, y: 350 });
  assert.equal(placed.ok, true);
  const enemies = [150, 240, 330, 420, 510].map((x, i) => {
    const enemy = sim.systems.enemySystem.spawn('sparkWagon');
    Object.assign(enemy, { x, y: 350, progress: 1 - i * .1 });
    return enemy;
  });
  return { sim, tower: placed.tower, enemies };
}

test('Arc consumes shields at 2x and only unspent hit damage reaches hull', () => {
  const sim = createSimulation();
  const enemy = sim.systems.enemySystem.spawn('sparkWagon');
  const hp = enemy.hp;
  sim.systems.combatSystem.applyDamage(enemy.id, 10, 'neutral');
  assert.equal(enemy.shield, 38);
  assert.equal(enemy.hp, hp);
  sim.systems.combatSystem.applyDamage(enemy.id, 24, 'arc');
  assert.equal(enemy.shield, 0);
  assert.equal(enemy.hp, hp - 5);
  assert.equal(sim.systems.combatSystem.drainEvents().filter(e => e.type === 'shield-break').length, 1);
  sim.systems.combatSystem.applyDamage(enemy.id, 10, 'arc');
  assert.equal(enemy.hp, hp - 15);
});

test('Tesla chains to four distinct nearest targets with falloff, including beyond initial range', () => {
  const { sim, enemies } = setup();
  sim.systems.towerSystem.update(0);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(enemies[i].shield - (48 - 36 * .72 ** i)) < 1e-8);
  }
  assert.equal(enemies[4].shield, 48);
  const chain = sim.systems.combatSystem.drainEvents().find(e => e.type === 'arc-chain');
  assert.deepEqual(chain.links.map(link => link.targetId), enemies.slice(0, 4).map(e => e.id));
  assert.equal(new Set(chain.links.map(link => link.targetId)).size, 4);
});

test('a chain stops at gaps and continues from the last position after lethal hits', () => {
  const { sim, enemies } = setup();
  enemies[0].shield = 0;
  enemies[0].hp = 1;
  enemies[2].x = 900;
  const scrap = sim.state.scrap;
  sim.systems.towerSystem.update(0);
  assert.equal(sim.state.enemies.includes(enemies[0]), false);
  assert.equal(sim.state.scrap, scrap + enemies[0].reward);
  assert.ok(enemies[1].shield < 48);
  assert.equal(enemies[3].shield, 48);
});

test('Tesla upgrades affect chained combat and nested chain/shield data round-trips independently', () => {
  const { sim, tower, enemies } = setup();
  sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'damage' });
  sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'speed' });
  sim.systems.towerSystem.update(0);
  assert.equal(tower.damage, 27);
  assert.equal(enemies[0].shield, 0);
  assert.equal(enemies[0].hp, enemies[0].maxHp - 3);
  assert.ok(tower.fireIntervalMs < 1000);
  const restored = GameState.fromJSON(JSON.stringify(sim.state.toJSON()));
  assert.deepEqual(restored.toJSON(), sim.state.toJSON());
  restored.towers[0].chain.maxTargets = 99;
  restored.enemies[0].shield = 99;
  assert.equal(tower.chain.maxTargets, 4);
  assert.equal(enemies[0].shield, 0);
});

test('shield capacity scales with raids while legacy enemies without shields remain damageable', () => {
  const sim = createSimulation();
  const early = sim.systems.enemySystem.spawn('sparkWagon');
  sim.state.wave.index = 4;
  const late = sim.systems.enemySystem.spawn('sparkWagon');
  assert.ok(late.maxShield > early.maxShield);
  delete early.shield;
  delete early.maxShield;
  sim.systems.combatSystem.applyDamage(early.id, 12, 'arc');
  assert.equal(early.hp, early.maxHp - 12);
});
