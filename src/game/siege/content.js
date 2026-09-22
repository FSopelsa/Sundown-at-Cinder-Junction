import { MODEL_KEYS } from '../assets/manifest.js';

export const SIEGE_RULES = Object.freeze({ stepMs: 50, maxPlayers: 4, inventorySlots: 4, fortificationCap: 3, waveMs: 90000, bossAtMs: 900000, deadlineMs: 1200000 });
export const HEROES = Object.freeze({
  singularity: { name: 'Singularity', role: 'Rift controller', description: 'Gather the swarm. Tear it apart. Slip through the gap.', trait: 'Event horizon: ability damage restores 12% hull.', color: '#ae91ff', model: MODEL_KEYS.units, node: 'Unit_Hero', scale: 1.2, hp: 320, damage: 27, range: 180, speed: 220, armor: 0.08, interval: 650, abilities: ['gravity-well', 'void-rend', 'quantum-blink'] },
  bastion: { name: 'Bastion', role: 'Relay guardian', description: 'A reclaimed sentinel. Hold the line and bring your crew home.', trait: 'Iron heart: 25% damage resistance; nearby allies regenerate 3 hull/s.', color: '#60e1c5', model: MODEL_KEYS.productionReserve, node: 'Prop_TechSquidSentinel', scale: 0.75, hp: 510, damage: 34, range: 110, speed: 190, armor: 0.25, interval: 800, abilities: ['cinder-pulse', 'time-dilation', 'worm-tunnel'] },
});
export const ABILITIES = Object.freeze({
  'gravity-well': { name: 'Gravity Well', glyph: '◎', kind: 'field', color: '#aa80ff', cooldown: 12000, range: 320, radius: 110, duration: 4800, damage: 27, unlock: 1, description: 'Pull, slow and drain a cluster for 4.8s.' },
  'void-rend': { name: 'Void Rend', glyph: '⟐', kind: 'burst', color: '#e3a4ff', cooldown: 8500, range: 300, radius: 75, damage: 135, unlock: 2, description: 'Rupture a small area for heavy damage.' },
  'quantum-blink': { name: 'Quantum Blink', glyph: '↯', kind: 'blink', color: '#b9a4ff', cooldown: 7000, range: 260, unlock: 3, description: 'Blink within a reachable room; briefly gain a shield.' },
  'cinder-pulse': { name: 'Cinder Pulse', glyph: '✹', kind: 'pulse', color: '#ffb95e', cooldown: 9000, range: 0, radius: 145, damage: 105, unlock: 1, description: 'Blast nearby enemies and draw their fire for 4s.' },
  'time-dilation': { name: 'Time Dilation', glyph: '◷', kind: 'haste', color: '#66e0ca', cooldown: 16000, range: 0, radius: 240, duration: 6500, unlock: 2, description: 'Accelerate nearby heroes and fortifications; repair allies.' },
  'worm-tunnel': { name: 'Worm Tunnel', glyph: '⇥', kind: 'tunnel', color: '#5adcd5', cooldown: 24000, range: 440, duration: 9000, unlock: 3, description: 'Open a one-way team escape. Walk into its entrance to travel.' },
});
export const ITEMS = Object.freeze({
  'iron-plate': { name: 'Ironheart plate', glyph: '⬡', kind: 'equipment', cost: 55, hp: 120, armor: 0.08, description: '+120 hull, +8% resistance.' },
  'arc-coil': { name: 'Arc cartridge', glyph: 'ϟ', kind: 'equipment', cost: 55, damage: 16, description: '+16 attack damage.' },
  'chrono-gear': { name: 'Chrono regulator', glyph: '◷', kind: 'equipment', cost: 65, cooldown: 0.8, description: '20% shorter ability cooldowns.' },
  'trail-boots': { name: 'Railrunner boots', glyph: '»', kind: 'equipment', cost: 45, speed: 65, description: '+65 movement speed.' },
  'hull-tonic': { name: 'Hull tonic', glyph: '+', kind: 'consumable', cost: 15, heal: 240, description: 'Restore 240 hull to yourself.' },
  'repair-cell': { name: 'Reactor cell', glyph: '▣', kind: 'consumable', cost: 30, repair: 300, description: 'Near the Junction: repair 300 base hull.' },
});
export const FORTIFICATIONS = Object.freeze({
  repeater: { name: 'Rail repeater', type: 'peacemaker', cost: 300, damage: 18, range: 220, interval: 1050, description: 'Supporting fire. Heroes do the heavy lifting.' },
  frost: { name: 'Cold-iron snare', type: 'coldIronLongshot', cost: 320, damage: 9, range: 250, interval: 1250, slow: true, description: 'Slows enemies at a choke point.' },
  relay: { name: 'Mender relay', type: 'scrapExchange', cost: 360, damage: 0, range: 230, interval: 1000, heal: 7, description: 'Restores nearby heroes and repairs the reactor.' },
});

