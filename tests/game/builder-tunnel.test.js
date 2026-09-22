import assert from 'node:assert/strict';
import test from 'node:test';
import { MAZE_MAP, THRESHOLD_MAP } from '../../src/game/content/map.js';
import { getHeroStats, createHeroSkillSlots } from '../../src/game/content/heroes.js';
import { ACTIONS } from '../../src/game/input/actions.js';
import { TOWER_DEFINITIONS } from '../../src/game/content/towers.js';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { buildDistanceField, cellCenter, cellKey, isWormholeTransition } from '../../src/game/simulation/maze.js';
import { isHeroCellBlocked, worldToHeroCell } from '../../src/game/simulation/navigation.js';
import {
  buildRoomDistanceField,
  roomCellCenter,
  roomCellKey,
} from '../../src/game/simulation/roomNavigation.js';

function unlockWormTunnel(simulation) {
  const hero = simulation.state.hero;
  hero.level = 6;
  Object.assign(hero, getHeroStats(6));
  hero.skillSlots = createHeroSkillSlots(6, hero.skillSlots);
}

function finishConstruction(simulation) {
  for (let frame = 0; frame < 1200 && simulation.state.towers.some((tower) => tower.construction); frame += 1) {
    simulation.update(1000 / 60);
  }
  assert.equal(simulation.state.towers.some((tower) => tower.construction), false);
}

test('Worm Tunnel is directional, expires, and can be upgraded for a longer active window', () => {
  const simulation = createSimulation({ levelId: MAZE_MAP.id, scrap: 10000 });
  unlockWormTunnel(simulation);
  const entry = cellCenter(MAZE_MAP, { col: 3, row: 4 });
  const exit = cellCenter(MAZE_MAP, { col: 20, row: 4 });

  const upgrade = simulation.dispatch(ACTIONS.upgradeHeroSkill, { skillId: 'worm-tunnel' });
  assert.equal(upgrade.ok, true);
  assert.equal(upgrade.durationMs, 7500);
  assert.equal(simulation.dispatch(ACTIONS.castHeroSkill, { skillId: 'worm-tunnel', ...entry }).pending, true);
  const linked = simulation.dispatch(ACTIONS.castHeroSkill, { skillId: 'worm-tunnel', ...exit });
  assert.equal(linked.durationMs, 7500);
  assert.equal(linked.cost, 75);
  assert.equal(isWormholeTransition({ col: 3, row: 4 }, { col: 20, row: 4 }, simulation.state.wormholes), true);
  assert.equal(isWormholeTransition({ col: 20, row: 4 }, { col: 3, row: 4 }, simulation.state.wormholes), false);
  assert.ok(buildDistanceField(MAZE_MAP, [], null, simulation.state.wormholes).get(cellKey(MAZE_MAP.entrance)) < 23);

  simulation.systems.heroSystem.update(7499);
  assert.equal(simulation.state.wormholes.length, 2);
  simulation.systems.heroSystem.update(2);
  assert.equal(simulation.state.wormholes.length, 0);
});

test('Ctrl-style placement queues reserved towers and builds them in placement order', () => {
  const simulation = createSimulation({ levelId: THRESHOLD_MAP.id, scrap: 4000 });
  const firstPoint = roomCellCenter(THRESHOLD_MAP, { roomId: 'arrival-yard', col: 5, row: 5 });
  const secondPoint = roomCellCenter(THRESHOLD_MAP, { roomId: 'arrival-yard', col: 9, row: 7 });
  const first = simulation.dispatch(ACTIONS.placeTower, { towerType: 'peacemaker', ...firstPoint });
  const rejected = simulation.dispatch(ACTIONS.placeTower, { towerType: 'sunspitter', ...secondPoint });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /hold ctrl/i);

  const second = simulation.dispatch(ACTIONS.placeTower, {
    towerType: 'sunspitter', ...secondPoint, queue: true,
  });
  assert.equal(second.ok, true);
  assert.equal(first.tower.construction.status, 'active');
  assert.equal(second.tower.construction.status, 'queued');
  assert.ok(second.tower.construction.queueIndex > first.tower.construction.queueIndex);
  const reservedCell = worldToHeroCell(THRESHOLD_MAP, secondPoint.x, secondPoint.y);
  assert.equal(isHeroCellBlocked(THRESHOLD_MAP, simulation.state.towers, reservedCell), true);
  const enemyDistances = buildRoomDistanceField(
    THRESHOLD_MAP,
    simulation.state.towers,
    null,
    simulation.state.wormholes,
    simulation.state.roomState,
  );
  assert.equal(enemyDistances.has(roomCellKey(reservedCell)), false);

  const duplicate = simulation.dispatch(ACTIONS.placeTower, {
    towerType: 'wall', ...secondPoint, queue: true,
  });
  assert.equal(duplicate.ok, false);

  for (let frame = 0; frame < 1200 && first.tower.construction; frame += 1) {
    simulation.update(1000 / 60);
  }
  assert.equal(first.tower.construction, null);
  assert.equal(second.tower.construction.status, 'active');
  finishConstruction(simulation);
});

