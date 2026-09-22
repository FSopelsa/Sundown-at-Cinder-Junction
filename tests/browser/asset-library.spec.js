import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { ASSET_CATALOGUE } from '../../src/game/assets/catalogue.js';

async function canvasPixels(page) {
  const dataUrl = await page.locator('canvas').evaluate(canvas => canvas.toDataURL('image/png'));
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  const { data, info } = await sharp(bytes).resize(96, 96).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const colors = new Set();
  for (let i = 0; i < data.length; i += info.channels) colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
  expect(colors.size).toBeGreaterThan(15);
  return bytes;
}

test('every authored model renders, filters, rotates and fits desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?assets');
  const viewport = page.locator('[data-asset="viewport"]');
  await expect(viewport).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-asset="animate"]').uncheck();
  for (const entry of ASSET_CATALOGUE) {
    await page.locator('[data-asset="models"]').selectOption(entry.node);
    await expect(viewport).toHaveAttribute('data-model', entry.node);
    await expect(viewport).toHaveAttribute('data-rendered-model', entry.node);
    await expect(page.locator('[data-asset="title"]')).toHaveText(entry.title);
    expect(Number(await viewport.getAttribute('data-triangles'))).toBeGreaterThan(100);
    const preview = await canvasPixels(page);
    await writeFile(testInfo.outputPath(`${entry.node}.png`), preview);
  }
  await page.locator('[data-asset="models"]').selectOption('Unit_Hero');
  await page.screenshot({ path: testInfo.outputPath('singularity-desktop.png') });
  const still = await canvasPixels(page);
  await page.locator('[data-asset="rotate"]').check();
  await expect.poll(async () => (await canvasPixels(page)).equals(still), { timeout: 5000 }).toBe(false);
  await page.locator('[data-asset="rotate"]').uncheck();
  await page.locator('[data-asset="wireframe"]').check();
  await canvasPixels(page);
  await page.locator('[data-asset="wireframe"]').uncheck();
  await page.locator('[data-asset="search"]').fill('tokamak-not-a-name');
  await expect(page.locator('[data-asset="models"] option')).toHaveCount(0);
  await page.locator('[data-asset="search"]').fill('fusion');
  await expect(page.locator('[data-asset="models"] option')).toHaveCount(2);
  await page.locator('[data-asset="search"]').clear();
  await page.locator('[data-asset="models"]').selectOption('Tower_ColdIronLongshot');
  await page.screenshot({ path: testInfo.outputPath('cryo-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await canvasPixels(page);
  await page.screenshot({ path: testInfo.outputPath('cryo-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
