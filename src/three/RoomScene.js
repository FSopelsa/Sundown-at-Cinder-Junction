import * as THREE from 'three';
import { getRoomPalette } from '../game/content/rooms.js';
import { roomCellCenter } from '../game/simulation/roomNavigation.js';
import { METERS_PER_SIMULATION_UNIT, simulationToWorld } from './coordinates.js';
import { createFloorKit } from './floorKit.js';
import {
  disposeWallFadeMaterials,
  makeWallFadeable,
  updateWallOcclusion,
} from './wallOcclusion.js';

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
export function getRoomPerimeterWallSegments(map, room, roomState = null) {
  const { grid } = room;
  const edges = { north: [], south: [], west: [], east: [] };
  for (const connection of map.roomConnections ?? []) {
    if (!isDoorOpen(connection, roomState)) continue;
    const endpoint = connection.from.roomId === room.id
      ? connection.from
      : connection.to.roomId === room.id ? connection.to : null;
    if (!endpoint) continue;
    if (endpoint.col === 0) edges.west.push([endpoint.row * grid.cellSize, (endpoint.row + 1) * grid.cellSize]);
    else if (endpoint.col === grid.columns - 1) edges.east.push([endpoint.row * grid.cellSize, (endpoint.row + 1) * grid.cellSize]);
    else if (endpoint.row === 0) edges.north.push([endpoint.col * grid.cellSize, (endpoint.col + 1) * grid.cellSize]);
    else if (endpoint.row === grid.rows - 1) edges.south.push([endpoint.col * grid.cellSize, (endpoint.col + 1) * grid.cellSize]);
  }
  if (map.campaign) {
    const entries = [map.exit, ...map.campaign.encounters.flatMap(e => [e.spawn, e.goal].filter(Boolean))];
    for (const cell of entries.filter(c => c.roomId === room.id)) {
      if (cell.col === 0) edges.west.push([cell.row * grid.cellSize, (cell.row + 1) * grid.cellSize]);
      else if (cell.col === grid.columns - 1) edges.east.push([cell.row * grid.cellSize, (cell.row + 1) * grid.cellSize]);
      else if (cell.row === 0) edges.north.push([cell.col * grid.cellSize, (cell.col + 1) * grid.cellSize]);
    }
  }
  const splitAroundOpenings = (length, openings) => {
    const segments = [];
    let cursor = 0;
    for (const [start, end] of openings
      .map(([first, last]) => [Math.max(0, first), Math.min(length, last)])
      .filter(([first, last]) => last > first)
      .sort(([first], [second]) => first - second)) {
      if (start > cursor) segments.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < length) segments.push([cursor, length]);
    return segments;
  };
  return {
    north: splitAroundOpenings(grid.columns * grid.cellSize, edges.north),
    south: splitAroundOpenings(grid.columns * grid.cellSize, edges.south),
    west: splitAroundOpenings(grid.rows * grid.cellSize, edges.west),
    east: splitAroundOpenings(grid.rows * grid.cellSize, edges.east),
  };
}

function makeProceduralRoom(room, palette, map, roomState) {
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
  const wall = (side, spanX, spanZ, x, z, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(spanX, 1.5, spanZ), wallMaterial);
    mesh.name = `${room.id} wall ${side} ${index}`;
    mesh.position.set(x, 0.75, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.09, spanZ), trimMaterial);
    trim.name = `${room.id} trim ${side} ${index}`;
    trim.position.set(x, 1.54, z);
    group.add(trim);
  };
  const perimeter = getRoomPerimeterWallSegments(map, room, roomState);
  perimeter.north.forEach(([start, end], index) => {
    wall('north', (end - start) * METERS_PER_SIMULATION_UNIT, 0.18,
      (start + end) * METERS_PER_SIMULATION_UNIT / 2, 0, index);
  });
  perimeter.south.forEach(([start, end], index) => {
    wall('south', (end - start) * METERS_PER_SIMULATION_UNIT, 0.18,
      (start + end) * METERS_PER_SIMULATION_UNIT / 2, depth, index);
  });
  perimeter.west.forEach(([start, end], index) => {
    wall('west', 0.18, (end - start) * METERS_PER_SIMULATION_UNIT,
      0, (start + end) * METERS_PER_SIMULATION_UNIT / 2, index);
  });
  perimeter.east.forEach(([start, end], index) => {
    wall('east', 0.18, (end - start) * METERS_PER_SIMULATION_UNIT,
      width, (start + end) * METERS_PER_SIMULATION_UNIT / 2, index);
  });
  return group;
}

