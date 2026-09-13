import * as THREE from 'three';
import { getRoomPalette } from '../game/content/rooms.js';
import { roomCellCenter } from '../game/simulation/roomNavigation.js';
import { METERS_PER_SIMULATION_UNIT, simulationToWorld } from './coordinates.js';

function getRenderableRooms(map) {
  if (map.mode === 'rooms') return map.rooms;
  if (map.mode === 'maze') return [{ id: map.id, grid: map.grid, environment: null }];
  return [{
    id: map.id,
    grid: { x: 0, y: 0, columns: Math.ceil(map.width / 40), rows: Math.ceil(map.height / 40), cellSize: 40 },
    environment: null,
  }];
}

// Grid walls, floors, and trim are generated from the room palette, so a new
// room only needs a palette name in content. Distinctive rooms opt into a GLB
// through `environment.model`.
function makeProceduralRoom(room, palette) {
  const { grid } = room;
  const width = grid.columns * grid.cellSize * METERS_PER_SIMULATION_UNIT;
  const depth = grid.rows * grid.cellSize * METERS_PER_SIMULATION_UNIT;
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.20, depth),
    new THREE.MeshStandardMaterial({ color: palette.floor, metalness: 0.55, roughness: 0.68 }),
  );
  floor.name = `${room.id} floor`;
  floor.position.set(width / 2, -0.10, depth / 2);
  floor.receiveShadow = true;
  group.add(floor);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: palette.wall, metalness: 0.75, roughness: 0.52 });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: palette.trim,
    metalness: 0.62,
    roughness: 0.44,
    emissive: palette.trim,
    emissiveIntensity: 0.22,
  });
  const wall = (side, spanX, spanZ, x, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(spanX, 1.5, spanZ), wallMaterial);
    mesh.name = `${room.id} wall ${side}`;
    mesh.position.set(x, 0.75, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.09, spanZ), trimMaterial);
    trim.name = `${room.id} trim ${side}`;
    trim.position.set(x, 1.54, z);
    group.add(trim);
  };
  wall('north', width, 0.18, width / 2, 0);
  wall('south', width, 0.18, width / 2, depth);
  wall('west', 0.18, depth, 0, depth / 2);
  wall('east', 0.18, depth, width, depth / 2);
  return group;
}

function isDoorOpen(connection, roomState) {
  if (Array.isArray(roomState?.openDoorIds)) return roomState.openDoorIds.includes(connection.id);
  return connection.initiallyOpen !== false;
}

function connectionBridge(map, connection, open) {
  const from = roomCellCenter(map, connection.from);
  const to = roomCellCenter(map, connection.to);
  if (!from || !to) return null;
  const fromWorld = simulationToWorld(from.x, from.y);
  const toWorld = simulationToWorld(to.x, to.y);
  const dx = toWorld.x - fromWorld.x;
  const dz = toWorld.z - fromWorld.z;
  const length = Math.hypot(dx, dz);
  const bridge = new THREE.Group();
  bridge.name = `${connection.id} ${open ? 'bridge' : 'sealed bridge'}`;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.3, 0.16, 0.88),
    new THREE.MeshStandardMaterial({
      color: open ? 0x2b3131 : 0x1b1f22,
      metalness: 0.82,
      roughness: open ? 0.42 : 0.66,
    }),
  );
  deck.name = `${connection.id} deck`;
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridge.add(deck);
  if (open) {
    const light = new THREE.PointLight(0x6fe6d9, 6, 5, 2);
    light.position.set(0, 1.4, 0);
    bridge.add(light);
  } else {
    // A sealed connection stays visible so players can read the shortcut a
    // later unlock opens, but it must never look walkable.
    const shutter = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1.5, 1.05),
      new THREE.MeshStandardMaterial({ color: 0x3d2b1c, metalness: 0.7, roughness: 0.55 }),
    );
    shutter.name = `${connection.id} shutter`;
    shutter.position.set(0, 0.75, 0);
    shutter.castShadow = true;
    bridge.add(shutter);
  }
  bridge.position.set((fromWorld.x + toWorld.x) / 2, 0, (fromWorld.z + toWorld.z) / 2);
  bridge.rotation.y = -Math.atan2(dz, dx);
  return bridge;
}

export class RoomScene {
  constructor(scene, modelLibrary) {
    this.scene = scene;
    this.modelLibrary = modelLibrary;
    this.group = new THREE.Group();
    this.group.name = 'Cinder rooms';
    this.scene.add(this.group);
    this.floorSurfaces = [];
  }

  build(map, roomState = map.roomState ?? null) {
    this.clear();
    this.group.name = `${map.name} rooms`;
    for (const room of getRenderableRooms(map)) {
      const palette = getRoomPalette(room.environment?.palette);
      const { grid } = room;
      const position = simulationToWorld(grid.x, grid.y);
      const environment = this.modelLibrary.clone(room.environment?.model) ??
        makeProceduralRoom(room, palette);
      environment.name = `${room.id} environment`;
      environment.position.set(position.x, 0, position.z);
      this.group.add(environment);
      this.addFloorSurface(room);
      this.addRoomLight(room, palette);
    }
    for (const connection of map.roomConnections ?? []) {
      const bridge = connectionBridge(map, connection, isDoorOpen(connection, roomState));
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

  addRoomLight(room, palette) {
    const { grid } = room;
    const point = simulationToWorld(
      grid.x + grid.columns * grid.cellSize / 2,
      grid.y + grid.rows * grid.cellSize / 2,
    );
    const light = new THREE.PointLight(palette.light, palette.lightIntensity, 15, 2);
    light.name = `${room.id} light`;
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
