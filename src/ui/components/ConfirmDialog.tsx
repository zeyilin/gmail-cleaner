import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ProgressBar } from './ProgressBar';
import type { ProgressEvent } from '../../messaging/commands';

export interface ConfirmOption {
  key: string;
  label: string;
  default: boolean;
}

export interface ConfirmConfig {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  options?: ConfirmOption[];
  onConfirm: (selected: Record<string, boolean>) => void | Promise<void>;
}

export function ConfirmDialog({
  config,
  onCancel,
  progress,
}: {
  config: ConfirmConfig | null;
  onCancel: () => void;
  progress?: ProgressEvent | null;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init: Record<string, boolean> = {};
    config?.options?.forEach((o) => {
      init[o.key] = o.default;
    });
    setSelected(init);
    setBusy(false);
    setErr(undefined);
    if (config) confirmRef.current?.focus();
  }, [config]);

  // Escape to close (when idle) + a lightweight focus trap.
  useEffect(() => {
    if (!config) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const f = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [config, busy, onCancel]);

  if (!config) return null;

  const confirm = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      await config.onConfirm(selected);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{config.title}</h3>
        {config.body && <div className="body">{config.body}</div>}
        {config.options && config.options.length > 0 && (
          <div className="options">
            {config.options.map((o) => (
              <label key={o.key}>
                <input
                  type="checkbox"
                  checked={!!selected[o.key]}
                  onChange={(e) => setSelected((s) => ({ ...s, [o.key]: e.target.checked }))}
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
        {busy && progress && progress.phase === 'action' && (
          <ProgressBar label={progress.label} done={progress.done} total={progress.total} />
        )}
        {err && (
          <div className="status error" style={{ marginTop: 10 }}>
            {err}
          </div>
        )}
        <div className="actions">
          <button onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className={config.danger ? 'danger' : 'primary'}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? 'Working…' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
