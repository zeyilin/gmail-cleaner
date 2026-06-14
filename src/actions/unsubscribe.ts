import { getMetadata, listIds } from '../gmail/gmailClient';
import { resolveUnsubMethod } from '../engine/headerParse';
import type { MessageMeta } from '../types';
import type { UnsubscribeResult } from '../messaging/commands';

/** Finds a recent message (anywhere) from the sender that carries unsubscribe headers. */
async function findUnsubMessage(emails: string[]): Promise<MessageMeta | undefined> {
  const list = emails.length ? emails.join(' OR ') : '';
  if (!list) return undefined;
  // Search all mail (incl. Trash/Archive) so unsubscribe still works after a
  // "clean first, then unsubscribe" triage decision.
  const ids = await listIds(`from:(${list}) in:anywhere`, 25);
  for (const { id } of ids) {
    const m = await getMetadata(id);
    if (m.listUnsubscribe) return m;
  }
  return undefined;
}

async function hasHostPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin + '/*';
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

async function openTab(url: string): Promise<void> {
  await chrome.tabs.create({ url });
}

/**
 * Unsubscribe fallback chain:
 *   1. RFC 8058 one-click POST (silent) — only if the user has granted host access.
 *   2. Open the https unsubscribe page in a tab.
 *   3. mailto — reported as needing the optional gmail.send scope.
 *   4. manual.
 */
export async function unsubscribeSender(emails: string[]): Promise<UnsubscribeResult> {
  const m = await findUnsubMessage(emails);
  if (!m) return { method: 'none', ok: false, detail: 'No unsubscribe header found for this sender.' };

  const { method, target } = resolveUnsubMethod(m.listUnsubscribe, m.listUnsubscribePost);

  if (method === 'one-click' && target) {
    if (await hasHostPermission(target)) {
      try {
        const res = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
          credentials: 'omit',
        });
        if (res.ok) return { method: 'one-click', ok: true, detail: `Unsubscribed (HTTP ${res.status}).` };
        await openTab(target);
        return { method: 'https', ok: true, detail: `One-click returned ${res.status}; opened the page instead.` };
      } catch {
        await openTab(target);
        return { method: 'https', ok: true, detail: 'One-click request failed; opened the unsubscribe page.' };
      }
    }
    // No host permission granted → open the page so the user can confirm.
    await openTab(target);
    return {
      method: 'https',
      ok: true,
      detail: 'Opened the unsubscribe page. Enable "one-click unsubscribe" in settings to do this silently.',
    };
  }

  if (method === 'https' && target) {
    await openTab(target);
    return { method: 'https', ok: true, detail: 'Opened the unsubscribe page in a new tab.' };
  }

  if (method === 'mailto') {
    return {
      method: 'mailto',
      ok: false,
      detail: 'This sender only supports email-based unsubscribe (needs the optional gmail.send scope).',
    };
  }

  return { method: 'manual', ok: false, detail: 'No automatic unsubscribe available — open the email to opt out.' };
}
