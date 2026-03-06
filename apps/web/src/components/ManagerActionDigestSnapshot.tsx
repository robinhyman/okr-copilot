import { useMemo, useState } from 'react';

type ManagerDigestItem = {
  keyResultId: number;
  title: string;
  objective: string;
  riskLevel: 'on_track' | 'at_risk' | 'off_track';
  staleDays: number;
  note: string | null;
  reasonCodes?: string[];
  blockers?: string[];
  confidence?: number | null;
  progressDelta?: number | null;
  riskScore?: number;
  suggestedAction?: string;
};

type ManagerDigest = {
  teamId: string;
  summary: { on_track: number; at_risk: number; off_track: number };
  generatedAt?: string;
  items: ManagerDigestItem[];
};

type Props = {
  digest: ManagerDigest;
};

function reasonLabel(code: string): string {
  if (code === 'stale_update') return 'Stale updates';
  if (code === 'negative_progress_delta') return 'Regression';
  if (code === 'low_confidence') return 'Low confidence';
  if (code === 'blockers_present') return 'Blockers present';
  if (code === 'low_progress_ratio') return 'Low progress';
  return code;
}

function suggestAction(item: ManagerDigestItem): string {
  if (item.suggestedAction) return item.suggestedAction;
  const reasons = item.reasonCodes ?? [];
  if (reasons.includes('stale_update')) return 'Request fresh check-in by Friday';
  if (reasons.includes('blockers_present')) return 'Escalate blockers and assign an owner';
  if (reasons.includes('negative_progress_delta')) return 'Run recovery plan with KR owner';
  if (reasons.includes('low_confidence')) return 'Clarify confidence risks in next 1:1';
  if (item.riskLevel === 'off_track') return 'Set a corrective milestone this week';
  return 'Keep monitoring this KR';
}

export function ManagerActionDigestSnapshot({ digest }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [actionStatus, setActionStatus] = useState('');

  const staleCount = digest.items.filter((item) => item.staleDays >= 8).length;
  const blockerCount = digest.items.filter((item) => (item.blockers ?? []).length > 0).length;
  const topItems = digest.items.slice(0, 3);
  const remaining = digest.items.slice(3);

  const qualityLabel = useMemo(() => {
    if (staleCount >= 4) return 'Needs fresh updates';
    if (staleCount > 0 || blockerCount > 0) return 'Watch data quality';
    return 'Healthy coverage';
  }, [staleCount, blockerCount]);

  return (
    <section className="manager-digest-snapshot" data-testid="manager-digest-card">
      <div className="leader-card-heading-row">
        <div>
          <h3>Manager action digest</h3>
          <p className="muted">Focus on the top intervention KRs this week</p>
        </div>
        <span className="badge">Quality: {qualityLabel}</span>
      </div>

      <div className="manager-kpi-grid" data-testid="manager-digest-kpis">
        <div className="manager-kpi-tile off-track">
          <span className="muted">Off track</span>
          <strong>{digest.summary.off_track}</strong>
        </div>
        <div className="manager-kpi-tile at-risk">
          <span className="muted">At risk</span>
          <strong>{digest.summary.at_risk}</strong>
        </div>
        <div className="manager-kpi-tile stale">
          <span className="muted">Stale KRs</span>
          <strong>{staleCount}</strong>
        </div>
        <div className="manager-kpi-tile blockers">
          <span className="muted">Blocked KRs</span>
          <strong>{blockerCount}</strong>
        </div>
      </div>

      <div className="manager-digest-priority-list">
        {topItems.map((item) => (
          <article key={item.keyResultId} className="manager-digest-item" data-testid={`digest-item-${item.keyResultId}`}>
            <div className="manager-digest-item-header">
              <strong>{item.title}</strong>
              {typeof item.riskScore === 'number' ? <span className="badge">risk {Math.round(item.riskScore)}</span> : null}
            </div>
            <div className="muted">{item.objective}</div>
            <div className="row" style={{ marginTop: '0.2rem' }}>
              <span className="badge">{item.riskLevel.replace('_', ' ')}</span>
              <span className="badge">{item.staleDays}d stale</span>
              {(item.reasonCodes ?? []).slice(0, 2).map((reason) => (
                <span key={reason} className="badge">{reasonLabel(reason)}</span>
              ))}
            </div>
            <div className="muted" style={{ marginTop: '0.2rem' }}>Next action: {suggestAction(item)}</div>
            <div className="row" style={{ marginTop: '0.35rem' }}>
              <button className="secondary" onClick={() => setActionStatus(`Nudge queued for KR ${item.keyResultId}`)}>Nudge owner</button>
              <button className="secondary" onClick={() => setActionStatus(`Check-in reminder queued for KR ${item.keyResultId}`)}>Schedule check-in</button>
            </div>
          </article>
        ))}
      </div>

      {remaining.length > 0 ? (
        <div style={{ marginTop: '0.5rem' }}>
          <button className="secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? `Hide ${remaining.length} additional items` : `Show ${remaining.length} additional items`}
          </button>
          {expanded ? (
            <ul className="history" data-testid="manager-digest-expanded-list">
              {remaining.map((item) => (
                <li key={item.keyResultId}>
                  <strong>{item.title}</strong> <span className="muted">({item.objective})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {actionStatus ? <p className="muted">{actionStatus}</p> : null}
    </section>
  );
}
