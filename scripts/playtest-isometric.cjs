const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('artifacts/playtest');
fs.mkdirSync(output, { recursive: true });
const baseUrl = process.argv[2] || 'http://127.0.0.1:5174';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  await page.goto(`${baseUrl}/?level=cinder-overlook&debug`);
  await page.waitForFunction(() => window.__cinder?.game.scene.isActive('battle'));
  async function clickCell(col, row) {
    const point = await page.evaluate(({ col, row }) => {
      const { game, simulation } = window.__cinder;
      const { grid } = simulation.map;
      return game.scene.getScene('battle').projection.project(grid.x + (col + .5) * grid.cellSize, grid.y + (row + .5) * grid.cellSize);
    }, { col, row });
    const rect = await page.locator('canvas').boundingBox();
    await page.mouse.click(rect.x + point.x / 1280 * rect.width, rect.y + point.y / 720 * rect.height);
  }
  for (const [type, col, row] of [['teslaCoil', 4, 8], ['coldIronLongshot', 3, 4], ['teslaCoil', 5, 4], ['sunspitter', 7, 4]]) {
    await page.locator(`[data-tower-type="${type}"]`).click();
    await clickCell(col, row);
  }
  assert.equal(await page.evaluate(() => window.__cinder.simulation.state.towers.length), 4);
  await clickCell(5, 4);
  assert.match(await page.locator('[data-hud="tower-name"]').textContent(), /Tesla Coil/);
  await page.locator('[data-upgrade="damage"]').click();
  assert.match(await page.locator('[data-hud="tower-name"]').textContent(), /Level 2/);
  await page.screenshot({ path: path.join(output, 'overlook-selected.png') });
  await page.locator('[data-action="command-hero"]').click();
  await clickCell(7, 8);
  const route = await page.evaluate(() => window.__cinder.simulation.state.hero.route);
  assert.equal(route.some(cell => cell.col === 4 && cell.row === 8), false);
  await page.waitForTimeout(2200);
  const hero = await page.evaluate(() => window.__cinder.simulation.state.hero);
  assert.equal(hero.x, 580);
  assert.equal(hero.y, 440);
  await clickCell(5, 6);
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const { simulation } = window.__cinder;
    window.__observed = { chain: 0, maxLinks: 0, shieldBreak: 0, cast: 0 };
    const record = simulation.systems.combatSystem.recordEvent.bind(simulation.systems.combatSystem);
    simulation.systems.combatSystem.recordEvent = event => {
      if (event.type === 'arc-chain') { window.__observed.chain++; window.__observed.maxLinks = Math.max(window.__observed.maxLinks, event.links.length); }
      if (event.type === 'shield-break') window.__observed.shieldBreak++;
      if (event.type === 'hero-attack') window.__observed.cast++;
      record(event);
    };
  });
  await page.locator('[data-action="start-wave"]').click();
  await page.waitForTimeout(7100);
  await page.screenshot({ path: path.join(output, 'overlook-combat.png') });
  await page.waitForTimeout(8500);
  const observed = await page.evaluate(() => window.__observed);
  assert.ok(observed.chain > 0);
  assert.ok(observed.maxLinks > 1);
  assert.ok(observed.shieldBreak > 0);
  assert.ok(observed.cast > 0);
  if (await page.locator('[data-action="refit"]').isVisible()) {
    await page.locator('[data-action="refit"]').click();
  }
  // Mobile HUD and playfield: direct coordinate bounds catch overlap regressions.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(output, 'overlook-mobile.png') });
  const palette = await page.locator('.build-palette').boundingBox();
  const heroPanel = await page.locator('.hero-panel').boundingBox();
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(heroPanel.y + heroPanel.height <= palette.y + 1, 'Hero panel overlaps build palette');
  assert.ok(canvas.y + canvas.height <= heroPanel.y + 1, 'Canvas overlaps hero panel');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'overlook-results.json'), JSON.stringify({ observed, errors, mobile: { palette, heroPanel, canvas } }, null, 2));
  console.log(JSON.stringify({ observed, errors }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
