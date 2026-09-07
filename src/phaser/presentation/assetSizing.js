// Complete animation frames fit within the tile, including diamond corners.
export function tileAssetSize(map, isometric = false) {
  if (!isometric) return (map.grid?.cellSize ?? 40) * .9;
  const { halfWidth: w, halfHeight: h } = map.presentation;
  return 2*w*h/(w+h)*.9;
}
