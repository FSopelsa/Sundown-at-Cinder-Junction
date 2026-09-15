import { expect, test } from '@playwright/test';

test('loads the four-room level and starts a raid without console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/?debug');
  await expect(page.getByRole('button', { name: 'Start raid' })).toBeEnabled();
  await expect(page.locator('[data-hud="hero-skills"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Move Singularity · H' })).toBeEnabled();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'Move Singularity · active' })).toBeEnabled();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'Move Singularity · H' })).toBeEnabled();

  await page.locator('[data-hud="level"]').selectOption('cinder-smeltworks');
  await Promise.all([
    page.waitForURL(/level=cinder-smeltworks/),
    page.getByRole('button', { name: 'Start level' }).click(),
  ]);

  await expect(page.locator('[data-hud="notice"]')).toContainText('Cinder Smeltworks');
  await page.getByRole('button', { name: 'Start raid' }).click();
  await expect(page.locator('[data-hud="wave"]')).toContainText('Raid 1');
  await expect.poll(async () => Number(await page.locator('[data-hud="enemies"]').textContent()))
    .toBeGreaterThan(0);
  expect(consoleErrors).toEqual([]);
});
