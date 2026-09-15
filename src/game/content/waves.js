export const FINAL_WAVE_INDEX = 11;
export const HEALTH_INCREASE_PER_RAID = 0.22;
// Raids gain hull, not a universal sprint. Individual enemy speeds stay legible
// and give each chassis a distinct role throughout the campaign.
export const SPEED_INCREASE_PER_RAID = 0.005;

const enemyUnlocks = [
  'dustMite',
  'rustRunner',
  'tinbackHauler',
  'sparkWagon',
  'riftLeech',
  'siegeCrawler',
];

export function getRaidScaling(raidIndex) {
  const completedRaids = Math.max(
    0,
    (Number.isInteger(raidIndex) ? raidIndex : 1) - 1,
  );

  return {
    healthMultiplier: 1 + completedRaids * HEALTH_INCREASE_PER_RAID,
    speedMultiplier: 1 + completedRaids * SPEED_INCREASE_PER_RAID,
  };
}

export function getWaveDefinition(index) {
  if (!Number.isInteger(index) || index < 1 || index > FINAL_WAVE_INDEX) {
    return null;
  }

  if (index === FINAL_WAVE_INDEX) {
    return {
      index,
      label: 'The Black Comet',
      isBounty: false,
      groups: [
        { enemyType: 'tinbackHauler', count: 12, intervalMs: 950 },
        { enemyType: 'blackComet', count: 1, intervalMs: 1000, delayBeforeMs: 1800 },
      ],
    };
  }

  const primaryType = enemyUnlocks[Math.min(enemyUnlocks.length - 1, Math.floor((index - 1) / 2))];
  const groups = [
    {
      enemyType: primaryType,
      count: 6 + index * 3,
      intervalMs: Math.max(480, 900 - index * 32),
    },
  ];

  if (index >= 3) {
    groups.push({
      enemyType: enemyUnlocks[Math.min(enemyUnlocks.length - 1, Math.floor(index / 3))],
      count: 3 + Math.ceil(index / 2),
      intervalMs: 760,
      delayBeforeMs: 1100,
    });
  }

  if (index === 3) {
    groups.push({
      enemyType: 'riftLeech',
      count: 8,
      intervalMs: 980,
      delayBeforeMs: 1300,
    });
  }

  return {
    index,
    label: `Raid ${index}`,
    isBounty: index === 5 || index === 10,
    groups,
  };
}

export function getElementalTrialWave(index) {
  const wave = getWaveDefinition(index);
  if (!wave || index !== 1) return wave;
  return { ...wave, label: 'Arc field trial', groups: [
    { enemyType: 'dustMite', count: 6, intervalMs: 760 },
    { enemyType: 'sparkWagon', count: 7, intervalMs: 690, delayBeforeMs: 1100 },
  ] };
}
