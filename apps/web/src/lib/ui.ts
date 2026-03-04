export type DraftLike = {
  objective: string;
  timeframe: string;
  keyResults: Array<{ title: string; targetValue: number; unit: string; currentValue?: number }>;
};

export type ObjectiveSetDraftLike = {
  objectives: DraftLike[];
};

export type RoutePath = '/overview' | '/okrs' | '/checkins';

export const MAX_OBJECTIVES = 5;
export const MAX_KEY_RESULTS_PER_OBJECTIVE = 5;

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

export function validateObjectiveSet(draft: ObjectiveSetDraftLike | null): string[] {
  if (!draft || !Array.isArray(draft.objectives) || draft.objectives.length === 0) {
    return ['Generate or load at least one objective first.'];
  }

  const errors: string[] = [];
  if (draft.objectives.length > MAX_OBJECTIVES) {
    errors.push(`No more than ${MAX_OBJECTIVES} objectives are supported.`);
  }

  draft.objectives.forEach((objective, objectiveIndex) => {
    if (objective.keyResults.length > MAX_KEY_RESULTS_PER_OBJECTIVE) {
      errors.push(`Objective ${objectiveIndex + 1}: no more than ${MAX_KEY_RESULTS_PER_OBJECTIVE} key results are supported.`);
    }
    validateDraft(objective).forEach((err) => errors.push(`Objective ${objectiveIndex + 1}: ${err}`));
  });

  return errors;
}
