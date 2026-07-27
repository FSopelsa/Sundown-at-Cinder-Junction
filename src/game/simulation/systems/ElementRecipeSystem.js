import { FUSION_RECIPES } from '../../content/recipes.js';

function recipeKey(firstElement, secondElement) {
  return [firstElement, secondElement].sort().join(':');
}

export class ElementRecipeSystem {
  constructor(recipes = FUSION_RECIPES) {
    this.recipes = recipes;
  }

  getFusion(firstElement, secondElement) {
    return this.recipes[recipeKey(firstElement, secondElement)] ?? null;
  }
}
