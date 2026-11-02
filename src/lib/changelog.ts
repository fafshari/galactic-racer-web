// Reads CHANGELOG.md (ADR 0018) into releases for the site's "What's new" page. Only the small Markdown subset the
// changelog uses is understood; anything else throws, so the unit test catches it before it reaches the page.

export type ChangeText =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'link'; text: string; href: string };

export interface ChangeGroup {
  /** "Added", "Fixed", or an area such as "Build planner". */
  title: string;
  items: ChangeText[][];
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  /** Paragraphs before the first group. */
  summary: ChangeText[][];
  groups: ChangeGroup[];
}

const RELEASE = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;
const GROUP = /^### (.+)$/;
const ITEM = /^- (.+)$/;
const LINK_DEFINITION = /^\[[^\]]+\]: \S+$/;
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;

/** Splits one line into plain text, `code`, **bold** and [links](url). */
export function parseInline(line: string): ChangeText[] {
  const runs: ChangeText[] = [];
  let at = 0;
  for (const m of line.matchAll(INLINE)) {
    if (m.index > at) runs.push({ kind: 'text', text: line.slice(at, m.index) });
    const [whole, linkText, href, code, strong] = m;
    if (linkText !== undefined && href !== undefined) runs.push({ kind: 'link', text: linkText, href });
    else if (code !== undefined) runs.push({ kind: 'code', text: code });
    else if (strong !== undefined) runs.push({ kind: 'strong', text: strong });
    at = m.index + whole.length;
  }
  if (at < line.length) runs.push({ kind: 'text', text: line.slice(at) });
  return runs;
}

/** The releases in a Keep a Changelog file, newest first as written. The intro above the first release is skipped. */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let group: ChangeGroup | undefined;

  for (const [i, raw] of markdown.split(/\r?\n/).entries()) {
    const line = raw.trimEnd();
    const where = `CHANGELOG.md line ${String(i + 1)}`;
    const head = RELEASE.exec(line);
    if (head) {
      const [, version = '', date = ''] = head;
      release = { version, date, summary: [], groups: [] };
      group = undefined;
      releases.push(release);
      continue;
    }
    if (line === '' || !release) continue;
    if (LINK_DEFINITION.test(line)) break;
    if (line.startsWith('## ')) throw new Error(`${where}: a release heading must read "## [x.y.z] - YYYY-MM-DD"`);

    const groupHead = GROUP.exec(line);
    const item = ITEM.exec(line);
    if (groupHead) {
      group = { title: groupHead[1] ?? '', items: [] };
      release.groups.push(group);
    } else if (item) {
      if (!group) throw new Error(`${where}: list items belong under a ### group`);
      group.items.push(parseInline(item[1] ?? ''));
    } else if (/^[\s#>*|-]/.test(line)) {
      throw new Error(`${where}: only ### groups, "- " items and plain paragraphs are supported`);
    } else if (group) {
      throw new Error(`${where}: paragraphs go before the first ### group`);
    } else {
      release.summary.push(parseInline(line));
    }
  }
  return releases;
}

/** "2026-11-02" → "2 November 2026", without depending on the build machine's time zone. */
export function formatReleaseDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
