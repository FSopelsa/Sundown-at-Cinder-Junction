import { getEncounter } from '../../game/content/campaign.js';
import { SUPPORT_ITEMS } from '../../game/simulation/systems/SupportShop.js';
import { FINAL_WAVE_INDEX, getRaidScaling } from '../../game/content/waves.js';
import {
  TOWER_DEFINITIONS,
  MAX_TOWER_LEVEL,
  getTowerSellValue,
  getUpgradeCost,
  getAuraRangeUpgradeCost,
  SCRAP_EXCHANGE_AURA_MAX_LEVEL,
  SCRAP_EXCHANGE_TAUNT_MAX_UPGRADE_LEVEL,
  SCRAP_EXCHANGE_TAUNT_DURATION_STEP_MS,
  getTauntDurationMs,
  getTauntDurationUpgradeCost,
} from '../../game/content/towers.js';
import {
  getHeroSkill,
  HERO_DEFINITION,
  isHeroSkillPlayerVisible,
} from '../../game/content/heroes.js';
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
    this.inputMode = 'build';
    this.temporaryHeroCommand = null;
    this.queueModifierActive = false;
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
              <a href="?assets" style="color: inherit; font-size: 12px">Asset library</a>
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
            <div class="audio-control" aria-label="Audio controls">
              <button type="button" data-action="audio-toggle" aria-pressed="true">Audio on</button>
              <label>Vol <input data-hud="audio-volume" type="range" min="0" max="1" step="0.05" value="0.4" aria-label="Master volume"></label>
            </div>
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
            <div class="tower-targeting" data-hud="tower-targeting">
              <span>Target priority</span>
              <div role="group" aria-label="Tower target priority">
                <button type="button" data-targeting="first">First</button>
                <button type="button" data-targeting="toughest">Toughest</button>
                <button type="button" data-targeting="last">Last</button>
              </div>
            </div>
            <p data-hud="tower-history" class="build-palette__hint"></p>
            <div class="upgrade-options">
              <button type="button" data-upgrade="damage"></button>
              <button type="button" data-upgrade="speed"></button>
            </div>
            <div data-hud="structure-actions" class="structure-actions"></div>
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
      towerTargeting: this.root.querySelector('[data-hud="tower-targeting"]'),
      targetingButtons: [...this.root.querySelectorAll('[data-targeting]')],
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
      audioToggle: this.root.querySelector('[data-action="audio-toggle"]'),
      audioVolume: this.root.querySelector('[data-hud="audio-volume"]'),
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
      url.searchParams.set('checkpoint', 'new');
      url.searchParams.delete('review');
      window.location.assign(url.href);
    });
    this.root.querySelector('[data-action="back-build"]').addEventListener('click', () => {
      this.selectedTowerId = null;
      this.inputMode = 'build';
      this.render(true);
    });
    this.root.querySelector('[data-hud="structure-actions"]').addEventListener('click', event => {
      const button = event.target.closest('[data-support], [data-ladder], [data-upgrade], [data-taunt]');
      if (!button) return;
      const result = button.hasAttribute('data-upgrade')
        ? this.simulation.dispatch(ACTIONS.upgradeTower, { towerId: this.selectedTowerId, upgrade: button.dataset.upgrade })
        : button.hasAttribute('data-ladder')
          ? this.simulation.dispatch(ACTIONS.upgradeTower, { towerId: this.selectedTowerId, upgrade: 'ladder' })
          : button.hasAttribute('data-taunt')
            ? this.simulation.dispatch(ACTIONS.activateTowerAbility, { towerId: this.selectedTowerId })
            : this.simulation.dispatch(ACTIONS.purchaseSupport, { towerId: this.selectedTowerId, item: button.dataset.support });
      this.showNotice(result.ok
        ? result.message ?? (button.hasAttribute('data-taunt')
          ? `Taunt active for ${(result.durationMs / 1000).toFixed(0)}s.`
          : result.construction
            ? `${result.tower.name} upgrade queued. Singularity is moving into range.`
            : button.hasAttribute('data-upgrade') ? 'Structure upgrade complete.' : 'Ladder installed. The hero can cross this wall.')
        : result.reason, result.ok ? 'success' : 'warning');
      this.render(true);
    });
    this.elements.commandHero.addEventListener('click', () => this.commandHero());
    this.elements.heroSkills.addEventListener('click', (event) => {
      const upgrade = event.target.closest('[data-skill-upgrade]');
      if (upgrade) {
        const result = this.simulation.dispatch(ACTIONS.upgradeHeroSkill, { skillId: upgrade.dataset.skillUpgrade });
        this.showNotice(
          result.ok
            ? `${result.skill.label} duration extended to ${(result.durationMs / 1000).toFixed(0)}s.`
            : result.reason,
          result.ok ? 'success' : 'warning',
        );
        this.render(true);
        return;
      }
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
    this.elements.towerTargeting.addEventListener('click', (event) => {
      const button = event.target.closest('[data-targeting]');
      if (!button || !this.selectedTowerId) return;
      const result = this.simulation.dispatch(ACTIONS.setTowerTargeting, {
        towerId: this.selectedTowerId,
        targeting: button.dataset.targeting,
      });
      this.showNotice(
        result.ok ? `${result.tower.name} now targets ${result.targeting} enemies.` : result.reason,
        result.ok ? 'success' : 'warning',
      );
      this.render(true);
    });

    this.elements.audioToggle.addEventListener('click', () => {
      this.simulation.state.settings.audioEnabled = !this.simulation.state.settings.audioEnabled;
      this.showNotice(this.simulation.state.settings.audioEnabled ? 'Audio enabled.' : 'Audio muted.', 'neutral');
      this.render(true);
    });

    this.elements.audioVolume.addEventListener('input', (event) => {
      this.simulation.state.settings.audioVolume = Math.min(1, Math.max(0, Number(event.target.value)));
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

  isBuildQueueActive() {
    return this.queueModifierActive;
  }

  beginBuildQueue() {
    if (this.queueModifierActive || this.inputMode !== 'build') return;
    this.queueModifierActive = true;
    this.showNotice('Build queue active. Placed towers reserve their tiles immediately.', 'neutral');
    this.render(true);
  }

  endBuildQueue() {
    if (!this.queueModifierActive) return;
    this.queueModifierActive = false;
    this.render(true);
  }

  toggleHeroCommand() {
    if (this.inputMode === 'move' && !this.temporaryHeroCommand) {
      this.inputMode = 'build';
      this.targetingSkillId = null;
      this.showNotice('Build mode restored.', 'neutral');
      this.render(true);
      return;
    }
    this.commandHero();
  }

  beginTemporaryHeroCommand() {
    const hero = this.simulation.state.hero;
    if (!hero.alive || this.inputMode === 'skill' || this.temporaryHeroCommand) return;
    this.temporaryHeroCommand = {
      inputMode: this.inputMode,
      selectedTowerId: this.selectedTowerId,
      targetingSkillId: this.targetingSkillId,
    };
    this.inputMode = 'move';
    this.selectedTowerId = null;
    this.targetingSkillId = null;
    this.showNotice('Temporary movement command active. Click clear ground to route Singularity.', 'neutral');
    this.render(true);
  }

  endTemporaryHeroCommand() {
    if (!this.temporaryHeroCommand) return;
    const previous = this.temporaryHeroCommand;
    this.temporaryHeroCommand = null;
    this.inputMode = previous.inputMode;
    this.selectedTowerId = previous.selectedTowerId;
    this.targetingSkillId = previous.targetingSkillId;
    this.render(true);
  }

  commandHero() {
    const hero = this.simulation.state.hero;
    if (!hero.alive) {
      this.showNotice('Singularity returns with the next raid.', 'warning');
      return;
    }

    this.inputMode = 'move';
    this.temporaryHeroCommand = null;
    this.targetingSkillId = null;
    this.selectedTowerId = null;
    this.showNotice('Movement mode armed. Click clear ground; press H to toggle, or hold Shift for a temporary order.', 'neutral');
    this.render(true);
  }

  inspectTower(towerId) {
    this.temporaryHeroCommand = null;
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
    this.temporaryHeroCommand = null;
    this.inputMode = 'build';
    this.targetingSkillId = null;
    this.showNotice(`${definition.name} selected. ${definition.description}`, 'neutral');
    this.render(true);
  }

  activateHeroSkill(skillId) {
    if (!isHeroSkillPlayerVisible(skillId)) return;
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
          : `${skill.label} linked${result.cost ? ` for ${result.cost} Scrap` : ''}.`,
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
      ? Math.round((getRaidScaling(result.wave.index + (getEncounter(this.simulation.map, this.simulation.state)?.tier ?? 0) * 3).healthMultiplier - 1) * 100)
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
    if (this.simulation.state.campaign) { this.showNotice(`${label} cleared.`, 'success'); return; }
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
      copy: this.simulation.state.campaign ? 'Load a room checkpoint or machine save from the campaign panel. Earlier saves remain available.' : 'The rail is overrun. Restart the run and try a different build.',
      action: 'restart',
      buttonLabel: this.simulation.state.campaign && this.campaignHud?.saves.latest() ? 'Resume last save' : 'Restart run',
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
    const activeWormholeRemainingMs = state.wormholes.length === 2
      ? Math.min(...state.wormholes.map((portal) => portal.remainingMs ?? 0))
      : 0;
    const renderKey = [
      state.campaign?.activeEncounterId, Math.ceil((state.campaign?.revealRemainingMs ?? 0) / 1000),
      state.towers.map(t => `${t.id}:${Math.ceil(t.hp ?? 0)}:${t.ladder}:${t.aura}:${t.auraLevel}:${t.auraRange}:${Math.ceil(t.tauntRemainingMs ?? 0)}:${Math.ceil(t.tauntCooldownRemainingMs ?? 0)}:${t.tauntUpgradeLevel}:${t.targeting}:${t.construction?.status}:${t.construction?.kind}:${t.construction?.upgrade}:${Math.ceil(t.construction?.remainingMs ?? 0)}`).join(),
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
      state.settings.audioEnabled,
      state.settings.audioVolume,
      this.selectedTowerType,
      this.selectedTowerId,
      this.inputMode,
      this.targetingSkillId,
      this.queueModifierActive,
      state.towers.find((tower) => tower.id === this.selectedTowerId)?.level,
      Math.ceil((state.hero.aegisRemainingMs ?? 0) / 1000),
      Math.ceil((state.hero.speedBoostRemainingMs ?? 0) / 1000),
      state.hero.alive,
      state.hero.level,
      state.hero.hp,
      state.hero.maxHp,
      state.hero.experience,
      state.hero.experienceToNext,
      state.hero.skillSlots.map((slot) => `${slot.id}:${slot.unlocked}:${slot.upgradeLevel}:${Math.ceil((slot.cooldownRemainingMs ?? 0) / 100)}`).join(','),
      Math.ceil(activeWormholeRemainingMs / 100),
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
      const construction = tower.construction;
      const constructionPercent = construction
        ? Math.round(100 * (1 - construction.remainingMs / construction.durationMs))
        : 100;
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
        button.disabled = Boolean(construction) || cost === null || state.scrap < cost || state.stationIntegrity <= 0;
      }
      const structure = tower.type === 'wall' || tower.type === 'scrapExchange';
      this.elements.towerTargeting.hidden = structure;
      for (const button of this.elements.targetingButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.targeting === (tower.targeting ?? 'first')));
        button.disabled = Boolean(construction);
      }
      for (const button of this.elements.upgradeButtons) button.hidden = structure;
      const actions = this.root.querySelector('[data-hud="structure-actions"]');
      const auraLevel = Math.max(0, Number.isInteger(tower.auraLevel) ? tower.auraLevel : (tower.aura ? 1 : 0));
      const auraRange = tower.auraRange ?? 180;
      const auraCost = tower.aura ? getAuraRangeUpgradeCost(tower) : null;
      const tauntDurationMs = getTauntDurationMs(tower);
      const tauntLevel = Math.max(0, Number.isInteger(tower.tauntUpgradeLevel) ? tower.tauntUpgradeLevel : 0);
      const tauntCost = tower.type === 'scrapExchange' ? getTauntDurationUpgradeCost(tower) : null;
      const tauntActive = (tower.tauntRemainingMs ?? 0) > 0;
      const tauntCooldownMs = tower.tauntCooldownRemainingMs ?? 0;
      const auraUpgrade = tower.type === 'scrapExchange' && tower.aura
        ? `<button data-upgrade="range" ${construction || auraCost === null || state.scrap < auraCost ? 'disabled' : ''}>${auraCost === null ? `Relay aura maximum · ${auraRange}` : `Expand relay aura to ${auraRange + 90} · ${auraCost} Scrap`}</button>`
        : '';
      const tauntAction = tower.type === 'scrapExchange'
        ? `<button data-taunt ${construction || tauntActive || tauntCooldownMs > 0 ? 'disabled' : ''}>${tauntActive ? `Taunt active · ${Math.ceil(tower.tauntRemainingMs / 1000)}s` : tauntCooldownMs > 0 ? `Taunt recharges · ${Math.ceil(tauntCooldownMs / 1000)}s` : `Activate taunt · ${(tauntDurationMs / 1000).toFixed(0)}s`}</button>`
        : '';
      const tauntUpgrade = tower.type === 'scrapExchange' && tauntCost !== null
        ? `<button data-upgrade="taunt" ${construction || state.scrap < tauntCost ? 'disabled' : ''}>Extend taunt to ${((tauntDurationMs + SCRAP_EXCHANGE_TAUNT_DURATION_STEP_MS) / 1000).toFixed(0)}s · ${tauntCost} Scrap</button>`
        : '';
      actions.innerHTML = tower.type === 'wall'
        ? `<button data-ladder ${construction || tower.ladder || state.scrap < 12 ? 'disabled' : ''}>${tower.ladder ? 'Ladder installed · hero passage' : 'Install ladder · 12 Scrap'}</button>`
        : tower.type === 'scrapExchange' ? tauntAction + tauntUpgrade + auraUpgrade + Object.entries(SUPPORT_ITEMS).map(([id, offer]) => {
          const price = offer.cost * (id === 'buyback' ? hero.level : id === 'xp' ? 1 + (hero.trainingPurchases ?? 0) : 1);
          const unavailable = (id === 'aura' && tower.aura) || (id === 'buyback' && hero.alive) || (['heal','buff','xp'].includes(id) && !hero.alive) || (id === 'heal' && hero.hp >= hero.maxHp) || (id === 'repair' && tower.hp >= tower.maxHp) || (id === 'buff' && hero.aegisRemainingMs > 0) || (id === 'xp' && hero.experienceToNext === null);
          return `<button data-support="${id}" ${construction || unavailable || state.scrap < price ? 'disabled' : ''}>${offer.label} · ${price} Scrap</button>`;
        }).join('') : '';
      if (structure) {
        this.elements.towerName.textContent = tower.name;
        this.elements.towerStats.textContent = tower.type === 'wall'
          ? 'Blocks enemies. Ladder allows hero passage.'
          : `${Math.ceil(tower.hp)} / ${tower.maxHp} hull · Taunt ${tauntActive ? `${Math.ceil(tower.tauntRemainingMs / 1000)}s active` : tauntCooldownMs > 0 ? `${Math.ceil(tauntCooldownMs / 1000)}s recharge` : `${(tauntDurationMs / 1000).toFixed(0)}s ready`} (${tauntLevel}/${SCRAP_EXCHANGE_TAUNT_MAX_UPGRADE_LEVEL}) · Relay radius ${tower.aura ? `${auraRange} (${auraLevel}/${SCRAP_EXCHANGE_AURA_MAX_LEVEL})` : 'inactive'}`;
        this.elements.towerHistory.textContent = tower.type === 'wall'
          ? 'Select a combat tower, then click this wall to replace it.'
          : 'Activate taunt when enemies enter range. Extend its duration twice, then install the relay aura; auras do not stack.';
      }
      if (construction) {
        const task = construction.kind === 'build'
          ? 'assembly'
          : `${construction.upgrade === 'range' ? 'relay range' : construction.upgrade === 'taunt' ? 'taunt duration' : construction.upgrade} upgrade`;
        const queued = construction.status === 'queued';
        this.elements.towerName.textContent = queued
          ? `${tower.name} · queued`
          : `${tower.name} · ${constructionPercent}%`;
        this.elements.towerStats.textContent = queued
          ? `Build order ${construction.queueIndex} · tile reserved`
          : `Marshal ${task} in progress · ${Math.ceil(construction.remainingMs / 1000)}s remaining`;
        this.elements.towerHistory.textContent = queued
          ? 'Singularity will move here after the earlier build orders are complete.'
          : 'Singularity must remain within the build radius. Construction pauses while the Marshal is away.';
        actions.innerHTML = '';
      }
      const sellValue = getTowerSellValue(tower);
      this.elements.sellTower.textContent = `Sell for ${sellValue} Scrap (80% return)`;
      this.elements.sellTower.disabled = Boolean(construction);
    }
    this.elements.scrap.textContent = String(state.scrap);
    this.elements.integrity.textContent = String(state.stationIntegrity);
    const carryoverSuffix = state.wave.carryoverCount > 0
      ? ` +${state.wave.carryoverCount}`
      : '';
    this.elements.wave.textContent = state.campaign
      ? state.campaign.activeEncounterId ? `${state.wave.index}/${getEncounter(this.simulation.map, state).waves}` : 'Explore'
      : state.wave.index === 0
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
    this.elements.audioToggle.setAttribute('aria-pressed', String(state.settings.audioEnabled));
    this.elements.audioToggle.textContent = state.settings.audioEnabled ? 'Audio on' : 'Audio off';
    this.elements.audioVolume.value = String(state.settings.audioVolume);
    this.elements.startWave.disabled =
      state.wave.inProgress ||
      state.enemies.length > 0 ||
      state.stationIntegrity <= 0 ||
      (state.wave.index >= FINAL_WAVE_INDEX && state.wave.completed);

    if (state.campaign) {
      this.elements.startWave.disabled ||= !state.campaign.activeEncounterId || state.campaign.revealRemainingMs > 0;
      this.elements.startWave.textContent = state.campaign.revealRemainingMs > 0 ? 'Revealing room…' : state.campaign.activeEncounterId ? 'Start wave' : 'Choose a trial';
    }
    this.elements.heroName.textContent = hero.name;
    this.elements.heroLevel.textContent = `Level ${hero.level}`;
    this.elements.heroState.textContent = hero.alive
      ? `${hero.damage} damage · ${(1000 / hero.attackIntervalMs).toFixed(2)} attacks/sec${hero.aegisRemainingMs > 0 ? ` · Aegis ${Math.ceil(hero.aegisRemainingMs / 1000)}s` : ''}${hero.speedBoostRemainingMs > 0 ? ` · Slipstream ${Math.ceil(hero.speedBoostRemainingMs / 1000)}s` : ''}`
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
    const wormholeRemainingMs = activeWormholeRemainingMs;
    const visibleSkillSlots = hero.skillSlots.filter((slot) => isHeroSkillPlayerVisible(slot.id));
    this.elements.heroSkills.hidden = visibleSkillSlots.length === 0;
    this.elements.heroSkills.innerHTML = visibleSkillSlots.length > 0 ? `
      <span class="hero-skills__label">Abilities</span>
      <div class="hero-skills__grid">${visibleSkillSlots.map((slot) => {
        const cooldown = Math.ceil((slot.cooldownRemainingMs ?? 0) / 1000);
        const skill = getHeroSkill(slot.id);
        const tunnelActive = slot.id === 'worm-tunnel' && wormholeRemainingMs > 0;
        const status = !slot.unlocked
          ? `L${slot.unlockLevel}`
          : tunnelActive
            ? `${Math.ceil(wormholeRemainingMs / 1000)}s active`
          : cooldown > 0
            ? `${cooldown}s`
            : skill?.scrapCost ? `Ready · ${skill.scrapCost}` : 'Ready';
        const upgradeCost = skill?.durationUpgradeMs && slot.unlocked && (slot.upgradeLevel ?? 0) < skill.maxUpgradeLevel
          ? skill.upgradeCost * ((slot.upgradeLevel ?? 0) + 1)
          : null;
        return `<div class="hero-skill-wrap"><button type="button" class="hero-skill" data-skill-id="${slot.id}" title="${slot.description}" aria-pressed="${this.targetingSkillId === slot.id}" ${!hero.alive || !slot.unlocked || cooldown > 0 || (skill?.scrapCost ?? 0) > state.scrap ? 'disabled' : ''}>
          <span>${slot.label}</span><small>${status}</small>
        </button>${upgradeCost === null ? '' : `<button type="button" class="hero-skill__upgrade" data-skill-upgrade="${slot.id}" ${state.scrap < upgradeCost ? 'disabled' : ''}>+${skill.durationUpgradeMs / 1000}s · ${upgradeCost} Scrap</button>`}</div>`;
      }).join('')}</div>` : '';
    this.elements.commandHero.textContent = this.inputMode === 'move' ? 'Move Singularity · active' : 'Move Singularity · H';
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
      if (state.towers.some((tower) => tower.construction) && !this.queueModifierActive) button.disabled = true;
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
      ? 'Move Singularity active: click clear ground to issue a route. Press H to return to building; hold Shift for a temporary move order.'
      : this.inputMode === 'skill'
        ? `${getHeroSkill(this.targetingSkillId)?.label ?? 'Hero skill'} active: choose a valid target.`
      : this.simulation.map.mode === 'maze'
        ? 'Build a maze on the grid. Keep a route open to the exit. Click a wall while building to replace it and recover 80%.'
      : this.simulation.map.mode === 'rooms'
          ? state.towers.some((tower) => tower.construction)
            ? this.queueModifierActive
              ? 'Build queue active. Each placed tower reserves its tile and is assembled in order.'
              : 'Singularity is constructing. Hold Ctrl to reserve more towers in sequence.'
            : 'Build in an unlocked combat room. Singularity walks into range to assemble or upgrade it; keep every room route clear.'
        : 'Click clear ground to deploy the selected tower. Click a deployed tower to upgrade.';
  }

  showNotice(message, tone = 'neutral') {
    this.elements.notice.textContent = message;
    this.elements.notice.dataset.tone = tone;
  }

  dispose() {
    this.campaignHud?.dispose();
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
    }

    this.root.replaceChildren();
  }
}
