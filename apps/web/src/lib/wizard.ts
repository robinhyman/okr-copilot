export type WizardBaselineInput = {
  baseline: string;
  baselineValue: string;
  baselineUnit: string;
  baselinePeriod: string;
};

export type DraftInput = {
  objectives: Array<{
    objective?: string;
    timeframe?: string;
    keyResults: Array<{ title: string; unit: string }>;
  }>;
};

export type ObjectiveDraftInput = {
  objective: string;
  timeframe: string;
  keyResults: Array<{ title: string; targetValue: number; currentValue: number; unit: string }>;
};

export function applyGeneratedDraft(
  currentObjectives: ObjectiveDraftInput[] | undefined,
  generated: ObjectiveDraftInput,
  mode: 'replace' | 'append',
  maxObjectives: number
): ObjectiveDraftInput[] {
  if (mode === 'append' && currentObjectives?.length) {
    return [...currentObjectives, generated].slice(0, maxObjectives);
  }
  return [generated];
}

export function buildWizardBaselineText(form: WizardBaselineInput): string {
  const value = form.baselineValue.trim();
  const unit = form.baselineUnit.trim();
  const period = form.baselinePeriod.trim();
  if (value && unit) {
    return `Current baseline is ${value} ${unit}${period ? ` per ${period}` : ''}`;
  }
  return form.baseline.trim();
}

export function getPreSaveQualityWarnings(input: DraftInput): string[] {
  const warnings: string[] = [];
  input.objectives.forEach((objective, objectiveIndex) => {
    objective.keyResults.forEach((kr, krIndex) => {
      if (kr.title.trim().split(' ').length < 4) {
        warnings.push(`Objective ${objectiveIndex + 1} KR ${krIndex + 1}: title looks vague.`);
      }
      if (!/\d/.test(kr.title)) {
        warnings.push(`Objective ${objectiveIndex + 1} KR ${krIndex + 1}: add a number in title for clarity.`);
      }
      if (!kr.unit.trim() || kr.unit.trim() === 'points') {
        warnings.push(`Objective ${objectiveIndex + 1} KR ${krIndex + 1}: unit is generic; use a concrete metric unit.`);
      }
    });
  });
  return warnings;
}
