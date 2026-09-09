import { SCRAP_EXCHANGE_AURA_BASE_RANGE } from '../../content/towers.js';

// Shop effects belong to simulation state and survive serialization.
export const SUPPORT_ITEMS = Object.freeze({
  heal: { label: 'Restore hero hull', cost: 30 },
  buff: { label: 'Aegis · half incoming damage for 15s', cost: 45 },
  aura: { label: 'Relay aura · nearby towers +20% speed', cost: 80 },
  buyback: { label: 'Revive hero now', cost: 100 },
  xp: { label: 'Training · 25 XP', cost: 50 },
  repair: { label: 'Restore Exchange hull', cost: 35 },
});
export function purchaseSupport(state, economy, heroes, towerId, item) {
  const tower = state.towers.find(t => t.id === towerId && t.type === 'scrapExchange' && t.hp > 0);
  const offer = SUPPORT_ITEMS[item];
  const hero = state.hero;
  const fail = reason => ({ ok: false, reason });
  if (!tower || !offer || state.stationIntegrity <= 0) return fail('Select an operational Scrap Exchange.');
  if (item === 'aura' && tower.aura) return fail('This Exchange already has a relay aura.');
  if (item === 'repair' && tower.hp >= tower.maxHp) return fail('Exchange hull is already full.');
  if (item === 'buyback' ? hero.alive : ['heal','buff','xp'].includes(item) && !hero.alive) return fail(item === 'buyback' ? 'Your hero is already alive.' : 'Revive your hero first.');
  if (item === 'heal' && hero.hp >= hero.maxHp) return fail('Hero hull is already full.');
  if (item === 'buff' && hero.aegisRemainingMs > 0) return fail('Aegis is already active.');
  if (item === 'xp' && hero.experienceToNext === null) return fail('Hero is at maximum level.');
  const cost = offer.cost * (item === 'buyback' ? hero.level : item === 'xp' ? 1 + (hero.trainingPurchases ?? 0) : 1);
  if (!economy.spendScrap(cost)) return fail(`Requires ${cost} Scrap.`);
  if (item === 'heal') hero.hp = hero.maxHp;
  if (item === 'buff') hero.aegisRemainingMs = 15000;
  if (item === 'buyback') heroes.reviveForNextWave();
  if (item === 'xp') { heroes.awardExperience(25); hero.trainingPurchases = (hero.trainingPurchases ?? 0) + 1; }
  if (item === 'repair') tower.hp = tower.maxHp;
  if (item === 'aura') {
    tower.aura = true;
    tower.auraLevel = 1;
    tower.auraRange = SCRAP_EXCHANGE_AURA_BASE_RANGE;
    tower.investedScrap += cost;
  }
  return { ok: true, cost, message: `${offer.label} purchased.` };
}
