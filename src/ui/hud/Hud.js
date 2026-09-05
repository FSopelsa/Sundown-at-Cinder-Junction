import { FINAL_WAVE_INDEX, getRaidScaling } from '../../game/content/waves.js';
import { TOWER_DEFINITIONS } from '../../game/content/towers.js';
import { ACTIONS } from '../../game/input/actions.js';

function buildTowerOptions() {
  return Object.values(TOWER_DEFINITIONS)
    .map(
      (tower) => `
        <button
          type="button"
          class="build-palette__tower"
          data-tower-type="${tower.id}"
          data-damage-type="${tower.damageType}"
          aria-pressed="false"
        >
          <span class="build-palette__tower-name">${tower.name}</span>
          <span class="build-palette__tower-cost">${tower.cost} Scrap</span>
          <span class="build-palette__tower-description">${tower.description}</span>
        </button>
      `,
    )
    .join('');
}

export class Hud {
  constructor(root, simulation) {
    this.root = root;
    this.simulation = simulation;
    this.animationFrame = null;
    this.lastRenderKey = '';
    this.selectedTowerType = 'peacemaker';
    this.outcome = null;
  }

  mount() {
    this.root.innerHTML = `
      <section class="hud" aria-label="Game status and controls">
        <header class="hud__topbar">
          <div class="hud__brand">
            <span class="hud__eyebrow">Circuit Marshal Console</span>
            <strong>Sundown at Cinder Junction</strong>
          </div>

          <div class="hud__status" aria-live="polite">
            <span>Scrap <strong data-hud="scrap">0</strong></span>
            <span>Integrity <strong data-hud="integrity">100</strong></span>
            <span>Raid <strong data-hud="wave">Standby</strong></span>
            <span>Hostiles <strong data-hud="enemies">0</strong></span>
            <span>Return <strong data-hud="carryover">0</strong></span>
          </div>

          <div class="hud__controls" aria-label="Raid controls">
            <button type="button" data-action="start-wave">Start raid</button>
            <button type="button" data-action="pause">Pause</button>
            <button type="button" data-action="speed-1">1×</button>
            <button type="button" data-action="speed-2">2×</button>
          </div>
        </header>

        <aside class="build-palette" aria-label="Tower build palette">
          <div class="build-palette__heading">
            <span class="hud__eyebrow">Build catalogue</span>
            <strong data-hud="selected-tower">Peacemaker Turret</strong>
          </div>
          <div class="build-palette__options">
            ${buildTowerOptions()}
          </div>
          <p class="build-palette__hint">Select a tower, then click clear ground to deploy it.</p>
        </aside>

        <p class="hud__intel" data-hud="intel" hidden aria-live="polite"></p>
        <p class="hud__notice" data-hud="notice" aria-live="polite"></p>

        <section class="hud__outcome" data-hud="outcome" hidden aria-live="assertive">
          <span class="hud__eyebrow" data-hud="outcome-eyebrow"></span>
          <strong data-hud="outcome-title"></strong>
          <p data-hud="outcome-copy"></p>
          <button type="button" data-action="outcome-primary"></button>
        </section>
      </section>
    `;

    this.elements = {
      scrap: this.root.querySelector('[data-hud="scrap"]'),
      integrity: this.root.querySelector('[data-hud="integrity"]'),
      wave: this.root.querySelector('[data-hud="wave"]'),
      enemies: this.root.querySelector('[data-hud="enemies"]'),
      carryover: this.root.querySelector('[data-hud="carryover"]'),
      notice: this.root.querySelector('[data-hud="notice"]'),
      intel: this.root.querySelector('[data-hud="intel"]'),
      selectedTower: this.root.querySelector('[data-hud="selected-tower"]'),
      startWave: this.root.querySelector('[data-action="start-wave"]'),
      pause: this.root.querySelector('[data-action="pause"]'),
      speed1: this.root.querySelector('[data-action="speed-1"]'),
      speed2: this.root.querySelector('[data-action="speed-2"]'),
      outcome: this.root.querySelector('[data-hud="outcome"]'),
      outcomeEyebrow: this.root.querySelector('[data-hud="outcome-eyebrow"]'),
      outcomeTitle: this.root.querySelector('[data-hud="outcome-title"]'),
      outcomeCopy: this.root.querySelector('[data-hud="outcome-copy"]'),
      outcomePrimary: this.root.querySelector('[data-action="outcome-primary"]'),
      towerButtons: new Map(
        [...this.root.querySelectorAll('[data-tower-type]')].map((button) => [
          button.dataset.towerType,
          button,
        ]),
      ),
    };

    this.elements.startWave.addEventListener('click', () => {
      this.startWave();
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

    for (const [towerType, button] of this.elements.towerButtons) {
      button.addEventListener('click', () => this.selectTower(towerType));
    }

    this.elements.outcomePrimary.addEventListener('click', () => {
      if (this.outcome?.action === 'restart') {
        window.location.reload();
        return;
      }

      this.startWave();
    });

    const renderLoop = () => {
      this.render();
      this.animationFrame = window.requestAnimationFrame(renderLoop);
    };

    this.render(true);
    this.animationFrame = window.requestAnimationFrame(renderLoop);
  }

  getSelectedTowerType() {
    return this.selectedTowerType;
  }

  selectTower(towerType) {
    const definition = TOWER_DEFINITIONS[towerType];

    if (!definition) {
      return;
    }

    this.selectedTowerType = towerType;
    this.showNotice(`${definition.name} selected. ${definition.description}`, 'neutral');
    this.render(true);
  }

  startWave() {
    const result = this.simulation.dispatch(ACTIONS.startWave);
    const healthIncrease = result.ok
      ? Math.round((getRaidScaling(result.wave.index).healthMultiplier - 1) * 100)
      : 0;
    const carryoverText = result.ok && result.wave.carryoverCount > 0
      ? ` ${result.wave.carryoverCount} ${result.wave.carryoverCount === 1 ? 'returning enemy' : 'returning enemies'} arrive first.`
      : '';
    this.showNotice(
      result.ok
        ? `${result.wave.label} incoming.${healthIncrease > 0 ? ` +${healthIncrease}% enemy hull.` : ''}${carryoverText}`
        : result.reason,
      result.ok ? 'success' : 'warning',
    );

    if (result.ok) {
      this.hideOutcome();
    }

    return result;
  }

  showWaveResult({ label, campaignComplete = false, carryoverCount = 0 }) {
    this.outcome = campaignComplete
      ? {
          tone: 'success',
          eyebrow: 'Junction secured',
          title: 'The Black Comet is down.',
          copy: 'Cinder Junction holds. Start a new run whenever you are ready.',
          action: 'restart',
          buttonLabel: 'Start new run',
        }
      : {
          tone: 'success',
          eyebrow: 'Raid cleared',
          title: carryoverCount > 0 ? `${label} survived.` : `${label} held.`,
          copy: carryoverCount > 0
            ? `${carryoverCount} escaped ${carryoverCount === 1 ? 'enemy returns' : 'enemies return'} with the next raid. Refit the line.`
            : 'Refit the line, choose a tower, then launch the next raid.',
          action: 'next-wave',
          buttonLabel: 'Start next raid',
        };
    this.renderOutcome();
  }

  showFailure() {
    this.outcome = {
      tone: 'danger',
      eyebrow: 'Station lost',
      title: 'The junction has fallen.',
      copy: 'The rail is overrun. Restart the run and try a different build.',
      action: 'restart',
      buttonLabel: 'Restart run',
    };
    this.renderOutcome();
  }

  hideOutcome() {
    this.outcome = null;
    this.renderOutcome();
  }

  renderOutcome() {
    if (!this.elements) {
      return;
    }

    if (!this.outcome) {
      this.elements.outcome.hidden = true;
      return;
    }

    this.elements.outcome.hidden = false;
    this.elements.outcome.dataset.tone = this.outcome.tone;
    this.elements.outcomeEyebrow.textContent = this.outcome.eyebrow;
    this.elements.outcomeTitle.textContent = this.outcome.title;
    this.elements.outcomeCopy.textContent = this.outcome.copy;
    this.elements.outcomePrimary.textContent = this.outcome.buttonLabel;
  }

  render(force = false) {
    const state = this.simulation.state;
    const renderKey = [
      state.scrap,
      state.stationIntegrity,
      state.wave.index,
      state.wave.inProgress,
      state.enemies.length,
      state.carryoverEnemies.length,
      state.wave.carryoverCount,
      state.enemies.map((enemy) => enemy.type).join(','),
      state.settings.paused,
      state.settings.speed,
      this.selectedTowerType,
    ].join(':');

    if (!force && renderKey === this.lastRenderKey) {
      return;
    }

    this.lastRenderKey = renderKey;
    this.elements.scrap.textContent = String(state.scrap);
    this.elements.integrity.textContent = String(state.stationIntegrity);
    const carryoverSuffix = state.wave.carryoverCount > 0
      ? ` +${state.wave.carryoverCount}`
      : '';
    this.elements.wave.textContent =
      state.wave.index === 0
        ? 'Standby'
        : `${state.wave.index}/${FINAL_WAVE_INDEX} ${state.wave.label}${carryoverSuffix}`;
    this.elements.enemies.textContent = String(state.enemies.length);
    this.elements.carryover.textContent = String(state.carryoverEnemies.length);
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

    const selectedDefinition = TOWER_DEFINITIONS[this.selectedTowerType];
    this.elements.selectedTower.textContent = selectedDefinition.name;

    for (const [towerType, button] of this.elements.towerButtons) {
      const definition = TOWER_DEFINITIONS[towerType];
      button.setAttribute('aria-pressed', String(towerType === this.selectedTowerType));
      button.disabled =
        state.stationIntegrity <= 0 || state.scrap < definition.cost;
    }

    const riftLeech = state.enemies.find(
      (enemy) => enemy.trait?.id === 'regeneration',
    );
    this.elements.intel.hidden = !riftLeech;
    this.elements.intel.textContent = riftLeech
      ? 'FIELD INTEL // Rift Leeches regenerate unless burning. Sunspitter solar fire suppresses it.'
      : '';
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
