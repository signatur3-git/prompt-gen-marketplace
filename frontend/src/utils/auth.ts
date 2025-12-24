/**
 * Auth utility functions for handling token expiration and authentication
 */

export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface Router {
  push: (url: string) => void;
}

/**
 * Make an authenticated fetch request with automatic token expiration handling
 * If the token is expired (401), clears storage and redirects to login
 */
export async function authenticatedFetch(
  url: string,
  options: FetchOptions = {},
  router?: Router,
  currentPath?: string
): Promise<Response> {
  const token = localStorage.getItem('marketplace_token');

  if (!token) {
    throw new Error('No authentication token available');
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token expiration
  if (response.status === 401) {
    handleTokenExpiration(router, currentPath);
    throw new Error('Token expired - redirecting to login');
  }

  return response;
}

/**
 * Clear expired tokens and redirect to login
 */
export function handleTokenExpiration(router?: Router, currentPath?: string): void {
  localStorage.removeItem('marketplace_user');
  localStorage.removeItem('marketplace_token');

  if (router) {
    const redirect = currentPath || window.location.pathname + window.location.search;
    const loginUrl = `/login?redirect=${encodeURIComponent(redirect)}`;
    router.push(loginUrl);
  }
}

/**
 * Check if user has valid authentication (token + user data present)
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('marketplace_token');
  const userData = localStorage.getItem('marketplace_user');
  return Boolean(token && userData);
}

/**
 * Get current user data from localStorage
 */
export function getCurrentUser(): Record<string, unknown> | null {
  const userData = localStorage.getItem('marketplace_user');
  if (!userData) return null;

  try {
    return JSON.parse(userData) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Get current auth token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('marketplace_token');
}
