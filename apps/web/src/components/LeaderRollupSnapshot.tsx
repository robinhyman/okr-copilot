type TeamRollup = { teamId: string; onTrack: number; atRisk: number; offTrack: number };
type WeeklyRollup = { weekStart: string; onTrack: number; atRisk: number; offTrack: number };

type LeaderRollup = {
  teams: TeamRollup[];
  trend: WeeklyRollup[];
};

type LeaderRollupSnapshotProps = {
  rollup: LeaderRollup;
};

const STATUS_META = [
  { key: 'onTrack', label: 'On track', className: 'on-track' },
  { key: 'atRisk', label: 'At risk', className: 'needs-attention' },
  { key: 'offTrack', label: 'Off track', className: 'off-track' }
] as const;

function totalForTeam(team: TeamRollup) {
  return team.onTrack + team.atRisk + team.offTrack;
}

function weekTotal(week: WeeklyRollup) {
  return week.onTrack + week.atRisk + week.offTrack;
}

function formatPercent(value: number, total: number) {
  return Math.round((value / Math.max(1, total)) * 100);
}

function formatTeamName(teamId: string) {
  return teamId.replace(/^team_/, '').toUpperCase();
}

export function LeaderRollupSnapshot({ rollup }: LeaderRollupSnapshotProps) {
  const latestWeek = rollup.trend[rollup.trend.length - 1];
  const previousWeek = rollup.trend[rollup.trend.length - 2];
  const latestOnTrackRatio = latestWeek ? latestWeek.onTrack / Math.max(1, weekTotal(latestWeek)) : 0;
  const previousOnTrackRatio = previousWeek ? previousWeek.onTrack / Math.max(1, weekTotal(previousWeek)) : 0;
  const trendDelta = Math.round((latestOnTrackRatio - previousOnTrackRatio) * 100);

  const overallCounts = rollup.teams.reduce(
    (acc, team) => ({
      onTrack: acc.onTrack + team.onTrack,
      atRisk: acc.atRisk + team.atRisk,
      offTrack: acc.offTrack + team.offTrack
    }),
    { onTrack: 0, atRisk: 0, offTrack: 0 }
  );

  const overallTotal = Math.max(1, overallCounts.onTrack + overallCounts.atRisk + overallCounts.offTrack);
  const donutSegments = [
    { key: 'onTrack', label: 'On track', className: 'on-track', value: overallCounts.onTrack },
    { key: 'atRisk', label: 'At risk', className: 'needs-attention', value: overallCounts.atRisk },
    { key: 'offTrack', label: 'Off track', className: 'off-track', value: overallCounts.offTrack }
  ] as const;

  const donutRadius = 28;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let offset = 0;

  return (
    <section className="leader-rollup-snapshot" data-testid="leader-rollup-snapshot">
      <div className="leader-rollup-header">
        <h3>Senior leader rollup snapshot</h3>
        <p className="muted">Cross-team execution health at a glance</p>
      </div>

      <div className="leader-rollup-grid">
        <div className="leader-rollup-card" data-testid="leader-team-health-card">
          <div className="leader-card-heading-row">
            <h4>Team health mix</h4>
            <ul className="leader-legend" aria-label="Status legend">
              {STATUS_META.map((status) => (
                <li key={status.key}>
                  <span className={`leader-dot ${status.className}`} />
                  {status.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="leader-health-mix-layout">
            <div className="leader-health-mix-donut" role="img" aria-label="Leadership rollup health donut">
              <svg viewBox="0 0 72 72" className="leader-mix-donut">
                <circle className="leader-donut-track" cx="36" cy="36" r={donutRadius} />
                {donutSegments.map((segment) => {
                  const dash = (segment.value / overallTotal) * donutCircumference;
                  const segmentOffset = offset;
                  offset += dash;
                  const percent = formatPercent(segment.value, overallTotal);
                  return (
                    <circle
                      key={segment.key}
                      className={`leader-donut-segment ${segment.className}`}
                      cx="36"
                      cy="36"
                      r={donutRadius}
                      strokeDasharray={`${dash} ${donutCircumference - dash}`}
                      strokeDashoffset={-segmentOffset}
                      transform="rotate(-90 36 36)"
                    >
                      <title>{`${segment.label}: ${segment.value} KRs (${percent}%)`}</title>
                    </circle>
                  );
                })}
              </svg>
              <div className="leader-donut-center muted">{overallTotal} KRs</div>
            </div>

            <ul className="leader-team-list">
              {rollup.teams.map((team) => {
                const total = Math.max(1, totalForTeam(team));
                const teamName = formatTeamName(team.teamId);
                const segments = [
                  { key: 'onTrack', label: 'On track', className: 'on-track', value: team.onTrack },
                  { key: 'atRisk', label: 'At risk', className: 'needs-attention', value: team.atRisk },
                  { key: 'offTrack', label: 'Off track', className: 'off-track', value: team.offTrack }
                ] as const;

                return (
                  <li key={team.teamId} className="leader-team-row" data-testid={`leader-team-${team.teamId}`}>
                    <div className="leader-team-row-meta">
                      <strong>{teamName}</strong>
                      <span className="muted">{totalForTeam(team)} KRs</span>
                    </div>
                    <div className="leader-stack" role="img" aria-label={`${team.teamId} health breakdown`}>
                      {segments.map((segment) => (
                        <span
                          key={segment.key}
                          className={`leader-stack-segment ${segment.className}`}
                          style={{ width: `${(segment.value / total) * 100}%` }}
                          title={`${teamName} • ${segment.label}: ${segment.value} KRs (${formatPercent(segment.value, total)}%)`}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="leader-rollup-card" data-testid="leader-trend-card">
          <div className="leader-card-heading-row">
            <h4>4-week trend</h4>
            <span className={`leader-trend-cue ${trendDelta >= 0 ? 'up' : 'down'}`}>
              {trendDelta >= 0 ? '↑' : '↓'} {Math.abs(trendDelta)} pts on-track
            </span>
          </div>

          <div className="leader-trend-sparkline" role="img" aria-label="On-track share trend over 4 weeks">
            {rollup.trend.map((week) => {
              const total = Math.max(1, weekTotal(week));
              const onTrackHeight = Math.max(12, (week.onTrack / total) * 72);
              const atRiskHeight = Math.max(10, (week.atRisk / total) * 72);
              const offTrackHeight = Math.max(8, (week.offTrack / total) * 72);
              return (
                <div key={week.weekStart} className="leader-week-column" data-testid={`leader-trend-week-${week.weekStart}`}>
                  <div className="leader-week-bars">
                    <span className="leader-week-bar on-track" style={{ height: `${onTrackHeight}px` }} />
                    <span className="leader-week-bar needs-attention" style={{ height: `${atRiskHeight}px` }} />
                    <span className="leader-week-bar off-track" style={{ height: `${offTrackHeight}px` }} />
                  </div>
                  <small>{new Date(week.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
