import { ASSET_KEYS } from '../assets/manifest.js';

export const HERO_DEFINITION = Object.freeze({
  id: 'circuit-marshal',
  name: 'Singularity',
  assetKey: ASSET_KEYS.heroes.circuitMarshal,
  maxLevel: 10,
  baseMaxHp: 280,
  baseDamage: 15,
  hpGrowthPerLevel: 0.16,
  damageGrowthPerLevel: 0.18,
  damageAccelerationPerLevel: 0.01,
  moveSpeed: 180,
  attackRange: 120,
  attackIntervalMs: 500,
  experienceRadius: 70,
  firstLevelExperience: 25,
  levelExperienceGrowth: 1.35,
  collisionRadius: 16,
});

// The multi-skill experiment remains serialized and tested, but is deliberately
// not exposed to players while the tower, bounty, and room loops are developed.
// Keeping this switch at the UI boundary makes a later return reversible without
// invalidating saves or deleting the experimental implementation.
export const HERO_ABILITY_PROTOTYPES_ENABLED = false;

export function isHeroSkillPlayerVisible(skillId) {
  return HERO_ABILITY_PROTOTYPES_ENABLED || skillId === 'worm-tunnel';
}

export const HERO_SKILLS = Object.freeze([
  Object.freeze({
    id: 'gravity-well',
    label: 'Gravity Well',
    unlockLevel: 1,
    target: 'ground',
    cooldownMs: 12000,
    range: 280,
    durationMs: 4800,
    tickEveryMs: 300,
    damagePerTick: 8,
    slowMagnitude: 0.48,
    baseRadius: 54,
    maxRadius: 118,
    radiusPerStolenHp: 0.22,
    lifeStealRatio: 0.4,
    description: 'Toss a growing black hole that slows nearby enemies and steals hull.',
  }),
  Object.freeze({
    id: 'time-dilation',
    label: 'Time Dilation',
    unlockLevel: 2,
    target: 'instant',
    cooldownMs: 16000,
    durationMs: 6500,
    attackSpeedMultiplier: 1.65,
    description: 'Accelerate every deployed tower for a short time.',
  }),
  Object.freeze({
    id: 'void-rend',
    label: 'Void Rend',
    unlockLevel: 3,
    target: 'enemy',
    cooldownMs: 9500,
    range: 270,
    durationMs: 4200,
    tickEveryMs: 500,
    damagePerTick: 10,
    description: 'Mark a hostile with a tearing singularity damage-over-time effect.',
  }),
  Object.freeze({
    id: 'quantum-blink',
    label: 'Quantum Blink',
    unlockLevel: 4,
    target: 'ground',
    cooldownMs: 9000,
    range: 270,
    description: 'Teleport Singularity to an empty reachable cell.',
  }),
  Object.freeze({
    id: 'worm-tunnel',
    label: 'Worm Tunnel',
    unlockLevel: 6,
    target: 'ground',
    cooldownMs: 24000,
    scrapCost: 75,
    durationMs: 5000,
    durationUpgradeMs: 2500,
    maxUpgradeLevel: 2,
    upgradeCost: 50,
    minimumDistance: 80,
    description: 'Spend 75 Scrap to link a five-second one-way tunnel. The first endpoint is the entrance.',
  }),
]);

// Retain the previous export name for saved/UI consumers while the slots now
// represent concrete hero abilities rather than empty future placeholders.
export const HERO_SKILL_SLOTS = HERO_SKILLS;

export function getHeroSkill(skillId) {
  return HERO_SKILLS.find((skill) => skill.id === skillId) ?? null;
}

function normalizedLevel(level) {
  return Math.min(
    HERO_DEFINITION.maxLevel,
    Math.max(1, Number.isInteger(level) ? level : 1),
  );
}

export function getHeroStats(level) {
  const normalized = normalizedLevel(level);
  const levelsGained = normalized - 1;

  return {
    maxHp: Math.round(
      HERO_DEFINITION.baseMaxHp * (1 + HERO_DEFINITION.hpGrowthPerLevel * levelsGained),
    ),
    damage: Math.round(
      HERO_DEFINITION.baseDamage * (
        1 +
        HERO_DEFINITION.damageGrowthPerLevel * levelsGained +
        HERO_DEFINITION.damageAccelerationPerLevel * levelsGained ** 2
      ),
    ),
  };
}

