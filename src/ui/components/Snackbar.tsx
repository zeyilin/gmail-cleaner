import { useEffect } from 'react';

export interface SnackbarData {
  message: string;
  /** Optional undo handler — renders an "Undo" button when present. */
  onUndo?: () => void;
}

export function Snackbar({ data, onClose }: { data: SnackbarData | null; onClose: () => void }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div className="snackbar" role="status" aria-live="polite">
      <span className="snackbar-msg">{data.message}</span>
      {data.onUndo && (
        <button
          className="snackbar-undo"
          onClick={() => {
            data.onUndo!();
            onClose();
          }}
        >
          Undo
        </button>
      )}
      <button className="snackbar-x" aria-label="Dismiss" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
