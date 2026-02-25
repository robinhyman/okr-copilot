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

export interface OkrDraftMetadata {
  source: 'llm' | 'fallback';
  provider: 'openai' | 'deterministic';
  model?: string;
  reason?: string;
  durationMs: number;
}

export interface OkrDraftResult {
  draft: OkrDraft;
  metadata: OkrDraftMetadata;
}

export interface OkrDraftProvider {
  generateDraft(input: OkrDraftRequest): Promise<OkrDraftResult>;
}

const DEFAULT_TIMEFRAME = 'Q2 2026';
const DEFAULT_FOCUS = 'Operational excellence';
const DEFAULT_UNIT = 'points';
const MAX_KEY_RESULTS = 5;

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDraftInputMaxChars(): number {
  return toNumber(process.env.OKR_DRAFT_INPUT_MAX_CHARS, env.okrDraftInputMaxChars);
}

function getLlmTimeoutMs(): number {
  return toNumber(process.env.OKR_DRAFT_LLM_TIMEOUT_MS, env.okrDraftLlmTimeoutMs);
}

function getOpenAiBaseUrl(): string {
  return (process.env.OPENAI_BASE_URL || env.openaiBaseUrl).replace(/\/$/, '');
}

function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL || env.openaiModel;
}

function capText(value: string | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const safe = trimmed || fallback;
  return safe.slice(0, getDraftInputMaxChars());
}

function normalizeDraftShape(raw: unknown, fallbackTimeframe: string): OkrDraft {
  const payload = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const objectiveRaw = typeof payload.objective === 'string' ? payload.objective : '';
  const timeframeRaw = typeof payload.timeframe === 'string' ? payload.timeframe : '';

  const keyResultsRaw = Array.isArray(payload.keyResults) ? payload.keyResults : [];
  const normalizedKrs = keyResultsRaw
    .slice(0, MAX_KEY_RESULTS)
    .map((item) => {
      const kr = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const title = typeof kr.title === 'string' ? kr.title.trim() : '';
      const targetValue = Number(kr.targetValue);
      const currentValue = Number(kr.currentValue);
      const unit = typeof kr.unit === 'string' ? kr.unit.trim() : '';

      if (!title || !Number.isFinite(targetValue) || !Number.isFinite(currentValue)) return null;
      return {
        title: title.slice(0, 160),
        targetValue,
        currentValue,
        unit: (unit || DEFAULT_UNIT).slice(0, 24)
      };
    })
    .filter((kr): kr is NonNullable<typeof kr> => Boolean(kr));

  return {
    objective: (objectiveRaw.trim() || `Improve ${DEFAULT_FOCUS.toLowerCase()} outcomes`).slice(0, 200),
    timeframe: (timeframeRaw.trim() || fallbackTimeframe || DEFAULT_TIMEFRAME).slice(0, 80),
    keyResults: normalizedKrs.length
      ? normalizedKrs
      : [
          { title: 'Ship one measurable process improvement', targetValue: 1, currentValue: 0, unit: 'improvement' }
        ]
  };
}

class DeterministicDraftProvider {
  generate(input: OkrDraftRequest): OkrDraft {
    const focus = capText(input.focusArea, DEFAULT_FOCUS);
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);

    return normalizeDraftShape(
      {
        objective: `Improve ${focus.toLowerCase()} outcomes`,
        timeframe,
        keyResults: [
          {
            title: `Launch 2 repeatable ${focus.toLowerCase()} playbooks`,
            targetValue: 2,
            currentValue: 0,
            unit: 'playbooks'
          },
          { title: 'Increase weekly stakeholder satisfaction score', targetValue: 8, currentValue: 5, unit: '/10' },
          { title: 'Reduce cycle time for priority initiatives', targetValue: 20, currentValue: 0, unit: '%' }
        ]
      },
      timeframe
    );
  }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('invalid_llm_json');
  }
}

class OpenAiDraftProvider {
  async generate(input: OkrDraftRequest): Promise<OkrDraft> {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error('missing_openai_api_key');
    }

    const focus = capText(input.focusArea, DEFAULT_FOCUS);
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getLlmTimeoutMs());

    try {
      const response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: getOpenAiModel(),
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You draft OKRs. Return JSON only with keys: objective (string), timeframe (string), keyResults (array of 3 objects: title, targetValue, currentValue, unit).'
            },
            {
              role: 'user',
              content: `Focus area: ${focus}\nTimeframe: ${timeframe}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`openai_http_${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error('openai_empty_response');

      return normalizeDraftShape(extractJsonObject(content), timeframe);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class ResilientDraftProvider implements OkrDraftProvider {
  private readonly fallbackProvider = new DeterministicDraftProvider();
  private readonly llmProvider = new OpenAiDraftProvider();

  async generateDraft(input: OkrDraftRequest): Promise<OkrDraftResult> {
    const startedAt = Date.now();

    try {
      const draft = await this.llmProvider.generate(input);
      return {
        draft,
        metadata: {
          source: 'llm',
          provider: 'openai',
          model: getOpenAiModel(),
          durationMs: Date.now() - startedAt
        }
      };
    } catch (error: any) {
      const fallbackDraft = this.fallbackProvider.generate(input);
      return {
        draft: fallbackDraft,
        metadata: {
          source: 'fallback',
          provider: 'deterministic',
          reason: error?.name === 'AbortError' ? 'llm_timeout' : (error?.message ?? 'llm_failed'),
          durationMs: Date.now() - startedAt
        }
      };
    }
  }
}

export function createOkrDraftProvider(): OkrDraftProvider {
  return new ResilientDraftProvider();
}
