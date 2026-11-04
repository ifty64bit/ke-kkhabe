export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = 'ke-theme';

export const parseTheme = (value: unknown): Theme =>
	THEMES.includes(value as Theme) ? (value as Theme) : 'system';
