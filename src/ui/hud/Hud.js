import { FINAL_WAVE_INDEX } from '../../game/content/waves.js';
import { ACTIONS } from '../../game/input/actions.js';

export class Hud {
  constructor(root, simulation) {
    this.root = root;
    this.simulation = simulation;
    this.animationFrame = null;
    this.lastRenderKey = '';
  }

  mount() {
    this.root.innerHTML = `
      <section class="hud" aria-label="Game status and controls">
        <div class="hud__brand">
          <span class="hud__eyebrow">Circuit Marshal Console</span>
          <strong>Sundown at Cinder Junction</strong>
        </div>

        <div class="hud__status" aria-live="polite">
          <span>Scrap <strong data-hud="scrap">0</strong></span>
          <span>Integrity <strong data-hud="integrity">100</strong></span>
          <span>Raid <strong data-hud="wave">Standby</strong></span>
          <span>Hostiles <strong data-hud="enemies">0</strong></span>
        </div>

        <div class="hud__controls">
          <button type="button" data-action="start-wave">Start raid</button>
          <button type="button" data-action="pause">Pause</button>
          <button type="button" data-action="speed-1">1×</button>
          <button type="button" data-action="speed-2">2×</button>
        </div>

        <p class="hud__hint">
          Click away from the rail to deploy a Peacemaker for 40 Scrap.
          Keyboard: Space starts a raid, P pauses, 1/2 changes speed.
        </p>

        <p class="hud__notice" data-hud="notice" aria-live="polite"></p>
      </section>
    `;

    this.elements = {
      scrap: this.root.querySelector('[data-hud="scrap"]'),
      integrity: this.root.querySelector('[data-hud="integrity"]'),
      wave: this.root.querySelector('[data-hud="wave"]'),
      enemies: this.root.querySelector('[data-hud="enemies"]'),
      notice: this.root.querySelector('[data-hud="notice"]'),
      startWave: this.root.querySelector('[data-action="start-wave"]'),
      pause: this.root.querySelector('[data-action="pause"]'),
      speed1: this.root.querySelector('[data-action="speed-1"]'),
      speed2: this.root.querySelector('[data-action="speed-2"]'),
    };

    this.elements.startWave.addEventListener('click', () => {
      const result = this.simulation.dispatch(ACTIONS.startWave);
      this.showNotice(
        result.ok ? `${result.wave.label} incoming.` : result.reason,
        result.ok ? 'success' : 'warning',
      );
    });

    this.elements.pause.addEventListener('click', () => {
      this.simulation.dispatch(ACTIONS.togglePause);
      this.render(true);
    });

    this.elements.speed1.addEventListener('click', () => {
      this.simulation.dispatch(ACTIONS.setSpeed, { speed: 1 });
      this.render(true);
    });

    this.elements.speed2.addEventListener('click', () => {
      this.simulation.dispatch(ACTIONS.setSpeed, { speed: 2 });
      this.render(true);
    });

    const renderLoop = () => {
      this.render();
      this.animationFrame = window.requestAnimationFrame(renderLoop);
    };

    this.render(true);
    this.animationFrame = window.requestAnimationFrame(renderLoop);
  }

  render(force = false) {
    const state = this.simulation.state;
    const renderKey = [
      state.scrap,
      state.stationIntegrity,
      state.wave.index,
      state.wave.inProgress,
      state.enemies.length,
      state.settings.paused,
      state.settings.speed,
    ].join(':');

    if (!force && renderKey === this.lastRenderKey) {
      return;
    }

    this.lastRenderKey = renderKey;
    this.elements.scrap.textContent = String(state.scrap);
    this.elements.integrity.textContent = String(state.stationIntegrity);
    this.elements.wave.textContent =
      state.wave.index === 0
        ? 'Standby'
        : `${state.wave.index}/${FINAL_WAVE_INDEX} ${state.wave.label}`;
    this.elements.enemies.textContent = String(state.enemies.length);
    this.elements.pause.textContent = state.settings.paused ? 'Resume' : 'Pause';
    this.elements.speed1.setAttribute(
      'aria-pressed',
      String(state.settings.speed === 1),
    );
    this.elements.speed2.setAttribute(
      'aria-pressed',
      String(state.settings.speed === 2),
    );
    this.elements.startWave.disabled =
      state.wave.inProgress ||
      state.enemies.length > 0 ||
      state.stationIntegrity <= 0 ||
      (state.wave.index >= FINAL_WAVE_INDEX && state.wave.completed);
  }

  showNotice(message, tone = 'neutral') {
    this.elements.notice.textContent = message;
    this.elements.notice.dataset.tone = tone;
  }

  dispose() {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
    }

    this.root.replaceChildren();
  }
}
