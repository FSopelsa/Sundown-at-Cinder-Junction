import * as THREE from 'three';
import { MODEL_KEYS } from '../game/assets/manifest.js';
import { roomCellCenter } from '../game/simulation/roomNavigation.js';
import { getEncounter } from '../game/content/campaign.js';

const colors = { solar: 0xff9838, cryo: 0x69e7ff, arc: 0xd6bdff, grav: 0xcb80ff };
const props = { solar: 'Prop_Tokamak', cryo: 'Prop_CryogenicPlant', arc: 'Prop_ArcPylon', grav: 'Prop_ContainmentReactor' };

// Owned procedural effects sit beside shared authored models. None of these
// meshes or animation timers are navigation authority or save data.
export class CampaignScene {
  constructor(scene, library, map) {
    Object.assign(this, { scene, library, map });
    this.group = new THREE.Group(); this.group.name = 'Campaign landmarks'; scene.add(this.group);
    this.owned = new Set(); this.pulses = []; this.revision = ''; this.seenRooms = new Set(); this.veils = [];
  }
  own(resource) { this.owned.add(resource); return resource; }
  mesh(geometry, material) { return new THREE.Mesh(this.own(geometry), this.own(material)); }
  point(cell) { const p = roomCellCenter(this.map, cell); return new THREE.Vector3(p.x / 40, 0, p.y / 40); }
  prop(name, position, scale = 1, rotation = 0) {
    const model = this.library.cloneNamed(MODEL_KEYS.productionReserve, name);
    if (!model) return;
    model.position.copy(position); model.scale.setScalar(scale); model.rotation.y = rotation;
    this.group.add(model); return model;
  }
  label(text, position, color = '#e8dcc7', width = 5) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(9,17,20,.86)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color; ctx.font = '600 31px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 48, 740);
    const texture = this.own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(this.own(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })));
    sprite.position.copy(position); sprite.scale.set(width, width / 8, 1); sprite.renderOrder = 3; this.group.add(sprite);
  }
  ring(position, radius, color, vertical = false) {
    const ring = this.mesh(new THREE.TorusGeometry(radius, 0.045, 8, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    ring.position.copy(position); ring.position.y += vertical ? 1.25 : 0.10;
    if (!vertical) ring.rotation.x = -Math.PI / 2;
    this.group.add(ring); this.pulses.push(ring); return ring;
  }
  update(state, time) {
    const revision = JSON.stringify([state.roomState, state.campaign.activeEncounterId, state.campaign.completed, state.campaign.keys]);
    if (revision !== this.revision) { this.revision = revision; this.build(state, time); }
    for (const veil of this.veils) {
      const elapsed = Math.max(0, time - veil.userData.startedAt);
      veil.material.opacity = Math.max(0, 1 - elapsed / 3200);
      veil.visible = elapsed < 3200;
    }
    for (const ring of this.pulses) ring.material.opacity = 0.65 + Math.sin(time / 430) * 0.2;
    if (this.sunBeam) { this.sunBeam.material.opacity = 0.28 + Math.sin(time / 90) * 0.055; this.sunCrown.rotation.y = time / 1500; this.sunBolt.rotation.y = time / 310; }
  }
  build(state, time) {
    this.clear();
    for (const room of this.map.rooms.filter(r => state.roomState.unlockedRoomIds.includes(r.id))) {
      const origin = new THREE.Vector3(room.grid.x / 40, 0, room.grid.y / 40);
      if (!this.seenRooms.has(room.id) && state.campaign.revealRemainingMs > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const veil = this.mesh(new THREE.PlaneGeometry(room.grid.columns + 0.3, room.grid.rows + 0.3), new THREE.MeshBasicMaterial({ color: 0x071014, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }));
        veil.rotation.x = -Math.PI / 2; veil.position.copy(origin).add(new THREE.Vector3(room.grid.columns / 2, 5.8, room.grid.rows / 2));
        veil.userData.startedAt = time; veil.renderOrder = 5; this.group.add(veil); this.veils.push(veil);
      }
      this.seenRooms.add(room.id);
      this.label(room.name, origin.clone().add(new THREE.Vector3(room.grid.columns / 2, 2.4, 0.3)), '#dfe8e5', 6);
      const machine = this.point(room.terminal);
      this.prop('Prop_UpgradeStation', machine.clone().add(new THREE.Vector3(0, 0, -1)), 0.85);
      this.ring(machine, 0.43, 0x8becc8);
      this.label('SAVE', machine.clone().add(new THREE.Vector3(0, 1.6, -1)), '#a5ffd7', 1.8);
      if (room.id === 'boss') {
        const center = origin.clone().add(new THREE.Vector3(9, 0, 5));
        const dais = this.mesh(new THREE.CylinderGeometry(2.4, 2.65, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x191c2b, metalness: 0.8, roughness: 0.4 }));
        dais.position.copy(center).y = 0.16; this.group.add(dais);
        this.prop('Prop_TechSquidSentinel', center.clone().add(new THREE.Vector3(0, 0.35, 0)), 1.65, Math.PI);
        this.ring(center, 2.5, 0xff586e);
        for (const dx of [-4, 4]) for (const dz of [-3, 3]) this.prop('Prop_ArcPylon', center.clone().add(new THREE.Vector3(dx, 0, dz)), 1.3);
        this.label('DORMANT · boss encounter to come', origin.clone().add(new THREE.Vector3(8, 1, 10.8)), '#ff9eab', 6);
      }
      if (room.id === 'workshop') {
        const center = origin.clone().add(new THREE.Vector3(7.5, 0, 7.5));
        this.prop('Prop_Tokamak', center, 1.7);
        this.ring(center, 2.1, 0x88ffe0);
        this.label(`${state.campaign.keys.length}/4 KEYS · final chapter reserved`, center.clone().add(new THREE.Vector3(0, 3, 0)), '#e7cf82', 6);
      }
      if (props[room.id]) {
        this.prop(props[room.id], origin.clone().add(new THREE.Vector3(8.5, 0, 2.5)), 1.25);
        this.label(state.campaign.keys.includes(room.id) ? 'KEY SECURED' : 'LOCAL RELAY · keep it intact', origin.clone().add(new THREE.Vector3(8, 1, 10.5)), '#ddd3ff', 5);
      }
    }
    const portal = this.point(this.map.exit);
    this.prop('Prop_EyeOfCinder', portal, 1.2);
    const r = this.ring(portal, 0.8, 0x83ffe4, true); r.rotation.y = Math.PI / 2;
    this.label('DEFEND THE PORTAL', portal.clone().add(new THREE.Vector3(0, 2.7, 0)), '#a5ffd7', 4);
    for (const door of this.map.roomConnections) {
      for (const cell of [door.from, door.to]) {
        if (!state.roomState.unlockedRoomIds.includes(cell.roomId)) continue;
        const room = this.map.rooms.find(r => r.id === cell.roomId);
        const horizontalWall = cell.row === 0 || cell.row === room.grid.rows - 1;
        const point = this.point(cell);
        this.prop('Prop_ThresholdGate', point, 0.8, horizontalWall ? Math.PI / 2 : 0);
        const element = door.id.replace('-door', '');
        if (colors[element] && cell.roomId === 'workshop') {
          this.ring(point, 0.65, colors[element]);
          this.label(`${element.toUpperCase()} ${state.campaign.keys.includes(element) ? '✓' : 'TRIAL'}`, point.clone().add(new THREE.Vector3(0, 2, 0)), '#' + colors[element].toString(16), 3.2);
        }
      }
    }
    const active = getEncounter(this.map, state);
    if (active) {
      const point = this.point(active.spawn);
      this.ring(point, 0.7, 0xff775e);
      this.prop('Prop_ThresholdGate', point, 0.8, active.spawn.row === 0 ? Math.PI / 2 : 0);
      this.label('ENEMY ENTRY', point.clone().add(new THREE.Vector3(0, 2.3, 0)), '#ffb29c', 3.4);
      if (active.goal) { this.prop('Prop_EyeOfCinder', this.point(active.goal), 0.9); this.ring(this.point(active.goal), 0.7, 0x82ffe2); }
    }
    if (state.roomState.unlockedRoomIds.includes('sun')) {
      const center = this.point(this.map.campaign.checkpoint);
      this.ring(center, 1.05, 0xffd66e);
      this.ring(center, 0.60, 0xffffff);
      this.sunBeam = this.mesh(new THREE.CylinderGeometry(0.10, 0.32, 4.8, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffed99, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
      this.sunBeam.position.copy(center).y = 2.45; this.group.add(this.sunBeam);
      this.sunCrown = new THREE.Group(); this.sunCrown.position.copy(center).y = 4.5;
      const crown = this.mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffda70 }));
      crown.rotation.x = -Math.PI / 2; this.sunCrown.add(crown);
      for (let i = 0; i < 12; i++) {
        const ray = this.mesh(new THREE.BoxGeometry(0.07, 0.07, 0.44), new THREE.MeshBasicMaterial({ color: 0xffe6a4 }));
        const angle = i * Math.PI / 6; ray.position.set(Math.sin(angle) * 0.9, 0, Math.cos(angle) * 0.9); ray.rotation.y = angle; this.sunCrown.add(ray);
      }
      this.group.add(this.sunCrown);
      const vertices = Array.from({length: 15}, (_, i) => new THREE.Vector3(i === 0 || i === 14 ? 0 : Math.sin(i * 3.9) * 0.22, 0.12 + i * 0.30, i === 0 || i === 14 ? 0 : Math.cos(i * 4.7) * 0.22));
      this.sunBolt = new THREE.Line(this.own(new THREE.BufferGeometry().setFromPoints(vertices)), this.own(new THREE.LineBasicMaterial({ color: 0xfff5cc, transparent: true, opacity: 0.9 })));
      this.sunBolt.position.copy(center); this.group.add(this.sunBolt);
      const light = new THREE.PointLight(0xffc461, 32, 10); light.position.copy(center).y = 2; this.group.add(light);
      this.label('SUN SEAL · +REGEN 7s', center.clone().add(new THREE.Vector3(0, 5.2, 0)), '#ffe5a2', 5);
    }
  }
  clear() { this.group.clear(); for (const resource of this.owned) resource.dispose(); this.owned.clear(); this.pulses = []; this.veils = []; this.sunBeam = null; }
  dispose() { this.clear(); this.scene.remove(this.group); }
}
