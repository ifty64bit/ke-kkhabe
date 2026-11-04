<script lang="ts">
	import { formatTaka, type Locale, type Poisha } from '#lib/money.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { cn } from '#lib/utils/cn.ts';

	const i18n = useI18n();

	let {
		value,
		locale,
		/** Color positive green / negative red, with explicit sign (for balances). */
		balance = false,
		class: className
	}: {
		value: Poisha;
		/** Defaults to the page language. */ locale?: Locale;
		balance?: boolean;
		class?: string;
	} = $props();
</script>

<span
	class={cn(
		'tabular-nums',
		balance && value > 0 && 'text-success',
		balance && value < 0 && 'text-danger',
		className
	)}>{formatTaka(value, locale ?? i18n.locale, { sign: balance })}</span
>
