// Run against the local dev server: node scripts/playtest-assets.cjs [baseUrl]
// Set PLAYWRIGHT_MODULE to the installed Playwright package if it is not local.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('artifacts/playtest');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) {
      errors.push(`${message.text()} ${message.location().url}`);
    }
  });
  await page.goto(`${process.argv[2] || 'http://127.0.0.1:5174'}/?level=cinder-maze&debug`);
  await page.waitForFunction(() => window.__cinder?.game.scene.isActive('battle'));
  const frames = await page.evaluate(() => {
    const { game } = window.__cinder;
    return ['tower-cold-iron-longshot', 'tower-tesla-coil', 'hero-circuit-marshal']
      .map(key => game.textures.get(key).getFrameNames().length);
  });
  assert.deepEqual(frames, [8, 8, 27]);
  const canvas = await page.locator('canvas').boundingBox();
  const clickWorld = (x, y) => page.mouse.click(canvas.x + x / 1280 * canvas.width, canvas.y + y / 720 * canvas.height);
  for (const [type, x] of [['coldIronLongshot', 420], ['teslaCoil', 580], ['sunspitter', 740]]) {
    await page.locator(`[data-tower-type="${type}"]`).click();
    await clickWorld(x, 260);
  }
  assert.equal(await page.evaluate(() => window.__cinder.simulation.state.towers.length), 3);
  await page.locator('[data-action="command-hero"]').click();
  await clickWorld(660, 420);
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.__cinder.game.scene.getScene('battle').heroView.sprite.anims.currentAnim.key), 'hero-circuit-marshal:run');
  await page.screenshot({ path: path.join(output, 'assets-running.png') });
  await page.waitForTimeout(2300);
  await page.evaluate(() => {
    const { simulation } = window.__cinder;
    for (const x of [480, 540, 600, 660]) {
      const enemy = simulation.systems.enemySystem.spawn('sparkWagon');
      Object.assign(enemy, { x, y: 340, speed: 0, hp: 1000, maxHp: 1000,
        mazeCell: { col: Math.floor((x - 160) / 40), row: 5 }, attackDamage: 0 });
    }
  });
  await page.waitForTimeout(240);
  await page.screenshot({ path: path.join(output, 'assets-combat.png') });
  const combat = await page.evaluate(() => {
    const { simulation, game } = window.__cinder;
    const scene = game.scene.getScene('battle');
    return { heroAnimation: scene.heroView.sprite.anims.currentAnim.key,
      shields: simulation.state.enemies.map(e => e.shield),
      towerFrames: [...scene.towerViews.values()].map(s => s.frame.name),
      fps: game.loop.actualFps };
  });
  assert.equal(combat.heroAnimation, 'hero-circuit-marshal:cast');
  assert.ok(combat.shields.some(value => value < 48));
  await page.locator('[data-action="pause"]').click();
  await page.waitForTimeout(60);
  const before = await page.evaluate(() => window.__cinder.game.scene.getScene('battle').heroView.sprite.frame.name);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__cinder.game.scene.getScene('battle').heroView.sprite.frame.name);
  assert.equal(before, after);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'assets-results.json'), JSON.stringify({ frames, combat, errors }, null, 2));
  console.log(JSON.stringify({ frames, combat, errors }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
