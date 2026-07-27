import Phaser from 'phaser';
import { SWITCHYARD_MAP } from '../../game/content/map.js';
import { ACTIONS } from '../../game/input/actions.js';
import { KEY_BINDINGS } from '../../game/input/bindings.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.wasWaveInProgress = false;
    this.gameOverAnnounced = false;
  }

  create() {
    this.simulation = this.registry.get('simulation');
    this.hud = this.registry.get('hud');

    if (!this.simulation) {
      throw new Error('BattleScene requires a simulation in the registry.');
    }

    this.drawSwitchyard();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.wasWaveInProgress = this.simulation.state.wave.inProgress;
  }

  update(_time, delta) {
    this.simulation.update(delta);
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
      towerType: 'peacemaker',
      x: pointer.worldX,
      y: pointer.worldY,
    });

    this.hud?.showNotice(
      result.ok
        ? `${result.tower.name} deployed.`
        : result.reason,
      result.ok ? 'success' : 'warning',
    );
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
        const healthBack = this.add
          .rectangle(enemy.x - 15, enemy.y - 21, 30, 4, 0x111111)
          .setOrigin(0, 0.5)
          .setDepth(6);
        const healthBar = this.add
          .rectangle(enemy.x - 15, enemy.y - 21, 30, 4, 0xe09a55)
          .setOrigin(0, 0.5)
          .setDepth(7);
        view = { sprite, healthBack, healthBar };
        this.enemyViews.set(enemy.id, view);
      }

      view.sprite.setPosition(enemy.x, enemy.y);
      view.healthBack.setPosition(enemy.x - 15, enemy.y - 21);
      view.healthBar
        .setPosition(enemy.x - 15, enemy.y - 21)
        .setDisplaySize(30 * Math.max(0, enemy.hp / enemy.maxHp), 4);
    }

    for (const [id, view] of this.enemyViews) {
      if (!activeIds.has(id)) {
        view.sprite.destroy();
        view.healthBack.destroy();
        view.healthBar.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  announceStateChanges() {
    const state = this.simulation.state;

    if (
      this.wasWaveInProgress &&
      !state.wave.inProgress &&
      state.wave.completed
    ) {
      const message = this.simulation.systems.waveSystem.hasCompletedCampaign()
        ? 'The Black Comet is down. Cinder Junction holds.'
        : `${state.wave.label} cleared.`;
      this.hud?.showNotice(message, 'success');
    }

    if (state.stationIntegrity <= 0 && !this.gameOverAnnounced) {
      this.gameOverAnnounced = true;
      this.hud?.showNotice('Station integrity lost. The junction has fallen.', 'danger');
    }

    this.wasWaveInProgress = state.wave.inProgress;
  }

  handleShutdown() {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
  }
}
