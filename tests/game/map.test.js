import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SWITCHYARD_MAP,
  distanceToPath,
  pointAlongPath,
} from '../../src/game/content/map.js';

test('pointAlongPath returns the route endpoints', () => {
  assert.deepEqual(pointAlongPath(0), SWITCHYARD_MAP.path[0]);
  assert.deepEqual(pointAlongPath(1), SWITCHYARD_MAP.path.at(-1));
});

test('distanceToPath distinguishes rail and buildable ground', () => {
  assert.equal(distanceToPath(100, 118), 0);
  assert.ok(distanceToPath(100, 350) > SWITCHYARD_MAP.pathClearance);
});
