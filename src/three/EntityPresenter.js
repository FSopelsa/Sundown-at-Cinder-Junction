import * as THREE from 'three';
import { MODEL_KEYS } from '../game/assets/manifest.js';
import { simulationToWorld } from './coordinates.js';
import { getWallTopology } from './wallTopology.js';
import { animateAsset, collectMotionParts, headingFromTravel } from './assetMotion.js';
import {
  disposeWallFadeMaterials,
  makeWallFadeable,
  updateWallOcclusion,
} from './wallOcclusion.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

function prepareWallClone(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    delete node.userData.wallFadeMaterials;
    makeWallFadeable(node);
  });
  return root;
}

function makeConstructionFrame() {
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.84, 0.48, 0.84)),
    new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.9 }),
  );
  frame.name = 'Construction frame';
  frame.position.y = 0.24;
  frame.visible = false;
  return frame;
}

function makeWormholeView(direction) {
  const entry = direction === 'entry';
  const color = entry ? 0x52e7df : 0xff9d4d;
  const group = new THREE.Group();
  group.name = entry ? 'Worm Tunnel Entry' : 'Worm Tunnel Exit';
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.055, 10, 36),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.4,
      metalness: 0.3,
      roughness: 0.28,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.055;
  const field = new THREE.Mesh(
    new THREE.CircleGeometry(0.31, 36),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: entry ? 0.28 : 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.035;
  group.add(field, ring);
  group.userData.baseScale = entry ? 1 : 0.92;
  return group;
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
    this.pickupViews = new Map();
    this.wormholeViews = new Map();
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
    return { root, ring, motion: collectMotionParts(root), last: null };
  }

  createEnemyView(enemy) {
    const root = setShadowFlags(
      this.modelLibrary.cloneNamed(MODEL_KEYS.units, ENEMY_MODEL_NAMES[enemy.type]) ?? fallbackModel(0xc96e42),
    );
    const ring = makeStatusRing();
    const health = makeHealthBar();
    const height = new THREE.Box3().setFromObject(root).max.y;
    health.group.position.y = Math.max(0, height - 1.05);
    root.add(ring, health.group);
    this.group.add(root);
    return { root, ring, health, motion: collectMotionParts(root), last: null };
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
      diagonalBridges: new Map(),
    } : null;
    if (tower.type === 'wall') {
      root.traverse((node) => {
        if (node.isMesh) makeWallFadeable(node);
      });
    }
    const construction = makeConstructionFrame();
    root.add(construction);
    this.group.add(root);
    return { root, last: null, wallParts, construction, motion: collectMotionParts(root) };
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
        prepareWallClone(view.wallParts.junctionCore);
        view.wallParts.junctionCore.name = 'Tower_Wall_Cross_Core';
        view.wallParts.junctionCore.rotation.y = Math.PI / 2;
        view.root.add(view.wallParts.junctionCore);
      }
      view.wallParts.junctionCore.visible = true;
    } else if (view.wallParts.junctionCore) {
      view.wallParts.junctionCore.visible = false;
    }

    const activeDiagonals = new Set();
    for (const diagonal of topology.diagonalBridges ?? []) {
      activeDiagonals.add(diagonal.direction);
      let bridge = view.wallParts.diagonalBridges.get(diagonal.direction);
      if (!bridge && view.wallParts.core) {
        bridge = view.wallParts.core.clone(true);
        prepareWallClone(bridge);
        bridge.name = `Tower_Wall_Diagonal_${diagonal.direction}`;
        view.wallParts.diagonalBridges.set(diagonal.direction, bridge);
        view.root.add(bridge);
      }
      if (!bridge) continue;
      const offset = new THREE.Vector3(diagonal.offsetX, 0, diagonal.offsetZ)
        .applyAxisAngle(Y_AXIS, -view.root.rotation.y);
      bridge.position.copy(view.wallParts.core.position).add(offset);
      bridge.rotation.copy(view.wallParts.core.rotation);
      bridge.rotation.y += diagonal.rotationY - view.root.rotation.y;
      bridge.scale.copy(view.wallParts.core.scale);
      bridge.scale.x *= diagonal.scaleX;
      bridge.visible = true;
    }
    for (const [direction, bridge] of view.wallParts.diagonalBridges) {
      if (!activeDiagonals.has(direction)) bridge.visible = false;
    }
  }

  placeTower(view, tower, towers, map) {
    if (tower.type !== 'wall') {
      this.place(view, tower, 0, false);
      return;
    }
    const world = simulationToWorld(tower.x, tower.y);
    view.root.position.set(world.x, 0.02, world.z);
    view.last = view.root.position.clone();
    this.syncWallView(view, tower, towers, map);
  }

  place(view, entity, timeMs, animate = false) {
    const world = simulationToWorld(entity.x, entity.y);
    const next = new THREE.Vector3(world.x, animate ? 0.04 + Math.sin(timeMs * 0.006 + entity.id.length) * 0.025 : 0.02, world.z);
    let moving = false;
    if (view.last) {
      const dx = next.x - view.last.x;
      const dz = next.z - view.last.z;
      moving = dx * dx + dz * dz > 0.000001;
      if (moving) view.root.rotation.y = headingFromTravel(dx, dz);
    }
    view.root.position.copy(next);
    view.last = next;
    if (view.motion) animateAsset(view.motion, timeMs, moving);
  }

  sync(state, selectedTowerId, camera, timeMs, map) {
    this.syncHero(state.hero, timeMs);
    this.syncTowers(state.towers, selectedTowerId, map, timeMs);
    this.syncEnemies(state.enemies, camera, timeMs);
    this.syncPickups(state.pickups ?? [], timeMs);
    this.syncWormholes(state.wormholes ?? [], timeMs);
  }

  syncHero(hero, timeMs) {
    if (!this.heroView) this.heroView = this.createHeroView();
    this.heroView.root.visible = hero.alive;
    if (!hero.alive) return;
    this.place(this.heroView, hero, timeMs, true);
    this.heroView.ring.visible = hero.aegisRemainingMs > 0;
    this.heroView.ring.material.color.set(0x82eaff);
  }

  syncTowers(towers, selectedTowerId, map, timeMs) {
    const active = new Set();
    for (const tower of towers) {
      active.add(tower.id);
      const view = this.towerViews.get(tower.id) ?? this.createTowerView(tower);
      this.towerViews.set(tower.id, view);
      this.placeTower(view, tower, towers, map);
      animateAsset(view.motion, timeMs);
      this.syncConstruction(view, tower, timeMs);
      const selected = tower.id === selectedTowerId;
      if (selected) {
        this.selection.visible = true;
        this.selection.position.set(view.root.position.x, 0.04, view.root.position.z);
      }
    }
    if (!towers.some((tower) => tower.id === selectedTowerId)) this.selection.visible = false;
    for (const [id, view] of this.towerViews) {
      if (active.has(id)) continue;
      if (view.wallParts) view.root.traverse((node) => disposeWallFadeMaterials(node));
      this.group.remove(view.root);
      this.towerViews.delete(id);
    }
  }

  syncConstruction(view, tower, timeMs) {
    const construction = tower.construction;
    view.construction.visible = Boolean(construction);
    if (!construction) return;
    const queued = construction.status === 'queued';
    const progress = Math.max(0, Math.min(1,
      1 - construction.remainingMs / construction.durationMs,
    ));
    view.construction.rotation.y = queued ? 0 : timeMs * 0.002;
    view.construction.scale.set(
      queued ? 0.76 : 0.72 + progress * 0.28,
      queued ? 0.4 : 0.35 + progress * 0.65,
      queued ? 0.76 : 0.72 + progress * 0.28,
    );
    view.construction.material.color.set(queued ? 0x5dd8e6 : 0xffc46b);
    view.construction.material.opacity = queued ? 0.68 : 0.55 + (1 - progress) * 0.35;
  }

  syncPickups(pickups, timeMs) {
    const active = new Set();
    for (const pickup of pickups) {
      active.add(pickup.id);
      let view = this.pickupViews.get(pickup.id);
      if (!view) {
        const root = setShadowFlags(
          this.modelLibrary.cloneNamed(MODEL_KEYS.snabbaSkor, 'Prop_SnabbaSkor') ?? fallbackModel(0x5de4c8, 0.24, 0.3),
        );
        root.name = `Pickup_${pickup.id}`;
        root.scale.setScalar(0.52);
        const ring = makeStatusRing(0x5de4c8);
        ring.visible = true;
        ring.scale.setScalar(0.7);
        root.add(ring);
        this.group.add(root);
        view = { root };
        this.pickupViews.set(pickup.id, view);
      }
      const point = simulationToWorld(pickup.x, pickup.y);
      view.root.position.set(point.x, 0.1 + Math.sin(timeMs * 0.003) * 0.035, point.z);
      view.root.rotation.y = timeMs * 0.0008;
    }
    for (const [id, view] of this.pickupViews) {
      if (active.has(id)) continue;
      this.group.remove(view.root);
      this.pickupViews.delete(id);
    }
  }

  syncWormholes(wormholes, timeMs) {
    const active = new Set();
    for (const portal of wormholes) {
      active.add(portal.id);
      let view = this.wormholeViews.get(portal.id);
      if (!view || view.userData.direction !== portal.direction) {
        if (view) this.group.remove(view);
        view = makeWormholeView(portal.direction);
        view.userData.direction = portal.direction;
        this.group.add(view);
        this.wormholeViews.set(portal.id, view);
      }
      const point = simulationToWorld(portal.x, portal.y);
      view.position.set(point.x, 0.025, point.z);
      const pulse = view.userData.baseScale * (1 + Math.sin(timeMs * 0.006) * 0.08);
      view.scale.setScalar(pulse);
      view.rotation.y = timeMs * (portal.direction === 'entry' ? 0.0012 : -0.0012);
    }
    for (const [id, view] of this.wormholeViews) {
      if (active.has(id)) continue;
      this.group.remove(view);
      this.wormholeViews.delete(id);
    }
  }

  updateWallOcclusion(camera, target) {
    this.group.updateMatrixWorld(true);
    const walls = [];
    for (const view of this.towerViews.values()) {
      if (!view.wallParts) continue;
      view.root.traverse((node) => {
        if (node.isMesh && node.userData.wallFadeMaterials) walls.push(node);
      });
    }
    return updateWallOcclusion(camera, target, walls, 0.28);
  }

  consumeCombat(events) {
    for (const event of events) {
      if (event.type !== 'tower-fire') continue;
      const view = this.towerViews.get(event.towerId);
      if (!view) continue;
      const heading = headingFromTravel(event.targetX - event.x, event.targetY - event.y);
      const turret = view.motion.find(part => part.role === 'Motion_Turret');
      if (turret) turret.node.rotation.y = heading;
      else if (event.towerType === 'sunspitter') view.root.rotation.y = heading;
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
    for (const view of this.towerViews.values()) {
      if (view.wallParts) view.root.traverse((node) => disposeWallFadeMaterials(node));
    }
    this.scene.remove(this.group);
    this.enemyViews.clear();
    this.towerViews.clear();
    this.pickupViews.clear();
    this.wormholeViews.clear();
    this.heroView = null;
  }
}
