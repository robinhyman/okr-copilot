type TeamRollup = {
  teamId: string;
  teamDisplayName?: string;
  ownerDisplayName?: string | null;
  ownerLabel?: string;
  onTrack: number;
  atRisk: number;
  offTrack: number;
};
type WeeklyRollup = { weekStart: string; onTrack: number; atRisk: number; offTrack: number };

type LeaderRollup = {
  teams: TeamRollup[];
  trend: WeeklyRollup[];
};

type LeaderRollupSnapshotProps = {
  rollup: LeaderRollup;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
  onClearTeamSelection?: () => void;
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

function fallbackTeamName(teamId: string) {
  const plain = teamId.replace(/^team_/, '').replace(/[_-]+/g, ' ').trim();
  return plain
    .split(' ')
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : '')
    .join(' ') + ' Team';
}

function teamDisplayMeta(team: TeamRollup): { teamName: string; ownerLabel: string } {
  const teamName = team.teamDisplayName?.trim() || fallbackTeamName(team.teamId);
  const ownerLabel = team.ownerLabel?.trim()
    || (team.ownerDisplayName?.trim() ? `Owner: ${team.ownerDisplayName.trim()}` : 'Owner: Unassigned');
  return { teamName, ownerLabel };
}

function teamNeedsAttention(team: TeamRollup): boolean {
  return team.offTrack > 0 || team.atRisk > 0;
}

export function LeaderRollupSnapshot({
  rollup,
  selectedTeamId = null,
  onSelectTeam,
  onClearTeamSelection
}: LeaderRollupSnapshotProps) {
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

  const sortedTeams = [...rollup.teams].sort((a, b) => {
    if (b.offTrack !== a.offTrack) return b.offTrack - a.offTrack;
    if (b.atRisk !== a.atRisk) return b.atRisk - a.atRisk;
    return teamDisplayMeta(a).teamName.localeCompare(teamDisplayMeta(b).teamName);
  });

  const needsAttentionTeams = sortedTeams.filter(teamNeedsAttention);
  const stableTeams = sortedTeams.filter((team) => !teamNeedsAttention(team));
  const selectedTeamMeta = selectedTeamId
    ? sortedTeams.find((team) => team.teamId === selectedTeamId)
    : null;

  const overallTotal = Math.max(1, overallCounts.onTrack + overallCounts.atRisk + overallCounts.offTrack);
  const donutSegments = [
    { key: 'onTrack', label: 'On track', className: 'on-track', value: overallCounts.onTrack },
    { key: 'atRisk', label: 'At risk', className: 'needs-attention', value: overallCounts.atRisk },
    { key: 'offTrack', label: 'Off track', className: 'off-track', value: overallCounts.offTrack }
  ] as const;

  const donutRadius = 28;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let offset = 0;

  const renderTeamRow = (team: TeamRollup) => {
    const total = Math.max(1, totalForTeam(team));
    const meta = teamDisplayMeta(team);
    const isSelected = selectedTeamId === team.teamId;
    const segments = [
      { key: 'onTrack', label: 'On track', className: 'on-track', value: team.onTrack },
      { key: 'atRisk', label: 'At risk', className: 'needs-attention', value: team.atRisk },
      { key: 'offTrack', label: 'Off track', className: 'off-track', value: team.offTrack }
    ] as const;

    return (
      <li key={team.teamId} className="leader-team-row" data-testid={`leader-team-${team.teamId}`}>
        <button
          type="button"
          className="leader-team-button"
          aria-pressed={isSelected}
          aria-label={`Filter objectives for ${meta.teamName}`}
          onClick={() => onSelectTeam?.(team.teamId)}
        >
          <div className="leader-team-row-meta">
            <div>
              <strong>{meta.teamName}</strong>
              <div className="muted">{meta.ownerLabel}</div>
              <div className="muted">{team.teamId}</div>
            </div>
            <span className="muted">{totalForTeam(team)} KRs</span>
          </div>
          <div className="leader-stack" role="img" aria-label={`${meta.teamName} ownership and health breakdown`}>
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={`leader-stack-segment ${segment.className}`}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${meta.teamName} • ${segment.label}: ${segment.value} KRs (${formatPercent(segment.value, total)}%)`}
              />
            ))}
          </div>
        </button>
      </li>
    );
  };

  return (
    <section className="leader-rollup-snapshot" data-testid="leader-rollup-snapshot">
      <div className="leader-rollup-header">
        <h3>Senior leader rollup snapshot</h3>
        <p className="muted">Cross-team execution health and ownership at a glance</p>
        {selectedTeamMeta ? (
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <p className="muted" data-testid="leader-selected-team">
              Filtered to {teamDisplayMeta(selectedTeamMeta).teamName}
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => onClearTeamSelection?.()}
              aria-label="Clear selected team filter"
            >
              Clear filter
            </button>
          </div>
        ) : null}
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

            <div>
              {needsAttentionTeams.length ? (
                <>
                  <p className="muted leader-group-label">Needs attention now</p>
                  <ul className="leader-team-list">{needsAttentionTeams.map(renderTeamRow)}</ul>
                </>
              ) : null}
              {stableTeams.length ? (
                <>
                  <p className="muted leader-group-label">Stable teams</p>
                  <ul className="leader-team-list">{stableTeams.map(renderTeamRow)}</ul>
                </>
              ) : null}
            </div>
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
