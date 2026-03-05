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
  return `Help me create a measurable OKR for ${teamId}. Start by coaching me with your most important first question.`;
}
