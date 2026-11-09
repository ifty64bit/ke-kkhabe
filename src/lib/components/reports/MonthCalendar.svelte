<script lang="ts">
	import DaySquare from './DaySquare.svelte';
	import { useI18n } from '#lib/i18n/index.ts';
	import { calendarWeeks, type PersonMonth } from '#lib/report.ts';

	let {
		month,
		person = null,
		today,
		onpick
	}: {
		month: string;
		person?: PersonMonth | null;
		today: string;
		onpick: (date: string, el: HTMLElement) => void;
	} = $props();

	const i18n = useI18n();
	const weeks = $derived(calendarWeeks(month));
	const weekdays = $derived([
		i18n.t('reports.weekday.sat'),
		i18n.t('reports.weekday.sun'),
		i18n.t('reports.weekday.mon'),
		i18n.t('reports.weekday.tue'),
		i18n.t('reports.weekday.wed'),
		i18n.t('reports.weekday.thu'),
		i18n.t('reports.weekday.fri')
	]);
</script>

<div class="grid grid-cols-7 gap-1.5">
	{#each weekdays as weekday, i (i)}
		<div class="pb-1 text-center text-xs font-medium text-muted">{weekday}</div>
	{/each}
	{#each weeks as week, wi (wi)}
		{#each week as date, di (date ?? `${wi}-${di}`)}
			{#if date}
				{@const cell = person?.cells[date]}
				<DaySquare
					{date}
					state={cell?.state ?? 'noBreakfast'}
					charge={cell?.charge ?? null}
					today={date === today}
					showNumber
					onopen={(el) => onpick(date, el)}
				/>
			{:else}
				<div aria-hidden="true"></div>
			{/if}
		{/each}
	{/each}
</div>
