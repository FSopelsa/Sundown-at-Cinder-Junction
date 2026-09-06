import assert from 'node:assert/strict';
import test from 'node:test';
import { MAZE_MAP } from '../../src/game/content/map.js';
import { createHeroSkillSlots, getHeroStats } from '../../src/game/content/heroes.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { buildDistanceField, cellCenter, cellKey } from '../../src/game/simulation/maze.js';

function mazeSimulation() {
  return createSimulation({ levelId: MAZE_MAP.id, scrap: 10000 });
}

function unlock(simulation, level) {
  const hero = simulation.state.hero;
  const stats = getHeroStats(level);
  hero.level = level;
  hero.maxHp = stats.maxHp;
  hero.damage = stats.damage;
  hero.hp = Math.min(hero.hp, hero.maxHp);
  hero.skillSlots = createHeroSkillSlots(level, hero.skillSlots);
  return hero;
}

function enemyAt(simulation, x, y) {
  const enemy = simulation.systems.enemySystem.spawn('dustMite');
  enemy.x = x;
  enemy.y = y;
  return enemy;
}

test('Gravity Well drains, slows, grows, and leaves recoverable singularity scrap', () => {
  const simulation = mazeSimulation();
  const hero = unlock(simulation, 1);
  hero.hp = 100;
  const target = cellCenter(MAZE_MAP, { col: 4, row: 7 });
  const enemy = enemyAt(simulation, target.x, target.y);
  const scrapBefore = simulation.state.scrap;

  const cast = simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'gravity-well', x: target.x, y: target.y,
  });
  assert.equal(cast.ok, true);
  simulation.systems.heroSystem.update(300);

  const well = simulation.state.gravityWells[0];
  assert.ok(enemy.hp < enemy.maxHp);
  assert.ok(enemy.effects.some((effect) => effect.type === 'slow'));
  assert.ok(well.radius > well.baseRadius);
  assert.ok(hero.hp > 100);
  const activeSnapshot = simulation.state.toJSON();
  const restored = GameState.fromJSON(JSON.stringify(activeSnapshot));
  assert.deepEqual(restored.gravityWells, activeSnapshot.gravityWells);
  activeSnapshot.gravityWells[0].radius = 999;
  assert.notEqual(simulation.state.gravityWells[0].radius, 999);

  simulation.systems.heroSystem.update(5000);
  assert.equal(simulation.state.gravityWells.length, 0);
  const pile = simulation.state.scrapPiles[0];
  assert.ok(pile.sourceHp > 0);
  hero.x = pile.x;
  hero.y = pile.y;
  simulation.systems.heroSystem.collectNearbyScrap();
  assert.equal(simulation.state.scrapPiles.length, 0);
  assert.ok(simulation.state.scrap > scrapBefore);
});

test('Time Dilation speeds tower cooldowns and Void Rend carries the hero as its damage source', () => {
  const simulation = mazeSimulation();
  const hero = unlock(simulation, 3);
  const tower = simulation.dispatch(ACTIONS.placeTower, {
    x: cellCenter(MAZE_MAP, { col: 6, row: 2 }).x,
    y: cellCenter(MAZE_MAP, { col: 6, row: 2 }).y,
  }).tower;
  tower.cooldownMs = 1000;

  const haste = simulation.dispatch(ACTIONS.castHeroSkill, { skillId: 'time-dilation' });
  assert.equal(haste.ok, true);
  simulation.systems.towerSystem.update(100);
  assert.equal(tower.timeDilationMultiplier, 1.65);
  assert.equal(tower.cooldownMs, 835);

  const enemy = enemyAt(simulation, hero.x + 40, hero.y);
  const rend = simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'void-rend', x: enemy.x, y: enemy.y,
  });
  assert.equal(rend.ok, true);
  const hpBefore = enemy.hp;
  simulation.systems.statusEffectSystem.update(500);
  assert.equal(enemy.hp, hpBefore - 10);
  assert.equal(enemy.effects.find((effect) => effect.type === 'void-rend').source.skillId, 'void-rend');
});

test('Quantum Blink respects tower collision and Worm Tunnel becomes a maze shortcut', () => {
  const simulation = mazeSimulation();
  const hero = unlock(simulation, 5);
  const blinkTarget = cellCenter(MAZE_MAP, { col: 5, row: 7 });
  const blink = simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'quantum-blink', x: blinkTarget.x, y: blinkTarget.y,
  });
  assert.equal(blink.ok, true);
  assert.deepEqual({ x: hero.x, y: hero.y }, blinkTarget);

  const first = cellCenter(MAZE_MAP, { col: 3, row: 4 });
  const second = cellCenter(MAZE_MAP, { col: 20, row: 4 });
  const firstPortal = simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'worm-tunnel', x: first.x, y: first.y,
  });
  assert.equal(firstPortal.ok, true);
  assert.equal(firstPortal.pending, true);
  const secondPortal = simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'worm-tunnel', x: second.x, y: second.y,
  });
  assert.equal(secondPortal.ok, true);
  assert.equal(simulation.state.wormholes.length, 2);

  const field = buildDistanceField(MAZE_MAP, simulation.state.towers, null, simulation.state.wormholes);
  assert.ok(field.get(cellKey(MAZE_MAP.entrance)) < 23);
  simulation.systems.enemySystem.spawn('dustMite');
  simulation.systems.enemySystem.update(1500);
  const events = simulation.systems.enemySystem.drainEvents();
  assert.ok(events.some((event) => event.type === 'wormhole-travel'));
});

test('Worm Tunnel also advances enemies along the fixed Switchyard rail route', () => {
  const simulation = createSimulation({ scrap: 10000 });
  unlock(simulation, 5);
  assert.equal(simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'worm-tunnel', x: 100, y: 118,
  }).pending, true);
  assert.equal(simulation.dispatch(ACTIONS.castHeroSkill, {
    skillId: 'worm-tunnel', x: 600, y: 220,
  }).ok, true);

  const enemy = simulation.systems.enemySystem.spawn('dustMite');
  simulation.systems.enemySystem.update(1400);
  assert.ok(enemy.progress > 0.4);
  assert.ok(simulation.systems.enemySystem.drainEvents().some((event) => event.type === 'wormhole-travel'));
});
