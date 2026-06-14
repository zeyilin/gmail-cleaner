import { useEffect, useMemo, useState } from 'react';
import type { SenderGroup } from '../../types';
import type { TriageKind } from '../uiTypes';
import { TagBadge } from '../components/Badge';

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return '';
  }
}

export function TriagePage({
  senders,
  actionOrder,
  onAct,
  onRescan,
  snapshotKey,
}: {
  senders: SenderGroup[];
  actionOrder: 'unsubFirst' | 'cleanFirst' | 'ask';
  onAct: (g: SenderGroup, kind: TriageKind, order?: 'unsubFirst' | 'cleanFirst') => Promise<void>;
  onRescan: () => void;
  snapshotKey: number;
}) {
  // Noise first: marketing + unknown, highest-volume first. Protected & kept are
  // excluded by tag.
  const queue = useMemo(
    () =>
      senders
        .filter((g) => g.tag === 'marketing' || g.tag === 'unknown')
        .sort((a, b) => b.count - a.count),
    [senders],
  );

  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<'unsubFirst' | 'cleanFirst'>('unsubFirst');

  useEffect(() => setPos(0), [snapshotKey]);

  const current = queue[pos];

  const run = async (kind: TriageKind, ord?: 'unsubFirst' | 'cleanFirst') => {
    if (busy || !current) return;
    setBusy(true);
    try {
      await onAct(current, kind, actionOrder === 'ask' ? (ord ?? order) : undefined);
      setPos((p) => p + 1);
    } catch {
      /* leave the user on the card so they can retry */
    } finally {
      setBusy(false);
    }
  };
  const skip = () => setPos((p) => p + 1);
  const back = () => setPos((p) => Math.max(0, p - 1));

  // Keyboard shortcuts (re-subscribed each render to keep closures fresh).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || !current) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        void run('keep');
      } else if (k === 'a') {
        e.preventDefault();
        void run(current.hasListUnsubscribe ? 'unsubArchive' : 'archive');
      } else if (k === 't') {
        e.preventDefault();
        void run(current.hasListUnsubscribe ? 'unsubTrash' : 'trash');
      } else if (k === 'u' && current.hasListUnsubscribe) {
        e.preventDefault();
        void run('unsub');
      } else if (k === 's' || k === 'j' || e.key === 'ArrowRight') {
        e.preventDefault();
        skip();
      } else if (k === 'p' || e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!queue.length) {
    return (
      <div className="empty">
        <div className="big">Nothing to triage</div>
        No marketing or unknown senders in this scan — your inbox noise is handled.
        <div style={{ marginTop: 14 }}>
          <button className="primary" onClick={onRescan}>
            Rescan inbox
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="empty">
        <div className="big">All caught up ✦</div>
        You went through all {queue.length} noisy senders. Rescan to pull in anything new.
        <div style={{ marginTop: 14 }}>
          <button className="primary" onClick={onRescan}>
            Rescan inbox
          </button>
        </div>
      </div>
    );
  }

  const hasUnsub = current.hasListUnsubscribe;

  return (
    <div className="triage-wrap">
      <div className="triage-progress mono">
        {pos + 1} of {queue.length}
      </div>

      <div className="card triage-card">
        <div className="triage-head">
          <div style={{ minWidth: 0 }}>
            <div className="triage-name">{current.displayName}</div>
            <div className="mono triage-mail trunc">{current.key}</div>
          </div>
          <TagBadge tag={current.tag} />
        </div>

        <div className="triage-meta mono">
          {current.count} in sample · {current.unreadCount} unread · last {fmtDate(current.lastDate)} ·{' '}
          {hasUnsub ? `unsub: ${current.unsubMethod}` : 'no unsubscribe'}
        </div>

        {current.recentSubjects.length > 0 && (
          <ul className="triage-subjects">
            {current.recentSubjects.map((s, i) => (
              <li key={i} className="trunc">
                {s}
              </li>
            ))}
          </ul>
        )}

        {actionOrder === 'ask' && (
          <div className="triage-order">
            <span className="muted">Order:</span>
            <button className={order === 'unsubFirst' ? 'on' : ''} onClick={() => setOrder('unsubFirst')}>
              Unsub first
            </button>
            <button className={order === 'cleanFirst' ? 'on' : ''} onClick={() => setOrder('cleanFirst')}>
              Clean first
            </button>
          </div>
        )}

        <div className="triage-actions">
          <button disabled={busy} onClick={() => run('keep')}>
            Keep <kbd>K</kbd>
          </button>
          {hasUnsub ? (
            <>
              <button className="primary" disabled={busy} onClick={() => run('unsubArchive')}>
                Unsub &amp; Archive <kbd>A</kbd>
              </button>
              <button className="danger" disabled={busy} onClick={() => run('unsubTrash')}>
                Unsub &amp; Trash <kbd>T</kbd>
              </button>
            </>
          ) : (
            <>
              <button className="primary" disabled={busy} onClick={() => run('archive')}>
                Archive <kbd>A</kbd>
              </button>
              <button className="danger" disabled={busy} onClick={() => run('trash')}>
                Trash <kbd>T</kbd>
              </button>
            </>
          )}
          <button className="ghost" disabled={busy} onClick={skip}>
            Skip <kbd>S</kbd>
          </button>
        </div>

        <div className="triage-secondary">
          {hasUnsub && (
            <>
              <button className="link-btn" disabled={busy} onClick={() => run('unsub')}>
                Unsubscribe only
              </button>
              <button className="link-btn" disabled={busy} onClick={() => run('archive')}>
                Archive only
              </button>
              <button className="link-btn" disabled={busy} onClick={() => run('trash')}>
                Trash only
              </button>
            </>
          )}
          <button className="link-btn" disabled={busy || pos === 0} onClick={back}>
            ← Back
          </button>
        </div>
      </div>

      <div className="triage-hint muted">
        <kbd>K</kbd> keep · <kbd>A</kbd> unsub+archive · <kbd>T</kbd> unsub+trash ·{' '}
        {hasUnsub && (
          <>
            <kbd>U</kbd> unsub ·{' '}
          </>
        )}
        <kbd>S</kbd>/<kbd>→</kbd> skip · <kbd>←</kbd> back
      </div>
    </div>
  );
}
