<script lang="ts">
	import { formatTaka, type Locale, type Poisha } from '#lib/money.ts';
	import { cn } from '#lib/utils/cn.ts';

	let {
		value,
		locale = 'bn',
		/** Color positive green / negative red, with explicit sign (for balances). */
		balance = false,
		class: className
	}: { value: Poisha; locale?: Locale; balance?: boolean; class?: string } = $props();
</script>

<span
	class={cn(
		'tabular-nums',
		balance && value > 0 && 'text-success',
		balance && value < 0 && 'text-danger',
		className
	)}>{formatTaka(value, locale, { sign: balance })}</span
>
