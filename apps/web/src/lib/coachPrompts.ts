const MAX_CHIPS = 3;
const MIN_CHIP_WORDS = 2;
const MAX_CHIP_WORDS = 5;
const MAX_CHIP_CHARS = 36;

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

export function buildCoachPromptChips(input: { questions?: string[]; assistantMessage?: string }): string[] {
  const candidates = (input.questions ?? [])
    .map(sanitizeCandidate)
    .filter(isValidShortcut)
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

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

  return chips;
}
