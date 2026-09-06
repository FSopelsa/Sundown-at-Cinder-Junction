// Pure view transform. World coordinates and distances always stay in the simulation.
export class BattlefieldProjection {
  constructor(map, flat = false) {
    this.map = map;
    this.isometric = map.presentation?.type === 'isometric' && !flat;
  }

  project(x, y, elevation = 0) {
    if (!this.isometric) return { x, y: y - elevation };
    const { grid, presentation: view } = this.map;
    const col = (x - grid.x) / grid.cellSize;
    const row = (y - grid.y) / grid.cellSize;
    return { x: view.originX + (col - row) * view.halfWidth,
      y: view.originY + (col + row) * view.halfHeight - elevation };
  }

  unproject(x, y) {
    if (!this.isometric) return { x, y };
    const { grid, presentation: view } = this.map;
    const difference = (x - view.originX) / view.halfWidth;
    const sum = (y - view.originY) / view.halfHeight;
    return { x: grid.x + (sum + difference) / 2 * grid.cellSize,
      y: grid.y + (sum - difference) / 2 * grid.cellSize };
  }

  cellPolygon(col, row, inset = 0) {
    const { grid } = this.map;
    const x = grid.x + col * grid.cellSize, y = grid.y + row * grid.cellSize;
    const size = grid.cellSize;
    return [[x + inset, y + inset], [x + size - inset, y + inset],
      [x + size - inset, y + size - inset], [x + inset, y + size - inset]]
      .map(([px, py]) => this.project(px, py));
  }

  circle(x, y, radius, segments = 48) {
    return Array.from({ length: segments }, (_, i) => {
      const angle = i * 2 * Math.PI / segments;
      return this.project(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    });
  }

  depth(x, y) {
    return 10 + this.project(x, y).y / 1000;
  }
}
