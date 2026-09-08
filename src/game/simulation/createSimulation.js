import { purchaseSupport } from './systems/SupportShop.js';
import { ACTIONS } from '../input/actions.js';
import { getMap } from '../content/map.js';
import { getElementalTrialWave } from '../content/waves.js';
import { GameState } from './GameState.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { EconomySystem } from './systems/EconomySystem.js';
import { ElementRecipeSystem } from './systems/ElementRecipeSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { HeroSystem } from './systems/HeroSystem.js';
import { StatusEffectSystem } from './systems/StatusEffectSystem.js';
import { TowerSystem } from './systems/TowerSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';

const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;

export function createSimulation(initialState = new GameState()) {
  const state =
    initialState instanceof GameState ? initialState : new GameState(initialState);
  const economySystem = new EconomySystem(state);
  const map = getMap(state.levelId);
  const combatSystem = new CombatSystem(state, economySystem);
  const statusEffectSystem = new StatusEffectSystem(state, combatSystem);
  const heroSystem = new HeroSystem(
    state,
    combatSystem,
    map,
    undefined,
    statusEffectSystem,
    economySystem,
  );
  const enemySystem = new EnemySystem(state, undefined, map, heroSystem);
  const towerSystem = new TowerSystem(
    state,
    economySystem,
    combatSystem,
    statusEffectSystem,
    undefined,
    map,
    heroSystem,
  );
  const waveSystem = new WaveSystem(state, enemySystem,
    map.waveSet === 'elemental-trial' ? getElementalTrialWave : undefined, heroSystem);
  const elementRecipeSystem = new ElementRecipeSystem();
  let accumulatorMs = 0;

  function tick(deltaMs) {
    waveSystem.update(deltaMs);
    statusEffectSystem.update(deltaMs);
    if (map.mode === 'maze') enemySystem.refreshMazeRoutes();
    if (map.mode === 'rooms') enemySystem.refreshRoomRoutes();
    heroSystem.update(deltaMs);
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
      case ACTIONS.upgradeTower:
        return towerSystem.upgradeTower(payload.towerId, payload.upgrade);
      case ACTIONS.purchaseSupport:
        return purchaseSupport(state, economySystem, heroSystem, payload.towerId, payload.item);
      case ACTIONS.sellTower:
        return towerSystem.sellTower(payload.towerId);
      case ACTIONS.moveHero:
        return heroSystem.commandMove(payload.x, payload.y);
      case ACTIONS.castHeroSkill:
        return heroSystem.castHeroSkill(payload.skillId, payload.x, payload.y);
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
    map,
    state,
    systems: {
      combatSystem,
      economySystem,
      elementRecipeSystem,
      enemySystem,
      heroSystem,
      statusEffectSystem,
      towerSystem,
      waveSystem,
    },
    dispatch,
    update,
  };
}
