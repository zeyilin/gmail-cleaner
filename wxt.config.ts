import { defineConfig } from 'wxt';
import { readFileSync } from 'node:fs';

// WXT doesn't expose .env files to the config at build time, so load .env.local here.
// This lets anyone set their own WXT_OAUTH_CLIENT_ID (see .env.example) without editing code.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env.local — use the committed default below */
}

// The project's default OAuth client ID. Client IDs are public identifiers (they ship
// inside manifest.json), so committing it is fine. Override via WXT_OAUTH_CLIENT_ID in
// .env.local (e.g. when you create your own Google OAuth client — see README Setup).
const OAUTH_CLIENT_ID =
  process.env.WXT_OAUTH_CLIENT_ID ||
  '963121762754-aqg0ctalj1pil5vae3713k7hrkagu0e0.apps.googleusercontent.com';

// Scopes are intentionally minimal:
//  - gmail.modify        : list, read metadata, archive (batchModify), trash/untrash, create labels
//  - gmail.settings.basic: create "auto-skip-inbox" filters (combo cleanup)
// The signed-in account's email comes from gmail.getProfile (covered by gmail.modify),
// so no openid/email/profile identity scopes are requested.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Output to a normal (non-hidden) folder so it's visible in Finder / the
  // "Load unpacked" picker. Default would be the dot-prefixed ".output".
  outDir: 'dist',
  manifest: {
    name: 'Gmail Cleaner',
    description:
      'Review your Gmail inbox, see counts grouped by sender/category, one-click unsubscribe, and safely bulk-archive — never touching receipts or financial mail without your OK.',
    // version is derived from package.json by WXT (single source of truth).
    permissions: ['identity', 'storage', 'tabs'],
    host_permissions: ['https://gmail.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
    // Requested at runtime (chrome.permissions.request) only when the user performs a
    // one-click unsubscribe POST to an arbitrary sender endpoint.
    optional_host_permissions: ['https://*/*'],
    oauth2: {
      client_id: OAUTH_CLIENT_ID,
      scopes: SCOPES,
    },
    // Pins a stable extension ID (ofihbpicokjpgdmgihkldfbgapnojklg) so the OAuth
    // redirect URI (https://<id>.chromiumapp.org/) is constant. From key.pem (gitignored).
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqvfhh+AKyOPFbpg1gvOOMTKEZ1aelnSrghcvif3BHlDKbV1HPC3XRNmpFnFpo2poB5v6FxXU6M9Da7vEvrDApSrcQO6nlJ+XWxVXdwgviuqOxs3TMPF6bKIosq7YII+tDyht3hJccB2bjXabVvmR83i3PynAWKowl4tAxXlHyZMI2cXVa3voTK1qpfJBGXhFOdYp4MM8WSmdCMikGbptjrvUa1X3smRhumlGRajHgcIfQcuWSLyHfq9wua7XBQCVmV0a9Y3EkMscY6LXNMSt+OGmssAWG4sDLX29S+RJ3ZcNeO+WOvYyUTxPRoKmkWUFWd7KBbPjgxizEldoEGnh/QIDAQAB',
  },
});
