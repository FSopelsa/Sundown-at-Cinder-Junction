import { campaignRoutePoints } from '../game/simulation/campaignRouting.js';
import * as THREE from 'three';
import { buildDistanceField, routePoints } from '../game/simulation/maze.js';
import { buildRoomDistanceField, roomRoutePoints } from '../game/simulation/roomNavigation.js';
import { simulationToWorld } from './coordinates.js';

function routeSignature(map, state) {
  return [
    map.id, state.campaign?.activeEncounterId, state.campaign?.completed.join(),
    state.towers.map((tower) => `${tower.id}:${tower.x}:${tower.y}:${tower.ladder}`).join('|'),
    state.wormholes.map((portal) => `${portal.cell?.roomId ?? ''}:${portal.cell?.col},${portal.cell?.row}:${portal.remainingMs > 0}`).join('|'),
    state.roomState?.openDoorIds?.join('|') ?? '',
  ].join('#');
}

function getRoutePoints(map, state) {
  if (map.campaign) return campaignRoutePoints(map, state);
  if (map.mode === 'rooms') {
    const distances = buildRoomDistanceField(map, state.towers, null, state.wormholes, state.roomState);
    return roomRoutePoints(map, distances, state.wormholes, state.roomState);
  }
  if (map.mode === 'maze') {
    const distances = buildDistanceField(map, state.towers, null, state.wormholes);
    return routePoints(map, distances, state.wormholes);
  }
  return map.path ?? [];
}

// Presentation-only: this line reads the same path field the enemy system
// uses, but owns no navigation state and never changes placement validation.
export class RouteOverlay {
  constructor(scene) {
    this.scene = scene;
    this.signature = null;
    this.material = new THREE.LineDashedMaterial({
      color: 0x79c9c3,
      transparent: true,
      opacity: 0.6,
      dashSize: 0.13,
      gapSize: 0.09,
      depthWrite: false,
    });
    this.line = new THREE.Line(new THREE.BufferGeometry(), this.material);
    this.line.name = 'Active enemy route';
    this.line.visible = false;
    scene.add(this.line);
  }

  update(map, state, deltaMs) {
    this.material.dashOffset -= deltaMs * 0.00045;
    const signature = routeSignature(map, state);
    if (signature === this.signature) return;
    this.signature = signature;
    const points = getRoutePoints(map, state);
    this.line.visible = points.length > 1;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => {
      const world = simulationToWorld(point.x, point.y, 0.045);
      return new THREE.Vector3(world.x, world.y, world.z);
    }));
    this.line.geometry.dispose();
    this.line.geometry = geometry;
    this.line.computeLineDistances();
  }

  dispose() {
    this.line.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.line);
  }
}
