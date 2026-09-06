export class CombatSystem {
  constructor(gameState, economySystem) {
    this.gameState = gameState;
    this.economySystem = economySystem;
    this.events = [];
    this.enemyDeathHandler = null;
  }

  setEnemyDeathHandler(handler) {
    this.enemyDeathHandler = typeof handler === 'function' ? handler : null;
  }

  recordEvent(event) {
    this.events.push(event);
  }

  applyDamage(targetOrId, amount, damageType = 'neutral', source = null) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError('Damage must be a positive finite number.');
    }

    const targetId =
      typeof targetOrId === 'string' ? targetOrId : targetOrId?.id;
    const target = this.gameState.enemies.find((enemy) => enemy.id === targetId);

    if (!target || target.hp <= 0) {
      return { applied: 0, killed: false, damageType };
    }

    // Shield damage consumes the corresponding amount of the original hit;
    // only the remaining hit budget reaches hull. Arc overloads shields 2x.
    const shieldMultiplier = damageType === 'arc' ? 2 : 1;
    const shieldBefore = target.shield ?? 0;
    const shieldDamage = Math.min(shieldBefore, amount * shieldMultiplier);
    target.shield = shieldBefore - shieldDamage;
    const healthDamage = Math.min(Math.max(0, amount - shieldDamage / shieldMultiplier), target.hp);
    const applied = healthDamage + shieldDamage;
    target.hp -= healthDamage;

    if (shieldBefore > 0 && target.shield === 0) {
      this.recordEvent({ type: 'shield-break', targetId, x: target.x, y: target.y, damageType });
    }

    this.events.push({
      type: 'hit',
      targetId: target.id,
      x: target.x,
      y: target.y,
      damageType,
      amount: applied,
      shieldDamage,
      healthDamage,
      source,
    });

    if (target.hp > 0) {
      return { applied, killed: false, damageType };
    }

    this.events.push({
      type: 'death',
      targetId: target.id,
      x: target.x,
      y: target.y,
      damageType,
      source,
    });

    this.enemyDeathHandler?.(target, source);

    this.gameState.enemies = this.gameState.enemies.filter(
      (enemy) => enemy.id !== target.id,
    );
    this.economySystem.awardScrap(target.reward);

    return { applied, killed: true, damageType };
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
