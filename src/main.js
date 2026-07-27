import { createSimulation } from './game/simulation/createSimulation.js';
import { createGame } from './phaser/createGame.js';
import { Hud } from './ui/hud/Hud.js';
import './ui/styles.css';

const simulation = createSimulation();
const hudRoot = document.querySelector('#hud-root');

if (!(hudRoot instanceof HTMLElement)) {
  throw new Error('Missing #hud-root element.');
}

const hud = new Hud(hudRoot, simulation);
hud.mount();

const game = createGame('game-root', simulation, hud);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    hud.dispose();
    game.destroy(true);
  });
}
