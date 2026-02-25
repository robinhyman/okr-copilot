export const moduleBoundaries = [
  'auth',
  'workspace-docs',
  'okr-domain',
  'checkins-reminders',
  'integrations',
  'ai-orchestrator'
] as const;

export type OkrModule = (typeof moduleBoundaries)[number];
