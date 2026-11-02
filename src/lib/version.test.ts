import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';
import { siteVersion } from './version';

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('site version', () => {
  it('matches the newest CHANGELOG.md release', () => {
    expect(parseChangelog(read('CHANGELOG.md'))[0]?.version).toBe(siteVersion);
  });

  it('matches the lockfile', () => {
    const lock: unknown = JSON.parse(read('package-lock.json'));
    expect(lock).toMatchObject({ version: siteVersion });
  });

  it('is a plain x.y.z version', () => {
    expect(siteVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
