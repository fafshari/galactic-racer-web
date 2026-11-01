# 0005. Scoped SCSS with RSCSS naming, no CSS Modules

- Status: Accepted
- Date: 2026-11-01

## Context

- **The user wants RSCSS structure** for CSS, and scoped styles per component.
- **Astro's recommended approach** is a `<style>` block in each component. Astro scopes it automatically, and Svelte does the same (ADR 0004).
- **CSS Modules are supported too**, but they'd be a second scoping mechanism. That competes with Astro's model, and the user asked to follow Astro best practice first.
- **The legacy CSS** already has a game-inspired theme (cream paper, rust / mustard / teal, Unbounded / Barlow / Barlow Semi Condensed). It defines design tokens as CSS variables with light and dark values.

## Decision

- **Per component:** each `.astro` and `.svelte` component styles itself in a scoped `<style lang="scss">` block. No `.module.scss` files.
- **RSCSS naming inside those blocks:**
  - Components: two or more words, `.part-card`.
  - Elements: one word, child selector, `.part-card > .title`.
  - Variants: dash prefix, `.-legendary`.
  - Helpers: underscore prefix, defined globally only, `._visually-hidden`.
  - Nest at most one level below the component root.
- **Global styles** are limited to:
  - design tokens (colour, type, spacing, radii, shadows) as CSS variables, with light and dark values and the `data-theme` override
  - base element styles and reset
  - RSCSS helpers
- **Shared Sass** (mixins, breakpoints) lives in `src/styles/` and is imported with `@use`.
- No utility CSS framework.
- **Styling a child component:** don't reach into another component's internals. Pass a variant prop, or have the child expose a CSS custom property. Use `:global()` only with a comment saying why.

## Consequences

- Scoping comes from the framework; RSCSS gives the class names a consistent shape and keeps selectors shallow.
- The theme can change in one place (the tokens).
- A Sass toolchain is needed (`sass`, supported by Astro and Vite out of the box).
- The legacy CSS is split up by component during the port, not copied wholesale.
