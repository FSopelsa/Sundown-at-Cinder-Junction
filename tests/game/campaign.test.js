import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { roomCellCenter, roomCellKey, validateRoomPlacement } from '../../src/game/simulation/roomNavigation.js';
import { campaignRoutePoints } from '../../src/game/simulation/campaignRouting.js';
import { CampaignSaves, SAVE_PREFIX } from '../../src/game/saves.js';
import { ACTIONS } from '../../src/game/input/actions.js';

const fresh = () => createSimulation({ levelId: 'cinder-campaign' });
const point = (sim, roomId, col, row) => roomCellCenter(sim.map, { roomId, col, row });
function advance(sim, ms) { for (let t = 0; t < ms; t += 50) sim.update(Math.min(50, ms - t)); }
function clearEncounter(sim) {
  const encounter = sim.map.campaign.encounters.find(e => e.id === sim.state.campaign.activeEncounterId);
  sim.state.wave = { index: encounter.waves, completed: true, inProgress: false, spawnQueue: [], elapsedMs: 0 };
  sim.state.enemies = [];
  sim.systems.campaignSystem.update(17);
}
function junction() { const sim = fresh(); clearEncounter(sim); clearEncounter(sim); sim.state.campaign.revealRemainingMs = 0; return sim; }
function moveTo(sim, roomId, col, row) {
  const cell = { roomId, col, row };
  Object.assign(sim.state.hero, point(sim, roomId, col, row), { navigationCell: cell, navigationNext: null, destination: null, route: [] });
}

test('campaign starts in Room 1 only; hidden rooms reject building, walking and skill targets', () => {
  const sim = fresh();
  assert.equal(sim.map.id, 'cinder-campaign');
  assert.deepEqual(sim.state.roomState.unlockedRoomIds, ['room-1']);
  const target = point(sim, 'room-2', 4, 4);
  assert.equal(sim.dispatch(ACTIONS.placeTower, { towerType: 'wall', ...target }).ok, false);
  assert.equal(sim.dispatch(ACTIONS.moveHero, target).ok, false);
  assert.equal(sim.systems.heroSystem.getOpenGroundTarget(target.x, target.y).ok, false);
  assert.equal(validateRoomPlacement(sim.map, sim.state, ...Object.values(point(sim, 'room-1', 2, 2))).ok, false);
  const enemy = sim.systems.enemySystem.spawn('dustMite');
  assert.equal(enemy.roomCell.roomId, 'room-1');
});

test('room-clear transitions persist defenses, change the spawn and award one autosave', () => {
  const sim = fresh();
  const placed = sim.dispatch(ACTIONS.placeTower, { towerType: 'teslaCoil', ...point(sim, 'room-1', 9, 5) });
  assert.equal(placed.ok, true);
  clearEncounter(sim);
  assert.equal(sim.state.campaign.activeEncounterId, 'room-2');
  assert.equal(sim.state.campaign.saveRevision, 1);
  assert.ok(sim.state.roomState.openDoorIds.includes('vault-door'));
  assert.equal(sim.state.towers[0].id, placed.tower.id);
  assert.equal(sim.dispatch(ACTIONS.startWave).ok, false, 'reveal blocks premature waves');
  advance(sim, 3300);
  assert.equal(sim.dispatch(ACTIONS.startWave).ok, true);
  advance(sim, 1600);
  assert.equal(sim.state.enemies[0].roomCell.roomId, 'room-2');
  const once = sim.state.scrap;
  sim.systems.campaignSystem.update(100);
  assert.equal(sim.state.scrap, once);
  assert.equal(sim.state.campaign.saveRevision, 1);
});

