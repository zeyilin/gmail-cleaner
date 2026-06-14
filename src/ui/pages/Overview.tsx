import type { GroupSnapshot } from '../../types';
import { Icon } from '../components/icons';

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function Overview({
  snapshot,
  onExactCount,
  onReview,
}: {
  snapshot: GroupSnapshot;
  onExactCount: (query: string, label: string) => void;
  onReview: () => void;
}) {
  const s = snapshot;
  const yes = s.facets.hasUnsub.find((f) => f.key === 'yes')?.count ?? 0;
  const bulkPct = pct(yes, s.totalSampled);
  const unsubbable = s.senders.filter((g) => g.hasListUnsubscribe && g.tag !== 'protected');
  const reclaimable = unsubbable.reduce((a, g) => a + g.count, 0);

  const catMax = Math.max(1, ...s.facets.categories.map((c) => Math.min(c.count, 200)));
  const ageVals = [
    { k: '< 1 month', v: s.facets.age.lt1m },
    { k: '1–6 months', v: s.facets.age.m1to6 },
    { k: '6–12 months', v: s.facets.age.m6to12 },
    { k: '> 1 year', v: s.facets.age.gt1y },
  ];
  const ageMax = Math.max(1, ...ageVals.map((a) => a.v));

  return (
    <>
      <section className="block">
        <div className="card hero">
          <div className="metric">
            <div className="big">
              {bulkPct}
              <small>%</small>
            </div>
            <div className="k">of your sampled inbox is bulk mail (newsletters &amp; marketing)</div>
          </div>
          <div className="divider" />
          <div className="metric">
            <div className="big" style={{ fontSize: 34 }}>
              {s.totalSampled}
            </div>
            <div className="k">messages scanned</div>
          </div>
          <div className="metric">
            <div className="big" style={{ fontSize: 34 }}>
              {s.senders.length}
            </div>
            <div className="k">distinct senders</div>
          </div>
          <div className="metric">
            <div className="big" style={{ fontSize: 34 }}>
              {s.facets.protectedCount}
            </div>
            <div className="k">🛡 protected</div>
          </div>
        </div>
      </section>

      {unsubbable.length > 0 && (
        <section className="block">
          <div className="card suggest">
            <div className="txt">
              <b>Reclaim your inbox.</b>
              <div className="sub">
                {unsubbable.length} senders offer one-click unsubscribe (~{reclaimable} messages in
                this sample). Review and clear them in a couple of clicks.
              </div>
            </div>
            <button className="primary" onClick={onReview}>
              Start triage <Icon name="arrow" size={15} />
            </button>
          </div>
        </section>
      )}

      <section className="block">
        <h2>By category</h2>
        <div className="card">
          <div className="bars">
            {s.facets.categories.map((c) => (
              <div className="bar-row" key={c.key}>
                <div className="lbl">{c.label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(Math.min(c.count, 200) / catMax) * 100}%` }}
                  />
                </div>
                <div className="val">
                  <button
                    className="link-btn"
                    style={{ fontFamily: 'var(--mono)' }}
                    title="count exactly"
                    onClick={() => onExactCount(`in:inbox category:${c.key}`, c.label)}
                  >
                    {c.count}
                    {c.capped ? '+' : ''}
                  </button>
                </div>
              </div>
            ))}
            {s.facets.readUnread.map((c) => (
              <div className="bar-row" key={c.key}>
                <div className="lbl">{c.label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(Math.min(c.count, 200) / 200) * 100}%`, background: 'var(--muted)' }}
                  />
                </div>
                <div className="val">
                  {c.count}
                  {c.capped ? '+' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <h2>By age (sampled)</h2>
        <div className="card">
          <div className="bars">
            {ageVals.map((a) => (
              <div className="bar-row" key={a.k}>
                <div className="lbl">{a.k}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(a.v / ageMax) * 100}%` }} />
                </div>
                <div className="val">{a.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {s.phishing.length > 0 && (
        <section className="block">
          <h2>Phishing advisories</h2>
          <div className="advisory">
            <h3>⚠ {s.phishing.length} message(s) look suspicious — verify directly, don't click links</h3>
            <ul>
              {s.phishing.slice(0, 8).map((p) => (
                <li key={p.messageId}>
                  <b>{p.from}</b> — “{p.subject}” <span className="muted">({p.reasons.join('; ')})</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
