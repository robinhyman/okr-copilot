const MAX_CHIPS = 3;
const MIN_CHIP_WORDS = 1;
const MAX_CHIP_WORDS = 5;
const MAX_CHIP_CHARS = 36;

const STRATEGIC_FALLBACKS = {
  default: ['Improve outcomes', 'Reduce customer issues', 'Other focus'],
  delivery: ['Speed up delivery', 'Improve quality', 'Other focus'],
  quality: ['Improve quality', 'Reduce customer issues', 'Other focus'],
  cost: ['Lower cost to serve', 'Improve quality', 'Other focus'],
  customer: ['Reduce customer issues', 'Improve quality', 'Other focus']
} as const;

const STRATEGIC_OPTION_CHIPS = [
  {
    key: 'competitiveness',
    label: 'Competitiveness',
    pattern: /\b(competit(?:ive|iveness)|market position|market share|differentiation)\b/i
  },
  {
    key: 'time_to_market',
    label: 'Time-to-market',
    pattern: /(time\s*-?\s*to\s*-?\s*market|\bttm\b|speed\s*to\s*market|faster launches?|launch speed)/i
  },
  {
    key: 'delivery_cost',
    label: 'Delivery cost',
    pattern: /\b(delivery\s*cost|cost\s*to\s*deliver|reduce\s*(delivery\s*)?cost|lower\s*(delivery\s*)?cost|cost\s*efficiency)\b/i
  },
  {
    key: 'customer_responsiveness',
    label: 'Customer responsiveness',
    pattern: /\b(customer\s*responsiveness|customer\s*response|respond\s*to\s*customers?|customer\s*needs?|customer\s*feedback)\b/i
  },
  {
    key: 'quality',
    label: 'Quality',
    pattern: /\b(quality|reliability|defect|rework|stability)\b/i
  }
] as const;

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sanitizeCandidate(text: string): string {
  const compacted = compact(text).replace(/^["'“”‘’\-–—\s]+|["'“”‘’\-–—\s]+$/g, '');
  const withoutTrailPunctuation = compacted.replace(/[?.!,:;]+$/g, '');
  const words = withoutTrailPunctuation.split(' ').filter(Boolean).slice(0, MAX_CHIP_WORDS);
  return words.join(' ').slice(0, MAX_CHIP_CHARS).trim();
}

function isCoachQuestionStem(chip: string): boolean {
  return /^(what|how|which)\b/i.test(chip) || /^can\s+you\b/i.test(chip);
}

function isValidShortcut(chip: string): boolean {
  if (!chip) return false;
  const words = chip.split(/\s+/).filter(Boolean);
  if (words.length < MIN_CHIP_WORDS || words.length > MAX_CHIP_WORDS) return false;
  if (/[?]$/.test(chip)) return false;
  if (isCoachQuestionStem(chip)) return false;
  if (/^(i|we|you|let's)\b/i.test(chip)) return false;
  return true;
}

function scoreCandidate(raw: string): number {
  const lower = raw.toLowerCase();
  let score = 0;
  if (/\b(use estimate|draft now|quick draft|share example|pick baseline)\b/.test(lower)) score += 3;
  if (/\bbaseline|target|timeframe|constraint|why|draft\b/.test(lower)) score += 2;
  if (lower.split(/\s+/).length <= MAX_CHIP_WORDS) score += 1;
  return score;
}

function fallbackKey(input: { assistantMessage?: string; questions?: string[] }): keyof typeof STRATEGIC_FALLBACKS {
  const haystack = `${input.assistantMessage ?? ''} ${(input.questions ?? []).join(' ')}`.toLowerCase();
  if (/\b(delivery|ship|release|cycle time|lead time|execution|throughput|velocity)\b/.test(haystack)) return 'delivery';
  if (/\b(defect|quality|rework|incident|reliability|error)\b/.test(haystack)) return 'quality';
  if (/\b(cost|budget|efficiency|margin|opex|expense|spend)\b/.test(haystack)) return 'cost';
  if (/\b(customer|support|churn|retention|satisfaction|nps|complaint)\b/.test(haystack)) return 'customer';
  return 'default';
}

function strategicFallbacks(input: { assistantMessage?: string; questions?: string[] }): string[] {
  return STRATEGIC_FALLBACKS[fallbackKey(input)]
    .map(sanitizeCandidate)
    .filter(isValidShortcut);
}

function semanticStrategicChips(input: { assistantMessage?: string; questions?: string[] }): string[] {
  const haystack = `${input.assistantMessage ?? ''} ${(input.questions ?? []).join(' ')}`;
  if (!haystack.trim()) return [];

  const matches: Array<{ label: string; index: number; order: number }> = [];
  STRATEGIC_OPTION_CHIPS.forEach((option, index) => {
    const match = option.pattern.exec(haystack);
    if (match) matches.push({ label: option.label, index: match.index, order: index });
  });

  const orderedMatches = matches
    .sort((a, b) => a.index - b.index || a.order - b.order)
    .map((match) => match.label);

  if (orderedMatches.length >= 3 && !orderedMatches.includes('Quality')) {
    orderedMatches.push('Quality');
  }

  const seen = new Set<string>();
  return orderedMatches
    .map(sanitizeCandidate)
    .filter((chip) => isValidShortcut(chip) && !seen.has(chip.toLowerCase()) && seen.add(chip.toLowerCase()));
}

export function buildCoachPromptChips(input: { questions?: string[]; assistantMessage?: string }): string[] {
  const semanticChips = semanticStrategicChips(input).slice(0, MAX_CHIPS);
  if (semanticChips.length > 0) return semanticChips;

  const candidates = (input.questions ?? [])
    .map(sanitizeCandidate)
    .filter(isValidShortcut)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  if (!candidates.length) {
    return strategicFallbacks(input).slice(0, MAX_CHIPS);
  }

  const seen = new Set<string>();
  const chips: string[] = [];
  for (const chip of candidates) {
    const key = chip.toLowerCase();
    if (seen.has(key)) continue;
    if (input.assistantMessage && input.assistantMessage.toLowerCase().includes(key)) continue;
    seen.add(key);
    chips.push(chip);
    if (chips.length >= MAX_CHIPS) break;
  }

  if (!chips.length) {
    return strategicFallbacks(input).slice(0, MAX_CHIPS);
  }

  return chips;
}
