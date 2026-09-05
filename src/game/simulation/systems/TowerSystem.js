import { SWITCHYARD_MAP, distanceToPath } from '../../content/map.js';
import { TOWER_DEFINITIONS } from '../../content/towers.js';

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export class TowerSystem {
  constructor(
    gameState,
    economySystem,
    combatSystem,
    statusEffectSystem = null,
    definitions = TOWER_DEFINITIONS,
    map = SWITCHYARD_MAP,
  ) {
    this.gameState = gameState;
    this.economySystem = economySystem;
    this.combatSystem = combatSystem;
    this.statusEffectSystem = statusEffectSystem;
    this.definitions = definitions;
    this.map = map;
  }

  placeTower(towerType, x, y) {
    const definition = this.definitions[towerType];

    if (!definition) {
      return { ok: false, reason: `Unknown tower type: ${towerType}` };
    }

    if (this.gameState.stationIntegrity <= 0) {
      return { ok: false, reason: 'The junction has fallen. Restart to build again.' };
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, reason: 'Invalid tower position.' };
    }

    const margin = this.map.buildMargin;
    const outsideBounds =
      x < margin ||
      y < margin ||
      x > this.map.width - margin ||
      y > this.map.height - margin;

    if (outsideBounds) {
      return { ok: false, reason: 'Build inside the switchyard.' };
    }

    if (distanceToPath(x, y, this.map.path) < this.map.pathClearance) {
      return { ok: false, reason: 'The rail route must remain clear.' };
    }

    const overlapsTower = this.gameState.towers.some(
      (tower) => distanceBetween(tower, { x, y }) < this.map.towerSpacing,
    );

    if (overlapsTower) {
      return { ok: false, reason: 'Too close to another tower.' };
    }

    if (!this.economySystem.spendScrap(definition.cost)) {
      return { ok: false, reason: 'Not enough Scrap.' };
    }

    const tower = {
      id: this.gameState.allocateId('tower'),
      type: definition.id,
      name: definition.name,
      x,
      y,
      level: 1,
      range: definition.range,
      damage: definition.damage,
      damageType: definition.damageType,
      fireIntervalMs: 1000 / definition.shotsPerSecond,
      cooldownMs: 0,
      assetKey: definition.assetKey,
      effect: definition.effect ? { ...definition.effect } : null,
    };

    this.gameState.towers.push(tower);
    return { ok: true, tower };
  }

  update(deltaMs) {
    for (const tower of this.gameState.towers) {
      tower.cooldownMs = Math.max(0, tower.cooldownMs - deltaMs);

      if (tower.cooldownMs > 0) {
        continue;
      }

      const target = this.gameState.enemies
        .filter((enemy) => distanceBetween(tower, enemy) <= tower.range)
        .sort((first, second) => second.progress - first.progress)[0];

      if (!target) {
        continue;
      }

      this.combatSystem.recordEvent({
        type: 'tower-fire',
        towerType: tower.type,
      });
      const result = this.combatSystem.applyDamage(
        target.id,
        tower.damage,
        tower.damageType,
      );

      if (
        result.applied > 0 &&
        !result.killed &&
        tower.effect &&
        this.statusEffectSystem
      ) {
        this.statusEffectSystem.apply(target.id, tower.effect);
      }

      tower.cooldownMs = tower.fireIntervalMs;
    }
  }
}
