import test from 'node:test';
import assert from 'node:assert/strict';
import { createSiegeSimulation } from '../../src/game/siege/simulation.js';
import { heroStats, random, restoreSiegeState } from '../../src/game/siege/state.js';
import { HEROES, ABILITIES, BASE, PADS, ENEMIES, scaling } from '../../src/game/siege/content.js';
import { pilotSiege } from '../helpers/siegePilot.js';

function start(kinds = ['singularity'], networked = false) {
  const sim = createSiegeSimulation({ seed: 7123, networked });
  kinds.forEach((kind, i) => { assert.ok(sim.addPlayer(`p${i}`, `Marshal ${i}`, kind).ok); assert.ok(sim.dispatch({ playerId: `p${i}`, type: 'ready', ready: true }).ok); });
  assert.ok(sim.dispatch({ playerId: 'p0', type: 'start' }).ok); return sim;
}
const run = (sim, ms) => { for (let elapsed = 0; elapsed < ms; elapsed += 50) sim.update(50); };
function enemy(sim, x, y, type = 'tinbackHauler') { const def = ENEMIES[type]; const e = { id: `test-${sim.state.enemies.length}`, type, x, y, hp: 1000, maxHp: 1000, damage: def.damage, speed: def.speed, range: def.range, interval: def.interval, attackMs: 10000, path: [], repathMs: 0, slowMs: 0, effects: [], targetId: 'base', bossTimerMs: 7000 }; sim.state.enemies.push(e); return e; }

