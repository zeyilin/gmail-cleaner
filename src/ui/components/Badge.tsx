import type { SenderTag, UnsubMethod } from '../../types';

const LABEL: Record<SenderTag, string> = {
  keep: 'keep',
  marketing: 'marketing',
  protected: 'protected',
  unknown: 'unknown',
};

export function TagBadge({ tag }: { tag: SenderTag }) {
  return (
    <span className="tag">
      <span className={`dot ${tag}`} />
      {LABEL[tag]}
    </span>
  );
}

export function MethodPill({ method, has }: { method: UnsubMethod; has: boolean }) {
  if (!has) return <span className="muted">—</span>;
  return <span className="pill method">{method}</span>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`toggle${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    />
  );
}
