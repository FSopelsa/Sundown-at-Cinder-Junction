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

    const tickEveryMs = effect.tickEveryMs ?? 1000;

    if (!Number.isFinite(tickEveryMs) || tickEveryMs <= 0) {
      throw new RangeError('Effect tick interval must be a positive number.');
    }

    const existingEffect = target.effects.find(
      (activeEffect) => activeEffect.type === effect.type,
    );

    if (existingEffect) {
      existingEffect.magnitude = Math.max(
        existingEffect.magnitude,
        effect.magnitude ?? 0,
      );
      existingEffect.remainingMs = Math.max(
        existingEffect.remainingMs,
        effect.durationMs,
      );
      existingEffect.tickEveryMs = Math.min(
        existingEffect.tickEveryMs,
        tickEveryMs,
      );
      existingEffect.tickRemainingMs = Math.min(
        existingEffect.tickRemainingMs,
        tickEveryMs,
      );
      return true;
    }

    target.effects.push({
      id: this.gameState.allocateId('effect'),
      type: effect.type,
      magnitude: effect.magnitude ?? 0,
      remainingMs: effect.durationMs,
      tickEveryMs,
      tickRemainingMs: tickEveryMs,
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
