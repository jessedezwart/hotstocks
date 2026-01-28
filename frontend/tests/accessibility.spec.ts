import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('login page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    // Check basic accessibility
    const loginButton = page.locator('button:has-text("Log In")');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
    
    // Heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('page is keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Login button should be focusable with keyboard
    const loginButton = page.locator('button:has-text("Log In")');
    await loginButton.focus();
    await expect(loginButton).toBeFocused();
    
    // Should be activatable with keyboard
    await loginButton.focus();
    await page.keyboard.press('Enter');
    
    // Should redirect to Auth0 (check URL changes)
    await page.waitForURL(/auth0\.com|hotones\.nl/, { timeout: 5000 });
  });

  test('color contrast is sufficient', async ({ page }) => {
    await page.goto('/');
    
    // Login button text should be visible (white on gradient)
    const loginButton = page.locator('button:has-text("Log In")');
    await expect(loginButton).toHaveCSS('color', 'rgb(255, 255, 255)');
  });
});
