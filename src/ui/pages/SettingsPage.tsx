import { useEffect, useState } from 'react';
import { normalizeDomain, type Settings } from '../../store/settings';
import { Toggle } from '../components/Badge';

export function SettingsPage({
  settings,
  onSave,
  onRescan,
  email,
  onSignOut,
  oneClickEnabled,
  onEnableOneClick,
  onDisableOneClick,
}: {
  settings: Settings;
  onSave: (patch: Partial<Settings>, rescan?: boolean) => void;
  onRescan: () => void;
  email?: string;
  onSignOut: () => void;
  oneClickEnabled: boolean;
  onEnableOneClick: () => void;
  onDisableOneClick: () => void;
}) {
  const [newDom, setNewDom] = useState('');
  const [domErr, setDomErr] = useState<string | undefined>();
  // Uncommitted input state so typing multi-digit values isn't clamped per keystroke.
  const [sampleDraft, setSampleDraft] = useState(String(settings.sampleSize));
  useEffect(() => setSampleDraft(String(settings.sampleSize)), [settings.sampleSize]);

  const commitSample = (v: number) => {
    if (Number.isFinite(v)) onSave({ sampleSize: Math.max(100, Math.min(5000, v)) });
    else setSampleDraft(String(settings.sampleSize));
  };

  const addDomain = () => {
    const d = normalizeDomain(newDom);
    if (!d) {
      setDomErr('Enter a valid domain, e.g. mybank.com');
      return;
    }
    setDomErr(undefined);
    if (!settings.customProtectedDomains.includes(d)) {
      onSave({ customProtectedDomains: [...settings.customProtectedDomains, d] }, true);
    }
    setNewDom('');
  };
  const removeDomain = (d: string) =>
    onSave({ customProtectedDomains: settings.customProtectedDomains.filter((x) => x !== d) }, true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section className="block" style={{ margin: 0 }}>
        <h2>Account</h2>
        <div className="card" style={{ padding: '8px 18px' }}>
          <div className="row-setting">
            <div className="meta">
              <div className="t">{email || 'Signed in'}</div>
              <div className="d">Connected Gmail account</div>
            </div>
            <button onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </section>

      <section className="block" style={{ margin: 0 }}>
        <h2>Scanning</h2>
        <div className="card" style={{ padding: '8px 18px' }}>
          <div className="row-setting">
            <div className="meta">
              <div className="t">Sample size</div>
              <div className="d">How many recent inbox messages to read per scan (100–5000). Higher is more
                complete but slower.</div>
            </div>
            <div className="stepper">
              <button aria-label="Decrease sample size" onClick={() => commitSample(settings.sampleSize - 250)}>
                −
              </button>
              <input
                aria-label="Sample size"
                inputMode="numeric"
                value={sampleDraft}
                onChange={(e) => setSampleDraft(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => commitSample(parseInt(sampleDraft, 10))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSample(parseInt(sampleDraft, 10));
                }}
              />
              <button aria-label="Increase sample size" onClick={() => commitSample(settings.sampleSize + 250)}>
                +
              </button>
            </div>
          </div>
          <div className="row-setting">
            <div className="meta">
              <div className="t">Rescan now</div>
              <div className="d">Re-read your inbox with the current settings.</div>
            </div>
            <button className="primary" onClick={onRescan}>
              Rescan
            </button>
          </div>
        </div>
      </section>

      <section className="block" style={{ margin: 0 }}>
        <h2>Behavior</h2>
        <div className="card" style={{ padding: '8px 18px' }}>
          <div className="row-setting">
            <div className="meta">
              <div className="t">Start in Advanced mode</div>
              <div className="d">Open the dashboard with multi-select + bulk actions instead of guided
                one-click.</div>
            </div>
            <Toggle on={settings.advancedMode} onChange={(v) => onSave({ advancedMode: v })} />
          </div>
          <div className="row-setting">
            <div className="meta">
              <div className="t">Mark as read when archiving</div>
              <div className="d">Archived mail is also marked read by default.</div>
            </div>
            <Toggle on={settings.markReadOnArchive} onChange={(v) => onSave({ markReadOnArchive: v })} />
          </div>
          <div className="row-setting">
            <div className="meta">
              <div className="t">Silent one-click unsubscribe (all senders)</div>
              <div className="d">
                {oneClickEnabled
                  ? 'On — opt-outs are sent silently across all senders.'
                  : 'Off — single unsubscribes ask permission per sender. Turn on to allow silent bulk unsubscribe (grants access to all sites).'}
              </div>
            </div>
            <Toggle on={oneClickEnabled} onChange={(v) => (v ? onEnableOneClick() : onDisableOneClick())} />
          </div>
        </div>
      </section>

      <section className="block" style={{ margin: 0 }}>
        <h2>Protected senders</h2>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div className="d muted" style={{ fontSize: 13 }}>
            Banks, brokerages, order confirmations, government, medical, and your Gmail
            finance/medical labels are protected automatically. Add any extra domains you never want
            bulk-actioned — they take effect on the next scan.
          </div>
          {settings.customProtectedDomains.length > 0 && (
            <div className="chips">
              {settings.customProtectedDomains.map((d) => (
                <span className="chip" key={d}>
                  {d}
                  <button onClick={() => removeDomain(d)} aria-label={`Remove ${d}`}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="add-domain">
            <input
              aria-label="Add protected domain"
              placeholder="e.g. mybank.com"
              value={newDom}
              onChange={(e) => {
                setNewDom(e.target.value);
                if (domErr) setDomErr(undefined);
              }}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
            />
            <button className="primary" onClick={addDomain}>
              Add domain
            </button>
          </div>
          {domErr && (
            <div className="status error" style={{ marginTop: 8 }}>
              {domErr}
            </div>
          )}
        </div>
      </section>

      <section className="block" style={{ margin: 0 }}>
        <h2>Developer</h2>
        <div className="card" style={{ padding: '8px 18px' }}>
          <div className="row-setting">
            <div className="meta">
              <div className="t">Debug mode</div>
              <div className="d">
                Shows a live activity log in a dock at the bottom-right — every command and Gmail
                API call, with status code, timing, and any error. Stays on your machine; nothing is
                sent anywhere.
              </div>
            </div>
            <Toggle on={settings.debugMode} onChange={(v) => onSave({ debugMode: v })} />
          </div>
        </div>
      </section>
    </div>
  );
}
