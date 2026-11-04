<script lang="ts">
	import { useI18n } from '#lib/i18n/index.ts';
	import { cn } from '#lib/utils/cn.ts';

	const i18n = useI18n();

	let {
		value = $bindable(0),
		min = 0,
		max = 20,
		name,
		label,
		disabled = false,
		class: className
	}: {
		value?: number;
		min?: number;
		max?: number;
		/** When set, a hidden input carries the value in form submissions. */
		name?: string;
		/** Accessible label, e.g. the item name. */
		label: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const set = (n: number) => (value = Math.min(max, Math.max(min, n)));
	const btn =
		'grid size-10 place-items-center rounded-full text-xl font-semibold transition-colors hover:bg-surface-2 active:scale-95 disabled:pointer-events-none disabled:opacity-40';
</script>

<div
	role="group"
	aria-label={label}
	class={cn(
		'inline-flex items-center gap-1 rounded-full border border-border bg-surface p-0.5',
		value > 0 && 'border-fg/40 bg-surface-2',
		className
	)}
>
	<button
		type="button"
		class={btn}
		aria-label={i18n.t('stepper.decrease', { label })}
		disabled={disabled || value <= min}
		onclick={() => set(value - 1)}>−</button
	>
	<output class="w-7 text-center text-lg font-semibold tabular-nums" aria-live="polite"
		>{i18n.num(value)}</output
	>
	<button
		type="button"
		class={btn}
		aria-label={i18n.t('stepper.increase', { label })}
		disabled={disabled || value >= max}
		onclick={() => set(value + 1)}>+</button
	>
	{#if name}<input type="hidden" {name} {value} />{/if}
</div>
