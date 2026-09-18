import { createSimulation } from './game/simulation/createSimulation.js';
import { DEFAULT_3D_LEVEL_ID } from './game/content/map.js';
import { createGame } from './three/createGame.js';
import { Hud } from './ui/hud/Hud.js';
import './ui/styles.css';

const parameters = new URLSearchParams(window.location.search);
if (parameters.has('assets')) {
  const { createAssetViewer } = await import('./three/AssetViewer.js');
  const viewer = await createAssetViewer(document.querySelector('#app'));
  if (import.meta.hot) import.meta.hot.dispose(() => viewer.dispose());
} else {
  const requestedLevel = parameters.get('level');
  const simulation = createSimulation({ levelId: requestedLevel ?? DEFAULT_3D_LEVEL_ID });
  const hudRoot = document.querySelector('#hud-root');

  if (!(hudRoot instanceof HTMLElement)) {
    throw new Error('Missing #hud-root element.');
  }

  const hud = new Hud(hudRoot, simulation);
  hud.mount();

  const game = await createGame('game-root', simulation, hud);

  // Opt-in local diagnostics for reproducible game playtests; excluded from builds.
  if (import.meta.env.DEV && parameters.has('debug')) {
    window.__cinder = { game, simulation, hud };
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      hud.dispose();
      game.dispose();
      delete window.__cinder;
    });
  }
}
