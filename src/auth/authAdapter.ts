// Auth is abstracted so the simple Chrome-only getAuthToken flow used today can be
// swapped for a launchWebAuthFlow + PKCE implementation (cross-browser / public release)
// without touching any caller.

export interface AuthAdapter {
  /** Returns a valid OAuth access token, prompting the user if interactive. */
  getToken(interactive: boolean): Promise<string>;
  /** Drops a (likely expired/invalid) token from the cache so the next call refetches. */
  removeToken(token: string): Promise<void>;
  /** Clears all cached tokens (sign-out). */
  clearAll(): Promise<void>;
}

export const chromeIdentityAdapter: AuthAdapter = {
  getToken(interactive: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      // The result type differs across Chrome versions (string vs { token }).
      chrome.identity.getAuthToken({ interactive }, (result: any) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || 'getAuthToken failed'));
          return;
        }
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) {
          reject(new Error('No OAuth token returned (sign-in required).'));
          return;
        }
        resolve(token);
      });
    });
  },

  removeToken(token: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
  },

  clearAll(): Promise<void> {
    return new Promise((resolve) => {
      // clearAllCachedAuthTokens exists in modern Chrome; guard just in case.
      const api: any = chrome.identity as any;
      if (typeof api.clearAllCachedAuthTokens === 'function') {
        api.clearAllCachedAuthTokens(() => resolve());
      } else {
        resolve();
      }
    });
  },
};
