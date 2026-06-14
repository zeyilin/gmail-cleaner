import type { MessageMeta, SenderTag, Category } from '../types';
import {
  PROTECTED_DOMAINS,
  PROTECTED_SUBJECT_STRONG_RE,
  PROTECTED_SUBJECT_WEAK_RE,
  MARKETING_HINT_RE,
  KEEP_NEWSLETTER_DOMAINS,
} from '../safety/protectedLists';

export interface ClassifyContext {
  /** Resolved Gmail label ids that mean "protected" (finance/medical/etc.). */
  protectedLabelIds: Set<string>;
  /** User-added protected sender domains (from Settings). */
  extraProtectedDomains?: string[];
}

export function domainOf(email: string): string {
  const i = email.indexOf('@');
  return i >= 0 ? email.slice(i + 1).toLowerCase() : '';
}

export function matchesDomain(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith('.' + d));
}

/** Per-message protection check. This is the function the action executor re-runs server-side. */
export function isProtectedMessage(
  m: MessageMeta,
  ctx: ClassifyContext,
): { protected: boolean; reason?: string } {
  if (m.labelIds.some((id) => ctx.protectedLabelIds.has(id))) {
    return { protected: true, reason: 'on a finance/receipt/medical label' };
  }
  const dom = domainOf(m.from.email);
  // US (.gov/.mil) and common foreign government TLDs (gov.uk, gov.au, …).
  if (/(?:^|\.)gov(?:\.[a-z]{2})?$/.test(dom) || dom.endsWith('.mil')) {
    return { protected: true, reason: 'government sender' };
  }
  if (matchesDomain(dom, PROTECTED_DOMAINS)) {
    return { protected: true, reason: 'financial/receipt/medical sender' };
  }
  if (ctx.extraProtectedDomains?.length && matchesDomain(dom, ctx.extraProtectedDomains)) {
    return { protected: true, reason: 'on your custom protected list' };
  }
  // Strong receipt/financial/medical signals always protect.
  if (PROTECTED_SUBJECT_STRONG_RE.test(m.subject)) {
    return { protected: true, reason: 'receipt/financial subject line' };
  }
  // Ambiguous tokens (payment, order, premium…) protect only on non-bulk mail —
  // newsletters/marketing carry List-Unsubscribe, so a finance-y word in their
  // subject (e.g. a TLDR story about a "payment") won't falsely protect them.
  if (!m.listUnsubscribe && PROTECTED_SUBJECT_WEAK_RE.test(m.subject)) {
    return { protected: true, reason: 'transactional subject line' };
  }
  return { protected: false };
}

/** Aggregate a sender's messages into a tag + human-readable reasons. */
export function classifySender(
  messages: MessageMeta[],
  ctx: ClassifyContext,
): { tag: SenderTag; reasons: string[] } {
  const reasons = new Set<string>();
  let anyProtected = false;
  let anyKeep = false;
  let anyMarketing = false;
  let anyUnsub = false;

  for (const m of messages) {
    const p = isProtectedMessage(m, ctx);
    if (p.protected) {
      anyProtected = true;
      if (p.reason) reasons.add(p.reason);
    }
    if (m.listUnsubscribe) anyUnsub = true;
    const dom = domainOf(m.from.email);
    if (matchesDomain(dom, KEEP_NEWSLETTER_DOMAINS)) anyKeep = true;
    if (m.labelIds.includes('CATEGORY_PROMOTIONS') || MARKETING_HINT_RE.test(m.subject)) {
      anyMarketing = true;
    }
  }

  // Protected always wins (defense in depth).
  if (anyProtected) return { tag: 'protected', reasons: [...reasons] };
  if (anyKeep) {
    reasons.add('a newsletter you read');
    return { tag: 'keep', reasons: [...reasons] };
  }
  if (anyMarketing || anyUnsub) {
    reasons.add(anyUnsub ? 'bulk marketing with an unsubscribe link' : 'promotional content');
    return { tag: 'marketing', reasons: [...reasons] };
  }
  return { tag: 'unknown', reasons: [...reasons] };
}

const NEWSLETTER_HOST_RE = /(substack\.com|ghost\.io|beehiiv\.com|buttondown|convertkit|mailchimp)/;

/** Content-type category from Gmail's own CATEGORY_* labels + newsletter heuristics. */
export function categorizeSender(messages: MessageMeta[]): Category {
  const dom = domainOf(messages[0]?.from.email ?? '');
  if (matchesDomain(dom, KEEP_NEWSLETTER_DOMAINS) || NEWSLETTER_HOST_RE.test(dom)) {
    return 'newsletter';
  }
  const tally = { promotions: 0, social: 0, updates: 0, forums: 0, personal: 0 };
  for (const m of messages) {
    if (m.labelIds.includes('CATEGORY_PROMOTIONS')) tally.promotions++;
    else if (m.labelIds.includes('CATEGORY_SOCIAL')) tally.social++;
    else if (m.labelIds.includes('CATEGORY_UPDATES')) tally.updates++;
    else if (m.labelIds.includes('CATEGORY_FORUMS')) tally.forums++;
    else if (m.labelIds.includes('CATEGORY_PERSONAL')) tally.personal++;
  }
  const top = (Object.entries(tally) as [keyof typeof tally, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (top && top[1] > 0) {
    if (top[0] === 'promotions') return 'marketing';
    if (top[0] === 'social') return 'social';
    if (top[0] === 'updates') return 'updates';
    if (top[0] === 'forums') return 'forums';
    if (top[0] === 'personal') return 'personal';
  }
  return messages.some((m) => m.listUnsubscribe) ? 'marketing' : 'other';
}
