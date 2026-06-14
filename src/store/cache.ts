import type { GroupSnapshot } from '../types';

const KEY = 'snapshot';
const TTL = 30 * 60 * 1000;

export async function getCachedSnapshot(): Promise<GroupSnapshot | undefined> {
  const r = await chrome.storage.local.get(KEY);
  const s = r[KEY] as GroupSnapshot | undefined;
  if (s && Date.now() - s.generatedAt < TTL) return s;
  return undefined;
}

export async function setCachedSnapshot(s: GroupSnapshot): Promise<void> {
  await chrome.storage.local.set({ [KEY]: s });
}

export async function clearCachedSnapshot(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
