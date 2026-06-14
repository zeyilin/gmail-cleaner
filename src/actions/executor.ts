import { listIds, getMetadataMany, batchModify, ensureLabel, listLabels } from '../gmail/gmailClient';
import { isProtectedMessage } from '../engine/classifier';
import { resolveProtectedLabelIds } from '../safety/protectedLabels';
import { getSettings } from '../store/settings';
import { addUndo, genId, getUndo, markUndone } from '../store/undoStore';
import { emitProgress } from '../messaging/progress';
import type { ActionResult } from '../types';

const PER_ROUND = 1000;
const MAX_ROUNDS = 60; // backstop: up to 60k messages from a single sender
const LABEL_WINDOW = 10000;
const SYSTEM_LABELS = new Set(['INBOX', 'UNREAD', 'TRASH', 'SPAM', 'STARRED', 'IMPORTANT']);

/** Lowercase, trim, drop blanks, de-dupe — never produce an empty/`*` sender clause. */
function cleanEmails(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

function fromQuery(emails: string[]): string {
  return `from:(${emails.join(' OR ')}) in:inbox`;
}

interface Resolved {
  allIds: string[];
  keepIds: string[];
  keepUnreadIds: string[];
  protectedIds: string[];
}

/**
 * Resolves a sender's inbox messages and splits protected vs. actionable.
 * Protection is re-checked here against freshly fetched metadata — the executor
 * never trusts a selection made in the UI.
 */
async function resolveSenderMessages(
  emails: string[],
  max: number,
  allowProtected = false,
): Promise<Resolved> {
  emitProgress({ phase: 'action', label: 'Finding messages…', done: 0, total: 0 });
  const ids = await listIds(fromQuery(emails), max);
  const metas = await getMetadataMany(ids.map((x) => x.id), (done, total) =>
    emitProgress({ phase: 'action', label: 'Reading messages', done, total }),
  );
  const ctx = {
    protectedLabelIds: await resolveProtectedLabelIds(),
    extraProtectedDomains: (await getSettings()).customProtectedDomains,
  };
  const allIds: string[] = [];
  const keepIds: string[] = [];
  const keepUnreadIds: string[] = [];
  const protectedIds: string[] = [];
  for (const m of metas) {
    allIds.push(m.id);
    // Protected mail is excluded unless the caller passed an explicit per-sender
    // override (allowProtected) — bulk actions never pass it.
    if (isProtectedMessage(m, ctx).protected && !allowProtected) {
      protectedIds.push(m.id);
    } else {
      keepIds.push(m.id);
      if (m.unread) keepUnreadIds.push(m.id);
    }
  }
  return { allIds, keepIds, keepUnreadIds, protectedIds };
}

/**
 * Archive/trash drain the sender's entire inbox backlog across rounds (each round
 * removes its matches from the inbox, so the next query returns the next batch).
 * Terminates when no actionable messages remain (only protected/failed ids left).
 */
async function drainInboxAction(
  emails: string[],
  email: string,
  op: 'archive' | 'trash',
  alsoMarkRead: boolean,
  allowProtected: boolean,
): Promise<ActionResult> {
  const clean = cleanEmails(emails);
  if (!clean.length) return { affected: 0, protectedExcluded: 0 };

  const actioned: string[] = [];
  const actionedUnread: string[] = [];
  const protectedSeen = new Set<string>();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const r = await resolveSenderMessages(clean, PER_ROUND, allowProtected);
    for (const id of r.protectedIds) protectedSeen.add(id);
    if (!r.keepIds.length) break;
    emitProgress({
      phase: 'action',
      label: op === 'trash' ? 'Moving to Trash…' : 'Archiving…',
      done: 0,
      total: 0,
    });
    if (op === 'trash') {
      await batchModify(r.keepIds, ['TRASH'], ['INBOX']);
    } else {
      await batchModify(r.keepIds, [], alsoMarkRead ? ['INBOX', 'UNREAD'] : ['INBOX']);
    }
    actioned.push(...r.keepIds);
    if (alsoMarkRead) actionedUnread.push(...r.keepUnreadIds);
  }

  if (!actioned.length) return { affected: 0, protectedExcluded: protectedSeen.size };

  const undoId = genId();
  await addUndo({
    id: undoId,
    ts: Date.now(),
    description: `${op === 'trash' ? 'Trashed' : 'Archived'} ${actioned.length} from ${email}`,
    op,
    messageIds: actioned,
    undoAddLabelIds: ['INBOX'],
    undoRemoveLabelIds: op === 'trash' ? ['TRASH'] : [],
    restoreUnreadIds: actionedUnread.length ? actionedUnread : undefined,
  });
  return { affected: actioned.length, protectedExcluded: protectedSeen.size, undoId };
}