test('sun route visits the seal, regenerates for exactly seven seconds and consumes door permission on crossing', () => {
  const sim = junction();
  const path = campaignRoutePoints(sim.map, sim.state);
  assert.ok(path.some(p => JSON.stringify(p) === JSON.stringify(roomCellCenter(sim.map, sim.map.campaign.checkpoint))));
  const enemy = sim.systems.enemySystem.spawn('dustMite');
  enemy.hp = 1;
  sim.systems.enemySystem.moveThroughRooms(enemy, 320);
  assert.equal(enemy.sunVisited, true);
  assert.equal(enemy.sunRegenRemainingMs, 7000);
  assert.equal(enemy.sunDoorPermission, true);
  enemy.speed = 0;
  sim.systems.enemySystem.update(7001);
  assert.ok(Math.abs(enemy.hp - (1 + enemy.maxHp * 0.28)) < 1e-6);
  assert.equal(enemy.sunRegenRemainingMs, 0);
  assert.equal(enemy.sunDoorPermission, true);
  const hp = enemy.hp;
  sim.systems.enemySystem.update(1000);
  assert.equal(enemy.hp, hp);
  sim.systems.enemySystem.moveThroughRooms(enemy, 410);
  assert.equal(enemy.roomCell.roomId, 'room-2');
  assert.equal(enemy.sunDoorPermission, false);
  sim.systems.enemySystem.moveThroughRooms(enemy, 3000);
  assert.equal(enemy.progress, 1);
  assert.equal(enemy.roomCell.roomId, 'room-1');
});

test('cross-room wormholes cannot bypass the sun or make an expiring route the only path', () => {
  const sim = junction();
  sim.state.wormholes = [sim.map.campaign.encounters[2].spawn, sim.map.exit].map(cell => ({ cell, ...roomCellCenter(sim.map, cell), remainingMs: 9000 }));
  const enemy = sim.systems.enemySystem.spawn('dustMite');
  sim.systems.enemySystem.moveThroughRooms(enemy, 80);
  assert.equal(enemy.roomCell.roomId, 'sun');
  assert.equal(enemy.sunVisited, false);
  // Seal the entire junction below the checkpoint except one final gap.
  sim.state.towers = Array.from({ length: 15 }, (_, col) => ({ id: `wall-${col}`, type: 'wall', ...point(sim, 'sun', col, 10) }));
  const lastGap = point(sim, 'sun', 15, 10);
  assert.equal(validateRoomPlacement(sim.map, sim.state, lastGap.x, lastGap.y).ok, false);
});

test('boss is a shell; trials are exclusive, local and reward each key once in chosen order', () => {
  const sim = junction(); clearEncounter(sim);
  assert.ok(sim.state.roomState.unlockedRoomIds.includes('boss'));
  assert.ok(sim.state.roomState.unlockedRoomIds.includes('workshop'));
  assert.equal(sim.state.campaign.activeEncounterId, null);
  assert.equal(sim.map.roomConnections.some(d => [d.from.roomId, d.to.roomId].includes('boss') && [d.from.roomId, d.to.roomId].includes('room-1')), false);
  for (const id of ['grav', 'solar', 'arc', 'cryo']) {
    const door = sim.map.roomConnections.find(d => d.id === `${id}-door`);
    moveTo(sim, ...[door.from.roomId, door.from.col, door.from.row]);
    assert.equal(sim.dispatch('campaign-interact', { targetId: `trial:${id}` }).ok, true);
    sim.systems.campaignSystem.update(17);
    assert.equal(sim.state.campaign.activeEncounterId, id);
    assert.equal(sim.dispatch('campaign-interact', { targetId: `trial:${id === 'cryo' ? 'solar' : 'cryo'}` }).ok, false);
    sim.state.campaign.revealRemainingMs = 0;
    const enemy = sim.systems.enemySystem.spawn('dustMite');
    sim.systems.enemySystem.moveThroughRooms(enemy, 2000);
    assert.equal(enemy.roomCell.roomId, id);
    assert.equal(enemy.progress, 1);
    clearEncounter(sim);
    const scrap = sim.state.scrap;
    sim.systems.campaignSystem.update(17);
    assert.equal(sim.state.scrap, scrap);
    assert.equal(sim.dispatch('campaign-interact', { targetId: `trial:${id}` }).ok, false);
  }
  assert.equal(sim.state.campaign.keys.length, 4);
  assert.equal(sim.systems.waveSystem.hasCompletedCampaign(), true);
  assert.equal(sim.dispatch(ACTIONS.startWave).ok, false);
});

