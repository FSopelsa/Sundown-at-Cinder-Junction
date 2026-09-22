// Room maps are authored as data: a list of rooms with local grids, connection
// edges between room cells, and a palette name per room. The simulation only
// reads grids and door IDs, and the presentation resolves the palette, so a new
// room or a whole new level stays a content change instead of a renderer change.

export const ROOM_CELL_SIZE = 40;

// Frame the authored rooms with a small margin so tactical framing and the
// legacy width/height fields stay meaningful for room maps.
export const ROOM_MAP_MARGIN = 80;

export const DEFAULT_ROOM_PALETTE_ID = 'rust';

// Colours only. Distinctive geometry ships as an optional GLB per room through
// `environment.model`; everything else is generated from these swatches.
export const ROOM_PALETTES = Object.freeze({
  rust: Object.freeze({
    name: 'Rusted yard',
    floor: 0x4a2415,
    wall: 0x172128,
    trim: 0x8a4a24,
    light: 0xf0a05d,
    lightIntensity: 18,
  }),
  teal: Object.freeze({
    name: 'Relay teal',
    floor: 0x0f4f52,
    wall: 0x172128,
    trim: 0x2c8f92,
    light: 0x5bd9e2,
    lightIntensity: 18,
  }),
  ember: Object.freeze({
    name: 'Smelt ember',
    floor: 0x5a2a12,
    wall: 0x201a18,
    trim: 0xb4571c,
    light: 0xff8a3d,
    lightIntensity: 22,
  }),
  slag: Object.freeze({
    name: 'Slag gallery',
    floor: 0x3a3026,
    wall: 0x1b1b1f,
    trim: 0x6f7a3a,
    light: 0xb6e06a,
    lightIntensity: 15,
  }),
  basalt: Object.freeze({
    name: 'Cold basalt',
    floor: 0x2a2f33,
    wall: 0x14181b,
    trim: 0x4c606b,
    light: 0x8fb7c9,
    lightIntensity: 16,
  }),
});

export function getRoomPalette(paletteId) {
  return ROOM_PALETTES[paletteId] ?? ROOM_PALETTES[DEFAULT_ROOM_PALETTE_ID];
}

export function roomCell(roomId, col, row) {
  return Object.freeze({ roomId, col, row });
}

function defineEnvironment(environment = {}) {
  return Object.freeze({
    model: null,
    ...environment,
    palette: environment.palette ?? DEFAULT_ROOM_PALETTE_ID,
  });
}

export function defineRoom({ id, name, x, y, columns, rows, cellSize = ROOM_CELL_SIZE, environment }) {
  return Object.freeze({
    id,
    name,
    grid: Object.freeze({ x, y, columns, rows, cellSize }),
    environment: defineEnvironment(environment),
  });
}

export function defineRoomConnection({ id, name, from, to, initiallyOpen = true }) {
  return Object.freeze({
    id,
    name,
    from: Object.freeze({ ...from }),
    to: Object.freeze({ ...to }),
    initiallyOpen,
  });
}

export function getRoomBounds(room) {
  const { grid } = room;
  return {
    minX: grid.x,
    maxX: grid.x + grid.columns * grid.cellSize,
    minY: grid.y,
    maxY: grid.y + grid.rows * grid.cellSize,
  };
}

// A door counts as open when it says so; `initiallyOpen: false` seals a
// connection that later progression can unlock through `roomState.openDoorIds`.
function defaultOpenDoorIds(connections) {
  return connections
    .filter((connection) => connection.initiallyOpen !== false)
    .map((connection) => connection.id);
}

export function defineRoomMap({
  id,
  name,
  startingScrap,
  rooms,
  connections = [],
  entrance,
  exit,
  heroSpawn,
  waveSet = null,
  margin = ROOM_MAP_MARGIN,
  unlockedRoomIds = null,
  openDoorIds = null,
  pickupSpawns = [],
  pickupSpawnPoint = null,
}) {
  const frozenRooms = Object.freeze(rooms.map((room) => Object.freeze(room)));
  const frozenConnections = Object.freeze(connections.map((connection) => Object.freeze(connection)));
  const bounds = frozenRooms.map(getRoomBounds);

  return Object.freeze({
    id,
    name,
    mode: 'rooms',
    width: Math.max(...bounds.map((entry) => entry.maxX)) + margin,
    height: Math.max(...bounds.map((entry) => entry.maxY)) + margin,
    startingScrap,
    rooms: frozenRooms,
    roomConnections: frozenConnections,
    entrance: Object.freeze({ ...entrance }),
    exit: Object.freeze({ ...exit }),
    heroSpawn: Object.freeze({ ...heroSpawn }),
    waveSet,
    pickupSpawns: Object.freeze(pickupSpawns.map((pickup) => Object.freeze({ ...pickup }))),
    pickupSpawnPoint: pickupSpawnPoint ? Object.freeze({ ...pickupSpawnPoint }) : null,
    roomState: Object.freeze({
      unlockedRoomIds: Object.freeze(unlockedRoomIds ?? frozenRooms.map((room) => room.id)),
      openDoorIds: Object.freeze(openDoorIds ?? defaultOpenDoorIds(frozenConnections)),
    }),
    presentation: Object.freeze({ type: 'three' }),
  });
}
