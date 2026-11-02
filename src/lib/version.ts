// The site's version (ADR 0018): package.json is the source, CHANGELOG.md must agree.
import pkg from '../../package.json';

export const siteVersion: string = pkg.version;

/** The "What's new" page, built from CHANGELOG.md. */
export const changelogPath = '/changelog.html';
