import {
  FINAL_WAVE_INDEX,
  getWaveDefinition,
} from '../../content/waves.js';

function createSpawnQueue(groups) {
  const queue = [];
  let cursorMs = 0;

  for (const group of groups) {
    cursorMs += group.delayBeforeMs ?? 0;

    for (let count = 0; count < group.count; count += 1) {
      queue.push({ enemyType: group.enemyType, atMs: cursorMs });
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
    if (this.gameState.wave.inProgress || this.gameState.enemies.length > 0) {
      return { ok: false, reason: 'The current raid is still active.' };
    }

    const nextWaveIndex = this.gameState.wave.index + 1;
    const definition = this.waveProvider(nextWaveIndex);

    if (!definition) {
      return { ok: false, reason: 'All planned raids are complete.' };
    }

    this.gameState.wave = {
      index: definition.index,
      inProgress: true,
      completed: false,
      isBounty: definition.isBounty,
      label: definition.label,
      elapsedMs: 0,
      spawnQueue: createSpawnQueue(definition.groups),
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
