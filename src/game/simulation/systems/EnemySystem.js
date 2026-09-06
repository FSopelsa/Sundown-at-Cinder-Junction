import { ENEMY_DEFINITIONS } from '../../content/enemies.js';
import { FINAL_WAVE_INDEX, getRaidScaling } from '../../content/waves.js';
import {
  getPathLength,
  pointAlongPath,
  SWITCHYARD_MAP,
} from '../../content/map.js';
import {
  buildDistanceField,
  cellCenter,
  cellKey,
  isWormholeTransition,
  nextRouteCell,
} from '../maze.js';

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getForwardWormholePair(wormholes = []) {
  if (!Array.isArray(wormholes) || wormholes.length !== 2 ||
    !wormholes.every((portal) => Number.isFinite(portal.progress))) {
    return null;
  }
  return [...wormholes].sort((first, second) => first.progress - second.progress);
}

export class EnemySystem {
  constructor(gameState, definitions = ENEMY_DEFINITIONS, map = SWITCHYARD_MAP, heroSystem = null) {
    this.gameState = gameState;
    this.definitions = definitions;
    this.map = map;
    this.heroSystem = heroSystem;
    this.pathLength = map.mode === 'maze' ? 0 : getPathLength(map.path);
    this.mazeRevision = null;
    this.events = [];
  }

  spawn(enemyType) {
    const definition = this.definitions[enemyType];

    if (!definition) {
      throw new Error(`Unknown enemy type: ${enemyType}`);
    }

    const start = this.map.mode === 'maze'
      ? cellCenter(this.map, this.map.entrance) : pointAlongPath(0, this.map.path);
    const raidIndex = Math.max(1, this.gameState.wave.index);
    const scaling = getRaidScaling(raidIndex);
    const maxHp = Math.round(definition.maxHp * scaling.healthMultiplier);
    const maxShield = Math.round((definition.maxShield ?? 0) * scaling.healthMultiplier);
    const enemy = {
      id: this.gameState.allocateId('enemy'),
      type: definition.id,
      name: definition.name,
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      speed: Math.round(definition.speed * scaling.speedMultiplier),
      reward: definition.reward,
      nearbyXp: definition.nearbyXp,
      heroKillXp: definition.heroKillXp,
      attackDamage: definition.attackDamage ?? 0,
      attackRange: definition.attackRange ?? 0,
      attackIntervalMs: definition.attackIntervalMs ?? 1000,
      attackCooldownMs: 0,
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

    if (this.map.mode === 'maze') {
      enemy.mazeCell = { ...this.map.entrance };
      enemy.mazeNext = null;
      this.refreshMazeRoutes();
      enemy.remainingDistance = this.mazeDistances.get(cellKey(enemy.mazeCell)) * this.map.grid.cellSize;
    }

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
    if (this.map.mode === 'maze') this.refreshMazeRoutes();
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
      enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - deltaMs);

      if (this.attackHero(enemy)) {
        continue;
      }

      if (this.map.mode === 'maze') {
        this.moveThroughMaze(enemy, travelledDistance);
      } else {
        this.moveThroughSwitchyard(enemy, travelledDistance);
      }

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

  attackHero(enemy) {
    const hero = this.heroSystem?.hero;
    if (!hero?.alive || distanceBetween(enemy, hero) > enemy.attackRange) {
      return false;
    }

    if (enemy.attackCooldownMs <= 0 && enemy.attackDamage > 0) {
      this.heroSystem.takeDamage(enemy.attackDamage, {
        kind: 'enemy',
        id: enemy.id,
        enemyType: enemy.type,
      });
      enemy.attackCooldownMs = enemy.attackIntervalMs;
    }
    return true;
  }

  refreshMazeRoutes() {
    const portalRevision = (this.gameState.wormholes ?? [])
      .map((portal) => portal.cell ? `${portal.cell.col},${portal.cell.row}` : '')
      .join('|');
    const revision = `${this.gameState.towers.map((tower) => `${tower.id}:${tower.x}:${tower.y}`).join('|')}#${portalRevision}`;
    if (revision === this.mazeRevision) return;
    this.mazeRevision = revision;
    this.mazeDistances = buildDistanceField(
      this.map,
      this.gameState.towers,
      null,
      this.gameState.wormholes,
    );
    for (const enemy of this.gameState.enemies) this.moveThroughMaze(enemy, 0);
  }

  moveThroughSwitchyard(enemy, distance) {
    const nextProgress = Math.min(1, enemy.progress + distance / this.pathLength);
    const pair = getForwardWormholePair(this.gameState.wormholes);
    if (pair) {
      const [entry, exit] = pair;
      if (enemy.progress < entry.progress && nextProgress >= entry.progress) {
        enemy.progress = exit.progress;
        const position = pointAlongPath(enemy.progress, this.map.path);
        enemy.x = position.x;
        enemy.y = position.y;
        this.events.push({
          type: 'wormhole-travel',
          enemyId: enemy.id,
          x: entry.x,
          y: entry.y,
          targetX: exit.x,
          targetY: exit.y,
        });
        return;
      }
    }

    enemy.progress = nextProgress;
    const position = pointAlongPath(enemy.progress, this.map.path);
    enemy.x = position.x;
    enemy.y = position.y;
  }

  moveThroughMaze(enemy, distance) {
    // Finish the current cell-to-cell segment before following the latest
    // shortest route. This prevents teleporting or corner cutting on rebuilds.
    while (distance > 0 && cellKey(enemy.mazeCell) !== cellKey(this.map.exit)) {
      enemy.mazeNext ??= nextRouteCell(
        enemy.mazeCell,
        this.mazeDistances,
        this.gameState.wormholes,
      );
      if (!enemy.mazeNext) break;
      if (isWormholeTransition(enemy.mazeCell, enemy.mazeNext, this.gameState.wormholes)) {
        const from = cellCenter(this.map, enemy.mazeCell);
        const target = cellCenter(this.map, enemy.mazeNext);
        enemy.x = target.x;
        enemy.y = target.y;
        this.events.push({
          type: 'wormhole-travel',
          enemyId: enemy.id,
          x: from.x,
          y: from.y,
          targetX: target.x,
          targetY: target.y,
        });
        enemy.mazeCell = enemy.mazeNext;
        enemy.mazeNext = null;
        continue;
      }
      const target = cellCenter(this.map, enemy.mazeNext);
      const segment = Math.hypot(target.x - enemy.x, target.y - enemy.y);
      if (distance < segment) {
        enemy.x += (target.x - enemy.x) * distance / segment;
        enemy.y += (target.y - enemy.y) * distance / segment;
        distance = 0;
      } else {
        enemy.x = target.x;
        enemy.y = target.y;
        distance -= segment;
        enemy.mazeCell = enemy.mazeNext;
        enemy.mazeNext = null;
      }
    }
    const cell = enemy.mazeNext ?? enemy.mazeCell;
    const target = cellCenter(this.map, cell);
    const fieldDistance = this.mazeDistances.get(cellKey(cell));
    enemy.remainingDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y) +
      (Number.isFinite(fieldDistance) ? fieldDistance * this.map.grid.cellSize : Number.POSITIVE_INFINITY);
    enemy.progress = enemy.remainingDistance === 0 ? 1 : 0;
  }
}
