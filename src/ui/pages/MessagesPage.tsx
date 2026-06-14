import { useMemo, useState } from 'react';
import type { GroupSnapshot, Category } from '../../types';
import { normalizeSenderKey } from '../../engine/aggregator';
import { Icon } from '../components/icons';

const PAGE = 200;
const gmailUrl = (id: string) => `https://mail.google.com/mail/u/0/#all/${id}`;

function fmtDateTime(ms: number): string {
  try {
    const d = new Date(ms);
    return (
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  } catch {
    return '';
  }
}

export function MessagesPage({ snapshot, mode }: { snapshot: GroupSnapshot; mode: 'simple' | 'advanced' }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const advanced = mode === 'advanced';

  const catByKey = useMemo(() => {
    const m = new Map<string, Category>();
    for (const s of snapshot.senders) m.set(s.key, s.category);
    return m;
  }, [snapshot.senders]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return snapshot.messages;
    return snapshot.messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(ql) ||
        m.name.toLowerCase().includes(ql) ||
        m.email.toLowerCase().includes(ql),
    );
  }, [snapshot.messages, q]);

  if (!snapshot.messages.length) {
    return (
      <div className="empty">
        <div className="big">No messages</div>
        Run a scan to load your inbox sample.
      </div>
    );
  }

  const shown = filtered.slice(0, limit);

  return (
    <>
      <div className="controls">
        <div className="search">
          <Icon name="search" size={15} />
          <input
            aria-label="Search messages"
            placeholder="Search sender or subject…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {filtered.length.toLocaleString()} message{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {advanced && <th style={{ width: 18 }}></th>}
              <th>Sender</th>
              <th>Subject</th>
              {advanced && <th>Type</th>}
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const cat = catByKey.get(normalizeSenderKey(m.email)) ?? 'other';
              return (
                <tr key={m.id}>
                  {advanced && (
                    <td>{m.unread && <span className="unread-dot" title="Unread" />}</td>
                  )}
                  <td>
                    <div className="sender-name trunc" style={{ maxWidth: 180 }}>
                      {m.name}
                    </div>
                    <div className="mono sender-mail trunc" style={{ maxWidth: 180 }}>
                      {m.email}
                    </div>
                  </td>
                  <td>
                    <a
                      className="msg-link trunc"
                      href={gmailUrl(m.id)}
                      target="_blank"
                      rel="noreferrer"
                      title={`${m.subject || '(no subject)'} — open in Gmail`}
                    >
                      {m.subject || '(no subject)'} <span className="msg-ext">↗</span>
                    </a>
                  </td>
                  {advanced && (
                    <td>
                      <span className="tag">
                        <span className={`dot ${cat}`} />
                        {cat}
                      </span>
                    </td>
                  )}
                  <td className="muted mono" style={{ whiteSpace: 'nowrap' }}>
                    {fmtDateTime(m.date)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button onClick={() => setLimit((l) => l + PAGE)}>
            Load {Math.min(PAGE, filtered.length - limit)} more · {(filtered.length - limit).toLocaleString()} left
          </button>
        </div>
      )}
    </>
  );
}
