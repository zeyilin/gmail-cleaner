import { webAuthFlowAdapter, type AuthAdapter, type TokenResult } from './authAdapter';
import type { AuthStatus } from '../messaging/commands';

const adapter: AuthAdapter = webAuthFlowAdapter;
const EMAIL_KEY = 'account_email';
const TOKEN_KEY = 'oauth_token';

// In-memory cache (the service worker may restart; chrome.storage is the source of truth).
let mem: TokenResult | undefined;

async function loadStored(): Promise<TokenResult | undefined> {
  if (mem) return mem;
  const r = await chrome.storage.local.get(TOKEN_KEY);
  mem = r[TOKEN_KEY] as TokenResult | undefined;
  return mem;
}
async function store(t: TokenResult): Promise<void> {
  mem = t;
  await chrome.storage.local.set({ [TOKEN_KEY]: t });
}
async function clearToken(): Promise<void> {
  mem = undefined;
  await chrome.storage.local.remove(TOKEN_KEY);
}

/** Returns a usable token. interactive=true is only valid in response to a user gesture. */
export async function ensureToken(interactive = false): Promise<string> {
  const cur = await loadStored();
  if (cur && cur.expiresAt > Date.now()) return cur.token;
  const r = await adapter.getToken(interactive);
  await store(r);
  return r.token;
}

/** Called on a 401 so the next request re-authenticates. */
export async function invalidateToken(_token: string): Promise<void> {
  await clearToken();
}

export async function signIn(): Promise<string> {
  const r = await adapter.getToken(true);
  await store(r);
  return r.token;
}

export async function setAccountEmail(email: string): Promise<void> {
  await chrome.storage.local.set({ [EMAIL_KEY]: email });
}

export async function getStatus(): Promise<AuthStatus> {
  const cur = await loadStored();
  if (cur && cur.expiresAt > Date.now()) {
    const stored = await chrome.storage.local.get(EMAIL_KEY);
    return { signedIn: true, email: stored[EMAIL_KEY] };
  }
  return { signedIn: false };
}

export async function signOut(): Promise<void> {
  try {
    const cur = await loadStored();
    if (cur?.token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(cur.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    }
  } catch {
    // best effort
  }
  await clearToken();
  await chrome.storage.local.remove(EMAIL_KEY);
}
