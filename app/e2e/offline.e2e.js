import { test, expect } from '@playwright/test';

// OFF-1 acceptance: first load → go offline → full navigation still works.
test.describe('OFF-1 — offline after first load', () => {
  test('airplane mode: plan, list, detail, carnet all work', async ({ page, context }) => {
    // first load, online — SW installs and caches
    await page.goto('./');
    await expect(page.locator('b-plan canvas')).toBeVisible();
    // wait until the SW controls the page and the shell cache is populated
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) return false;
      const keys = await caches.keys();
      return keys.some((k) => k.startsWith('boussole-shell-'));
    });
    await page.reload(); // second load: now SW-controlled, content cached
    await expect(page.locator('b-plan canvas')).toBeVisible();
    await page.waitForTimeout(400);

    // airplane mode
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('b-plan canvas')).toBeVisible();

    // full navigation offline
    await page.getByRole('button', { name: 'Repères' }).click();
    await expect(page.locator('.repere-list .repere')).toHaveCount(2);
    await page.locator('.repere-list .repere').first().click();
    await expect(page.locator('.repere-detail h1')).toHaveText('Studios Multimédia');
    await page.getByRole('button', { name: 'Je suis là' }).click();
    await page.getByRole('button', { name: 'Carnet' }).click();
    await expect(page.locator('ul.carnet li')).toHaveCount(1);
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.locator('#tier')).toBeVisible();
  });
});
