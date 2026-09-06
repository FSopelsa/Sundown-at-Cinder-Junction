import { getMap } from '../content/map.js';
import { createHeroState } from '../content/heroes.js';

export const SAVE_SCHEMA_VERSION = 1;

function cloneTower(tower) {
  return { ...tower, level: tower.level ?? 1, upgrades: [...(tower.upgrades ?? [])],
    effect: tower.effect ? { ...tower.effect } : null,
    chain: tower.chain ? { ...tower.chain } : null };
}

function cloneEffects(effects = []) {
  return effects.map((effect) => ({
    ...effect,
    source: effect.source ? { ...effect.source } : null,
  }));
}

function cloneEnemy(enemy) {
  return { ...enemy, effects: cloneEffects(enemy.effects),
    ...(enemy.mazeCell ? { mazeCell: { ...enemy.mazeCell } } : {}),
    ...(enemy.mazeNext ? { mazeNext: { ...enemy.mazeNext } } : {}) };
}

function cloneHero(hero) {
  return {
    ...hero,
    navigationCell: hero.navigationCell ? { ...hero.navigationCell } : null,
    navigationNext: hero.navigationNext ? { ...hero.navigationNext } : null,
    destination: hero.destination ? { ...hero.destination } : null,
    route: (hero.route ?? []).map((cell) => ({ ...cell })),
    skillSlots: (hero.skillSlots ?? []).map((slot) => ({ ...slot })),
  };
}

function cloneFieldObject(fieldObject) {
  return {
    ...fieldObject,
    ...(fieldObject.cell ? { cell: { ...fieldObject.cell } } : {}),
  };
}

function createWaveState(wave = {}) {
  return {
    index: Number.isInteger(wave.index) ? wave.index : 0,
    inProgress: Boolean(wave.inProgress),
    completed: Boolean(wave.completed),
    isBounty: Boolean(wave.isBounty),
    label: typeof wave.label === 'string' ? wave.label : '',
    elapsedMs: Number.isFinite(wave.elapsedMs) ? wave.elapsedMs : 0,
    carryoverCount:
      Number.isInteger(wave.carryoverCount) && wave.carryoverCount >= 0
        ? wave.carryoverCount
        : 0,
    spawnQueue: Array.isArray(wave.spawnQueue)
      ? wave.spawnQueue.map((spawn) => ({ ...spawn }))
      : [],
  };
}

export class GameState {
  constructor(snapshot = {}) {
    this.schemaVersion = snapshot.schemaVersion ?? SAVE_SCHEMA_VERSION;
    const map = getMap(snapshot.levelId);
    this.levelId = map.id;
    this.scrap = Number.isFinite(snapshot.scrap) ? snapshot.scrap : map.startingScrap;
    this.catalysts = { ...(snapshot.catalysts ?? {}) };
    this.towers = Array.isArray(snapshot.towers)
      ? snapshot.towers.map(cloneTower)
      : [];
    this.enemies = Array.isArray(snapshot.enemies)
      ? snapshot.enemies.map(cloneEnemy)
      : [];
    this.carryoverEnemies = Array.isArray(snapshot.carryoverEnemies)
      ? snapshot.carryoverEnemies.map((enemy) => ({ ...enemy }))
      : [];
    this.gravityWells = Array.isArray(snapshot.gravityWells)
      ? snapshot.gravityWells.map(cloneFieldObject)
      : [];
    this.scrapPiles = Array.isArray(snapshot.scrapPiles)
      ? snapshot.scrapPiles.map(cloneFieldObject)
      : [];
    this.wormholes = Array.isArray(snapshot.wormholes)
      ? snapshot.wormholes.slice(0, 2).map(cloneFieldObject)
      : [];
    this.wave = createWaveState(snapshot.wave);
    this.stationIntegrity = Number.isFinite(snapshot.stationIntegrity)
      ? snapshot.stationIntegrity
      : 100;
    this.settings = {
      paused: Boolean(snapshot.settings?.paused),
      speed: snapshot.settings?.speed === 2 ? 2 : 1,
    };
    this.hero = createHeroState(map, snapshot.hero);
    this.nextEntityId =
      Number.isInteger(snapshot.nextEntityId) && snapshot.nextEntityId > 0
        ? snapshot.nextEntityId
        : 1;
  }

  allocateId(prefix) {
    const id = `${prefix}-${this.nextEntityId}`;
    this.nextEntityId += 1;
    return id;
  }

  toJSON() {
    return {
      schemaVersion: this.schemaVersion,
      levelId: this.levelId,
      scrap: this.scrap,
      catalysts: { ...this.catalysts },
      towers: this.towers.map(cloneTower),
      enemies: this.enemies.map(cloneEnemy),
      carryoverEnemies: this.carryoverEnemies.map((enemy) => ({ ...enemy })),
      gravityWells: this.gravityWells.map(cloneFieldObject),
      scrapPiles: this.scrapPiles.map(cloneFieldObject),
      wormholes: this.wormholes.map(cloneFieldObject),
      wave: createWaveState(this.wave),
      stationIntegrity: this.stationIntegrity,
      settings: { ...this.settings },
      hero: cloneHero(this.hero),
      nextEntityId: this.nextEntityId,
    };
  }

  static fromJSON(value) {
    const snapshot = typeof value === 'string' ? JSON.parse(value) : value;

    if (snapshot.schemaVersion !== SAVE_SCHEMA_VERSION) {
      throw new Error(`Unsupported save schema: ${snapshot.schemaVersion}`);
    }

    return new GameState(snapshot);
  }
}
