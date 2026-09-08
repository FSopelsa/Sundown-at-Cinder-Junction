import { SWITCHYARD_MAP, distanceToPath } from '../../content/map.js';
import {
  TOWER_DEFINITIONS,
  MAX_TOWER_LEVEL,
  UPGRADE_MULTIPLIER,
  getTowerInvestment,
  getTowerSellValue,
  getUpgradeCost,
} from '../../content/towers.js';
import { validateMazePlacement, worldToCell } from '../maze.js';
import {
  roomCellsMatch,
  towerRoomCell,
  validateRoomPlacement,
  worldToRoomCell,
} from '../roomNavigation.js';

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
    heroSystem = null,
  ) {
    this.gameState = gameState;
    this.economySystem = economySystem;
    this.combatSystem = combatSystem;
    this.statusEffectSystem = statusEffectSystem;
    this.definitions = definitions;
    this.map = map;
    this.heroSystem = heroSystem;
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

    let replacedWall = null;

    if (this.map.mode === 'maze' || this.map.mode === 'rooms') {
      const isRoomMap = this.map.mode === 'rooms';
      const candidateCell = isRoomMap ? null : worldToCell(this.map, x, y);
      const roomCandidate = isRoomMap ? worldToRoomCell(this.map, x, y) : null;
      replacedWall = this.gameState.towers.find((tower) =>
        tower.type === 'wall' &&
        (isRoomMap
          ? roomCellsMatch(towerRoomCell(this.map, tower), roomCandidate)
          : worldToCell(this.map, tower.x, tower.y).col === candidateCell.col &&
            worldToCell(this.map, tower.x, tower.y).row === candidateCell.row),
      ) ?? null;
      const placement = isRoomMap
        ? validateRoomPlacement(this.map, this.gameState, x, y, {
          ignoreTowerId: replacedWall?.id ?? null,
        })
        : validateMazePlacement(this.map, this.gameState, x, y, {
          ignoreTowerId: replacedWall?.id ?? null,
        });
      if (!placement.ok) return placement;
      ({ x, y } = placement);
    } else {
      const overlappingTower = this.gameState.towers.find(
        (tower) => distanceBetween(tower, { x, y }) < this.map.towerSpacing,
      );
      if (overlappingTower && overlappingTower.type !== 'wall') {
        return { ok: false, reason: 'Too close to another tower.' };
      }
      if (overlappingTower?.type === 'wall') {
        replacedWall = overlappingTower;
        x = replacedWall.x;
        y = replacedWall.y;
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
        (tower) => tower.id !== replacedWall?.id &&
          distanceBetween(tower, { x, y }) < this.map.towerSpacing,
      );

      if (overlapsTower) {
        return { ok: false, reason: 'Too close to another tower.' };
      }
    }

    const heroPlacement = this.heroSystem?.canPlaceTowerAt(x, y);
    if (heroPlacement && !heroPlacement.ok) {
      return heroPlacement;
    }

    const wallRefund = replacedWall
      ? getTowerSellValue(replacedWall, this.definitions[replacedWall.type])
      : 0;
    if (this.gameState.scrap + wallRefund < definition.cost) {
      return { ok: false, reason: 'Not enough Scrap.' };
    }

    if (replacedWall) {
      this.gameState.towers = this.gameState.towers.filter((tower) => tower.id !== replacedWall.id);
      this.economySystem.awardScrap(wallRefund);
    }
    // Availability was checked above, including a replaced wall's salvage.
    this.economySystem.spendScrap(definition.cost);

    const tower = {
      id: this.gameState.allocateId('tower'),
      type: definition.id,
      name: definition.name,
      x,
      y,
      level: 1,
      ...(towerType === 'scrapExchange' ? { hp: 600, maxHp: 600, aura: false } : {}),
      upgrades: [],
      investedScrap: definition.cost,
      range: definition.range,
      damage: definition.damage,
      damageType: definition.damageType,
      fireIntervalMs: 1000 / definition.shotsPerSecond,
      cooldownMs: 0,
      assetKey: definition.assetKey,
      effect: definition.effect ? { ...definition.effect } : null,
      chain: definition.chain ? { ...definition.chain } : null,
    };

    this.gameState.towers.push(tower);
    return { ok: true, tower, replacedWall, wallRefund };
  }

  upgradeTower(towerId, upgrade) {
    const tower = this.gameState.towers.find((candidate) => candidate.id === towerId);
    if (!tower) return { ok: false, reason: 'Select a deployed tower first.' };
    if (this.gameState.stationIntegrity <= 0) return { ok: false, reason: 'The junction has fallen.' };
    if (upgrade === 'ladder' && tower.type === 'wall') {
      if (tower.ladder) return { ok: false, reason: 'This wall already has a ladder.' };
      if (!this.economySystem.spendScrap(12)) return { ok: false, reason: 'Not enough Scrap.' };
      tower.investedScrap = getTowerInvestment(tower) + 12;
      tower.ladder = true;
      return { ok: true, tower, cost: 12 };
    }
    if (tower.damage === 0) return { ok: false, reason: 'Use this structure’s special upgrades.' };
    if (upgrade !== 'damage' && upgrade !== 'speed') return { ok: false, reason: 'Choose damage or attack speed.' };
    if (tower.level >= MAX_TOWER_LEVEL) return { ok: false, reason: 'This tower is already at maximum level.' };
    const cost = getUpgradeCost(tower, this.definitions[tower.type]);
    const investment = getTowerInvestment(tower, this.definitions[tower.type]);
    if (!this.economySystem.spendScrap(cost)) return { ok: false, reason: 'Not enough Scrap.' };

    if (upgrade === 'damage') {
      tower.damage *= UPGRADE_MULTIPLIER;
      if (tower.effect?.type === 'burn') tower.effect.magnitude *= UPGRADE_MULTIPLIER;
    } else {
      tower.fireIntervalMs /= UPGRADE_MULTIPLIER;
      tower.cooldownMs /= UPGRADE_MULTIPLIER;
    }
    tower.level += 1;
    (tower.upgrades ??= []).push(upgrade);
    tower.investedScrap = investment + cost;
    return { ok: true, tower, cost };
  }

  sellTower(towerId) {
    const tower = this.gameState.towers.find((candidate) => candidate.id === towerId);
    if (!tower) return { ok: false, reason: 'Select a deployed tower first.' };

    const investment = getTowerInvestment(tower, this.definitions[tower.type]);
    const refund = getTowerSellValue(tower, this.definitions[tower.type]);
    this.gameState.towers = this.gameState.towers.filter((candidate) => candidate.id !== towerId);
    this.economySystem.awardScrap(refund);
    return { ok: true, tower, refund, investment };
  }

  update(deltaMs) {
    for (const tower of this.gameState.towers) {
      tower.timeDilationRemainingMs = Math.max(0, (tower.timeDilationRemainingMs ?? 0) - deltaMs);
      const auraMultiplier = this.gameState.towers.some(source => source.type === 'scrapExchange' && source.aura && distanceBetween(source, tower) <= 180) ? 1.2 : 1;
      const attackSpeedMultiplier = auraMultiplier * (tower.timeDilationRemainingMs > 0
        ? tower.timeDilationMultiplier ?? 1
        : 1);
      if (tower.damage <= 0 || !Number.isFinite(tower.fireIntervalMs)) continue;
      tower.cooldownMs = Math.max(0, tower.cooldownMs - deltaMs * attackSpeedMultiplier);

      if (tower.cooldownMs > 0) {
        continue;
      }

      const target = this.gameState.enemies
        .filter((enemy) => distanceBetween(tower, enemy) <= tower.range)
        .sort((first, second) => this.map.mode === 'maze' || this.map.mode === 'rooms'
          ? first.remainingDistance - second.remainingDistance
          : second.progress - first.progress)[0];

      if (!target) {
        continue;
      }

      this.combatSystem.recordEvent({
        type: 'tower-fire',
        towerId: tower.id,
        towerType: tower.type,
        x: tower.x,
        y: tower.y,
        targetX: target.x,
        targetY: target.y,
      });
      if (tower.chain) {
        this.fireChain(tower, target);
        tower.cooldownMs = tower.fireIntervalMs;
        continue;
      }
      const result = this.combatSystem.applyDamage(
        target.id,
        tower.damage,
        tower.damageType,
        { kind: 'tower', id: tower.id, towerType: tower.type },
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

  fireChain(tower, firstTarget) {
    const hitIds = new Set();
    let target = firstTarget;
    let previous = { x: tower.x, y: tower.y };
    let damage = tower.damage;
    const links = [];
    while (target && hitIds.size < tower.chain.maxTargets) {
      hitIds.add(target.id);
      const endpoint = { x: target.x, y: target.y };
      links.push({ from: previous, to: endpoint, targetId: target.id });
      this.combatSystem.applyDamage(target.id, damage, tower.damageType, {
        kind: 'tower', id: tower.id, towerType: tower.type,
      });
      previous = endpoint;
      damage *= tower.chain.damageMultiplier;
      target = this.gameState.enemies
        .filter((enemy) => enemy.hp > 0 && !hitIds.has(enemy.id) &&
          distanceBetween(previous, enemy) <= tower.chain.jumpRange)
        .sort((a, b) => distanceBetween(previous, a) - distanceBetween(previous, b) || a.id.localeCompare(b.id))[0];
    }
    this.combatSystem.recordEvent({ type: 'arc-chain', towerId: tower.id, links });
  }
}
