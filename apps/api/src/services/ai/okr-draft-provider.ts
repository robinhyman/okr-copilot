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

export interface OkrCoachingContext {
  outcome?: string;
  strategicWhy?: string;
  baseline?: string;
  constraints?: string;
  timeframe?: string;
}

export interface OkrConversationResult {
  assistantMessage: string;
  mode?: 'questions' | 'refine';
  questions?: string[];
  rationale?: string[];
  coachingContext?: OkrCoachingContext;
  missingContext?: string[];
  draft: OkrDraft;
  metadata: OkrDraftMetadata;
}

export interface OkrWizardDraftRequest {
  focusArea: string;
  timeframe: string;
  baseline: string;
  baselineStructured?: {
    value?: number;
    unit?: string;
    period?: string;
  };
  constraints: string;
  objectiveStatement: string;
  keyResultCount?: number;
  aiAssist?: boolean;
}

export interface OkrDraftProvider {
  generateDraft(input: OkrDraftRequest): Promise<OkrDraftResult>;
  continueConversation(input: OkrConversationRequest): Promise<OkrConversationResult>;
  generateWizardDraft(input: OkrWizardDraftRequest): Promise<OkrDraftResult>;
}

const DEFAULT_TIMEFRAME = 'Q2 2026';
const DEFAULT_FOCUS = 'priority area';
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
    objective: (objectiveRaw.trim() || 'Define a measurable outcome for this period').slice(0, 200),
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

function extractCoachingContext(messages: OkrConversationMessage[], timeframeFallback: string): OkrCoachingContext {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  const lower = userText.toLowerCase();

  const outcomeMatch = userText.match(/(?:outcome|goal|achieve|want to|improve|reduce|increase)[:\- ]+(.+)/i);
  const strategicWhyMatch = userText.match(/(?:because|so that|in order to|why)[:\- ]+(.+)/i)
    || userText.match(/(?:market\s+share|competitive|competition|cost|margin|retention|churn|revenue|nps|customer\s+experience|time[-\s]?to[-\s]?market|win\s+rate)/i);
  const baselineMatch = userText.match(/(?:baseline|current|currently|from)[:\- ]+(.+)/i);
  const constraintsMatch = userText.match(/(?:constraint|constraints|limit|team|budget|time)[:\- ]+(.+)/i);
  const timeframeMatch = userText.match(/(?:q[1-4]\s*20\d\d|this quarter|this month|\d+\s*(?:weeks?|months?))/i);

  return {
    outcome: outcomeMatch?.[1]?.trim() || (lower.includes('increase') || lower.includes('reduce') || lower.includes('improve') ? userText.slice(0, 120) : undefined),
    strategicWhy: typeof strategicWhyMatch?.[0] === 'string' ? strategicWhyMatch[0].trim().slice(0, 160) : undefined,
    baseline: baselineMatch?.[1]?.trim() || (/(from\s+\d+)|(current\s+\d+)/i.test(userText) ? userText.slice(0, 120) : undefined),
    constraints: constraintsMatch?.[1]?.trim() || (/(team|budget|time|resource)/i.test(userText) ? userText.slice(0, 120) : undefined),
    timeframe: timeframeMatch?.[0]?.trim() || timeframeFallback
  };
}

function getMissingContext(ctx: OkrCoachingContext): string[] {
  const missing: string[] = [];
  if (!ctx.outcome) missing.push('outcome');
  if (!ctx.baseline) missing.push('baseline');
  if (!ctx.constraints) missing.push('constraints');
  if (!ctx.timeframe) missing.push('timeframe');
  return missing;
}

type RequiredContextField = 'outcome' | 'strategicWhy' | 'baseline' | 'target' | 'constraints' | 'timeframe';

function extractTargetIntent(messages: OkrConversationMessage[]): string | undefined {
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const targetMatch = userText.match(/(?:target|goal|increase|decrease|reduce|improve|want|aim).{0,30}(?:\d+(?:\.\d+)?\s*%?|\d+\s*(?:days?|hours?|weeks?|months?))/i)
    || userText.match(/(?:by\s+(?:end\s+of\s+)?q[1-4]|by\s+\w+\s+\d{4}|within\s+\d+\s*(?:days?|weeks?|months?))/i);
  return targetMatch?.[0];
}

function getMissingChecklist(ctx: OkrCoachingContext, target?: string): RequiredContextField[] {
  const missing: RequiredContextField[] = [];
  if (!ctx.outcome) missing.push('outcome');
  if (!ctx.strategicWhy) missing.push('strategicWhy');
  if (!ctx.baseline) missing.push('baseline');
  if (!target) missing.push('target');
  if (!ctx.constraints) missing.push('constraints');
  if (!ctx.timeframe) missing.push('timeframe');
  return missing;
}

