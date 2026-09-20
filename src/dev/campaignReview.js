import { createSimulation } from '../game/simulation/createSimulation.js';

// Development-only review entry: exercise the real clear transitions without
// requiring eight waves before reviewing the four landmarks. Its saves have
// their own namespace, so review sessions cannot overwrite the player's run.
export function createJunctionReview() {
  const simulation = createSimulation({ levelId: 'cinder-campaign' });
  for (let i = 0; i < 3; i++) {
    const encounter = simulation.map.campaign.encounters.find(e => e.id === simulation.state.campaign.activeEncounterId);
    Object.assign(simulation.state.wave, { index: encounter.waves, inProgress: false, completed: true, label: encounter.label });
    simulation.systems.campaignSystem.update(17);
  }
  const state = simulation.state;
  state.campaign.revealRemainingMs = 0;
  state.hero.x = 1580; state.hero.y = 1020;
  state.hero.navigationCell = { roomId: 'sun', col: 8, row: 10 };
  state.hero.navigationNext = null; state.hero.route = []; state.hero.destination = null;
  return state;
}
