import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GameState,
  SAVE_SCHEMA_VERSION,
} from '../../src/game/simulation/GameState.js';

test('GameState serializes as an object and restores plain simulation data', () => {
  const state = new GameState();
  state.towers.push({ id: 'tower-1', x: 10, y: 20 });
  state.enemies.push({
    id: 'enemy-2',
    hp: 10,
    effects: [{ id: 'effect-3', type: 'slow', remainingMs: 500 }],
  });
  state.carryoverEnemies.push({
    enemyType: 'rustRunner',
    sourceWaveIndex: 2,
  });
  state.wave.carryoverCount = 1;

  const serialized = JSON.stringify(state);
  const parsed = JSON.parse(serialized);

  assert.equal(typeof parsed, 'object');
  assert.equal(parsed.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(parsed.towers[0].id, 'tower-1');
  assert.equal(parsed.enemies[0].effects[0].type, 'slow');
  assert.equal(parsed.carryoverEnemies[0].enemyType, 'rustRunner');
  assert.equal(parsed.wave.carryoverCount, 1);

  const restored = GameState.fromJSON(serialized);
  assert.deepEqual(restored.toJSON(), parsed);
});

test('GameState rejects save files with an unknown schema', () => {
  assert.throws(
    () => GameState.fromJSON({ schemaVersion: 999 }),
    /Unsupported save schema/,
  );
});
