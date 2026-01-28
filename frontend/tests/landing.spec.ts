import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows login screen when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should show login card
    await expect(page.locator('h1')).toContainText('Hot Stocks');
    await expect(page.locator('text=Virtual trading game')).toBeVisible();
    await expect(page.locator('text=Log In to Play')).toBeVisible();
  });

  test('login button is clickable', async ({ page }) => {
    await page.goto('/');
    
    const loginButton = page.locator('button:has-text("Log In to Play")');
    await expect(loginButton).toBeEnabled();
  });

  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/Hot Stocks/);
  });
});
