import { test, expect } from '@playwright/test';

// Debug toggle: panel hidden by default, 🐛 FAB shows it, persists across
// reload, and the copy-log button produces a pasteable field log.
test.describe('debug toggle + field log', () => {
  test('panel hidden by default; 🐛 toggles it on and off', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('debug-panel')).toHaveCount(0);
    await page.getByRole('button', { name: 'debug' }).click();
    await expect(page.getByTestId('debug-panel')).toBeVisible();
    await page.getByRole('button', { name: 'debug' }).click();
    await expect(page.getByTestId('debug-panel')).toHaveCount(0);
  });

  test('debug state persists across reload (field-data friendly)', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'debug' }).click();
    await expect(page.getByTestId('debug-panel')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('debug-panel')).toBeVisible();
  });

  test('run-test copies a parseable field log to the clipboard', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['clipboard-write', 'clipboard-read'] });
    const page = await context.newPage();
    await page.goto('./?debug=1');
    const panel = page.getByTestId('debug-panel');
    await panel.getByRole('button', { name: 'apply' }).click();
    await panel.locator('#dbg-runtest').click();
    // clipboard grant timing is flaky in headless; assert on the payload
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('boussole field log');
    const json = JSON.parse(text.match(/```json\n([\s\S]*?)```/)[1]);
    expect(json.venue).toBe('example');
    expect(json.pose.source).toBe('sim');
    expect(json.userAgent).toContain('Mozilla');
    await context.close();
  });

  test('fallback: clipboard refusal renders the log inline', async ({ page }) => {
    await page.goto('./?debug=1');
    const panel = page.getByTestId('debug-panel');
    await panel.getByRole('button', { name: 'apply' }).click();
    // remove the clipboard API on the live instance (addInitScript doesn't
    // survive the module graph reliably for instance getters)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard',
        { value: undefined, configurable: true, writable: true });
    });
    await panel.locator('#dbg-runtest').click();
    await expect(panel.locator('#dbg-readout')).toContainText('boussole field log');
  });
});
