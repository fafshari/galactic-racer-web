import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { latestChangelogVersion, siteVersion } from './version';

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('site version', () => {
  it('matches the newest CHANGELOG.md heading', () => {
    expect(latestChangelogVersion(read('CHANGELOG.md'))).toBe(siteVersion);
  });

  it('matches the lockfile', () => {
    const lock: unknown = JSON.parse(read('package-lock.json'));
    expect(lock).toMatchObject({ version: siteVersion });
  });

  it('is a plain x.y.z version', () => {
    expect(siteVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('latestChangelogVersion', () => {
  it('takes the first version heading, skipping link definitions', () => {
    const md = '# Changelog\n\n## [2.1.0] - 2026-12-01\n\n## [2.0.0] - 2026-11-30\n\n[2.1.0]: https://example.com\n';
    expect(latestChangelogVersion(md)).toBe('2.1.0');
  });

  it('returns null without a version heading', () => {
    expect(latestChangelogVersion('# Changelog\n')).toBeNull();
  });
});
