import * as THREE from 'three';
import { MODEL_KEYS } from '../game/assets/manifest.js';
import { simulationToWorld } from './coordinates.js';
import { getWallTopology } from './wallTopology.js';

const ENEMY_MODEL_NAMES = Object.freeze({
  dustMite: 'Unit_DustMite',
  rustRunner: 'Unit_RustRunner',
  tinbackHauler: 'Unit_TinbackHauler',
  sparkWagon: 'Unit_SparkWagon',
  riftLeech: 'Unit_RiftLeech',
  siegeCrawler: 'Unit_SiegeCrawler',
  blackComet: 'Unit_BlackComet',
});

const TOWER_MODEL_NAMES = Object.freeze({
  peacemaker: 'Tower_Peacemaker',
  sunspitter: 'Tower_Sunspitter',
  coldIronLongshot: 'Tower_ColdIronLongshot',
  teslaCoil: 'Tower_TeslaCoil',
  scrapExchange: 'Tower_ScrapExchange',
  wall: 'Tower_Wall',
});

const STATUS_COLORS = Object.freeze({
  burn: 0xff9f4b,
  slow: 0x72dfff,
  'void-rend': 0xc783ff,
});

function fallbackModel(color, size = 0.45, height = 0.7) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(size * 0.45, height, 4, 8),
    new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.43 }),
  );
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

function setShadowFlags(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return root;
}

function makeStatusRing(color = 0x72c5ca) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 32), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  ring.visible = false;
  return ring;
}

function makeHealthBar() {
  const group = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x080a0c, transparent: true, opacity: 0.9 }),
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.045),
    new THREE.MeshBasicMaterial({ color: 0xe79d59 }),
  );
  back.position.y = 1.2;
  fill.position.set(0, 1.2, 0.01);
  group.add(back, fill);
  return { group, fill };
}