test('machine save waits for arrival; manual and automatic slots survive failure and corruption', () => {
  const sim = fresh();
  assert.equal(sim.dispatch('campaign-interact', { targetId: 'save:room-1' }).ok, true);
  advance(sim, 100);
  assert.equal(sim.state.campaign.saveRevision, 0);
  advance(sim, 30000);
  assert.equal(sim.state.campaign.saveRevision, 1);
  assert.equal(sim.state.campaign.saveKind, 'manual');
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const saves = new CampaignSaves(storage);
  assert.equal(saves.write(sim.state, 'manual').ok, true);
  clearEncounter(sim);
  assert.equal(saves.write(sim.state, 'auto').ok, true);
  sim.state.stationIntegrity = 0;
  assert.equal(saves.read('auto').state.stationIntegrity, 100);
  memory.set(SAVE_PREFIX + 'auto', '{broken');
  assert.equal(saves.latest().kind, 'manual');
  assert.equal(memory.get(SAVE_PREFIX + 'auto'), '{broken');
  const failing = new CampaignSaves({ getItem: storage.getItem, setItem() { throw new Error('quota'); } });
  assert.equal(failing.write(sim.state, 'manual').ok, false);
  assert.equal(saves.read('manual').state.stationIntegrity, 100);
});

test('mid-wave saves resume deterministically with the accumulator, routes and sun timers intact', () => {
  const sim = junction();
  sim.dispatch(ACTIONS.startWave);
  advance(sim, 14113);
  assert.ok(sim.state.enemies.some(e => e.sunVisited && e.sunRegenRemainingMs > 0));
  const restored = createSimulation(GameState.fromJSON(JSON.stringify(sim.state.toJSON())));
  for (const delta of [21, 53, 11, 248, 89, 111, 9, 33]) { sim.update(delta); restored.update(delta); }
  assert.deepEqual(restored.state.toJSON(), sim.state.toJSON());
  restored.state.campaign.keys.push('solar');
  assert.equal(sim.state.campaign.keys.length, 0);
});

test('elemental keys improve existing and future damage without repeatedly mutating tower stats', () => {
  const sim = fresh();
  sim.state.campaign.keys = ['solar', 'cryo', 'arc', 'grav'];
  for (const type of ['solar', 'cryo', 'arc', 'neutral']) {
    const enemy = sim.systems.enemySystem.spawn('tinbackHauler');
    enemy.shield = 0;
    const hp = enemy.hp;
    sim.systems.combatSystem.applyDamage(enemy.id, 10, type, { kind: 'tower', id: 'test' });
    assert.ok(Math.abs(enemy.hp - (hp - 12)) < 1e-9);
  }
  const enemy = sim.state.enemies[0], before = enemy.hp;
  sim.systems.combatSystem.applyDamage(enemy.id, 10, 'neutral', { kind: 'hero', id: sim.state.hero.id });
  assert.ok(Math.abs(enemy.hp - (before - 12)) < 1e-9);
  const hull = sim.state.hero.hp;
  sim.systems.heroSystem.takeDamage(100);
  assert.equal(sim.state.hero.hp, hull - 81);
});

