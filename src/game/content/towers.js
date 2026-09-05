import { ASSET_KEYS } from '../assets/manifest.js';

export const TOWER_DEFINITIONS = Object.freeze({
  peacemaker: Object.freeze({
    id: 'peacemaker',
    name: 'Peacemaker Turret',
    cost: 40,
    range: 156,
    damage: 12,
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
    damage: 8,
    shotsPerSecond: 2.5,
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
    damage: 32,
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
});
