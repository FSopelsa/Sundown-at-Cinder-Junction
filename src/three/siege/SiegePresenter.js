import * as THREE from 'three';
import { EntityPresenter } from '../EntityPresenter.js';
import { HEROES } from '../../game/siege/content.js';
import { heroStats } from '../../game/siege/state.js';
import { collectMotionParts, animateAsset, headingFromTravel } from '../assetMotion.js';
import { disposeObjectResources } from '../disposeObjectResources.js';

function ring(radius, color, opacity = 0.8) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.045, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.04; return mesh;
}
export class SiegePresenter extends EntityPresenter {
  constructor(scene, library) { super(scene, library); this.heroViews = new Map(); this.fieldViews = new Map(); this.dt = 16; this.networked = false; }
  place(view, entity, time, animate = false) {
    const target = new THREE.Vector3(entity.x / 40, 0.02, entity.y / 40);
    const old = view.root.position.clone();
    if (!view.placed || old.distanceTo(target) > 7 || !this.networked) view.root.position.copy(target);
    else view.root.position.lerp(target, 1 - Math.exp(-this.dt / 75));
    const dx = view.root.position.x - old.x, dz = view.root.position.z - old.z;
    const moving = Math.abs(dx) + Math.abs(dz) > 0.00005;
    if (view.placed && moving) (view.model ?? view.root).rotation.y = headingFromTravel(dx, dz);
    view.placed = true;
    if (view.motion) animateAsset(view.motion, time, animate && moving);
  }
  createSiegeHero(hero) {
    const kit = HEROES[hero.kind], model = this.modelLibrary.cloneNamed(kit.model, kit.node) ?? new THREE.Group();
    model.scale.setScalar(kit.scale); model.traverse(node => { if (node.isMesh) node.castShadow = true; });
    const root = new THREE.Group(); root.add(model);
    const marker = ring(0.55, kit.color); root.add(marker);
    const beacon = ring(0.66, '#e6f9e7', 0.4); root.add(beacon);
    const health = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.03, 0.105), new THREE.MeshBasicMaterial({ color: 0x101b20 }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.065), new THREE.MeshBasicMaterial({ color: kit.color })); fill.position.z = 0.005;
    health.add(back, fill); health.position.y = Math.max(1.4, new THREE.Box3().setFromObject(model).max.y + 0.22); root.add(health);
    this.group.add(root);
    return { root, model, marker, beacon, health, fill, motion: collectMotionParts(model), kind: hero.kind, owned: [marker, beacon, health] };
  }
  syncSiege(state, playerId, camera, time, dt) {
    this.dt = dt; this.networked = state.networked;
    const ids = new Set();
    for (const hero of state.heroes) {
      ids.add(hero.id); let view = this.heroViews.get(hero.id);
      if (view && view.kind !== hero.kind) { this.removeHero(view); view = null; }
      if (!view) { view = this.createSiegeHero(hero); this.heroViews.set(hero.id, view); }
      this.place(view, hero, time, hero.alive);
      view.model.rotation.z = hero.alive ? 0 : Math.PI / 2;
      view.marker.material.color.set(hero.alive ? HEROES[hero.kind].color : '#ff8b6c');
      view.beacon.visible = hero.playerId === playerId || !hero.alive;
      view.beacon.scale.setScalar(hero.alive ? 1 : 1 + Math.sin(time * 0.005) * 0.2);
      view.health.quaternion.copy(camera.quaternion); view.fill.scale.x = Math.max(0, hero.hp / heroStats(hero).maxHp); view.fill.position.x = -0.49 * (1 - view.fill.scale.x);
    }
    for (const [id, view] of this.heroViews) if (!ids.has(id)) { this.removeHero(view); this.heroViews.delete(id); }
    this.syncEnemies(state.enemies, camera, time);
    for (const enemy of state.enemies) {
      const view = this.enemyViews.get(enemy.id);
      const scale = enemy.type === 'blackComet' ? 1.6 : enemy.elite ? 1.35 : 1;
      view.root.scale.setScalar(scale);
      view.ring.visible = true; view.ring.material.color.set(enemy.targetId === 'base' ? '#efad70' : '#ee725f'); view.ring.material.opacity = 0.55;
    }
    this.syncTowers(state.towers.map(t => ({ ...t, construction: t.constructionMs > 0 ? { status: 'building', remainingMs: t.constructionMs, durationMs: 5000 } : null })), null, null, time);
    this.syncPickups(state.drops, time);
    const portals = state.portals.flatMap(p => [{ id: `${p.id}-in`, x: p.x, y: p.y, direction: 'entry' }, { id: `${p.id}-out`, x: p.toX, y: p.toY, direction: 'exit' }]);
    this.syncWormholes(portals, time);
    const active = new Set();
    for (const field of state.fields) {
      active.add(field.id); let view = this.fieldViews.get(field.id);
      if (!view) {
        const color = field.kind === 'warning' ? 0xff745e : 0xa27cff;
        const root = new THREE.Group(), outline = ring(field.radius / 40, color);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(field.radius / 40, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.03;
        root.add(outline, fill);
        if (field.kind === 'gravity') for (let i = 0; i < 3; i++) { const orbit = ring(field.radius / 40 * (0.4 + i * 0.2), color, 0.4); orbit.rotation.x = -1.1 + i * 0.12; orbit.position.y = 0.2 + i * 0.1; root.add(orbit); }
        this.group.add(root); view = { root, fill, outline }; this.fieldViews.set(field.id, view);
      }
      view.root.position.set(field.x / 40, 0.02, field.y / 40);
      view.fill.material.opacity = field.kind === 'warning' ? 0.1 + 0.15 * Math.abs(Math.sin(time * 0.012)) : 0.08;
      if (field.kind === 'gravity') view.root.rotation.y = time * 0.001;
    }
    for (const [id, view] of this.fieldViews) if (!active.has(id)) { disposeObjectResources(view.root); view.root.removeFromParent(); this.fieldViews.delete(id); }
  }
  removeHero(view) { for (const object of view.owned) disposeObjectResources(object); view.root.removeFromParent(); }
  dispose() { for (const view of this.heroViews.values()) this.removeHero(view); for (const view of this.fieldViews.values()) disposeObjectResources(view.root); this.heroViews.clear(); this.fieldViews.clear(); super.dispose(); }
}
