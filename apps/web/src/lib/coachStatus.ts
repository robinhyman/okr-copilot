type ChatTurnMetadata = {
  source?: 'llm' | 'fallback';
  reason?: string;
  sri?: number;
  unresolvedSlotAge?: number;
  ttfudTurns?: number;
};

export function formatTurnStatus(metadata?: ChatTurnMetadata): string {
  if (!metadata?.source) return '';
  const sourceText = metadata.source === 'llm'
    ? 'source: llm'
    : metadata.reason
      ? `source: fallback (${metadata.reason})`
      : 'source: fallback';

  const diagnostics = [
    metadata.sri != null ? `SRI ${metadata.sri}` : null,
    metadata.unresolvedSlotAge != null ? `slot-age ${metadata.unresolvedSlotAge}` : null,
    metadata.ttfudTurns != null ? `TTFUD ${metadata.ttfudTurns}` : null
  ].filter(Boolean);

  return diagnostics.length ? `${sourceText} · ${diagnostics.join(' · ')}` : sourceText;
}

export function buildCreateFlowSeedMessage(teamId: string): string {
  return `Help me create a measurable OKR for ${teamId}. Ask one short, high-impact clarifying question first.`;
}

export function buildDeterministicFirstCoachQuestion(teamId: string): string {
  return `What is the most important business outcome ${teamId} must achieve this quarter, and why now?`;
}
