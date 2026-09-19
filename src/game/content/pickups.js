export const PICKUP_DEFINITIONS = Object.freeze({
  speedBoost: Object.freeze({
    id: 'speed-boost',
    name: 'Slipstream Bag',
    durationMs: 12000,
    speedMultiplier: 1.65,
    collectRadius: 34,
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
