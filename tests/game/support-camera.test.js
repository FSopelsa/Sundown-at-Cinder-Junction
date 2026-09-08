import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { GameState } from '../../src/game/simulation/GameState.js';
import { LEVELS } from '../../src/game/content/map.js';
import { findHeroPath, isHeroCellBlocked, worldToHeroCell } from '../../src/game/simulation/navigation.js';
import { buildDistanceField, cellKey, worldToCell } from '../../src/game/simulation/maze.js';
import { roomCellCenter } from '../../src/game/simulation/roomNavigation.js';
for (const map of LEVELS) {
 test(`${map.id}: ladder passage, shop, taunt destruction and saved effects`, () => {
  const sim=createSimulation(new GameState({levelId:map.id,scrap:10000}));
  const {state,systems}=sim;
  const pos=map.mode==='maze'?{x:map.grid.x+5.5*40,y:map.grid.y+4.5*40}:map.mode==='rooms'?roomCellCenter(map,{roomId:'arrival-yard',col:5,row:5}):{x:400,y:350};
  const built=systems.towerSystem.placeTower('wall',pos.x,pos.y); assert.equal(built.ok,true);
  const wall=built.tower, cell=worldToHeroCell(map,wall.x,wall.y);
  assert.equal(isHeroCellBlocked(map,state.towers,cell),true);
  assert.equal(systems.towerSystem.upgradeTower(wall.id,'ladder').ok,true);
  assert.equal(isHeroCellBlocked(map,state.towers,cell),false);
  assert.ok(findHeroPath(map,state.towers,state.hero,wall));
  if(map.mode==='maze') assert.equal(buildDistanceField(map,state.towers).has(cellKey(worldToCell(map,wall.x,wall.y))),false);
  assert.equal(systems.towerSystem.upgradeTower(wall.id,'ladder').ok,false);
  const exchange=systems.towerSystem.placeTower('scrapExchange',wall.x,wall.y).tower;assert.ok(exchange);
  const buy=item=>sim.dispatch('purchase-support',{towerId:exchange.id,item});
  state.hero.hp-=100;assert.equal(buy('heal').ok,true);assert.equal(state.hero.hp,state.hero.maxHp);
  assert.equal(buy('buff').ok,true);systems.heroSystem.takeDamage(40);assert.equal(state.hero.hp,state.hero.maxHp-20);
  assert.equal(buy('aura').ok,true);assert.equal(buy('aura').ok,false);
  assert.equal(buy('xp').ok,true);assert.equal(state.hero.level,2);
  const restored=GameState.fromJSON(state.toJSON());assert.equal(restored.hero.aegisRemainingMs,15000);assert.equal(restored.towers[0].aura,true);
  systems.heroSystem.takeDamage(100000);assert.equal(buy('buyback').ok,true);assert.equal(state.hero.alive,true);
  const enemy=systems.enemySystem.spawn('dustMite');enemy.x=exchange.x-60;enemy.y=exchange.y;
  const before={x:enemy.x,y:enemy.y};systems.enemySystem.update(100);assert.deepEqual({x:enemy.x,y:enemy.y},before);assert.ok(exchange.hp<exchange.maxHp);
  exchange.hp=1;enemy.attackCooldownMs=0;systems.enemySystem.update(100);assert.equal(state.towers.length,0);
  assert.equal(buy('repair').ok,false);
 });
}
test('invalid purchases are atomic and aura speed does not stack',()=>{
 const sim=createSimulation(new GameState({scrap:10000}));
 const tower=sim.systems.towerSystem.placeTower('peacemaker',400,350).tower;
 const exchange=sim.systems.towerSystem.placeTower('scrapExchange',450,350).tower;
 exchange.aura=true;
 const second=sim.systems.towerSystem.placeTower('scrapExchange',400,400).tower; second.aura=true;
 tower.cooldownMs=1000;
 sim.systems.towerSystem.update(100);assert.equal(tower.cooldownMs,880);
 sim.state.scrap=0;const before=sim.state.toJSON();assert.equal(sim.dispatch('purchase-support',{towerId:exchange.id,item:'xp'}).ok,false);assert.deepEqual(sim.state.toJSON(),before);
});

test('hero physically crosses a ladder wall while ordinary wall remains impassable', () => {
 const sim=createSimulation(new GameState({levelId:'cinder-maze',scrap:500}));
 const wall=sim.systems.towerSystem.placeTower('wall',340,420).tower;
 assert.ok(wall);
 sim.systems.towerSystem.upgradeTower(wall.id,'ladder');
 assert.equal(sim.systems.heroSystem.commandMove(wall.x,wall.y).ok,true);
 for(let i=0;i<120;i++) sim.systems.heroSystem.update(1000/60);
 assert.equal(sim.state.hero.x,wall.x);assert.equal(sim.state.hero.y,wall.y);
 assert.equal(sim.systems.towerSystem.placeTower('peacemaker',wall.x,wall.y).ok,false);
 assert.equal(sim.systems.heroSystem.commandMove(420,420).ok,true);
 for(let i=0;i<120;i++) sim.systems.heroSystem.update(1000/60);
 assert.equal(sim.state.hero.x,420);assert.equal(sim.state.hero.y,420);
});
