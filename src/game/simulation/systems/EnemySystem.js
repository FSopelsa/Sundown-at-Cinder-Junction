import { ENEMY_DEFINITIONS } from '../../content/enemies.js';
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
  }

  spawn(enemyType) {
    const definition = this.definitions[enemyType];

    if (!definition) {
      throw new Error(`Unknown enemy type: ${enemyType}`);
    }

    const start = pointAlongPath(0, this.map.path);
    const enemy = {
      id: this.gameState.allocateId('enemy'),
      type: definition.id,
      name: definition.name,
      hp: definition.maxHp,
      maxHp: definition.maxHp,
      speed: definition.speed,
      reward: definition.reward,
      stationDamage: definition.stationDamage,
      assetKey: definition.assetKey,
      progress: 0,
      x: start.x,
      y: start.y,
      effects: [],
    };

    this.gameState.enemies.push(enemy);
    return enemy;
  }

  update(deltaMs) {
    const escapedEnemyIds = new Set();

    for (const enemy of this.gameState.enemies) {
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
      }
    }

    if (escapedEnemyIds.size > 0) {
      this.gameState.enemies = this.gameState.enemies.filter(
        (enemy) => !escapedEnemyIds.has(enemy.id),
      );
    }
  }
}
