import * as THREE from 'three';
import { ACTIONS } from '../game/input/actions.js';
import { KEY_BINDINGS } from '../game/input/bindings.js';
import { AudioManager } from './audio/AudioManager.js';
import { TacticalCamera } from './TacticalCamera.js';
import { EffectsLayer } from './EffectsLayer.js';
import { EntityPresenter } from './EntityPresenter.js';
import { ModelLibrary } from './loaders/ModelLibrary.js';
import { RoomScene } from './RoomScene.js';
import { worldToSimulation } from './coordinates.js';
import { getRoomAtWorldPosition, isRoomMap } from '../game/simulation/roomNavigation.js';

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export class BattlefieldRenderer {
  constructor(parent, simulation, hud) {
    if (!(parent instanceof HTMLElement)) throw new Error('Three battlefield requires an HTML parent.');
    this.parent = parent;
    this.simulation = simulation;
    this.hud = hud;
    this.running = false;
    this.presentationTime = 0;
    this.wasWaveInProgress = simulation.state.wave.inProgress;
    this.gameOverAnnounced = false;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onContextLost = this.onContextLost.bind(this);
    this.onContextRestored = this.onContextRestored.bind(this);
    this.frame = this.frame.bind(this);
  }

  async initialize() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111619);
    this.scene.fog = new THREE.FogExp2(0x1b2425, 0.014);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', '3D Cinder Junction battlefield');
    this.parent.replaceChildren(this.renderer.domElement);
    this.addLights();
    this.resize();

    this.modelLibrary = await ModelLibrary.load();
    this.roomScene = new RoomScene(this.scene, this.modelLibrary);
    this.roomScene.build(this.simulation.map);
    this.entities = new EntityPresenter(this.scene, this.modelLibrary);
    this.effects = new EffectsLayer(this.scene);
    this.audio = new AudioManager();
    this.cameraControls = new TacticalCamera(this.camera, this.renderer.domElement, this.simulation.map, this.hud.root);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    // Room blockouts currently have flat navigable terrain. Pick against a
    // stable world plane instead of decorative GLB geometry, then validate the
    // result against the room grids. That keeps input deterministic while
    // terrain meshes and navmesh height sampling arrive in a later milestone.
    this.pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pickPoint = new THREE.Vector3();
    this.preview = this.createBuildPreview();
    this.scene.add(this.preview);
    this.installEvents();
    if (this.modelLibrary.failures.length > 0) {
      this.hud.showNotice('Some 3D assets could not load; using fallback geometry.', 'warning');
    } else {
      this.hud.showNotice('3D prototype ready. The open gate links Arrival Yard to Relay Hall.', 'success');
    }
    this.running = true;
    this.lastFrameAt = performance.now();
    this.frame(this.lastFrameAt);
    return this;
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight(0x93bbc3, 0x2b150c, 2.45));
    this.scene.add(new THREE.AmbientLight(0xd2c1a4, 0.55));
    const sun = new THREE.DirectionalLight(0xffd2a1, 3.6);
    sun.position.set(-8, 16, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    this.scene.add(sun);
  }

  createBuildPreview() {
    const preview = new THREE.Mesh(
      new THREE.CylinderGeometry(0.40, 0.40, 0.07, 32),
      new THREE.MeshBasicMaterial({ color: 0x86d6af, transparent: true, opacity: 0.42 }),
    );
    preview.visible = false;
    preview.position.y = 0.07;
    return preview;
  }

  installEvents() {
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  removeEvents() {
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  onContextLost(event) {
    event.preventDefault();
    this.hud.showNotice('WebGL context lost. Restore the tab or reload the run.', 'warning');
  }

  onContextRestored() {
    this.hud.showNotice('WebGL context restored.', 'success');
    this.resize();
  }

  onResize() {
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.parent.clientWidth || window.innerWidth);
    const height = Math.max(1, this.parent.clientHeight || window.innerHeight);
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    this.renderer?.setSize(width, height, false);
  }

  raycast(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.pickPlane, this.pickPoint);
    if (!hit) return null;
    const point = worldToSimulation(hit);
    if (isRoomMap(this.simulation.map) && !getRoomAtWorldPosition(this.simulation.map, point.x, point.y)) {
      return null;
    }
    return point;
  }

  onPointerMove(event) {
    const point = this.raycast(event);
    this.preview.visible = Boolean(point && this.hud?.isBuilding() && !this.hud?.selectedTowerId);
    if (!point || !this.preview.visible) return;
    const world = this.entities ? this.simulationToWorld(point) : null;
    if (world) this.preview.position.set(world.x, 0.08, world.z);
  }

  simulationToWorld(point) {
    return { x: point.x / 40, z: point.y / 40 };
  }

  onPointerDown(event) {
    if (event.button !== 0) return;
    const point = this.raycast(event);
    if (!point) {
      if (this.hud?.isBuilding() || this.hud?.isHeroCommandMode()) {
        this.hud.showNotice('Aim within an unlocked room floor.', 'warning');
      }
      return;
    }
    this.audio.unlock();
    const targetingSkill = this.hud?.getTargetingSkill();
    if (targetingSkill) {
      this.hud.resolveSkillTarget(this.simulation.dispatch(ACTIONS.castHeroSkill, { skillId: targetingSkill, ...point }));
      return;
    }
    const hero = this.simulation.state.hero;
    if (hero.alive && distanceBetween(point, hero) <= 18) {
      this.hud.commandHero();
      return;
    }
    const existing = this.simulation.state.towers
      .find((tower) => distanceBetween(point, tower) <= 22);
    if (existing && !(this.hud?.isBuilding() && this.hud?.getSelectedTowerType() !== 'wall' && !this.hud?.selectedTowerId && existing.type === 'wall')) {
      this.hud.inspectTower(existing.id);
      return;
    }
    if (this.hud?.selectedTowerId) {
      this.hud.selectedTowerId = null;
      this.hud.render(true);
      return;
    }
    if (this.hud?.isHeroCommandMode()) {
      const result = this.simulation.dispatch(ACTIONS.moveHero, point);
      this.hud.showNotice(result.ok ? 'Singularity moving through the room graph.' : result.reason, result.ok ? 'success' : 'warning');
      return;
    }
    const result = this.simulation.dispatch(ACTIONS.placeTower, {
      towerType: this.hud?.getSelectedTowerType() ?? 'peacemaker',
      ...point,
    });
    this.hud.showNotice(
      result.ok
        ? result.replacedWall
          ? `${result.tower.name} deployed, replacing a wall for ${result.wallRefund} Scrap.`
          : `${result.tower.name} deployed.`
        : result.reason,
      result.ok ? 'success' : 'warning',
    );
    if (result.ok) this.audio.playTowerPlaced();
  }

  onKeyDown(event) {
    if (['SELECT', 'INPUT', 'BUTTON', 'TEXTAREA'].includes(event.target?.tagName)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'h') {
      event.preventDefault();
      this.hud?.commandHero();
      return;
    }
    const binding = KEY_BINDINGS[key];
    if (!binding) return;
    event.preventDefault();
    const result = this.simulation.dispatch(binding.action, binding.payload);
    if (!result.ok) this.hud?.showNotice(result.reason, 'warning');
  }

  frame(now) {
    if (!this.running) return;
    const delta = Math.min(250, Math.max(0, now - this.lastFrameAt));
    this.lastFrameAt = now;
    this.cameraControls.update(delta);
    const state = this.simulation.state;
    const visualSpeed = state.settings.paused || state.stationIntegrity <= 0 ? 0 : state.settings.speed;
    this.presentationTime += delta * visualSpeed;
    this.simulation.update(delta);
    this.entities.sync(this.simulation.state, this.hud?.selectedTowerId, this.camera, this.presentationTime);
    const combatEvents = this.simulation.systems.combatSystem.drainEvents();
    for (const event of combatEvents) {
      if (event.type === 'tower-fire') this.audio.playTowerAttack(event.towerType);
    }
    this.effects.consumeCombat(combatEvents);
    this.effects.consumeHero(this.simulation.systems.heroSystem.drainEvents());
    this.effects.update(delta);
    this.announceStateChanges();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  announceStateChanges() {
    const state = this.simulation.state;
    if (!this.wasWaveInProgress && state.wave.inProgress) this.audio.playWaveStart();
    if (this.wasWaveInProgress && !state.wave.inProgress && state.wave.completed) {
      const campaignComplete = this.simulation.systems.waveSystem.hasCompletedCampaign();
      this.hud?.showNotice(campaignComplete ? 'The Black Comet is down. Cinder Junction holds.' : `${state.wave.label} cleared.`, 'success');
      this.hud?.showWaveResult({
        label: state.wave.label,
        campaignComplete,
        carryoverCount: state.carryoverEnemies.length,
      });
      if (campaignComplete) this.audio.playBossVictory();
    }
    if (state.stationIntegrity <= 0 && !this.gameOverAnnounced) {
      this.gameOverAnnounced = true;
      this.audio.playFailure();
      this.hud?.showNotice('Station integrity lost. The junction has fallen.', 'danger');
      this.hud?.showFailure();
    }
    this.wasWaveInProgress = state.wave.inProgress;
  }

  dispose() {
    this.running = false;
    window.cancelAnimationFrame(this.animationFrame);
    this.removeEvents();
    this.cameraControls?.dispose();
    this.audio?.dispose();
    this.effects?.dispose();
    this.entities?.dispose();
    this.roomScene?.dispose();
    this.modelLibrary?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
