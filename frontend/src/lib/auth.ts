import { writable, derived, get, type Readable } from 'svelte/store';
import { createAuth0Client, type Auth0Client, type User } from '@auth0/auth0-spa-js';
import { browser } from '$app/environment';

// Stores
export const auth0Client = writable<Auth0Client | null>(null);
export const user = writable<User | null>(null);
export const isAuthenticated = writable<boolean>(false);
export const isLoading = writable<boolean>(true);
export const error = writable<string | null>(null);
export const accessToken = writable<string | null>(null);

// Derived stores
export const isLoggedIn: Readable<boolean> = derived(
  [isAuthenticated, isLoading],
  ([$isAuthenticated, $isLoading]) => $isAuthenticated && !$isLoading
);

export async function initAuth0(): Promise<void> {
  if (!browser) return;

  try {
    const client = await createAuth0Client({
      domain: import.meta.env.VITE_AUTH0_DOMAIN,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
    });

    auth0Client.set(client);

    // Handle callback
    if (window.location.search.includes('code=')) {
      await client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check authentication status
    const authenticated = await client.isAuthenticated();
    isAuthenticated.set(authenticated);

    if (authenticated) {
      const userData = await client.getUser();
      user.set(userData || null);
      
      const token = await client.getTokenSilently();
      accessToken.set(token);

      // Sync user profile with backend
      if (userData) {
        try {
          const { userApi } = await import('./api');
          await userApi.createOrUpdateMe(
            userData.email || '',
            userData.name || userData.nickname || userData.email?.split('@')[0] || 'User'
          );
        } catch (e) {
          console.error('Failed to sync user profile:', e);
        }
      }
    }

    error.set(null);
  } catch (err) {
    console.error('Auth initialization error:', err);
    error.set(err instanceof Error ? err.message : 'Authentication initialization failed');
  } finally {
    isLoading.set(false);
  }
}

export async function login(): Promise<void> {
  const client = get(auth0Client);
  if (client) {
    await client.loginWithRedirect();
  }
}

export async function logout(): Promise<void> {
  const client = get(auth0Client);
  if (client) {
    client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }
}

export async function getAccessToken(): Promise<string | null> {
  const client = get(auth0Client);
  if (!client) return null;

  try {
    const token = await client.getTokenSilently();
    accessToken.set(token);
    return token;
  } catch (err) {
    if (err && typeof err === 'object' && 'error' in err && err.error === 'login_required') {
      await login();
    }
    return null;
  }
}
