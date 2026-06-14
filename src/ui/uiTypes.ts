import type { SenderGroup } from '../types';

export type View = 'overview' | 'senders' | 'unsubscribe' | 'activity' | 'settings';
export type BulkKind = 'unsub' | 'archive' | 'trash';

export interface SenderApi {
  archive: (g: SenderGroup) => void;
  trash: (g: SenderGroup) => void;
  combo: (g: SenderGroup) => void;
  unsub: (g: SenderGroup) => void;
  /** Deliberate per-sender override to act on a PROTECTED sender. */
  override: (g: SenderGroup) => void;
}
