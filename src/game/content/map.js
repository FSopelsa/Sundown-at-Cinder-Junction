const path = [
  { x: 0, y: 118 },
  { x: 250, y: 118 },
  { x: 250, y: 520 },
  { x: 590, y: 520 },
  { x: 590, y: 220 },
  { x: 930, y: 220 },
  { x: 930, y: 590 },
  { x: 1280, y: 590 },
].map(Object.freeze);

export const SWITCHYARD_MAP = Object.freeze({
  id: 'cinder-switchyard',
  width: 1280,
  height: 720,
  path: Object.freeze(path),
  buildMargin: 26,
  pathClearance: 55,
  towerSpacing: 38,
});

export function getPathLength(points = SWITCHYARD_MAP.path) {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }

  return length;
}

export function pointAlongPath(progress, points = SWITCHYARD_MAP.path) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const totalLength = getPathLength(points);
  let remaining = totalLength * clampedProgress;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (remaining <= segmentLength) {
      const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }

    remaining -= segmentLength;
  }

  return { ...points.at(-1) };
}

function distanceToSegment(x, y, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(x - start.x, y - start.y);
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      ((x - start.x) * segmentX + (y - start.y) * segmentY) /
        segmentLengthSquared,
    ),
  );

  return Math.hypot(
    x - (start.x + projection * segmentX),
    y - (start.y + projection * segmentY),
  );
}

export function distanceToPath(x, y, points = SWITCHYARD_MAP.path) {
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < points.length; index += 1) {
    shortestDistance = Math.min(
      shortestDistance,
      distanceToSegment(x, y, points[index - 1], points[index]),
    );
  }

  return shortestDistance;
}
