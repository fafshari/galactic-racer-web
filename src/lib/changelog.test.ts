import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatReleaseDate, parseChangelog, parseInline } from './changelog';

const sample = `# Changelog

Intro with a [link](docs/x.md), skipped.

## [1.1.0] - 2026-12-01

A summary paragraph.

### Added

- A **new** page with \`code\` and a [link](https://example.com/1). ([#30](https://example.com/30))

### Fixed

- Something.

## [1.0.0] - 2026-11-02

### Changed

- Old.

[1.1.0]: https://example.com/compare
[1.0.0]: https://example.com/tag
`;

describe('parseChangelog', () => {
  it('reads releases, summaries, groups and items, newest first', () => {
    const releases = parseChangelog(sample);
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ['1.1.0', '2026-12-01'],
      ['1.0.0', '2026-11-02'],
    ]);
    const [latest] = releases;
    expect(latest?.summary).toEqual([[{ kind: 'text', text: 'A summary paragraph.' }]]);
    expect(latest?.groups.map((g) => [g.title, g.items.length])).toEqual([
      ['Added', 1],
      ['Fixed', 1],
    ]);
  });

  it('rejects Markdown the page can’t show', () => {
    const at = (body: string) => () => parseChangelog(`## [1.0.0] - 2026-11-02\n\n${body}\n`);
    expect(at('- an item without a group')).toThrow(/under a ### group/);
    expect(at('### Added\n\n- item\n  - nested')).toThrow(/line 6/);
    expect(at('### Added\n\nA paragraph after a group')).toThrow(/before the first ### group/);
    expect(() => parseChangelog('## 1.0.0\n')).not.toThrow();
    expect(() => parseChangelog('## [1.0.0] - 2026-11-02\n\n## Unreleased\n')).toThrow(/release heading/);
  });

  it('reads the real changelog', () => {
    const releases = parseChangelog(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'));
    expect(releases.length).toBeGreaterThan(0);
    for (const r of releases) expect(r.groups.length).toBeGreaterThan(0);
  });
});

describe('parseInline', () => {
  it('splits text, bold, code and links', () => {
    expect(parseInline('A **b** `c` [d](https://e) f')).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'strong', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'd', href: 'https://e' },
      { kind: 'text', text: ' f' },
    ]);
  });
});

it('formats release dates in words', () => {
  expect(formatReleaseDate('2026-11-02')).toBe('2 November 2026');
});
