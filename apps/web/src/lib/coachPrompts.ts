const MAX_CHIPS = 3;
const MAX_CHIP_WORDS = 5;
const MAX_CHIP_CHARS = 36;

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function toFewWords(text: string): string {
  const clean = compact(text.replace(/[?.!,:;]+$/g, ''));
  const words = clean.split(' ').filter(Boolean).slice(0, MAX_CHIP_WORDS);
  return words.join(' ').slice(0, MAX_CHIP_CHARS).trim();
}

function scoreCandidate(raw: string): number {
  const lower = raw.toLowerCase();
  let score = 0;
  if (/\b(use estimate|draft now|quick draft|share example)\b/.test(lower)) score += 3;
  if (/\bbaseline|target|timeframe|constraint|why\b/.test(lower)) score += 2;
  if (raw.split(' ').length <= MAX_CHIP_WORDS) score += 1;
  return score;
}

export function buildCoachPromptChips(input: { questions?: string[]; assistantMessage?: string }): string[] {
  const candidates = (input.questions ?? [])
    .map(toFewWords)
    .filter((chip) => chip.length >= 3)
    .filter((chip) => chip.split(' ').length <= MAX_CHIP_WORDS)
    .filter((chip) => !/^(i|we|you|let's)\b/i.test(chip))
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
