import { useEffect, useState } from 'react';
import { OverviewSummary } from './OverviewSummary';
import { LeaderRollupSnapshot } from './LeaderRollupSnapshot';
import { ManagerActionDigestSnapshot } from './ManagerActionDigestSnapshot';
import type { OverviewMetrics } from '../lib/overviewMetrics';

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

type LeaderRollup = {
  teams: Array<{ teamId: string; teamDisplayName?: string; ownerDisplayName?: string | null; ownerLabel?: string; onTrack: number; atRisk: number; offTrack: number }>;
  trend: Array<{ weekStart: string; onTrack: number; atRisk: number; offTrack: number }>;
};

type OverviewDashboardProps = {
  role: 'manager' | 'team_member' | 'senior_leader';
  metrics: OverviewMetrics;
  managerDigest: ManagerDigest | null;
  leaderRollup: LeaderRollup | null;
  onRequestKrCheckin?: (input: { krId: number; krTitle: string; objective: string; currentValue: number; targetValue: number; unit: string }) => void;
};

export function OverviewDashboard({ role, metrics, managerDigest, leaderRollup, onRequestKrCheckin }: OverviewDashboardProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'senior_leader') {
      setSelectedTeamId(null);
      return;
    }

    if (!leaderRollup?.teams.length) {
      setSelectedTeamId(null);
      return;
    }

    if (selectedTeamId && !leaderRollup.teams.some((team) => team.teamId === selectedTeamId)) {
      setSelectedTeamId(null);
    }
  }, [role, leaderRollup, selectedTeamId]);

  return (
    <section className="panel" data-testid="overview-dashboard">
      <h2>Overview</h2>

      {role === 'manager' && managerDigest ? <ManagerActionDigestSnapshot digest={managerDigest} /> : null}

      {role === 'senior_leader' && leaderRollup ? (
        <LeaderRollupSnapshot
          rollup={leaderRollup}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          onClearTeamSelection={() => setSelectedTeamId(null)}
        />
      ) : null}

      <OverviewSummary
        role={role}
        metrics={metrics}
        selectedTeamId={role === 'senior_leader' ? selectedTeamId : null}
        onClearTeamSelection={() => setSelectedTeamId(null)}
        onRequestKrCheckin={onRequestKrCheckin}
      />
    </section>
  );
}
