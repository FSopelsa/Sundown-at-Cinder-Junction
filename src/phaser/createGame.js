import Phaser from 'phaser';
import { SWITCHYARD_MAP } from '../game/content/map.js';
import { BootScene } from './scenes/BootScene.js';
import { BattleScene } from './scenes/BattleScene.js';

export function createGame(parent, simulation, hud) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: SWITCHYARD_MAP.width,
    height: SWITCHYARD_MAP.height,
    backgroundColor: '#15191d',
    antialias: true,
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, BattleScene],
    callbacks: {
      preBoot(game) {
        game.registry.set('simulation', simulation);
        game.registry.set('hud', hud);
      },
    },
  });
}
