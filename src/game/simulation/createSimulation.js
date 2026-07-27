import { ACTIONS } from '../input/actions.js';
import { GameState } from './GameState.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { EconomySystem } from './systems/EconomySystem.js';
import { ElementRecipeSystem } from './systems/ElementRecipeSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { StatusEffectSystem } from './systems/StatusEffectSystem.js';
import { TowerSystem } from './systems/TowerSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';

const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;

export function createSimulation(initialState = new GameState()) {
  const state =
    initialState instanceof GameState ? initialState : new GameState(initialState);
  const economySystem = new EconomySystem(state);
  const combatSystem = new CombatSystem(state, economySystem);
  const enemySystem = new EnemySystem(state);
  const statusEffectSystem = new StatusEffectSystem(state, combatSystem);
  const towerSystem = new TowerSystem(
    state,
    economySystem,
    combatSystem,
  );
  const waveSystem = new WaveSystem(state, enemySystem);
  const elementRecipeSystem = new ElementRecipeSystem();
  let accumulatorMs = 0;

  function tick(deltaMs) {
    waveSystem.update(deltaMs);
    statusEffectSystem.update(deltaMs);
    towerSystem.update(deltaMs);
    enemySystem.update(deltaMs);
    waveSystem.completeIfFinished();
  }

  function update(deltaMs) {
    if (state.settings.paused || state.stationIntegrity <= 0) {
      return;
    }

    const frameMs = Math.min(MAX_FRAME_MS, Math.max(0, deltaMs));
    accumulatorMs += frameMs * state.settings.speed;

    while (accumulatorMs >= FIXED_STEP_MS) {
      tick(FIXED_STEP_MS);
      accumulatorMs -= FIXED_STEP_MS;
    }
  }

  function dispatch(action, payload = {}) {
    switch (action) {
      case ACTIONS.startWave:
        return waveSystem.startNextWave();
      case ACTIONS.placeTower:
        return towerSystem.placeTower(
          payload.towerType ?? 'peacemaker',
          payload.x,
          payload.y,
        );
      case ACTIONS.togglePause:
        state.settings.paused = !state.settings.paused;
        return { ok: true, paused: state.settings.paused };
      case ACTIONS.setSpeed:
        if (payload.speed !== 1 && payload.speed !== 2) {
          return { ok: false, reason: 'Speed must be 1 or 2.' };
        }

        state.settings.speed = payload.speed;
        return { ok: true, speed: state.settings.speed };
      default:
        return { ok: false, reason: `Unknown action: ${action}` };
    }
  }

  return {
    state,
    systems: {
      combatSystem,
      economySystem,
      elementRecipeSystem,
      enemySystem,
      statusEffectSystem,
      towerSystem,
      waveSystem,
    },
    dispatch,
    update,
  };
}
