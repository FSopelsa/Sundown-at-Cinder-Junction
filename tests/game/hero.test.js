import assert from 'node:assert/strict';
import test from 'node:test';
import { getHeroStats } from '../../src/game/content/heroes.js';
import { MAZE_MAP } from '../../src/game/content/map.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { cellCenter, worldToCell } from '../../src/game/simulation/maze.js';

function mazeSimulation() {
  return createSimulation({ levelId: MAZE_MAP.id, scrap: 10000 });
}

function placeMazeTower(simulation, col, row) {
  return simulation.dispatch(
    ACTIONS.placeTower,
    cellCenter(MAZE_MAP, { col, row }),
  );
}

function placeEnemyNearHero(simulation, type = 'dustMite') {
  const enemy = simulation.systems.enemySystem.spawn(type);
  enemy.x = simulation.state.hero.x + 20;
  enemy.y = simulation.state.hero.y;
  return enemy;
}

test('the Marshal walks around maze towers and never steps through their cells', () => {
  const simulation = mazeSimulation();
  const hero = simulation.state.hero;
  assert.equal(placeMazeTower(simulation, 4, 7).ok, true);

  const command = simulation.dispatch(ACTIONS.moveHero, cellCenter(MAZE_MAP, { col: 7, row: 7 }));
  assert.equal(command.ok, true);
  assert.notDeepEqual(command.destination, cellCenter(MAZE_MAP, { col: 4, row: 7 }));

  const visitedCells = [];
  for (let elapsed = 0; elapsed < 3000 && hero.destination; elapsed += 50) {
    simulation.systems.heroSystem.update(50);
    visitedCells.push(worldToCell(MAZE_MAP, hero.x, hero.y));
  }

  assert.deepEqual(worldToCell(MAZE_MAP, hero.x, hero.y), { col: 7, row: 7 });
  assert.equal(
    visitedCells.some((cell) => cell.col === 4 && cell.row === 7),
    false,
  );
});

test('the Marshal reroutes on Switchyard when a tower blocks the selected route', () => {
  const simulation = createSimulation({ scrap: 1000 });
  const hero = simulation.state.hero;
  const command = simulation.dispatch(ACTIONS.moveHero, { x: 300, y: 228 });
  assert.equal(command.ok, true);
  assert.equal(
    simulation.dispatch(ACTIONS.placeTower, { x: 156, y: 228 }).ok,
    true,
  );

  let closestTowerDistance = Number.POSITIVE_INFINITY;
  for (let elapsed = 0; elapsed < 4000 && hero.destination; elapsed += 50) {
    simulation.systems.heroSystem.update(50);
    closestTowerDistance = Math.min(
      closestTowerDistance,
      Math.hypot(hero.x - 156, hero.y - 228),
    );
  }

  assert.ok(Math.hypot(hero.x - 300, hero.y - 228) <= 24);
  assert.ok(closestTowerDistance >= 24);
});

test('hero commands reject unreachable positions and towers cannot overlap the Marshal or rally point', () => {
  const simulation = mazeSimulation();
  const hero = simulation.state.hero;
  const snapshot = simulation.state.toJSON();

  assert.equal(simulation.dispatch(ACTIONS.moveHero, { x: 40, y: 40 }).ok, false);
  assert.deepEqual(simulation.state.toJSON(), snapshot);
  assert.match(
    simulation.dispatch(ACTIONS.placeTower, { x: hero.x, y: hero.y }).reason,
    /Marshal|rally/i,
  );
  assert.match(
    simulation.dispatch(ACTIONS.placeTower, MAZE_MAP.heroSpawn).reason,
    /Marshal|rally/i,
  );
});

test('hero kills award more experience than nearby tower kills and a distant death grants none', () => {
  const simulation = mazeSimulation();
  const hero = simulation.state.hero;
  const killedByHero = placeEnemyNearHero(simulation);
  killedByHero.hp = hero.damage;

  simulation.systems.heroSystem.update(0);
  assert.equal(hero.experience, killedByHero.heroKillXp);

  const towerKill = placeEnemyNearHero(simulation);
  const beforeNearbyDeath = hero.experience;
  simulation.systems.combatSystem.applyDamage(towerKill.id, towerKill.hp, 'neutral', {
    kind: 'tower',
    id: 'tower-test',
  });
  assert.equal(hero.experience - beforeNearbyDeath, towerKill.nearbyXp);
  assert.ok(killedByHero.heroKillXp > towerKill.nearbyXp);

  const farTowerKill = simulation.systems.enemySystem.spawn('dustMite');
  farTowerKill.x = hero.x + hero.experienceRadius + 1;
  farTowerKill.y = hero.y;
  const beforeFarDeath = hero.experience;
  simulation.systems.combatSystem.applyDamage(farTowerKill.id, farTowerKill.hp, 'neutral', {
    kind: 'tower',
    id: 'tower-test',
  });
  assert.equal(hero.experience, beforeFarDeath);
});

