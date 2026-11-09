<script lang="ts">
	import DaySquare from './DaySquare.svelte';
	import { Avatar, Money } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import type { MonthReport } from '#lib/report.ts';

	let {
		report,
		today,
		onpick
	}: {
		report: MonthReport;
		today: string;
		onpick: (personId: string, date: string, el: HTMLElement) => void;
	} = $props();

	const i18n = useI18n();
	const numbers = $derived(report.dates.map((_, i) => i + 1));
	const columns = $derived(
		`minmax(8.5rem, 12rem) repeat(${report.dates.length}, 1.75rem) minmax(4.5rem, 6rem)`
	);
</script>

<!-- Scrolls inside its own box on phones; the page itself never scrolls sideways. -->
<div class="overflow-x-auto rounded-card border border-border bg-surface">
	<div class="grid min-w-max" style="grid-template-columns: {columns}">
		<div
			class="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2 text-xs font-semibold text-muted"
		>
			{i18n.t('reports.team.member')}
		</div>
		{#each numbers as n (n)}
			<div class="border-b border-border py-2 text-center text-[10px] text-muted tabular-nums">
				{i18n.num(n)}
			</div>
		{/each}
		<div class="border-b border-border px-3 py-2 text-right text-xs font-semibold text-muted">
			{i18n.t('reports.team.totals')}
		</div>

		{#each report.people as person (person.id)}
			<div
				class="sticky left-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5"
			>
				<Avatar name={person.name} src={person.image} size="sm" />
				<span class="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>
				{#if !person.active}
					<span class="shrink-0 text-[10px] text-muted">
						{i18n.t('reports.team.inactive')}
					</span>
				{/if}
			</div>
			{#each report.dates as date (date)}
				{@const cell = person.cells[date]}
				<div class="border-b border-border p-0.5">
					<DaySquare
						{date}
						state={cell?.state ?? 'noBreakfast'}
						charge={cell?.charge ?? null}
						today={date === today}
						onopen={(el) => onpick(person.id, date, el)}
						class="rounded-[0.25rem] text-[10px]"
					/>
				</div>
			{/each}
			<div class="border-b border-border px-3 py-1 text-right text-[11px] tabular-nums">
				<div class="text-muted">
					{i18n.num(person.totals.daysEaten)}
					{i18n.t('reports.totals.days')}
				</div>
				<div class="font-semibold"><Money value={person.totals.charged} /></div>
			</div>
		{/each}
	</div>
</div>
