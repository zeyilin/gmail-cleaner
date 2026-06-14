import { useState } from 'react';
import type { UndoBatch } from '../../types';

function fmt(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}

export function ActivityPage({
  batches,
  onUndo,
  onRefresh,
}: {
  batches: UndoBatch[];
  onUndo: (id: string) => void | Promise<void>;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | undefined>();

  if (!batches.length) {
    return (
      <div className="empty">
        <div className="big">No activity yet</div>
        Archive, trash, or unsubscribe actions will appear here — each one undoable.
      </div>
    );
  }

  const handleUndo = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await onUndo(id);
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th className="num">Messages</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="muted mono" style={{ fontSize: 11 }}>
                  {fmt(b.ts)}
                </td>
                <td>{b.description}</td>
                <td className="num">{b.messageIds.length}</td>
                <td>
                  <button
                    className="sm"
                    disabled={b.undone || busyId === b.id}
                    onClick={() => handleUndo(b.id)}
                  >
                    {busyId === b.id ? 'Undoing…' : b.undone ? 'Undone' : 'Undo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
