import { useEffect, useState } from 'react';
import { send } from '../../src/messaging/client';
import type { AuthStatus } from '../../src/messaging/commands';

export function Popup() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    send({ type: 'AUTH_STATUS' })
      .then(setAuth)
      .catch((e) => setErr(String(e.message)));
  }, []);

  const open = async () => {
    await send({ type: 'OPEN_DASHBOARD' });
    window.close();
  };
  const signIn = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      setAuth(await send({ type: 'SIGN_IN' }));
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="popup">
      <div className="mark">
        Gmail <em>Cleaner</em>
      </div>
      <div className="sub">
        {auth?.signedIn ? auth.email ?? 'Connected' : 'A calmer inbox, a few clicks away.'}
      </div>
      {err && (
        <div className="status error" style={{ marginBottom: 10 }}>
          {err}
        </div>
      )}
      {auth?.signedIn ? (
        <button className="primary full" onClick={open}>
          Open dashboard →
        </button>
      ) : (
        <button className="primary full" disabled={busy} onClick={signIn}>
          {busy ? 'Connecting…' : 'Connect Gmail'}
        </button>
      )}
      <div className="note">
        Receipts, financial &amp; medical mail are always protected from bulk actions.
      </div>
    </div>
  );
}
