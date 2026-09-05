import { AUDIO_KEYS } from '../../game/assets/manifest.js';

const TOWER_SOUNDS = Object.freeze({
  coldIronLongshot: AUDIO_KEYS.tower.coldIronLongshot,
});

export class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.lastPlayedAt = new Map();
  }

  play(key, config = {}) {
    if (!this.scene.cache.audio.exists(key)) {
      throw new Error(`Audio asset is not loaded: ${key}`);
    }

    const now = this.scene.time.now;
    const cooldownMs = config.cooldownMs ?? 0;
    const lastPlayedAt = this.lastPlayedAt.get(key) ?? -Infinity;

    if (now - lastPlayedAt < cooldownMs) {
      return;
    }

    this.lastPlayedAt.set(key, now);
    const { cooldownMs: _cooldownMs, ...soundConfig } = config;
    this.scene.sound.play(key, soundConfig);
  }

  playTowerAttack(towerType) {
    const key = TOWER_SOUNDS[towerType];

    if (key) {
      this.play(key, {
        cooldownMs: 100,
        volume: 0.1,
        rate: 0.95 + Math.random() * 0.1,
      });
    }
  }

  playWaveStart() {
    this.play(AUDIO_KEYS.wave.start, { volume: 0.25 });
  }

  playBossArrival() {
    this.play(AUDIO_KEYS.boss.arrival, { volume: 0.55 });
  }

  playBossMusic() {
    this.bossMusic?.stop();
    this.bossMusic?.destroy();
    this.bossMusic = this.scene.sound.add(AUDIO_KEYS.boss.music, {
      loop: true,
      volume: 0.25,
    });
    this.bossMusic.play();
  }

  playBossVictory() {
    this.bossMusic?.stop();
    this.play(AUDIO_KEYS.boss.victory, { volume: 0.7 });
  }

  playTowerPlaced() {
    this.play(AUDIO_KEYS.ui.towerPlaced, {
      cooldownMs: 150,
      volume: 0.55,
    });
  }

  playFailure() {
    this.play(AUDIO_KEYS.ui.failure, { volume: 0.55 });
  }

  startCombatAmbience() {
    if (this.combatAmbience?.isPlaying) {
      return;
    }

    this.combatAmbience = this.scene.sound.add(AUDIO_KEYS.ambience.combat, {
      loop: true,
      volume: 0.12,
    });
    this.combatAmbience.play();
  }

  stop() {
    this.combatAmbience?.stop();
    this.combatAmbience?.destroy();
    this.combatAmbience = null;
    this.bossMusic?.stop();
    this.bossMusic?.destroy();
    this.bossMusic = null;
  }
}
