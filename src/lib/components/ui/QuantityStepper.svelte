<script lang="ts">
	import { useI18n } from '#lib/i18n/index.ts';
	import {
		canSetFraction,
		formatQty,
		FRACTION_GLYPH,
		FRACTIONS,
		MAX_UNITS,
		setFraction,
		split,
		stepWhole
	} from '#lib/quantity.ts';
	import { cn } from '#lib/utils/cn.ts';

	const i18n = useI18n();

	let {
		value = $bindable(0),
		name,
		label,
		disabled = false,
		class: className
	}: {
		/** Quantity in twelfths of an item (12 = 1, 6 = ½; see `#lib/quantity.ts`). */
		value?: number;
		/** When set, a hidden input carries the value (in twelfths) in form submissions. */
		name?: string;
		/** Accessible label, e.g. the item name. */
		label: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const parts = $derived(split(value ?? 0));
	// The fraction row starts open when the value already has a fraction.
	let sharing = $state(split(value ?? 0).fraction > 0);
	$effect.pre(() => {
		if (parts.fraction > 0) sharing = true;
	});

	const btn =
		'grid size-10 place-items-center rounded-full text-xl font-semibold transition-colors hover:bg-surface-2 active:scale-95 disabled:pointer-events-none disabled:opacity-40';
	const chip =
		'min-w-9 rounded-full border border-border px-2 py-1 text-base tabular-nums transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 aria-pressed:border-fg/40 aria-pressed:bg-surface-2 aria-pressed:font-semibold';
</script>

<div class={cn('inline-flex flex-col items-end gap-1.5', className)}>
	<div
		role="group"
		aria-label={label}
		class={cn(
			'inline-flex items-center gap-1 rounded-full border border-border bg-surface p-0.5',
			value > 0 && 'border-fg/40 bg-surface-2'
		)}
	>
		<button
			type="button"
			class={btn}
			aria-label={i18n.t('stepper.decrease', { label })}
			disabled={disabled || value === 0}
			onclick={() => (value = stepWhole(value, -1))}>−</button
		>
		<output class="min-w-7 text-center text-lg font-semibold tabular-nums" aria-live="polite"
			>{formatQty(value ?? 0, i18n.locale)}</output
		>
		<button
			type="button"
			class={btn}
			aria-label={i18n.t('stepper.increase', { label })}
			disabled={disabled || value + 12 > MAX_UNITS}
			onclick={() => (value = stepWhole(value, 1))}>+</button
		>
	</div>

	{#if sharing}
		<div role="group" aria-label={i18n.t('stepper.share')} class="flex flex-wrap justify-end gap-1">
			{#each FRACTIONS as f (f)}
				<button
					type="button"
					class={chip}
					aria-pressed={parts.fraction === f}
					aria-label={f === 0
						? i18n.t('stepper.noFraction')
						: i18n.t('stepper.fraction', { fraction: FRACTION_GLYPH[f], label })}
					disabled={disabled || !canSetFraction(value, f)}
					onclick={() => (value = setFraction(value, f))}
					>{f === 0 ? '—' : FRACTION_GLYPH[f]}</button
				>
			{/each}
		</div>
	{:else}
		<button
			type="button"
			class="px-1 text-sm text-muted underline-offset-2 hover:text-fg hover:underline"
			{disabled}
			onclick={() => (sharing = true)}>{i18n.t('stepper.share')}</button
		>
	{/if}

	{#if name}<input type="hidden" {name} {value} />{/if}
</div>
