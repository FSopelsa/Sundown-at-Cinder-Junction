import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { ASSET_CATALOGUE } from '../src/game/assets/catalogue.js';

const output = resolve('artifacts/playtest/asset-collection');
await mkdir(output, { recursive: true });
const layers = [];
for (let i = 0; i < ASSET_CATALOGUE.length; i += 1) {
  const entry = ASSET_CATALOGUE[i];
  const preview = await sharp(`test-results/asset-library-every-author-be16c-and-fits-desktop-and-mobile/${entry.node}.png`)
    .resize(280, 240, { fit: 'cover' }).png().toBuffer();
  layers.push({ input: preview, left: i % 5 * 280, top: Math.floor(i / 5) * 268 });
  const label = Buffer.from(`<svg width="280" height="28"><rect width="280" height="28" fill="#182022"/><text x="10" y="19" font-size="12" font-family="Arial" fill="#eee">${entry.title}</text></svg>`);
  layers.push({ input: label, left: i % 5 * 280, top: Math.floor(i / 5) * 268 + 240 });
}
await sharp({ create: { width: 1400, height: Math.ceil(ASSET_CATALOGUE.length / 5) * 268, channels: 3, background: '#182022' } })
  .composite(layers).png().toFile(resolve(output, 'collection-overview.png'));

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
  await page.goto('http://127.0.0.1:5173/?debug');
  await page.waitForFunction(() => Boolean(window.__cinder?.game.entities.heroView));
  await page.evaluate(() => {
    const { game } = window.__cinder;
    game.cameraControls.target.set(7, 0, 12);
    game.cameraControls.distance = 17;
    game.cameraControls.updateCamera();
  });

  async function point(col, row) {
    return page.evaluate(async ({ col, row }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const { game, simulation } = window.__cinder;
      const grid = simulation.map.rooms[0].grid;
      const world = new Vector3((grid.x + (col + 0.5) * grid.cellSize) / 40, 0, (grid.y + (row + 0.5) * grid.cellSize) / 40).project(game.camera);
      const rect = game.renderer.domElement.getBoundingClientRect();
      return { x: rect.x + (world.x + 1) * rect.width / 2, y: rect.y + (1 - world.y) * rect.height / 2 };
    }, { col, row });
  }

  // These are normal HUD and ground clicks. No simulation entities are injected.
  const towerButton = page.locator('[data-tower-type="peacemaker"]');
  await towerButton.click();
  const location = await point(5, 9);
  await page.mouse.click(location.x, location.y);
  await page.waitForFunction(() => window.__cinder.simulation.state.towers.some(t => t.type === 'peacemaker'));
  await page.waitForFunction(() => window.__cinder.simulation.state.towers.every(t => !t.construction), null, { timeout: 20000 });
  await page.mouse.click(location.x, location.y);
  await page.waitForFunction(() => Boolean(window.__cinder.hud.selectedTowerId));
  await page.getByRole('button', { name: 'Back to build' }).click();
  await page.locator('[data-tower-type="wall"]').click();
  const wallPoint = await point(6, 8);
  await page.mouse.click(wallPoint.x, wallPoint.y);
  await page.waitForFunction(() => window.__cinder.simulation.state.towers.some(t => t.type === 'wall'));
  await page.getByRole('button', { name: 'Start raid', exact: true }).click();
  await page.waitForFunction(() => window.__cinder.simulation.state.enemies.length > 0);
  await page.screenshot({ path: resolve(output, 'raid-desktop.png') });
  const evidence = await page.evaluate(() => {
    const { game, simulation } = window.__cinder;
    let instances = 0;
    let visibleOldFloor = 0;
    game.scene.traverse(node => {
      if (node.isInstancedMesh) instances += 1;
      if (node.isMesh && /^Floor[ _](plate|slab)/.test(node.name) && node.visible) visibleOldFloor += 1;
    });
    const gl = game.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      level: simulation.state.levelId, enemies: simulation.state.enemies.length,
      towers: simulation.state.towers.map(t => ({ type: t.type, constructing: Boolean(t.construction) })),
      hero: game.entities.heroView.root.name, failedModels: game.modelLibrary.failures.map(f => f.key),
      floorInstanceBatches: instances, visibleOldFloor,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      render: { calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles },
    };
  });
  assert.equal(evidence.failedModels.length, 0);
  assert.equal(evidence.visibleOldFloor, 0);
  assert.equal(evidence.floorInstanceBatches, 12);
  assert.equal(evidence.hero, 'Unit_Hero');
  assert.ok(evidence.enemies > 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  await writeFile(resolve(output, 'browser-review.json'), `${JSON.stringify({ ...evidence, errors, failedRequests }, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
