import { test, expect } from '@playwright/test';

test.describe('App smoke test', () => {
  test('loads and shows the welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sidebar-header h1')).toContainText('CmDex');
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('can open a new command tab via sidebar + button', async ({ page }) => {
    await page.goto('/');

    const addBtn = page.locator('[data-testid="sidebar-add-command"]');
    await addBtn.click();

    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible();
  });
});
