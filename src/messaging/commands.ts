import type { GroupSnapshot, ActionResult, UndoBatch } from '../types';

// ── Command contract between the dashboard/popup UI and the service worker ────
// The UI never calls Gmail directly; it sends one of these and awaits a typed reply.

export type Command =
  | { type: 'AUTH_STATUS' }
  | { type: 'SIGN_IN' }
  | { type: 'SIGN_OUT' }
  | { type: 'OPEN_DASHBOARD' }
  | { type: 'GET_SNAPSHOT'; force?: boolean; sampleSize?: number }
  | { type: 'COUNT_EXACT'; query: string }
  | { type: 'ARCHIVE_SENDER'; email: string; emails: string[]; alsoMarkRead?: boolean; allowProtected?: boolean }
  | { type: 'TRASH_SENDER'; email: string; emails: string[]; allowProtected?: boolean }
  | { type: 'LABEL_SENDER'; email: string; emails: string[]; labelName: string }
  | { type: 'UNSUBSCRIBE'; email: string; emails: string[] }
  | {
      type: 'COMBO_CLEANUP';
      email: string;
      emails: string[];
      doUnsub: boolean;
      doArchive: boolean;
      doFilter: boolean;
      alsoMarkRead?: boolean;
    }
  | { type: 'LIST_UNDO' }
  | { type: 'UNDO'; undoId: string };

export interface AuthStatus {
  signedIn: boolean;
  email?: string;
}

export interface UnsubscribeResult {
  method: string;
  ok: boolean;
  detail?: string;
}

export interface ComboResult {
  unsubscribe?: UnsubscribeResult;
  archive?: ActionResult;
  filter?: { ok: boolean; detail?: string };
  errors?: string[];
}

export interface CountResult {
  count: number;
  exact: boolean;
}

// Maps each command type to its response shape.
export interface CommandResponseMap {
  AUTH_STATUS: AuthStatus;
  SIGN_IN: AuthStatus;
  SIGN_OUT: { ok: true };
  OPEN_DASHBOARD: { ok: true };
  GET_SNAPSHOT: GroupSnapshot;
  COUNT_EXACT: CountResult;
  ARCHIVE_SENDER: ActionResult;
  TRASH_SENDER: ActionResult;
  LABEL_SENDER: ActionResult;
  UNSUBSCRIBE: UnsubscribeResult;
  COMBO_CLEANUP: ComboResult;
  LIST_UNDO: UndoBatch[];
  UNDO: { ok: boolean };
}

export type CommandType = Command['type'];

/** Error envelope returned by the worker when a handler throws. */
export interface ErrorEnvelope {
  __error: string;
}

/** Progress event broadcast from the worker to the UI during long operations. */
export interface ProgressEvent {
  __progress: true;
  phase: 'scan' | 'action';
  label: string;
  done: number;
  total: number;
}
