import { ELEMENTS, ELEMENT_REWARDS, getEncounter } from '../../content/campaign.js';
import { roomCellCenter } from '../roomNavigation.js';

export function createCampaignState(map, snapshot) {
  if (!map.campaign) return null;
  return { activeEncounterId: 'room-1', completed: [], keys: [], revealRemainingMs: 0,
    lastRevealedRoomId: 'room-1', saveRevision: 0, saveKind: 'auto', pendingInteraction: null,
    lastMessage: 'Build defenses, then start the first wave. Your portal is on the east wall.',
    ...structuredClone(snapshot ?? {}) };
}

export class CampaignSystem {
  constructor(state, map, heroSystem) { Object.assign(this, { state, map, heroSystem }); }

  interact(targetId) {
    const { state, map } = this;
    if (!state.hero.alive || state.stationIntegrity <= 0) return { ok: false, reason: 'Singularity must be alive to use a machine or door.' };
    if (state.towers.some(t => t.construction)) return { ok: false, reason: 'Finish the current construction orders before leaving for a machine or door.' };
    const terminalRoom = map.rooms.find(r => `save:${r.id}` === targetId && state.roomState.unlockedRoomIds.includes(r.id));
    const element = ELEMENTS.find(id => `trial:${id}` === targetId);
    let cell = terminalRoom?.terminal;
    if (element) {
      if (!state.campaign.completed.includes('sun')) return { ok: false, reason: 'Clear the sun junction first.' };
      if (getEncounter(map, state) && !state.campaign.completed.includes(state.campaign.activeEncounterId)) return { ok: false, reason: 'Complete the active encounter before choosing another branch.' };
      if (state.campaign.completed.includes(element)) return { ok: false, reason: 'That elemental key and upgrade are already secured.' };
      cell = map.roomConnections.find(d => d.id === `${element}-door`).from;
    }
    if (!cell) return { ok: false, reason: 'That interaction is unavailable.' };
    const target = roomCellCenter(map, cell);
    const result = this.heroSystem.commandMove(target.x, target.y);
    if (!result.ok) return result;
    state.campaign.pendingInteraction = { targetId, cell: { ...cell } };
    return { ok: true, message: terminalRoom ? 'Walking to the save machine. Saving happens on arrival.' : `Walking to the ${element} trial door.` };
  }

  requestSave(kind) {
    this.state.campaign.saveRevision++;
    this.state.campaign.saveKind = kind;
  }

  reveal(ids, doors, focus) {
    const { state } = this;
    state.roomState.unlockedRoomIds = [...new Set([...state.roomState.unlockedRoomIds, ...ids])];
    state.roomState.openDoorIds = [...new Set([...state.roomState.openDoorIds, ...doors])];
    state.campaign.lastRevealedRoomId = focus;
    state.campaign.revealRemainingMs = 3200;
  }

  selectEncounter(id) {
    this.state.campaign.activeEncounterId = id;
    this.state.wave = { index: 0, inProgress: false, completed: false, isBounty: false, label: '', elapsedMs: 0, carryoverCount: 0, spawnQueue: [] };
    this.state.carryoverEnemies = [];
    this.state.wormholes = [];
  }

  update(deltaMs) {
    const { state, map } = this;
    const campaign = state.campaign;
    campaign.revealRemainingMs = Math.max(0, campaign.revealRemainingMs - deltaMs);
    const pending = campaign.pendingInteraction;
    if (pending && !state.hero.alive) campaign.pendingInteraction = null;
    if (pending && state.hero.alive) {
      const point = roomCellCenter(map, pending.cell);
      if (Math.hypot(state.hero.x - point.x, state.hero.y - point.y) < 24) {
        campaign.pendingInteraction = null;
        if (pending.targetId.startsWith('save:')) {
          this.requestSave('manual');
        } else {
          const id = pending.targetId.slice(6);
          this.selectEncounter(id);
          this.reveal([id], [`${id}-door`], id);
          campaign.lastMessage = `${getEncounter(map, state).label} opened. Build inside the trial, then start its waves. Its local relay must survive.`;
          state.scrap += 420; // One entry grant; encounter cannot be abandoned or replayed.
        }
      }
    }
    const encounter = getEncounter(map, state);
    if (!encounter || campaign.completed.includes(encounter.id) || !state.wave.completed || state.wave.index < encounter.waves || state.stationIntegrity <= 0) return;
    campaign.completed.push(encounter.id);
    state.scrap += 240;
    state.stationIntegrity = Math.min(100, state.stationIntegrity + 12);
    this.heroSystem.reviveForNextWave();
    state.hero.hp = state.hero.maxHp;
    if (encounter.element) {
      campaign.keys.push(encounter.element);
      campaign.lastMessage = `${encounter.label} cleared. Key secured. ${ELEMENT_REWARDS[encounter.element]}.`;
      campaign.activeEncounterId = null;
      if (campaign.keys.length === 4) campaign.lastMessage += ' All four keys recovered; final boss content is reserved for the next chapter.';
    } else if (encounter.id === 'room-1') {
      this.selectEncounter('room-2');
      this.reveal(['room-2'], ['vault-door'], 'room-2');
      campaign.lastMessage = 'Room 1 secured. The door stays open. Enemies now approach through Room 2.';
    } else if (encounter.id === 'room-2') {
      this.selectEncounter('sun');
      this.reveal(['sun'], ['sun-door'], 'sun');
      campaign.lastMessage = 'The sun junction is live. Enemies must take its seal before passing south; it regenerates them for seven seconds.';
    } else {
      campaign.activeEncounterId = null;
      this.reveal(['boss', 'workshop'], ['boss-door', 'workshop-door'], 'sun');
      campaign.lastMessage = 'Junction secured. Explore the dormant boss room to the east, or choose an elemental trial at the workshop to the west.';
    }
    this.requestSave('auto');
  }
}
