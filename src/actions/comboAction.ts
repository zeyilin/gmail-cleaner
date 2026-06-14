import { unsubscribeSender } from './unsubscribe';
import { archiveSender } from './executor';
import { createSkipInboxFilter } from '../gmail/gmailClient';
import { domainOf, matchesDomain } from '../engine/classifier';
import { PROTECTED_DOMAINS } from '../safety/protectedLists';
import { getSettings } from '../store/settings';
import type { ComboResult } from '../messaging/commands';

function isProtectedDomain(dom: string, custom: string[]): boolean {
  if (!dom) return false;
  if (/(?:^|\.)gov(?:\.[a-z]{2})?$/.test(dom) || dom.endsWith('.mil')) return true;
  return matchesDomain(dom, PROTECTED_DOMAINS) || matchesDomain(dom, custom);
}

/** "Unsubscribe + clean up <sender>" — each step is independent and failure-isolated. */
export async function comboCleanup(opts: {
  email: string;
  emails: string[];
  doUnsub: boolean;
  doArchive: boolean;
  doFilter: boolean;
  alsoMarkRead?: boolean;
}): Promise<ComboResult> {
  const out: ComboResult = {};
  const errors: string[] = [];

  if (opts.doUnsub) {
    try {
      out.unsubscribe = await unsubscribeSender(opts.emails);
    } catch (e: any) {
      errors.push(`Unsubscribe failed: ${String(e?.message ?? e)}`);
    }
  }

  if (opts.doArchive) {
    try {
      out.archive = await archiveSender(opts.emails, opts.email, opts.alsoMarkRead);
    } catch (e: any) {
      errors.push(`Archive failed: ${String(e?.message ?? e)}`);
    }
  }

  if (opts.doFilter) {
    try {
      const custom = (await getSettings()).customProtectedDomains;
      const clean = [...new Set(opts.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
      // A skip-inbox filter is sender-wide and permanent; it cannot honor per-message
      // receipt/financial protection, so never create one for a protected sender.
      const safe = clean.filter((e) => !isProtectedDomain(domainOf(e), custom));
      const skipped = clean.length - safe.length;
      for (const e of safe) await createSkipInboxFilter(e);
      out.filter = skipped
        ? {
            ok: safe.length > 0,
            detail: `${skipped} protected sender(s) skipped — sender-wide filters can't honor per-message protection`,
          }
        : { ok: true };
    } catch (e: any) {
      out.filter = { ok: false, detail: String(e?.message ?? e) };
    }
  }

  if (errors.length) out.errors = errors;
  return out;
}
