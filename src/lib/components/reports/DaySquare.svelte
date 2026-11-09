<script lang="ts">
	import { useI18n } from '#lib/i18n/index.ts';
	import { formatTaka, type Poisha } from '#lib/money.ts';
	import type { CellState } from '#lib/report.ts';
	import { cn } from '#lib/utils/cn.ts';

	let {
		date,
		state,
		charge = null,
		today = false,
		showNumber = false,
		onopen,
		class: className
	}: {
		date: string;
		state: CellState;
		charge?: Poisha | null;
		today?: boolean;
		showNumber?: boolean;
		onopen?: (el: HTMLElement) => void;
		class?: string;
	} = $props();

	const i18n = useI18n();
	const number = $derived(Number(date.slice(8, 10)));

	const tones: Record<CellState, string> = {
		ate: 'bg-primary text-primary-fg',
		skipped: 'bg-surface-2 text-muted',
		noAnswer: 'border border-border bg-surface text-fg',
		noBreakfast: 'bg-surface-2/40 text-muted'
	};
	const ring = $derived(today ? 'ring-2 ring-ring ring-offset-1 ring-offset-surface' : '');

	const label = $derived.by(() => {
		const day = i18n.day(date);
		const base =
			state === 'ate'
				? charge !== null
					? i18n.t('reports.cell.ate', {
							date: day,
							charge: formatTaka(charge, i18n.locale)
						})
					: i18n.t('reports.cell.ateNoCharge', { date: day })
				: state === 'skipped'
					? i18n.t('reports.cell.skipped', { date: day })
					: state === 'noAnswer'
						? i18n.t('reports.cell.noAnswer', { date: day })
						: i18n.t('reports.cell.noBreakfast', { date: day });
		return today ? i18n.t('reports.cell.today', { label: base }) : base;
	});
</script>

<!--
	@component
	One day for one person. Filled means ate, muted fill means skipped, outline means
	no answer, faint means no breakfast day. The aria-label carries the same information.
-->
{#if state === 'noBreakfast'}
	<div
		role="img"
		aria-label={label}
		class={cn(
			'grid aspect-square w-full place-items-center rounded-control text-sm',
			tones[state],
			ring,
			className
		)}
	>
		{#if showNumber}<span aria-hidden="true" class="tabular-nums">{i18n.num(number)}</span>{/if}
	</div>
{:else}
	<button
		type="button"
		aria-label={label}
		onmouseenter={(e) => onopen?.(e.currentTarget)}
		onfocus={(e) => onopen?.(e.currentTarget)}
		onclick={(e) => onopen?.(e.currentTarget)}
		class={cn(
			'grid aspect-square w-full place-items-center rounded-control text-sm font-medium transition-colors',
			tones[state],
			ring,
			className
		)}
	>
		{#if showNumber}<span aria-hidden="true" class="tabular-nums">{i18n.num(number)}</span>{/if}
	</button>
{/if}
