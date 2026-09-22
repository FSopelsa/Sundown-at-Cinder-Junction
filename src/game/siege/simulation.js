import { SIEGE_RULES, HEROES, ABILITIES, ITEMS, FORTIFICATIONS, SIEGE_MAP, BASE, EVENT_SITE, PADS, SPAWNS, ENEMIES, scaling, xpForLevel } from './content.js';
import { createSiegeState, restoreSiegeState, makeHero, heroStats, random } from './state.js';
import { findRoomHeroPath, roomCellCenter, worldToRoomCell } from '../simulation/roomNavigation.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sameRoom = (a, b) => worldToRoomCell(SIEGE_MAP, a.x, a.y)?.roomId === worldToRoomCell(SIEGE_MAP, b.x, b.y)?.roomId;
const validPoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y) && Boolean(worldToRoomCell(SIEGE_MAP, point.x, point.y));
const ok = () => ({ ok: true });
const no = reason => ({ ok: false, reason });

export function createSiegeSimulation(options = {}) {
  const state = options.mode === 'cinder-siege' ? restoreSiegeState(options) : createSiegeState(options);
  const id = prefix => `${prefix}-${state.nextId++}`;
  const heroOf = playerId => state.heroes.find(hero => hero.playerId === playerId);
  const liveHeroes = () => state.heroes.filter(hero => hero.alive);
  const effect = (type, point, extra = {}) => { state.effects.push({ id: id('fx'), type, x: point.x, y: point.y, remainingMs: 550, ...extra }); if (state.effects.length > 100) state.effects.shift(); };
  const announce = message => { state.message = message; };
  const route = (entity, point) => {
    const path = findRoomHeroPath(SIEGE_MAP, [], entity, point);
    if (!path) return null;
    return [...path.cells.slice(1).map(cell => roomCellCenter(SIEGE_MAP, cell)), { x: point.x, y: point.y }];
  };
  function walk(entity, speed, dt) {
    let remaining = speed * dt / 1000;
    while (entity.path?.length && remaining > 0) {
      const target = entity.path[0], d = distance(entity, target);
      if (d <= remaining) { entity.x = target.x; entity.y = target.y; entity.path.shift(); remaining -= d; }
      else { entity.x += (target.x - entity.x) / d * remaining; entity.y += (target.y - entity.y) / d * remaining; remaining = 0; }
    }
  }
  function addPlayer(playerId, name = 'Marshal', kind = 'singularity') {
    if (state.phase !== 'lobby' || state.players.length >= 4 || typeof playerId !== 'string' || !/^[\w-]{1,80}$/.test(playerId) || state.players.some(p => p.id === playerId) || !Object.hasOwn(HEROES, kind)) return no('Cannot add this player.');
    const hero = makeHero(playerId, kind, state.players.length);
    state.heroes.push(hero);
    state.players.push({ id: playerId, heroId: hero.id, name: String(name).slice(0, 24), ready: false, connected: true });
    state.hostId ??= playerId;
    return { ok: true, playerId };
  }
  function setConnected(playerId, connected) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    player.connected = connected;
    player.ready = connected && player.ready;
    if (!connected) { const hero = heroOf(playerId); hero.interaction = null; hero.path = route(hero, { x: BASE.x, y: BASE.y + 65 }) ?? []; }
    if (!state.players.some(p => p.id === state.hostId && p.connected)) state.hostId = state.players.find(p => p.connected)?.id ?? state.hostId;
  }
  function removePlayer(playerId) {
    if (state.phase !== 'lobby') return setConnected(playerId, false);
    state.players = state.players.filter(p => p.id !== playerId);
    state.heroes = state.heroes.filter(h => h.playerId !== playerId);
    if (state.hostId === playerId) state.hostId = state.players.find(p => p.connected)?.id ?? null;
  }
  function gainXp(hero, amount) {
    hero.xp += amount;
    while (hero.level < 10 && hero.xp >= xpForLevel(hero.level)) {
      hero.xp -= xpForLevel(hero.level); hero.level++; hero.hp = Math.min(heroStats(hero).maxHp, hero.hp + 100);
      effect('level', hero, { color: '#ffe39a' });
    }
  }
  function rewardEnemy(enemy, source) {
    if (enemy.rewarded) return;
    enemy.rewarded = true;
    state.scrap += enemy.type === 'blackComet' ? 150 : 4;
    for (const hero of state.heroes) {
      if (hero.id === source?.id || (hero.alive && distance(hero, enemy) < 480)) { gainXp(hero, ENEMIES[enemy.type].xp); hero.marks += 3; }
    }
    if (source?.playerId) source.kills++;
    if (random(state) < 0.08 && state.drops.length < 12) state.drops.push({ id: id('drop'), x: enemy.x, y: enemy.y, item: random(state) < 0.65 ? 'hull-tonic' : 'repair-cell', remainingMs: 60000 });
    effect('death', enemy);
    if (enemy.type === 'blackComet') { state.bossDefeated = true; finish('victory'); }
  }
  function damageEnemy(enemy, amount, source, ability = false) {
    if (enemy.hp <= 0) return;
    if (enemy.type === 'blackComet' && !state.foundry.destroyed) amount *= 0.08;
    const damage = Math.min(enemy.hp, amount);
    enemy.hp -= damage;
    if (ability && source?.kind === 'singularity' && source.alive) source.hp = Math.min(heroStats(source).maxHp, source.hp + damage * 0.12);
    if (enemy.hp <= 0) rewardEnemy(enemy, source);
  }
  function damageHero(hero, damage) {
    if (!hero.alive || hero.shieldMs > 0) return;
    hero.hp = Math.max(0, hero.hp - damage * (1 - heroStats(hero).armor));
    if (hero.hp <= 0) { hero.alive = false; hero.downMs = 25000; hero.path = []; hero.interaction = null; effect('down', hero); }
  }
  function revive(hero, atBase = false) {
    hero.alive = true; hero.hp = heroStats(hero).maxHp * (atBase ? 0.75 : 0.55); hero.downMs = 0; hero.shieldMs = 3000;
    if (atBase) { hero.x = BASE.x; hero.y = BASE.y + 70; }
    effect('revive', hero);
  }
  function finish(phase) { state.phase = phase; state.summary = { timeMs: state.timeMs, wave: state.wave, kills: state.heroes.reduce((n, hero) => n + hero.kills, 0), baseHp: Math.ceil(state.base.hp) }; announce(phase === 'victory' ? 'The last train is away. Cinder Junction stands.' : 'The Junction has fallen. The rail goes dark.'); }
  function breakFoundry() {
    state.foundry.destroyed = true; state.foundry.hp = 0; state.scrap += 220; state.base.hp = Math.min(state.base.maxHp, state.base.hp + 350);
    state.spawnQueue = state.spawnQueue.filter(spawn => spawn.lane !== 0);
    for (const hero of state.heroes) { hero.marks += 45; gainXp(hero, 80); }
    effect('death', state.foundry); announce('Ash Foundry disabled. West reinforcements cut. The Comet has lost its shield.');
  }
  function spawn(type, lane, elite = false) {
    const def = ENEMIES[type], scale = scaling(state.players.length), point = SPAWNS[lane];
    const waveFactor = 1 + Math.max(0, state.wave - 1) * 0.11;
    const hp = Math.round(def.hp * scale.hp * (type === 'blackComet' ? 1 : waveFactor) * (elite ? 2 : 1));
    const enemy = { id: id('enemy'), type, x: point.x, y: point.y + (random(state) - 0.5) * 30, hp, maxHp: hp, damage: def.damage * scale.damage, speed: def.speed, range: def.range, interval: def.interval, attackMs: 400, path: [], repathMs: 0, slowMs: 0, effects: [], targetId: 'base', bossTimerMs: 7000, elite, rewarded: false };
    state.enemies.push(enemy); return enemy;
  }
  function beginWave() {
    state.wave++;
    const count = Math.round((12 + state.wave * 2) * scaling(state.players.length).count);
    const pool = state.wave < 3 ? ['dustMite', 'rustRunner'] : state.wave < 6 ? ['dustMite', 'rustRunner', 'tinbackHauler', 'sparkWagon'] : ['rustRunner', 'tinbackHauler', 'sparkWagon', 'riftLeech', 'siegeCrawler'];
    for (let i = 0; i < count; i++) {
      const lane = i % 3;
      if (lane === 0 && state.foundry.destroyed) continue;
      state.spawnQueue.push({ at: state.timeMs + i * (65000 / count), type: pool[Math.floor(random(state) * pool.length)], lane });
    }
    state.nextWaveMs += SIEGE_RULES.waveMs;
    for (const hero of state.heroes) { gainXp(hero, 14); hero.marks += 12; }
    announce(`Assault ${state.wave} / 10 · Hold the Junction.`);
    if (state.wave === 4) { state.event = { status: 'active', remainingMs: 55000, progressMs: 0 }; state.spawnQueue = []; announce('Capacitor storm! Reach the southern console and stabilize the grid. Incoming raids have stalled.'); }
    if (state.wave === 5) { state.foundry.open = true; announce('Push west into Ash Foundry. Destroy its engine to cut reinforcements and strip the final boss shield.'); }
  }
  const abilityHandlers = {
    field(hero, point, def) { state.fields.push({ id: id('field'), kind: 'gravity', ownerId: hero.id, ...point, radius: def.radius, remainingMs: def.duration, damage: def.damage + hero.level * 3, tickMs: 0 }); },
    burst(hero, point, def) { for (const enemy of state.enemies) if (sameRoom(enemy, point) && distance(enemy, point) <= def.radius) damageEnemy(enemy, def.damage + hero.level * 12, hero, true); if (state.foundry.open && !state.foundry.destroyed && distance(state.foundry, point) < def.radius) state.foundry.hp -= def.damage; },
    blink(hero, point) { hero.x = point.x; hero.y = point.y; hero.path = []; hero.interaction = null; hero.shieldMs = 800; },
    pulse(hero, point, def) { hero.tauntMs = 4000; for (const enemy of state.enemies) if (sameRoom(hero, enemy) && distance(hero, enemy) <= def.radius) damageEnemy(enemy, def.damage + hero.level * 10, hero, true); },
    haste(hero, point, def) { for (const ally of liveHeroes()) if (distance(hero, ally) <= def.radius) { ally.hasteMs = def.duration; ally.hp = Math.min(heroStats(ally).maxHp, ally.hp + 65); } for (const tower of state.towers) if (distance(hero, tower) <= def.radius) tower.hasteMs = def.duration; },
    tunnel(hero, point, def) { state.portals = state.portals.filter(p => p.ownerId !== hero.id); state.portals.push({ id: id('portal'), ownerId: hero.id, x: hero.x, y: hero.y, toX: point.x, toY: point.y, remainingMs: def.duration }); hero.tunnelMs = 1000; },
  };
  function cast(hero, action) {
    const def = ABILITIES[action.ability];
    if (!def || !HEROES[hero.kind].abilities.includes(action.ability)) return no('That ability belongs to another hero.');
    if (hero.level < def.unlock) return no(`Unlocks at level ${def.unlock}.`);
    if ((hero.cooldowns[action.ability] ?? 0) > 0) return no('Ability is recharging.');
    const point = def.range ? { x: action.x, y: action.y } : { x: hero.x, y: hero.y };
    if (!validPoint(point) || distance(hero, point) > def.range && def.range > 0) return no('Target is outside ability range.');
    if (def.range && (!sameRoom(hero, point) && def.kind !== 'tunnel')) return no('Target must be in your room.');
    if ((def.kind === 'blink' || def.kind === 'tunnel') && !route(hero, point)) return no('Target is unreachable.');
    abilityHandlers[def.kind](hero, point, def);
    hero.cooldowns[action.ability] = def.cooldown * heroStats(hero).cooldown;
    effect('cast', point, { color: def.color, radius: def.radius ?? 50, ability: action.ability });
    return ok();
  }
  function dispatch(action) {
    if (!action || typeof action !== 'object') return no('Invalid action.');
    const player = state.players.find(p => p.id === action.playerId);
    if (!player || !player.connected) return no('Unknown or disconnected player.');
    const hero = heroOf(player.id);
    if (state.phase === 'lobby') {
      if (action.type === 'select-hero') {
        if (typeof action.hero !== 'string' || !Object.hasOwn(HEROES, action.hero)) return no('Unknown hero.');
        state.heroes[state.heroes.indexOf(hero)] = makeHero(player.id, action.hero, state.players.indexOf(player)); player.ready = false; return ok();
      }
      if (action.type === 'ready') { player.ready = action.ready === true; return ok(); }
      if (action.type === 'start') {
        if (player.id !== state.hostId || !state.players.length || state.players.some(p => !p.ready || !p.connected)) return no('The host can start when everyone is ready and connected.');
        state.phase = 'playing'; const scale = scaling(state.players.length); state.foundry.hp = state.foundry.maxHp = Math.round(1100 * scale.hp); announce('Defend the Junction. Prepare a fortification; the first assault arrives in 18 seconds.'); return ok();
      }
      return no('Choose a hero and start the siege first.');
    }
    if (state.phase !== 'playing') return no('This siege has ended.');
    if (action.type === 'pause' || action.type === 'speed') {
      if (state.networked) return no('Co-op always runs at real time.');
      if (action.type === 'pause') state.settings.paused = !state.settings.paused;
      else if ([1, 2].includes(action.speed)) state.settings.speed = action.speed;
      else return no('Speed must be 1 or 2.');
      return ok();
    }
    if (!hero.alive) return no('Downed. Wait for rescue or reconstruction at the Junction.');
    if (action.type === 'move') {
      if (!validPoint(action)) return no('Choose a point on the deck.');
      const path = route(hero, action); if (!path) return no('No route to that point.');
      hero.path = path; hero.interaction = null; return ok();
    }
    if (action.type === 'cast') return cast(hero, action);
    if (action.type === 'equip-item' || action.type === 'use-item' || action.type === 'drop-item') {
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= 4) return no('Invalid inventory slot.');
      const item = hero.inventory[action.slot], def = ITEMS[item?.type];
      if (!def) return no('Empty slot.');
      if (action.type === 'drop-item') { state.drops.push({ id: id('drop'), x: hero.x, y: hero.y, item: item.type, remainingMs: 60000 }); hero.inventory[action.slot] = null; }
      else if (action.type === 'equip-item') { if (def.kind !== 'equipment') return no('That is a consumable.'); item.equipped = !item.equipped; }
      else {
        if (def.kind !== 'consumable') return no('Equip this item instead.');
        if (def.repair && distance(hero, state.base) > 170) return no('Bring the cell back to the Junction.');
        if (def.heal) hero.hp = Math.min(heroStats(hero).maxHp, hero.hp + def.heal);
        if (def.repair) state.base.hp = Math.min(state.base.maxHp, state.base.hp + def.repair);
        hero.inventory[action.slot] = null; effect('heal', hero);
      }
      hero.hp = Math.min(hero.hp, heroStats(hero).maxHp); return ok();
    }
    if (action.type === 'buy-item') {
      const def = Object.hasOwn(ITEMS, action.item ?? '') ? ITEMS[action.item] : null, slot = hero.inventory.indexOf(null);
      if (!def || slot < 0 || hero.marks < def.cost || distance(hero, state.base) > 210) return no('Shop at the Junction with enough Marks and a free slot.');
      hero.marks -= def.cost; hero.inventory[slot] = { type: action.item, equipped: false }; return ok();
    }
    if (action.type === 'build') {
      const def = Object.hasOwn(FORTIFICATIONS, action.fortification ?? '') ? FORTIFICATIONS[action.fortification] : null, pad = PADS.find(p => p.id === action.padId);
      if (!def || !pad || distance(hero, pad) > 320) return no('Move closer to a marked fortification pad.');
      if (state.towers.length >= SIEGE_RULES.fortificationCap || state.towers.some(t => t.padId === pad.id)) return no('No free team fortification permit or pad.');
      if (state.scrap < def.cost) return no('The team needs more Scrap.');
      // Validate everything before one synchronous reservation/spend. Server dispatches are serial.
      state.scrap -= def.cost;
      state.towers.push({ id: id('tower'), ownerId: player.id, padId: pad.id, kind: action.fortification, type: def.type, x: pad.x, y: pad.y, constructionMs: 5000, attackMs: 0, hasteMs: 0 });
      effect('build', pad); return ok();
    }
    if (action.type === 'interact' || action.type === 'revive') {
      const target = action.type === 'revive' ? state.heroes.find(h => h.id === action.targetId && !h.alive) : action.targetId === 'capacitor' && state.event.status === 'active' ? EVENT_SITE : state.drops.find(d => d.id === action.targetId);
      if (!target) return no('No active interaction here.');
      if (action.type === 'revive' && target.id === hero.id) return no('An ally must revive you.');
      const path = route(hero, target); if (!path) return no('No route to the interaction.');
      if (target.item && !hero.inventory.includes(null)) return no('Inventory full. Use or drop an item.');
      hero.path = path; hero.interaction = { type: action.type, targetId: action.targetId, progressMs: 0 }; return ok();
    }
    return no('Unknown player action.');
  }
  function updateHero(hero, dt) {
    for (const key of Object.keys(hero.cooldowns)) hero.cooldowns[key] = Math.max(0, hero.cooldowns[key] - dt);
    for (const key of ['shieldMs', 'hasteMs', 'tauntMs', 'tunnelMs']) hero[key] = Math.max(0, hero[key] - dt);
    if (!hero.alive) { hero.downMs -= dt; if (hero.downMs <= 0) revive(hero, true); return; }
    const stats = heroStats(hero);
    walk(hero, stats.speed, dt);
    if (distance(hero, state.base) < 160) hero.hp = Math.min(stats.maxHp, hero.hp + 9 * dt / 1000);
    for (const ally of liveHeroes()) if (ally.kind === 'bastion' && distance(hero, ally) < 170) { hero.hp = Math.min(stats.maxHp, hero.hp + 3 * dt / 1000); break; }
    if (hero.tunnelMs === 0) for (const portal of state.portals) if (distance(hero, portal) < 28) { hero.x = portal.toX; hero.y = portal.toY; hero.path = []; hero.interaction = null; hero.tunnelMs = 1600; break; }
    if (hero.interaction) {
      const interaction = hero.interaction;
      const target = interaction.type === 'revive' ? state.heroes.find(h => h.id === interaction.targetId && !h.alive) : interaction.targetId === 'capacitor' && state.event.status === 'active' ? EVENT_SITE : state.drops.find(d => d.id === interaction.targetId);
      if (!target) hero.interaction = null;
      else if (distance(hero, target) <= 65) {
        hero.path = []; interaction.progressMs += dt;
        if (target.item) { const slot = hero.inventory.indexOf(null); if (slot >= 0) { hero.inventory[slot] = { type: target.item, equipped: false }; state.drops = state.drops.filter(d => d !== target); } hero.interaction = null; }
        else if (interaction.type === 'revive' && interaction.progressMs >= 3000) { revive(target); hero.interaction = null; }
        else if (interaction.targetId === 'capacitor') {
          state.event.progressMs = Math.max(state.event.progressMs, interaction.progressMs);
          if (interaction.progressMs >= 5000) { state.event.status = 'secured'; state.base.hp = Math.min(state.base.maxHp, state.base.hp + 500); state.scrap += 100; for (const ally of state.heroes) { ally.marks += 50; gainXp(ally, 50); } hero.interaction = null; announce('Grid stabilized. The crew recovered supplies. Prepare to push west.'); }
        }
      }
    }
    hero.attackMs -= dt * (hero.hasteMs > 0 ? 1.65 : 1);
    if (hero.attackMs > 0) return;
    const enemies = state.enemies.filter(e => e.hp > 0 && sameRoom(hero, e) && distance(hero, e) <= stats.range);
    enemies.sort((a, b) => distance(hero, a) - distance(hero, b));
    const enemy = enemies[0];
    if (enemy) { damageEnemy(enemy, stats.damage, hero); effect('shot', hero, { targetX: enemy.x, targetY: enemy.y, color: HEROES[hero.kind].color }); hero.attackMs = stats.interval; }
    else if (state.foundry.open && !state.foundry.destroyed && distance(hero, state.foundry) < stats.range) { state.foundry.hp -= stats.damage; hero.attackMs = stats.interval; effect('shot', hero, { targetX: state.foundry.x, targetY: state.foundry.y, color: HEROES[hero.kind].color }); }
  }
  function updateEnemy(enemy, dt) {
    if (enemy.hp <= 0) return;
    const candidates = liveHeroes().filter(h => sameRoom(enemy, h) && distance(enemy, h) < (h.tauntMs > 0 ? 330 : 210));
    candidates.sort((a, b) => (b.tauntMs > 0) - (a.tauntMs > 0) || distance(enemy, a) - distance(enemy, b));
    const target = candidates[0] ?? state.base;
    const targetId = target.id ?? 'base';
    enemy.repathMs -= dt; enemy.slowMs = Math.max(0, enemy.slowMs - dt);
    enemy.effects = enemy.slowMs > 0 ? [{ type: 'slow' }] : [];
    if (enemy.targetId !== targetId || enemy.repathMs <= 0) { enemy.targetId = targetId; enemy.path = route(enemy, target) ?? []; enemy.repathMs = 1200; }
    if (distance(enemy, target) > enemy.range || !sameRoom(enemy, target)) walk(enemy, enemy.speed * (enemy.slowMs > 0 ? 0.45 : 1), dt);
    enemy.attackMs -= dt;
    if (sameRoom(enemy, target) && distance(enemy, target) <= enemy.range && enemy.attackMs <= 0) {
      if (target.id) damageHero(target, enemy.damage); else state.base.hp = Math.max(0, state.base.hp - enemy.damage);
      effect('shot', enemy, { targetX: target.x, targetY: target.y, color: '#ff8465' }); enemy.attackMs = enemy.interval;
    }
    if (enemy.type === 'riftLeech') enemy.hp = Math.min(enemy.maxHp, enemy.hp + dt * 0.002);
    if (enemy.type === 'blackComet') {
      enemy.bossTimerMs -= dt;
      if (enemy.bossTimerMs <= 0) {
        const mark = candidates[0] ?? state.base;
        state.fields.push({ id: id('warning'), kind: 'warning', x: mark.x, y: mark.y, radius: 125, remainingMs: 2600, damage: 130 });
        enemy.bossTimerMs = 7500;
      }
    }
  }
  function tick(dt) {
    state.tick++; state.timeMs += dt;
    state.effects = state.effects.filter(f => (f.remainingMs -= dt) > 0);
    state.drops = state.drops.filter(f => (f.remainingMs -= dt) > 0);
    state.portals = state.portals.filter(f => (f.remainingMs -= dt) > 0);
    if (state.wave < 10 && state.timeMs >= state.nextWaveMs) beginWave();
    if (state.timeMs >= SIEGE_RULES.bossAtMs && !state.bossSpawned) { spawn('blackComet', 2); state.bossSpawned = true; announce('THE BLACK COMET · Move out of the red impact circles. Destroy the Ash Foundry to break its shield.'); }
    while (state.spawnQueue.length && state.spawnQueue[0].at <= state.timeMs) { const next = state.spawnQueue.shift(); if (state.enemies.length < 160) spawn(next.type, next.lane); }
    if (state.event.status === 'active') {
      state.event.remainingMs -= dt;
      if (state.event.remainingMs <= 0) { state.event.status = 'failed'; state.base.hp -= 320; spawn('siegeCrawler', 1, true); announce('Grid overload. An elite crawler has breached the eastern rail.'); }
    }
    for (const hero of state.heroes) { updateHero(hero, dt); if (state.phase !== 'playing') return; }
    for (const field of state.fields) {
      field.remainingMs -= dt;
      if (field.kind === 'gravity') {
        field.tickMs -= dt;
        if (field.tickMs <= 0) { const owner = state.heroes.find(h => h.id === field.ownerId); for (const enemy of state.enemies) if (sameRoom(enemy, field) && distance(enemy, field) <= field.radius) {
          enemy.slowMs = 700; damageEnemy(enemy, field.damage * 0.3, owner, true);
          const d = distance(enemy, field); if (d > 20) { enemy.x += (field.x - enemy.x) * 0.08; enemy.y += (field.y - enemy.y) * 0.08; enemy.repathMs = 0; }
        } field.tickMs = 300; }
      } else if (field.kind === 'warning' && field.remainingMs <= 0) { for (const hero of liveHeroes()) if (distance(hero, field) < field.radius) damageHero(hero, field.damage); if (distance(state.base, field) < field.radius) state.base.hp -= 95; effect('impact', field, { radius: field.radius, color: '#ff6549' }); }
    }
    state.fields = state.fields.filter(f => f.remainingMs > 0);
    if (state.phase !== 'playing') return;
    if (state.foundry.hp <= 0 && !state.foundry.destroyed) breakFoundry();
    for (const tower of state.towers) {
      tower.constructionMs = Math.max(0, tower.constructionMs - dt); tower.hasteMs = Math.max(0, tower.hasteMs - dt);
      if (tower.constructionMs > 0) continue;
      const def = FORTIFICATIONS[tower.kind]; tower.attackMs -= dt * (tower.hasteMs > 0 ? 1.65 : 1);
      if (tower.attackMs > 0) continue;
      if (def.heal) { for (const hero of liveHeroes()) if (distance(hero, tower) < def.range) hero.hp = Math.min(heroStats(hero).maxHp, hero.hp + def.heal); state.base.hp = Math.min(state.base.maxHp, state.base.hp + 2); }
      else { const enemy = state.enemies.find(e => e.hp > 0 && distance(e, tower) < def.range && sameRoom(e, tower)); if (enemy) { damageEnemy(enemy, def.damage); if (def.slow) enemy.slowMs = 2000; effect('shot', tower, { targetX: enemy.x, targetY: enemy.y, color: def.slow ? '#7ce3ff' : '#ffd093' }); } }
      tower.attackMs = def.interval;
      if (state.phase !== 'playing') return;
    }
    for (const enemy of state.enemies) updateEnemy(enemy, dt);
    state.enemies = state.enemies.filter(e => e.hp > 0);
    if (state.timeMs > SIEGE_RULES.deadlineMs) state.base.hp -= dt * 0.1;
    state.base.hp = Math.max(0, state.base.hp);
    if (state.base.hp <= 0 && state.phase === 'playing') finish('defeat');
  }
  function update(deltaMs) {
    if (state.phase !== 'playing' || state.settings.paused) return;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    state.accumulatorMs += Math.min(deltaMs, 1000) * (state.networked ? 1 : state.settings.speed);
    while (state.accumulatorMs >= SIEGE_RULES.stepMs && state.phase === 'playing') { state.accumulatorMs -= SIEGE_RULES.stepMs; tick(SIEGE_RULES.stepMs); }
  }
  return { state, map: SIEGE_MAP, dispatch, update, addPlayer, removePlayer, setConnected, heroOf, snapshot: () => structuredClone(state) };
}
