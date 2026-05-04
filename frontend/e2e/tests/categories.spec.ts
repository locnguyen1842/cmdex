import { test, expect } from '@playwright/test';

function seedCategory(cat: Record<string, unknown>) {
  return {
    id: cat.id || `cat-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    icon: '',
    color: '#7c6aef',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...cat,
  };
}

test.describe('Categories', () => {
  test('can create a new category', async ({ page }) => {
    await page.goto('/');

    // Open context menu on the sidebar content area (empty space)
    const sidebarContent = page.locator('.sidebar-content');
    await sidebarContent.click({ button: 'right' });

    // Radix context menu renders as portal with role="menu"
    await expect(page.locator('[role="menuitem"]').filter({ hasText: /New Category/ })).toBeVisible({
      timeout: 5000,
    });
    await page.locator('[role="menuitem"]').filter({ hasText: /New Category/ }).click();

    // Category editor modal should appear
    await expect(page.locator('[data-testid="category-editor"]')).toBeVisible();

    // Fill in name
    await page.locator('[data-testid="category-name-input"]').fill('Test Category');

    // Click save (the last button in the dialog)
    const dialog = page.locator('[data-testid="category-editor"]');
    await dialog.locator('button').filter({ hasText: 'Create' }).click();

    // Modal should close
    await expect(page.locator('[data-testid="category-editor"]')).not.toBeVisible();

    // New category should appear in sidebar
    await expect(page.getByText('Test Category')).toBeVisible();
  });

  test('can edit a seeded category', async ({ page }) => {
    const catId = 'cat-edit-test';
    await page.addInitScript((id) => {
      (window as any).__cmdexE2E_SEED__ = {
        categories: [
          {
            id,
            name: 'Original Name',
            icon: '',
            color: '#ff0000',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
    }, catId);
    await page.goto('/');

    // Verify category exists
    await expect(page.locator('.text-sm', { hasText: 'Original Name' })).toBeVisible();

    // Right-click category header
    const catHeader = page.locator('.sidebar-section-header').first();
    await catHeader.click({ button: 'right' });

    // Click on "Edit Category" in context menu — uses role="menuitem"
    await expect(page.locator('[role="menuitem"]').filter({ hasText: 'Edit Category' })).toBeVisible({
      timeout: 5000,
    });
    await page.locator('[role="menuitem"]').filter({ hasText: 'Edit Category' }).click();

    // Category editor modal should appear
    await expect(page.locator('[data-testid="category-editor"]')).toBeVisible();

    // Change the name
    const nameInput = page.locator('[data-testid="category-name-input"]');
    await nameInput.fill('Updated Name');

    // Save
    const dialog = page.locator('[data-testid="category-editor"]');
    await dialog.locator('button').filter({ hasText: 'Save' }).click();

    // Verify updated name in sidebar
    await expect(page.getByText('Updated Name')).toBeVisible();
  });

  test('can delete a seeded category', async ({ page }) => {
    const catId = 'cat-del-test';
    await page.addInitScript((id) => {
      (window as any).__cmdexE2E_SEED__ = {
        categories: [
          {
            id,
            name: 'Delete Me',
            icon: '',
            color: '#000',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
    }, catId);
    await page.goto('/');

    // Verify category exists
    await expect(page.locator('.text-sm', { hasText: 'Delete Me' })).toBeVisible();

    // Right-click category header
    const catHeader = page.locator('.sidebar-section-header').first();
    await catHeader.click({ button: 'right' });

    // Click on "Delete" option (text-destructive menuitem)
    await expect(
      page.locator('[role="menuitem"]').filter({ hasText: 'Delete' }),
    ).toBeVisible({ timeout: 5000 });
    await page.locator('[role="menuitem"]').filter({ hasText: 'Delete' }).click();

    // Confirmation dialog should appear
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible({ timeout: 5000 });

    // Confirm deletion
    await page.locator('[data-testid="confirm-dialog-confirm"]').click();

    // Category should be gone
    await expect(page.getByText('Delete Me')).not.toBeVisible();
  });
});
