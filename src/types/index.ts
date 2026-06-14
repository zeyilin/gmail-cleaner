// ── Shared domain types (single source of truth across worker + UI) ──────────

/** A parsed email address. */
export interface Address {
  name: string;
  email: string; // lowercased
}

/** Lightweight message metadata fetched via messages.get?format=metadata. */
export interface MessageMeta {
  id: string;
  threadId: string;
  from: Address;
  subject: string;
  date: number; // epoch ms
  labelIds: string[];
  unread: boolean;
  /** Raw List-Unsubscribe header value, if present. */
  listUnsubscribe?: string;
  /** Raw List-Unsubscribe-Post header value, if present (RFC 8058). */
  listUnsubscribePost?: string;
}

export type SenderTag = 'protected' | 'keep' | 'marketing' | 'unknown';
/** Content-type classification (independent of the action-oriented tag). */
export type Category =
  | 'marketing'
  | 'newsletter'
  | 'social'
  | 'updates'
  | 'forums'
  | 'personal'
  | 'other';
export type UnsubMethod = 'one-click' | 'https' | 'mailto' | 'manual' | 'none';
export type SuggestedAction = 'keep' | 'review' | 'unsubscribe' | 'protected';

/** A group of messages from one logical sender (variants merged). */
export interface SenderGroup {
  /** Normalized key (primary email, lowercased, +tag stripped). */
  key: string;
  displayName: string;
  /** All distinct from-addresses merged into this group. */
  emails: string[];
  /** Messages from this sender within the sampled set. */
  count: number;
  unreadCount: number;
  lastDate: number;
  tag: SenderTag;
  /** Richer content category derived from Gmail's CATEGORY_* labels + heuristics. */
  category: Category;
  suggested: SuggestedAction;
  unsubMethod: UnsubMethod;
  /** Resolved unsubscribe target (https url or mailto), if any. */
  unsubTarget?: string;
  hasListUnsubscribe: boolean;
  /** Representative message id (the one carrying unsubscribe headers, if any). */
  sampleMessageId: string;
  /** Up to 3 most-recent subject lines, for the triage card preview. */
  recentSubjects: string[];
  /** Why this group was tagged the way it was (for transparency in the UI). */
  reasons: string[];
}

export interface FacetCount {
  key: string;
  label: string;
  count: number;
  /** True when the underlying API count is capped/approximate (show "N+"). */
  capped: boolean;
}

export interface AgeBuckets {
  lt1m: number;
  m1to6: number;
  m6to12: number;
  gt1y: number;
}

export interface PhishingFlag {
  messageId: string;
  from: string;
  subject: string;
  reasons: string[];
}

/** A single sampled message, for the scrollable Messages list. */
export interface MessageLite {
  id: string;
  threadId: string;
  name: string;
  email: string;
  subject: string;
  date: number;
  unread: boolean;
}

export interface GroupSnapshot {
  generatedAt: number;
  sampleSize: number;
  totalSampled: number;
  facets: {
    categories: FacetCount[];
    readUnread: FacetCount[];
    hasUnsub: FacetCount[];
    age: AgeBuckets;
    protectedCount: number;
  };
  senders: SenderGroup[];
  /** Every sampled message (newest first) for the browsable Messages list. */
  messages: MessageLite[];
  phishing: PhishingFlag[];
}

export type ActionOp = 'archive' | 'trash' | 'markRead' | 'label';

/** A reversible action recorded so it can be undone. */
export interface UndoBatch {
  id: string;
  ts: number;
  description: string;
  op: ActionOp;
  messageIds: string[];
  /** To undo: add these label ids back. */
  undoAddLabelIds: string[];
  /** To undo: remove these label ids. */
  undoRemoveLabelIds: string[];
  /** Subset of messageIds that were UNREAD before the action; UNREAD is re-added to only these on undo. */
  restoreUnreadIds?: string[];
  undone?: boolean;
}

export interface ActionResult {
  affected: number;
  protectedExcluded: number;
  undoId?: string;
}
