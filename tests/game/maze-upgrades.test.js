import assert from 'node:assert/strict';
import test from 'node:test';
import { MAZE_MAP } from '../../src/game/content/map.js';
import { TOWER_DEFINITIONS, UPGRADE_MULTIPLIER } from '../../src/game/content/towers.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { buildDistanceField, cellCenter, cellKey, routePoints, worldToCell } from '../../src/game/simulation/maze.js';

const maze = () => createSimulation({ levelId: MAZE_MAP.id, scrap: 10000 });
const place = (sim, col, row) => sim.dispatch(ACTIONS.placeTower, cellCenter(MAZE_MAP, { col, row }));

test('maze placement snaps to cells, detours by the shortest distance, and preserves the final gap', () => {
  const sim = maze();
  assert.equal(buildDistanceField(MAZE_MAP, []).get(cellKey(MAZE_MAP.entrance)), 23);
  for (let row = 0; row < 9; row += 1) assert.equal(place(sim, 5, row).ok, true);
  const field = buildDistanceField(MAZE_MAP, sim.state.towers);
  assert.equal(field.get(cellKey(MAZE_MAP.entrance)), 33);
  const route = routePoints(MAZE_MAP, field);
  assert.equal(route.length, 34);
  assert.ok(route.some((point) => worldToCell(MAZE_MAP, point.x, point.y).row === 9));
  const before = sim.state.toJSON();
  assert.match(place(sim, 5, 9).reason, /open route/);
  assert.deepEqual(sim.state.toJSON(), before);
  assert.equal(place(sim, 0, 4).ok, false);
  assert.equal(place(sim, 23, 4).ok, false);
  assert.equal(place(sim, -1, 2).ok, false);
  assert.equal(place(sim, 5, 2).ok, false);
  assert.equal(sim.dispatch(ACTIONS.placeTower, { x: NaN, y: 200 }).ok, false);
  const snapped = sim.dispatch(ACTIONS.placeTower, { x: 405, y: 165 });
  assert.equal(snapped.ok, true);
  assert.deepEqual({ x: snapped.tower.x, y: snapped.tower.y }, cellCenter(MAZE_MAP, { col: 6, row: 1 }));
});

test('building during movement reserves the current step and reroutes without teleporting', () => {
  const sim = maze();
  const system = sim.systems.enemySystem;
  const enemy = system.spawn('dustMite');
  system.update(100);
  const position = { x: enemy.x, y: enemy.y };
  assert.equal(place(sim, 1, 4).ok, false);
  assert.equal(place(sim, 2, 4).ok, true);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, position);
  let travelled = 0;
  let previous = position;
  while (sim.state.enemies.length) {
    system.update(10);
    const step = Math.hypot(enemy.x - previous.x, enemy.y - previous.y);
    assert.ok(step <= enemy.speed * 0.01 + 1e-8);
    assert.notDeepEqual(worldToCell(MAZE_MAP, enemy.x, enemy.y), { col: 2, row: 4 });
    travelled += Math.abs(enemy.x - previous.x) + Math.abs(enemy.y - previous.y);
    previous = { x: enemy.x, y: enemy.y };
    assert.ok(travelled < 2000, 'enemy must reach the exit');
  }
  assert.ok(Math.abs(travelled + enemy.speed * 0.1 - 1000) < 1e-6);
  assert.equal(sim.state.stationIntegrity, 98);
  assert.equal(sim.state.carryoverEnemies.length, 1);
});

test('a disconnected pocket containing a live enemy cannot be sealed even when entrance route is open', () => {
  const sim = maze();
  const enemy = sim.systems.enemySystem.spawn('dustMite');
  enemy.mazeCell = { col: 10, row: 1 };
  Object.assign(enemy, cellCenter(MAZE_MAP, enemy.mazeCell));
  for (const [col, row] of [[9, 1], [11, 1], [10, 0]]) assert.equal(place(sim, col, row).ok, true);
  assert.match(place(sim, 10, 2).reason, /every enemy/);
});

test('maze enemies take the shorter of unequal detours and cannot cut blocked corners', () => {
  const sim = maze();
  for (let row = 3; row <= 8; row += 1) assert.equal(place(sim, 5, row).ok, true);
  const route = routePoints(MAZE_MAP, buildDistanceField(MAZE_MAP, sim.state.towers));
  assert.equal(route.length - 1, 27);
  for (let index = 1; index < route.length; index += 1) {
    assert.equal(Math.hypot(route[index].x - route[index - 1].x, route[index].y - route[index - 1].y), 40);
  }
});

for (const levelId of ['cinder-switchyard', 'cinder-maze']) {
  for (const type of Object.keys(TOWER_DEFINITIONS).filter((towerType) => TOWER_DEFINITIONS[towerType].damage > 0)) {
    test(`${type} supports mixed upgrades and a level cap in ${levelId}`, () => {
      const sim = createSimulation({ levelId, scrap: 1000 });
      const position = levelId === MAZE_MAP.id ? cellCenter(MAZE_MAP, { col: 2, row: 3 }) : { x: 100, y: 350 };
      const { tower } = sim.dispatch(ACTIONS.placeTower, { towerType: type, ...position });
      const baseDamage = tower.damage;
      const baseInterval = tower.fireIntervalMs;
      const baseEffect = tower.effect ? { ...tower.effect } : null;
      tower.cooldownMs = baseInterval / 2;
      const upgrade = (choice) => sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: choice });
      assert.equal(upgrade('damage').ok, true);
      assert.equal(tower.damage, baseDamage * 1.5);
      if (baseEffect?.type === 'burn') assert.equal(tower.effect.magnitude, baseEffect.magnitude * 1.5);
      if (baseEffect?.type === 'slow') assert.deepEqual(tower.effect, baseEffect);
      assert.equal(upgrade('speed').ok, true);
      assert.equal(tower.fireIntervalMs, baseInterval / 1.5);
      assert.equal(tower.cooldownMs, baseInterval / 3);
      assert.equal(tower.level, 3);
      assert.deepEqual(tower.upgrades, ['damage', 'speed']);
      assert.equal(sim.state.scrap, 1000 - TOWER_DEFINITIONS[type].cost -
        Math.ceil(TOWER_DEFINITIONS[type].cost * 0.75) - Math.ceil(TOWER_DEFINITIONS[type].cost * 1.5));
      const snapshot = sim.state.toJSON();
      assert.equal(upgrade('damage').ok, false);
      assert.deepEqual(sim.state.toJSON(), snapshot);
    });
  }
}

