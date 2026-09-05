import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../../game/assets/manifest.js';
import { createPlaceholderTextures } from '../boot/createPlaceholderTextures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    for (const { key, path } of ASSET_MANIFEST.audio) {
      this.load.audio(key, path.replace(/^public\//, '/'));
    }
  }

  create() {
    createPlaceholderTextures(this);
    this.scene.start('battle');
  }
}
