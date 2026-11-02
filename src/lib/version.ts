// The site's version (ADR 0018): package.json is the source, CHANGELOG.md must agree.
import pkg from '../../package.json';

export const siteVersion: string = pkg.version;

export const changelogUrl = 'https://github.com/fafshari/galactic-racer-web/blob/main/CHANGELOG.md';

/** The newest version heading in a Keep a Changelog file (`## [1.2.3] - …`), or null when there is none. */
export function latestChangelogVersion(markdown: string): string | null {
  const match = /^## \[(\d+\.\d+\.\d+)\]/m.exec(markdown);
  return match?.[1] ?? null;
}
