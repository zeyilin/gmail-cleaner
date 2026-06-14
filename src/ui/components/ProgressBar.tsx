export function ProgressBar({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  return (
    <div className="progress">
      <div className="progress-label">
        {label}
        {pct !== null ? ` — ${done}/${total} (${pct}%)` : '…'}
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill${pct === null ? ' indeterminate' : ''}`}
          style={pct !== null ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}
