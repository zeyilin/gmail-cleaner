import { useEffect, useMemo, useState } from 'react';
import type { SenderGroup } from '../../types';
import type { TriageKind } from '../uiTypes';

type Scope = 'noise' | 'all' | 'marketing' | 'newsletter' | 'social' | 'updates';
const SCOPES: { k: Scope; label: string }[] = [
  { k: 'noise', label: 'Noise' },
  { k: 'all', label: 'All' },
  { k: 'marketing', label: 'Marketing' },
  { k: 'newsletter', label: 'Newsletters' },
  { k: 'social', label: 'Social' },
  { k: 'updates', label: 'Updates' },
];

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return '';
  }
}

function inScope(g: SenderGroup, scope: Scope): boolean {
  if (g.tag === 'protected' || g.tag === 'keep') return false;
  if (scope === 'noise') return g.tag === 'marketing' || g.tag === 'unknown';
  if (scope === 'all') return true;
  if (scope === 'updates') return g.category === 'updates' || g.category === 'forums';
  return g.category === scope;
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
  const [scope, setScope] = useState<Scope>('noise');
  const [pos, setPos] = useState(0);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<'unsubFirst' | 'cleanFirst'>('unsubFirst');

  const queue = useMemo(
    () => senders.filter((g) => inScope(g, scope)).sort((a, b) => b.count - a.count),
    [senders, scope],
  );

  useEffect(() => setPos(0), [snapshotKey, scope]);

  const current = queue[pos];
  const hasUnsub = !!current?.hasListUnsubscribe;

  const run = async (kind: TriageKind, ord?: 'unsubFirst' | 'cleanFirst') => {
    if (busy || !current) return;
    setBusy(true);
    try {
      await onAct(current, kind, actionOrder === 'ask' ? (ord ?? order) : undefined);
      setPos((p) => p + 1);
    } catch {
      /* leave the user on the card to retry */
    } finally {
      setBusy(false);
    }
  };
  const skip = () => setPos((p) => p + 1);
  const back = () => setPos((p) => Math.max(0, p - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || !current) return;
      const k = e.key.toLowerCase();
      if (k === 'k') (e.preventDefault(), void run('keep'));
      else if (k === 'a' && hasUnsub) (e.preventDefault(), void run('unsubArchive'));
      else if (k === 't' && hasUnsub) (e.preventDefault(), void run('unsubTrash'));
      else if (k === 'u' && hasUnsub) (e.preventDefault(), void run('unsub'));
      else if (k === 'e') (e.preventDefault(), void run('archive'));
      else if (k === 'x') (e.preventDefault(), void run('trash'));
      else if (k === 's' || k === 'j' || e.key === 'ArrowRight') (e.preventDefault(), skip());
      else if (k === 'p' || e.key === 'ArrowLeft') (e.preventDefault(), back());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scopeBar = (
    <div className="controls" style={{ justifyContent: 'center' }}>
      <div className="segmented" role="group" aria-label="Triage scope">
        {SCOPES.map((s) => (
          <button key={s.k} className={scope === s.k ? 'on' : ''} aria-pressed={scope === s.k} onClick={() => setScope(s.k)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (!queue.length) {
    return (
      <>
        {scopeBar}
        <div className="empty">
          <div className="big">Nothing here</div>
          No senders in “{SCOPES.find((s) => s.k === scope)?.label}”. Try another scope or rescan.
          <div style={{ marginTop: 14 }}>
            <button className="primary" onClick={onRescan}>
              Rescan inbox
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!current) {
    return (
      <>
        {scopeBar}
        <div className="empty">
          <div className="big">All caught up ✦</div>
          You went through all {queue.length} senders in this scope.
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setPos(0)}>Review again</button>{' '}
            <button className="primary" onClick={onRescan}>
              Rescan inbox
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="triage-wrap">
      {scopeBar}
      <div className="triage-progress mono">
        {pos + 1} of {queue.length}
      </div>

      <div className="card triage-card">
        <div className="triage-head">
          <div style={{ minWidth: 0 }}>
            <div className="triage-name">{current.displayName}</div>
            <div className="mono triage-mail trunc">{current.key}</div>
          </div>
          <span className="tag">
            <span className={`dot ${current.category}`} />
            {current.category}
          </span>
        </div>

        <div className="triage-meta mono">
          {current.count} in sample · {current.unreadCount} unread · last {fmtDate(current.lastDate)} ·{' '}
          {hasUnsub ? `unsub: ${current.unsubMethod}` : 'no unsubscribe'}
        </div>

        {current.recentSubjects.length > 0 && (
          <ul className="triage-subjects">
            {current.recentSubjects.map((s, i) => (
              <li key={i} className="trunc">
                {s || '(no subject)'}
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
          <button
            className="primary"
            disabled={busy || !hasUnsub}
            title={hasUnsub ? '' : 'No unsubscribe link for this sender'}
            onClick={() => run('unsubArchive')}
          >
            Unsub &amp; Archive <kbd>A</kbd>
          </button>
          <button
            className="danger"
            disabled={busy || !hasUnsub}
            title={hasUnsub ? '' : 'No unsubscribe link for this sender'}
            onClick={() => run('unsubTrash')}
          >
            Unsub &amp; Trash <kbd>T</kbd>
          </button>
          <button
            disabled={busy || !hasUnsub}
            title={hasUnsub ? '' : 'No unsubscribe link for this sender'}
            onClick={() => run('unsub')}
          >
            Unsubscribe only <kbd>U</kbd>
          </button>
          <button className={hasUnsub ? '' : 'primary'} disabled={busy} onClick={() => run('archive')}>
            Archive{hasUnsub ? ' only' : ''} <kbd>E</kbd>
          </button>
          <button className="danger" disabled={busy} onClick={() => run('trash')}>
            Trash{hasUnsub ? ' only' : ''} <kbd>X</kbd>
          </button>
          <button className="ghost" disabled={busy} onClick={skip}>
            Skip <kbd>S</kbd>
          </button>
        </div>

        <div className="triage-secondary">
          <button className="link-btn" disabled={busy || pos === 0} onClick={back}>
            ← Back
          </button>
        </div>
      </div>

      <div className="triage-hint muted">
        <kbd>K</kbd> keep · <kbd>A</kbd> unsub+archive · <kbd>T</kbd> unsub+trash · <kbd>U</kbd> unsub ·{' '}
        <kbd>E</kbd> archive · <kbd>X</kbd> trash · <kbd>S</kbd>/<kbd>→</kbd> skip · <kbd>←</kbd> back
      </div>
    </div>
  );
}
