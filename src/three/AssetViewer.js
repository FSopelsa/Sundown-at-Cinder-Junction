import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSET_MANIFEST, getModelAsset } from '../game/assets/manifest.js';
import { ASSET_CATALOGUE } from '../game/assets/catalogue.js';
import { ModelLibrary } from './loaders/ModelLibrary.js';
import { animateAsset, collectMotionParts } from './assetMotion.js';
import { setZipBagOpening } from './zipBag.js';
import './assetViewer.css';

export async function createAssetViewer(parent) {
  const requested = new URLSearchParams(location.search).get('model');
  parent.innerHTML = `
    <section class="asset-library" aria-label="Sundown asset library">
      <header class="asset-library__header"><div><strong>Sundown at Cinder Junction</strong><span>Asset library</span></div><a href="./">Back to game</a></header>
      <aside class="asset-library__list">
        <label>Search<input type="search" data-asset="search" placeholder="Name or category"></label>
        <label>Collection<select data-asset="category"><option value="all">All ${ASSET_CATALOGUE.length} models</option><option value="hero">Hero</option><option value="tower">Towers</option><option value="enemy">Enemies</option><option value="boss">Bosses</option><option value="wall">Walls</option><option value="floor">Floors</option><option value="prop">Props</option></select></label>
        <select size="19" data-asset="models" aria-label="Model"></select>
        <span data-asset="count"></span>
      </aside>
      <div class="asset-library__viewport" data-asset="viewport">
        <div class="asset-library__caption"><h1 data-asset="title">Loading models</h1><span data-asset="stage" role="status"></span></div>
        <div class="asset-library__toolbar">
          <label><input type="checkbox" data-asset="rotate"> Turntable</label>
          <label><input type="checkbox" data-asset="animate" checked> Motion</label>
          <label><input type="checkbox" data-asset="wireframe"> Wireframe</label>
          <label><input type="checkbox" data-asset="grid" checked> Grid</label>
          <label>View<select data-asset="view"><option value="perspective">Perspective</option><option value="front">Front</option><option value="side">Side</option><option value="top">Top</option></select></label>
          <label data-asset="opening-control" hidden>Opening<input type="range" data-asset="opening" min="0" max="100" value="0" aria-label="Bag opening"><output data-asset="opening-value">0%</output></label>
        </div>
        <dl class="asset-library__specs" data-asset="specs"></dl>
        <a class="asset-library__download" data-asset="download" download>Download GLB kit</a>
      </div>
    </section>`;
  const query = (name) => parent.querySelector(`[data-asset="${name}"]`);
  const viewport = query('viewport');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x252d2e);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label', '3D asset preview');
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 1.4;
  controls.minDistance = 0.3;
  controls.maxDistance = 15;
  controls.maxPolarAngle = Math.PI * 0.49;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe1ecf2, 0x485044, 2));
  const key = new THREE.DirectionalLight(0xffe4c3, 3.3);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8bd6ee, 1.6);
  fill.position.set(-3, 2, -2);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x353d3d, roughness: 0.88 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.105;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(12, 12, 0x687374, 0x414b4c);
  grid.position.y = -0.103;
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);
  const modelKeys = new Set(ASSET_CATALOGUE.map((a) => a.model));
  const library = await ModelLibrary.load({ models: ASSET_MANIFEST.models.filter((a) => modelKeys.has(a.key)) }, { includeReserve: true });
  let model = null;
  let parts = [];
  let selected = ASSET_CATALOGUE.find((a) => a.node === requested) ?? ASSET_CATALOGUE[0];
  let radius = 1;
  let timeMs = 0;
  let previousTime = 0;
  let frameId;
  let disposed = false;
  let needsRender = true;
  const localMaterials = new Set();
  controls.addEventListener('change', () => { needsRender = true; });

  function frameModel() {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    radius = Math.max(size.x, size.y, size.z, 0.5);
    const directions = { perspective: [1.5, 0.85, 1.6], front: [2.3, 0.1, 0], side: [0, 0.1, 2.3], top: [0.001, 2.3, 0] };
    const direction = new THREE.Vector3(...directions[query('view').value]);
    const narrowCorrection = Math.max(1, 1 / camera.aspect);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, radius * narrowCorrection);
    controls.update();
  }

  function selectModel(entry) {
    needsRender = true;
    selected = entry;
    if (model) scene.remove(model);
    for (const material of localMaterials) material.dispose();
    localMaterials.clear();
    model = library.cloneNamed(entry.model, entry.node);
    if (!model) {
      query('title').textContent = entry.title;
      query('stage').textContent = 'Model unavailable';
      viewport.dataset.ready = 'false';
      return;
    }
    let triangles = 0;
    let primitives = 0;
    const materialCopies = new Map();
    model.traverse((node) => {
      if (!node.isMesh) return;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      primitives += 1;
      const cloneMaterial = (material) => {
        if (!materialCopies.has(material)) {
          const copy = material.clone();
          copy.wireframe = query('wireframe').checked;
          materialCopies.set(material, copy);
          localMaterials.add(copy);
        }
        return materialCopies.get(material);
      };
      node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
    });
    scene.add(model);
    query('opening-control').hidden = model.userData.interaction !== 'zip-bag-opening';
    if (!query('opening-control').hidden) setZipBagOpening(model, 0);
    query('opening').value = '0';
    query('opening-value').value = '0%';
    viewport.dataset.opening = '0';
    parts = collectMotionParts(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    query('title').textContent = entry.title;
    query('stage').textContent = entry.stage;
    query('specs').innerHTML = `<div><dt>Triangles</dt><dd>${Math.round(triangles).toLocaleString()}</dd></div><div><dt>Draw parts</dt><dd>${primitives}</dd></div><div><dt>Size (cells)</dt><dd>${size.toArray().map(v => v.toFixed(2)).join(' / ')}</dd></div>`;
    query('download').href = getModelAsset(entry.model).path;
    viewport.dataset.ready = 'true';
    viewport.dataset.model = entry.node;
    viewport.dataset.triangles = String(triangles);
    query('models').value = entry.node;
    const url = new URL(location.href);
    url.searchParams.set('model', entry.node);
    history.replaceState(null, '', url);
    frameModel();
  }

  function filterModels() {
    const search = query('search').value.toLowerCase().trim();
    const category = query('category').value;
    const entries = ASSET_CATALOGUE.filter(a => (category === 'all' || a.category === category) && `${a.title} ${a.category}`.toLowerCase().includes(search));
    query('models').replaceChildren(...entries.map(a => new Option(a.title, a.node)));
    query('count').textContent = `${entries.length} models`;
    if (entries.some(a => a.node === selected.node)) query('models').value = selected.node;
    else if (entries.length) selectModel(entries[0]);
  }

  function resize() {
    needsRender = true;
    query('models').size = window.innerWidth <= 520 ? 1 : 19;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    if (model) frameModel();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();
  filterModels();
  selectModel(selected);
  query('search').addEventListener('input', filterModels);
  query('category').addEventListener('change', filterModels);
  query('models').addEventListener('change', () => selectModel(ASSET_CATALOGUE.find(a => a.node === query('models').value)));
  query('view').addEventListener('change', () => { if (model) frameModel(); });
  query('opening').addEventListener('input', () => {
    if (!model) return;
    const value = Number(query('opening').value);
    setZipBagOpening(model, value / 100);
    query('opening-value').value = `${value}%`;
    viewport.dataset.opening = String(value);
    needsRender = true;
  });
  query('grid').addEventListener('change', () => { grid.visible = query('grid').checked; needsRender = true; });
  query('wireframe').addEventListener('change', () => {
    needsRender = true;
    for (const material of localMaterials) material.wireframe = query('wireframe').checked;
  });
  function frame(now) {
    if (disposed) return;
    const delta = Math.min(50, Math.max(0, now - previousTime));
    previousTime = now;
    if (query('animate').checked) {
      timeMs += delta;
      animateAsset(parts, timeMs, true);
      needsRender = true;
    }
    controls.autoRotate = query('rotate').checked;
    controls.update(delta / 1000);
    if (needsRender) {
      renderer.render(scene, camera);
      viewport.dataset.renderedModel = selected.node;
      needsRender = false;
    }
    frameId = requestAnimationFrame(frame);
  }
  frame(0);
  return { dispose() {
    disposed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    controls.dispose();
    for (const material of localMaterials) material.dispose();
    ground.geometry.dispose(); ground.material.dispose();
    grid.geometry.dispose(); grid.material.dispose();
    environment.dispose(); library.dispose(); renderer.dispose();
    parent.replaceChildren();
  } };
}
