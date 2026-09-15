import assert from 'node:assert/strict';
import test from 'node:test';
import { THRESHOLD_MAP } from '../../src/game/content/map.js';
import { roomCellCenter } from '../../src/game/simulation/roomNavigation.js';
import { getWallTopology } from '../../src/three/wallTopology.js';

function wall(id, roomId, col, row) {
  return { id, type: 'wall', ...roomCellCenter(THRESHOLD_MAP, { roomId, col, row }) };
}

test('adjacent horizontal walls hide their shared end caps', () => {
  const first = wall('wall-a', 'arrival-yard', 4, 4);
  const second = wall('wall-b', 'arrival-yard', 5, 4);

  assert.deepEqual(getWallTopology(THRESHOLD_MAP, first, [first, second]), {
    axis: 'x',
    cross: false,
    showNegativeEndCap: true,
    showPositiveEndCap: false,
  });
  assert.deepEqual(getWallTopology(THRESHOLD_MAP, second, [first, second]), {
    axis: 'x',
    cross: false,
    showNegativeEndCap: false,
    showPositiveEndCap: true,
  });
});

test('adjacent vertical walls rotate to the room row axis and hide their join', () => {
  const north = wall('wall-north', 'relay-hall', 6, 7);
  const south = wall('wall-south', 'relay-hall', 6, 8);

  assert.deepEqual(getWallTopology(THRESHOLD_MAP, north, [north, south]), {
    axis: 'z',
    cross: false,
    showNegativeEndCap: false,
    showPositiveEndCap: true,
  });
  assert.deepEqual(getWallTopology(THRESHOLD_MAP, south, [north, south]), {
    axis: 'z',
    cross: false,
    showNegativeEndCap: true,
    showPositiveEndCap: false,
  });
});

test('a cross layout preserves both axes for the presenter', () => {
  const centre = wall('wall-centre', 'arrival-yard', 8, 8);
  const west = wall('wall-west', 'arrival-yard', 7, 8);
  const north = wall('wall-north', 'arrival-yard', 8, 7);

  assert.deepEqual(getWallTopology(THRESHOLD_MAP, centre, [centre, west, north]), {
    axis: 'x',
    cross: true,
    showNegativeEndCap: false,
    showPositiveEndCap: true,
  });
});

test('walls in different rooms never visually join across the room gap', () => {
  const arrival = wall('wall-arrival', 'arrival-yard', 13, 4);
  const relay = wall('wall-relay', 'relay-hall', 0, 4);

  assert.deepEqual(getWallTopology(THRESHOLD_MAP, arrival, [arrival, relay]), {
    axis: 'x',
    cross: false,
    showNegativeEndCap: true,
    showPositiveEndCap: true,
  });
});
