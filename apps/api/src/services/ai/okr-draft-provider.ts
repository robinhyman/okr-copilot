import { env } from '../../config/env.js';

export interface OkrDraft {
  objective: string;
  timeframe: string;
  keyResults: Array<{ title: string; targetValue: number; currentValue: number; unit: string }>;
}

export interface OkrDraftRequest {
  focusArea?: string;
  timeframe?: string;
}

export interface OkrDraftProvider {
  generateDraft(input: OkrDraftRequest): Promise<OkrDraft>;
}

class DeterministicDraftProvider implements OkrDraftProvider {
  async generateDraft(input: OkrDraftRequest): Promise<OkrDraft> {
    const focus = (input.focusArea || 'Operational excellence').trim();
    const timeframe = (input.timeframe || 'Q2 2026').trim();
    return {
      objective: `Improve ${focus.toLowerCase()} outcomes`,
      timeframe,
      keyResults: [
        { title: `Launch 2 repeatable ${focus.toLowerCase()} playbooks`, targetValue: 2, currentValue: 0, unit: 'playbooks' },
        { title: 'Increase weekly stakeholder satisfaction score', targetValue: 8, currentValue: 5, unit: '/10' },
        { title: 'Reduce cycle time for priority initiatives', targetValue: 20, currentValue: 0, unit: '%' }
      ]
    };
  }
}

export function createOkrDraftProvider(): OkrDraftProvider {
  // Keep provider interface; fallback to deterministic mode when no API key is configured.
  if (!process.env.OPENAI_API_KEY && !env.nodeEnv.includes('prod')) {
    return new DeterministicDraftProvider();
  }
  return new DeterministicDraftProvider();
}
