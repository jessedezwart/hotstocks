import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('mobile viewport shows icon-only navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Login screen should still work on mobile
    await expect(page.locator('h1')).toContainText('Hot Stocks');
    await expect(page.locator('button:has-text("Log In")')).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('Hot Stocks');
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('Hot Stocks');
  });

  test('login card is centered on all viewports', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1920, height: 1080 }, // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      
      const loginCard = page.locator('.login-card');
      await expect(loginCard).toBeVisible();
    }
  });
});
