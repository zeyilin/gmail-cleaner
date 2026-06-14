import type { GroupSnapshot } from '../types';

const KEY = 'snapshot';
const TTL = 30 * 60 * 1000;
// Bump when the snapshot shape changes so stale-schema caches auto-invalidate
// (otherwise an old cache without new fields can crash or show empty views).
const SCHEMA = 2;

export async function getCachedSnapshot(): Promise<GroupSnapshot | undefined> {
  const r = await chrome.storage.local.get(KEY);
  const s = r[KEY] as (GroupSnapshot & { schema?: number }) | undefined;
  if (s && s.schema === SCHEMA && Array.isArray(s.messages) && Date.now() - s.generatedAt < TTL) {
    return s;
  }
  return undefined;
}

export async function setCachedSnapshot(s: GroupSnapshot): Promise<void> {
  await chrome.storage.local.set({ [KEY]: { ...s, schema: SCHEMA } });
}

export async function clearCachedSnapshot(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