test('siege has 1–4 independent stable players, ready/host gates, and serializable deterministic snapshots', () => {
  const sim = createSiegeSimulation({ seed: 77 });
  assert.equal(sim.addPlayer('p', 'P', 'toString').ok, false);
  for (let i = 0; i < 4; i++) sim.addPlayer(`p${i}`);
  assert.equal(sim.addPlayer('extra').ok, false);
  assert.equal(sim.dispatch({ playerId:'p0', type:'select-hero', hero:'__proto__' }).ok, false);
  assert.equal(sim.dispatch({ playerId:'p0', type:'start' }).ok, false);
  sim.dispatch({ playerId:'p1', type:'select-hero', hero:'bastion' });
  for (const p of sim.state.players) sim.dispatch({ playerId:p.id, type:'ready', ready:true });
  assert.equal(sim.dispatch({ playerId:'p1', type:'start' }).ok, false);
  sim.dispatch({ playerId:'p0', type:'start' }); run(sim, 20500);
  const restored = createSiegeSimulation(JSON.parse(JSON.stringify(sim.snapshot())));
  run(sim, 3300); run(restored, 3300); assert.deepEqual(restored.snapshot(), sim.snapshot());
  restored.state.heroes[0].inventory[0].type = 'repair-cell'; assert.equal(sim.state.heroes[0].inventory[0].type, 'hull-tonic');
  assert.throws(() => restoreSiegeState({ mode:'cinder-siege', schemaVersion:999 }), /Unsupported/);
});
test('every action validates its player; moves remain player scoped and map safe', () => {
  const sim = start(['singularity','bastion']), h0 = sim.heroOf('p0'), h1 = sim.heroOf('p1');
  assert.equal(sim.dispatch({ type:'move', x:800, y:800 }).ok,false);
  for (const type of ['move','cast','use-item','equip-item','interact','build','revive','pause','speed']) assert.equal(sim.dispatch({playerId:'stranger',type}).ok,false);
  assert.equal(sim.dispatch({playerId:'p0', type:'move', x:NaN, y:900}).ok,false);
  assert.equal(sim.dispatch({playerId:'p0', type:'move', x:-100, y:900}).ok,false);
  const before = {x:h1.x,y:h1.y}; assert.ok(sim.dispatch({playerId:'p0', type:'move', x:780, y:820}).ok); run(sim, 1000);
  assert.notEqual(h0.x,840); assert.deepEqual({x:h1.x,y:h1.y},before);
  sim.setConnected('p0',false); assert.equal(sim.dispatch({playerId:'p0',type:'move',x:900,y:800}).ok,false);
});
test('both hero kits execute their three abilities, enforce unlocks, roles and cooldowns', () => {
  for (const kind of Object.keys(HEROES)) {
    const sim = start([kind]), h = sim.heroOf('p0');
    assert.equal(sim.dispatch({playerId:'p0',type:'cast',ability:HEROES[kind].abilities[2],x:1000,y:960}).ok,false);
    h.level = 4; h.hp = 180; const e = enemy(sim,h.x+45,h.y);
    for (const ability of HEROES[kind].abilities) {
      const def = ABILITIES[ability], beforeHp = e.hp;
      assert.ok(sim.dispatch({playerId:'p0',type:'cast',ability,x:h.x+40,y:h.y}).ok, ability);
      assert.equal(sim.dispatch({playerId:'p0',type:'cast',ability,x:h.x+40,y:h.y}).ok,false);
      assert.ok(h.cooldowns[ability] > 0);
      if (def.kind === 'burst' || def.kind === 'pulse') assert.ok(e.hp < beforeHp);
    }
    if (kind === 'singularity') { assert.equal(sim.state.fields.length,1); const hp = e.hp; run(sim,500); assert.ok(e.hp<hp); assert.ok(h.hp>180); }
    else { assert.ok(h.hasteMs>0); assert.equal(sim.state.portals.length,1); assert.ok(h.tauntMs>0); }
    const foreign = kind === 'singularity' ? 'cinder-pulse' : 'gravity-well';
    assert.equal(sim.dispatch({playerId:'p0',type:'cast',ability:foreign}).ok,false);
  }
});
test('four-slot personal inventory applies equipment, consumes tonics and validates proximity/spending', () => {
  const sim = start(['singularity','bastion']), h = sim.heroOf('p0'), before = heroStats(h);
  h.marks = 300;
  for (const item of ['iron-plate','arc-coil','chrono-gear']) assert.ok(sim.dispatch({playerId:'p0',type:'buy-item',item}).ok);
  assert.equal(sim.dispatch({playerId:'p0',type:'buy-item',item:'trail-boots'}).ok,false);
  for (let slot=1;slot<4;slot++) sim.dispatch({playerId:'p0',type:'equip-item',slot});
  assert.equal(heroStats(h).maxHp,before.maxHp+120); assert.equal(heroStats(h).damage,before.damage+16); assert.equal(heroStats(h).cooldown,0.8);
  assert.equal(heroStats(sim.heroOf('p1')).damage,HEROES.bastion.damage);
  h.hp=10; sim.dispatch({playerId:'p0',type:'use-item',slot:0}); assert.equal(h.hp,250); assert.equal(h.inventory[0],null);
  assert.equal(sim.dispatch({playerId:'p0',type:'use-item',slot:1}).ok,false);
  sim.dispatch({playerId:'p0',type:'buy-item',item:'repair-cell'}); sim.state.base.hp=1000;
  h.x=160; h.y=780; assert.equal(sim.dispatch({playerId:'p0',type:'use-item',slot:0}).ok,false); assert.ok(h.inventory[0]);
  h.x=BASE.x; h.y=BASE.y; sim.dispatch({playerId:'p0',type:'use-item',slot:0}); assert.equal(sim.state.base.hp,1300);
});
test('shared Scrap reservation is atomic, pad ownership and team cap hold, construction takes time', () => {
  const sim = start(['singularity','bastion']); for (const h of sim.state.heroes) {h.x=900;h.y=780;}
  sim.state.scrap=500;
  assert.ok(sim.dispatch({playerId:'p0',type:'build',padId:'west',fortification:'repeater'}).ok);
  assert.equal(sim.dispatch({playerId:'p1',type:'build',padId:'east',fortification:'repeater'}).ok,false);
  assert.equal(sim.state.scrap,200); assert.equal(sim.state.towers[0].ownerId,'p0'); assert.equal(sim.state.towers[0].constructionMs,5000);
  sim.state.scrap=1000; for (const padId of ['east','north']) assert.ok(sim.dispatch({playerId:'p1',type:'build',padId,fortification:'repeater'}).ok);
  const scrap=sim.state.scrap; assert.equal(sim.dispatch({playerId:'p0',type:'build',padId:'west',fortification:'relay'}).ok,false); assert.equal(sim.state.scrap,scrap);
  run(sim,5050); assert.ok(sim.state.towers.every(t=>t.constructionMs===0));
});
test('downing, ally channel revival, solo reconstruction and enemy target selection work', () => {
  const sim = start(['singularity','bastion']), a=sim.heroOf('p0'),b=sim.heroOf('p1'); a.hp=1;
  const e=enemy(sim,a.x,a.y); e.attackMs=0; run(sim,50); assert.equal(a.alive,false);
  assert.equal(sim.dispatch({playerId:'p0',type:'cast',ability:'gravity-well',x:a.x,y:a.y}).ok,false);
  e.attackMs=100000;
  assert.ok(sim.dispatch({playerId:'p1',type:'revive',targetId:a.id}).ok); run(sim,3200); assert.ok(a.alive); assert.ok(a.shieldMs>0);
  a.alive=false;a.hp=0;a.downMs=100;run(sim,150);assert.ok(a.alive);assert.equal(a.x,BASE.x);
  a.x=740;a.y=600;b.x=1040;b.y=650; e.x=1040;e.y=650;e.repathMs=0;run(sim,50);assert.equal(e.targetId,b.id);
  b.x=160;b.y=780;run(sim,50);assert.equal(e.targetId,'base');
});
test('count, hull and pressure scale for four players; RNG and snapshots replay; co-op cannot pause', () => {
  const solo=start(),team=start(['singularity','bastion','singularity','bastion'],true);
  run(solo,18000);run(team,18000);assert.ok(team.state.spawnQueue.length>solo.state.spawnQueue.length);assert.ok(team.state.enemies[0].maxHp>solo.state.enemies[0].maxHp);assert.ok(scaling(4).damage>scaling(1).damage);
  assert.equal(team.dispatch({playerId:'p0',type:'pause'}).ok,false);assert.equal(team.dispatch({playerId:'p0',type:'speed',speed:2}).ok,false);
  const copy=createSiegeSimulation(solo.snapshot()); assert.equal(random(solo.state),random(copy.state));
});
test('both heroes complete a full timed solo siege through legal commands, event, outward push and boss', { timeout: 180000 }, () => {
  for (const kind of Object.keys(HEROES)) {
    const sim=start([kind]);
    while(sim.state.phase==='playing' && sim.state.timeMs<1230000) { pilotSiege(sim,'p0'); sim.update(1000); }
    assert.equal(sim.state.event.status,'secured',`${kind} event`);
    assert.equal(sim.state.foundry.destroyed,true,`${kind} foundry`);
    assert.equal(sim.state.phase,'victory',`${kind}: ${JSON.stringify(sim.state.summary)}`);
    assert.ok(sim.state.timeMs >= 900000 && sim.state.timeMs <= 1200000);
  }
});
