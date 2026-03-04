export type OverviewKrInput = {
  id: number;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
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

export type OverviewMetrics = {
  totalKrs: number;
  overallProgressPercent: number;
  statusDistribution: Record<KrStatus, number>;
  topAtRisk: OverviewKrMetric[];
  metricsByKr: OverviewKrMetric[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function classifyKrStatus(progressRatio: number): KrStatus {
  if (progressRatio >= 0.7) return 'on-track';
  if (progressRatio >= 0.4) return 'needs-attention';
  return 'off-track';
}

export function buildOverviewMetrics(keyResults: OverviewKrInput[]): OverviewMetrics {
  const metricsByKr = keyResults.map((kr) => {
    const target = Number.isFinite(kr.targetValue) ? kr.targetValue : 0;
    const current = Number.isFinite(kr.currentValue) ? kr.currentValue : 0;
    const progressRatio = target > 0 ? clamp(current / target, 0, 1) : 0;
    const progressPercent = Math.round(progressRatio * 100);
    const gapToTarget = Math.max(target - current, 0);

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
    } satisfies OverviewKrMetric;
  });

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
      metricsByKr
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
    metricsByKr
  };
}
