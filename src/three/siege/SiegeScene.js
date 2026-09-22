import * as THREE from 'three';
import { MODEL_KEYS } from '../../game/assets/manifest.js';
import { SIEGE_MAP, BASE, FOUNDRY, PADS, EVENT_SITE } from '../../game/siege/content.js';
import { createFloorKit } from '../floorKit.js';
import { disposeObjectResources } from '../disposeObjectResources.js';

const metal = (color, emissive = 0x000000, intensity = 0) => new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.58, emissive, emissiveIntensity: intensity });
export class SiegeScene {
  constructor(scene, library) {
    this.group = new THREE.Group(); this.group.name = 'Cinder siege deck'; scene.add(this.group);
    this.owned = new THREE.Group(); this.group.add(this.owned);
    this.library = library; this.signs = []; this.rotors = []; this.floorMaterials = new Set();
    this.dark = metal(0x17242b); this.brass = metal(0x8b6340); this.cyan = metal(0x4fafa9, 0x32bbae, 1.3); this.orange = metal(0xdd8550, 0xff7a32, 1.1);
    this.baseMaterials = [this.dark, this.brass, this.cyan, this.orange];
    this.build();
  }
  box(x, y, z, w, h, d, material = this.dark) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.receiveShadow = true; mesh.castShadow = h > 0.3; this.owned.add(mesh); return mesh; }
  model(node, x, z, scale = 1, rotation = 0, key = MODEL_KEYS.productionReserve) { const mesh = this.library.cloneNamed(key, node); if (!mesh) return null; mesh.position.set(x, 0.04, z); mesh.scale.setScalar(scale); mesh.rotation.y = rotation; this.group.add(mesh); return mesh; }
  ring(x, z, radius, color, width = 0.04) { const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - width, radius, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.06, z); this.owned.add(mesh); return mesh; }
  label(text, x, z, color = '#85c4c1', size = 4) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = '600 45px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText(text, 384, 78);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 6), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.9, depthWrite: false })); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.04, z); this.owned.add(mesh); this.signs.push(texture); return mesh;
  }
  build() {
    const ground = metal(0x302724); ground.roughness = 1;
    this.box(23, -1.6, 14, 200, 1, 200, ground);
    // Raised decks, shared authored floor meshes and low parapets keep all approaches readable.
    for (const room of SIEGE_MAP.rooms) {
      const g = room.grid, x = g.x / 40, z = g.y / 40;
      this.box(x + g.columns / 2, -0.4, z + g.rows / 2, g.columns + 0.18, 0.6, g.rows + 0.18);
      const floor = createFloorKit(room, this.library);
      if (floor) {
        const tint = new THREE.Color({ junction: '#80999e', foundry: '#a38e78', rail: '#718a98', crown: '#97858e' }[room.id]);
        const materials = new Map();
        floor.traverse(mesh => {
          if (!mesh.isMesh) return;
          const tintMaterial = source => {
            if (!materials.has(source)) { const copy = source.clone(); copy.color.multiply(tint); copy.roughness = Math.max(copy.roughness, 0.52); materials.set(source, copy); this.floorMaterials.add(copy); }
            return materials.get(source);
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tintMaterial) : tintMaterial(mesh.material);
          if (mesh.isInstancedMesh) {
            const color = new THREE.Color();
            for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, color.setScalar(0.76 + ((i * 17) % 13) / 50));
          }
        });
        floor.position.set(x, 0, z); this.group.add(floor);
      }
      this.box(x + g.columns / 2, -0.01, z + 0.04, g.columns, 0.09, 0.08, this.brass);
      this.box(x + g.columns / 2, -0.01, z + g.rows - 0.04, g.columns, 0.09, 0.08, this.brass);
      this.box(x + 0.04, -0.01, z + g.rows / 2, 0.08, 0.09, g.rows, this.brass);
      this.box(x + g.columns - 0.04, -0.01, z + g.rows / 2, 0.08, 0.09, g.rows, this.brass);
      for (const xx of [x + 0.5, x + g.columns - 0.5]) for (const zz of [z + 0.5, z + g.rows - 0.5]) {
        this.model('Prop_ArcPylon', xx, zz, 0.58); this.box(xx, 0.15, zz, 0.8, 0.25, 0.8, this.brass);
        this.box(xx, -0.8, zz, 0.6, 1.4, 0.6);
      }
      // Broken rim lights and reinforcement ribs give the deck depth without
      // placing decorative blockers inside the navigation space.
      for (let offset = 1.5; offset < g.columns - 1; offset += 2) {
        this.box(x + offset, -0.13, z - 0.11, 0.8, 0.07, 0.07, room.id === 'foundry' ? this.orange : this.cyan);
        this.box(x + offset, -0.13, z + g.rows + 0.11, 0.8, 0.07, 0.07, room.id === 'foundry' ? this.orange : this.cyan);
        this.box(x + offset, -0.52, z + g.rows + 0.1, 0.16, 0.68, 0.22, this.brass);
      }
    }
    for (const [x, z, rotation] of [[14, 20, Math.PI / 2], [32, 20, Math.PI / 2], [23, 12, 0]]) this.model('Prop_ThresholdGate', x, z, 1.3, rotation);
    // Twin copper conductors trace the three enemy routes into the reactor deck.
    for (const offset of [-0.17, 0.17]) {
      this.box(23, 0.018, 19.5 + offset, 43, 0.035, 0.045, this.brass);
      this.box(23 + offset, 0.018, 12, 0.045, 0.035, 22, this.brass);
    }
    this.reactor = this.model('Prop_ContainmentReactor', BASE.x / 40, BASE.y / 40, 1.65);
    const reactorDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 0.08, 12), this.dark); reactorDeck.position.set(BASE.x / 40, 0.01, BASE.y / 40); reactorDeck.receiveShadow = true; this.owned.add(reactorDeck);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = BASE.x / 40 + Math.cos(a) * 2.3, z = BASE.y / 40 + Math.sin(a) * 2.3;
      const bolt = this.box(x, 0.07, z, 0.22, 0.04, 0.055, this.cyan); bolt.rotation.y = -a;
    }
    this.ring(BASE.x / 40, BASE.y / 40, 2.35, 0x64e4d0);
    this.ring(BASE.x / 40, BASE.y / 40, 2.55, 0xba9062, 0.025);
    this.model('Prop_UpgradeStation', 26.1, 24.9, 0.8);
    this.model('Prop_Tokamak', FOUNDRY.x / 40, FOUNDRY.y / 40, 1.9);
    this.foundryRing = this.ring(FOUNDRY.x / 40, FOUNDRY.y / 40, 2, 0xff7b42, 0.075);
    this.model('Prop_CryogenicPlant', 40.5, 16, 1.3);
    this.model('Prop_FaradayCage', 43, 23, 0.8);
    this.model('Prop_CryogenicPlant', 1.4, 24.8, 0.85);
    this.model('Prop_FaradayCage', 11.5, 15.2, 0.65);
    this.model('Prop_ArcPylon', 19.2, 3.1, 0.85);
    this.model('Prop_ArcPylon', 26.8, 3.1, 0.85);
    this.model('Prop_DeathComet', 23, 2.5, 1.5);
    this.model('Prop_UpgradeStation', EVENT_SITE.x / 40, EVENT_SITE.y / 40, 0.75);
    this.eventRing = this.ring(EVENT_SITE.x / 40, EVENT_SITE.y / 40, 1.05, 0xffd479);
    this.padRings = PADS.map(pad => ({ ...pad, ring: this.ring(pad.x / 40, pad.y / 40, 0.85, 0x7dd0c4) }));
    this.label('C I N D E R  /  J U N C T I O N', 23, 21, '#addad2', 8);
    this.label('ASH FOUNDRY', 7, 23.7, '#d6a07a', 5);
    this.label('BROKEN RAIL', 39, 24.3, '#caaa82', 5);
    this.label('COMET APPROACH', 23, 10, '#d8967b', 5);
    this.label('CAPACITOR', 23, 27.2, '#d5c17a', 2.5);
    for (const [x, z, color, intensity] of [[23,22.5,0x4acac0,26], [4.5,19.5,0xff8136,22], [23,3,0xb562dc,17], [40,18,0x5296cc,14]]) { const light = new THREE.PointLight(color, intensity, 14, 2); light.position.set(x, 2.3, z); this.group.add(light); }
    // Distant salvage silhouettes reuse the same admitted kit; never participate in navigation.
    for (let i = 0; i < 16; i++) { const x = (i * 11.73) % 60 - 7, z = i % 2 ? 32 + (i % 3) * 2 : -6 - (i % 4) * 1.5; const salvage = this.model('Kit_FortressWall', x, z, 1 + (i % 3) * 0.25, i * 1.4); if (salvage) salvage.position.y = -1.05; }
    const stars = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { stars[i * 3] = (i * 17.371) % 70 - 12; stars[i * 3 + 1] = 0.4 + (i * 0.391) % 4; stars[i * 3 + 2] = (i * 7.79) % 44 - 8; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf5c38d, size: 0.035, transparent: true, opacity: 0.36, depthWrite: false })); this.owned.add(this.dust);
  }
  update(state, time) {
    this.eventRing.visible = state.event.status === 'active';
    this.eventRing.scale.setScalar(1 + Math.sin(time * 0.004) * 0.06);
    this.foundryRing.material.color.set(state.foundry.destroyed ? 0x4abb95 : state.foundry.open ? 0xff7951 : 0x896543);
    for (const pad of this.padRings) pad.ring.visible = !state.towers.some(t => t.padId === pad.id);
    this.dust.position.x = Math.sin(time * 0.00004) * 0.6;
  }
  dispose() { for (const texture of this.signs) texture.dispose(); for (const material of this.floorMaterials) material.dispose(); disposeObjectResources(this.owned); this.group.removeFromParent(); }
}
