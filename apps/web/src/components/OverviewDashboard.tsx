import { OverviewSummary } from './OverviewSummary';
import { LeaderRollupSnapshot } from './LeaderRollupSnapshot';
import type { OverviewMetrics } from '../lib/overviewMetrics';

type ManagerDigestItem = {
  keyResultId: number;
  title: string;
  objective: string;
  riskLevel: 'on_track' | 'at_risk' | 'off_track';
  staleDays: number;
  note: string | null;
};

type ManagerDigest = {
  teamId: string;
  summary: { on_track: number; at_risk: number; off_track: number };
  items: ManagerDigestItem[];
};

type LeaderRollup = {
  teams: Array<{ teamId: string; onTrack: number; atRisk: number; offTrack: number }>;
  trend: Array<{ weekStart: string; onTrack: number; atRisk: number; offTrack: number }>;
};

type OverviewDashboardProps = {
  role: 'manager' | 'team_member' | 'senior_leader';
  metrics: OverviewMetrics;
  managerDigest: ManagerDigest | null;
  leaderRollup: LeaderRollup | null;
};

export function OverviewDashboard({ role, metrics, managerDigest, leaderRollup }: OverviewDashboardProps) {
  return (
    <section className="panel" data-testid="overview-dashboard">
      <h2>Overview</h2>

      {role === 'senior_leader' && leaderRollup ? <LeaderRollupSnapshot rollup={leaderRollup} /> : null}

      <OverviewSummary metrics={metrics} />

      {role === 'manager' && managerDigest ? (
        <section className="panel nested" data-testid="manager-digest-card">
          <h3>Manager digest</h3>
          <p className="muted">
            On track {managerDigest.summary.on_track} · At risk {managerDigest.summary.at_risk} · Off track{' '}
            {managerDigest.summary.off_track}
          </p>
          <ul className="history">
            {managerDigest.items.slice(0, 5).map((item) => (
              <li key={item.keyResultId} data-testid={`digest-item-${item.keyResultId}`}>
                <strong>{item.title}</strong> <span className="muted">({item.objective})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
