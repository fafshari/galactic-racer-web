// Seeded randomness, so a tour run can be replayed from its seed (ADR 0008). Same generator as the legacy simulator.

export type Rng = () => number;

/** mulberry32: a small, fast 32-bit generator; good enough for game-style rolls. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks by weight; null when nothing has weight. */
export function pickWeighted<T>(rand: Rng, items: readonly T[], weight: (x: T) => number): T | null {
  const total = items.reduce((n, x) => n + weight(x), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const x of items) {
    r -= weight(x);
    if (r < 0) return x;
  }
  return items.at(-1) ?? null;
}

export function pickOne<T>(rand: Rng, items: readonly T[]): T | undefined {
  return items[Math.floor(rand() * items.length)];
}

/** A standard normal sample (Box–Muller). */
export function gauss(rand: Rng): number {
  let u = 0;
  let v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