function makeBuildGrid(room, palette) {
  const { grid } = room;
  const cell = grid.cellSize * METERS_PER_SIMULATION_UNIT;
  const width = grid.columns * cell;
  const depth = grid.rows * cell;
  const vertices = [];
  for (let column = 0; column <= grid.columns; column += 1) {
    const x = column * cell;
    vertices.push(x, 0.016, 0, x, 0.016, depth);
  }
  for (let row = 0; row <= grid.rows; row += 1) {
    const z = row * cell;
    vertices.push(0, 0.016, z, width, 0.016, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const gridLines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: palette.trim,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  gridLines.name = `${room.id} build grid`;
  return gridLines;
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
    this.wallOccluders = [];
    this.owned ??= new Set();
  }

  build(map, roomState = map.roomState ?? null) {
    this.clear();
    this.group.name = `${map.name} rooms`;
    for (const room of getRenderableRooms(map).filter(room => !map.campaign || roomState.unlockedRoomIds.includes(room.id))) {
      const palette = getRoomPalette(room.environment?.palette);
      const { grid } = room;
      const position = simulationToWorld(grid.x, grid.y);
      const environment = this.modelLibrary.clone(room.environment?.model) ??
        makeProceduralRoom(room, palette, map, roomState);
      if (!room.environment?.model) this.collectOwned(environment);
      const floorKit = createFloorKit(room, this.modelLibrary);
      if (floorKit) {
        environment.traverse((node) => {
          if (/^Floor[ _](slab|plate)/.test(node.name) || node.name === `${room.id} floor`) node.visible = false;
        });
        if (map.campaign) {
          const tint = new THREE.Color({ rust: 0xbfa58e, teal: 0x86b6b7, ember: 0xc5a482, slag: 0xa3b39c, basalt: 0x94a7bb }[room.environment.palette] ?? 0xffffff);
          floorKit.traverse(node => {
            if (!node.isMesh) return;
            const tintMaterial = original => { const material = original.clone(); material.color.multiply(tint); this.owned.add(material); return material; };
            node.material = Array.isArray(node.material) ? node.material.map(tintMaterial) : tintMaterial(node.material);
          });
        }
        environment.add(floorKit);
      }
      environment.name = `${room.id} environment`;
      environment.position.set(position.x, 0, position.z);
      environment.traverse((node) => {
        if (!node.isMesh || !/wall/i.test(`${node.name} ${node.parent?.name ?? ''}`)) return;
        makeWallFadeable(node);
        this.wallOccluders.push(node);
      });
      this.group.add(environment);
      const gridLines = makeBuildGrid(room, palette);
      gridLines.position.set(position.x, 0, position.z);
      this.collectOwned(gridLines);
      this.group.add(gridLines);
      this.addFloorSurface(room);
      this.addRoomLight(room, palette);
    }
    for (const connection of map.roomConnections ?? []) {
      if (map.campaign && ![connection.from.roomId, connection.to.roomId].every(id => roomState.unlockedRoomIds.includes(id))) continue;
      const bridge = connectionBridge(map, connection, isDoorOpen(connection, roomState));
      if (bridge) this.collectOwned(bridge);
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
    this.collectOwned(floor);
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
    light.castShadow = false;
    light.shadow.mapSize.set(512, 512);
    this.group.add(light);
  }

  updateOcclusion(camera, target) {
    this.group.updateMatrixWorld(true);
    return updateWallOcclusion(camera, target, this.wallOccluders);
  }

  collectOwned(root) {
    root.traverse(node => {
      if (node.geometry) this.owned.add(node.geometry);
      for (const material of (Array.isArray(node.material) ? node.material : [node.material])) if (material) this.owned.add(material);
    });
  }

  clear() {
    for (const wall of this.wallOccluders) disposeWallFadeMaterials(wall);
    this.group.traverse((node) => {
      // Instance buffers are room-owned; their shared geometry/materials belong to ModelLibrary.
      if (node.isInstancedMesh) node.dispose();
    });
    this.floorSurfaces = [];
    this.wallOccluders = [];
    this.owned ??= new Set();
    this.group.clear();
    for (const resource of this.owned) resource.dispose();
    this.owned.clear();
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
