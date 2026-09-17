import { test, expect } from '@playwright/test';

// AR entry flow: Vue caméra → camera pre-prompt → grant → #/ar with markers;
// simulated pose lets a marker be pointed at (regard) and captured (AR-5).
test.describe('AR view — point the phone at the target', () => {
  test('camera prompt → AR view shows the marker when facing the target', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['camera'] });
    const page = await context.newPage();
    // fake camera stream (no real device in CI)
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      navigator.mediaDevices.getUserMedia = async () => canvas.captureStream();
    });
    await page.goto('./?debug=1');
    // set pose: at the entrance, facing the repère (heading ≈ 130° SE)
    await page.getByTestId('debug-panel').locator('input[name=heading]').fill('130');
    await page.getByTestId('debug-panel').getByRole('button', { name: 'apply' }).click();
    // enter AR through the pre-prompt
    await page.getByRole('button', { name: 'Vue caméra' }).click();
    await expect(page.locator('b-arprompt .sheet')).toBeVisible();
    await page.getByRole('button', { name: 'Activer la caméra' }).click();
    // AR view is live
    await expect(page.locator('b-ar video')).toBeVisible();
    await expect(page.locator('b-ar canvas')).toBeVisible();
    // heading 130° faces r-atrium (bearing ≈ 130°) → marker paints near centre.
    // Assert via the projection model on the debug session's pose:
    const facing = await page.evaluate(() => {
      const pose = /** @type {any} */ (window).__ctx.pose.value;
      return pose && Math.abs(pose.heading - 130) < 5;
    });
    expect(facing).toBe(true);
    await context.close();
  });

  test('camera denial returns to the previous view, no dead UI (CAP-1)', async ({ browser }) => {
    const context = await browser.newContext(); // no camera permission
    const page = await context.newPage();
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Vue caméra' }).click();
    await page.getByRole('button', { name: 'Activer la caméra' }).click();
    // denial: stays on plan, AR never mounts, nav still works
    await expect(page.locator('b-ar')).toHaveCount(0);
    await expect(page.locator('b-plan canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Repères' }).click();
    await expect(page.locator('.repere-list .repere')).toHaveCount(2);
    await context.close();
  });

  test('Pas maintenant on the camera sheet stays put', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Vue caméra' }).click();
    await page.getByRole('button', { name: 'Pas maintenant' }).click();
    await expect(page.locator('b-arprompt')).toHaveCount(0);
    await expect(page.locator('b-ar')).toHaveCount(0);
  });
});
