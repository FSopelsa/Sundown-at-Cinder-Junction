// Same deterministic 100-enemy/24-tower workload under both projections.
// Headless CPU/frame timings are comparative diagnostics, not device FPS promises.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const results = [];
  for (const view of ['top-down', 'isometric']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${process.argv[2] || 'http://127.0.0.1:5174'}/?level=cinder-overlook&debug&view=${view}`);
    await page.waitForFunction(() => window.__cinder?.game.scene.isActive('battle'));
    await page.evaluate(() => {
      const { simulation, game } = window.__cinder;
      const scene = game.scene.getScene('battle');
      simulation.state.scrap = 10000;
      simulation.state.hero.alive = false;
      for (let row = 1; row < 11; row += 3) {
        for (let col = 1; col < 18; col += 3) {
          simulation.systems.towerSystem.placeTower(['teslaCoil', 'sunspitter', 'coldIronLongshot'][(Math.floor(col / 3) + Math.floor(row / 3)) % 3],
            280 + (col + .5) * 40, 100 + (row + .5) * 40);
        }
      }
      // Place stationary enemies on open tiles; combat remains enabled.
      const occupied = new Set(simulation.state.towers.map(t => `${t.x},${t.y}`));
      let count = 0;
      for (let row = 0; row < 12 && count < 100; row++) {
        for (let col = 0; col < 18 && count < 100; col++) {
          const x = 280 + (col + .5) * 40, y = 100 + (row + .5) * 40;
          if (col === 17 && row === 5) continue;
          if (occupied.has(`${x},${y}`)) continue;
          const enemy = simulation.systems.enemySystem.spawn('sparkWagon');
          Object.assign(enemy, { x, y, speed: 0, hp: 100000, maxHp: 100000, shield: 100000, maxShield: 100000,
            mazeCell: { col, row }, mazeNext: null, attackRange: 0 });
          count++;
        }
      }
      window.__perf = { update: [], frame: [], last: 0 };
      let stepStart = 0;
      scene.events.on('preupdate', () => { stepStart = performance.now(); });
      scene.events.on('postupdate', () => window.__perf.update.push(performance.now() - stepStart));
      game.events.on('poststep', () => {
        const now = performance.now();
        if (window.__perf.last) window.__perf.frame.push(now - window.__perf.last);
        window.__perf.last = now;
      });
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => { window.__perf.update = []; window.__perf.frame = []; });
    await page.waitForTimeout(4000);
    const result = await page.evaluate(() => {
      const summary = samples => {
        if (!samples.length) throw new Error('No performance samples collected');
        const sorted = [...samples].sort((a,b) => a-b);
        return { samples: sorted.length, medianMs: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.floor(sorted.length * .95)] };
      };
      return { update: summary(window.__perf.update), frame: summary(window.__perf.frame),
        enemies: window.__cinder.simulation.state.enemies.length, towers: window.__cinder.simulation.state.towers.length };
    });
    results.push({ view, ...result });
    await page.close();
  }
  fs.mkdirSync('artifacts/playtest', { recursive: true });
  fs.writeFileSync(path.resolve('artifacts/playtest/performance.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
