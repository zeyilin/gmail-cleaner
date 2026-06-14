import type {
  MessageMeta,
  SenderGroup,
  GroupSnapshot,
  FacetCount,
  AgeBuckets,
} from '../types';
import { classifySender, isProtectedMessage, type ClassifyContext } from './classifier';
import { suggestAction } from './suggestions';
import { resolveUnsubMethod } from './headerParse';
import { detectPhishing } from '../safety/phishing';

const DAY = 86_400_000;

/** Normalizes a sender address: lowercase + strip "+tag" so variants merge. */
export function normalizeSenderKey(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return email.toLowerCase();
  const local = email.slice(0, at).split('+')[0].toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  return `${local}@${domain}`;
}

function mostCommonName(messages: MessageMeta[]): string {
  const counts = new Map<string, number>();
  for (const m of messages) {
    const n = m.from.name && m.from.name !== m.from.email ? m.from.name : '';
    if (n) counts.set(n, (counts.get(n) || 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [n, c] of counts) {
    if (c > bestCount) {
      best = n;
      bestCount = c;
    }
  }
  return best || messages[0]?.from.email || '(unknown)';
}

export interface BuildOptions {
  sampleSize: number;
  protectedLabelIds: Set<string>;
  extraProtectedDomains?: string[];
  /** Headline facet counts gathered cheaply via estimateCount (categories, read/unread). */
  categoryFacets: FacetCount[];
  readUnreadFacets: FacetCount[];
}

export function buildSnapshot(messages: MessageMeta[], opts: BuildOptions): GroupSnapshot {
  const ctx: ClassifyContext = {
    protectedLabelIds: opts.protectedLabelIds,
    extraProtectedDomains: opts.extraProtectedDomains,
  };
  const now = Date.now();

  // Group by normalized sender.
  const byKey = new Map<string, MessageMeta[]>();
  for (const m of messages) {
    if (!m.from.email) continue; // header-less mail can never be a sender action target
    const key = normalizeSenderKey(m.from.email);
    let arr = byKey.get(key);
    if (!arr) {
      arr = [];
      byKey.set(key, arr);
    }
    arr.push(m);
  }

  const age: AgeBuckets = { lt1m: 0, m1to6: 0, m6to12: 0, gt1y: 0 };
  for (const m of messages) {
    if (!m.date) continue; // unknown date — don't force recent mail into ">1 year"
    const d = now - m.date;
    if (d < 30 * DAY) age.lt1m++;
    else if (d < 182 * DAY) age.m1to6++;
    else if (d < 365 * DAY) age.m6to12++;
    else age.gt1y++;
  }

  const senders: SenderGroup[] = [];
  let protectedCount = 0;

  for (const [key, msgs] of byKey) {
    msgs.sort((a, b) => b.date - a.date);
    const { tag, reasons } = classifySender(msgs, ctx);
    const rep = msgs.find((m) => m.listUnsubscribe) ?? msgs[0];
    const { method, target } = resolveUnsubMethod(rep.listUnsubscribe, rep.listUnsubscribePost);
    const hasUnsub = !!rep.listUnsubscribe;

    // Count protected MESSAGES, not whole groups (a group is tagged protected if
    // any single message is — but only the actual protected messages are excluded).
    protectedCount += msgs.filter((m) => isProtectedMessage(m, ctx).protected).length;

    senders.push({
      key,
      displayName: mostCommonName(msgs),
      emails: [...new Set(msgs.map((m) => m.from.email))],
      count: msgs.length,
      unreadCount: msgs.filter((m) => m.unread).length,
      lastDate: msgs[0].date,
      tag,
      suggested: suggestAction(tag, msgs.length, hasUnsub),
      unsubMethod: method,
      unsubTarget: target,
      hasListUnsubscribe: hasUnsub,
      sampleMessageId: rep.id,
      reasons,
    });
  }

  senders.sort((a, b) => b.count - a.count);

  const withUnsub = messages.filter((m) => m.listUnsubscribe).length;
  const hasUnsubFacets: FacetCount[] = [
    { key: 'yes', label: 'Has unsubscribe header', count: withUnsub, capped: false },
    { key: 'no', label: 'No unsubscribe header', count: messages.length - withUnsub, capped: false },
  ];

  return {
    generatedAt: now,
    sampleSize: opts.sampleSize,
    totalSampled: messages.length,
    facets: {
      categories: opts.categoryFacets,
      readUnread: opts.readUnreadFacets,
      hasUnsub: hasUnsubFacets,
      age,
      protectedCount,
    },
    senders,
    phishing: detectPhishing(messages),
  };
}
