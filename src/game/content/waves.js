export const FINAL_WAVE_INDEX = 11;
export const HEALTH_INCREASE_PER_RAID = 0.18;
export const SPEED_INCREASE_PER_RAID = 0.015;

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
        { enemyType: 'tinbackHauler', count: 8, intervalMs: 850 },
        { enemyType: 'blackComet', count: 1, intervalMs: 1000, delayBeforeMs: 1800 },
      ],
    };
  }

  const primaryType = enemyUnlocks[Math.min(enemyUnlocks.length - 1, Math.floor((index - 1) / 2))];
  const groups = [
    {
      enemyType: primaryType,
      count: 4 + index * 2,
      intervalMs: Math.max(360, 760 - index * 35),
    },
  ];

  if (index >= 3) {
    groups.push({
      enemyType: enemyUnlocks[Math.min(enemyUnlocks.length - 1, Math.floor(index / 3))],
      count: 2 + Math.floor(index / 2),
      intervalMs: 620,
      delayBeforeMs: 900,
    });
  }

  if (index === 3) {
    groups.push({
      enemyType: 'riftLeech',
      count: 6,
      intervalMs: 900,
      delayBeforeMs: 1100,
    });
  }

  return {
    index,
    label: `Raid ${index}`,
    isBounty: index === 5 || index === 10,
    groups,
  };
}
