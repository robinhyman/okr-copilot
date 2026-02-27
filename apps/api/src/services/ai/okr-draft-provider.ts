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

export interface OkrConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OkrConversationRequest {
  messages: OkrConversationMessage[];
  draft?: OkrDraft;
  focusArea?: string;
  timeframe?: string;
}

export interface OkrConversationResult {
  assistantMessage: string;
  mode?: 'questions' | 'refine';
  questions?: string[];
  rationale?: string[];
  draft: OkrDraft;
  metadata: OkrDraftMetadata;
}

export interface OkrDraftProvider {
  generateDraft(input: OkrDraftRequest): Promise<OkrDraftResult>;
  continueConversation(input: OkrConversationRequest): Promise<OkrConversationResult>;
}

const DEFAULT_TIMEFRAME = 'Q2 2026';
const DEFAULT_FOCUS = 'Operational excellence';
const DEFAULT_UNIT = 'points';
const MAX_KEY_RESULTS = 5;
const MAX_MESSAGES = 12;

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

function sanitizeMessages(messages: OkrConversationMessage[]): OkrConversationMessage[] {
  return messages
    .filter((message) => message && typeof message.content === 'string' && typeof message.role === 'string')
    .map((message) => {
      const role: OkrConversationMessage['role'] = message.role === 'assistant' ? 'assistant' : 'user';
      return {
        role,
        content: message.content.trim().slice(0, getDraftInputMaxChars())
      };
    })
    .filter((message) => Boolean(message.content))
    .slice(-MAX_MESSAGES);
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

  continueConversation(input: OkrConversationRequest): OkrConversationResult {
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);
    const baseDraft = input.draft ? normalizeDraftShape(input.draft, timeframe) : this.generate(input);
    const lastUserMessage = [...sanitizeMessages(input.messages)].reverse().find((message) => message.role === 'user');
    const instruction = (lastUserMessage?.content || '').toLowerCase();

    const revisedDraft: OkrDraft = {
      ...baseDraft,
      keyResults: baseDraft.keyResults.map((kr) => ({ ...kr }))
    };

    const shouldProbe =
      !instruction ||
      ((instruction.includes('help') || instruction.includes('what should') || instruction.includes('not sure')) &&
        !/\d/.test(instruction));

    if (shouldProbe) {
      const questions = [
        'What is the single business outcome this objective must move this quarter (e.g. revenue, retention, activation)?',
        'What are your current baseline values for the top 1–2 KRs so we can set realistic stretch targets?' 
      ];

      return {
        assistantMessage: 'Before I rewrite, I need two quick answers so I can coach this properly and set measurable targets.',
        mode: 'questions',
        questions,
        rationale: ['Missing baseline/priority context.', 'Avoiding vague targets or random ambition levels.'],
        draft: normalizeDraftShape(revisedDraft, timeframe),
        metadata: {
          source: 'fallback',
          provider: 'deterministic',
          reason: 'llm_unavailable',
          durationMs: 0
        }
      };
    }

    if (instruction.includes('measurable')) {
      revisedDraft.keyResults = revisedDraft.keyResults.map((kr) => ({
        ...kr,
        title: kr.title.includes('(measured weekly)') ? kr.title : `${kr.title} (measured weekly)`
      }));
    }

    if (instruction.includes('less ambitious') || instruction.includes('reduce ambition')) {
      revisedDraft.keyResults = revisedDraft.keyResults.map((kr) => ({
        ...kr,
        targetValue: Math.max(1, Math.round(kr.targetValue * 0.8))
      }));
    }

    if (instruction.includes('objective') && (instruction.includes('rewrite') || instruction.includes('outcome'))) {
      revisedDraft.objective = revisedDraft.objective.startsWith('Achieve ')
        ? revisedDraft.objective
        : `Achieve ${revisedDraft.objective.charAt(0).toLowerCase()}${revisedDraft.objective.slice(1)}`;
    }

    return {
      assistantMessage:
        lastUserMessage?.content
          ? `Updated. I applied your latest instruction: "${lastUserMessage.content}".`
          : 'I can help refine this draft. Tell me what to change (e.g. “make KR2 more measurable” or “reduce ambition by 20%”).',
      mode: 'refine',
      rationale: ['Applied requested refinement with minimal draft changes.', 'Kept KRs measurable and realistic.'],
      draft: normalizeDraftShape(revisedDraft, timeframe),
      metadata: {
        source: 'fallback',
        provider: 'deterministic',
        reason: 'llm_unavailable',
        durationMs: 0
      }
    };
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
  private async complete(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error('missing_openai_api_key');
    }

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
          messages
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
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generate(input: OkrDraftRequest): Promise<OkrDraft> {
    const focus = capText(input.focusArea, DEFAULT_FOCUS);
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);

    const content = await this.complete([
      {
        role: 'system',
        content:
          'You draft OKRs. Return JSON only with keys: objective (string), timeframe (string), keyResults (array of 3 objects: title, targetValue, currentValue, unit).'
      },
      {
        role: 'user',
        content: `Focus area: ${focus}\nTimeframe: ${timeframe}`
      }
    ]);

    return normalizeDraftShape(extractJsonObject(content), timeframe);
  }

  async continueConversation(input: OkrConversationRequest): Promise<OkrConversationResult> {
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);
    const safeMessages = sanitizeMessages(input.messages);
    const baseDraft = input.draft ? normalizeDraftShape(input.draft, timeframe) : await this.generate(input);

    const content = await this.complete([
      {
        role: 'system',
        content:
          'You are an OKR coaching copilot. Help users produce focused, measurable, realistic-but-ambitious OKRs through iterative conversation. If critical context is missing, ask up to 2 concise probing questions before major rewrites. Reject vague language unless quantified. Return JSON only with keys: assistantMessage (string), mode ("questions"|"refine"), questions (string[]), rationale (string[] max 3), and draft (object with objective, timeframe, keyResults[{title,targetValue,currentValue,unit}]). Keep edits minimal unless asked for a reset.'
      },
      {
        role: 'user',
        content: `Current draft JSON:\n${JSON.stringify(baseDraft)}`
      },
      ...safeMessages.map((message) => ({ role: message.role, content: message.content }))
    ]);

    const payload = extractJsonObject(content) as {
      assistantMessage?: unknown;
      mode?: unknown;
      questions?: unknown;
      rationale?: unknown;
      draft?: unknown;
    };

    const questions = Array.isArray(payload.questions)
      ? payload.questions.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 2)
      : [];

    const rationale = Array.isArray(payload.rationale)
      ? payload.rationale.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 3)
      : [];

    return {
      assistantMessage:
        typeof payload.assistantMessage === 'string' && payload.assistantMessage.trim()
          ? payload.assistantMessage.trim().slice(0, 1000)
          : 'I revised the draft. Tell me the next refinement you want.',
      mode: payload.mode === 'questions' ? 'questions' : 'refine',
      questions,
      rationale,
      draft: normalizeDraftShape(payload.draft ?? baseDraft, timeframe),
      metadata: {
        source: 'llm',
        provider: 'openai',
        model: getOpenAiModel(),
        durationMs: 0
      }
    };
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

  async continueConversation(input: OkrConversationRequest): Promise<OkrConversationResult> {
    const startedAt = Date.now();

    try {
      const result = await this.llmProvider.continueConversation(input);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          durationMs: Date.now() - startedAt
        }
      };
    } catch (error: any) {
      const fallback = this.fallbackProvider.continueConversation(input);
      return {
        ...fallback,
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
