import * as THREE from 'three';
import { simulationToWorld } from './coordinates.js';

const DAMAGE_COLORS = Object.freeze({
  neutral: 0xf4cf8c,
  solar: 0xffb85c,
  cryo: 0x88e5ff,
  arc: 0xbd96ff,
  void: 0xbf8eff,
});

function toVector(x, y, elevation = 0.4) {
  const point = simulationToWorld(x, y, elevation);
  return new THREE.Vector3(point.x, point.y, point.z);
}

export class EffectsLayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Combat effects';
    scene.add(this.group);
    this.effects = [];
  }

  pulse(x, y, color, duration = 260, size = 0.16, elevation = 0.42) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), material);
    mesh.position.copy(toVector(x, y, elevation));
    this.group.add(mesh);
    this.effects.push({ object: mesh, material, duration, elapsed: 0, grow: 2.8 });
  }

  beam(fromX, fromY, toX, toY, color, duration = 130) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      toVector(fromX, fromY, 0.60),
      toVector(toX, toY, 0.60),
    ]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geometry, material);
    this.group.add(line);
    this.effects.push({ object: line, material, geometry, duration, elapsed: 0, grow: 1 });
  }

  deathBurst(x, y, color) {
    for (let index = 0; index < 5; index += 1) {
      const angle = (Math.PI * 2 * index) / 5;
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 });
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.10, 0), material);
      mesh.position.copy(toVector(x, y, 0.36));
      this.group.add(mesh);
      this.effects.push({
        object: mesh,
        material,
        duration: 380,
        elapsed: 0,
        grow: 0.6,
        velocity: new THREE.Vector3(Math.cos(angle) * 0.006, 0.004 + index * 0.0008, Math.sin(angle) * 0.006),
      });
    }
  }

  consumeCombat(events) {
    for (const event of events) {
      const color = DAMAGE_COLORS[event.damageType] ?? DAMAGE_COLORS.neutral;
      if (event.type === 'arc-chain') {
        for (const link of event.links ?? []) {
          this.beam(link.from.x, link.from.y, link.to.x, link.to.y, DAMAGE_COLORS.arc, 190);
        }
      } else if (event.type === 'tower-fire' || event.type === 'hero-attack') {
        this.beam(event.x, event.y, event.targetX, event.targetY, color, 115);
      } else if (event.type === 'hit' || event.type === 'shield-break') {
        this.pulse(event.x, event.y, color, 230, event.type === 'shield-break' ? 0.26 : 0.12);
      } else if (event.type === 'death') {
        this.deathBurst(event.x, event.y, color);
      }
    }
  }

  consumeHero(events) {
    for (const event of events) {
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
      if (Number.isFinite(event.targetX) && Number.isFinite(event.targetY)) {
        this.beam(event.x, event.y, event.targetX, event.targetY, DAMAGE_COLORS.void, 180);
      } else if (event.type.includes('gravity') || event.type.includes('wormhole')) {
        this.pulse(event.x, event.y, DAMAGE_COLORS.void, 420, 0.34, 0.08);
      } else if (event.type.includes('hero-hit') || event.type.includes('hero-death')) {
        this.pulse(event.x, event.y, 0xef7e6d, 300, 0.24);
      }
    }
  }

  update(deltaMs) {
    for (const effect of [...this.effects]) {
      effect.elapsed += deltaMs;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.object.scale.setScalar(1 + progress * effect.grow);
      effect.material.opacity = Math.max(0, 1 - progress);
      if (effect.velocity) effect.object.position.addScaledVector(effect.velocity, deltaMs / 16.667);
      if (progress < 1) continue;
      this.group.remove(effect.object);
      effect.object.geometry?.dispose?.();
      effect.material.dispose?.();
      this.effects.splice(this.effects.indexOf(effect), 1);
    }
  }

  dispose() {
    for (const effect of this.effects) {
      effect.object.geometry?.dispose?.();
      effect.material.dispose?.();
    }
    this.effects = [];
    this.scene.remove(this.group);
  }
}
