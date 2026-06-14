import { listLabels } from '../gmail/gmailClient';
import { PROTECTED_LABEL_NAMES } from './protectedLists';

let cache: { ids: Set<string>; ts: number } | undefined;
const TTL = 10 * 60 * 1000;

/** Resolves the user's finance/receipt/medical label names to Gmail label ids. */
export async function resolveProtectedLabelIds(force = false): Promise<Set<string>> {
  if (!force && cache && Date.now() - cache.ts < TTL) return cache.ids;
  const labels = await listLabels();
  const wanted = new Set(PROTECTED_LABEL_NAMES.map((n) => n.toLowerCase()));
  const ids = new Set<string>();
  for (const l of labels) if (wanted.has(l.name.toLowerCase())) ids.add(l.id);
  cache = { ids, ts: Date.now() };
  return ids;
}
