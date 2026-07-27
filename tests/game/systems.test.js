import assert from 'node:assert/strict';
import test from 'node:test';
import { GameState } from '../../src/game/simulation/GameState.js';
import { EconomySystem } from '../../src/game/simulation/systems/EconomySystem.js';
import { ElementRecipeSystem } from '../../src/game/simulation/systems/ElementRecipeSystem.js';

test('EconomySystem never accepts negative or non-finite amounts', () => {
  const economy = new EconomySystem(new GameState());

  assert.throws(() => economy.spendScrap(-1), /non-negative/);
  assert.throws(() => economy.awardScrap(Number.NaN), /non-negative/);
});

test('ElementRecipeSystem resolves recipes independent of element order', () => {
  const recipes = new ElementRecipeSystem();

  assert.equal(recipes.getFusion('solar', 'cryo').id, 'boilerhouse');
  assert.equal(recipes.getFusion('cryo', 'solar').id, 'boilerhouse');
  assert.equal(recipes.getFusion('arc', 'cryo'), null);
});