test('a main-campaign playthrough reaches all four landmarks with legal builds and no forced clears', () => {
  const sim = fresh();
  function build(roomId, col, row, type) {
    const result = sim.dispatch(ACTIONS.placeTower, { towerType: type, ...point(sim, roomId, col, row) });
    assert.equal(result.ok, true, result.reason);
    advance(sim, 30000);
    assert.ok(!sim.state.towers.some(t => t.construction));
  }
  for (const col of [4, 7, 10, 13]) build('room-1', col, 5, 'teslaCoil');
  for (const id of ['room-1', 'room-2', 'sun']) {
    if (id === 'sun') {
      for (const tower of sim.state.towers.filter(t => t.type === 'teslaCoil')) {
        const result = sim.dispatch(ACTIONS.upgradeTower, { towerId: tower.id, upgrade: 'damage' });
        assert.equal(result.ok, true, result.reason);
        advance(sim, 30000);
      }
    }
    if (id !== 'room-1') {
      build(id, 7, 4, 'sunspitter');
      build(id, 10, 5, 'coldIronLongshot');
    }
    sim.dispatch(ACTIONS.moveHero, point(sim, 'room-1', 13, 9)); advance(sim, 40000);
    const encounter = sim.map.campaign.encounters.find(e => e.id === id);
    for (let wave = 1; wave <= encounter.waves; wave++) {
      assert.equal(sim.dispatch(ACTIONS.startWave).ok, true);
      advance(sim, 180000);
      assert.ok(sim.state.stationIntegrity > 0, `${id} wave ${wave} lost the portal`);
      assert.equal(sim.state.enemies.length, 0, 'no enemy remains stranded');
    }
  }
  assert.deepEqual(sim.state.campaign.completed, ['room-1', 'room-2', 'sun']);
  assert.equal(sim.state.campaign.saveRevision, 3);
  assert.ok(sim.state.roomState.unlockedRoomIds.includes('boss'));
  assert.ok(sim.state.towers.length >= 8);
});

for (const element of ['solar', 'cryo', 'arc', 'grav']) {
  test(`${element} can be the first trial and completed with a legal local defense`, () => {
    const sim = junction(); clearEncounter(sim);
    const door = sim.map.roomConnections.find(d => d.id === `${element}-door`);
    moveTo(sim, door.from.roomId, door.from.col, door.from.row);
    sim.dispatch('campaign-interact', { targetId: `trial:${element}` });
    advance(sim, 4000);
    for (const [col, row, type] of [[3,5,'sunspitter'], [5,5,'teslaCoil'], [7,5,'teslaCoil'], [9,5,'coldIronLongshot']]) {
      const result = sim.dispatch(ACTIONS.placeTower, { towerType: type, ...point(sim, element, col, row) });
      assert.equal(result.ok, true, result.reason);
      advance(sim, 25000);
    }
    sim.dispatch(ACTIONS.moveHero, point(sim, 'workshop', 2, 2)); advance(sim, 30000);
    for (let wave = 1; wave <= 3; wave++) {
      assert.equal(sim.dispatch(ACTIONS.startWave).ok, true);
      advance(sim, 180000);
      assert.ok(sim.state.stationIntegrity > 0, `trial wave ${wave} lost integrity`);
      assert.equal(sim.state.enemies.length, 0);
    }
    assert.deepEqual(sim.state.campaign.keys, [element]);
  });
}

test('opening two waves can be defended with the starting budget and real construction', () => {
  const sim = fresh();
  for (const col of [4, 7, 10, 13]) {
    const result = sim.dispatch(ACTIONS.placeTower, { towerType: 'teslaCoil', ...point(sim, 'room-1', col, 5) });
    assert.equal(result.ok, true, result.reason);
    advance(sim, 16000);
    assert.equal(sim.state.towers.some(t => t.construction), false);
  }
  sim.dispatch(ACTIONS.moveHero, point(sim, 'room-1', 13, 9)); advance(sim, 9000);
  for (let wave = 0; wave < 2; wave++) {
    assert.equal(sim.dispatch(ACTIONS.startWave).ok, true);
    advance(sim, 100000);
    assert.ok(sim.state.stationIntegrity > 0);
  }
  assert.deepEqual(sim.state.campaign.completed, ['room-1']);
  assert.equal(sim.state.campaign.activeEncounterId, 'room-2');
});
