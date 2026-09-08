import * as THREE from 'three';
import { MODEL_KEYS } from '../game/assets/manifest.js';
import { roomCellCenter } from '../game/simulation/roomNavigation.js';
import { METERS_PER_SIMULATION_UNIT, simulationToWorld } from './coordinates.js';

const ROOM_MODEL_KEYS = Object.freeze({
  'arrival-yard': MODEL_KEYS.environment.arrivalYard,
  'relay-hall': MODEL_KEYS.environment.relayHall,
});

function getRenderableRooms(map) {
  if (map.mode === 'rooms') return map.rooms;
  if (map.mode === 'maze') return [{ id: map.id, grid: map.grid }];
  return [{
    id: map.id,
    grid: { x: 0, y: 0, columns: Math.ceil(map.width / 40), rows: Math.ceil(map.height / 40), cellSize: 40 },
  }];
}

function makeFallbackRoom(room) {
  const { grid } = room;
  const width = grid.columns * grid.cellSize * METERS_PER_SIMULATION_UNIT;
  const depth = grid.rows * grid.cellSize * METERS_PER_SIMULATION_UNIT;
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.20, depth),
    new THREE.MeshStandardMaterial({ color: room.id === 'relay-hall' ? 0x0f4f52 : 0x4a2415, metalness: 0.55, roughness: 0.68 }),
  );
  floor.position.set(width / 2, -0.10, depth / 2);
  floor.receiveShadow = true;
  group.add(floor);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x172128, metalness: 0.75, roughness: 0.52 });
  const wall = (width, depth, x, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1.5, depth), wallMaterial);
    mesh.position.set(x, 0.75, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  wall(width, 0.18, width / 2, 0);
  wall(width, 0.18, width / 2, depth);
  wall(0.18, depth, 0, depth / 2);
  wall(0.18, depth, width, depth / 2);
  return group;
}

function connectionBridge(map, connection) {
  const from = roomCellCenter(map, connection.from);
  const to = roomCellCenter(map, connection.to);
  if (!from || !to) return null;
  const fromWorld = simulationToWorld(from.x, from.y);
  const toWorld = simulationToWorld(to.x, to.y);
  const dx = toWorld.x - fromWorld.x;
  const dz = toWorld.z - fromWorld.z;
  const length = Math.hypot(dx, dz);
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.3, 0.16, 0.88),
    new THREE.MeshStandardMaterial({ color: 0x2b3131, metalness: 0.82, roughness: 0.42 }),
  );
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridge.add(deck);
  const light = new THREE.PointLight(0x6fe6d9, 6, 5, 2);
  light.position.set(0, 1.4, 0);
  bridge.add(light);
  bridge.position.set((fromWorld.x + toWorld.x) / 2, 0, (fromWorld.z + toWorld.z) / 2);
  bridge.rotation.y = -Math.atan2(dz, dx);
  return bridge;
}

export class RoomScene {
  constructor(scene, modelLibrary) {
    this.scene = scene;
    this.modelLibrary = modelLibrary;
    this.group = new THREE.Group();
    this.group.name = 'Cinder Threshold rooms';
    this.scene.add(this.group);
    this.floorSurfaces = [];
  }

  build(map) {
    this.clear();
    const rooms = getRenderableRooms(map);
    for (const room of rooms) {
      const { grid } = room;
      const position = simulationToWorld(grid.x, grid.y);
      const environment = this.modelLibrary.clone(ROOM_MODEL_KEYS[room.id]) ?? makeFallbackRoom(room);
      environment.name = `${room.id} environment`;
      environment.position.set(position.x, 0, position.z);
      this.group.add(environment);
      this.addFloorSurface(room);
      this.addRoomLight(room);
    }
    for (const connection of map.roomConnections ?? []) {
      const bridge = connectionBridge(map, connection);
      if (bridge) this.group.add(bridge);
    }
  }

  addFloorSurface(room) {
    const { grid } = room;
    const width = grid.columns * grid.cellSize * METERS_PER_SIMULATION_UNIT;
    const depth = grid.rows * grid.cellSize * METERS_PER_SIMULATION_UNIT;
    const point = simulationToWorld(
      grid.x + grid.columns * grid.cellSize / 2,
      grid.y + grid.rows * grid.cellSize / 2,
    );
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      // This surface is intentionally invisible, but it is the authoritative
      // 3D picking surface for every navigable room. Double-sided keeps input
      // reliable while the tactical camera is panned around the threshold.
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(point.x, 0.03, point.z);
    floor.userData.roomId = room.id;
    this.floorSurfaces.push(floor);
    this.group.add(floor);
  }

  addRoomLight(room) {
    const { grid } = room;
    const point = simulationToWorld(
      grid.x + grid.columns * grid.cellSize / 2,
      grid.y + grid.rows * grid.cellSize / 2,
    );
    const color = room.id === 'relay-hall' ? 0x5bd9e2 : 0xf0a05d;
    const light = new THREE.PointLight(color, 18, 15, 2);
    light.position.set(point.x, 3.8, point.z);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    this.group.add(light);
  }

  clear() {
    this.floorSurfaces = [];
    this.group.clear();
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
