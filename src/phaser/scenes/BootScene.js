import Phaser from 'phaser';
import {
  ASSET_KEYS,
  ASSET_MANIFEST,
  SUNSPITTER_ATLAS_FRAMES,
  TOWER_ANIMATION_KEYS,
} from '../../game/assets/manifest.js';
import { createPlaceholderTextures } from '../boot/createPlaceholderTextures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    for (const { key, path } of ASSET_MANIFEST.atlases) {
      this.load.atlas(key, `${path}.png`, `${path}.json`);
      this.load.json(`${key}:metadata`, `${path}.json`);
    }
    for (const { key, path, frameConfig } of ASSET_MANIFEST.spritesheets) {
      this.load.spritesheet(
        key,
        path.replace(/^public\//, '/'),
        frameConfig,
      );
    }
    for (const { key, path } of ASSET_MANIFEST.audio) {
      this.load.audio(key, path.replace(/^public\//, '/'));
    }
  }

  create() {
    // The atlas is the single source of truth for animation frame names/timing.
    for (const { key } of ASSET_MANIFEST.atlases) {
      const atlas = this.cache.json.get(`${key}:metadata`);
      for (const [name, config] of Object.entries(atlas.meta.animations)) {
        const animationKey = `${key}:${name}`;
        if (!this.anims.exists(animationKey)) {
          this.anims.create({ ...config, key: animationKey,
            frames: config.frames.map((frame) => ({ key, frame })) });
        }
      }
    }
    createPlaceholderTextures(this);
    if (!this.anims.exists(TOWER_ANIMATION_KEYS.sunspitterFire)) {
      this.anims.create({
        key: TOWER_ANIMATION_KEYS.sunspitterFire,
        frames: SUNSPITTER_ATLAS_FRAMES.map((_frame, index) => ({
          key: ASSET_KEYS.towers.sunspitter,
          frame: index,
        })),
        frameRate: 16,
        repeat: 0,
      });
    }
    this.scene.start('battle');
  }
}
