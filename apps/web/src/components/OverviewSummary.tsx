import type { KrStatus, OverviewMetrics } from '../lib/overviewMetrics';

type OverviewSummaryProps = {
  metrics: OverviewMetrics;
};

const STATUS_META: Array<{ key: keyof OverviewMetrics['statusDistribution']; label: string }> = [
  { key: 'on-track', label: 'On track' },
  { key: 'needs-attention', label: 'Needs attention' },
  { key: 'off-track', label: 'Off track' }
];

function ProgressBar({
  value,
  label,
  testId,
  tone = 'objective',
  thickness = 'standard'
}: {
  value: number;
  label: string;
  testId?: string;
  tone?: 'objective' | KrStatus;
  thickness?: 'standard' | 'objective';
}) {
  const bounded = Math.max(0, Math.min(100, value));

  return (
    <div className="progress-bar-wrap" data-testid={testId} role="img" aria-label={`${label} ${bounded}%`}>
      <div className={`progress-bar-track ${thickness === 'objective' ? 'objective' : ''}`}>
        <div className={`progress-bar-fill ${tone}`} style={{ width: `${bounded}%` }} />
      </div>
      <strong>{bounded}%</strong>
    </div>
  );
}

export function OverviewSummary({ metrics }: OverviewSummaryProps) {
  if (!metrics.totalKrs) {
    return (
      <section className="panel nested" data-testid="overview-summary-empty">
        <h3>Progress snapshot</h3>
        <p className="muted">No key results yet. Generate and save an OKR to see progress visuals.</p>
      </section>
    );
  }

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (metrics.overallProgressPercent / 100) * circumference;

  return (
    <section className="panel nested" data-testid="overview-summary">
      <h3>Progress snapshot</h3>
      <div className="overview-grid">
        <div className="overview-card" data-testid="overall-progress-card">
          <h4>Overall progress</h4>
          <div className="donut-wrap" aria-label={`Overall progress ${metrics.overallProgressPercent}%`}>
            <svg viewBox="0 0 120 120" className="donut-chart" role="img">
              <circle className="donut-track" cx="60" cy="60" r={radius} />
              <circle
                className="donut-value"
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
              />
            </svg>
            <div className="donut-center">
              <strong>{metrics.overallProgressPercent}%</strong>
              <span className="muted">Across {metrics.totalKrs} KRs</span>
            </div>
          </div>
        </div>

        <div className="overview-card" data-testid="status-distribution-card">
          <h4>KR status distribution</h4>
          <ul className="distribution-list">
            {STATUS_META.map((status) => (
              <li key={status.key}>
                <span className={`status-pill ${status.key}`}>{status.label}</span>
                <strong>{metrics.statusDistribution[status.key]}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="overview-card" data-testid="at-risk-card">
          <h4>Top at-risk KRs</h4>
          {metrics.topAtRisk.length ? (
            <ul className="history">
              {metrics.topAtRisk.map((kr) => (
                <li key={kr.id}>
                  <strong>{kr.title}</strong>
                  <ProgressBar
                    value={kr.progressPercent}
                    label={`${kr.title} progress`}
                    testId={`at-risk-kr-progress-${kr.id}`}
                    tone={kr.status}
                  />
                  <span className="muted">
                    {kr.currentValue}/{kr.targetValue} {kr.unit}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No at-risk KRs. Nice work — everything is currently on track.</p>
          )}
        </div>
      </div>

      <div className="overview-objectives-heading-row">
        <h3 className="overview-objectives-heading">Objectives</h3>
        <p className="muted">Each objective shows its overall progress and KR contributors.</p>
      </div>

      <div className="objective-summary-grid" data-testid="grouped-objective-summary">
        {metrics.byObjective.map((objective) => {
          const atRiskCount = objective.keyResults.filter((kr) => kr.status !== 'on-track').length;

          return (
            <article className="objective-summary-card" key={objective.id || objective.objective} data-testid={`objective-card-${objective.id}`}>
              <header className="objective-summary-header">
                <h4>{objective.objective}</h4>
                <p className="muted">{objective.timeframe || 'No timeframe'}</p>
              </header>

              <div className="objective-meta-row muted">
                <span>{objective.timeframe || 'No timeframe set'}</span>
                <span>{objective.keyResults.length} KRs</span>
                <span>{atRiskCount} at risk</span>
              </div>

              <div className="objective-progress-block">
                <p className="objective-progress-label">Objective progress</p>
                <ProgressBar
                  value={objective.progressPercent}
                  label={`${objective.objective} objective progress`}
                  testId={`objective-progress-${objective.id}`}
                  tone="objective"
                  thickness="objective"
                />
              </div>

              <div className="kr-contribution-block" data-testid={`objective-${objective.id}-kr-contributors`}>
                <p className="kr-contribution-title">Key result contributors</p>
                <ul className="kr-visual-list">
                  {objective.keyResults.map((kr) => (
                    <li key={kr.id} data-testid={`objective-${objective.id}-kr-${kr.id}`}>
                      <span className="kr-title" title={kr.title}>{kr.title}</span>
                      <ProgressBar
                        value={kr.progressPercent}
                        label={`${kr.title} progress`}
                        testId={`kr-progress-${objective.id}-${kr.id}`}
                        tone={kr.status}
                      />
                      <span className="muted">
                        {kr.currentValue}/{kr.targetValue} {kr.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
