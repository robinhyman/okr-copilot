export type DraftLike = {
  objective: string;
  timeframe: string;
  keyResults: Array<{ title: string; targetValue: number; unit: string; currentValue?: number }>;
};

export type RoutePath = '/overview' | '/okrs' | '/checkins';

export function getRoutePath(pathname: string): RoutePath {
  if (pathname === '/okrs') return '/okrs';
  if (pathname === '/checkins') return '/checkins';
  return '/overview';
}

export function validateDraft(draft: DraftLike | null): string[] {
  if (!draft) return ['Generate or load an OKR draft first.'];
  const errors: string[] = [];

  if (!draft.objective.trim()) errors.push('Objective is required.');
  if (!draft.timeframe.trim()) errors.push('Timeframe is required.');

  draft.keyResults.forEach((kr, index) => {
    if (!kr.title.trim()) errors.push(`KR ${index + 1}: title is required.`);
    if (!Number.isFinite(kr.targetValue) || kr.targetValue <= 0) errors.push(`KR ${index + 1}: target value must be > 0.`);
    if (!kr.unit.trim()) errors.push(`KR ${index + 1}: unit is required.`);
  });

  return errors;
}