function missingFieldQuestion(field: RequiredContextField): string {
  if (field === 'outcome') return 'What area or result do you most want this OKR to improve?';
  if (field === 'strategicWhy') return 'Why does improving this matter strategically right now (e.g., competitiveness, cost, market share, customer experience)?';
  if (field === 'baseline') return 'What’s your current baseline metric and value?';
  if (field === 'target') return 'What target value do you want by when?';
  if (field === 'constraints') return 'What constraints should we respect?';
  return 'What timeframe should we commit this OKR to?';
}

function normalizeMessageKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function ensureNonLoopingAssistantMessage(input: {
  proposed: string;
  messages: OkrConversationMessage[];
  missingChecklist: RequiredContextField[];
}): string {
  const lastAssistant = [...input.messages].reverse().find((m) => m.role === 'assistant')?.content;
  const proposed = input.proposed.trim();
  if (!lastAssistant) return proposed;
  if (normalizeMessageKey(lastAssistant) !== normalizeMessageKey(proposed)) return proposed;

  const missing = input.missingChecklist[0];
  if (missing) return `${missingFieldQuestion(missing)} Please include concrete numbers where possible.`;
  return `${proposed} Tell me one specific refinement to apply next.`;
}

function removeIncongruousOpener(message: string): string {
  const trimmed = message.trim();
  return trimmed
    .replace(/^(great|awesome|perfect|excellent|nice)[,!\s]+/i, '')
    .replace(/^(thanks|thank you)[,!\s]+(great|awesome|perfect|excellent|nice)[,!\s]+/i, 'Thanks. ')
    .trim();
}

function enforceAssistantBrevity(message: string, maxLength = 320): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  const shortened = compact.slice(0, maxLength);
  const safeBoundary = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf('? '), shortened.lastIndexOf('! '));
  if (safeBoundary > 80) return `${shortened.slice(0, safeBoundary + 1).trim()}`;
  return `${shortened.trimEnd()}…`;
}

function normalizeAssistantMessage(message: string): string {
  const withoutOpener = removeIncongruousOpener(message);
  const withFallback = withoutOpener || 'Let’s start with one key clarification before drafting.';
  return enforceAssistantBrevity(withFallback);
}

function isKrFormatValid(title: string): boolean {
  return /^(increase|decrease|reduce|grow|improve)\s.+\sfrom\s.+\sto\s.+$/i.test(title.trim());
}

