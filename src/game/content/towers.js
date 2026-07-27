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
  }),
});
