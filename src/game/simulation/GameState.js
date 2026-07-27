export const SAVE_SCHEMA_VERSION = 1;

function cloneEffects(effects = []) {
  return effects.map((effect) => ({ ...effect }));
}

function cloneEnemy(enemy) {
  return { ...enemy, effects: cloneEffects(enemy.effects) };
}

function createWaveState(wave = {}) {
  return {
    index: Number.isInteger(wave.index) ? wave.index : 0,
    inProgress: Boolean(wave.inProgress),
    completed: Boolean(wave.completed),
    isBounty: Boolean(wave.isBounty),
    label: typeof wave.label === 'string' ? wave.label : '',
    elapsedMs: Number.isFinite(wave.elapsedMs) ? wave.elapsedMs : 0,
    spawnQueue: Array.isArray(wave.spawnQueue)
      ? wave.spawnQueue.map((spawn) => ({ ...spawn }))
      : [],
  };
}

export class GameState {
  constructor(snapshot = {}) {
    this.schemaVersion = snapshot.schemaVersion ?? SAVE_SCHEMA_VERSION;
    this.scrap = Number.isFinite(snapshot.scrap) ? snapshot.scrap : 120;
    this.catalysts = { ...(snapshot.catalysts ?? {}) };
    this.towers = Array.isArray(snapshot.towers)
      ? snapshot.towers.map((tower) => ({ ...tower }))
      : [];
    this.enemies = Array.isArray(snapshot.enemies)
      ? snapshot.enemies.map(cloneEnemy)
      : [];
    this.wave = createWaveState(snapshot.wave);
    this.stationIntegrity = Number.isFinite(snapshot.stationIntegrity)
      ? snapshot.stationIntegrity
      : 100;
    this.settings = {
      paused: Boolean(snapshot.settings?.paused),
      speed: snapshot.settings?.speed === 2 ? 2 : 1,
    };
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
      scrap: this.scrap,
      catalysts: { ...this.catalysts },
      towers: this.towers.map((tower) => ({ ...tower })),
      enemies: this.enemies.map(cloneEnemy),
      wave: createWaveState(this.wave),
      stationIntegrity: this.stationIntegrity,
      settings: { ...this.settings },
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
