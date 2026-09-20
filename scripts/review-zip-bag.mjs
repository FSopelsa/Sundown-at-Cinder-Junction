import assert from 'node:assert/strict';
import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const output = resolve('artifacts/playtest/zip-bag');
await mkdir(output, { recursive: true });
const results = await readdir('test-results', { withFileTypes: true });
const suite = results.find(entry => entry.isDirectory() && entry.name.startsWith('zip-bag-'));
assert.ok(suite, 'Run the zip-bag browser test before this review.');
for (const file of await readdir(resolve('test-results', suite.name))) {
  if (file.endsWith('.png')) await copyFile(resolve('test-results', suite.name, file), resolve(output, file));
}

const url = process.argv[2] ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${url}/?debug`);
  await page.waitForFunction(() => Boolean(window.__cinder?.game.entities.heroView));
  const placement = await page.evaluate(async () => {
    const { game, simulation } = window.__cinder;
    const { ModelLibrary } = await import('/src/three/loaders/ModelLibrary.js');
    const { MODEL_KEYS, getModelAsset } = await import('/src/game/assets/manifest.js');
    const { setZipBagOpening } = await import('/src/three/zipBag.js');
    const { Box3 } = await import('/node_modules/three/build/three.module.js');
    const library = await ModelLibrary.load({ models: [getModelAsset(MODEL_KEYS.zipBag)] }, { includeReserve: true });
    if (library.failures.length) throw new Error('Bag failed to load in the battlefield.');
    const closed = library.cloneNamed(MODEL_KEYS.zipBag, 'Prop_ZipBag');
    const open = library.cloneNamed(MODEL_KEYS.zipBag, 'Prop_ZipBag');
    closed.position.set(6.0, 0.004, 9.6);
    open.position.set(7.0, 0.004, 9.6);
    closed.scale.setScalar(0.7);
    open.scale.setScalar(0.7);
    setZipBagOpening(open, 1);
    const before = JSON.stringify(simulation.state);
    game.scene.add(closed, open);
    game.cameraControls.target.set(6.5, 0, 9.5);
    game.cameraControls.distance = 6;
    game.cameraControls.updateCamera();
    for (const bag of [closed, open]) {
      bag.rotation.y = Math.atan2(-(game.camera.position.z-bag.position.z), game.camera.position.x-bag.position.x);
    }
    const after = JSON.stringify(simulation.state);
    const bounds = [closed, open].map(bag => new Box3().setFromObject(bag, true));
    let opaqueShadows = 0;
    closed.traverse(node => { if (node.isMesh && node.castShadow) opaqueShadows += 1; });
    return { simulationUnchanged: before === after, groundY: bounds.map(b => b.min.y),
      opaqueShadows, independentOpening: closed.userData.opening === undefined && open.userData.opening === 1 };
  });
  assert.equal(placement.simulationUnchanged, true);
  assert.equal(placement.independentOpening, true);
  assert.equal(placement.opaqueShadows, 0);
  assert.ok(placement.groundY.every(y => Math.abs(y - 0.004) < 0.001));
  await page.getByRole('button', { name: 'Start raid', exact: true }).click();
  await page.waitForFunction(() => window.__cinder.simulation.state.enemies.length > 0);
  await page.screenshot({ path: resolve(output, 'zip-bag-battlefield.png') });
  await page.screenshot({ path: resolve(output, 'zip-bag-battlefield.jpg'), type: 'jpeg', quality: 80 });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'browser-review.json'), `${JSON.stringify({ ...placement, errors }, null, 2)}\n`);
  console.log(JSON.stringify(placement, null, 2));
} finally {
  await browser.close();
}
