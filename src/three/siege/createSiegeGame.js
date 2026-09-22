import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SiegeClient } from '../../game/siege/client.js';
import { HEROES, ABILITIES, SIEGE_MAP, BASE, PADS, EVENT_SITE } from '../../game/siege/content.js';
import { worldToRoomCell } from '../../game/simulation/roomNavigation.js';
import { SiegeHud } from '../../ui/siege/SiegeHud.js';
import { ModelLibrary } from '../loaders/ModelLibrary.js';
import { SIEGE_ASSET_MANIFEST } from '../../game/assets/manifest.js';
import { TacticalCamera } from '../TacticalCamera.js';
import { EffectsLayer } from '../EffectsLayer.js';
import { AudioManager } from '../audio/AudioManager.js';
import { SiegeScene } from './SiegeScene.js';
import { SiegePresenter } from './SiegePresenter.js';

export async function createSiegeGame() {
  const parent = document.querySelector('#game-root'), hudRoot = document.querySelector('#hud-root');
  const client = new SiegeClient(), hud = new SiegeHud(hudRoot, client); hud.mount();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x18252d); scene.fog = new THREE.FogExp2(0x293333, 0.009);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Cinder siege battlefield'); parent.replaceChildren(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer), studio = new RoomEnvironment(), environment = pmrem.fromScene(studio, 0.04);
  scene.environment = environment.texture; scene.environmentIntensity = 0.28; pmrem.dispose(); studio.dispose();
  scene.add(new THREE.HemisphereLight(0xa4d9e3, 0x514039, 2.3));
  const sun = new THREE.DirectionalLight(0xffd4a0, 3.0); sun.position.set(7, 26, 1); sun.target.position.set(23, 0, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 90 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; scene.add(sun, sun.target);
  const resize = () => { const width = parent.clientWidth, height = parent.clientHeight; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  resize();
  // The Bastion and arena props live in the reserve kit, but the siege route
  // should not block on every reserve or campaign model.
  const library = await ModelLibrary.load(SIEGE_ASSET_MANIFEST, { includeReserve: true });
  if (library.failures.length) hud.notice('Some models could not be loaded. Reload to restore the full battlefield.');
  const deck = new SiegeScene(scene, library), entities = new SiegePresenter(scene, library), effects = new EffectsLayer(scene), audio = new AudioManager({ audioVolume: 0.35 });
  const cameraControls = new TacticalCamera(camera, renderer.domElement, SIEGE_MAP, hudRoot); cameraControls.azimuth = -0.12; cameraControls.elevation = 0.82; cameraControls.target.set(21, 0, 19); cameraControls.distance = 35; cameraControls.updateCamera();
  cameraControls.toolbar.hidden = true;
  let follow = false, last = performance.now(), animation, stopped = false, lastPhase = 'lobby', lastWave = 0, bossSound = false, time = 0;
  const seenEffects = new Set();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const cursor = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.53, 48), new THREE.MeshBasicMaterial({ color: 0x8de0cb, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })); cursor.rotation.x = -Math.PI / 2; cursor.visible = false; scene.add(cursor);
  const range = cursor.clone(); range.material = cursor.material.clone(); range.material.opacity = 0.3; range.visible = false; scene.add(range);
  let aim = { x: BASE.x, y: BASE.y };
  const hero = () => client.state.heroes.find(h => h.playerId === client.playerId);
  const focus = () => { const h = hero(); if (!h) return; follow = true; cameraControls.target.set(h.x / 40, 0, h.y / 40 - 1); cameraControls.distance = 24; cameraControls.updateCamera(); };
  hud.onDeploy = focus;
  hud.onAudio = () => { audio.syncSettings({ audioEnabled: !audio.enabled, audioVolume: 0.35 }); hud.notice(audio.enabled ? 'Audio on' : 'Audio muted'); };
  const groundPoint = event => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); if (!raycaster.ray.intersectPlane(plane, hit)) return null; return { x: hit.x * 40, y: hit.z * 40 }; };
  const onMove = event => { const point = groundPoint(event); if (point) aim = point; };
  const onPointer = event => {
    if (client.state.phase !== 'playing' || hud.panel) return;
    if (event.button !== 0) { follow = false; return; }
    const point = groundPoint(event); if (!point) return;
    if (hud.targetAbility) { const result = hud.command('cast', { ability: hud.targetAbility, ...point }); if (result.ok) hud.cancelTarget(); return; }
    const dist = p => Math.hypot(p.x - point.x, p.y - point.y);
    const downed = client.state.heroes.find(h => !h.alive && dist(h) < 45);
    if (downed) { hud.command('revive', { targetId: downed.id }); return; }
    const drop = client.state.drops.find(d => dist(d) < 30); if (drop) { hud.command('interact', { targetId: drop.id }); return; }
    if (client.state.event.status === 'active' && dist(EVENT_SITE) < 50) { hud.command('interact', { targetId: 'capacitor' }); return; }
    const pad = PADS.find(p => dist(p) < 28 && !client.state.towers.some(t => t.padId === p.id));
    if (pad) { hud.padId = pad.id; hud.openPanel('build'); return; }
    const result = hud.command('move', point); if (result.ok) effects.pulse(point.x, point.y, 0x84dac6, 450, 0.18, 0.04);
  };
  const interact = () => { const h = hero(); if (!h) return; const candidates = [...client.state.heroes.filter(ally => !ally.alive).map(ally => ({ ...ally, action: 'revive' })), ...client.state.drops.map(d => ({ ...d, action: 'interact' })), ...(client.state.event.status === 'active' ? [{ ...EVENT_SITE, id: 'capacitor', action: 'interact' }] : [])]; candidates.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)); if (candidates[0]) hud.command(candidates[0].action, { targetId: candidates[0].id }); else hud.notice('No ally or supplies need interaction.'); };
  const onKey = event => {
    if (/INPUT|SELECT|TEXTAREA/.test(event.target?.tagName) || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { hud.cancelTarget(); hud.openPanel(null); }
    if (client.state.phase !== 'playing') return;
    if (key === 'i') hud.openPanel(hud.panel === 'shop' ? null : 'shop');
    if (key === 'b') hud.openPanel(hud.panel === 'build' ? null : 'build');
    if (hud.panel) return;
    if (['q','w','e'].includes(key) && hero()) hud.arm(HEROES[hero().kind].abilities[['q','w','e'].indexOf(key)]);
    if (/^[1-4]$/.test(key)) hud.useSlot(Number(key) - 1, event.shiftKey);
    if (key === 'r') interact();
    if (key === 'f') focus();
    if (key === 'o') { follow = false; cameraControls.overview(SIEGE_MAP); }
    if (key === 'p') hud.command('pause');
    if (event.key.startsWith('Arrow')) follow = false;
  };
  const stopFollow = () => { follow = false; };
  const onLost = event => { event.preventDefault(); hud.notice('Graphics interrupted. Waiting for WebGL to recover.'); };
  const onRestored = () => { resize(); hud.notice('Graphics restored.'); };
  const onUnload = () => client.save();
  renderer.domElement.addEventListener('pointerdown', onPointer); renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('wheel', stopFollow, { passive: true }); renderer.domElement.addEventListener('webglcontextlost', onLost); renderer.domElement.addEventListener('webglcontextrestored', onRestored);
  cameraControls.toolbar.addEventListener('click', stopFollow); window.addEventListener('keydown', onKey); window.addEventListener('resize', resize); window.addEventListener('beforeunload', onUnload);
  function frame(now) {
    if (stopped) return;
    const dt = Math.min(100, now - last); last = now; time += dt; client.update(dt);
    const state = client.state, h = hero();
    if (state.phase !== lastPhase) { if (state.phase === 'playing') focus(); if (state.phase === 'defeat') audio.playFailure(); if (state.phase === 'victory') audio.playBossVictory(); lastPhase = state.phase; }
    if (state.wave > lastWave) { audio.playWaveStart(); lastWave = state.wave; }
    if (state.bossSpawned && !bossSound) { audio.playBossArrival(); audio.playBossMusic(); bossSound = true; }
    cameraControls.toolbar.hidden = state.phase === 'lobby';
    if (follow && h && !cameraControls.drag) { cameraControls.target.lerp(new THREE.Vector3(h.x / 40, 0, h.y / 40 - 1), 1 - Math.exp(-dt / 200)); cameraControls.updateCamera(); }
    if (!hud.panel) cameraControls.update(dt);
    deck.update(state, time); entities.syncSiege(state, client.playerId, camera, time, dt);
    for (const effect of state.effects) if (!seenEffects.has(effect.id)) {
      seenEffects.add(effect.id);
      if (effect.type === 'shot') effects.beam(effect.x, effect.y, effect.targetX, effect.targetY, effect.color, 140);
      else if (effect.type === 'death') effects.deathBurst(effect.x, effect.y, 0xffba76);
      else effects.pulse(effect.x, effect.y, effect.color ?? 0x73ddc6, effect.type === 'impact' ? 650 : 350, effect.type === 'impact' ? 1.2 : 0.3, 0.12);
    }
    if (seenEffects.size > 600) { const active = new Set(state.effects.map(f => f.id)); for (const id of seenEffects) if (!active.has(id)) seenEffects.delete(id); }
    cursor.visible = Boolean(hud.targetAbility && h?.alive && !hud.panel);
    range.visible = cursor.visible;
    if (cursor.visible) {
      const ability = ABILITIES[hud.targetAbility]; cursor.position.set(aim.x / 40, 0.07, aim.y / 40);
      cursor.scale.setScalar((ability.radius ?? 30) / 20);
      const legal = Boolean(worldToRoomCell(SIEGE_MAP, aim.x, aim.y)) && Math.hypot(aim.x - h.x, aim.y - h.y) <= ability.range;
      cursor.material.color.set(legal ? ability.color : '#ee745f'); range.position.set(h.x / 40, 0.07, h.y / 40); range.scale.setScalar(ability.range / 20);
    }
    effects.update(dt); hud.render(); renderer.render(scene, camera); animation = requestAnimationFrame(frame);
  }
  animation = requestAnimationFrame(frame);
  return { client, hud, camera, cameraControls, renderer, scene, library, entities, focus,
    screenPoint(x, y) { const point = new THREE.Vector3(x / 40, 0, y / 40).project(camera); return { x: (point.x + 1) * parent.clientWidth / 2, y: (1 - point.y) * parent.clientHeight / 2 }; },
    dispose() { stopped = true; cancelAnimationFrame(animation); client.dispose(); hud.dispose(); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', resize); window.removeEventListener('beforeunload', onUnload); renderer.domElement.removeEventListener('pointerdown', onPointer); renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('wheel', stopFollow); renderer.domElement.removeEventListener('webglcontextlost', onLost); renderer.domElement.removeEventListener('webglcontextrestored', onRestored); cameraControls.toolbar.removeEventListener('click', stopFollow); cameraControls.dispose(); audio.dispose(); entities.dispose(); effects.dispose(); deck.dispose(); cursor.geometry.dispose(); cursor.material.dispose(); range.material.dispose(); sun.shadow.dispose(); environment.dispose(); library.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