test('unaffordable, missing, invalid and post-defeat upgrades do not mutate state', () => {
  const sim = createSimulation();
  const { tower } = sim.dispatch(ACTIONS.placeTower, { x: 100, y: 350 });
  sim.state.scrap = 0;
  for (const payload of [
    { towerId: tower.id, upgrade: 'damage' },
    { towerId: 'missing', upgrade: 'speed' },
    { towerId: tower.id, upgrade: 'range' },
  ]) {
    const before = sim.state.toJSON();
    assert.equal(sim.dispatch(ACTIONS.upgradeTower, payload).ok, false);
    assert.deepEqual(sim.state.toJSON(), before);
  }
  sim.state.scrap = 100;
  sim.state.stationIntegrity = 0;
  assert.equal(sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'damage' }).ok, false);
  assert.equal(tower.level, 1);
  assert.equal(sim.state.scrap, 100);
});

test('maze and upgrade saves resume identically midway through a rerouted step and own nested data', () => {
  const sim = maze();
  const { tower } = place(sim, 2, 4);
  sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'damage' });
  sim.systems.enemySystem.spawn('dustMite');
  sim.systems.enemySystem.update(125);
  const saved = sim.state.toJSON();
  const restored = createSimulation(GameState.fromJSON(JSON.stringify(saved)));
  assert.equal(restored.map.id, MAZE_MAP.id);
  sim.systems.enemySystem.update(1200);
  restored.systems.enemySystem.update(1200);
  assert.deepEqual(restored.state.toJSON(), sim.state.toJSON());
  saved.towers[0].upgrades.push('speed');
  saved.enemies[0].mazeCell.col = 99;
  assert.deepEqual(sim.state.towers[0].upgrades, ['damage']);
  assert.notEqual(sim.state.enemies[0].mazeCell.col, 99);
  assert.equal(createSimulation({ schemaVersion: 1 }).map.id, 'cinder-switchyard');
});

test('maze slow effects, pause and double speed preserve movement rules', () => {
  const sim = maze();
  const enemy = sim.systems.enemySystem.spawn('dustMite');
  const startX = enemy.x;
  sim.dispatch(ACTIONS.togglePause);
  sim.update(100);
  assert.equal(enemy.x, startX);
  sim.dispatch(ACTIONS.togglePause);
  sim.dispatch(ACTIONS.setSpeed, { speed: 2 });
  sim.systems.statusEffectSystem.apply(enemy.id, { type: 'slow', magnitude: 0.5, durationMs: 1000 });
  sim.update(100);
  assert.ok(Math.abs(enemy.x - startX - 9.2) < 1e-6);
});

test('maze towers prioritize the enemy closest to the exit along the open route', () => {
  const sim = maze();
  place(sim, 18, 3);
  const farther = sim.systems.enemySystem.spawn('tinbackHauler');
  const nearer = sim.systems.enemySystem.spawn('tinbackHauler');
  farther.mazeCell = { col: 17, row: 4 };
  nearer.mazeCell = { col: 20, row: 4 };
  for (const enemy of [farther, nearer]) Object.assign(enemy, cellCenter(MAZE_MAP, enemy.mazeCell));
  sim.systems.enemySystem.update(0);
  sim.systems.towerSystem.update(0);
  assert.equal(farther.hp, farther.maxHp);
  assert.equal(nearer.hp, nearer.maxHp - TOWER_DEFINITIONS.peacemaker.damage);
});

for (const choice of ['damage', 'speed']) {
  test(`choosing ${choice} twice compounds and changes actual combat`, () => {
    const sim = maze();
    const { tower } = place(sim, 3, 3);
    for (let level = 0; level < 2; level += 1) {
      assert.equal(sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: choice }).ok, true);
    }
    const baseDamage = TOWER_DEFINITIONS.peacemaker.damage;
    const baseShotsPerSecond = TOWER_DEFINITIONS.peacemaker.shotsPerSecond;
    assert.equal(
      tower.damage,
      choice === 'damage' ? baseDamage * UPGRADE_MULTIPLIER ** 2 : baseDamage,
    );
    assert.ok(
      Math.abs(
        1000 / tower.fireIntervalMs - (
          choice === 'speed'
            ? baseShotsPerSecond * UPGRADE_MULTIPLIER ** 2
            : baseShotsPerSecond
        ),
      ) < 1e-9,
    );
    const enemy = sim.systems.enemySystem.spawn('tinbackHauler');
    enemy.mazeCell = { col: 3, row: 4 };
    Object.assign(enemy, cellCenter(MAZE_MAP, enemy.mazeCell));
    sim.systems.towerSystem.update(0);
    sim.systems.towerSystem.update(300);
    assert.equal(
      enemy.maxHp - enemy.hp,
      choice === 'damage'
        ? baseDamage * UPGRADE_MULTIPLIER ** 2
        : baseDamage * 2,
    );
  });
}
