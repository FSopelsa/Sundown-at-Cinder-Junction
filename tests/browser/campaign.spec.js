import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { createSimulation } from '../../src/game/simulation/createSimulation.js';
import { SAVE_PREFIX } from '../../src/game/saves.js';

function workshopCheckpoint() {
  const sim = createSimulation({ levelId: 'cinder-campaign' });
  for (let i = 0; i < 3; i++) {
    const encounter = sim.map.campaign.encounters.find(e => e.id === sim.state.campaign.activeEncounterId);
    Object.assign(sim.state.wave, { index: encounter.waves, inProgress: false, completed: true, label: encounter.label });
    sim.systems.campaignSystem.update(17);
  }
  sim.state.campaign.revealRemainingMs = 0;
  Object.assign(sim.state.hero, { x: 700, y: 780, navigationCell: { roomId: 'workshop', col: 2, row: 2 }, navigationNext: null, route: [], destination: null });
  return { format: 1, savedAt: new Date().toISOString(), snapshot: sim.state.toJSON() };
}

function screenCell(col, row) {
  const camera = new THREE.PerspectiveCamera(46, 1440 / 1000, 0.1, 180);
  camera.position.set(54.35389711770673, 19.38659348435989, 60.944911487249215);
  camera.lookAt(57, 0, 39); camera.updateMatrixWorld();
  const point = new THREE.Vector3(49 + col + 0.5, 0, 33 + row + 0.5).project(camera);
  return { x: (point.x + 1) * 720, y: (1 - point.y) * 500 };
}

test('new campaign builds through pointer input, starts a wave and saves only at the machine', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?checkpoint=new');
  await expect(page.locator('[data-hud="notice"]')).toContainText('Build defenses');
  await expect(page.locator('[data-room]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('01-new-campaign.png') });
  await page.locator('[data-tower-type="teslaCoil"]').click();
  const target = screenCell(10, 5);
  await page.mouse.click(target.x, target.y);
  await expect(page.locator('[data-hud="scrap"]')).toHaveText('605');
  await expect(page.locator('[data-hud="notice"]')).toContainText('online', { timeout: 25000 });
  await page.getByRole('button', { name: 'Start wave', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('[data-hud="enemies"]').textContent())).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('02-wave-underway.png') });
  await page.getByRole('button', { name: 'Go to save machine', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_PREFIX + 'manual')).toBeNull();
  await expect(page.locator('[data-campaign="save"]')).toContainText('Machine save', { timeout: 45000 });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_PREFIX + 'manual');
  expect(saved.snapshot.towers).toHaveLength(1);
  expect(saved.snapshot.hero.navigationCell.roomId).toBe('room-1');
  expect(Math.hypot(saved.snapshot.hero.x - 2060, saved.snapshot.hero.y - 1420)).toBeLessThan(24);
  await page.reload();
  await expect(page.locator('[data-campaign="save"]')).toContainText('Resumed machine save');
  await expect(page.locator('[data-hud="scrap"]')).not.toHaveText('720');
  await page.screenshot({ path: testInfo.outputPath('03-resumed-machine-save.png') });
  expect(errors).toEqual([]);
});

test('unlocked landmarks and workshop branches are usable; only the selected trial opens', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(({ key, record }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(record));
  }, { key: SAVE_PREFIX + 'auto', record: workshopCheckpoint() });
  await page.goto('/');
  await expect(page.locator('[data-hud="notice"]')).toContainText('Junction secured');
  await page.locator('.campaign-panel summary').click();
  await expect(page.locator('[data-room]')).toHaveCount(5);
  await page.locator('[data-room="boss"]').click();
  await page.waitForTimeout(4200); // Observe the complete camera transition for screenshot review.
  await page.screenshot({ path: testInfo.outputPath('04-dormant-boss-room.png') });
  await page.locator('[data-room="sun"]').click();
  await page.waitForTimeout(4200);
  await page.screenshot({ path: testInfo.outputPath('05-sun-junction.png') });
  await page.locator('[data-trial="solar"]').click();
  await expect(page.locator('[data-campaign="title"]')).toContainText('Solar trial', { timeout: 40000 });
  await expect(page.locator('[data-room]')).toHaveCount(6);
  await expect(page.locator('[data-room="solar"]')).toHaveCount(1);
  await expect(page.locator('[data-room="cryo"]')).toHaveCount(0);
  await expect(page.locator('[data-trial="arc"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start wave', exact: true })).toBeEnabled({ timeout: 15000 });
  await page.locator('[data-room="solar"]').click();
  await page.waitForTimeout(4200);
  await page.screenshot({ path: testInfo.outputPath('06-solar-trial.png') });
  await page.getByRole('button', { name: 'Start wave', exact: true }).click();
  await expect.poll(async () => Number(await page.locator('[data-hud="enemies"]').textContent())).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Go to save machine', exact: true }).click();
  await expect(page.locator('[data-campaign="save"]')).toContainText('Machine save', { timeout: 40000 });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_PREFIX + 'manual');
  expect(saved.snapshot.campaign.activeEncounterId).toBe('solar');
  expect(saved.snapshot.enemies.every(e => e.roomCell.roomId === 'solar')).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: testInfo.outputPath('07-compact-desktop.png') });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
