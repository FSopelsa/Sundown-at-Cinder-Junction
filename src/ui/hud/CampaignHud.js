import { ELEMENTS, ELEMENT_REWARDS, getEncounter } from '../../game/content/campaign.js';
import { worldToRoomCell } from '../../game/simulation/roomNavigation.js';

export class CampaignHud {
  constructor(hud, saves, resumed) {
    Object.assign(this, { hud, simulation: hud.simulation, saves });
    this.savedRevision = this.simulation.state.campaign.saveRevision;
    this.message = resumed ? `Resumed ${resumed.kind === 'auto' ? 'room checkpoint' : 'machine save'} · ${new Date(resumed.savedAt).toLocaleString()}` : 'Room clears autosave. Use a room machine for any other save.';
    this.panel = document.createElement('section');
    this.panel.className = 'campaign-panel';
    this.panel.setAttribute('aria-label', 'Campaign progress');
    this.panel.innerHTML = `<span class="hud__eyebrow">Expanding campaign</span><strong data-campaign="title"></strong>
      <p data-campaign="objective"></p><div class="campaign-actions"><button data-campaign-action="save">Go to save machine</button><button data-campaign-action="hero">Find hero</button></div>
      <small data-campaign="save" aria-live="polite"></small>
      <details><summary>Rooms, elemental keys & checkpoints</summary><div data-campaign="rooms"></div><div data-campaign="trials"></div>
      <p data-campaign="keys"></p><button data-campaign-action="load-auto">Load room checkpoint</button><button data-campaign-action="load-manual">Load machine save</button><button data-campaign-action="new">New campaign</button>
      <small>Loading discards changes since that checkpoint. New campaign keeps your old checkpoints until you save again.</small></details>`;
    hud.root.append(this.panel);
    this.panel.addEventListener('click', event => this.click(event));
    hud.root.classList.add('campaign-mode');
    this.render();
  }
  click(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { state, map } = this.simulation;
    if (button.dataset.room) { this.focusRoom?.(button.dataset.room); return; }
    let targetId = button.dataset.trial ? `trial:${button.dataset.trial}` : null;
    const action = button.dataset.campaignAction;
    const heroRoom = worldToRoomCell(map, state.hero.x, state.hero.y)?.roomId ?? state.hero.navigationCell?.roomId;
    if (action === 'hero') { this.focusRoom?.(heroRoom); return; }
    if (action === 'save') targetId = `save:${heroRoom}`;
    if (targetId) {
      const result = this.simulation.dispatch('campaign-interact', { targetId });
      this.hud.showNotice(result.ok ? result.message : result.reason, result.ok ? 'neutral' : 'warning');
      this.hud.hideOutcome();
    }
    if (action?.startsWith('load-') || action === 'new') {
      const kind = action.slice(5);
      if (action !== 'new' && !this.saves.read(kind)) { this.message = this.saves.error ?? 'No checkpoint of that kind yet.'; this.render(); return; }
      const url = new URL(window.location.href);
      url.searchParams.set('level', map.id);
      url.searchParams.set('checkpoint', action === 'new' ? 'new' : kind);
      window.location.assign(url.href);
    }
  }
  update() {
    const { state } = this.simulation;
    if (state.campaign.saveRevision !== this.savedRevision) {
      this.savedRevision = state.campaign.saveRevision;
      const kind = state.campaign.saveKind;
      const result = this.saves.write(state, kind);
      this.message = result.ok ? `${kind === 'auto' ? 'Room autosave' : 'Machine save'} · ${new Date(result.savedAt).toLocaleTimeString()}` : result.reason;
      this.hud.showNotice(result.ok ? `${this.message}.` : result.reason, result.ok ? 'success' : 'warning');
    }
    const revision = JSON.stringify([state.campaign.activeEncounterId, state.campaign.completed, state.campaign.keys,
      state.roomState, Math.ceil(state.campaign.revealRemainingMs / 1000), state.campaign.pendingInteraction, state.wave.index, state.wave.inProgress, this.message]);
    if (revision !== this.revision) { this.revision = revision; this.render(); }
  }
  render() {
    const { map, state } = this.simulation;
    const campaign = state.campaign;
    const encounter = getEncounter(map, state);
    const put = (name, value) => { this.panel.querySelector(`[data-campaign="${name}"]`).textContent = value; };
    put('title', encounter ? `${encounter.label} · wave ${Math.min(encounter.waves, state.wave.index + (state.wave.inProgress ? 0 : 1))}/${encounter.waves}` : campaign.keys.length === 4 ? 'Four keys secured' : 'Explore the junction');
    put('objective', campaign.lastMessage);
    put('save', this.saves.error ?? (campaign.pendingInteraction?.targetId.startsWith('save:') ? 'Walking to machine… not saved yet.' : this.message));
    put('keys', `Final gate: ${campaign.keys.length}/4 elemental keys. Final boss encounter is planned for a future chapter.`);
    this.panel.querySelector('[data-campaign="rooms"]').innerHTML = map.rooms.filter(r => state.roomState.unlockedRoomIds.includes(r.id))
      .map(r => `<button data-room="${r.id}" title="Focus camera">${r.name}</button>`).join('');
    this.panel.querySelector('[data-campaign="trials"]').innerHTML = campaign.completed.includes('sun') ? ELEMENTS.map(element =>
      `<button data-trial="${element}" title="${ELEMENT_REWARDS[element]}" ${encounter || campaign.completed.includes(element) ? 'disabled' : ''}>${campaign.keys.includes(element) ? '✓' : 'Open'} ${element} trial</button>`).join('') : '';
    this.hud.elements.startWave.disabled = state.wave.inProgress || state.stationIntegrity <= 0 || !encounter || campaign.revealRemainingMs > 0;
    this.hud.elements.startWave.textContent = campaign.revealRemainingMs > 0 ? 'Revealing room…' : encounter ? 'Start wave' : 'Choose a trial';
  }
  dispose() { this.panel.remove(); this.hud.root.classList.remove('campaign-mode'); }
}