test('hero level-ups scale hull and damage, heal from the level gain, and unlock configured skill slots', () => {
  const simulation = mazeSimulation();
  const hero = simulation.state.hero;
  hero.hp = 100;
  hero.experience = hero.experienceToNext - 1;

  const firstLevel = simulation.systems.heroSystem.awardExperience(1);
  assert.equal(firstLevel.levelsGained, 1);
  assert.equal(hero.level, 2);
  assert.deepEqual(
    { maxHp: hero.maxHp, damage: hero.damage },
    getHeroStats(2),
  );
  assert.ok(hero.hp > 100);
  assert.equal(hero.skillSlots.find((slot) => slot.id === 'time-dilation').unlocked, true);
  assert.equal(hero.skillSlots.find((slot) => slot.id === 'void-rend').unlocked, false);

  hero.experience = hero.experienceToNext - 1;
  simulation.systems.heroSystem.awardExperience(1);
  assert.equal(hero.level, 3);
  assert.equal(hero.skillSlots.find((slot) => slot.id === 'void-rend').unlocked, true);
});

test('Singularity earns kill XP for ranged casts beyond the nearby tower-kill XP radius', () => {
  const simulation = mazeSimulation();
  const hero = simulation.state.hero;
  const enemy = placeEnemyNearHero(simulation);
  enemy.x = hero.x + hero.attackRange - 5;
  enemy.hp = hero.damage;
  assert.ok(enemy.x - hero.x > hero.experienceRadius);
  simulation.systems.heroSystem.update(0);
  assert.equal(hero.experience, enemy.heroKillXp);
  assert.equal(simulation.state.enemies.length, 0);
});

test('enemies stop to attack the Marshal; death blocks commands until the next raid revival', () => {
  const simulation = mazeSimulation();
  const hero = simulation.state.hero;
  const enemy = placeEnemyNearHero(simulation);
  const hpBefore = hero.hp;

  simulation.systems.enemySystem.update(0);
  assert.equal(hero.hp, hpBefore - enemy.attackDamage);
  assert.equal(enemy.progress, 0);

  hero.hp = enemy.attackDamage;
  enemy.attackCooldownMs = 0;
  simulation.systems.enemySystem.update(0);
  assert.equal(hero.alive, false);
  assert.equal(hero.hp, 0);
  assert.equal(simulation.dispatch(ACTIONS.moveHero, cellCenter(MAZE_MAP, { col: 3, row: 6 })).ok, false);

  simulation.state.enemies = [];
  const nextWave = simulation.dispatch(ACTIONS.startWave);
  assert.equal(nextWave.ok, true);
  assert.equal(nextWave.heroRevived, true);
  assert.equal(hero.alive, true);
  assert.equal(hero.hp, hero.maxHp);
  assert.deepEqual({ x: hero.x, y: hero.y }, MAZE_MAP.heroSpawn);
});

test('hero navigation, experience, death state, and future skill data survive independent save restoration', () => {
  const simulation = mazeSimulation();
  simulation.dispatch(ACTIONS.moveHero, cellCenter(MAZE_MAP, { col: 8, row: 7 }));
  simulation.systems.heroSystem.update(75);
  simulation.state.hero.experience = 17;
  simulation.state.hero.skillSlots[0].selection = 'solar-burst';

  const snapshot = simulation.state.toJSON();
  const restored = GameState.fromJSON(JSON.stringify(snapshot));
  assert.deepEqual(restored.toJSON(), snapshot);

  snapshot.hero.route[0].col = 99;
  snapshot.hero.skillSlots[0].selection = 'changed';
  assert.notEqual(simulation.state.hero.route[0].col, 99);
  assert.equal(simulation.state.hero.skillSlots[0].selection, 'solar-burst');
});
