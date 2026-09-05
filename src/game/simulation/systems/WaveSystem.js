import {
  FINAL_WAVE_INDEX,
  getWaveDefinition,
} from '../../content/waves.js';

export const WAVE_START_DELAY_MS = 1500;
export const CARRYOVER_SPAWN_INTERVAL_MS = 350;

function createSpawnQueue(groups, carryoverEnemies = []) {
  const queue = carryoverEnemies.map((enemy, index) => ({
    enemyType: enemy.enemyType,
    atMs: WAVE_START_DELAY_MS + index * CARRYOVER_SPAWN_INTERVAL_MS,
    isCarryover: true,
  }));
  let cursorMs = carryoverEnemies.length * CARRYOVER_SPAWN_INTERVAL_MS;

  for (const group of groups) {
    cursorMs += group.delayBeforeMs ?? 0;

    for (let count = 0; count < group.count; count += 1) {
      queue.push({
        enemyType: group.enemyType,
        atMs: cursorMs + WAVE_START_DELAY_MS,
      });
      cursorMs += group.intervalMs;
    }
  }

  return queue;
}

export class WaveSystem {
  constructor(gameState, enemySystem, waveProvider = getWaveDefinition) {
    this.gameState = gameState;
    this.enemySystem = enemySystem;
    this.waveProvider = waveProvider;
  }

  startNextWave() {
    if (this.gameState.stationIntegrity <= 0) {
      return { ok: false, reason: 'The junction has fallen. Restart the run.' };
    }

    if (this.gameState.wave.inProgress || this.gameState.enemies.length > 0) {
      return { ok: false, reason: 'The current raid is still active.' };
    }

    const nextWaveIndex = this.gameState.wave.index + 1;
    const definition = this.waveProvider(nextWaveIndex);

    if (!definition) {
      return { ok: false, reason: 'All planned raids are complete.' };
    }

    const carryoverEnemies = this.gameState.carryoverEnemies.map((enemy) => ({
      ...enemy,
    }));
    this.gameState.carryoverEnemies = [];

    this.gameState.wave = {
      index: definition.index,
      inProgress: true,
      completed: false,
      isBounty: definition.isBounty,
      label: definition.label,
      elapsedMs: 0,
      carryoverCount: carryoverEnemies.length,
      spawnQueue: createSpawnQueue(definition.groups, carryoverEnemies),
    };

    return { ok: true, wave: this.gameState.wave };
  }

  update(deltaMs) {
    const wave = this.gameState.wave;

    if (!wave.inProgress) {
      return;
    }

    wave.elapsedMs += deltaMs;

    while (
      wave.spawnQueue.length > 0 &&
      wave.spawnQueue[0].atMs <= wave.elapsedMs
    ) {
      const spawn = wave.spawnQueue.shift();
      this.enemySystem.spawn(spawn.enemyType);
    }
  }

  completeIfFinished() {
    const wave = this.gameState.wave;

    if (
      wave.inProgress &&
      wave.spawnQueue.length === 0 &&
      this.gameState.enemies.length === 0
    ) {
      wave.inProgress = false;
      wave.completed = true;
      return true;
    }

    return false;
  }

  hasCompletedCampaign() {
    return (
      this.gameState.wave.index >= FINAL_WAVE_INDEX &&
      this.gameState.wave.completed
    );
  }
}