test('the Marshal walks to 3D construction, then activates build and upgrade effects', () => {
  const simulation = createSimulation({ levelId: THRESHOLD_MAP.id, scrap: 2000 });
  const target = roomCellCenter(THRESHOLD_MAP, { roomId: 'arrival-yard', col: 5, row: 5 });
  const placed = simulation.dispatch(ACTIONS.placeTower, { towerType: 'peacemaker', ...target });
  assert.equal(placed.ok, true);
  assert.equal(placed.tower.construction.kind, 'build');
  assert.ok(placed.tower.construction.durationMs >= 3000);
  assert.ok(simulation.state.hero.destination);
  assert.equal(simulation.dispatch(ACTIONS.upgradeTower, { towerId: placed.tower.id, upgrade: 'damage' }).ok, false);

  finishConstruction(simulation);
  const baseDamage = placed.tower.damage;
  const upgrade = simulation.dispatch(ACTIONS.upgradeTower, { towerId: placed.tower.id, upgrade: 'damage' });
  assert.equal(upgrade.ok, true);
  assert.equal(placed.tower.damage, baseDamage);
  assert.equal(placed.tower.construction.kind, 'upgrade');
  finishConstruction(simulation);
  assert.equal(placed.tower.damage, TOWER_DEFINITIONS.peacemaker.damage * 1.5);
  assert.equal(placed.tower.level, 2);
  const secondUpgrade = simulation.dispatch(ACTIONS.upgradeTower, { towerId: placed.tower.id, upgrade: 'speed' });
  assert.equal(secondUpgrade.ok, true);
  assert.ok(secondUpgrade.construction.durationMs > upgrade.construction.durationMs);
  finishConstruction(simulation);
  assert.equal(placed.tower.level, 3);
});

test('unreachable construction is rejected before it changes the room state or Scrap', () => {
  const simulation = createSimulation({ levelId: THRESHOLD_MAP.id, scrap: 2000 });
  const heroCell = { roomId: 'arrival-yard', col: 5, row: 5 };
  const heroPoint = roomCellCenter(THRESHOLD_MAP, heroCell);
  Object.assign(simulation.state.hero, {
    x: heroPoint.x,
    y: heroPoint.y,
    navigationCell: { ...heroCell },
    navigationNext: null,
    route: [],
  });
  simulation.state.towers = [
    { col: 4, row: 5 }, { col: 6, row: 5 }, { col: 5, row: 4 }, { col: 5, row: 6 },
  ].map((cell, index) => ({
    id: `blocker-${index}`,
    type: 'wall',
    name: 'Defensive Wall',
    ...roomCellCenter(THRESHOLD_MAP, { roomId: heroCell.roomId, ...cell }),
    level: 1,
    ladder: false,
  }));
  const scrapBefore = simulation.state.scrap;
  const target = roomCellCenter(THRESHOLD_MAP, { roomId: 'arrival-yard', col: 10, row: 8 });
  const result = simulation.dispatch(ACTIONS.placeTower, { towerType: 'peacemaker', ...target });
  assert.equal(result.ok, false);
  assert.match(result.reason, /cannot reach/i);
  assert.equal(simulation.state.scrap, scrapBefore);
  assert.equal(simulation.state.towers.length, 4);
  assert.equal(simulation.state.towers.some((tower) => tower.construction), false);
});
