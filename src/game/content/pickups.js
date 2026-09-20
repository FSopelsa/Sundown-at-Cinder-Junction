export const SNABBA_SKOR_SPAWN_MIN_MS = 15000;
export const SNABBA_SKOR_SPAWN_MAX_MS = 45000;

export function getRandomSnabbaSkorSpawnDelay(random = Math.random()) {
  const normalized = Math.min(1, Math.max(0, Number(random) || 0));
  return Math.round(
    SNABBA_SKOR_SPAWN_MIN_MS
      + normalized * (SNABBA_SKOR_SPAWN_MAX_MS - SNABBA_SKOR_SPAWN_MIN_MS),
  );
}

export const PICKUP_DEFINITIONS = Object.freeze({
  speedBoost: Object.freeze({
    id: 'speed-boost',
    name: 'Snabba skor',
    durationMs: 15000,
    speedMultiplier: 1.95,
    collectRadius: 34,
    purchaseCost: 200,
  }),
});

export function createPickupState(spawn) {
  const definition = Object.values(PICKUP_DEFINITIONS)
    .find((candidate) => candidate.id === spawn?.type);
  if (!definition) return null;
  return {
    ...definition,
    ...spawn,
    id: spawn.id,
    type: definition.id,
  };
}
