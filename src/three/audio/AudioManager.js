import { ASSET_MANIFEST, AUDIO_KEYS } from '../../game/assets/manifest.js';

const TOWER_SOUNDS = Object.freeze({
  coldIronLongshot: AUDIO_KEYS.tower.coldIronLongshot,
});

function clampUnit(value, fallback = 0.4) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export class AudioManager {
  constructor(settings = {}, manifest = ASSET_MANIFEST) {
    this.sources = new Map(manifest.audio.map((asset) => [asset.key, asset.path]));
    this.lastPlayedAt = new Map();
    this.unlocked = false;
    this.enabled = settings.audioEnabled !== false;
    this.volume = clampUnit(settings.audioVolume);
    this.combatAmbience = null;
    this.bossMusic = null;
    this.unlock = this.unlock.bind(this);
    window.addEventListener('pointerdown', this.unlock, { once: true, passive: true });
    window.addEventListener('keydown', this.unlock, { once: true });
  }

  unlock() {
    this.unlocked = true;
    if (this.enabled) this.startCombatAmbience();
  }

  syncSettings(settings = {}) {
    const wasEnabled = this.enabled;
    this.enabled = settings.audioEnabled !== false;
    this.volume = clampUnit(settings.audioVolume, this.volume);
    for (const audio of [this.combatAmbience, this.bossMusic]) {
      if (audio) audio.volume = (audio.userVolume ?? 1) * this.volume;
    }
    if (!this.enabled) {
      this.combatAmbience?.pause();
      this.bossMusic?.pause();
      return;
    }
    if (!wasEnabled && this.unlocked) this.startCombatAmbience();
    if (!wasEnabled && this.unlocked && this.bossMusic) this.bossMusic.play().catch(() => {});
  }

  makeAudio(key, options = {}) {
    const source = this.sources.get(key);
    if (!source) return null;
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.loop = Boolean(options.loop);
    audio.userVolume = options.volume ?? 1;
    audio.volume = audio.userVolume * this.volume;
    audio.playbackRate = options.rate ?? 1;
    return audio;
  }

  play(key, options = {}) {
    if (!this.unlocked || !this.enabled) return null;
    const now = performance.now();
    const cooldownMs = options.cooldownMs ?? 0;
    if (now - (this.lastPlayedAt.get(key) ?? -Infinity) < cooldownMs) return null;
    this.lastPlayedAt.set(key, now);
    const audio = this.makeAudio(key, options);
    audio?.play().catch(() => {});
    return audio;
  }

  playTowerAttack(towerType) {
    const key = TOWER_SOUNDS[towerType];
    if (key) this.play(key, { cooldownMs: 100, volume: 0.1, rate: 0.95 + Math.random() * 0.1 });
  }

  playWaveStart() { this.play(AUDIO_KEYS.wave.start, { volume: 0.25 }); }
  playBossArrival() { this.play(AUDIO_KEYS.boss.arrival, { volume: 0.55 }); }
  playTowerPlaced() { this.play(AUDIO_KEYS.ui.towerPlaced, { cooldownMs: 150, volume: 0.55 }); }
  playFailure() { this.play(AUDIO_KEYS.ui.failure, { volume: 0.55 }); }

  playBossMusic() {
    if (!this.unlocked || !this.enabled) return;
    this.bossMusic?.pause();
    this.bossMusic = this.makeAudio(AUDIO_KEYS.boss.music, { loop: true, volume: 0.25 });
    this.bossMusic?.play().catch(() => {});
  }

  playBossVictory() {
    this.bossMusic?.pause();
    this.play(AUDIO_KEYS.boss.victory, { volume: 0.7 });
  }

  startCombatAmbience() {
    if (!this.unlocked || !this.enabled || this.combatAmbience) return;
    this.combatAmbience = this.makeAudio(AUDIO_KEYS.ambience.combat, { loop: true, volume: 0.12 });
    this.combatAmbience?.play().catch(() => {});
  }

  dispose() {
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    this.combatAmbience?.pause();
    this.bossMusic?.pause();
    this.combatAmbience = null;
    this.bossMusic = null;
  }
}
