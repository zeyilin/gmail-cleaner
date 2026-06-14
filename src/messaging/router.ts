import type { Command, CommandType, CommandResponseMap } from './commands';
import type { FacetCount, GroupSnapshot } from '../types';
import { emitProgress } from './progress';
import { signIn, signOut, getStatus, setAccountEmail } from '../auth/authService';
import { estimateCount, countExact, listIds, getMetadataMany, getProfile } from '../gmail/gmailClient';
import { buildSnapshot } from '../engine/aggregator';
import { resolveProtectedLabelIds } from '../safety/protectedLabels';
import { getCachedSnapshot, setCachedSnapshot, clearCachedSnapshot } from '../store/cache';
import { getSettings } from '../store/settings';
import { listUndo } from '../store/undoStore';
import { archiveSender, trashSender, labelSender, applyUndo, actMessages } from '../actions/executor';
import { unsubscribeSender } from '../actions/unsubscribe';
import { comboCleanup } from '../actions/comboAction';

const CATEGORY_LABELS: Record<string, string> = {
  promotions: 'Promotions',
  updates: 'Updates',
  social: 'Social',
  forums: 'Forums',
};

export async function openDashboard(): Promise<void> {
  const url = chrome.runtime.getURL('/dashboard.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length && tabs[0].id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

async function buildFreshSnapshot(
  force: boolean,
  sampleSize: number,
  extraProtectedDomains: string[],
  keepKeys: Set<string>,
): Promise<GroupSnapshot> {
  emitProgress({ phase: 'scan', label: 'Counting categories…', done: 0, total: 0 });
  const categoryFacets: FacetCount[] = [];
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    const { count, capped } = await estimateCount(`in:inbox category:${cat}`);
    categoryFacets.push({ key: cat, label: CATEGORY_LABELS[cat], count, capped });
  }
  const unread = await estimateCount('in:inbox is:unread');
  const read = await estimateCount('in:inbox is:read');
  const readUnreadFacets: FacetCount[] = [
    { key: 'unread', label: 'Unread', count: unread.count, capped: unread.capped },
    { key: 'read', label: 'Read', count: read.count, capped: read.capped },
  ];

  emitProgress({ phase: 'scan', label: 'Listing your inbox…', done: 0, total: 0 });
  const ids = await listIds('in:inbox', sampleSize);
  const metas = await getMetadataMany(ids.map((x) => x.id), (done, total) =>
    emitProgress({ phase: 'scan', label: 'Reading messages', done, total }),
  );
  const protectedLabelIds = await resolveProtectedLabelIds(force);

  const snapshot = buildSnapshot(metas, {
    sampleSize,
    protectedLabelIds,
    extraProtectedDomains,
    keepKeys,
    categoryFacets,
    readUnreadFacets,
  });
  await setCachedSnapshot(snapshot);
  return snapshot;
}

async function getSnapshot(force?: boolean, sampleSize?: number): Promise<GroupSnapshot> {
  if (!force) {
    const cached = await getCachedSnapshot();
    if (cached) return cached;
  }
  const settings = await getSettings();
  return buildFreshSnapshot(
    !!force,
    sampleSize ?? settings.sampleSize,
    settings.customProtectedDomains,
    new Set(settings.keepList),
  );
}

// Typed dispatch table — each handler's return type is checked against
// CommandResponseMap[K], so any drift between worker and UI is a compile error.
const handlers: {
  [K in CommandType]: (cmd: Extract<Command, { type: K }>) => Promise<CommandResponseMap[K]>;
} = {
  AUTH_STATUS: () => getStatus(),
  SIGN_IN: async () => {
    await signIn();
    const profile = await getProfile();
    await setAccountEmail(profile.emailAddress);
    return { signedIn: true, email: profile.emailAddress };
  },
  SIGN_OUT: async () => {
    await signOut();
    await clearCachedSnapshot();
    return { ok: true };
  },
  OPEN_DASHBOARD: async () => {
    await openDashboard();
    return { ok: true };
  },
  GET_SNAPSHOT: (cmd) => getSnapshot(cmd.force, cmd.sampleSize),
  COUNT_EXACT: async (cmd) => {
    const { count, capped } = await countExact(cmd.query);
    return { count, exact: !capped };
  },
  ARCHIVE_SENDER: (cmd) => archiveSender(cmd.emails, cmd.email, cmd.alsoMarkRead, cmd.allowProtected),
  TRASH_SENDER: (cmd) => trashSender(cmd.emails, cmd.email, cmd.allowProtected),
  LABEL_SENDER: (cmd) => labelSender(cmd.emails, cmd.email, cmd.labelName),
  UNSUBSCRIBE: (cmd) => unsubscribeSender(cmd.emails),
  COMBO_CLEANUP: (cmd) => comboCleanup(cmd),
  MESSAGE_ACTION: (cmd) => actMessages(cmd.ids, cmd.op, cmd.alsoMarkRead, cmd.label),
  LIST_UNDO: () => listUndo(),
  UNDO: async (cmd) => ({ ok: await applyUndo(cmd.undoId) }),
};

async function handle(cmd: Command): Promise<unknown> {
  const fn = handlers[cmd.type] as ((c: Command) => Promise<unknown>) | undefined;
  if (!fn) throw new Error(`Unknown command: ${(cmd as { type: string }).type}`);
  return fn(cmd);
}

export function registerRouter(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Ignore our own progress broadcasts (other contexts handle those).
    if (msg && (msg as { __progress?: unknown }).__progress) return false;
    handle(msg as Command)
      .then(sendResponse)
      .catch((err) => sendResponse({ __error: String(err?.message ?? err) }));
    return true; // keep the message channel open for the async response
  });
}
