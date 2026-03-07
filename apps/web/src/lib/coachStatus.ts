type ChatTurnMetadata = {
  source?: 'llm' | 'fallback';
  reason?: string;
};

export function formatTurnStatus(metadata?: ChatTurnMetadata): string {
  if (!metadata?.source) return '';
  if (metadata.source === 'llm') return 'source: llm';
  return metadata.reason ? `source: fallback (${metadata.reason})` : 'source: fallback';
}

export function buildCreateFlowSeedMessage(teamId: string): string {
  return `Help me create a measurable OKR for ${teamId}. Ask one short, high-impact clarifying question first.`;
}

export function buildDeterministicFirstCoachQuestion(teamId: string): string {
  return `What is the most important business outcome ${teamId} must achieve this quarter, and why now?`;
}
