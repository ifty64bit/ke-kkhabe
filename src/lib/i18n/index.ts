import { getContext, setContext } from 'svelte';
import { bn, type MessageKey } from './bn.ts';
import { en } from './en.ts';

export type { MessageKey };
export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'ke-locale';

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

const dictionaries: Record<Locale, Record<MessageKey, string>> = { bn, en };
const intlLocale = (l: Locale) => (l === 'bn' ? 'bn-BD' : 'en-GB');

/** Translate a key, filling `{param}` placeholders. */
export function translate(
	locale: Locale,
	key: MessageKey,
	params?: Record<string, string | number>
) {
	const text = dictionaries[locale][key] ?? bn[key];
	return params ? text.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`)) : text;
}

export const formatNumber = (n: number, locale: Locale) =>
	new Intl.NumberFormat(intlLocale(locale)).format(n);

/** Long date for a YYYY-MM-DD key in Dhaka time, e.g. "বুধবার, ৪ নভেম্বর" / "Wednesday 4 November". */
export const formatDay = (date: string, locale: Locale) =>
	new Intl.DateTimeFormat(intlLocale(locale), {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'Asia/Dhaka'
	}).format(new Date(`${date}T06:00:00Z`));

export type I18n = ReturnType<typeof createI18n>;

export function createI18n(getLocale: () => Locale) {
	return {
		get locale() {
			return getLocale();
		},
		t: (key: MessageKey, params?: Record<string, string | number>) =>
			translate(getLocale(), key, params),
		num: (n: number) => formatNumber(n, getLocale()),
		day: (date: string) => formatDay(date, getLocale()),
		/** Pick the localized field of a record with `xBn` / `xEn` columns. */
		pick: (bnValue: string, enValue: string) => (getLocale() === 'bn' ? bnValue : enValue)
	};
}

const KEY = Symbol('i18n');

/** Call once in the root layout with a getter for the current locale. */
export const setI18n = (getLocale: () => Locale) => setContext(KEY, createI18n(getLocale));

/** Translation helpers for the current request/page. Falls back to Bangla outside the app tree. */
export const useI18n = () => getContext<I18n | undefined>(KEY) ?? createI18n(() => 'bn');
