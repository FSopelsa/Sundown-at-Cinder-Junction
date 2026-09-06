import { FINAL_WAVE_INDEX, getRaidScaling } from '../../game/content/waves.js';
import {
  TOWER_DEFINITIONS,
  MAX_TOWER_LEVEL,
  getTowerSellValue,
  getUpgradeCost,
} from '../../game/content/towers.js';
import { getHeroSkill, HERO_DEFINITION } from '../../game/content/heroes.js';
import { LEVELS } from '../../game/content/map.js';
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
          title="${tower.description}"
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
    this.selectedTowerId = null;
    this.inputMode = 'move';
    this.targetingSkillId = null;
    this.outcome = null;
  }

  mount() {
    this.root.innerHTML = `
      <section class="hud" aria-label="Game status and controls">
        <header class="hud__topbar">
          <div class="hud__brand">
            <span class="hud__eyebrow">Singularity Command Console</span>
            <strong>Sundown at Cinder Junction</strong>
            <div class="level-picker">
              <select aria-label="Level" data-hud="level">
                ${LEVELS.map((level) => `<option value="${level.id}" ${level.id === this.simulation.state.levelId ? 'selected' : ''}>${level.name}</option>`).join('')}
              </select>
              <button type="button" data-action="change-level" title="Starts a fresh run in the chosen level">Start level</button>
            </div>
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
          <div data-hud="catalogue">
          <div class="build-palette__heading">
            <span class="hud__eyebrow">Build catalogue</span>
            <strong data-hud="selected-tower">Peacemaker Turret</strong>
          </div>
          <div class="build-palette__options">
            ${buildTowerOptions()}
          </div>
          <p class="build-palette__hint" data-hud="build-hint"></p>
          </div>
          <div data-hud="tower-details" hidden>
            <div class="tower-details__heading"><strong data-hud="tower-name"></strong><button type="button" data-action="back-build">Back to build</button></div>
            <p data-hud="tower-stats"></p>
            <p data-hud="tower-history" class="build-palette__hint"></p>
            <div class="upgrade-options">
              <button type="button" data-upgrade="damage"></button>
              <button type="button" data-upgrade="speed"></button>
            </div>
            <button type="button" class="tower-details__sell" data-action="sell-tower"></button>
          </div>
        </aside>

        <aside class="hero-panel" aria-label="Singularity hero status">
          <div class="hero-panel__heading">
            <span class="hud__eyebrow">Player hero</span>
            <strong data-hud="hero-name">${HERO_DEFINITION.name}</strong>
            <span class="hero-panel__level" data-hud="hero-level">Level 1</span>
          </div>
          <p class="hero-panel__state" data-hud="hero-state"></p>
          <div class="hero-panel__meter-row">
            <span>Hull <strong data-hud="hero-hp">0 / 0</strong></span>
            <span class="hero-meter" aria-hidden="true"><span data-hud="hero-hp-fill"></span></span>
          </div>
          <div class="hero-panel__meter-row">
            <span>XP <strong data-hud="hero-xp">0 / 0</strong></span>
            <span class="hero-meter hero-meter--xp" aria-hidden="true"><span data-hud="hero-xp-fill"></span></span>
          </div>
          <div class="hero-panel__skills" data-hud="hero-skills"></div>
          <button type="button" data-action="command-hero">Move Singularity</button>
        </aside>

        <p class="hud__intel" data-hud="intel" hidden aria-live="polite"></p>
        <p class="hud__notice" data-hud="notice" aria-live="polite"></p>

        <section class="hud__outcome" data-hud="outcome" hidden aria-live="assertive">
          <span class="hud__eyebrow" data-hud="outcome-eyebrow"></span>
          <strong data-hud="outcome-title"></strong>
          <p data-hud="outcome-copy"></p>
          <button type="button" data-action="outcome-primary"></button>
          <button type="button" data-action="refit">Refit towers</button>
        </section>
      </section>
    `;

    this.elements = {
      catalogue: this.root.querySelector('[data-hud="catalogue"]'),
      towerDetails: this.root.querySelector('[data-hud="tower-details"]'),
      towerName: this.root.querySelector('[data-hud="tower-name"]'),
      towerStats: this.root.querySelector('[data-hud="tower-stats"]'),
      towerHistory: this.root.querySelector('[data-hud="tower-history"]'),
      upgradeButtons: [...this.root.querySelectorAll('[data-upgrade]')],
      sellTower: this.root.querySelector('[data-action="sell-tower"]'),
      buildHint: this.root.querySelector('[data-hud="build-hint"]'),
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
      commandHero: this.root.querySelector('[data-action="command-hero"]'),
      heroName: this.root.querySelector('[data-hud="hero-name"]'),
      heroLevel: this.root.querySelector('[data-hud="hero-level"]'),
      heroState: this.root.querySelector('[data-hud="hero-state"]'),
      heroHp: this.root.querySelector('[data-hud="hero-hp"]'),
      heroHpFill: this.root.querySelector('[data-hud="hero-hp-fill"]'),
      heroXp: this.root.querySelector('[data-hud="hero-xp"]'),
      heroXpFill: this.root.querySelector('[data-hud="hero-xp-fill"]'),
      heroSkills: this.root.querySelector('[data-hud="hero-skills"]'),
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

    this.root.querySelector('[data-action="change-level"]').addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('level', this.root.querySelector('[data-hud="level"]').value);
      window.location.assign(url.href);
    });
    this.root.querySelector('[data-action="back-build"]').addEventListener('click', () => {
      this.selectedTowerId = null;
      this.inputMode = 'build';
      this.render(true);
    });
    this.elements.commandHero.addEventListener('click', () => this.commandHero());
    this.elements.heroSkills.addEventListener('click', (event) => {
      const button = event.target.closest('[data-skill-id]');
      if (button) this.activateHeroSkill(button.dataset.skillId);
    });
    this.root.querySelector('[data-action="refit"]').addEventListener('click', () => this.hideOutcome());
    for (const button of this.elements.upgradeButtons) {
      button.addEventListener('click', () => {
        const result = this.simulation.dispatch(ACTIONS.upgradeTower, {
          towerId: this.selectedTowerId, upgrade: button.dataset.upgrade,
        });
        this.showNotice(result.ok ? `${result.tower.name} upgraded to level ${result.tower.level}.` : result.reason,
          result.ok ? 'success' : 'warning');
        this.render(true);
      });
    }
    this.elements.sellTower.addEventListener('click', () => {
      const result = this.simulation.dispatch(ACTIONS.sellTower, {
        towerId: this.selectedTowerId,
      });
      if (result.ok) {
        this.selectedTowerId = null;
        this.inputMode = 'build';
        this.targetingSkillId = null;
      }
      this.showNotice(
        result.ok ? `${result.tower.name} salvaged for ${result.refund} Scrap.` : result.reason,
        result.ok ? 'success' : 'warning',
      );
      this.render(true);
    });

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

  isHeroCommandMode() {
    return this.inputMode === 'move';
  }

  getTargetingSkill() {
    return this.inputMode === 'skill' ? this.targetingSkillId : null;
  }

  isBuilding() {
    return this.inputMode === 'build';
  }

  commandHero() {
    const hero = this.simulation.state.hero;
    if (!hero.alive) {
      this.showNotice('Singularity returns with the next raid.', 'warning');
      return;
    }

    this.inputMode = 'move';
    this.targetingSkillId = null;
    this.selectedTowerId = null;
    this.showNotice('Movement command armed. Click the battlefield, or press H.', 'neutral');
    this.render(true);
  }

  inspectTower(towerId) {
    this.selectedTowerId = towerId;
    this.inputMode = 'build';
    this.targetingSkillId = null;
    this.hideOutcome();
    this.render(true);
  }

  selectTower(towerType) {
    const definition = TOWER_DEFINITIONS[towerType];

    if (!definition) {
      return;
    }

    this.selectedTowerType = towerType;
    this.selectedTowerId = null;
    this.inputMode = 'build';
    this.targetingSkillId = null;
    this.showNotice(`${definition.name} selected. ${definition.description}`, 'neutral');
    this.render(true);
  }

  activateHeroSkill(skillId) {
    const hero = this.simulation.state.hero;
    const slot = hero.skillSlots.find((candidate) => candidate.id === skillId);
    const skill = getHeroSkill(skillId);
    if (!slot || !skill) return;
    if (!hero.alive) {
      this.showNotice('Singularity returns with the next raid.', 'warning');
      return;
    }
    if (!slot.unlocked) {
      this.showNotice(`${skill.label} unlocks at level ${skill.unlockLevel}.`, 'warning');
      return;
    }
    if (slot.cooldownRemainingMs > 0) {
      this.showNotice(`${skill.label} recharges in ${(slot.cooldownRemainingMs / 1000).toFixed(1)}s.`, 'warning');
      return;
    }

    if (skill.target === 'instant') {
      const result = this.simulation.dispatch(ACTIONS.castHeroSkill, { skillId });
      this.showNotice(
        result.ok ? `${skill.label} bends time around ${result.towerCount} tower${result.towerCount === 1 ? '' : 's'}.` : result.reason,
        result.ok ? 'success' : 'warning',
      );
      this.render(true);
      return;
    }

    this.inputMode = 'skill';
    this.targetingSkillId = skillId;
    this.selectedTowerId = null;
    const targetCopy = skill.target === 'enemy'
      ? 'Click a hostile in range.'
      : skill.id === 'worm-tunnel' && this.simulation.state.wormholes.length === 1
        ? 'Set the second Worm Tunnel endpoint.'
        : `Click ground to cast ${skill.label}.`;
    this.showNotice(`${skill.label} armed. ${targetCopy}`, 'neutral');
    this.render(true);
  }

  resolveSkillTarget(result) {
    const skill = getHeroSkill(this.targetingSkillId);
    if (!skill) return;
    if (result.ok) {
      this.inputMode = result.keepTargeting ? 'skill' : 'move';
      this.targetingSkillId = result.keepTargeting ? skill.id : null;
      this.showNotice(
        result.pending
          ? `${skill.label}: first endpoint set. Click the second endpoint.`
          : `${skill.label} cast.`,
        'success',
      );
    } else {
      this.showNotice(result.reason, 'warning');
    }
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
    const reviveText = result.ok && result.heroRevived
      ? ' Singularity is restored.'
      : '';
    this.showNotice(
      result.ok
        ? `${result.wave.label} incoming.${healthIncrease > 0 ? ` +${healthIncrease}% enemy hull.` : ''}${carryoverText}${reviveText}`
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
    this.root.querySelector('[data-action="refit"]').hidden = this.outcome.action === 'restart';
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
      state.enemies.some((enemy) => (enemy.shield ?? 0) > 0),
      state.settings.paused,
      state.settings.speed,
      this.selectedTowerType,
      this.selectedTowerId,
      this.inputMode,
      this.targetingSkillId,
      state.towers.find((tower) => tower.id === this.selectedTowerId)?.level,
      state.hero.alive,
      state.hero.level,
      state.hero.hp,
      state.hero.maxHp,
      state.hero.experience,
      state.hero.experienceToNext,
      state.hero.skillSlots.map((slot) => `${slot.id}:${slot.unlocked}:${Math.ceil((slot.cooldownRemainingMs ?? 0) / 100)}`).join(','),
    ].join(':');

    if (!force && renderKey === this.lastRenderKey) {
      return;
    }

    this.lastRenderKey = renderKey;
    const hero = state.hero;
    const tower = state.towers.find((candidate) => candidate.id === this.selectedTowerId);
    this.elements.catalogue.hidden = Boolean(tower);
    this.elements.towerDetails.hidden = !tower;
    if (tower) {
      const cost = getUpgradeCost(tower);
      this.elements.towerName.textContent = `${tower.name} · Level ${tower.level}/${MAX_TOWER_LEVEL}`;
      const dilation = (tower.timeDilationRemainingMs ?? 0) > 0
        ? ` · Time Dilation ${(tower.timeDilationRemainingMs / 1000).toFixed(1)}s`
        : '';
      this.elements.towerStats.textContent = `${Number(tower.damage.toFixed(1))} damage · ${(1000 / tower.fireIntervalMs).toFixed(2)} shots/sec · ${tower.range} range${tower.chain ? ' · Arc: 4 targets / 2× shield damage' : ''}${dilation}`;
      this.elements.towerHistory.textContent = tower.upgrades?.length
        ? tower.upgrades.map((upgrade) => upgrade === 'damage' ? 'Damage +50%' : 'Attack speed +50%').join(' → ')
        : 'Choose a specialization at each level. Mix upgrades or specialize twice.';
      for (const button of this.elements.upgradeButtons) {
        const damage = button.dataset.upgrade === 'damage';
        button.textContent = cost === null ? 'Maximum level reached' : damage
          ? `Damage +50%${tower.effect?.type === 'burn' ? ' & burn +50%' : ''} · ${cost} Scrap`
          : `Attack speed +50% · ${cost} Scrap`;
        button.disabled = cost === null || state.scrap < cost || state.stationIntegrity <= 0;
      }
      const sellValue = getTowerSellValue(tower);
      this.elements.sellTower.textContent = `Sell for ${sellValue} Scrap (80% return)`;
      this.elements.sellTower.disabled = false;
    }
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

    this.elements.heroName.textContent = hero.name;
    this.elements.heroLevel.textContent = `Level ${hero.level}`;
    this.elements.heroState.textContent = hero.alive
      ? `${hero.damage} damage · ${(1000 / hero.attackIntervalMs).toFixed(2)} attacks/sec`
      : 'DOWN — returns at the next raid';
    this.elements.heroHp.textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
    this.elements.heroHpFill.style.width = `${(100 * hero.hp) / hero.maxHp}%`;
    const isMaxLevel = hero.experienceToNext === null;
    this.elements.heroXp.textContent = isMaxLevel
      ? 'Maximum level'
      : `${hero.experience} / ${hero.experienceToNext}`;
    this.elements.heroXpFill.style.width = isMaxLevel
      ? '100%'
      : `${(100 * hero.experience) / hero.experienceToNext}%`;
    this.elements.heroSkills.innerHTML = `
      <span class="hero-skills__label">Abilities</span>
      <div class="hero-skills__grid">${hero.skillSlots.map((slot) => {
        const cooldown = Math.ceil((slot.cooldownRemainingMs ?? 0) / 1000);
        const status = !slot.unlocked
          ? `L${slot.unlockLevel}`
          : cooldown > 0
            ? `${cooldown}s`
            : 'Ready';
        return `<button type="button" class="hero-skill" data-skill-id="${slot.id}" title="${slot.description}" aria-pressed="${this.targetingSkillId === slot.id}" ${!hero.alive || !slot.unlocked || cooldown > 0 ? 'disabled' : ''}>
          <span>${slot.label}</span><small>${status}</small>
        </button>`;
      }).join('')}</div>`;
    this.elements.commandHero.textContent = this.inputMode === 'move' ? 'Move Singularity · active' : 'Move Singularity';
    this.elements.commandHero.setAttribute('aria-pressed', String(this.inputMode === 'move'));
    this.elements.commandHero.disabled = !hero.alive;

    const selectedDefinition = TOWER_DEFINITIONS[this.selectedTowerType];
    this.elements.selectedTower.textContent = selectedDefinition.name;

    for (const [towerType, button] of this.elements.towerButtons) {
      const definition = TOWER_DEFINITIONS[towerType];
      button.setAttribute(
        'aria-pressed',
        String(this.inputMode === 'build' && towerType === this.selectedTowerType),
      );
      button.disabled =
        state.stationIntegrity <= 0 || state.scrap < definition.cost;
    }

    const riftLeech = state.enemies.find(
      (enemy) => enemy.trait?.id === 'regeneration',
    );
    const shielded = state.enemies.some((enemy) => (enemy.shield ?? 0) > 0);
    this.elements.intel.hidden = !riftLeech && !shielded;
    this.elements.intel.textContent = shielded
      ? 'FIELD INTEL // Violet rings are shields. Tesla Coil arcs chain between targets and overload shields for 2× damage.'
      : riftLeech
      ? 'FIELD INTEL // Rift Leeches regenerate unless burning. Sunspitter solar fire suppresses it.'
      : '';
    this.elements.buildHint.textContent = this.inputMode === 'move'
      ? 'Move Singularity active: click clear ground to issue a route. Select a tower to build.'
      : this.inputMode === 'skill'
        ? `${getHeroSkill(this.targetingSkillId)?.label ?? 'Hero skill'} active: choose a valid target.`
      : this.simulation.map.mode === 'maze'
        ? 'Build a maze on the grid. Keep a route open to the exit. Click a wall while building to replace it and recover 80%.'
        : 'Click clear ground to deploy the selected tower. Click a deployed tower to upgrade.';
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
