import { useEffect, useState } from 'react';
import { subscribeLog, clearLog, type DebugEntry } from '../../messaging/debugLog';

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '';
  }
}

/**
 * Live activity dock for Debug mode. Subscribes to the in-memory log fed by
 * client.ts (commands) and the worker's Gmail API broadcasts. Newest first.
 */
export function DebugDock() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeLog(setEntries), []);

  const errs = entries.filter((e) => !e.ok).length;

  return (
    <div className={`debug-dock${open ? ' open' : ''}`}>
      {open && (
        <div className="debug-panel" role="region" aria-label="Debug activity log">
          <div className="debug-head">
            <strong>Activity log</strong>
            <span className="muted">live · newest first</span>
            <span className="debug-spacer" />
            <button onClick={() => clearLog()}>Clear</button>
            <button onClick={() => setOpen(false)} aria-label="Close debug log">
              ✕
            </button>
          </div>
          <div className="debug-body">
            {entries.length === 0 ? (
              <div className="debug-empty">
                No activity yet. Click around — every command and Gmail API call shows up here with
                its status, timing, and any error.
              </div>
            ) : (
              <ul>
                {entries.map((e) => (
                  <li key={e.id} className={e.ok ? '' : 'err'}>
                    <span className="debug-time mono">{fmtTime(e.ts)}</span>
                    <span className={`debug-src ${e.src}`}>{e.src}</span>
                    <span className="debug-label mono">{e.label}</span>
                    {e.status != null && <span className="debug-status mono">{e.status}</span>}
                    {e.detail && <span className="debug-detail">{e.detail}</span>}
                    <span className="debug-ms mono">{e.ms}ms</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <button
        className="debug-pill"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Toggle debug activity log"
      >
        <span className={`debug-dot${errs ? ' err' : ''}`} />
        Debug · {entries.length}
        {errs ? ` · ${errs} err` : ''}
      </button>
    </div>
  );
}
