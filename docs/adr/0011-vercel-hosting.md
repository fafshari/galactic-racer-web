# 0011. Host on Vercel; redirect the old GitHub Pages site

- Status: Accepted
- Date: 2026-11-01

## Context

- **Current hosting:** the site is on GitHub Pages at `fafshari.github.io/galactic-racer-planner/`, published from a public repo that holds only built files.
- **Source stays private:** the user wants the source private.
- **GitHub Pages and private repos:** GitHub Pages only serves private repositories on a paid plan. With free Pages, the built site has to be pushed to a public repo, which keeps the GitHub username in the URL.
- **The username:** the user prefers it not to be part of the public address.
- **Alternatives considered:**
  - GitHub Pages with a custom domain (about $10–15 a year; the github.io address and public repo still exist).
  - Cloudflare Pages and Netlify (free, similar to Vercel).

## Decision

- **Host:** deploy on **Vercel**, connected to the private `galactic-racer-web` repo, on the free Hobby plan.
  - The public address is a `*.vercel.app` subdomain that doesn't contain the GitHub username.
  - A custom domain can be added later without changing anything else.
- **Deploys:**
  - Pushes to `main` deploy to production.
  - Other branches get preview links.
  - Production deploys happen only when the user asks (see `CLAUDE.md`).
- **Old address:** the old GitHub Pages repo is reduced to redirect pages. `index.html` and `tour.html` send visitors to the new address and keep the hash, so old build links still load.

## Consequences

- **Hobby plan terms:** it's for non-commercial use only. No ads, sponsorships or paid features without moving to a paid plan or another host.
- **Build settings** (Node version, build command, output dir) live in the repo, not only in the Vercel dashboard, so they're reviewable.
- **Base path:** the old `/galactic-racer-planner/` prefix goes away on Vercel. The site is served from the root, and the redirect pages handle old paths.
- **Old repo:** the `fafshari/galactic-racer-planner` public repo stays, but holds only the redirects.

## Status (2026-11-02)

- **Live:** the site is deployed at `galactic-racer-planner.vercel.app`, connected to this repo.
- **Source no longer private:** the repo was made public under the MIT license (ADR 0017). That removes the "source stays private" reason above, but not the decision: Vercel still keeps the GitHub username out of the address and builds from the source repo directly.
- **Redirects not done yet:** the old GitHub Pages site still serves the legacy pages. Reducing it to redirects is still to do.