const room = (id, name, x, y, columns, rows) => ({ id, name, grid: { x, y, columns, rows, cellSize: 40 }, obstacles: [] });
const rooms = [room('junction', 'Cinder Junction', 560, 480, 18, 16), room('foundry', 'Ash Foundry', 0, 560, 14, 12), room('rail', 'Broken Rail', 1280, 560, 14, 12), room('crown', 'Comet Approach', 720, 0, 10, 12)];
const connections = [];
for (let i = 0; i < 4; i++) {
  connections.push({ id: `west-${i}`, from: { roomId: 'foundry', col: 13, row: 4 + i }, to: { roomId: 'junction', col: 0, row: 6 + i }, initiallyOpen: true });
  connections.push({ id: `east-${i}`, from: { roomId: 'junction', col: 17, row: 6 + i }, to: { roomId: 'rail', col: 0, row: 4 + i }, initiallyOpen: true });
  connections.push({ id: `north-${i}`, from: { roomId: 'crown', col: 3 + i, row: 11 }, to: { roomId: 'junction', col: 7 + i, row: 0 }, initiallyOpen: true });
}
export const SIEGE_MAP = Object.freeze({ id: 'cinder-siege', name: 'The Last Departure', mode: 'rooms', rooms, roomConnections: connections, width: 1840, height: 1120 });
export const BASE = Object.freeze({ x: 920, y: 900 });
export const FOUNDRY = Object.freeze({ x: 180, y: 780 });
export const EVENT_SITE = Object.freeze({ x: 920, y: 1040 });
export const PADS = Object.freeze([{ id: 'west', x: 660, y: 740 }, { id: 'east', x: 1180, y: 740 }, { id: 'north', x: 940, y: 580 }]);
export const SPAWNS = Object.freeze([{ x: 60, y: 780 }, { x: 1780, y: 780 }, { x: 920, y: 60 }]);
export const ENEMIES = Object.freeze({
  dustMite: { hp: 65, damage: 6, speed: 50, range: 35, interval: 1100, xp: 7 },
  rustRunner: { hp: 110, damage: 10, speed: 75, range: 40, interval: 1000, xp: 10 },
  tinbackHauler: { hp: 270, damage: 16, speed: 35, range: 45, interval: 1400, xp: 18 },
  sparkWagon: { hp: 170, damage: 12, speed: 45, range: 150, interval: 1400, xp: 14 },
  riftLeech: { hp: 150, damage: 11, speed: 57, range: 45, interval: 1000, xp: 13 },
  siegeCrawler: { hp: 340, damage: 24, speed: 32, range: 190, interval: 2100, xp: 24 },
  blackComet: { hp: 6000, damage: 35, speed: 24, range: 140, interval: 1500, xp: 250 },
});
export function scaling(count) { const n = Math.max(1, Math.min(4, count)); return { count: 1 + (n - 1) * 0.55, hp: 1 + (n - 1) * 0.38, damage: 1 + (n - 1) * 0.12 }; }
export const xpForLevel = level => 35 + (level - 1) * 25;
