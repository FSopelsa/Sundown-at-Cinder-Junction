import {
  createHeroSkillSlots,
  getExperienceToNextHeroLevel,
  getHeroExperienceAward,
  getHeroSkill,
  getHeroStats,
  HERO_DEFINITION,
} from '../../content/heroes.js';
import { closestPointOnPath } from '../../content/map.js';
import {
  cellsMatch,
  findHeroPath,
  getTowerNavigationRevision,
  heroCellCenter,
  isHeroCellBlocked,
  isInsideHeroGrid,
  worldToHeroCell,
} from '../navigation.js';

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function cellMatches(first, second) {
  return Boolean(first && second && first.col === second.col && first.row === second.row);
}

export class HeroSystem {
  constructor(
    gameState,
    combatSystem,
    map,
    definition = HERO_DEFINITION,
    statusEffectSystem = null,
    economySystem = null,
  ) {
    this.gameState = gameState;
    this.combatSystem = combatSystem;
    this.map = map;
    this.definition = definition;
    this.statusEffectSystem = statusEffectSystem;
    this.economySystem = economySystem;
    this.events = [];
    this.ensureNavigationState();
    this.combatSystem.setEnemyDeathHandler((enemy, source) => {
      this.onEnemyDeath(enemy, source);
    });
  }

  get hero() {
    return this.gameState.hero;
  }

  ensureNavigationState() {
    const hero = this.hero;
    const cell = hero.navigationCell ?? worldToHeroCell(this.map, hero.x, hero.y);
    const route = findHeroPath(
      this.map,
      this.gameState.towers,
      heroCellCenter(this.map, cell),
      heroCellCenter(this.map, cell),
    );
    hero.navigationCell = route?.cells[0] ?? cell;
    hero.route ??= [];
    hero.navigationNext ??= null;
  }

  commandMove(x, y) {
    const hero = this.hero;
    if (!hero.alive) {
      return { ok: false, reason: 'Singularity returns with the next raid.' };
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, reason: 'Choose a point inside the battlefield.' };
    }

    this.ensureNavigationState();
    const plan = findHeroPath(
      this.map,
      this.gameState.towers,
      heroCellCenter(this.map, hero.navigationCell),
      { x, y },
    );
    if (!plan) {
      return { ok: false, reason: 'No open route to that position.' };
    }

