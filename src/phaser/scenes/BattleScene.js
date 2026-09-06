import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager.js';
import { TOWER_ANIMATION_KEYS, HERO_ANIMATION_KEYS } from '../../game/assets/manifest.js';
import { SWITCHYARD_MAP } from '../../game/content/map.js';
import { buildDistanceField, cellCenter, worldToCell, routePoints, validateMazePlacement } from '../../game/simulation/maze.js';
import { heroCellCenter } from '../../game/simulation/navigation.js';
import { ACTIONS } from '../../game/input/actions.js';
import { KEY_BINDINGS } from '../../game/input/bindings.js';
import { BattlefieldProjection } from '../presentation/BattlefieldProjection.js';

const DAMAGE_COLORS = Object.freeze({
  neutral: 0xf4cf8c,
  solar: 0xffb85c,
  cryo: 0x88e5ff,
  arc: 0xbd96ff,
  void: 0xbf8eff,
});

const TOWER_VISUALS = Object.freeze({
  sunspitter: { frame: 0, size: 72, originY: 1, animation: TOWER_ANIMATION_KEYS.sunspitterFire },
  coldIronLongshot: { frame: 'attack-00', size: 78, originY: .9375, animation: TOWER_ANIMATION_KEYS.coldIronLongshot },
  teslaCoil: { frame: 'attack-00', size: 84, originY: .9375, animation: TOWER_ANIMATION_KEYS.teslaCoil },
});

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
    this.enemyViews = new Map();
    this.towerViews = new Map();
    this.towerShadows = new Map();
    this.heroView = null;
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
    this.map = this.simulation.map;
    this.projection = new BattlefieldProjection(this.map,
      new URLSearchParams(window.location.search).get('view') === 'top-down');
    if (this.map.mode === 'maze') this.drawMaze();
    else this.drawSwitchyard();
    this.selectionGraphics = this.add.graphics().setDepth(3);
    this.heroPathGraphics = this.add.graphics().setDepth(3.5);
    this.skillFieldGraphics = this.add.graphics().setDepth(9.4);
    this.levelLabels = new Map();
    this.drawHeroRallyPoint();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.wasWaveInProgress = this.simulation.state.wave.inProgress;
  }

  update(_time, delta) {
    const { paused, speed } = this.simulation.state.settings;
    const visualSpeed = paused || this.simulation.state.stationIntegrity <= 0 ? 0 : speed;
    this.anims.globalTimeScale = visualSpeed;
    this.tweens.timeScale = visualSpeed;
    this.presentationTime = (this.presentationTime ?? 0) + Math.min(delta, 250) * visualSpeed;
    this.simulation.update(delta);
    this.syncSkillFieldViews();
    this.syncTowerViews();
    this.syncHeroView();
    this.playEnemyAudio();
    this.playCombatEffects();
    this.playHeroEffects();
    this.drawTowerSelection();
    this.drawHeroPath();
    if (this.map.mode === 'maze') this.updateMazePreview();
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

    const point = this.projection.unproject(pointer.worldX, pointer.worldY);
    const targetingSkill = this.hud?.getTargetingSkill();
    if (targetingSkill) {
      const result = this.simulation.dispatch(ACTIONS.castHeroSkill, {
        skillId: targetingSkill,
        x: point.x,
        y: point.y,
      });
      this.hud?.resolveSkillTarget(result);
      return;
    }
    const existing = this.simulation.state.towers.find((tower) => this.map.mode === 'maze'
      ? Math.abs(tower.x - point.x) < this.map.grid.cellSize / 2 && Math.abs(tower.y - point.y) < this.map.grid.cellSize / 2
      : Math.hypot(tower.x - point.x, tower.y - point.y) <= 20);
    if (existing && !(this.hud?.isBuilding() && existing.type === 'wall')) {
      this.hud?.inspectTower(existing.id);
      return;
    }
    if (this.hud?.selectedTowerId) {
      this.hud.selectedTowerId = null;
      this.hud.render(true);
      return;
    }

    if (this.hud?.isHeroCommandMode()) {
      const result = this.simulation.dispatch(ACTIONS.moveHero, {
        x: point.x,
        y: point.y,
      });
      this.hud.showNotice(
        result.ok ? 'Singularity moving. Towers will redirect the route.' : result.reason,
        result.ok ? 'success' : 'warning',
      );
      return;
    }

    const result = this.simulation.dispatch(ACTIONS.placeTower, {
      towerType: this.hud?.getSelectedTowerType() ?? 'peacemaker',
      x: point.x,
      y: point.y,
    });

    this.hud?.showNotice(
      result.ok
        ? result.replacedWall
          ? `${result.tower.name} deployed, replacing a wall for ${result.wallRefund} Scrap.`
          : `${result.tower.name} deployed.`
        : result.reason,
      result.ok ? 'success' : 'warning',
    );

    if (result.ok) {
      this.audio.playTowerPlaced();
    }
  }

  handleKeyDown(event) {
    if (['SELECT', 'INPUT', 'BUTTON'].includes(event.target?.tagName)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (key === 'h') {
      event.preventDefault();
      this.hud?.commandHero();
      return;
    }
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
      const point = this.projection.project(tower.x, tower.y);
      activeIds.add(tower.id);
      let sprite = this.towerViews.get(tower.id);

      if (!sprite) {
        const visual = TOWER_VISUALS[tower.type];
        sprite = visual
          ? this.add.sprite(tower.x, tower.y, tower.assetKey, visual.frame).setDepth(4)
          : this.add.image(tower.x, tower.y, tower.assetKey).setDepth(4);
        this.towerViews.set(tower.id, sprite);
        this.towerShadows.set(tower.id, this.add.ellipse(point.x, point.y + 9, 40, 13, 0x060b12, .5).setDepth(3));
        this.levelLabels.set(tower.id, this.add.text(tower.x + 12, tower.y + 10, '', {
          fontFamily: 'monospace', fontSize: '12px', color: '#fff0c8', backgroundColor: '#171b1f',
        }).setDepth(8));
      }

      const visual = TOWER_VISUALS[tower.type];
      if (visual) {
        sprite
          .setOrigin(0.5, visual.originY)
          .setDisplaySize(visual.size, visual.size)
          .setPosition(point.x, point.y + (this.projection.isometric ? 8 : 20));
      } else {
        sprite.setPosition(point.x, point.y);
      }
      sprite.setDepth(this.projection.depth(tower.x, tower.y));
      if ((tower.timeDilationRemainingMs ?? 0) > 0) sprite.setTint(0x9cecff);
      else sprite.clearTint();
      this.levelLabels.get(tower.id).setText(String(tower.level))
        .setPosition(point.x + 12, point.y + 10).setDepth(15);
    }

    for (const [id, sprite] of this.towerViews) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.towerViews.delete(id);
        this.levelLabels.get(id)?.destroy();
        this.levelLabels.delete(id);
        this.towerShadows.get(id)?.destroy();
        this.towerShadows.delete(id);
      }
    }
  }

  syncSkillFieldViews() {
    const graphics = this.skillFieldGraphics;
    graphics.clear();
    const pulse = 0.72 + Math.sin((this.presentationTime ?? 0) / 190) * 0.12;

    for (const well of this.simulation.state.gravityWells) {
      const rim = this.projection.circle(well.x, well.y, well.radius);
      const core = this.projection.circle(well.x, well.y, Math.max(12, well.radius * .28));
      graphics.fillStyle(0x100d23, 0.58).fillPoints(rim, true);
      graphics.lineStyle(2, 0xbf8eff, pulse).strokePoints(rim, true);
      graphics.fillStyle(0x03040a, 0.92).fillPoints(core, true);
      graphics.lineStyle(1, 0xf1d8ff, pulse * .8).strokePoints(core, true);
    }

    const portals = this.simulation.state.wormholes;
    if (portals.length === 2) {
      const first = this.projection.project(portals[0].x, portals[0].y);
      const second = this.projection.project(portals[1].x, portals[1].y);
      graphics.lineStyle(1, 0xb47cff, .42).lineBetween(first.x, first.y, second.x, second.y);
    }
    for (const portal of portals) {
      const radius = portal.cell ? 16 : 18;
      const outer = this.projection.circle(portal.x, portal.y, radius);
      const inner = this.projection.circle(portal.x, portal.y, radius * .52);
      graphics.fillStyle(0x1a1035, .74).fillPoints(outer, true);
      graphics.lineStyle(2, 0xd8b9ff, pulse).strokePoints(outer, true);
      graphics.fillStyle(0x06050e, .95).fillPoints(inner, true);
    }

    for (const pile of this.simulation.state.scrapPiles) {
      const radius = Math.min(21, 7 + pile.sourceHp / 18);
      const outline = this.projection.circle(pile.x, pile.y, radius, 12);
      graphics.fillStyle(0xc99355, .75).fillPoints(outline, true);
      graphics.lineStyle(1, 0xffe7b5, .85).strokePoints(outline, true);
    }
  }

  drawMaze() {
    if (this.projection.isometric) {
      this.drawIsometricMap();
      return;
    }
    const { grid } = this.map;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x171b1f).fillRect(0, 0, this.map.width, this.map.height);
    graphics.fillStyle(0x242a2b).fillRect(grid.x, grid.y, grid.columns * grid.cellSize, grid.rows * grid.cellSize);
    graphics.lineStyle(1, 0x72c5ca, 0.3);
    for (let col = 0; col <= grid.columns; col += 1) {
      graphics.lineBetween(grid.x + col * grid.cellSize, grid.y, grid.x + col * grid.cellSize, grid.y + grid.rows * grid.cellSize);
    }
    for (let row = 0; row <= grid.rows; row += 1) {
      graphics.lineBetween(grid.x, grid.y + row * grid.cellSize, grid.x + grid.columns * grid.cellSize, grid.y + row * grid.cellSize);
    }
    for (const [cell, label, color] of [[this.map.entrance, 'IN', 0xefbd73], [this.map.exit, 'OUT', 0x86d6af]]) {
      const point = cellCenter(this.map, cell);
      graphics.fillStyle(color, 0.3).fillRect(point.x - 20, point.y - 20, 40, 40);
      this.add.text(point.x, point.y, label, { fontFamily: 'monospace', fontSize: '13px', color: '#fff0c8' }).setOrigin(0.5).setDepth(2);
    }
    this.add.text(620, grid.y + grid.rows * grid.cellSize + 20, 'Lit line: shortest route. Towers block one cell.', { fontFamily: 'monospace', fontSize: '12px', color: '#ae9b7a' });
    this.routeGraphics = this.add.graphics().setDepth(1);
    this.previewGraphics = this.add.graphics().setDepth(2);
  }

  drawIsometricMap() {
    const { grid } = this.map;
    const g = this.add.graphics();
    g.fillStyle(0x111a24).fillRect(0, 0, this.map.width, this.map.height);
    const a = this.projection.project(grid.x, grid.y + grid.rows * grid.cellSize);
    const b = this.projection.project(grid.x + grid.columns * grid.cellSize, grid.y + grid.rows * grid.cellSize);
    const c = this.projection.project(grid.x + grid.columns * grid.cellSize, grid.y);
    // Raised board edges are static geometry; there is no 3D mesh or lighting pass.
    g.fillStyle(0x152130).fillPoints([a, b, { x: b.x, y: b.y + 20 }, { x: a.x, y: a.y + 20 }], true);
    g.fillStyle(0x23354a).fillPoints([b, c, { x: c.x, y: c.y + 20 }, { x: b.x, y: b.y + 20 }], true);
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.columns; col++) {
        const points = this.projection.cellPolygon(col, row);
        g.fillStyle((col + row) % 2 ? 0x293d48 : 0x263741).fillPoints(points, true);
        g.lineStyle(1, 0x69929d, .25).strokePoints(points, true);
      }
    }
    for (const [cell, label, color] of [[this.map.entrance, 'IN', 0xefbd73], [this.map.exit, 'OUT', 0x86d6af]]) {
      const point = cellCenter(this.map, cell);
      const screen = this.projection.project(point.x, point.y);
      g.fillStyle(color, .45).fillPoints(this.projection.cellPolygon(cell.col, cell.row), true);
      this.add.text(screen.x, screen.y, label, { fontFamily: 'monospace', fontSize: '11px', color: '#fff0c8' })
        .setOrigin(.5).setDepth(2);
    }
    this.add.text(640, 542, 'CINDER OVERLOOK  /  ARC FIELD TRIAL', {
      fontFamily: 'monospace', fontSize: '13px', color: '#a5c4cb', letterSpacing: 2,
    }).setOrigin(.5);
    this.routeGraphics = this.add.graphics().setDepth(1);
    this.previewGraphics = this.add.graphics().setDepth(2);
  }

  updateMazePreview() {
    const state = this.simulation.state;
    const routeRevision = `${state.towers.map((tower) => `${tower.id}:${tower.x}:${tower.y}`).join('|')}#${state.wormholes.map((portal) => `${portal.x}:${portal.y}`).join('|')}`;
    if (this.routeRevision !== routeRevision) {
      this.routeRevision = routeRevision;
      const field = buildDistanceField(this.map, state.towers, null, state.wormholes);
      this.routeGraphics.clear().lineStyle(3, 0x72c5ca, 0.6)
        .strokePoints(routePoints(this.map, field, state.wormholes).map(p => this.projection.project(p.x, p.y)));
      for (const tower of state.towers) {
        const cell = worldToCell(this.map, tower.x, tower.y);
        this.routeGraphics.fillStyle(0xc99355, 0.3)
          .fillPoints(this.projection.cellPolygon(cell.col, cell.row, 1), true);
      }
    }
    this.previewGraphics.clear();
    const pointer = this.input.activePointer;
    if (!pointer.isOver || this.hud?.selectedTowerId || !this.hud?.isBuilding()) return;
    const world = this.projection.unproject(pointer.worldX, pointer.worldY);
    const cell = worldToCell(this.map, world.x, world.y);
    if (cell.col < 0 || cell.col >= this.map.grid.columns || cell.row < 0 || cell.row >= this.map.grid.rows) return;
    const point = cellCenter(this.map, cell);
    const replacement = state.towers.find((tower) => tower.type === 'wall' &&
      worldToCell(this.map, tower.x, tower.y).col === cell.col &&
      worldToCell(this.map, tower.x, tower.y).row === cell.row);
    const valid = validateMazePlacement(this.map, state, point.x, point.y, {
      ignoreTowerId: replacement?.id ?? null,
    }).ok &&
      this.simulation.systems.heroSystem.canPlaceTowerAt(point.x, point.y).ok;
    this.previewGraphics.fillStyle(valid ? 0x86d6af : 0xef7e6d, 0.28)
      .fillPoints(this.projection.cellPolygon(cell.col, cell.row, 1), true);
  }

  drawTowerSelection() {
    this.selectionGraphics.clear();
    const tower = this.simulation.state.towers.find((candidate) => candidate.id === this.hud?.selectedTowerId);
    if (!tower) return;
    this.selectionGraphics.lineStyle(1, 0x72c5ca, 0.5)
      .strokePoints(this.projection.circle(tower.x, tower.y, tower.range), true);
    this.selectionGraphics.lineStyle(2, 0xffe7b5, 1)
      .strokePoints(this.projection.circle(tower.x, tower.y, 22), true);
  }

  drawHeroRallyPoint() {
    const { x, y } = this.map.heroSpawn;
    const point = this.projection.project(x, y);
    const graphics = this.add.graphics().setDepth(2);
    graphics.lineStyle(1, 0x72c5ca, 0.65).strokePoints(this.projection.circle(x, y, 22), true);
    graphics.lineStyle(2, 0xd0a566, 0.6).strokePoints(this.projection.circle(x, y, 15), true);
    this.add
      .text(point.x, point.y + 20, 'RALLY', {
        color: '#72c5ca',
        fontFamily: 'monospace',
        fontSize: '10px',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  syncHeroView() {
    const hero = this.simulation.state.hero;
    const point = this.projection.project(hero.x, hero.y);
    if (!hero.alive) {
      if (this.heroView) {
        for (const view of Object.values(this.heroView)) view.destroy();
        this.heroView = null;
      }
      return;
    }

    if (!this.heroView) {
      const sprite = this.add.sprite(hero.x, hero.y, hero.assetKey, 'idle-00')
        .setOrigin(.5, .9375).setDisplaySize(62, 62).setDepth(9);
      const healthBack = this.add
        .rectangle(hero.x - 18, hero.y - 28, 36, 5, 0x111111)
        .setOrigin(0, 0.5)
        .setDepth(10);
      const healthBar = this.add
        .rectangle(hero.x - 18, hero.y - 28, 36, 5, 0x72c5ca)
        .setOrigin(0, 0.5)
        .setDepth(11);
      const label = this.add
        .text(hero.x, hero.y - 39, '', {
          color: '#fff0c8',
          fontFamily: 'monospace',
          fontSize: '10px',
        })
        .setOrigin(0.5)
        .setDepth(11);
      const shadow = this.add.ellipse(point.x, point.y, 30, 10, 0x060b12, .6).setDepth(3);
      this.heroView = { sprite, healthBack, healthBar, label, shadow };
    }

    const { sprite, healthBack, healthBar, label, shadow } = this.heroView;
    const dx = point.x - sprite.x;
    if (Math.abs(dx) > .1) sprite.setFlipX(dx < 0);
    sprite.setPosition(point.x, point.y).setDepth(this.projection.depth(hero.x, hero.y));
    shadow.setPosition(point.x, point.y);
    const casting = (this.heroCastUntil ?? 0) > (this.presentationTime ?? 0);
    if (!casting) {
      const moving = Boolean(hero.navigationNext || hero.route.length);
      if (moving) sprite.play(HERO_ANIMATION_KEYS.run, true);
      else if (sprite.anims.currentAnim?.key !== HERO_ANIMATION_KEYS.idle) {
        sprite.play(HERO_ANIMATION_KEYS.idle);
      }
    }
    healthBack.setPosition(point.x - 18, point.y - 52).setDepth(14);
    healthBar
      .setPosition(point.x - 18, point.y - 52).setDepth(14.1)
      .setDisplaySize(36 * Math.max(0, hero.hp / hero.maxHp), 5);
    label.setPosition(point.x, point.y - 63).setText(`SINGULARITY L${hero.level}`).setDepth(15);
  }

  drawHeroPath() {
    this.heroPathGraphics.clear();
    const hero = this.simulation.state.hero;
    if (!hero.alive || !hero.destination) return;

    const points = [{ x: hero.x, y: hero.y }];
    if (hero.navigationNext) points.push(heroCellCenter(this.map, hero.navigationNext));
    for (const cell of hero.route) points.push(heroCellCenter(this.map, cell));
    if (points.length > 1) {
      this.heroPathGraphics.lineStyle(2, 0x72c5ca, 0.75)
        .strokePoints(points.map(p => this.projection.project(p.x, p.y)));
    }
    const destination = heroCellCenter(this.map, hero.destination);
    this.heroPathGraphics.lineStyle(2, 0x72c5ca, 0.85)
      .strokePoints(this.projection.circle(destination.x, destination.y, 10), true);
  }

  syncEnemyViews() {
    const activeIds = new Set();

    for (const enemy of this.simulation.state.enemies) {
      const point = this.projection.project(enemy.x, enemy.y);
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
        const shieldRing = this.add.circle(enemy.x, enemy.y, 21, 0x9775dc, .08)
          .setStrokeStyle(2, 0xbaabff, .9).setDepth(5.5);
        const shieldBar = this.add.rectangle(enemy.x - 15, enemy.y - 27, 30, 3, 0xbaabff)
          .setOrigin(0, .5).setDepth(7);
        view = { sprite, statusRing, healthBack, healthBar, shieldRing, shieldBar };
        this.enemyViews.set(enemy.id, view);
      }

      view.sprite.setPosition(point.x, point.y).setDepth(this.projection.depth(enemy.x, enemy.y));
      view.shieldRing.setPosition(point.x, point.y).setDepth(13).setVisible((enemy.shield ?? 0) > 0);
      view.shieldBar.setPosition(point.x - 15, point.y - 27).setDepth(14.2).setVisible((enemy.shield ?? 0) > 0)
        .setDisplaySize(30 * ((enemy.shield ?? 0) / (enemy.maxShield || 1)), 3);
      view.healthBack.setPosition(point.x - 15, point.y - 21).setDepth(14);
      view.healthBar
        .setPosition(point.x - 15, point.y - 21).setDepth(14.1)
        .setDisplaySize(30 * Math.max(0, enemy.hp / enemy.maxHp), 4);

      const burn = enemy.effects.find((effect) => effect.type === 'burn');
      const voidRend = enemy.effects.find((effect) => effect.type === 'void-rend');
      const slow = enemy.effects.find((effect) => effect.type === 'slow');
      const statusColor = burn
        ? DAMAGE_COLORS.solar
        : voidRend
          ? DAMAGE_COLORS.void
        : slow
          ? DAMAGE_COLORS.cryo
          : null;

      view.statusRing.setPosition(point.x, point.y).setDepth(12).setVisible(Boolean(statusColor));

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
        view.shieldRing.destroy();
        view.shieldBar.destroy();
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

    for (const worldEvent of events) {
      const event = this.projectEvent(worldEvent);
      if (event.type === 'hero-attack') {
        this.heroCastUntil = this.presentationTime + 375;
        this.heroView?.sprite.setFlipX(event.targetX < event.x).play(HERO_ANIMATION_KEYS.cast);
        const slash = this.add.graphics().setDepth(20);
        slash.lineStyle(3, 0xbf8eff, 0.9).lineBetween(
          event.x,
          event.y - 23,
          event.targetX,
          event.targetY,
        );
        this.tweens.add({
          targets: slash,
          alpha: 0,
          duration: 140,
          onComplete: () => slash.destroy(),
        });
        continue;
      }

      const color = DAMAGE_COLORS[event.damageType] ?? DAMAGE_COLORS.neutral;

      if (event.type === 'arc-chain') {
        this.playArcChain(event);
        continue;
      }
      if (event.type === 'shield-break') {
        const ring = this.add.circle(event.x, event.y, 22, 0xbd96ff, .15)
          .setStrokeStyle(3, 0xe1cdff, 1).setDepth(22);
        this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 300,
          onComplete: () => ring.destroy() });
        continue;
      }

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
        const visual = TOWER_VISUALS[event.towerType];
        const tower = this.simulation.state.towers.find((item) => item.id === event.towerId);
        if (visual) this.towerViews.get(event.towerId)?.play({ key: visual.animation,
          frameRate: 8000 / Math.min(500, (tower?.fireIntervalMs ?? 500) * .85) });
        if (event.towerType === 'sunspitter') {
          this.playSunspitterShot(event);
        } else if (event.towerType === 'coldIronLongshot') {
          this.playSunspitterShot(event, DAMAGE_COLORS.cryo);
        }
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

  projectEvent(event) {
    const projected = { ...event };
    if (Number.isFinite(event.x) && Number.isFinite(event.y)) {
      Object.assign(projected, this.projection.project(event.x, event.y));
    }
    if (Number.isFinite(event.targetX) && Number.isFinite(event.targetY)) {
      const target = this.projection.project(event.targetX, event.targetY);
      projected.targetX = target.x;
      projected.targetY = target.y;
    }
    if (event.links) projected.links = event.links.map(link => ({ ...link,
      from: this.projection.project(link.from.x, link.from.y),
      to: this.projection.project(link.to.x, link.to.y) }));
    return projected;
  }

  playSunspitterShot(event, color = DAMAGE_COLORS.solar) {
    const distance = Math.hypot(event.targetX - event.x, event.targetY - event.y) || 1;
    const directionX = (event.targetX - event.x) / distance;
    const directionY = (event.targetY - event.y) / distance;
    const startX = event.x + directionX * 18;
    const startY = event.y - 22 + directionY * 12;
    const plasma = this.add.circle(startX, startY, 5, color, 0.98).setDepth(22);
    const core = this.add.circle(startX, startY, 2.4, 0xfff5cf, 1).setDepth(23);
    const trail = this.add.graphics().setDepth(21);
    trail.lineStyle(5, color, 0.8).lineBetween(startX, startY, event.targetX, event.targetY);

    this.tweens.add({
      targets: [plasma, core],
      x: event.targetX,
      y: event.targetY,
      duration: 120,
      ease: 'Quad.easeIn',
      onComplete: () => {
        plasma.destroy();
        core.destroy();
      },
    });
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 140,
      ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  playArcChain(event) {
    const lightning = this.add.graphics().setDepth(22);
    for (const [index, link] of event.links.entries()) {
      const start = { x: link.from.x, y: link.from.y - (index === 0 ? 48 : 0) };
      const end = link.to;
      const points = [start];
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      for (let step = 1; step < 7; step++) {
        const t = step / 7;
        const offset = (step % 2 ? 1 : -1) * 7;
        points.push({ x: start.x + (end.x - start.x) * t - (end.y - start.y) / length * offset,
          y: start.y + (end.y - start.y) * t + (end.x - start.x) / length * offset });
      }
      points.push(end);
      lightning.lineStyle(6, 0xa872ff, .35).strokePoints(points);
      lightning.lineStyle(2, 0xf3eaff, 1).strokePoints(points);
    }
    this.tweens.add({ targets: lightning, alpha: 0, duration: 220,
      onComplete: () => lightning.destroy() });
  }

  playHeroEffects() {
    for (const worldEvent of this.simulation.systems.heroSystem.drainEvents()) {
      const event = this.projectEvent(worldEvent);
      if (event.type === 'gravity-well-cast') {
        this.heroCastUntil = this.presentationTime + 320;
        this.heroView?.sprite.setFlipX(event.targetX < event.x).play(HERO_ANIMATION_KEYS.cast);
        const throwLine = this.add.graphics().setDepth(20);
        throwLine.lineStyle(3, DAMAGE_COLORS.void, .9)
          .lineBetween(event.x, event.y - 24, event.targetX, event.targetY);
        this.tweens.add({ targets: throwLine, alpha: 0, duration: 210,
          onComplete: () => throwLine.destroy() });
        continue;
      }

      if (event.type === 'time-dilation') {
        for (const towerId of event.towerIds) {
          const tower = this.simulation.state.towers.find((candidate) => candidate.id === towerId);
          if (!tower) continue;
          const point = this.projection.project(tower.x, tower.y);
          const ring = this.add.circle(point.x, point.y, 15, 0x72d8ff, 0)
            .setStrokeStyle(2, 0xcaf6ff, .9).setDepth(20);
          this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: 430,
            onComplete: () => ring.destroy() });
        }
        continue;
      }

      if (event.type === 'void-rend') {
        this.heroCastUntil = this.presentationTime + 260;
        this.heroView?.sprite.setFlipX(event.targetX < event.x).play(HERO_ANIMATION_KEYS.cast);
        const rend = this.add.graphics().setDepth(20);
        rend.lineStyle(3, DAMAGE_COLORS.void, .92)
          .lineBetween(event.x, event.y - 22, event.targetX, event.targetY);
        this.tweens.add({ targets: rend, alpha: 0, duration: 220,
          onComplete: () => rend.destroy() });
        continue;
      }

      if (event.type === 'quantum-blink') {
        const trace = this.add.graphics().setDepth(21);
        trace.lineStyle(4, 0xc9a0ff, .88).lineBetween(event.x, event.y, event.targetX, event.targetY);
        const arrival = this.add.circle(event.targetX, event.targetY, 11, 0xbf8eff, .26)
          .setStrokeStyle(2, 0xf1d8ff, 1).setDepth(22);
        this.tweens.add({ targets: [trace, arrival], alpha: 0, duration: 280,
          onComplete: () => { trace.destroy(); arrival.destroy(); } });
        continue;
      }

      if (event.type === 'gravity-well-collapse') {
        const collapse = this.add.circle(event.x, event.y, 12, 0xbf8eff, .15)
          .setStrokeStyle(2, 0xf1d8ff, .9).setDepth(20);
        this.tweens.add({ targets: collapse, scale: 3, alpha: 0, duration: 360,
          onComplete: () => collapse.destroy() });
        continue;
      }

      if (event.type === 'scrap-pile-collected' || event.type === 'hero-heal') {
        const heal = this.add.circle(event.x, event.y, 8, 0x86d6af, .2)
          .setStrokeStyle(2, 0xcfffe4, .9).setDepth(20);
        this.tweens.add({ targets: heal, scale: 2.2, alpha: 0, duration: 260,
          onComplete: () => heal.destroy() });
        continue;
      }

      if (event.type === 'hero-hit') {
        const impact = this.add.circle(event.x, event.y, 16, 0xef7e6d, 0.45).setDepth(20);
        this.tweens.add({
          targets: impact,
          scale: 1.7,
          alpha: 0,
          duration: 180,
          onComplete: () => impact.destroy(),
        });
        this.heroView?.sprite.setTint(0xef7e6d);
        this.time.delayedCall(110, () => this.heroView?.sprite.clearTint());
        continue;
      }

      if (event.type === 'hero-death') {
        const burst = this.add.circle(event.x, event.y, 18, 0xef7e6d, 0.5).setDepth(20);
        this.tweens.add({
          targets: burst,
          scale: 3.2,
          alpha: 0,
          duration: 440,
          ease: 'Cubic.easeOut',
          onComplete: () => burst.destroy(),
        });
        this.hud?.showNotice('Singularity is down. They return at the next raid.', 'danger');
        continue;
      }

      if (event.type === 'hero-revive') {
        const ring = this.add.circle(event.x, event.y, 12, 0x72c5ca, 0)
          .setStrokeStyle(3, 0x72c5ca, 0.95)
          .setDepth(20);
        this.tweens.add({
          targets: ring,
          scale: 3,
          alpha: 0,
          duration: 500,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
        this.hud?.showNotice('Singularity restored for this raid.', 'success');
        continue;
      }

      if (event.type === 'hero-level-up') {
        const ring = this.add.circle(event.x, event.y, 14, 0xd0a566, 0)
          .setStrokeStyle(3, 0xd0a566, 1)
          .setDepth(20);
        this.tweens.add({
          targets: ring,
          scale: 4,
          alpha: 0,
          duration: 700,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
        this.hud?.showNotice(
          `Singularity reached level ${event.level}: ${event.damage} damage, ${event.maxHp} hull.`,
          'success',
        );
        continue;
      }

      if (event.type === 'hero-route-blocked') {
        this.hud?.showNotice('Singularity has no remaining route.', 'warning');
      }
    }
  }

  playEnemyAudio() {
    for (const event of this.simulation.systems.enemySystem.drainEvents()) {
      if (event.type === 'enemy-spawn' && event.enemyType === 'blackComet') {
        this.audio.playBossArrival();
        this.audio.playBossMusic();
      }
      if (event.type === 'wormhole-travel') {
        const portal = this.projectEvent(event);
        const trail = this.add.graphics().setDepth(21);
        trail.lineStyle(3, 0xd8b9ff, .9).lineBetween(
          portal.x,
          portal.y,
          portal.targetX,
          portal.targetY,
        );
        this.tweens.add({ targets: trail, alpha: 0, duration: 210,
          onComplete: () => trail.destroy() });
      }
    }
  }

  handleShutdown() {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.off('keydown', this.handleKeyDown, this);
    this.audio?.stop();
  }
}
