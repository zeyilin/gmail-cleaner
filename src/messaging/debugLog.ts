// In-memory activity log for the dashboard's Debug mode. Lives only in the UI
// context; it is ephemeral (cleared on reload) and never persisted or sent
// anywhere. Two producers feed it: client.ts (one entry per worker command) and
// the worker's emitLog() broadcasts (one entry per mutating Gmail API call).

export interface DebugEntry {
  id: number;
  ts: number;
  src: 'gmail' | 'command';
  label: string;
  detail?: string;
  status?: number;
  ok: boolean;
  ms: number;
}

const MAX = 300;
let buf: DebugEntry[] = [];
let seq = 0;
const subs = new Set<(b: DebugEntry[]) => void>();

export function pushLog(e: Omit<DebugEntry, 'id'>): void {
  buf = [{ ...e, id: ++seq }, ...buf].slice(0, MAX);
  for (const fn of subs) fn(buf);
}

export function subscribeLog(fn: (b: DebugEntry[]) => void): () => void {
  subs.add(fn);
  fn(buf);
  return () => {
    subs.delete(fn);
  };
}

export function clearLog(): void {
  buf = [];
  for (const fn of subs) fn(buf);
}