export function archiveSender(
  emails: string[],
  email: string,
  alsoMarkRead = false,
  allowProtected = false,
): Promise<ActionResult> {
  return drainInboxAction(emails, email, 'archive', alsoMarkRead, allowProtected);
}

export function trashSender(
  emails: string[],
  email: string,
  allowProtected = false,
): Promise<ActionResult> {
  return drainInboxAction(emails, email, 'trash', false, allowProtected);
}

export async function labelSender(
  emails: string[],
  email: string,
  labelName: string,
): Promise<ActionResult> {
  const clean = cleanEmails(emails);
  if (!clean.length) return { affected: 0, protectedExcluded: 0 };
  // Labeling is non-destructive (mail stays in the inbox), so we can't drain —
  // fetch a large single window instead.
  const { allIds } = await resolveSenderMessages(clean, LABEL_WINDOW);
  if (!allIds.length) return { affected: 0, protectedExcluded: 0 };
  const labelId = await ensureLabel(labelName);
  emitProgress({ phase: 'action', label: 'Labeling…', done: 0, total: 0 });
  await batchModify(allIds, [labelId], []);
  const undoId = genId();
  await addUndo({
    id: undoId,
    ts: Date.now(),
    description: `Labeled ${allIds.length} from ${email} as "${labelName}"`,
    op: 'label',
    messageIds: allIds,
    undoAddLabelIds: [],
    undoRemoveLabelIds: [labelId],
  });
  return { affected: allIds.length, protectedExcluded: 0, undoId };
}

/** Archive or trash specific message ids (deliberate per-message action from the UI). */
export async function actMessages(
  ids: string[],
  op: 'archive' | 'trash',
  alsoMarkRead = false,
  label?: string,
): Promise<ActionResult> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return { affected: 0, protectedExcluded: 0 };
  if (op === 'trash') await batchModify(clean, ['TRASH'], ['INBOX']);
  else await batchModify(clean, [], alsoMarkRead ? ['INBOX', 'UNREAD'] : ['INBOX']);
  const undoId = genId();
  await addUndo({
    id: undoId,
    ts: Date.now(),
    description: label || `${op === 'trash' ? 'Trashed' : 'Archived'} ${clean.length} message(s)`,
    op,
    messageIds: clean,
    undoAddLabelIds: ['INBOX'],
    undoRemoveLabelIds: op === 'trash' ? ['TRASH'] : [],
  });
  return { affected: clean.length, protectedExcluded: 0, undoId };
}

export async function applyUndo(id: string): Promise<boolean> {
  const b = await getUndo(id);
  if (!b || b.undone) return false;

  let add = b.undoAddLabelIds;
  let remove = b.undoRemoveLabelIds;
  // A custom label referenced by the undo may have been deleted since the action;
  // filter those out so a missing label can't 400 the whole undo.
  const custom = [...add, ...remove].filter((l) => !SYSTEM_LABELS.has(l));
  if (custom.length) {
    const live = new Set((await listLabels()).map((l) => l.id));
    const ok = (l: string) => SYSTEM_LABELS.has(l) || live.has(l);
    add = add.filter(ok);
    remove = remove.filter(ok);
  }

  if (add.length || remove.length) await batchModify(b.messageIds, add, remove);
  // Restore UNREAD only on the messages that were unread before the action.
  if (b.restoreUnreadIds?.length) await batchModify(b.restoreUnreadIds, ['UNREAD'], []);
  await markUndone(id);
  return true;
}