export function getExperienceToNextHeroLevel(level) {
  if (normalizedLevel(level) >= HERO_DEFINITION.maxLevel) {
    return null;
  }

  return Math.round(
    HERO_DEFINITION.firstLevelExperience *
      HERO_DEFINITION.levelExperienceGrowth ** (normalizedLevel(level) - 1),
  );
}

export function createHeroSkillSlots(level, savedSlots = []) {
  return HERO_SKILLS.map((slot) => {
    const saved = savedSlots.find((candidate) => candidate?.id === slot.id);
    return {
      ...slot,
      unlocked: normalizedLevel(level) >= slot.unlockLevel,
      selection: saved?.selection ?? null,
      upgradeLevel: Math.min(
        slot.maxUpgradeLevel ?? 0,
        Math.max(0, Number.isInteger(saved?.upgradeLevel) ? saved.upgradeLevel : 0),
      ),
      cooldownRemainingMs: Math.max(
        0,
        Number.isFinite(saved?.cooldownRemainingMs) ? saved.cooldownRemainingMs : 0,
      ),
    };
  });
}

export function getHeroExperienceAward(enemy, heroGotKill) {
  return heroGotKill ? enemy.heroKillXp : enemy.nearbyXp;
}

export function createHeroState(map, snapshot = {}) {
  const level = normalizedLevel(snapshot.level);
  const stats = getHeroStats(level);
  const alive = snapshot.alive !== false;
  const x = Number.isFinite(snapshot.x) ? snapshot.x : map.heroSpawn.x;
  const y = Number.isFinite(snapshot.y) ? snapshot.y : map.heroSpawn.y;

  return {
    id: HERO_DEFINITION.id,
    name: HERO_DEFINITION.name,
    assetKey: HERO_DEFINITION.assetKey,
    x,
    y,
    level,
    experience: Math.max(0, Number.isFinite(snapshot.experience) ? snapshot.experience : 0),
    experienceToNext: getExperienceToNextHeroLevel(level),
    maxHp: stats.maxHp,
    hp: alive
      ? Math.min(stats.maxHp, Math.max(0, Number.isFinite(snapshot.hp) ? snapshot.hp : stats.maxHp))
      : 0,
    damage: stats.damage,
    moveSpeed: HERO_DEFINITION.moveSpeed,
    attackRange: HERO_DEFINITION.attackRange,
    attackIntervalMs: HERO_DEFINITION.attackIntervalMs,
    attackCooldownMs: Math.max(0, Number.isFinite(snapshot.attackCooldownMs) ? snapshot.attackCooldownMs : 0),
    experienceRadius: HERO_DEFINITION.experienceRadius,
    collisionRadius: HERO_DEFINITION.collisionRadius,
    alive,
    deathWave: Number.isInteger(snapshot.deathWave) ? snapshot.deathWave : null,
    aegisRemainingMs: Math.max(
      0,
      Number.isFinite(snapshot.aegisRemainingMs) ? snapshot.aegisRemainingMs : 0,
    ),
    speedBoostRemainingMs: Math.max(
      0,
      Number.isFinite(snapshot.speedBoostRemainingMs) ? snapshot.speedBoostRemainingMs : 0,
    ),
    speedBoostMultiplier: Number.isFinite(snapshot.speedBoostMultiplier)
      ? Math.max(1, snapshot.speedBoostMultiplier)
      : 1,
    trainingPurchases: Math.max(
      0,
      Number.isInteger(snapshot.trainingPurchases) ? snapshot.trainingPurchases : 0,
    ),
    navigationCell: snapshot.navigationCell ? { ...snapshot.navigationCell } : null,
    navigationNext: snapshot.navigationNext ? { ...snapshot.navigationNext } : null,
    destination: snapshot.destination ? { ...snapshot.destination } : null,
    route: Array.isArray(snapshot.route) ? snapshot.route.map((cell) => ({ ...cell })) : [],
    reroutePending: Boolean(snapshot.reroutePending),
    navigationRevision:
      typeof snapshot.navigationRevision === 'string' ? snapshot.navigationRevision : null,
    skillSlots: createHeroSkillSlots(level, snapshot.skillSlots),
  };
}
