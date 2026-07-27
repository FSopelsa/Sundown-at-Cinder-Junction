export class StatusEffectSystem {
  constructor(gameState, combatSystem) {
    this.gameState = gameState;
    this.combatSystem = combatSystem;
  }

  apply(targetId, effect) {
    const target = this.gameState.enemies.find((enemy) => enemy.id === targetId);

    if (!target) {
      return false;
    }

    if (!Number.isFinite(effect.durationMs) || effect.durationMs <= 0) {
      throw new RangeError('Effect duration must be a positive number.');
    }

    target.effects.push({
      id: this.gameState.allocateId('effect'),
      type: effect.type,
      magnitude: effect.magnitude ?? 0,
      remainingMs: effect.durationMs,
      tickEveryMs: effect.tickEveryMs ?? 1000,
      tickRemainingMs: effect.tickEveryMs ?? 1000,
    });

    return true;
  }

  update(deltaMs) {
    for (const enemy of [...this.gameState.enemies]) {
      let targetAlive = true;

      for (const effect of enemy.effects) {
        effect.remainingMs -= deltaMs;

        if (effect.type === 'burn') {
          effect.tickRemainingMs -= deltaMs;

          while (effect.tickRemainingMs <= 0 && targetAlive) {
            const result = this.combatSystem.applyDamage(
              enemy.id,
              Math.max(1, effect.magnitude),
              'solar',
            );
            targetAlive = !result.killed;
            effect.tickRemainingMs += effect.tickEveryMs;
          }
        }
      }

      if (targetAlive) {
        enemy.effects = enemy.effects.filter(
          (effect) => effect.remainingMs > 0,
        );
      }
    }
  }
}
