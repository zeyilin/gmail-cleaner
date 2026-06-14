// Cross-browser OAuth via chrome.identity.launchWebAuthFlow (works in Chrome, Arc,
// Brave, Edge — unlike getAuthToken, which is Chrome-only). Uses the OAuth 2.0
// implicit flow (response_type=token) so no client secret is needed; the access
// token comes back in the redirect fragment. Requires a "Web application" OAuth
// client whose Authorized redirect URI is chrome.identity.getRedirectURL()
// → https://<extension-id>.chromiumapp.org/

export interface TokenResult {
  token: string;
  /** epoch ms when the token should be considered expired. */
  expiresAt: number;
}

export interface AuthAdapter {
  getToken(interactive: boolean): Promise<TokenResult>;
}

function manifestOAuth(): { clientId: string; scopes: string[] } {
  const m = chrome.runtime.getManifest() as unknown as {
    oauth2?: { client_id?: string; scopes?: string[] };
  };
  return { clientId: m.oauth2?.client_id ?? '', scopes: m.oauth2?.scopes ?? [] };
}

export const webAuthFlowAdapter: AuthAdapter = {
  getToken(interactive: boolean): Promise<TokenResult> {
    const { clientId, scopes } = manifestOAuth();
    const redirectUri = chrome.identity.getRedirectURL();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes.join(' '));

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err || !resp) {
          reject(new Error(err?.message || 'Sign-in was cancelled or failed.'));
          return;
        }
        try {
          const hash = new URL(resp).hash.replace(/^#/, '');
          const p = new URLSearchParams(hash);
          const token = p.get('access_token');
          const expiresIn = Number(p.get('expires_in') || '3600');
          if (!token) {
            reject(new Error(p.get('error') || 'No access token in the OAuth response.'));
            return;
          }
          // Refresh a minute early to avoid edge-of-expiry 401s.
          resolve({ token, expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000 });
        } catch (e) {
          reject(e as Error);
        }
      });
    });
  },
};
