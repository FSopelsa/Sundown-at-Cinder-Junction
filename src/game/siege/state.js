import { HEROES, ITEMS, BASE, FOUNDRY, SIEGE_RULES } from './content.js';

export function heroStats(hero) {
  const kit = HEROES[hero.kind];
  const items = hero.inventory.filter(item => item?.equipped).map(item => ITEMS[item.type]);
  const sum = key => items.reduce((total, item) => total + (item[key] ?? 0), 0);
  return { maxHp: kit.hp + (hero.level - 1) * 42 + sum('hp'), damage: kit.damage + (hero.level - 1) * 7 + sum('damage'), speed: kit.speed + sum('speed'), armor: Math.min(0.65, kit.armor + sum('armor')), cooldown: items.reduce((n, item) => n * (item.cooldown ?? 1), 1), range: kit.range, interval: kit.interval };
}
export function makeHero(playerId, kind, slot = 0) {
  return { id: `hero-${playerId}`, playerId, kind, x: BASE.x - 80 + slot * 45, y: BASE.y + 60, hp: HEROES[kind].hp, level: 1, xp: 0, marks: 90, alive: true, downMs: 0, attackMs: 0, shieldMs: 0, hasteMs: 0, tauntMs: 0, tunnelMs: 0, cooldowns: {}, inventory: [{ type: 'hull-tonic', equipped: false }, null, null, null], path: [], interaction: null, kills: 0 };
}
export function createSiegeState({ seed = 91337, networked = false } = {}) {
  return { mode: 'cinder-siege', schemaVersion: 1, seed: seed >>> 0, rng: seed >>> 0, networked, phase: 'lobby', players: [], heroes: [], hostId: null, tick: 0, timeMs: 0, accumulatorMs: 0, nextId: 1, settings: { paused: false, speed: 1 }, scrap: 420, base: { ...BASE, hp: 2600, maxHp: 2600 }, foundry: { ...FOUNDRY, hp: 1100, maxHp: 1100, open: false, destroyed: false }, wave: 0, nextWaveMs: 18000, spawnQueue: [], enemies: [], towers: [], fields: [], drops: [], portals: [], effects: [], event: { status: 'waiting', remainingMs: 0, progressMs: 0 }, bossSpawned: false, bossDefeated: false, message: 'Choose your Marshal. The last train is waiting.', summary: null };
}
export function restoreSiegeState(snapshot) {
  if (snapshot?.mode !== 'cinder-siege' || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.players) || !Array.isArray(snapshot.heroes) || snapshot.players.length > SIEGE_RULES.maxPlayers) throw new Error('Unsupported siege save.');
  const state = structuredClone(snapshot);
  if (state.heroes.length !== state.players.length || state.players.some(player => !state.heroes.some(hero => hero.id === player.heroId && hero.playerId === player.id && HEROES[hero.kind] && hero.inventory.length === 4))) throw new Error('Invalid siege roster.');
  return state;
}
// Seeded gameplay RNG; its cursor is part of every checkpoint and snapshot.
export function random(state) { state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0; return state.rng / 4294967296; }
