import { ASSET_KEYS } from '../assets/manifest.js';

export const MAX_TOWER_LEVEL = 3;
export const UPGRADE_MULTIPLIER = 1.5;
export const TOWER_SELL_RATE = 0.8;
export const SCRAP_EXCHANGE_AURA_BASE_RANGE = 180;
export const SCRAP_EXCHANGE_AURA_RANGE_STEP = 90;
export const SCRAP_EXCHANGE_AURA_MAX_RANGE = 360;
export const SCRAP_EXCHANGE_AURA_MAX_LEVEL = 3;

export function getUpgradeCost(tower, definition = TOWER_DEFINITIONS[tower.type]) {
  return tower.level >= MAX_TOWER_LEVEL ? null : Math.ceil(definition.cost * tower.level * 0.75);
}

export function getAuraRangeUpgradeCost(tower, definition = TOWER_DEFINITIONS[tower.type]) {
  const auraLevel = Math.max(1, Number.isInteger(tower.auraLevel) ? tower.auraLevel : 1);
  if (auraLevel >= SCRAP_EXCHANGE_AURA_MAX_LEVEL || !definition) return null;
  return Math.ceil(definition.cost * auraLevel * 0.75);
}

// New towers keep the exact amount paid so a sell value is unambiguous. Older
// saves do not have that field, so reconstruct it from the fixed upgrade curve.
export function getTowerInvestment(tower, definition = TOWER_DEFINITIONS[tower.type]) {
  if (Number.isFinite(tower.investedScrap)) {
    return Math.max(0, tower.investedScrap);
  }

  let invested = definition?.cost ?? 0;
  const level = Math.max(1, Number.isInteger(tower.level) ? tower.level : 1);
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    invested += Math.ceil((definition?.cost ?? 0) * currentLevel * 0.75);
  }
  return invested;
}

export function getTowerSellValue(tower, definition = TOWER_DEFINITIONS[tower.type]) {
  return Math.floor(getTowerInvestment(tower, definition) * TOWER_SELL_RATE);
}

export const TOWER_DEFINITIONS = Object.freeze({
  peacemaker: Object.freeze({
    id: 'peacemaker',
    name: 'Peacemaker Turret',
    cost: 40,
    range: 156,
    damage: 8,
    shotsPerSecond: 1.5,
    damageType: 'neutral',
    assetKey: ASSET_KEYS.towers.peacemaker,
    description: 'Reliable neutral repeater for holding the first line.',
  }),
  sunspitter: Object.freeze({
    id: 'sunspitter',
    name: 'Sunspitter',
    cost: 90,
    range: 142,
    damage: 5,
    shotsPerSecond: 2,
    damageType: 'solar',
    assetKey: ASSET_KEYS.towers.sunspitter,
    effect: Object.freeze({
      type: 'burn',
      magnitude: 8,
      durationMs: 2200,
      tickEveryMs: 500,
    }),
    description: 'Rapid solar fire burns targets and suppresses Rift Leech regeneration.',
  }),
  coldIronLongshot: Object.freeze({
    id: 'coldIronLongshot',
    name: 'Cold-Iron Longshot',
    cost: 99,
    range: 290,
    damage: 12,
    shotsPerSecond: 0.42,
    damageType: 'cryo',
    assetKey: ASSET_KEYS.towers.coldIronLongshot,
    effect: Object.freeze({
      type: 'slow',
      magnitude: 0.75,
      durationMs: 1800,
    }),
    description: 'Long-range cryo shots hit hard and slow priority targets.',
  }),
  teslaCoil: Object.freeze({
    id: 'teslaCoil',
    name: 'Tesla Coil',
    cost: 115,
    range: 165,
    damage: 18,
    shotsPerSecond: 0.9,
    damageType: 'arc',
    assetKey: ASSET_KEYS.towers.teslaCoil,
    chain: Object.freeze({ maxTargets: 4, jumpRange: 110, damageMultiplier: 0.72 }),
    description: 'Arc lightning chains to 4 enemies, losing 28% damage per jump. Deals double damage to shields.',
  }),
  scrapExchange: Object.freeze({
    id: 'scrapExchange', name: 'Scrap Exchange', cost: 100, range: 100,
    damage: 0, shotsPerSecond: 0, damageType: 'neutral',
    assetKey: ASSET_KEYS.towers.scrapExchange,
    auraRange: SCRAP_EXCHANGE_AURA_BASE_RANGE,
    description: '600 hull. Taunts enemies within 100 range; they stop and bombard it. Sells recovery, XP and a relay aura.',
  }),
  wall: Object.freeze({
    id: 'wall',
    name: 'Defensive Wall',
    cost: 4,
    range: 0,
    damage: 0,
    shotsPerSecond: 0,
    damageType: 'neutral',
    assetKey: ASSET_KEYS.towers.wall,
    description: 'A sturdy wall to block enemy advances.',
  })
});
