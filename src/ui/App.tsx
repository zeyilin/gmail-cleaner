import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { send } from '../messaging/client';
import type { AuthStatus, ProgressEvent } from '../messaging/commands';
import type { SenderGroup, UndoBatch } from '../types';
import { saveSettings, getSettings, DEFAULT_SETTINGS, type Settings } from '../store/settings';
import { useGroups } from './hooks/useGroups';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';
import { ProgressBar } from './components/ProgressBar';
import { ConfirmDialog, type ConfirmConfig } from './components/ConfirmDialog';
import { Icon } from './components/icons';
import { Overview } from './pages/Overview';
import { SendersPage, type SenderFilter } from './pages/SendersPage';
import { UnsubscribePage } from './pages/UnsubscribePage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { MessagesPage } from './pages/MessagesPage';
import { TriagePage } from './pages/TriagePage';
import { Snackbar, type SnackbarData } from './components/Snackbar';
import type { View, BulkKind, SenderApi, TriageKind } from './uiTypes';

const TITLES: Record<View, { eyebrow: string; title: string }> = {
  overview: { eyebrow: 'Inbox health', title: 'Overview' },
  triage: { eyebrow: 'Inbox zero', title: 'Triage' },
  senders: { eyebrow: 'Manage', title: 'Senders' },
  messages: { eyebrow: 'Browse', title: 'Messages' },
  unsubscribe: { eyebrow: 'Stop the noise', title: 'Unsubscribe' },
  activity: { eyebrow: 'History', title: 'Activity & undo' },
  settings: { eyebrow: 'Preferences', title: 'Settings' },
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function BulkOverlay({
  label,
  progress,
  onCancel,
}: {
  label: string;
  progress: ProgressEvent | null;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Bulk action in progress">
      <div className="modal">
        <h3>Working through your selection…</h3>
        <div className="body mono" style={{ marginBottom: 12 }} aria-live="polite">
          {label}
        </div>
        <ProgressBar
          label={progress?.phase === 'action' && progress.label ? progress.label : 'Processing'}
          done={progress?.phase === 'action' ? progress.done : 0}
          total={progress?.phase === 'action' ? progress.total : 0}
        />
        <div className="actions">
          <button onClick={onCancel}>Stop</button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const { snapshot, loading, error, reload, clear } = useGroups();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [view, setView] = useState<View>('overview');
  const [sendersFilter, setSendersFilter] = useState<SenderFilter>('all');
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [undo, setUndo] = useState<UndoBatch[]>([]);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [oneClickEnabled, setOneClickEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [bulk, setBulk] = useState<{ label: string } | null>(null);
  const [pendingUnsub, setPendingUnsub] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<SnackbarData | null>(null);
  const bulkAbort = useRef(false);

  useEffect(() => {
    send({ type: 'AUTH_STATUS' }).then(setAuth).catch(() => setAuth({ signedIn: false }));
    chrome.permissions.contains({ origins: ['https://*/*'] }).then(setOneClickEnabled).catch(() => {});
    getSettings().then((s) => {
      setSettings(s);
      setMode(s.advancedMode ? 'advanced' : 'simple');
    });
  }, []);

  useEffect(() => {
    if (auth?.signedIn) void reload(false);
  }, [auth?.signedIn, reload]);

  useEffect(() => {
    const listener = (msg: any) => {
      if (msg && msg.__progress) setProgress(msg as ProgressEvent);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
  useEffect(() => {
    if (!loading) setProgress((p) => (p?.phase === 'scan' ? null : p));
  }, [loading]);

  const refreshUndo = useCallback(() => {
    send({ type: 'LIST_UNDO' }).then(setUndo).catch(() => {});
  }, []);
  const closeSnackbar = useCallback(() => setSnackbar(null), []);
  useEffect(() => {
    if (auth?.signedIn) refreshUndo();
  }, [auth?.signedIn, refreshUndo]);

  const afterAction = (msg: string, undoId?: string) => {
    setProgress(null);
    setStatus('');
    setSnackbar({ message: msg, onUndo: undoId ? () => doUndo(undoId) : undefined });
    refreshUndo();
    void reload(true);
  };

  // ── Auth ────────────────────────────────────────────
  const signIn = async () => {
    setConnecting(true);
    setStatus('');
    try {
      setAuth(await send({ type: 'SIGN_IN' }));
    } catch (e: any) {
      setStatus(e.message);
    }
    setConnecting(false);
  };
  const signOut = async () => {
    try {
      await send({ type: 'SIGN_OUT' });
    } catch (e: any) {
      setStatus(e.message);
    }
    setAuth({ signedIn: false });
    setView('overview');
    clear();
    setUndo([]);
    setStatus('');
    setProgress(null);
  };

  const enableOneClick = async () => {
    try {
      const granted = await chrome.permissions.request({ origins: ['https://*/*'] });
      setOneClickEnabled(granted);
      setStatus(granted ? 'One-click unsubscribe enabled for all senders.' : 'Permission declined.');
    } catch (e: any) {
      setStatus(e.message);
    }
  };
  const disableOneClick = async () => {
    try {
      await chrome.permissions.remove({ origins: ['https://*/*'] });
      setOneClickEnabled(false);
      setStatus('Broad one-click permission removed (per-sender prompts will be used).');
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  const exactCount = async (query: string, label: string) => {
    setStatus(`Counting ${label}…`);
    try {
      const r = await send({ type: 'COUNT_EXACT', query });
      setStatus(`${label}: ${r.exact ? 'exactly' : 'at least'} ${r.count}.`);
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  const onSaveSettings = useCallback(
    async (patch: Partial<Settings>, rescan?: boolean) => {
      const next = await saveSettings(patch);
      setSettings(next);
      if (patch.advancedMode !== undefined) setMode(patch.advancedMode ? 'advanced' : 'simple');
      if (rescan) void reload(true);
    },
    [reload],
  );

  // ── Per-sender actions ──────────────────────────────
  const archive = (g: SenderGroup) =>
    setConfirm({
      title: `Archive mail from ${g.displayName}?`,
      body: (
        <>
          Removes this sender's mail from your inbox (kept in All Mail). Receipts, financial and
          medical mail are automatically excluded. Reversible via Undo.
        </>
      ),
      confirmLabel: 'Archive',
      options: [{ key: 'markRead', label: 'Also mark as read', default: settings.markReadOnArchive }],
      onConfirm: async (sel) => {
        const r = await send({ type: 'ARCHIVE_SENDER', email: g.key, emails: g.emails, alsoMarkRead: !!sel.markRead });
        setConfirm(null);
        afterAction(`Archived ${r.affected} from ${g.displayName}${r.protectedExcluded ? ` — ${r.protectedExcluded} protected excluded.` : '.'}`, r.undoId);
      },
    });

  const trash = (g: SenderGroup) =>
    setConfirm({
      title: `Move ${g.displayName} to Trash?`,
      danger: true,
      body: (
        <>
          Moves this sender's mail to Trash (recoverable 30 days; never permanently deleted).
          Receipts, financial and medical mail are excluded. Reversible via Undo.
        </>
      ),
      confirmLabel: 'Move to Trash',
      onConfirm: async () => {
        const r = await send({ type: 'TRASH_SENDER', email: g.key, emails: g.emails });
        setConfirm(null);
        afterAction(`Trashed ${r.affected} from ${g.displayName}${r.protectedExcluded ? ` — ${r.protectedExcluded} protected excluded.` : '.'}`, r.undoId);
      },
    });

  const combo = (g: SenderGroup) =>
    setConfirm({
      title: `Unsubscribe + clean up ${g.displayName}`,
      body: (
        <>
          Choose what to do. Protected mail is always excluded from archiving, and a skip-inbox
          filter is never created for a protected sender.
        </>
      ),
      confirmLabel: 'Run',
      options: [
        { key: 'doUnsub', label: `Unsubscribe (${g.unsubMethod})`, default: true },
        { key: 'doArchive', label: 'Archive existing inbox backlog', default: true },
        { key: 'doFilter', label: 'Auto-skip inbox for future mail (Gmail filter)', default: false },
        { key: 'markRead', label: 'Mark archived as read', default: settings.markReadOnArchive },
      ],
      onConfirm: async (sel) => {
        const r = await send({
          type: 'COMBO_CLEANUP',
          email: g.key,
          emails: g.emails,
          doUnsub: !!sel.doUnsub,
          doArchive: !!sel.doArchive,
          doFilter: !!sel.doFilter,
          alsoMarkRead: !!sel.markRead,
        });
        setConfirm(null);
        const parts: string[] = [];
        if (r.unsubscribe) parts.push(`unsubscribe ${r.unsubscribe.ok ? 'ok' : 'manual'} (${r.unsubscribe.method})`);
        if (r.archive) parts.push(`archived ${r.archive.affected}${r.archive.protectedExcluded ? `, ${r.archive.protectedExcluded} protected kept` : ''}`);
        if (r.filter) parts.push(`filter ${r.filter.ok ? 'created' : 'skipped'}`);
        if (r.errors?.length) parts.push(...r.errors);
        afterAction(`${g.displayName} — ${parts.join('; ') || 'nothing selected'}.`, r.archive?.undoId);
      },
    });

  const unsub = async (g: SenderGroup) => {
    if (pendingUnsub.has(g.key)) return;
    setPendingUnsub((s) => new Set(s).add(g.key));
    try {
      // Request only this sender's unsubscribe origin (narrow, within the click gesture).
      if (g.unsubMethod === 'one-click' && g.unsubTarget) {
        try {
          const origin = new URL(g.unsubTarget).origin + '/*';
          await chrome.permissions.request({ origins: [origin] });
        } catch {
          /* declined → worker falls back to opening the page in a tab */
        }
      }
      setStatus(`Unsubscribing from ${g.displayName}…`);
      const r = await send({ type: 'UNSUBSCRIBE', email: g.key, emails: g.emails });
      setStatus(`${g.displayName}: ${r.detail ?? r.method}`);
    } catch (e: any) {
      setStatus(`Unsubscribe failed: ${e.message}`);
    } finally {
      setPendingUnsub((s) => {
        const n = new Set(s);
        n.delete(g.key);
        return n;
      });
    }
  };

  // Deliberate per-sender override to act on a PROTECTED sender (with friction).
  const override = (g: SenderGroup) =>
    setConfirm({
      title: `Override protection for ${g.displayName}?`,
      danger: true,
      body: (
        <>
          This sender is <b>protected</b> ({g.reasons.join(', ') || 'protected'}). Proceeding can
          archive or trash receipts, financial, or medical mail from it. It's reversible via Undo —
          but only do this if you're sure. Bulk actions never touch protected senders.
        </>
      ),
      confirmLabel: 'Override & act',
      options: [
        { key: 'doTrash', label: 'Move to Trash (otherwise Archive)', default: false },
        { key: 'markRead', label: 'Also mark as read', default: settings.markReadOnArchive },
      ],
      onConfirm: async (sel) => {
        setConfirm(null);
        if (sel.doTrash) {
          const r = await send({ type: 'TRASH_SENDER', email: g.key, emails: g.emails, allowProtected: true });
          afterAction(`Override — trashed ${r.affected} from ${g.displayName}.`, r.undoId);
        } else {
          const r = await send({ type: 'ARCHIVE_SENDER', email: g.key, emails: g.emails, alsoMarkRead: !!sel.markRead, allowProtected: true });
          afterAction(`Override — archived ${r.affected} from ${g.displayName}.`, r.undoId);
        }
      },
    });

  const doUndo = async (id: string) => {
    try {
      const r = await send({ type: 'UNDO', undoId: id });
      if (r.ok) afterAction('Action undone.');
      else setStatus('Could not undo (already undone?).');
    } catch (e: any) {
      setStatus(`Undo failed: ${e.message}`);
    }
  };

  // ── Triage (one-sender-at-a-time) ───────────────────
  // Does NOT rescan after each card — the TriagePage advances its own queue.
  const triageAct = async (g: SenderGroup, kind: TriageKind, order?: 'unsubFirst' | 'cleanFirst') => {
    try {
      if (kind === 'keep') {
        await onSaveSettings({ keepList: [...settings.keepList, g.key] });
        setSnackbar({
          message: `Kept ${g.displayName}`,
          onUndo: () => void onSaveSettings({ keepList: settings.keepList.filter((k) => k !== g.key) }),
        });
        refreshUndo();
        return;
      }
      const ord = order ?? (settings.actionOrder === 'ask' ? 'unsubFirst' : settings.actionOrder);
      let undoId: string | undefined;
      let msg: string;
      if (kind === 'unsub') {
        const r = await send({ type: 'UNSUBSCRIBE', email: g.key, emails: g.emails });
        msg = `${g.displayName}: ${r.detail ?? r.method}`;
      } else if (kind === 'archive') {
        const r = await send({ type: 'ARCHIVE_SENDER', email: g.key, emails: g.emails, alsoMarkRead: settings.markReadOnArchive });
        undoId = r.undoId;
        msg = `Archived ${r.affected} from ${g.displayName}`;
      } else if (kind === 'trash') {
        const r = await send({ type: 'TRASH_SENDER', email: g.key, emails: g.emails });
        undoId = r.undoId;
        msg = `Trashed ${r.affected} from ${g.displayName}`;
      } else {
        const op = kind === 'unsubTrash' ? 'trash' : 'archive';
        const r = await send({ type: 'COMBO_CLEANUP', email: g.key, emails: g.emails, doUnsub: true, doArchive: true, doFilter: false, alsoMarkRead: settings.markReadOnArchive, op, order: ord });
        undoId = r.archive?.undoId;
        const bits: string[] = [];
        if (r.unsubscribe) bits.push(`unsub ${r.unsubscribe.ok ? 'ok' : 'manual'}`);
        if (r.archive) bits.push(`${op === 'trash' ? 'trashed' : 'archived'} ${r.archive.affected}`);
        msg = `${g.displayName}: ${bits.join(' · ') || 'done'}`;
      }
      setSnackbar({ message: msg, onUndo: undoId ? () => doUndo(undoId!) : undefined });
      refreshUndo();
    } catch (e: any) {
      setStatus(`Action failed: ${e.message}`);
      throw e;
    }
  };

  // ── Advanced bulk runner ────────────────────────────
  const runBulk = (groups: SenderGroup[], kind: BulkKind) => {
    if (!groups.length) return;
    const verb = kind === 'unsub' ? 'Unsubscribe from' : kind === 'archive' ? 'Archive' : 'Move to Trash';
    const emails = groups.reduce((a, g) => a + g.count, 0);
    setConfirm({
      title: `${verb} ${groups.length} sender${groups.length > 1 ? 's' : ''}?`,
      danger: kind === 'trash',
      body: (
        <>
          {kind === 'unsub'
            ? 'Sends an opt-out for each (where supported; opens a tab otherwise). '
            : `Affects ~${emails} messages across these senders. `}
          Receipts, financial and medical mail are always excluded.
          {kind === 'unsub' ? ' Unsubscribing can’t be undone.' : ' Reversible via Undo.'}
        </>
      ),
      confirmLabel: kind === 'unsub' ? 'Unsubscribe' : kind === 'trash' ? 'Move to Trash' : 'Archive',
      onConfirm: async () => {
        setConfirm(null);
        bulkAbort.current = false;
        setBulk({ label: 'Starting…' });
        let affected = 0;
        let excluded = 0;
        let failed = 0;
        let done = 0;
        for (let i = 0; i < groups.length; i++) {
          if (bulkAbort.current) break;
          const g = groups[i];
          setBulk({ label: `(${i + 1}/${groups.length}) ${g.displayName}` });
          try {
            if (kind === 'unsub') {
              await withTimeout(send({ type: 'UNSUBSCRIBE', email: g.key, emails: g.emails }), 60_000);
            } else if (kind === 'archive') {
              const r = await withTimeout(send({ type: 'ARCHIVE_SENDER', email: g.key, emails: g.emails, alsoMarkRead: settings.markReadOnArchive }), 120_000);
              affected += r.affected;
              excluded += r.protectedExcluded;
            } else {
              const r = await withTimeout(send({ type: 'TRASH_SENDER', email: g.key, emails: g.emails }), 120_000);
              affected += r.affected;
              excluded += r.protectedExcluded;
            }
            done++;
          } catch {
            failed++;
          }
        }
        const aborted = bulkAbort.current;
        setBulk(null);
        afterAction(
          `Bulk ${kind}: ${done}/${groups.length} senders` +
            (kind !== 'unsub' ? `, ${affected} emails` : '') +
            (excluded ? `, ${excluded} protected kept` : '') +
            (failed ? `, ${failed} failed` : '') +
            (aborted ? ' (stopped)' : '') +
            '.',
        );
      },
    });
  };

  const api: SenderApi = { archive, trash, combo, unsub, override };

  // ── Render ──────────────────────────────────────────
  if (!auth) {
    return (
      <div className="onboard">
        <div className="onboard-card">
          <div className="mark">
            Gmail&nbsp;<em>Cleaner</em>
          </div>
          <p className="lede" style={{ marginTop: 16 }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!auth.signedIn) {
    return <Onboarding onConnect={signIn} connecting={connecting} error={status || undefined} />;
  }

  const unsubCount = snapshot
    ? snapshot.senders.filter((g) => g.hasListUnsubscribe && g.tag !== 'protected').length
    : undefined;
  const triageCount = snapshot
    ? snapshot.senders.filter((g) => g.tag === 'marketing' || g.tag === 'unknown').length
    : undefined;
  const noScan = !snapshot && !loading;
  const t = TITLES[view];

  const needsSnapshot = (node: ReactNode) =>
    snapshot ? (
      node
    ) : noScan ? (
      <div className="empty">
        <div className="big">No scan yet</div>
        Click <b>Rescan</b> to read your inbox.
      </div>
    ) : (
      <div className="muted">Scanning…</div>
    );

  return (
    <div className="shell">
      <Sidebar
        view={view}
        setView={setView}
        mode={mode}
        setMode={setMode}
        email={auth.email}
        counts={{ triage: triageCount, senders: snapshot?.senders.length, messages: snapshot?.messages.length, unsubscribe: unsubCount, activity: undo.length || undefined }}
        onSignOut={signOut}
      />

      <main className="main">
        <div className="main-inner">
          <div className="topbar">
            <div className="titles">
              <div className="eyebrow">{t.eyebrow}</div>
              <h1 className="page">{t.title}</h1>
            </div>
            <div className="actions">
              <button onClick={() => reload(true)} disabled={loading}>
                <Icon name="refresh" size={15} /> {loading ? 'Scanning…' : 'Rescan'}
              </button>
            </div>
          </div>

          <div
            className={`status${error ? ' error' : ''}`}
            role={error ? 'alert' : 'status'}
            aria-live={error ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            {error ?? status}
          </div>

          {loading && (
            <div className="scan-progress">
              <ProgressBar
                label={progress?.phase === 'scan' && progress.label ? progress.label : 'Scanning your inbox'}
                done={progress?.phase === 'scan' ? progress.done : 0}
                total={progress?.phase === 'scan' ? progress.total : 0}
              />
            </div>
          )}

          <div className="view" key={view}>
            {view === 'overview' &&
              needsSnapshot(
                snapshot && (
                  <Overview
                    snapshot={snapshot}
                    onExactCount={exactCount}
                    onReview={() => {
                      setSendersFilter('marketing');
                      setView('senders');
                    }}
                  />
                ),
              )}

            {view === 'triage' &&
              needsSnapshot(
                snapshot && (
                  <TriagePage
                    senders={snapshot.senders}
                    actionOrder={settings.actionOrder}
                    onAct={triageAct}
                    onRescan={() => reload(true)}
                    snapshotKey={snapshot.generatedAt}
                  />
                ),
              )}

            {view === 'senders' &&
              needsSnapshot(
                snapshot && (
                  <SendersPage
                    senders={snapshot.senders}
                    mode={mode}
                    api={api}
                    runBulk={runBulk}
                    filter={sendersFilter}
                    setFilter={setSendersFilter}
                    snapshotKey={snapshot.generatedAt}
                    pendingUnsub={pendingUnsub}
                  />
                ),
              )}

            {view === 'messages' &&
              needsSnapshot(snapshot && <MessagesPage snapshot={snapshot} mode={mode} />)}

            {view === 'unsubscribe' &&
              needsSnapshot(
                snapshot && (
                  <UnsubscribePage senders={snapshot.senders} onUnsub={unsub} pendingUnsub={pendingUnsub} />
                ),
              )}

            {view === 'activity' && <ActivityPage batches={undo} onUndo={doUndo} onRefresh={refreshUndo} />}

            {view === 'settings' && (
              <SettingsPage
                settings={settings}
                onSave={onSaveSettings}
                onRescan={() => reload(true)}
                email={auth.email}
                onSignOut={signOut}
                oneClickEnabled={oneClickEnabled}
                onEnableOneClick={enableOneClick}
                onDisableOneClick={disableOneClick}
              />
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog config={confirm} onCancel={() => setConfirm(null)} progress={progress} />
      {bulk && (
        <BulkOverlay
          label={bulk.label}
          progress={progress}
          onCancel={() => {
            bulkAbort.current = true;
            setBulk({ label: 'Stopping…' });
          }}
        />
      )}
      <Snackbar data={snackbar} onClose={closeSnackbar} />
    </div>
  );
}
