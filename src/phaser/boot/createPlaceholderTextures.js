import { ASSET_KEYS } from '../../game/assets/manifest.js';

const enemyTextures = [
  [ASSET_KEYS.enemies.dustMite, 0xd9b36c, 22],
  [ASSET_KEYS.enemies.rustRunner, 0xc6613f, 24],
  [ASSET_KEYS.enemies.tinbackHauler, 0x69747a, 30],
  [ASSET_KEYS.enemies.sparkWagon, 0x65b7c9, 28],
  [ASSET_KEYS.enemies.riftLeech, 0x8c6fbd, 26],
  [ASSET_KEYS.enemies.siegeCrawler, 0x8a4d35, 34],
  [ASSET_KEYS.enemies.blackComet, 0x1b1824, 46],
];

function createEnemyTexture(scene, key, color, size) {
  const graphics = scene.make.graphics({ add: false });
  graphics.fillStyle(0x11151a, 1);
  graphics.fillCircle(size / 2, size / 2, size / 2);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(size / 2, size / 2, size / 2 - 3);
  graphics.lineStyle(2, 0xf4cf8c, 0.65);
  graphics.strokeCircle(size / 2, size / 2, size / 2 - 5);
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function createTowerTexture(scene) {
  const size = 34;
  const graphics = scene.make.graphics({ add: false });
  graphics.fillStyle(0x181b20, 1);
  graphics.fillCircle(size / 2, size / 2, size / 2);
  graphics.fillStyle(0xb87333, 1);
  graphics.fillCircle(size / 2, size / 2, 11);
  graphics.fillStyle(0xe2c07d, 1);
  graphics.fillRect(size / 2 - 2, 1, 4, 16);
  graphics.generateTexture(ASSET_KEYS.towers.peacemaker, size, size);
  graphics.destroy();
}

export function createPlaceholderTextures(scene) {
  for (const [key, color, size] of enemyTextures) {
    if (!scene.textures.exists(key)) {
      createEnemyTexture(scene, key, color, size);
    }
  }

  if (!scene.textures.exists(ASSET_KEYS.towers.peacemaker)) {
    createTowerTexture(scene);
  }
}
