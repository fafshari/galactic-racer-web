// Which panels a visitor has collapsed, remembered in the browser. A UI preference only; nothing depends on it.

export const COLLAPSED_KEY = 'swgr-collapsed';

/** Reads the saved list; anything unreadable means nothing is collapsed. */
export function parseCollapsed(raw: unknown): Set<string> {
  return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
}

/** The list with one panel's state set. */
export function setCollapsed(current: ReadonlySet<string>, key: string, collapsed: boolean): string[] {
  const next = new Set(current);
  if (collapsed) next.add(key);
  else next.delete(key);
  return [...next].sort();
}
