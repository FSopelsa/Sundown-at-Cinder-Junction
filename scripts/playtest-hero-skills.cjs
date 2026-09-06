// Exercise player controls, not only simulation methods. Run against the local
// dev server: node scripts/playtest-hero-skills.cjs [baseUrl]
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
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text());
  });
  await page.goto(`${process.argv[2] || 'http://127.0.0.1:5174'}/?level=cinder-maze&debug`);
  await page.waitForFunction(() => window.__cinder?.game.scene.isActive('battle'));
  await page.evaluate(() => {
    const { simulation } = window.__cinder;
    simulation.state.scrap = 10000;
    simulation.state.hero.level = 5;
    simulation.state.hero.skillSlots.forEach(slot => { slot.unlocked = true; });
    simulation.state.hero.hp = 100;
  });
  await page.waitForTimeout(80);

  async function clickCell(col, row) {
    const point = await page.evaluate(({ col, row }) => {
      const { game, simulation } = window.__cinder;
      const { grid } = simulation.map;
      return game.scene.getScene('battle').projection.project(
        grid.x + (col + .5) * grid.cellSize,
        grid.y + (row + .5) * grid.cellSize,
      );
    }, { col, row });
    const rect = await page.locator('canvas').boundingBox();
    await page.mouse.click(rect.x + point.x / 1280 * rect.width, rect.y + point.y / 720 * rect.height);
  }

  // Build a wall, convert it in-place, then sell through the selected-tower UI.
  await page.locator('[data-tower-type="wall"]').click();
  await clickCell(6, 2);
  await page.locator('[data-tower-type="teslaCoil"]').click();
  await clickCell(6, 2);
  assert.equal(await page.evaluate(() => window.__cinder.simulation.state.towers[0].type), 'teslaCoil');
  await page.locator('[data-skill-id="time-dilation"]').click();
  assert.ok(await page.evaluate(() => window.__cinder.simulation.state.towers[0].timeDilationRemainingMs > 0));
  await clickCell(6, 2);
  await page.locator('[data-action="sell-tower"]').click();
  assert.equal(await page.evaluate(() => window.__cinder.simulation.state.towers.length), 0);

  // Gravity Well: spawn a durable target, arm the HUD skill, then click ground.
  await page.evaluate(() => {
    const { simulation } = window.__cinder;
    const enemy = simulation.systems.enemySystem.spawn('dustMite');
    Object.assign(enemy, {
      x: 380, y: 380, speed: 0, hp: 1000, maxHp: 1000,
      mazeCell: { col: 5, row: 6 }, mazeNext: null, attackDamage: 0,
    });
  });
  await page.locator('[data-skill-id="gravity-well"]').click();
  await clickCell(5, 6);
  await page.waitForTimeout(420);
  assert.equal(await page.evaluate(() => window.__cinder.simulation.state.gravityWells.length), 1);
  assert.ok(await page.evaluate(() => window.__cinder.simulation.state.enemies[0].effects.some(effect => effect.type === 'slow')));

  // Void Rend targets an enemy, Blink targets open ground, then two portal clicks form a route edge.
  await page.evaluate(() => {
    const { simulation } = window.__cinder;
    const enemy = simulation.systems.enemySystem.spawn('tinbackHauler');
    Object.assign(enemy, {
      x: 340, y: 420, speed: 0, hp: 1000, maxHp: 1000,
      mazeCell: { col: 4, row: 7 }, mazeNext: null, attackDamage: 0,
    });
  });
  await page.locator('[data-skill-id="void-rend"]').click();
  await clickCell(4, 7);
  assert.ok(await page.evaluate(() => window.__cinder.simulation.state.enemies.some(enemy =>
    enemy.effects.some(effect => effect.type === 'void-rend'))));
  await page.locator('[data-skill-id="quantum-blink"]').click();
  await clickCell(5, 7);
  assert.deepEqual(await page.evaluate(() => {
    const hero = window.__cinder.simulation.state.hero;
    return { x: hero.x, y: hero.y };
  }), { x: 380, y: 420 });
  await page.locator('[data-skill-id="worm-tunnel"]').click();
  await clickCell(3, 4);
  await clickCell(20, 4);
  assert.equal(await page.evaluate(() => window.__cinder.simulation.state.wormholes.length), 2);

  await page.screenshot({ path: path.join(output, 'hero-skills.png') });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'hero-skills-results.json'), JSON.stringify({ errors }, null, 2));
  console.log(JSON.stringify({ errors }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
