import type { Address, UnsubMethod } from '../types';

/** Parses a From header into { name, email }. */
export function parseFrom(raw: string): Address {
  // Tolerate trailing content after the address, e.g. 'Foo <a@b.com> (via Service)'.
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) {
    const email = m[2].trim().toLowerCase();
    return { name: m[1].trim() || email, email };
  }
  const email = raw.trim().toLowerCase();
  return { name: email, email };
}

export interface UnsubTargets {
  https?: string;
  mailto?: string;
}

/** Extracts the https and mailto targets from a List-Unsubscribe header value. */
export function parseListUnsubscribe(raw?: string): UnsubTargets {
  const out: UnsubTargets = {};
  if (!raw) return out;
  const tokens = raw.match(/<([^>]+)>/g) || [];
  for (const token of tokens) {
    const url = token.slice(1, -1).trim();
    if (/^https?:\/\//i.test(url) && !out.https) out.https = url;
    else if (/^mailto:/i.test(url) && !out.mailto) out.mailto = url;
  }
  return out;
}

/** Decides the best available unsubscribe method per RFC 8058 + fallbacks. */
export function resolveUnsubMethod(
  listUnsub?: string,
  listUnsubPost?: string,
): { method: UnsubMethod; target?: string } {
  const t = parseListUnsubscribe(listUnsub);
  const oneClick = !!listUnsubPost && /one-?click/i.test(listUnsubPost) && !!t.https;
  if (oneClick) return { method: 'one-click', target: t.https };
  if (t.https) return { method: 'https', target: t.https };
  if (t.mailto) return { method: 'mailto', target: t.mailto };
  if (listUnsub) return { method: 'manual' };
  return { method: 'none' };
}
