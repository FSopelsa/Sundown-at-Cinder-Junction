import { CampaignSaves, SAVE_PREFIX } from './game/saves.js';
import { CampaignHud } from './ui/hud/CampaignHud.js';
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
} else if ((!parameters.has('level') || parameters.get('level') === 'cinder-siege') && !parameters.has('review') && !parameters.has('checkpoint')) {
  const { createSiegeGame } = await import('./three/siege/createSiegeGame.js');
  const siege = await createSiegeGame();
  if (import.meta.env.DEV && parameters.has('debug')) window.__siege = siege;
  if (import.meta.hot) import.meta.hot.dispose(() => { siege.dispose(); delete window.__siege; });
} else {
  const requestedLevel = parameters.get('level');
  const review = import.meta.env.DEV && parameters.get('review') === 'junction';
  const storageKey = key => review ? key.replace(SAVE_PREFIX, 'cinder.review.v2.') : key;
  const saves = new CampaignSaves({ getItem: key => window.localStorage.getItem(storageKey(key)), setItem: (key, value) => window.localStorage.setItem(storageKey(key), value) });
  const checkpoint = parameters.get('checkpoint');
  const resumed = (requestedLevel ?? DEFAULT_3D_LEVEL_ID) === 'cinder-campaign' && checkpoint !== 'new'
    ? checkpoint ? saves.read(checkpoint) : saves.latest() : null;
  const reviewState = review && !resumed ? (await import('./dev/campaignReview.js')).createJunctionReview() : null;
  const simulation = createSimulation(resumed?.state ?? reviewState ?? { levelId: requestedLevel ?? DEFAULT_3D_LEVEL_ID });
  if (checkpoint || !requestedLevel) { const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete('checkpoint'); cleanUrl.searchParams.set('level', simulation.state.levelId); window.history.replaceState(null, '', cleanUrl); }
  const hudRoot = document.querySelector('#hud-root');

  if (!(hudRoot instanceof HTMLElement)) {
    throw new Error('Missing #hud-root element.');
  }

  const hud = new Hud(hudRoot, simulation);
  hud.mount();
  if (simulation.state.campaign) hud.campaignHud = new CampaignHud(hud, saves, resumed);
  if (review) {
    hud.campaignHud.panel.querySelector('.hud__eyebrow').textContent = 'Review sandbox · separate saves';
    hud.campaignHud.panel.querySelector('[data-campaign-action="new"]').textContent = 'Reset review';
  }

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