export class EntityPresenter {
  constructor(scene, modelLibrary) {
    this.scene = scene;
    this.modelLibrary = modelLibrary;
    this.group = new THREE.Group();
    this.group.name = 'Simulation entity presentation';
    this.scene.add(this.group);
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.heroView = null;
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.54, 36),
      new THREE.MeshBasicMaterial({ color: 0xffe7a4, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.y = 0.04;
    this.selection.visible = false;
    this.group.add(this.selection);
  }

  createHeroView() {
    const root = setShadowFlags(
      this.modelLibrary.cloneNamed(MODEL_KEYS.units, 'Unit_Hero') ?? fallbackModel(0xc9914e, 0.38, 0.95),
    );
    const ring = makeStatusRing();
    root.add(ring);
    this.group.add(root);
    return { root, ring, last: new THREE.Vector3() };
  }

  createEnemyView(enemy) {
    const root = setShadowFlags(
      this.modelLibrary.cloneNamed(MODEL_KEYS.units, ENEMY_MODEL_NAMES[enemy.type]) ?? fallbackModel(0xc96e42),
    );
    const ring = makeStatusRing();
    const health = makeHealthBar();
    root.add(ring, health.group);
    this.group.add(root);
    return { root, ring, health, last: new THREE.Vector3() };
  }

  createTowerView(tower) {
    const color = tower.damageType === 'solar' ? 0xdb5e32 : tower.damageType === 'cryo' ? 0x67bfd1 : tower.damageType === 'arc' ? 0x9b73de : 0xb58044;
    const root = setShadowFlags(
      this.modelLibrary.cloneNamed(MODEL_KEYS.units, TOWER_MODEL_NAMES[tower.type]) ?? fallbackModel(color, 0.42, 0.65),
    );
    const wallParts = tower.type === 'wall' ? {
      core: root.getObjectByName('Tower_Wall_Core'),
      negativeEndCap: root.getObjectByName('Tower_Wall_End_Negative'),
      positiveEndCap: root.getObjectByName('Tower_Wall_End_Positive'),
      junctionCore: null,
    } : null;
    this.group.add(root);
    return { root, last: new THREE.Vector3(), wallParts };
  }

  syncWallView(view, tower, towers, map) {
    if (!view.wallParts) return;
    const topology = getWallTopology(map, tower, towers);
    view.root.rotation.y = topology.axis === 'z' ? Math.PI / 2 : 0;
    if (view.wallParts.negativeEndCap) view.wallParts.negativeEndCap.visible = topology.showNegativeEndCap;
    if (view.wallParts.positiveEndCap) view.wallParts.positiveEndCap.visible = topology.showPositiveEndCap;

    if (topology.cross && view.wallParts.core) {
      if (!view.wallParts.junctionCore) {
        view.wallParts.junctionCore = view.wallParts.core.clone(true);
        view.wallParts.junctionCore.name = 'Tower_Wall_Cross_Core';
        view.wallParts.junctionCore.rotation.y = Math.PI / 2;
        view.root.add(view.wallParts.junctionCore);
      }
      view.wallParts.junctionCore.visible = true;
    } else if (view.wallParts.junctionCore) {
      view.wallParts.junctionCore.visible = false;
    }
  }

  placeTower(view, tower, towers, map) {
    if (tower.type !== 'wall') {
      this.place(view, tower, 0, false);
      return;
    }
    const world = simulationToWorld(tower.x, tower.y);
    view.root.position.set(world.x, 0.02, world.z);
    view.last.copy(view.root.position);
    this.syncWallView(view, tower, towers, map);
  }

  place(view, entity, timeMs, animate = false) {
    const world = simulationToWorld(entity.x, entity.y);
    const next = new THREE.Vector3(world.x, animate ? 0.04 + Math.sin(timeMs * 0.006 + entity.id.length) * 0.025 : 0.02, world.z);
    if (view.last.distanceToSquared(next) > 0.0001) {
      const dx = next.x - view.last.x;
      const dz = next.z - view.last.z;
      if (dx * dx + dz * dz > 0.0001) view.root.rotation.y = Math.atan2(dx, dz);
    }
    view.root.position.copy(next);
    view.last.copy(next);
  }

  sync(state, selectedTowerId, camera, timeMs, map) {
    this.syncHero(state.hero, timeMs);
    this.syncTowers(state.towers, selectedTowerId, map);
    this.syncEnemies(state.enemies, camera, timeMs);
  }

  syncHero(hero, timeMs) {
    if (!this.heroView) this.heroView = this.createHeroView();
    this.heroView.root.visible = hero.alive;
    if (!hero.alive) return;
    this.place(this.heroView, hero, timeMs, true);
    this.heroView.ring.visible = hero.aegisRemainingMs > 0;
    this.heroView.ring.material.color.set(0x82eaff);
  }

  syncTowers(towers, selectedTowerId, map) {
    const active = new Set();
    for (const tower of towers) {
      active.add(tower.id);
      const view = this.towerViews.get(tower.id) ?? this.createTowerView(tower);
      this.towerViews.set(tower.id, view);
      this.placeTower(view, tower, towers, map);
      const selected = tower.id === selectedTowerId;
      if (selected) {
        this.selection.visible = true;
        this.selection.position.set(view.root.position.x, 0.04, view.root.position.z);
      }
    }
    if (!towers.some((tower) => tower.id === selectedTowerId)) this.selection.visible = false;
    for (const [id, view] of this.towerViews) {
      if (active.has(id)) continue;
      this.group.remove(view.root);
      this.towerViews.delete(id);
    }
  }

  syncEnemies(enemies, camera, timeMs) {
    const active = new Set();
    for (const enemy of enemies) {
      active.add(enemy.id);
      const view = this.enemyViews.get(enemy.id) ?? this.createEnemyView(enemy);
      this.enemyViews.set(enemy.id, view);
      this.place(view, enemy, timeMs, true);
      const effect = enemy.effects.find((candidate) => STATUS_COLORS[candidate.type]);
      view.ring.visible = Boolean(effect);
      if (effect) view.ring.material.color.set(STATUS_COLORS[effect.type]);
      view.health.group.quaternion.copy(camera.quaternion);
      const healthRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      view.health.fill.scale.x = healthRatio;
      view.health.fill.position.x = -0.38 * (1 - healthRatio);
    }
    for (const [id, view] of this.enemyViews) {
      if (active.has(id)) continue;
      this.group.remove(view.root);
      this.enemyViews.delete(id);
    }
  }

  getTowerAtSimulationPoint(x, y, radius = 26) {
    for (const [id, view] of this.towerViews) {
      const point = simulationToWorld(x, y);
      if (Math.hypot(point.x - view.root.position.x, point.z - view.root.position.z) <= radius / 40) return id;
    }
    return null;
  }

  dispose() {
    this.scene.remove(this.group);
    this.enemyViews.clear();
    this.towerViews.clear();
    this.heroView = null;
  }
}
