export class CombatSystem {
  constructor(gameState, economySystem) {
    this.gameState = gameState;
    this.economySystem = economySystem;
    this.events = [];
  }

  recordEvent(event) {
    this.events.push(event);
  }

  applyDamage(targetOrId, amount, damageType = 'neutral') {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError('Damage must be a positive finite number.');
    }

    const targetId =
      typeof targetOrId === 'string' ? targetOrId : targetOrId?.id;
    const target = this.gameState.enemies.find((enemy) => enemy.id === targetId);

    if (!target || target.hp <= 0) {
      return { applied: 0, killed: false, damageType };
    }

    const applied = Math.min(amount, target.hp);
    target.hp -= applied;

    this.events.push({
      type: 'hit',
      targetId: target.id,
      x: target.x,
      y: target.y,
      damageType,
      amount: applied,
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
    });

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
