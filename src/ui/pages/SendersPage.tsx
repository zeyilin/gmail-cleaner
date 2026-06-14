import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SenderGroup } from '../../types';
import type { BulkKind, SenderApi } from '../uiTypes';
import { TagBadge, MethodPill } from '../components/Badge';
import { Icon } from '../components/icons';

export type SenderFilter = 'all' | 'marketing' | 'keep' | 'unknown' | 'protected';
const FILTERS: { k: SenderFilter; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'marketing', label: 'Marketing' },
  { k: 'keep', label: 'Newsletters' },
  { k: 'unknown', label: 'Unknown' },
  { k: 'protected', label: 'Protected' },
];
type Sort = 'volume' | 'unread' | 'recent';

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return '';
  }
}

const Shield = ({ reasons, onOverride }: { reasons: string[]; onOverride?: () => void }) =>
  onOverride ? (
    <button
      className="shield shield-btn"
      title={`Protected (${reasons.join('; ')}) — click to override`}
      aria-label="Protected — click to override protection"
      onClick={onOverride}
    >
      🛡
    </button>
  ) : (
    <span role="img" aria-label="Protected — excluded from bulk actions" title={reasons.join('; ')} className="shield">
      🛡
    </span>
  );

function simpleActions(g: SenderGroup, api: SenderApi, unsubPending: boolean): ReactNode {
  if (g.tag === 'protected') {
    return (
      <>
        <span className="shield">🛡 protected</span>
        <button className="sm ghost" onClick={() => api.override(g)}>
          Override
        </button>
      </>
    );
  }
  if (g.suggested === 'unsubscribe') {
    return (
      <>
        <button className="primary sm" onClick={() => api.combo(g)}>
          Unsub + clean
        </button>
        <button className="sm ghost" onClick={() => api.archive(g)}>
          Archive
        </button>
      </>
    );
  }
  if (g.suggested === 'keep') {
    return (
      <>
        <button className="sm ghost" disabled={unsubPending} onClick={() => api.unsub(g)}>
          {unsubPending ? 'Unsubscribing…' : 'Unsubscribe'}
        </button>
        <button className="sm ghost" onClick={() => api.archive(g)}>
          Archive
        </button>
      </>
    );
  }
  return (
    <>
      <button className="primary sm" onClick={() => api.archive(g)}>
        Archive
      </button>
      <button className="sm danger" onClick={() => api.trash(g)}>
        Trash
      </button>
    </>
  );
}

export function SendersPage({
  senders,
  mode,
  api,
  runBulk,
  filter,
  setFilter,
  snapshotKey,
  pendingUnsub,
}: {
  senders: SenderGroup[];
  mode: 'simple' | 'advanced';
  api: SenderApi;
  runBulk: (groups: SenderGroup[], kind: BulkKind) => void;
  filter: SenderFilter;
  setFilter: (f: SenderFilter) => void;
  snapshotKey: number;
  pendingUnsub: Set<string>;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('volume');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [snapshotKey, filter, mode]);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let r = senders.filter((g) => (filter === 'all' ? true : g.tag === filter));
    if (ql) {
      r = r.filter(
        (g) => g.displayName.toLowerCase().includes(ql) || g.emails.join(' ').toLowerCase().includes(ql),
      );
    }
    return [...r].sort((a, b) =>
      sort === 'unread'
        ? b.unreadCount - a.unreadCount
        : sort === 'recent'
          ? b.lastDate - a.lastDate
          : b.count - a.count,
    );
  }, [senders, filter, q, sort]);

  const selectable = rows.filter((g) => g.tag !== 'protected');
  const allSelected = selectable.length > 0 && selectable.every((g) => selected.has(g.key));
  const someSelected = selectable.some((g) => selected.has(g.key));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((g) => g.key)));
  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const selectedGroups = rows.filter((g) => selected.has(g.key));
  const selectedEmails = selectedGroups.reduce((a, g) => a + g.count, 0);

  return (
    <>
      <div className="controls">
        <div className="segmented" role="group" aria-label="Filter senders">
          {FILTERS.map((f) => (
            <button
              key={f.k}
              className={filter === f.k ? 'on' : ''}
              aria-pressed={filter === f.k}
              onClick={() => setFilter(f.k)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="search">
          <Icon name="search" size={15} />
          <input
            aria-label="Search senders"
            placeholder="Search senders…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="sort" aria-label="Sort senders" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="volume">Most mail</option>
          <option value="unread">Most unread</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="big">No senders match</div>
          Try a different filter or search.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {mode === 'advanced' && (
                  <th style={{ width: 34 }}>
                    <input
                      className="check"
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all senders"
                    />
                  </th>
                )}
                <th>Sender</th>
                <th className="num">In&nbsp;sample</th>
                <th className="num">Unread</th>
                <th>Last</th>
                <th>Type</th>
                <th>Unsub</th>
                {mode === 'simple' && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const isProt = g.tag === 'protected';
                const sel = selected.has(g.key);
                return (
                  <tr key={g.key} className={sel ? 'selected' : ''}>
                    {mode === 'advanced' && (
                      <td>
                        {isProt ? (
                          <Shield reasons={g.reasons} onOverride={() => api.override(g)} />
                        ) : (
                          <input
                            className="check"
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggle(g.key)}
                            aria-label={`Select ${g.displayName}`}
                          />
                        )}
                      </td>
                    )}
                    <td>
                      <div className="sender-name trunc">{g.displayName}</div>
                      <div className="mono sender-mail trunc">{g.key}</div>
                    </td>
                    <td className="num">{g.count}</td>
                    <td className="num">{g.unreadCount}</td>
                    <td className="muted">{fmtDate(g.lastDate)}</td>
                    <td>
                      <TagBadge tag={g.tag} />
                    </td>
                    <td>
                      <MethodPill method={g.unsubMethod} has={g.hasListUnsubscribe} />
                    </td>
                    {mode === 'simple' && (
                      <td>
                        <div className="row-actions">{simpleActions(g, api, pendingUnsub.has(g.key))}</div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'advanced' && selectedGroups.length > 0 && (
        <div className="bulkbar">
          <div className="bulkbar-inner">
            <div className="sel">
              {selectedGroups.length} selected <em>· ~{selectedEmails} emails</em>
            </div>
            <div className="grow" />
            <button onClick={() => runBulk(selectedGroups, 'unsub')}>Unsubscribe</button>
            <button onClick={() => runBulk(selectedGroups, 'archive')}>Archive</button>
            <button className="danger" onClick={() => runBulk(selectedGroups, 'trash')}>
              Trash
            </button>
            <button className="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}
