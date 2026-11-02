// The site colour theme a visitor picked. "auto" follows the device's light/dark setting.

export const THEME_KEY = 'swgr-theme';

export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Reads a saved choice; anything unknown (or nothing saved) means "auto". */
export const parseTheme = (raw: unknown): Theme => (THEMES as readonly unknown[]).includes(raw) ? (raw as Theme) : 'auto';
