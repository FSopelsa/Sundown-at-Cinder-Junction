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

function createTowerTexture(scene, key, bodyColor, accentColor, barrelWidth, barrelLength) {
  const size = 38;
  const graphics = scene.make.graphics({ add: false });
  graphics.fillStyle(0x181b20, 1);
  graphics.fillCircle(size / 2, size / 2, size / 2);
  graphics.fillStyle(bodyColor, 1);
  graphics.fillCircle(size / 2, size / 2, 12);
  graphics.fillStyle(accentColor, 1);
  graphics.fillRect(
    size / 2 - barrelWidth / 2,
    2,
    barrelWidth,
    barrelLength,
  );
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function createHeroTexture(scene, key) {
  const size = 38;
  const graphics = scene.make.graphics({ add: false });
  graphics.fillStyle(0x11151a, 1);
  graphics.fillCircle(size / 2, size / 2, 18);
  graphics.fillStyle(0x3f6f79, 1);
  graphics.fillTriangle(19, 5, 7, 31, 31, 31);
  graphics.fillStyle(0xf4cf8c, 1);
  graphics.fillCircle(19, 14, 7);
  graphics.fillStyle(0xd0a566, 1);
  graphics.fillRect(16, 20, 6, 12);
  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

export function createPlaceholderTextures(scene) {
  if (!scene.textures.exists(ASSET_KEYS.heroes.circuitMarshal)) {
    createHeroTexture(scene, ASSET_KEYS.heroes.circuitMarshal);
  }
  for (const [key, color, size] of enemyTextures) {
    if (!scene.textures.exists(key)) {
      createEnemyTexture(scene, key, color, size);
    }
  }

  const towerTextures = [
    [ASSET_KEYS.towers.peacemaker, 0xb87333, 0xe2c07d, 4, 16],
    [ASSET_KEYS.towers.sunspitter, 0xc86831, 0xffd36f, 6, 18],
    [ASSET_KEYS.towers.coldIronLongshot, 0x44788d, 0xbaf3ff, 3, 25],
  ];

  for (const [key, bodyColor, accentColor, barrelWidth, barrelLength] of towerTextures) {
    if (!scene.textures.exists(key)) {
      createTowerTexture(
        scene,
        key,
        bodyColor,
        accentColor,
        barrelWidth,
        barrelLength,
      );
    }
  }
}