    hero.destination = { ...plan.cells.at(-1) };
    hero.route = plan.cells.slice(1);
    hero.reroutePending = false;
    hero.navigationRevision = getTowerNavigationRevision(this.gameState.towers);
    return { ok: true, destination: plan.destination, pathLength: hero.route.length };
  }

  canPlaceTowerAt(x, y) {
    const hero = this.hero;
    const spawnDistance = Math.hypot(this.map.heroSpawn.x - x, this.map.heroSpawn.y - y);
    if (spawnDistance < 36) {
      return { ok: false, reason: 'Keep the Singularity rally point clear.' };
    }
    if (!hero.alive) return { ok: true };

    const candidateCell = worldToHeroCell(this.map, x, y);
    if (
      cellsMatch(candidateCell, hero.navigationCell) ||
      cellsMatch(candidateCell, hero.navigationNext) ||
      distanceBetween(hero, { x, y }) < hero.collisionRadius + 22
    ) {
      return { ok: false, reason: 'Singularity is crossing this position.' };
    }
    return { ok: true };
  }

  getSkillSlot(skillId) {
    return this.hero.skillSlots.find((slot) => slot.id === skillId) ?? null;
  }

  getOpenGroundTarget(x, y, maxRange = Number.POSITIVE_INFINITY) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, reason: 'Choose a point inside the battlefield.' };
    }
    const cell = worldToHeroCell(this.map, x, y);
    if (!isInsideHeroGrid(this.map, cell)) {
      return { ok: false, reason: 'Choose a point inside the battlefield.' };
    }
    const point = heroCellCenter(this.map, cell);
    if (distanceBetween(this.hero, point) > maxRange) {
      return { ok: false, reason: 'That point is outside Singularity’s skill range.' };
    }
    if (isHeroCellBlocked(this.map, this.gameState.towers, cell)) {
      return { ok: false, reason: 'Choose open ground, clear of towers.' };
    }
    return { ok: true, cell, point };
  }

  castHeroSkill(skillId, x, y) {
    const hero = this.hero;
    if (!hero.alive) return { ok: false, reason: 'Singularity returns with the next raid.' };

    const skill = getHeroSkill(skillId);
    const slot = this.getSkillSlot(skillId);
    if (!skill || !slot) return { ok: false, reason: 'Unknown hero skill.' };
    if (!slot.unlocked) return { ok: false, reason: `${skill.label} unlocks at level ${skill.unlockLevel}.` };
    if (slot.cooldownRemainingMs > 0) {
      return { ok: false, reason: `${skill.label} recharges in ${(slot.cooldownRemainingMs / 1000).toFixed(1)}s.` };
    }

    switch (skill.id) {
      case 'gravity-well': return this.castGravityWell(skill, slot, x, y);
      case 'time-dilation': return this.castTimeDilation(skill, slot);
      case 'void-rend': return this.castVoidRend(skill, slot, x, y);
      case 'quantum-blink': return this.castQuantumBlink(skill, slot, x, y);
      case 'worm-tunnel': return this.castWormTunnel(skill, slot, x, y);
      default: return { ok: false, reason: 'That hero skill is not configured.' };
    }
  }

  startCooldown(slot, skill) {
    slot.cooldownRemainingMs = skill.cooldownMs;
  }

  castGravityWell(skill, slot, x, y) {
    const target = this.getOpenGroundTarget(x, y, skill.range);
    if (!target.ok) return target;
    const well = {
      id: this.gameState.allocateId('gravity-well'),
      x: target.point.x,
      y: target.point.y,
      radius: skill.baseRadius,
      baseRadius: skill.baseRadius,
      maxRadius: skill.maxRadius,
      radiusPerStolenHp: skill.radiusPerStolenHp,
      lifeStealRatio: skill.lifeStealRatio,
      damagePerTick: skill.damagePerTick,
      slowMagnitude: skill.slowMagnitude,
      remainingMs: skill.durationMs,
      tickEveryMs: skill.tickEveryMs,
      tickRemainingMs: 0,
      stolenHp: 0,
    };
    this.gameState.gravityWells.push(well);
    this.startCooldown(slot, skill);
    this.events.push({
      type: 'gravity-well-cast', x: this.hero.x, y: this.hero.y,
      targetX: well.x, targetY: well.y, wellId: well.id,
    });
    return { ok: true, skill, well };
  }

  castTimeDilation(skill, slot) {
    if (this.gameState.towers.length === 0) {
      return { ok: false, reason: 'Deploy at least one tower before bending time.' };
    }
    for (const tower of this.gameState.towers) {
      tower.timeDilationRemainingMs = Math.max(tower.timeDilationRemainingMs ?? 0, skill.durationMs);
      tower.timeDilationMultiplier = skill.attackSpeedMultiplier;
    }
    this.startCooldown(slot, skill);
    this.events.push({
      type: 'time-dilation', x: this.hero.x, y: this.hero.y,
      durationMs: skill.durationMs, towerIds: this.gameState.towers.map((tower) => tower.id),
    });
    return { ok: true, skill, towerCount: this.gameState.towers.length };
  }

  castVoidRend(skill, slot, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, reason: 'Choose a hostile inside Singularity’s skill range.' };
    }
    const target = this.gameState.enemies
      .filter((enemy) => distanceBetween(enemy, { x, y }) <= 30 &&
        distanceBetween(enemy, this.hero) <= skill.range)
      .sort((first, second) => distanceBetween(first, { x, y }) - distanceBetween(second, { x, y }))[0];
    if (!target) return { ok: false, reason: 'Target a hostile inside Singularity’s skill range.' };

    this.statusEffectSystem?.apply(target.id, {
      type: 'void-rend',
      magnitude: skill.damagePerTick,
      durationMs: skill.durationMs,
      tickEveryMs: skill.tickEveryMs,
      source: { kind: 'hero', id: this.hero.id, skillId: skill.id },
    });
    this.startCooldown(slot, skill);
    this.events.push({
      type: 'void-rend', x: this.hero.x, y: this.hero.y,
      targetX: target.x, targetY: target.y, targetId: target.id,
    });
    return { ok: true, skill, target };
  }

  castQuantumBlink(skill, slot, x, y) {
    const target = this.getOpenGroundTarget(x, y, skill.range);
    if (!target.ok) return target;
    const hero = this.hero;
    const from = { x: hero.x, y: hero.y };
    hero.x = target.point.x;
    hero.y = target.point.y;
    hero.navigationCell = { ...target.cell };
    hero.navigationNext = null;
    hero.destination = null;
    hero.route = [];
    hero.reroutePending = false;
    hero.navigationRevision = getTowerNavigationRevision(this.gameState.towers);
    this.startCooldown(slot, skill);
    this.events.push({
      type: 'quantum-blink', x: from.x, y: from.y,
      targetX: hero.x, targetY: hero.y,
    });
    return { ok: true, skill, destination: { x: hero.x, y: hero.y } };
  }

  createWormholeEndpoint(x, y) {
    if (this.map.mode === 'maze') {
      const target = this.getOpenGroundTarget(x, y);
      if (!target.ok) return target;
      if (cellMatches(target.cell, this.map.entrance) || cellMatches(target.cell, this.map.exit)) {
        return { ok: false, reason: 'Keep the maze entrance and exit clear.' };
      }
      if ((this.gameState.wormholes ?? []).some((portal) => cellMatches(portal.cell, target.cell))) {
        return { ok: false, reason: 'That Worm Tunnel endpoint is already set.' };
      }
      if (this.gameState.enemies.some((enemy) =>
        [enemy.mazeCell, enemy.mazeNext].some((cell) => cellMatches(cell, target.cell)))) {
        return { ok: false, reason: 'Wait for enemies to clear that maze cell.' };
      }
      return {
        ok: true,
        endpoint: {
          id: this.gameState.allocateId('wormhole'), x: target.point.x, y: target.point.y,
          cell: { ...target.cell },
        },
      };
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 ||
      x > this.map.width || y > this.map.height) {
      return { ok: false, reason: 'Choose a point inside the battlefield.' };
    }
    const pathPoint = closestPointOnPath(x, y, this.map.path);
    if (pathPoint.distance > 24) {
      return { ok: false, reason: 'Set the Worm Tunnel directly on the rail route.' };
    }
    return {
      ok: true,
      endpoint: {
        id: this.gameState.allocateId('wormhole'), x: pathPoint.x, y: pathPoint.y,
        progress: pathPoint.progress,
      },
    };
  }

  castWormTunnel(skill, slot, x, y) {
    const endpointResult = this.createWormholeEndpoint(x, y);
    if (!endpointResult.ok) return endpointResult;
    const endpoint = endpointResult.endpoint;
    if (this.gameState.wormholes.length === 2) {
      this.gameState.wormholes = [];
      this.events.push({ type: 'wormhole-reset' });
    }

    const first = this.gameState.wormholes[0];
    if (first && distanceBetween(first, endpoint) < skill.minimumDistance) {
      return { ok: false, reason: 'Set the second endpoint farther from the first.' };
    }
    this.gameState.wormholes.push(endpoint);
    const complete = this.gameState.wormholes.length === 2;
    if (complete) this.startCooldown(slot, skill);
    this.events.push({
      type: complete ? 'wormhole-linked' : 'wormhole-placed',
      x: endpoint.x, y: endpoint.y,
      targetX: complete ? first.x : undefined,
      targetY: complete ? first.y : undefined,
      endpoint,
    });
    return { ok: true, skill, endpoint, pending: !complete, keepTargeting: !complete };
  }

  update(deltaMs) {
    this.updateSkillCooldowns(deltaMs);
    this.updateGravityWells(deltaMs);

    const hero = this.hero;
    if (!hero.alive) return;

    this.updateMovement(deltaMs);
    this.collectNearbyScrap();
    hero.attackCooldownMs = Math.max(0, hero.attackCooldownMs - deltaMs);
    if (hero.attackCooldownMs > 0) return;

    const target = this.gameState.enemies
      .filter((enemy) => distanceBetween(hero, enemy) <= hero.attackRange)
      .sort((first, second) => distanceBetween(hero, first) - distanceBetween(hero, second))[0];
    if (!target) return;

    this.combatSystem.recordEvent({
      type: 'hero-attack', x: hero.x, y: hero.y, targetX: target.x, targetY: target.y,
    });
    this.combatSystem.applyDamage(target.id, hero.damage, 'neutral', { kind: 'hero', id: hero.id });
    hero.attackCooldownMs = hero.attackIntervalMs;
  }

  updateSkillCooldowns(deltaMs) {
    for (const slot of this.hero.skillSlots) {
      slot.cooldownRemainingMs = Math.max(0, (slot.cooldownRemainingMs ?? 0) - deltaMs);
    }
  }

  updateGravityWells(deltaMs) {
    const hero = this.hero;
    const remainingWells = [];
    for (const well of this.gameState.gravityWells) {
      well.remainingMs -= deltaMs;
      well.tickRemainingMs -= deltaMs;
      while (well.remainingMs > 0 && well.tickRemainingMs <= 0) {
        let stolenThisPulse = 0;
        for (const enemy of [...this.gameState.enemies]) {
          if (distanceBetween(well, enemy) > well.radius) continue;
          this.statusEffectSystem?.apply(enemy.id, {
            type: 'slow', magnitude: well.slowMagnitude,
            durationMs: Math.max(360, well.tickEveryMs + 80),
          });
          const result = this.combatSystem.applyDamage(enemy.id, well.damagePerTick, 'void', {
            kind: 'hero', id: hero.id, skillId: 'gravity-well',
          });
          stolenThisPulse += Math.max(0, result.healthDamage ?? result.applied);
        }
        if (stolenThisPulse > 0) {
          well.stolenHp += stolenThisPulse;
          well.radius = Math.min(well.maxRadius,
            well.baseRadius + well.stolenHp * well.radiusPerStolenHp);
          this.healHero(stolenThisPulse * well.lifeStealRatio, 'gravity-well');
          this.events.push({
            type: 'gravity-well-pulse', x: well.x, y: well.y, wellId: well.id,
            stolenHp: stolenThisPulse, radius: well.radius,
          });
        }
        well.tickRemainingMs += well.tickEveryMs;
      }

      if (well.remainingMs > 0) remainingWells.push(well);
      else this.collapseGravityWell(well);
    }
    this.gameState.gravityWells = remainingWells;
  }

  collapseGravityWell(well) {
    this.events.push({
      type: 'gravity-well-collapse', x: well.x, y: well.y,
      wellId: well.id, stolenHp: well.stolenHp,
    });
    if (well.stolenHp <= 0) return;

    const pile = {
      id: this.gameState.allocateId('scrap-pile'), x: well.x, y: well.y,
      scrapValue: Math.max(1, Math.floor(well.stolenHp / 20)),
      healAmount: Math.max(8, Math.ceil(well.stolenHp * 0.25)),
      sourceHp: well.stolenHp,
    };
    this.gameState.scrapPiles.push(pile);
    this.events.push({ type: 'scrap-pile-created', x: pile.x, y: pile.y, pile });
  }

  healHero(amount, source) {
    const hero = this.hero;
    if (!hero.alive || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(hero.maxHp - hero.hp, amount);
    hero.hp += applied;
    if (applied > 0 && source !== 'gravity-well') {
      this.events.push({ type: 'hero-heal', x: hero.x, y: hero.y, amount: applied, source });
    }
    return applied;
  }

  collectNearbyScrap() {
    const hero = this.hero;
    const collected = [];
    for (const pile of this.gameState.scrapPiles) {
      if (distanceBetween(hero, pile) > 30) continue;
      const healed = this.healHero(pile.healAmount, 'scrap-pile');
      this.economySystem?.awardScrap(pile.scrapValue);
      collected.push(pile.id);
      this.events.push({ type: 'scrap-pile-collected', x: pile.x, y: pile.y, pile, healed });
    }
    if (collected.length > 0) {
      this.gameState.scrapPiles = this.gameState.scrapPiles.filter((pile) => !collected.includes(pile.id));
    }
  }

  updateMovement(deltaMs) {
    const hero = this.hero;
    const revision = getTowerNavigationRevision(this.gameState.towers);
    if (revision !== hero.navigationRevision) {
      hero.navigationRevision = revision;
      hero.reroutePending = true;
    }

    let remainingDistance = hero.moveSpeed * (deltaMs / 1000);
    while (remainingDistance > 0) {
      if (!hero.navigationNext) {
        if (hero.reroutePending) this.rebuildRoute();
        if (!hero.navigationNext && hero.route.length > 0) hero.navigationNext = hero.route.shift();
      }
      if (!hero.navigationNext) break;

      const target = heroCellCenter(this.map, hero.navigationNext);
      const segmentLength = distanceBetween(hero, target);
      if (segmentLength === 0 || remainingDistance >= segmentLength) {
        hero.x = target.x;
        hero.y = target.y;
        remainingDistance -= segmentLength;
        hero.navigationCell = hero.navigationNext;
        hero.navigationNext = null;
        if (cellsMatch(hero.navigationCell, hero.destination)) {
          hero.destination = null;
          hero.route = [];
          hero.reroutePending = false;
        }
        continue;
      }

      hero.x += ((target.x - hero.x) / segmentLength) * remainingDistance;
      hero.y += ((target.y - hero.y) / segmentLength) * remainingDistance;
      remainingDistance = 0;
    }
  }

  rebuildRoute() {
    const hero = this.hero;
    hero.reroutePending = false;
    if (!hero.destination || !isInsideHeroGrid(this.map, hero.destination)) {
      hero.route = [];
      hero.destination = null;
      return;
    }

    const plan = findHeroPath(
      this.map,
      this.gameState.towers,
      heroCellCenter(this.map, hero.navigationCell),
      heroCellCenter(this.map, hero.destination),
    );
    if (!plan) {
      hero.route = [];
      hero.destination = null;
      this.events.push({ type: 'hero-route-blocked', x: hero.x, y: hero.y });
      return;
    }
    hero.route = plan.cells.slice(1);
  }

  takeDamage(amount, source = null) {
    const hero = this.hero;
    if (!hero.alive || !Number.isFinite(amount) || amount <= 0) {
      return { applied: 0, killed: false };
    }
    const applied = Math.min(hero.hp, amount);
    hero.hp -= applied;
    this.events.push({ type: 'hero-hit', x: hero.x, y: hero.y, amount: applied, source });
    if (hero.hp > 0) return { applied, killed: false };

    hero.alive = false;
    hero.deathWave = this.gameState.wave.index || null;
    hero.destination = null;
    hero.route = [];
    hero.navigationNext = null;
    this.events.push({ type: 'hero-death', x: hero.x, y: hero.y, source });
    return { applied, killed: true };
  }

  reviveForNextWave() {
    const hero = this.hero;
    if (hero.alive) return false;

    hero.alive = true;
    hero.deathWave = null;
    hero.x = this.map.heroSpawn.x;
    hero.y = this.map.heroSpawn.y;
    hero.hp = hero.maxHp;
    hero.attackCooldownMs = 0;
    hero.navigationCell = null;
    hero.navigationNext = null;
    hero.destination = null;
    hero.route = [];
    hero.reroutePending = false;
    hero.navigationRevision = null;
    this.ensureNavigationState();
    this.events.push({ type: 'hero-revive', x: hero.x, y: hero.y });
    return true;
  }

  onEnemyDeath(enemy, source) {
    const hero = this.hero;
    const heroGotKill = source?.kind === 'hero' && source.id === hero.id;
    if (!hero.alive || (!heroGotKill && distanceBetween(hero, enemy) > hero.experienceRadius)) return;
    this.awardExperience(getHeroExperienceAward(enemy, heroGotKill), { heroGotKill, enemyId: enemy.id });
  }

  awardExperience(amount, details = {}) {
    const hero = this.hero;
    if (!hero.alive || !Number.isFinite(amount) || amount <= 0 || hero.level >= this.definition.maxLevel) {
      return { gained: 0, levelsGained: 0 };
    }

    hero.experience += amount;
    let levelsGained = 0;
    while (hero.experienceToNext !== null && hero.experience >= hero.experienceToNext) {
      hero.experience -= hero.experienceToNext;
      const previousMaxHp = hero.maxHp;
      hero.level += 1;
      const stats = getHeroStats(hero.level);
      hero.maxHp = stats.maxHp;
      hero.damage = stats.damage;
      hero.hp = Math.min(hero.maxHp, hero.hp + (hero.maxHp - previousMaxHp) + Math.ceil(hero.maxHp * 0.1));
      hero.experienceToNext = getExperienceToNextHeroLevel(hero.level);
      hero.skillSlots = createHeroSkillSlots(hero.level, hero.skillSlots);
      levelsGained += 1;
      this.events.push({
        type: 'hero-level-up', x: hero.x, y: hero.y, level: hero.level,
        maxHp: hero.maxHp, damage: hero.damage,
      });
    }
    this.events.push({ type: 'hero-xp', amount, ...details });
    return { gained: amount, levelsGained };
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
