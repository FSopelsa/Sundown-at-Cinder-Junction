import Phaser from 'phaser';
import { createPlaceholderTextures } from '../boot/createPlaceholderTextures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    createPlaceholderTextures(this);
    this.scene.start('battle');
  }
}
