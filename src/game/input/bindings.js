import { ACTIONS } from './actions.js';

export const KEY_BINDINGS = Object.freeze({
  ' ': Object.freeze({ action: ACTIONS.startWave }),
  p: Object.freeze({ action: ACTIONS.togglePause }),
  '1': Object.freeze({ action: ACTIONS.setSpeed, payload: { speed: 1 } }),
  '2': Object.freeze({ action: ACTIONS.setSpeed, payload: { speed: 2 } }),
});
