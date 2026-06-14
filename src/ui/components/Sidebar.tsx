import { Icon } from './icons';
import type { View } from '../uiTypes';

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'triage', label: 'Triage', icon: 'triage' },
  { id: 'senders', label: 'Senders', icon: 'senders' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
  { id: 'unsubscribe', label: 'Unsubscribe', icon: 'unsubscribe' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar({
  view,
  setView,
  mode,
  setMode,
  email,
  counts,
  onSignOut,
}: {
  view: View;
  setView: (v: View) => void;
  mode: 'simple' | 'advanced';
  setMode: (m: 'simple' | 'advanced') => void;
  email?: string;
  counts: Partial<Record<View, number>>;
  onSignOut: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="mark">
          Gmail&nbsp;<em>Cleaner</em>
        </span>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item${view === n.id ? ' active' : ''}`}
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => setView(n.id)}
          >
            <Icon name={n.icon} className="ico" />
            {n.label}
            {counts[n.id] != null && <span className="count">{counts[n.id]}</span>}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <div
        className="mode-switch"
        role="group"
        aria-label="Mode"
        title="Simple = guided one-click · Advanced = multi-select + bulk"
      >
        <button
          className={mode === 'simple' ? 'on' : ''}
          aria-pressed={mode === 'simple'}
          onClick={() => setMode('simple')}
        >
          Simple
        </button>
        <button
          className={mode === 'advanced' ? 'on' : ''}
          aria-pressed={mode === 'advanced'}
          onClick={() => setMode('advanced')}
        >
          Advanced
        </button>
      </div>
      <div className="account">
        <div className="avatar">{(email || '?').slice(0, 1).toUpperCase()}</div>
        <div className="who" style={{ flex: 1, minWidth: 0 }}>
          <div className="e">{email || 'Signed in'}</div>
          <button className="link-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
