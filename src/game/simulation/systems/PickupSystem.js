import { createPickupState } from '../../content/pickups.js';

export class PickupSystem {
  constructor(gameState, map) {
    this.gameState = gameState;
    this.map = map;
  }

  update(deltaMs) {
    if (!Number.isFinite(this.gameState.snabbaSkorSpawnRemainingMs)) return;

    const activeSpeedBoost = (this.gameState.pickups ?? [])
      .some((pickup) => pickup.type === 'speed-boost');
    if (activeSpeedBoost) {
      this.gameState.snabbaSkorSpawnRemainingMs = null;
      return;
    }

    this.gameState.snabbaSkorSpawnRemainingMs -= Math.max(0, deltaMs);
    if (this.gameState.snabbaSkorSpawnRemainingMs > 0) return;

    const point = this.map.pickupSpawnPoint ?? this.map.heroSpawn;
    const pickup = createPickupState({
      id: this.gameState.allocateId('snabba-skor'),
      type: 'speed-boost',
      x: point.x,
      y: point.y,
    });
    if (pickup) this.gameState.pickups.push(pickup);
    this.gameState.snabbaSkorSpawnRemainingMs = null;
  }
}
