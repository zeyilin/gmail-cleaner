import { ensureToken, invalidateToken } from '../auth/authService';
import { parseFrom } from '../engine/headerParse';
import { mapPool } from './rateLimiter';
import { sleep, backoff } from './retry';
import type { MessageMeta } from '../types';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_ATTEMPTS = 4;

/** Authenticated Gmail REST request with 401 re-auth + 429/5xx backoff. */
async function api(path: string, init: RequestInit = {}): Promise<any> {
  let allowAuthRetry = true;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const token = await ensureToken(false);
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      });
    } catch (networkErr) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoff(attempt++));
        continue;
      }
      throw networkErr;
    }

    if (res.ok) {
      if (res.status === 204) return null;
      const body = await res.text();
      return body ? JSON.parse(body) : null;
    }
    if (res.status === 401 && allowAuthRetry) {
      allowAuthRetry = false;
      await invalidateToken(token);
      continue;
    }
    const bodyText = await res.text().catch(() => '');
    // Google sometimes signals throttling as 403 with a rate-limit reason.
    const is403Rate =
      res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/i.test(bodyText);
    if ((res.status === 429 || res.status >= 500 || is403Rate) && attempt < MAX_ATTEMPTS) {
      const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
      await sleep(Math.max(retryAfter, backoff(attempt++)));
      continue;
    }
    throw new Error(`Gmail API ${res.status} on ${path}: ${bodyText.slice(0, 300)}`);
  }
}

/** Parses a Retry-After header (delta-seconds or HTTP-date) to ms, capped at 60s. */
function parseRetryAfter(h: string | null): number {
  if (!h) return 0;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 60_000);
  const when = Date.parse(h);
  if (!Number.isNaN(when)) return Math.min(Math.max(0, when - Date.now()), 60_000);
  return 0;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<{ emailAddress: string }> {
  return api('/profile');
}

// ── Listing & counting ─────────────────────────────────────────────────────--

/**
 * Approximate count via resultSizeEstimate, which Gmail documents as an unreliable
 * estimate (worse for large result sets). `capped` is only a UI heuristic for the
 * "+" hint — use countExact() when accuracy matters.
 */
export async function estimateCount(query: string): Promise<{ count: number; capped: boolean }> {
  const params = new URLSearchParams({ q: query, maxResults: '1' });
  const res = await api(`/messages?${params.toString()}`);
  const count: number = res?.resultSizeEstimate ?? 0;
  return { count, capped: count >= 200 };
}

/** Exact count by paginating ids only (cheap — no message bodies). `capped` if it hit hardMax. */
export async function countExact(
  query: string,
  hardMax = 100000,
): Promise<{ count: number; capped: boolean }> {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: '500' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await api(`/messages?${params.toString()}`);
    total += res?.messages?.length || 0;
    pageToken = res?.nextPageToken;
    if (total >= hardMax) return { count: total, capped: true };
  } while (pageToken);
  return { count: total, capped: false };
}

/** Returns message ids matching a query, up to `max`. */
export async function listIds(
  query: string,
  max = 2000,
): Promise<{ id: string; threadId: string }[]> {
  const out: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  do {
    const pageSize = Math.min(500, Math.max(1, max - out.length));
    const params = new URLSearchParams({ q: query, maxResults: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await api(`/messages?${params.toString()}`);
    for (const m of res?.messages || []) out.push({ id: m.id, threadId: m.threadId });
    pageToken = res?.nextPageToken;
    if (out.length >= max) break;
  } while (pageToken);
  return out.slice(0, max);
}

// ── Metadata ──────────────────────────────────────────────────────────────---

const META_HEADERS = ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'];

function toMeta(m: any): MessageMeta {
  const headers: any[] = m.payload?.headers || [];
  const h = (name: string): string | undefined =>
    headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value;
  const labelIds: string[] = m.labelIds || [];
  const dateMs = m.internalDate ? Number(m.internalDate) : Date.parse(h('Date') || '') || 0;
  return {
    id: m.id,
    threadId: m.threadId,
    from: parseFrom(h('From') || ''),
    subject: h('Subject') || '(no subject)',
    date: dateMs,
    labelIds,
    unread: labelIds.includes('UNREAD'),
    listUnsubscribe: h('List-Unsubscribe'),
    listUnsubscribePost: h('List-Unsubscribe-Post'),
  };
}

export async function getMetadata(id: string): Promise<MessageMeta> {
  const params = new URLSearchParams({ format: 'metadata' });
  for (const header of META_HEADERS) params.append('metadataHeaders', header);
  const m = await api(`/messages/${id}?${params.toString()}`);
  return toMeta(m);
}

/**
 * Fetches metadata for many ids using a concurrency pool. Individual failures
 * (e.g. a message deleted mid-scan) are dropped rather than failing the batch.
 * NOTE: a future optimization is true multipart/mixed batch requests.
 */
export async function getMetadataMany(
  ids: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<MessageMeta[]> {
  const res = await mapPool(
    ids,
    12,
    async (id) => {
      try {
        return await getMetadata(id);
      } catch {
        return null;
      }
    },
    onProgress,
  );
  return res.filter((x): x is MessageMeta => x !== null);
}

// ── Mutations (all reversible) ─────────────────────────────────────────────---

const CHUNK = 1000;

export async function batchModify(
  ids: string[],
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    await api('/messages/batchModify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: chunk, addLabelIds, removeLabelIds }),
    });
  }
}

// ── Labels ────────────────────────────────────────────────────────────────---

export async function listLabels(): Promise<{ id: string; name: string }[]> {
  const res = await api('/labels');
  return (res?.labels || []).map((l: any) => ({ id: l.id, name: l.name }));
}

export async function createLabel(name: string): Promise<{ id: string; name: string }> {
  const res = await api('/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });
  return { id: res.id, name: res.name };
}

export async function ensureLabel(name: string): Promise<string> {
  const labels = await listLabels();
  const found = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  return (await createLabel(name)).id;
}

// ── Filters (needs gmail.settings.basic) ───────────────────────────────────---

export async function createSkipInboxFilter(fromEmail: string): Promise<void> {
  await api('/settings/filters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      criteria: { from: fromEmail },
      action: { removeLabelIds: ['INBOX'] },
    }),
  });
}
