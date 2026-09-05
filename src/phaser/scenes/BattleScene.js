import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager.js';
import { SWITCHYARD_MAP } from '../../game/content/map.js';
import { ACTIONS } from '../../game/input/actions.js';
import { KEY_BINDINGS } from '../../game/input/bindings.js';

const DAMAGE_COLORS = Object.freeze({
  neutral: 0xf4cf8c,
  solar: 0xffb85c,
  cryo: 0x88e5ff,
});

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.wasWaveInProgress = false;
    this.gameOverAnnounced = false;
    this.audio = null;
  }

  create() {
    this.simulation = this.registry.get('simulation');
    this.hud = this.registry.get('hud');

    if (!this.simulation) {
      throw new Error('BattleScene requires a simulation in the registry.');
    }

    this.audio = new AudioManager(this);
    this.audio.startCombatAmbience();
    this.drawSwitchyard();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.wasWaveInProgress = this.simulation.state.wave.inProgress;
  }

  update(_time, delta) {
    this.simulation.update(delta);
    this.playEnemyAudio();
    this.playCombatEffects();
    this.syncTowerViews();
    this.syncEnemyViews();
    this.announceStateChanges();
  }

  drawSwitchyard() {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x171b1f, 1);
    graphics.fillRect(0, 0, SWITCHYARD_MAP.width, SWITCHYARD_MAP.height);

    graphics.lineStyle(1, 0x704d2d, 0.16);
    for (let x = 40; x < SWITCHYARD_MAP.width; x += 40) {
      graphics.lineBetween(x, 0, x, SWITCHYARD_MAP.height);
    }
    for (let y = 40; y < SWITCHYARD_MAP.height; y += 40) {
      graphics.lineBetween(0, y, SWITCHYARD_MAP.width, y);
    }

    graphics.lineStyle(58, 0x2a2724, 1);
    graphics.strokePoints(SWITCHYARD_MAP.path, false, false);
    graphics.lineStyle(34, 0x725033, 1);
    graphics.strokePoints(SWITCHYARD_MAP.path, false, false);
    graphics.lineStyle(4, 0xd0a566, 0.72);
    graphics.strokePoints(SWITCHYARD_MAP.path, false, false);

    for (const point of SWITCHYARD_MAP.path) {
      graphics.fillStyle(0xd0a566, 0.55);
      graphics.fillCircle(point.x, point.y, 5);
    }

    this.add
      .text(28, SWITCHYARD_MAP.height - 42, 'CINDER SWITCHYARD // ROUTE LOCKED', {
        color: '#c99355',
        fontFamily: 'monospace',
        fontSize: '14px',
      })
      .setAlpha(0.72);
  }

  handlePointerDown(pointer) {
    if (pointer.rightButtonDown()) {
      return;
    }

    const result = this.simulation.dispatch(ACTIONS.placeTower, {
      towerType: this.hud?.getSelectedTowerType() ?? 'peacemaker',
      x: pointer.worldX,
      y: pointer.worldY,
    });

    this.hud?.showNotice(
      result.ok
        ? `${result.tower.name} deployed.`
        : result.reason,
      result.ok ? 'success' : 'warning',
    );

    if (result.ok) {
      this.audio.playTowerPlaced();
    }
  }

  handleKeyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const binding = KEY_BINDINGS[key];

    if (!binding) {
      return;
    }

    event.preventDefault();
    const result = this.simulation.dispatch(binding.action, binding.payload);

    if (!result.ok) {
      this.hud?.showNotice(result.reason, 'warning');
    }
  }

  syncTowerViews() {
    const activeIds = new Set();

    for (const tower of this.simulation.state.towers) {
      activeIds.add(tower.id);
      let sprite = this.towerViews.get(tower.id);

      if (!sprite) {
        sprite = this.add.image(tower.x, tower.y, tower.assetKey).setDepth(4);
        this.towerViews.set(tower.id, sprite);
      }

      sprite.setPosition(tower.x, tower.y);
    }

    for (const [id, sprite] of this.towerViews) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.towerViews.delete(id);
      }
    }
  }

  syncEnemyViews() {
    const activeIds = new Set();

    for (const enemy of this.simulation.state.enemies) {
      activeIds.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);

      if (!view) {
        const sprite = this.add.image(enemy.x, enemy.y, enemy.assetKey).setDepth(5);
        const statusRing = this.add
          .circle(enemy.x, enemy.y, 18, 0xffffff, 0)
          .setStrokeStyle(2, 0xffffff, 0.8)
          .setDepth(4.5)
          .setVisible(false);
        const healthBack = this.add
          .rectangle(enemy.x - 15, enemy.y - 21, 30, 4, 0x111111)
          .setOrigin(0, 0.5)
          .setDepth(6);
        const healthBar = this.add
          .rectangle(enemy.x - 15, enemy.y - 21, 30, 4, 0xe09a55)
          .setOrigin(0, 0.5)
          .setDepth(7);
        view = { sprite, statusRing, healthBack, healthBar };
        this.enemyViews.set(enemy.id, view);
      }

      view.sprite.setPosition(enemy.x, enemy.y);
      view.healthBack.setPosition(enemy.x - 15, enemy.y - 21);
      view.healthBar
        .setPosition(enemy.x - 15, enemy.y - 21)
        .setDisplaySize(30 * Math.max(0, enemy.hp / enemy.maxHp), 4);

      const burn = enemy.effects.find((effect) => effect.type === 'burn');
      const slow = enemy.effects.find((effect) => effect.type === 'slow');
      const statusColor = burn
        ? DAMAGE_COLORS.solar
        : slow
          ? DAMAGE_COLORS.cryo
          : null;

      view.statusRing.setPosition(enemy.x, enemy.y).setVisible(Boolean(statusColor));

      if (statusColor) {
        view.statusRing.setStrokeStyle(2, statusColor, 0.9);
        view.sprite.setTint(statusColor);
        view.healthBar.setFillStyle(statusColor);
      } else {
        view.sprite.clearTint();
        view.healthBar.setFillStyle(0xe09a55);
      }
    }

    for (const [id, view] of this.enemyViews) {
      if (!activeIds.has(id)) {
        view.sprite.destroy();
        view.statusRing.destroy();
        view.healthBack.destroy();
        view.healthBar.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  announceStateChanges() {
    const state = this.simulation.state;

    if (!this.wasWaveInProgress && state.wave.inProgress) {
      this.audio.playWaveStart();
    }

    if (
      this.wasWaveInProgress &&
      !state.wave.inProgress &&
      state.wave.completed
    ) {
      const message = this.simulation.systems.waveSystem.hasCompletedCampaign()
        ? 'The Black Comet is down. Cinder Junction holds.'
        : `${state.wave.label} cleared.`;
      this.hud?.showNotice(message, 'success');
      this.hud?.showWaveResult({
        label: state.wave.label,
        campaignComplete: this.simulation.systems.waveSystem.hasCompletedCampaign(),
        carryoverCount: state.carryoverEnemies.length,
      });

      if (this.simulation.systems.waveSystem.hasCompletedCampaign()) {
        this.audio.playBossVictory();
      }
    }

    if (state.stationIntegrity <= 0 && !this.gameOverAnnounced) {
      this.gameOverAnnounced = true;
      this.audio.playFailure();
      this.hud?.showNotice('Station integrity lost. The junction has fallen.', 'danger');
      this.hud?.showFailure();
    }

    this.wasWaveInProgress = state.wave.inProgress;
  }

  playCombatEffects() {
    const events = this.simulation.systems.combatSystem.drainEvents();

    for (const event of events) {
      const color = DAMAGE_COLORS[event.damageType] ?? DAMAGE_COLORS.neutral;

      if (event.type === 'hit') {
        const spark = this.add
          .circle(event.x, event.y, 4, color, 0.9)
          .setDepth(20);
        this.tweens.add({
          targets: spark,
          scale: 2.6,
          alpha: 0,
          duration: 220,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        });
        continue;
      }

      if (event.type === 'tower-fire') {
        this.audio.playTowerAttack(event.towerType);
        continue;
      }

      if (event.type === 'death') {
        const burst = this.add
          .circle(event.x, event.y, 14, color, 0.42)
          .setDepth(20);
        const ring = this.add
          .circle(event.x, event.y, 8, color, 0)
          .setStrokeStyle(4, color, 0.95)
          .setDepth(21);

        this.tweens.add({
          targets: burst,
          scale: 3,
          alpha: 0,
          duration: 360,
          ease: 'Cubic.easeOut',
          onComplete: () => burst.destroy(),
        });
        this.tweens.add({
          targets: ring,
          scale: 3.5,
          alpha: 0,
          duration: 420,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
      }
    }
  }

  playEnemyAudio() {
    for (const event of this.simulation.systems.enemySystem.drainEvents()) {
      if (event.type === 'enemy-spawn' && event.enemyType === 'blackComet') {
        this.audio.playBossArrival();
        this.audio.playBossMusic();
      }
    }
  }

  handleShutdown() {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
    this.audio?.stop();
  }
}
