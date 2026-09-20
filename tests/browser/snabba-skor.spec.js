import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('Snabba skor opens and closes visibly on desktop and mobile', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?assets&model=Prop_SnabbaSkor');
  const viewport = page.locator('[data-asset=viewport]');
  await expect(viewport).toHaveAttribute('data-rendered-model', 'Prop_SnabbaSkor');
  await page.locator('[data-asset=animate]').uncheck();
  const opening = page.getByRole('slider', { name: 'Bag opening' });
  await expect(opening).toBeVisible();
  async function pixels() {
    const url = await page.locator('canvas').evaluate(c => c.toDataURL());
    const bitmap = sharp(Buffer.from(url.split(',')[1], 'base64'));
    const { width, height } = await bitmap.metadata();
    // Compare the model region, not mostly unchanged studio background.
    return bitmap.extract({ left: Math.floor(width * 0.2), top: Math.floor(height * 0.12),
      width: Math.floor(width * 0.6), height: Math.floor(height * 0.8) })
      .resize(180, 180).removeAlpha().raw().toBuffer();
  }
  const closed = await pixels();
  await page.screenshot({ path: testInfo.outputPath('snabba-skor-closed-desktop.png') });
  await opening.focus();
  await opening.press('End');
  await expect(viewport).toHaveAttribute('data-opening', '100');
  await expect.poll(async () => {
    const open = await pixels();
    return open.reduce((total, value, i) => total + Math.abs(value-closed[i]), 0) / open.length;
  }).toBeGreaterThan(0.5);
  await page.screenshot({ path: testInfo.outputPath('snabba-skor-open-desktop.png') });
  await opening.press('Home');
  await expect(viewport).toHaveAttribute('data-opening', '0');
  await page.locator('[data-asset=view]').selectOption('front');
  await page.screenshot({ path: testInfo.outputPath('snabba-skor-front.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-asset=view]').selectOption('perspective');
  await opening.focus();
  await opening.press('End');
  await page.screenshot({ path: testInfo.outputPath('snabba-skor-open-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const toolbar = await page.locator('.asset-library__toolbar').boundingBox();
  const specs = await page.locator('.asset-library__specs').boundingBox();
  expect(specs.y + specs.height).toBeLessThan(toolbar.y);
  await page.locator('[data-asset=models]').selectOption('Unit_Hero');
  await expect(opening).toBeHidden();
  expect(errors).toEqual([]);
});
