import { ENEMY_DEFINITIONS } from '../../content/enemies.js';
import { FINAL_WAVE_INDEX, getRaidScaling } from '../../content/waves.js';
import {
  getPathLength,
  pointAlongPath,
  SWITCHYARD_MAP,
} from '../../content/map.js';

export class EnemySystem {
  constructor(gameState, definitions = ENEMY_DEFINITIONS, map = SWITCHYARD_MAP) {
    this.gameState = gameState;
    this.definitions = definitions;
    this.map = map;
    this.pathLength = getPathLength(map.path);
    this.events = [];
  }

  spawn(enemyType) {
    const definition = this.definitions[enemyType];

    if (!definition) {
      throw new Error(`Unknown enemy type: ${enemyType}`);
    }

    const start = pointAlongPath(0, this.map.path);
    const raidIndex = Math.max(1, this.gameState.wave.index);
    const scaling = getRaidScaling(raidIndex);
    const maxHp = Math.round(definition.maxHp * scaling.healthMultiplier);
    const enemy = {
      id: this.gameState.allocateId('enemy'),
      type: definition.id,
      name: definition.name,
      hp: maxHp,
      maxHp,
      speed: Math.round(definition.speed * scaling.speedMultiplier),
      reward: definition.reward,
      stationDamage: definition.stationDamage,
      assetKey: definition.assetKey,
      trait: definition.trait ?? null,
      regenPerSecond: definition.regenPerSecond ?? 0,
      regenSuppressedBy: definition.regenSuppressedBy ?? null,
      raidIndex,
      progress: 0,
      x: start.x,
      y: start.y,
      effects: [],
    };

    this.gameState.enemies.push(enemy);
    this.events.push({ type: 'enemy-spawn', enemyType: enemy.type });
    return enemy;
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  update(deltaMs) {
    const escapedEnemyIds = new Set();

    for (const enemy of this.gameState.enemies) {
      const regenerationIsSuppressed =
        enemy.regenSuppressedBy !== null &&
        enemy.effects.some(
          (effect) =>
            effect.type === enemy.regenSuppressedBy && effect.remainingMs > 0,
        );

      if (
        enemy.regenPerSecond > 0 &&
        !regenerationIsSuppressed &&
        enemy.hp < enemy.maxHp
      ) {
        enemy.hp = Math.min(
          enemy.maxHp,
          enemy.hp + enemy.regenPerSecond * (deltaMs / 1000),
        );
      }

      const slowMagnitude = enemy.effects
        .filter((effect) => effect.type === 'slow')
        .reduce((largest, effect) => Math.max(largest, effect.magnitude ?? 0), 0);
      const speedMultiplier = Math.max(0.2, 1 - slowMagnitude);
      const travelledDistance = enemy.speed * speedMultiplier * (deltaMs / 1000);

      enemy.progress = Math.min(
        1,
        enemy.progress + travelledDistance / this.pathLength,
      );

      const position = pointAlongPath(enemy.progress, this.map.path);
      enemy.x = position.x;
      enemy.y = position.y;

      if (enemy.progress >= 1) {
        escapedEnemyIds.add(enemy.id);
        this.gameState.stationIntegrity = Math.max(
          0,
          this.gameState.stationIntegrity - enemy.stationDamage,
        );

        if (this.gameState.wave.index < FINAL_WAVE_INDEX) {
          this.gameState.carryoverEnemies.push({
            enemyType: enemy.type,
            sourceWaveIndex: this.gameState.wave.index,
          });
        }
      }
    }

    if (escapedEnemyIds.size > 0) {
      this.gameState.enemies = this.gameState.enemies.filter(
        (enemy) => !escapedEnemyIds.has(enemy.id),
      );
    }
  }
}