function parseBaselineNumber(baseline: string, fallback: number): number {
  const match = baseline.match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseUnit(text: string): string {
  const lowered = text.toLowerCase();
  if (lowered.includes('%') || lowered.includes('percent')) return '%';
  if (lowered.includes('day')) return 'days';
  if (lowered.includes('hour')) return 'hours';
  if (lowered.includes('week')) return 'weeks';
  if (lowered.includes('month')) return 'months';
  if (lowered.includes('revenue') || lowered.includes('£') || lowered.includes('gbp')) return 'GBP';
  if (lowered.includes('customer')) return 'customers';
  return 'points';
}

class DeterministicDraftProvider {
  generate(input: OkrDraftRequest): OkrDraft {
    const hasFocus = typeof input.focusArea === 'string' && input.focusArea.trim().length > 0;
    const focus = capText(input.focusArea, DEFAULT_FOCUS);
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);

    return normalizeDraftShape(
      {
        objective: hasFocus ? `Improve ${focus.toLowerCase()} outcomes` : 'Define a measurable outcome for this period',
        timeframe,
        keyResults: [
          {
            title: `Increase repeatable ${focus.toLowerCase()} playbooks from 0 to 2`,
            targetValue: 2,
            currentValue: 0,
            unit: 'playbooks'
          },
          { title: 'Increase stakeholder satisfaction score from 5 to 8', targetValue: 8, currentValue: 5, unit: '/10' },
          { title: 'Reduce cycle time from 20 to 12', targetValue: 12, currentValue: 20, unit: 'days' }
        ]
      },
      timeframe
    );
  }

  generateFromWizard(input: OkrWizardDraftRequest): OkrDraft {
    const focusArea = capText(input.focusArea, DEFAULT_FOCUS);
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);
    const baseline = capText(input.baseline, 'Baseline unknown');
    const constraints = capText(input.constraints, 'Keep scope realistic for current team capacity');
    const objectiveStatement = capText(input.objectiveStatement, `Improve ${focusArea.toLowerCase()} outcomes`);
    const structuredUnit = input.baselineStructured?.unit?.trim();
    const structuredValue = Number(input.baselineStructured?.value);
    const structuredPeriod = input.baselineStructured?.period?.trim();
    const unit = structuredUnit || parseUnit(`${baseline} ${objectiveStatement}`);
    const baselineValue = Number.isFinite(structuredValue)
      ? structuredValue
      : parseBaselineNumber(baseline, unit === '%' ? 40 : 1);
    const keyResultCount = Math.max(2, Math.min(5, Number(input.keyResultCount) || 3));

    const multipliers = [1.2, 1.35, 1.5, 1.15, 1.25];
    const keyResults = Array.from({ length: keyResultCount }, (_, index) => {
      const target = unit === 'days'
        ? Math.max(1, Math.round(baselineValue * (1 - Math.min(0.4, (index + 1) * 0.1))))
        : Math.round((baselineValue * multipliers[index]) * 100) / 100;
      const titleSuffix = structuredPeriod ? ` per ${structuredPeriod}` : '';
      const title = unit === 'days'
        ? `Reduce ${focusArea.toLowerCase()} cycle time from ${baselineValue}${titleSuffix} to ${target}${titleSuffix}`
        : `Increase ${focusArea.toLowerCase()} outcome metric ${index + 1} from ${baselineValue}${titleSuffix} to ${target}${titleSuffix}`;

      return {
        title,
        currentValue: baselineValue,
        targetValue: target,
        unit
      };
    });

    return normalizeDraftShape(
      {
        objective: `${objectiveStatement} (${constraints})`,
        timeframe,
        keyResults
      },
      timeframe
    );
  }

  continueConversation(input: OkrConversationRequest): OkrConversationResult {
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);
    const baseDraft = input.draft ? normalizeDraftShape(input.draft, timeframe) : this.generate(input);
    const safeMessages = sanitizeMessages(input.messages);
    const lastUserMessage = [...safeMessages].reverse().find((message) => message.role === 'user');
    const instruction = (lastUserMessage?.content || '').toLowerCase();
    const coachingContext = extractCoachingContext(safeMessages, timeframe);
    const targetIntent = extractTargetIntent(safeMessages);
    const missingChecklist = getMissingChecklist(coachingContext, targetIntent);
    const missingContext = missingChecklist.map((field) => (field === 'target' ? 'target_value' : field));

    const revisedDraft: OkrDraft = {
      ...baseDraft,
      timeframe: coachingContext.timeframe || baseDraft.timeframe,
      keyResults: baseDraft.keyResults.map((kr) => ({ ...kr }))
    };

    const shouldProbe = missingChecklist.length > 0;

    if (shouldProbe) {
      const questions = missingChecklist.map(missingFieldQuestion).slice(0, 2);
      return {
        assistantMessage: normalizeAssistantMessage(ensureNonLoopingAssistantMessage({
          proposed: questions[0] ?? 'Share more detail so I can produce a measurable OKR draft.',
          messages: safeMessages,
          missingChecklist
        })),
        mode: 'questions',
        questions,
        rationale: ['Coaching-first flow keeps first draft grounded in real constraints and baselines.'],
        coachingContext,
        missingContext,
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

    revisedDraft.keyResults = revisedDraft.keyResults.map((kr) => {
      if (isKrFormatValid(kr.title)) return kr;
      return {
        ...kr,
        title: `Increase ${kr.title.replace(/^(increase|decrease|reduce|grow|improve)\s+/i, '').toLowerCase()} from ${kr.currentValue} to ${kr.targetValue}`
      };
    });

    const invalidFormat = revisedDraft.keyResults.filter((kr) => !isKrFormatValid(kr.title));
    if (invalidFormat.length) {
      return {
        assistantMessage: normalizeAssistantMessage('Before first draft, I need to tighten KR wording to measurable format.'),
        mode: 'questions',
        questions: ['Please confirm each KR should be phrased as: <direction> <metric> from <baseline> to <target>.'],
        rationale: ['Enforcing measurable KR structure.'],
        coachingContext,
        missingContext: [],
        draft: normalizeDraftShape(revisedDraft, timeframe),
        metadata: {
          source: 'fallback',
          provider: 'deterministic',
          reason: 'quality_gate_failed',
          durationMs: 0
        }
      };
    }

    const refinedMessage = lastUserMessage?.content
      ? `Updated. I applied your latest instruction: "${lastUserMessage.content}".`
      : 'I have a complete draft. Tell me what to refine (for example: tighten KR2 or adjust ambition).';

    return {
      assistantMessage: normalizeAssistantMessage(ensureNonLoopingAssistantMessage({
        proposed: refinedMessage,
        messages: safeMessages,
        missingChecklist: []
      })),
      mode: 'refine',
      rationale: ['Applied requested refinement with minimal draft changes.', 'Kept KRs measurable and realistic.'],
      coachingContext,
      missingContext: [],
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
    const hasFocus = typeof input.focusArea === 'string' && input.focusArea.trim().length > 0;
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
        content: hasFocus ? `Focus area: ${focus}\nTimeframe: ${timeframe}` : `Focus area: (user has not specified yet)\nTimeframe: ${timeframe}`
      }
    ]);

    return normalizeDraftShape(extractJsonObject(content), timeframe);
  }

  async generateFromWizard(input: OkrWizardDraftRequest): Promise<OkrDraft> {
    const timeframe = capText(input.timeframe, DEFAULT_TIMEFRAME);
    const content = await this.complete([
      {
        role: 'system',
        content:
          'You draft final OKRs from deterministic wizard inputs. Return JSON only with keys objective, timeframe, keyResults[title,targetValue,currentValue,unit]. KR titles must follow: <direction> <metric> from <baseline> to <target>.'
      },
      {
        role: 'user',
        content: `focusArea: ${capText(input.focusArea, DEFAULT_FOCUS)}\ntimeframe: ${timeframe}\nbaseline: ${capText(input.baseline, 'unknown')}\nbaselineValue: ${Number(input.baselineStructured?.value)}\nbaselineUnit: ${capText(input.baselineStructured?.unit, 'unknown')}\nbaselinePeriod: ${capText(input.baselineStructured?.period, 'unknown')}\nconstraints: ${capText(input.constraints, 'none')}\nobjectiveStatement: ${capText(input.objectiveStatement, '')}\nkeyResultCount: ${Math.max(2, Math.min(5, Number(input.keyResultCount) || 3))}`
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
          'You are an OKR design coach for leaders. Your job is to run a structured coaching conversation that produces strong, measurable OKRs (not generic drafts). Strict interaction rules: ask exactly ONE question at a time, wait for user input, and work on ONE OKR at a time. Start each new session by clarifying intent and scope before measurement: ask whether the user wants to create company, department/team, or single-OKR work, or review/critique an existing OKR. If user asks for multiple OKRs, guide back to one objective at a time. Use this sequence strictly: Pass 1 Outcome + Strategic Intent, Pass 2 Measurement Discovery, Pass 3 Draft + Stress Test. Pass 1 must be completed before Pass 2: confirm strategic priority, business problem, desired behavior/performance change, who benefits, and why now. Do not draft objective or KRs until Pass 1 is clear. If objective is tactical/incremental, challenge constructively and refine toward meaningful outcome. Objective must be qualitative, strategic, precise; objective format target: We will <objective> in order to <strategic purpose>. Pass 2: identify 2-4 candidate outcome metrics before final KR selection; prefer customer/business/operational outcomes, reject activity metrics. Capture baseline + target + timeframe + constraints for selected metrics. If baseline unknown, ask for it; if unavailable, mark baseline as TBD with a concrete measurement plan or proxy. Pass 3: draft and stress-test. KR titles must follow: <direction> <metric> from <from-value> to <to-value>. Build a balanced KR set with at least one lagging outcome KR, one leading indicator KR, and one guardrail KR. Reject weak KRs (unclear metric or missing baseline/target). Run Goodhart/Campbell risk check and suggest complementary metrics when gaming/distortion risk exists. Present draft in this structure inside rationale/draft fields: objective, short strategic rationale, KRs, risk notes, and optional initiatives explicitly labeled as not part of OKR. Keep tone calm, direct, practical; avoid enthusiastic filler unless user uses it first. Keep assistantMessage concise for mobile: in questions mode, one clear question plus at most one short sentence; in refine mode, max 3 short sentences. Put detail in rationale, not assistantMessage. Avoid repetition and never ask the same question verbatim in consecutive turns. Return JSON only with keys: assistantMessage (string), mode ("questions"|"refine"), questions (string[]), rationale (string[] max 5), coachingContext (object with outcome, strategicWhy, baseline, constraints, timeframe), missingContext (string[]), and draft (object with objective, timeframe, keyResults[{title,targetValue,currentValue,unit}]). Keep edits minimal unless user asks for reset.'
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
      coachingContext?: unknown;
      missingContext?: unknown;
      draft?: unknown;
    };

    const questions = Array.isArray(payload.questions)
      ? payload.questions.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 2)
      : [];

    const rationale = Array.isArray(payload.rationale)
      ? payload.rationale.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 3)
      : [];

    const coachingContextRaw = payload.coachingContext && typeof payload.coachingContext === 'object'
      ? (payload.coachingContext as Record<string, unknown>)
      : {};

    const coachingContext: OkrCoachingContext = {
      outcome: typeof coachingContextRaw.outcome === 'string' ? coachingContextRaw.outcome : undefined,
      strategicWhy: typeof coachingContextRaw.strategicWhy === 'string' ? coachingContextRaw.strategicWhy : undefined,
      baseline: typeof coachingContextRaw.baseline === 'string' ? coachingContextRaw.baseline : undefined,
      constraints: typeof coachingContextRaw.constraints === 'string' ? coachingContextRaw.constraints : undefined,
      timeframe: typeof coachingContextRaw.timeframe === 'string' ? coachingContextRaw.timeframe : undefined
    };

    const normalizedDraft = normalizeDraftShape(payload.draft ?? baseDraft, timeframe);
    const inferredContext = { ...extractCoachingContext(safeMessages, timeframe), ...coachingContext };
    const targetIntent = extractTargetIntent(safeMessages);
    const missingChecklist = getMissingChecklist(inferredContext, targetIntent);
    const missingContext = Array.isArray(payload.missingContext)
      ? payload.missingContext.filter((m): m is string => typeof m === 'string').slice(0, 6)
      : missingChecklist.map((field) => (field === 'target' ? 'target_value' : field));

    const hasBadKrFormat = normalizedDraft.keyResults.some((kr) => !isKrFormatValid(kr.title));
    const gatedMode = missingChecklist.length > 0 || hasBadKrFormat ? 'questions' : payload.mode === 'questions' ? 'questions' : 'refine';

    const assistantMessageRaw =
      typeof payload.assistantMessage === 'string' && payload.assistantMessage.trim()
        ? payload.assistantMessage.trim().slice(0, 1000)
        : gatedMode === 'questions'
          ? missingFieldQuestion(missingChecklist[0] ?? 'outcome')
          : 'I revised the draft. Tell me the next refinement you want.';

    return {
      assistantMessage: normalizeAssistantMessage(ensureNonLoopingAssistantMessage({
        proposed: assistantMessageRaw,
        messages: safeMessages,
        missingChecklist
      })),
      mode: gatedMode,
      questions:
        gatedMode === 'questions' && questions.length === 0
          ? ['Please provide missing baseline, constraints, and confirm KR format as <direction> <metric> from <from> to <to>.']
          : questions,
      rationale,
      coachingContext,
      missingContext,
      draft: normalizedDraft,
      metadata: {
        source: 'llm',
        provider: 'openai',
        model: getOpenAiModel(),
        durationMs: 0
      }
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableLlmError(error: any): boolean {
  const message = String(error?.message ?? '');
  return (
    error?.name === 'AbortError' ||
    message.startsWith('openai_http_429') ||
    message.startsWith('openai_http_500') ||
    message.startsWith('openai_http_502') ||
    message.startsWith('openai_http_503') ||
    message.startsWith('openai_http_504')
  );
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

  async generateWizardDraft(input: OkrWizardDraftRequest): Promise<OkrDraftResult> {
    const startedAt = Date.now();

    if (input.aiAssist) {
      try {
        const draft = await this.llmProvider.generateFromWizard(input);
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
        const fallbackDraft = this.fallbackProvider.generateFromWizard(input);
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

    return {
      draft: this.fallbackProvider.generateFromWizard(input),
      metadata: {
        source: 'fallback',
        provider: 'deterministic',
        reason: 'ai_assist_disabled',
        durationMs: Date.now() - startedAt
      }
    };
  }

  async continueConversation(input: OkrConversationRequest): Promise<OkrConversationResult> {
    const startedAt = Date.now();

    let lastError: any = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
        lastError = error;
        const retryable = isRetryableLlmError(error);
        if (!retryable || attempt === maxAttempts) break;
        await sleep(350 * attempt);
      }
    }

    const fallback = this.fallbackProvider.continueConversation(input);
    return {
      ...fallback,
      metadata: {
        source: 'fallback',
        provider: 'deterministic',
        reason: lastError?.name === 'AbortError' ? 'llm_timeout' : (lastError?.message ?? 'llm_failed'),
        durationMs: Date.now() - startedAt
      }
    };
  }
}

export function createOkrDraftProvider(): OkrDraftProvider {
  return new ResilientDraftProvider();
}
