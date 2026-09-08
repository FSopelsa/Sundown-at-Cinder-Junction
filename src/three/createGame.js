import { BattlefieldRenderer } from './BattlefieldRenderer.js';

export async function createGame(parent, simulation, hud) {
  const container = typeof parent === 'string' ? document.getElementById(parent) : parent;
  const renderer = new BattlefieldRenderer(container, simulation, hud);
  return renderer.initialize();
}
