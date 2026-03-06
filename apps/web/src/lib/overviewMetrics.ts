export type OverviewKrInput = {
  id: number;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
};

export type ObjectiveOverviewInput = {
  id: number;
  objective: string;
  timeframe: string;
  keyResults: OverviewKrInput[];
};

export type KrStatus = 'on-track' | 'needs-attention' | 'off-track';

export type OverviewKrMetric = {
  id: number;
  title: string;
  unit: string;
  currentValue: number;
  targetValue: number;
  progressRatio: number;
  progressPercent: number;
  gapToTarget: number;
  status: KrStatus;
};

export type ObjectiveMetrics = {
  id: number;
  objective: string;
  timeframe: string;
  progressPercent: number;
  keyResults: OverviewKrMetric[];
};

export type OverviewMetrics = {
  totalKrs: number;
  overallProgressPercent: number;
  statusDistribution: Record<KrStatus, number>;
  topAtRisk: OverviewKrMetric[];
  metricsByKr: OverviewKrMetric[];
  byObjective: ObjectiveMetrics[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function classifyKrStatus(progressRatio: number): KrStatus {
  if (progressRatio >= 0.7) return 'on-track';
  if (progressRatio >= 0.4) return 'needs-attention';
  return 'off-track';
}

function inferKrDirection(title: string): 'increase' | 'decrease' | 'maintain' {
  const normalized = title.toLowerCase();
  if (/\b(maintain|keep|at or below|no more than|at most|<=)\b/.test(normalized)) return 'maintain';
  if (/\b(reduce|decrease|lower|cut|drop|shorten)\b/.test(normalized)) return 'decrease';
  return 'increase';
}

function parseFromToValues(title: string): { from?: number; to?: number } {
  const match = title.match(/from\s+(-?\d+(?:\.\d+)?)\D+to\s+(-?\d+(?:\.\d+)?)/i);
  if (!match) return {};
  const from = Number(match[1]);
  const to = Number(match[2]);
  return {
    from: Number.isFinite(from) ? from : undefined,
    to: Number.isFinite(to) ? to : undefined
  };
}

function mapKrMetric(kr: OverviewKrInput): OverviewKrMetric {
  const target = Number.isFinite(kr.targetValue) ? kr.targetValue : 0;
  const current = Number.isFinite(kr.currentValue) ? kr.currentValue : 0;
  const direction = inferKrDirection(kr.title || '');
  const { from, to } = parseFromToValues(kr.title || '');

  let progressRatio = 0;
  let gapToTarget = 0;

  if (direction === 'maintain') {
    const baseline = Number.isFinite(from) ? Number(from) : target;
    const maintainTarget = Number.isFinite(to) ? Number(to) : target;
    const span = Math.abs(baseline - maintainTarget);
    if (span > 0) {
      progressRatio = clamp(Math.abs(baseline - current) / span, 0, 1);
    } else {
      progressRatio = 0;
    }
    gapToTarget = Math.max(current - maintainTarget, 0);
  } else if (direction === 'decrease') {
    const baseline = Number.isFinite(from) ? Number(from) : Math.max(current, target);
    const decreaseTarget = Number.isFinite(to) ? Number(to) : target;
    const span = Math.max(baseline - decreaseTarget, 0);
    progressRatio = span > 0 ? clamp((baseline - current) / span, 0, 1) : 0;
    gapToTarget = Math.max(current - decreaseTarget, 0);
  } else {
    const baseline = Number.isFinite(from) ? Number(from) : 0;
    const increaseTarget = Number.isFinite(to) ? Number(to) : target;
    const span = Math.max(increaseTarget - baseline, 0);
    progressRatio = span > 0 ? clamp((current - baseline) / span, 0, 1) : 0;
    gapToTarget = Math.max(increaseTarget - current, 0);
  }

  const progressPercent = Math.round(progressRatio * 100);

  return {
    id: kr.id,
    title: kr.title,
    unit: kr.unit,
    currentValue: current,
    targetValue: target,
    progressRatio,
    progressPercent,
    gapToTarget,
    status: classifyKrStatus(progressRatio)
  };
}

export function buildOverviewMetrics(keyResults: OverviewKrInput[]): OverviewMetrics {
  return buildGroupedOverviewMetrics([
    { id: 0, objective: 'All objectives', timeframe: '', keyResults }
  ]);
}

export function buildGroupedOverviewMetrics(objectives: ObjectiveOverviewInput[]): OverviewMetrics {
  const byObjective = objectives.map((objective) => {
    const keyResults = objective.keyResults.map(mapKrMetric);
    const progressPercent = keyResults.length
      ? Math.round((keyResults.reduce((sum, metric) => sum + metric.progressRatio, 0) / keyResults.length) * 100)
      : 0;

    return {
      id: objective.id,
      objective: objective.objective,
      timeframe: objective.timeframe,
      progressPercent,
      keyResults
    } satisfies ObjectiveMetrics;
  });

  const metricsByKr = byObjective.flatMap((objective) => objective.keyResults);

  if (!metricsByKr.length) {
    return {
      totalKrs: 0,
      overallProgressPercent: 0,
      statusDistribution: {
        'on-track': 0,
        'needs-attention': 0,
        'off-track': 0
      },
      topAtRisk: [],
      metricsByKr,
      byObjective
    };
  }

  const aggregateRatio = metricsByKr.reduce((sum, metric) => sum + metric.progressRatio, 0) / metricsByKr.length;
  const statusDistribution: Record<KrStatus, number> = {
    'on-track': 0,
    'needs-attention': 0,
    'off-track': 0
  };

  for (const metric of metricsByKr) {
    statusDistribution[metric.status] += 1;
  }

  const topAtRisk = [...metricsByKr]
    .filter((metric) => metric.status !== 'on-track')
    .sort((a, b) => a.progressRatio - b.progressRatio || b.gapToTarget - a.gapToTarget)
    .slice(0, 3);

  return {
    totalKrs: metricsByKr.length,
    overallProgressPercent: Math.round(aggregateRatio * 100),
    statusDistribution,
    topAtRisk,
    metricsByKr,
    byObjective
  };
}
