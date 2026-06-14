import { chromeIdentityAdapter, type AuthAdapter } from './authAdapter';
import type { AuthStatus } from '../messaging/commands';

const adapter: AuthAdapter = chromeIdentityAdapter;
const EMAIL_KEY = 'account_email';

// Short-lived in-memory cache. The service worker may be killed at any time, but
// chrome.identity caches the token itself, so a cold getToken(false) is still cheap.
let cachedToken: string | undefined;

/** Returns a usable token. Pass interactive=true only in response to a user gesture. */
export async function ensureToken(interactive = false): Promise<string> {
  if (cachedToken && !interactive) return cachedToken;
  const token = await adapter.getToken(interactive);
  cachedToken = token;
  return token;
}

/** Called on a 401 so the next request fetches a fresh token. */
export async function invalidateToken(token: string): Promise<void> {
  if (token === cachedToken) cachedToken = undefined;
  await adapter.removeToken(token);
}

export async function signIn(): Promise<string> {
  const token = await adapter.getToken(true);
  cachedToken = token;
  return token;
}

export async function setAccountEmail(email: string): Promise<void> {
  await chrome.storage.local.set({ [EMAIL_KEY]: email });
}

export async function getStatus(): Promise<AuthStatus> {
  try {
    const token = await adapter.getToken(false);
    cachedToken = token;
    const stored = await chrome.storage.local.get(EMAIL_KEY);
    return { signedIn: true, email: stored[EMAIL_KEY] };
  } catch {
    return { signedIn: false };
  }
}

export async function signOut(): Promise<void> {
  try {
    const token = cachedToken || (await adapter.getToken(false));
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    await adapter.removeToken(token);
  } catch {
    // ignore — best effort
  }
  await adapter.clearAll();
  cachedToken = undefined;
  await chrome.storage.local.remove(EMAIL_KEY);
}
