export const METERS_PER_SIMULATION_UNIT = 1 / 40;

export function simulationToWorld(x, y, elevation = 0) {
  return {
    x: x * METERS_PER_SIMULATION_UNIT,
    y: elevation,
    z: y * METERS_PER_SIMULATION_UNIT,
  };
}

export function worldToSimulation(point) {
  return {
    x: point.x / METERS_PER_SIMULATION_UNIT,
    y: point.z / METERS_PER_SIMULATION_UNIT,
  };
}

export function getMapWorldBounds(map) {
  if (map.mode === 'rooms') {
    const bounds = map.rooms.map((room) => {
      const { grid } = room;
      return {
        minX: grid.x * METERS_PER_SIMULATION_UNIT,
        maxX: (grid.x + grid.columns * grid.cellSize) * METERS_PER_SIMULATION_UNIT,
        minZ: grid.y * METERS_PER_SIMULATION_UNIT,
        maxZ: (grid.y + grid.rows * grid.cellSize) * METERS_PER_SIMULATION_UNIT,
      };
    });
    return {
      minX: Math.min(...bounds.map((entry) => entry.minX)),
      maxX: Math.max(...bounds.map((entry) => entry.maxX)),
      minZ: Math.min(...bounds.map((entry) => entry.minZ)),
      maxZ: Math.max(...bounds.map((entry) => entry.maxZ)),
    };
  }
  return {
    minX: 0,
    maxX: map.width * METERS_PER_SIMULATION_UNIT,
    minZ: 0,
    maxZ: map.height * METERS_PER_SIMULATION_UNIT,
  };
}
