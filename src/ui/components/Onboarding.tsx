import { useState } from 'react';

function Step({ n, t, d, safe }: { n: string; t: string; d: string; safe?: boolean }) {
  return (
    <div className={`step${safe ? ' safe' : ''}`}>
      <div className="num">{n}</div>
      <div>
        <div className="st">{t}</div>
        <div className="sd">{d}</div>
      </div>
    </div>
  );
}

export function Onboarding({
  onConnect,
  connecting,
  error,
}: {
  onConnect: () => void;
  connecting: boolean;
  error?: string;
}) {
  const [step, setStep] = useState(0);

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="mark">
          Gmail&nbsp;<em>Cleaner</em>
        </div>

        {step === 0 && (
          <>
            <h2>
              Clean up your inbox
              <br />
              without the anxiety.
            </h2>
            <p className="lede">
              See who's filling your inbox, unsubscribe in one click, and archive the backlog — while
              your receipts and financial mail stay completely untouched.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h2>How it works</h2>
            <div className="steps">
              <Step n="1" t="Scan & group" d="We sample your inbox and group it by sender, category, and age — all in your browser." />
              <Step n="2" t="Unsubscribe in one click" d="Stop future mail with the one-click standard, with a safe tab fallback when needed." />
              <Step n="3" t="Archive or trash the backlog" d="Clear existing mail in bulk. Every action is reversible — undo any of it." />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Your money mail stays safe</h2>
            <p className="lede">
              Receipts, bank, investment, and medical mail are detected automatically and{' '}
              <b>excluded from every bulk action</b>. Nothing is ever permanently deleted — trash is
              recoverable and you can always undo.
            </p>
            <div className="steps">
              <Step
                safe
                n="🛡"
                t="Protected by default"
                d="Amex, Vanguard, order confirmations, your finance & medical labels, and any domains you add."
              />
            </div>
          </>
        )}

        <div className="dots">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>

        {error && (
          <div className="status error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="onboard-actions">
          {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
          {step < 2 ? (
            <button className="primary" onClick={() => setStep(step + 1)}>
              {step === 0 ? 'Get started' : 'Next'} →
            </button>
          ) : (
            <button className="primary" disabled={connecting} onClick={onConnect}>
              {connecting ? 'Connecting…' : 'Connect Gmail'}
            </button>
          )}
        </div>

        <div className="onboard-foot">
          Runs entirely in your browser. Nothing leaves your machine except Gmail API calls.
        </div>
      </div>
    </div>
  );
}
