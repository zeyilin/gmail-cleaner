# Gmail Cleaner

A Manifest V3 Chrome extension that helps you clean up your Gmail inbox:

- **Review & group** — see counts grouped by sender (volume), Gmail category, age, read/unread, and whether mail is unsubscribable.
- **One-click unsubscribe** — uses the RFC 8058 one-click standard when available, otherwise opens the unsubscribe link or sends an opt-out.
- **Bulk cleanup** — archive / label / trash a sender's backlog, with a **preview + confirm** step and **undo** for every reversible action.
- **Safety first** — receipts, financial, and medical mail are classified as **protected** and excluded from every destructive action. Deletion uses Trash (reversible), never permanent delete. A read-only **phishing advisory** flags lookalike senders but never acts on them.

It is 100% client-side: OAuth via `chrome.identity`, all calls go straight from the extension's service worker to the Gmail REST API. **No server, nothing leaves your machine except the Gmail API calls themselves.**

> ⚠️ **Heads-up:** like any Gmail extension, this needs a one-time ~5-minute Google OAuth setup before it works for you. There's no way around it.

## Can I use it?

It uses Gmail's *restricted* `gmail.modify` scope, so the Google project stays in **"Testing"** mode (which avoids Google's verification + paid security audit). Two ways to get access:

- **Self-serve (anyone):** create your own free Google OAuth client in ~5 minutes and put its ID in `.env.local` — see **Setup** below.
- **Get added as a tester:** open an issue (or message the maintainer) with your Gmail address and you'll be added as a test user (max 100); then just clone → `npm install` → `npm run build` → load unpacked.

> **Status:** early alpha — expect rough edges. It only ever **archives or trashes** (both reversible) and never permanently deletes; receipts / financial / medical mail is excluded from bulk actions by default. Feedback very welcome (below)!

---

## Quick start (no build needed)

If you've been **added as a tester** (or it's your own machine), you don't need Node:

1. Download the repo (green **Code → Download ZIP**, then unzip) — or `git clone`.
2. Open `chrome://extensions` → enable **Developer mode** (top-right).
3. **Load unpacked** → select the **`extension/`** folder (a prebuilt, ready-to-load build).
4. Click the icon → **Open dashboard → Sign in**.

> The prebuilt `extension/` is wired to the maintainer's Google client, so sign-in works only for **added test users**. Not one yet? [Open an issue](https://github.com/zeyilin/gmail-cleaner/issues/new/choose) with your Gmail to be added — or do the **Setup** below with your own client ID and run `npm run build`.

---

## Setup — get it running (self-serve, ~5 min)

### 1. Create a Google Cloud OAuth client
1. Go to <https://console.cloud.google.com/> → create a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**, publishing status: **Testing**.
   - Add your Google account (e.g. `zeyi.lin@gmail.com`) under **Test users**. (≤100 test users ⇒ no verification, no security assessment.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized redirect URIs** → **Add URI**, paste exactly:
     `https://ofihbpicokjpgdmgihkldfbgapnojklg.chromiumapp.org/`
     (the extension's fixed redirect — derived from the pinned extension ID, identical on every machine.)
5. Copy the generated **client ID** (`...apps.googleusercontent.com`).

> Sign-in uses `chrome.identity.launchWebAuthFlow`, so it works in **Chrome, Arc, Brave, and Edge** — not just Google Chrome.

### 2. Configure the extension
```bash
cp .env.example .env.local
# edit .env.local and set WXT_OAUTH_CLIENT_ID=<your client id>
npm install
npm run build
```

### 3. Load it in Chrome
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `dist/chrome-mv3` folder.
3. Confirm the card shows ID `ofihbpicokjpgdmgihkldfbgapnojklg`.
4. Click the toolbar icon → **Open dashboard** → **Sign in**.

> **Note — stable ID:** the extension ID is pinned to `ofihbpicokjpgdmgihkldfbgapnojklg` via the `key` already set in `wxt.config.ts`, so it stays the same across machines and rebuilds — no load/copy/rebuild dance needed.

---

## Scopes requested (minimal)
- `gmail.modify` — list, read metadata, archive (`batchModify`), trash/untrash, create labels.
- `gmail.settings.basic` — create "skip the inbox" filters (used by the combo cleanup; optional).
- `openid email profile` — identify the signed-in account.

`gmail.send` (for mailto-style unsubscribe) and broader scopes are intentionally **not** requested.

---

## Development
```bash
npm run dev        # WXT dev server + HMR (loads a dev build)
npm run compile    # tsc --noEmit type check
npm run test:logic # pure-logic edge-case tests
npm run build      # production build into dist/chrome-mv3
npm run pack       # build + copy to the committed extension/ folder (regenerate before committing)
npm run zip        # package a distributable .zip
```

## Safety model (what "protected" means)
A message/sender is **protected** (never archived/trashed by a bulk action) if any of:
- it carries one of your finance/receipt/medical labels (resolved from your account),
- its sender domain is on the protected allowlist (`src/safety/protectedLists.ts`) — banks, brokerages, order confirmations, government, medical,
- its subject matches receipt/invoice/statement/tax/appointment keywords.

The action executor **re-checks** protection on the server-fetched metadata and drops protected ids — it does not trust the UI selection. Every reversible action is recorded so you can **Undo** it from the Activity log.

## Feedback

This is a feedback beta — bug reports and ideas are very welcome:

- **[Open an issue](https://github.com/zeyilin/gmail-cleaner/issues/new/choose)** → pick "Bug report" or "Feedback / idea".
- Especially useful: senders the classifier **mislabeled** (wrongly `protected`, or wrongly cleanable), and how the unsubscribe / bulk-cleanup flows felt.

## Fonts

Bundles [Fraunces](https://fonts.google.com/specimen/Fraunces), [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk), and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (all SIL OFL) as local `.woff2`, so nothing is fetched from a CDN at runtime. Regenerate with `node scripts/build-fonts.mjs`.

## License

MIT — see [LICENSE](LICENSE).

## Publishing later (delta)
Going public on the Chrome Web Store with `gmail.modify` (a *restricted* scope) requires Google **OAuth verification** + an **annual CASA security assessment**, a privacy policy, and store assets. Stay in *Testing* mode unless/until you publish. The auth layer (`src/auth/authAdapter.ts`) is abstracted so a cross-browser `launchWebAuthFlow` + PKCE flow can be dropped in for distribution.
