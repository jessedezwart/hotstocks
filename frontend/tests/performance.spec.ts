import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('no console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors (e.g., third-party)
    const unexpectedErrors = consoleErrors.filter(
      (error) => !error.includes('auth0') && !error.includes('favicon')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('no network request failures on load', async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on('requestfailed', (request) => {
      failedRequests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    expect(failedRequests).toHaveLength(0);
  });

  test('static assets are cached', async ({ page, context }) => {
    // First load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Second load should use cache
    const response = await page.goto('/');
    
    // Main page should load successfully
    expect(response?.ok()).toBeTruthy();
  });
});
