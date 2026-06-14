import type { SenderGroup } from '../../types';
import { MethodPill } from '../components/Badge';

export function UnsubscribePage({
  senders,
  onUnsub,
  pendingUnsub,
}: {
  senders: SenderGroup[];
  onUnsub: (g: SenderGroup) => void;
  pendingUnsub: Set<string>;
}) {
  const list = senders
    .filter((g) => g.hasListUnsubscribe && g.tag !== 'protected')
    .sort((a, b) => b.count - a.count);

  if (!list.length) {
    return (
      <div className="empty">
        <div className="big">Nothing to unsubscribe</div>
        No senders with an unsubscribe header in the current sample.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Sender</th>
            <th>Method</th>
            <th className="num">In sample</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((g) => {
            const pending = pendingUnsub.has(g.key);
            return (
              <tr key={g.key}>
                <td>
                  <div className="sender-name trunc">{g.displayName}</div>
                  <div className="mono sender-mail trunc">{g.key}</div>
                </td>
                <td>
                  <MethodPill method={g.unsubMethod} has />
                </td>
                <td className="num">{g.count}</td>
                <td>
                  <div className="row-actions">
                    <button className="primary sm" disabled={pending} onClick={() => onUnsub(g)}>
                      {pending ? 'Unsubscribing…' : 'Unsubscribe'}
                    </button>
                    {g.unsubTarget && g.unsubMethod !== 'mailto' && (
                      <a className="btn sm" href={g.unsubTarget} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
