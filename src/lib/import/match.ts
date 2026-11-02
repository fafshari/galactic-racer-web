// Fuzzy matching of OCR text against the game's names (ADR 0016). The names are a closed list, so a misread
// letter or two still lands on the right item.

/** Upper-case letters, digits and single spaces; OCR's usual roman-numeral misreads ("|", "Ill", "1I") become I. */
export function normalise(text: string): string {
  const words = text
    .toUpperCase()
    .replace(/[’'`]/g, '')
    .replace(/[^A-Z0-9|!]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
  const last = words.at(-1);
  if (last !== undefined && words.length > 1 && /^[IL1|!]{1,3}V?$|^[IL1|!]?V$/.test(last)) words[words.length - 1] = last.replace(/[L1|!]/g, 'I');
  return words.join(' ').replace(/[|!]/g, 'I');
}

/** Edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row.push(Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

/** 0–1: 1 when the normalised strings are equal. */
export function similarity(a: string, b: string): number {
  const x = normalise(a);
  const y = normalise(b);
  const len = Math.max(x.length, y.length);
  return len === 0 ? 0 : 1 - levenshtein(x, y) / len;
}

export interface Scored<T> {
  item: T;
  score: number;
}

/** Every candidate scored against the text, best first. `bonus` lets other evidence nudge the ranking. */
export function rank<T>(text: string, items: readonly T[], name: (item: T) => string, bonus: (item: T) => number = () => 0): Scored<T>[] {
  return items.map((item) => ({ item, score: similarity(text, name(item)) + bonus(item) })).sort((a, b) => b.score - a.score);
}

/**
 * How sure a match is, 0–1. It needs a close match and a clear lead over the runner-up: two names that differ
 * only in their numeral ("Repulsormod II" / "III") leave a small lead, so those come out less certain.
 */
export function confidenceOf(ranked: readonly Scored<unknown>[]): number {
  const [first, second] = ranked;
  if (!first || first.score < 0.5) return 0;
  const lead = first.score - (second?.score ?? 0);
  return Math.min(1, first.score) * (0.55 + 0.45 * Math.min(1, lead / 0.15));
}
