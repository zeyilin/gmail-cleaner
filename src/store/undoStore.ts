import type { UndoBatch } from '../types';

const KEY = 'undo_batches';
const MAX = 50;

// Serialize read-modify-write so two concurrent actions (e.g. a bulk run) can't
// clobber each other's undo records. All callers run in the single service worker.
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}

export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listUndo(): Promise<UndoBatch[]> {
  const r = await chrome.storage.local.get(KEY);
  return (r[KEY] as UndoBatch[]) || [];
}

export function addUndo(b: UndoBatch): Promise<void> {
  return withLock(async () => {
    const all = await listUndo();
    all.unshift(b);
    await chrome.storage.local.set({ [KEY]: all.slice(0, MAX) });
  });
}

export async function getUndo(id: string): Promise<UndoBatch | undefined> {
  return (await listUndo()).find((b) => b.id === id);
}

export function markUndone(id: string): Promise<void> {
  return withLock(async () => {
    const all = await listUndo();
    const idx = all.findIndex((b) => b.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], undone: true };
      await chrome.storage.local.set({ [KEY]: all });
    }
  });
}
