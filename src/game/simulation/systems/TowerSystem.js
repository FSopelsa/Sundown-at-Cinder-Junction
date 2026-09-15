import { SWITCHYARD_MAP, distanceToPath } from '../../content/map.js';
import {
  TOWER_DEFINITIONS,
  MAX_TOWER_LEVEL,
  UPGRADE_MULTIPLIER,
  getTowerInvestment,
  getTowerSellValue,
  getUpgradeCost,
  getAuraRangeUpgradeCost,
  SCRAP_EXCHANGE_AURA_BASE_RANGE,
  SCRAP_EXCHANGE_AURA_RANGE_STEP,
  SCRAP_EXCHANGE_AURA_MAX_RANGE,
  SCRAP_EXCHANGE_AURA_MAX_LEVEL,
  BUILDER_CONSTRUCTION,
  getTowerBuildTimeMs,
  getTowerUpgradeTimeMs,
  getTauntDurationMs,
  getTauntDurationUpgradeCost,
  SCRAP_EXCHANGE_TAUNT_COOLDOWN_MS,
  SCRAP_EXCHANGE_TAUNT_MAX_UPGRADE_LEVEL,
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
    this.events = [];
  }

  usesBuilderConstruction() {
    // The active 3D room maps are where the Marshal is spatially readable.
    // Keep the legacy test maps instant until their presentation is retired.
    return this.map.mode === 'rooms';
  }

  getActiveConstruction() {
    return this.gameState.towers.find((tower) => tower.construction) ?? null;
  }

  canStartConstruction() {
    const active = this.getActiveConstruction();
    if (active) return { ok: false, reason: `Singularity is already working on ${active.name}.` };
    if (!this.heroSystem?.hero?.alive) {
      return { ok: false, reason: 'Singularity must be operational to build.' };
    }
    return { ok: true };
  }

  canReachConstruction(tower, towers = this.gameState.towers) {
    const result = this.heroSystem?.canCommandMove(tower.x, tower.y, towers);
    if (!result || result.ok) return { ok: true };
    return { ok: false, reason: `Singularity cannot reach ${tower.name ?? 'that construction site'}: ${result.reason}` };
  }

  sendMarshalToConstruction(tower) {
    // Commanding the existing hero-navigation system means a build order uses
    // the same room doors, collision rules, and save data as a manual move.
    return this.heroSystem?.commandMove(tower.x, tower.y) ?? { ok: true };
  }

  startConstruction(tower, kind, upgrade = null, cost = 0) {
    const route = this.sendMarshalToConstruction(tower);
    if (!route.ok) return null;
    const durationMs = kind === 'build'
      ? getTowerBuildTimeMs(this.definitions[tower.type])
      : getTowerUpgradeTimeMs(tower, upgrade);
    tower.construction = {
      kind,
      upgrade,
      cost,
      durationMs,
      remainingMs: durationMs,
    };
    return tower.construction;
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

    if (this.usesBuilderConstruction()) {
      const construction = this.canStartConstruction();
      if (!construction.ok) return construction;
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

    if (this.usesBuilderConstruction()) {
      // Validate on the prospective obstacle layout before spending Scrap or
      // committing the tower. The Marshal routes to an open neighbouring cell.
      const constructionSite = { type: towerType, name: definition.name, x, y };
      const navigationTowers = this.gameState.towers
        .filter((tower) => tower.id !== replacedWall?.id)
        .concat(constructionSite);
      const route = this.canReachConstruction(constructionSite, navigationTowers);
      if (!route.ok) return route;
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
      ...(towerType === 'scrapExchange'
        ? {
          hp: 600,
          maxHp: 600,
          aura: false,
          auraLevel: 0,
          auraRange: SCRAP_EXCHANGE_AURA_BASE_RANGE,
          tauntRemainingMs: 0,
          tauntCooldownRemainingMs: 0,
          tauntUpgradeLevel: 0,
        }
        : {}),
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
    // The route is issued after the new obstacle exists, so the hero chooses
    // a reachable neighbouring tile instead of attempting to stand inside it.
    if (this.usesBuilderConstruction()) this.startConstruction(tower, 'build');
    return { ok: true, tower, replacedWall, wallRefund, construction: tower.construction ?? null };
  }

  upgradeTower(towerId, upgrade) {
    const tower = this.gameState.towers.find((candidate) => candidate.id === towerId);
    if (!tower) return { ok: false, reason: 'Select a deployed tower first.' };
    if (this.gameState.stationIntegrity <= 0) return { ok: false, reason: 'The junction has fallen.' };
    if (tower.construction) return { ok: false, reason: `${tower.name} is still under construction.` };
    if (this.usesBuilderConstruction()) {
      const construction = this.canStartConstruction();
      if (!construction.ok) return construction;
      const route = this.canReachConstruction(tower);
      if (!route.ok) return route;
    }
    if (upgrade === 'ladder' && tower.type === 'wall') {
      if (tower.ladder) return { ok: false, reason: 'This wall already has a ladder.' };
      if (!this.economySystem.spendScrap(12)) return { ok: false, reason: 'Not enough Scrap.' };
      return this.beginUpgrade(tower, upgrade, 12);
    }
    if (upgrade === 'range' && tower.type === 'scrapExchange') {
      if (!tower.aura) return { ok: false, reason: 'Install the relay aura first.' };
      const auraLevel = Math.max(1, Number.isInteger(tower.auraLevel) ? tower.auraLevel : 1);
      if (auraLevel >= SCRAP_EXCHANGE_AURA_MAX_LEVEL) {
        return { ok: false, reason: 'Relay aura is already at maximum range.' };
      }
      const cost = getAuraRangeUpgradeCost(tower, this.definitions[tower.type]);
      if (!this.economySystem.spendScrap(cost)) return { ok: false, reason: 'Not enough Scrap.' };
      return this.beginUpgrade(tower, upgrade, cost);
    }
    if (upgrade === 'taunt' && tower.type === 'scrapExchange') {
      const tauntLevel = Math.max(0, Number.isInteger(tower.tauntUpgradeLevel) ? tower.tauntUpgradeLevel : 0);
      if (tauntLevel >= SCRAP_EXCHANGE_TAUNT_MAX_UPGRADE_LEVEL) {
        return { ok: false, reason: 'Taunt duration is already at maximum.' };
      }
      const cost = getTauntDurationUpgradeCost(tower, this.definitions[tower.type]);
      if (!this.economySystem.spendScrap(cost)) return { ok: false, reason: 'Not enough Scrap.' };
      return this.beginUpgrade(tower, upgrade, cost);
    }
    if (tower.damage === 0) return { ok: false, reason: 'Use this structure’s special upgrades.' };
    if (upgrade !== 'damage' && upgrade !== 'speed') return { ok: false, reason: 'Choose damage or attack speed.' };
    if (tower.level >= MAX_TOWER_LEVEL) return { ok: false, reason: 'This tower is already at maximum level.' };
    const cost = getUpgradeCost(tower, this.definitions[tower.type]);
    if (!this.economySystem.spendScrap(cost)) return { ok: false, reason: 'Not enough Scrap.' };
    return this.beginUpgrade(tower, upgrade, cost);
  }

  beginUpgrade(tower, upgrade, cost) {
    if (this.usesBuilderConstruction()) {
      return {
        ok: true,
        tower,
        cost,
        construction: this.startConstruction(tower, 'upgrade', upgrade, cost),
      };
    }
    this.completeUpgrade(tower, upgrade, cost);
    return { ok: true, tower, cost };
  }

  completeUpgrade(tower, upgrade, cost) {
    const definition = this.definitions[tower.type];
    const investment = getTowerInvestment(tower, definition);
    if (upgrade === 'ladder') {
      tower.ladder = true;
    } else if (upgrade === 'range') {
      const auraLevel = Math.max(1, Number.isInteger(tower.auraLevel) ? tower.auraLevel : 1) + 1;
      tower.auraLevel = auraLevel;
      tower.auraRange = Math.min(
        SCRAP_EXCHANGE_AURA_MAX_RANGE,
        SCRAP_EXCHANGE_AURA_BASE_RANGE + (auraLevel - 1) * SCRAP_EXCHANGE_AURA_RANGE_STEP,
      );
      (tower.upgrades ??= []).push('range');
    } else if (upgrade === 'taunt') {
      tower.tauntUpgradeLevel = Math.max(0, tower.tauntUpgradeLevel ?? 0) + 1;
      (tower.upgrades ??= []).push('taunt');
    } else if (upgrade === 'damage') {
      tower.damage *= UPGRADE_MULTIPLIER;
      if (tower.effect?.type === 'burn') tower.effect.magnitude *= UPGRADE_MULTIPLIER;
      tower.level += 1;
      (tower.upgrades ??= []).push(upgrade);
    } else if (upgrade === 'speed') {
      tower.fireIntervalMs /= UPGRADE_MULTIPLIER;
      tower.cooldownMs /= UPGRADE_MULTIPLIER;
      tower.level += 1;
      (tower.upgrades ??= []).push(upgrade);
    }
    tower.investedScrap = investment + cost;
  }

  activateTowerAbility(towerId) {
    const tower = this.gameState.towers.find((candidate) => candidate.id === towerId);
    if (!tower || tower.type !== 'scrapExchange' || tower.hp <= 0 || tower.construction) {
      return { ok: false, reason: 'Select an operational Scrap Exchange.' };
    }
    if ((tower.tauntRemainingMs ?? 0) > 0) {
      return { ok: false, reason: 'Taunt is already active.' };
    }
    if ((tower.tauntCooldownRemainingMs ?? 0) > 0) {
      return { ok: false, reason: `Taunt recharges in ${Math.ceil(tower.tauntCooldownRemainingMs / 1000)}s.` };
    }
    const durationMs = getTauntDurationMs(tower);
    tower.tauntRemainingMs = durationMs;
    tower.tauntCooldownRemainingMs = SCRAP_EXCHANGE_TAUNT_COOLDOWN_MS;
    return { ok: true, tower, durationMs };
  }

  sellTower(towerId) {
    const tower = this.gameState.towers.find((candidate) => candidate.id === towerId);
    if (!tower) return { ok: false, reason: 'Select a deployed tower first.' };
    if (tower.construction) return { ok: false, reason: 'Finish the current construction before salvaging it.' };

    const investment = getTowerInvestment(tower, this.definitions[tower.type]);
    const refund = getTowerSellValue(tower, this.definitions[tower.type]);
    this.gameState.towers = this.gameState.towers.filter((candidate) => candidate.id !== towerId);
    this.economySystem.awardScrap(refund);
    return { ok: true, tower, refund, investment };
  }

  updateConstruction(deltaMs) {
    const tower = this.getActiveConstruction();
    if (!tower) return;
    const construction = tower.construction;
    const hero = this.heroSystem?.hero;
    if (!hero?.alive || distanceBetween(hero, tower) > BUILDER_CONSTRUCTION.workingRange) return;

    construction.remainingMs = Math.max(0, construction.remainingMs - deltaMs);
    if (construction.remainingMs > 0) return;

    tower.construction = null;
    if (construction.kind === 'upgrade') {
      this.completeUpgrade(tower, construction.upgrade, construction.cost);
    }
    this.events.push({
      type: 'construction-complete',
      towerId: tower.id,
      towerName: tower.name,
      construction,
    });
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  update(deltaMs) {
    this.updateConstruction(deltaMs);
    for (const tower of this.gameState.towers) {
      tower.timeDilationRemainingMs = Math.max(0, (tower.timeDilationRemainingMs ?? 0) - deltaMs);
      if (tower.type === 'scrapExchange') {
        tower.tauntRemainingMs = Math.max(0, (tower.tauntRemainingMs ?? 0) - deltaMs);
        tower.tauntCooldownRemainingMs = Math.max(0, (tower.tauntCooldownRemainingMs ?? 0) - deltaMs);
      }
      if (tower.construction) continue;
      const auraMultiplier = this.gameState.towers.some(source => source.type === 'scrapExchange' && source.aura && !source.construction && distanceBetween(source, tower) <= (source.auraRange ?? SCRAP_EXCHANGE_AURA_BASE_RANGE)) ? 1.2 : 1;
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
