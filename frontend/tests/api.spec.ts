import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  const apiBaseUrl = process.env.TEST_API_URL || 'https://api.hotones.nl';

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/health`);
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('CORS headers are present', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/health`);
    
    expect(response.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('leaderboard endpoint requires auth', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/api/leaderboard`);
    
    // Should return 401 without auth token
    expect(response.status()).toBe(401);
  });
});
