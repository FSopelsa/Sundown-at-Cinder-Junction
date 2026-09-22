import { BASE, FOUNDRY, PADS, HEROES, ABILITIES } from '../../src/game/siege/content.js';
import { heroStats } from '../../src/game/siege/state.js';
import { worldToRoomCell, } from '../../src/game/simulation/roomNavigation.js';
import { SIEGE_MAP } from '../../src/game/siege/content.js';

// Deterministic acceptance pilot: only legal player commands, no state editing,
// forced kills, granted resources, or shortened production wave timers.
export function pilotSiege(sim, playerId, { push = true } = {}) {
  const state = sim.state, hero = state.heroes.find(h => h.playerId === playerId);
  if (!hero || !hero.alive || state.phase !== 'playing') return;
  const command = (type, payload = {}) => sim.dispatch({ type, playerId, ...payload });
  const distance = point => Math.hypot(hero.x - point.x, hero.y - point.y);
  const myRoom = worldToRoomCell(SIEGE_MAP, hero.x, hero.y)?.roomId;
  const stats = heroStats(hero);
  for (let slot = 0; slot < 4; slot++) {
    const item = hero.inventory[slot];
    if (item && !item.equipped && !['hull-tonic', 'repair-cell'].includes(item.type)) command('equip-item', { slot });
    if (item?.type === 'hull-tonic' && hero.hp < stats.maxHp * 0.55) command('use-item', { slot });
    if (item?.type === 'repair-cell' && state.base.hp < state.base.maxHp - 280) command('use-item', { slot });
  }
  if (distance(BASE) < 200) {
    if (!hero.inventory.some(i => i?.type === 'arc-coil')) command('buy-item', { item: 'arc-coil' });
    else if (!hero.inventory.some(i => i?.type === 'iron-plate')) command('buy-item', { item: 'iron-plate' });
    else if (state.base.hp < state.base.maxHp - 350 && hero.inventory.includes(null)) { command('buy-item', { item: 'repair-cell' }); const slot = hero.inventory.findIndex(i => i?.type === 'repair-cell'); if (slot >= 0) command('use-item', { slot }); }
    if (state.towers.length < 3) for (const pad of PADS) if (!state.towers.some(t => t.padId === pad.id)) command('build', { fortification: pad.id === 'north' ? 'frost' : 'repeater', padId: pad.id });
  }
  const enemies = state.enemies.filter(e => e.hp > 0 && worldToRoomCell(SIEGE_MAP, e.x, e.y)?.roomId === myRoom).sort((a,b) => distance(a) - distance(b));
  const nearest = enemies[0];
  for (const ability of HEROES[hero.kind].abilities) {
    const def = ABILITIES[ability];
    if (def.kind === 'field' || def.kind === 'burst') { if (nearest && distance(nearest) <= def.range) command('cast', { ability, x: nearest.x, y: nearest.y }); }
    if (def.kind === 'pulse' && nearest && distance(nearest) <= def.radius) command('cast', { ability });
    if (def.kind === 'haste' && nearest) command('cast', { ability });
  }
  const warning = state.fields.find(f => f.kind === 'warning' && distance(f) < f.radius + 20);
  if (warning) { command('move', { x: hero.x + (hero.x > warning.x ? 1 : -1) * 170, y: hero.y }); return; }
  if (state.event.status === 'active') { if (hero.interaction?.targetId !== 'capacitor') command('interact', { targetId: 'capacitor' }); return; }
  if (push && state.foundry.open && !state.foundry.destroyed && hero.hp > stats.maxHp * 0.3) {
    const target = { x: FOUNDRY.x + 75, y: FOUNDRY.y + 30 };
    if (distance(target) > 30 && !hero.path.length) command('move', target); return;
  }
  if (hero.hp < stats.maxHp * 0.4 || myRoom !== 'junction') { if (!hero.path.length) command('move', { x: BASE.x - 70, y: BASE.y + 20 }); return; }
  if (nearest && distance(nearest) > stats.range * 0.8) {
    const d = distance(nearest), stop = stats.range * 0.6;
    const target = { x: nearest.x + (hero.x - nearest.x) / d * stop, y: nearest.y + (hero.y - nearest.y) / d * stop };
    if (!hero.path.length || state.tick % 60 === 0) command('move', target);
  } else if (!nearest && distance(BASE) > 90 && !hero.path.length) command('move', { x: BASE.x - 60, y: BASE.y - 50 });
}
