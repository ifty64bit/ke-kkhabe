<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DayDetail from '#lib/components/reports/DayDetail.svelte';
	import Legend from '#lib/components/reports/Legend.svelte';
	import MonthCalendar from '#lib/components/reports/MonthCalendar.svelte';
	import TeamGrid from '#lib/components/reports/TeamGrid.svelte';
	import {
		Card,
		EmptyState,
		Money,
		PageHeader,
		Popover,
		SegmentedControl
	} from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const i18n = useI18n();

	const person = $derived(data.report.people[0]);

	let anchor = $state<HTMLElement | null>(null);
	let selected = $state<{ personId: string; date: string } | null>(null);
	let popoverOpen = $state(false);

	function clear() {
		popoverOpen = false;
		selected = null;
		anchor = null;
	}

	// The popover belongs to one month's grid; leave it behind when the page moves.
	afterNavigate(clear);

	function pick(personId: string, date: string, el: HTMLElement) {
		selected = { personId, date };
		anchor = el;
		popoverOpen = true;
	}

	const selectedPerson = $derived.by(() => {
		const current = selected;
		return current ? data.report.people.find((p) => p.id === current.personId) : undefined;
	});
	const selectedCell = $derived.by(() => {
		const current = selected;
		return current && selectedPerson ? selectedPerson.cells[current.date] : undefined;
	});

	function shiftMonth(month: string, delta: number) {
		const [year, monthNumber] = month.split('-').map(Number);
		const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
		return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
	}

	const previousMonth = $derived(shiftMonth(data.report.month, -1));
	const nextMonth = $derived(shiftMonth(data.report.month, 1));

	function switchView(view: 'me' | 'all') {
		goto(resolve(`/(app)/reports?month=${data.report.month}&view=${view}`));
	}
</script>

<svelte:head><title>{i18n.t('reports.headTitle')} · {i18n.t('app.name')}</title></svelte:head>

<main
	class={data.view === 'all'
		? 'mx-auto w-full max-w-6xl px-4 py-8'
		: 'mx-auto w-full max-w-2xl px-4 py-8'}
>
	<PageHeader title={i18n.t('reports.title')} description={i18n.t('reports.description')} />

	<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-1.5">
			<a
				href={resolve(`/(app)/reports?month=${previousMonth}&view=${data.view}`)}
				aria-label={i18n.t('reports.month.prev')}
				class="grid size-9 place-items-center rounded-full border border-border bg-surface text-sm text-muted transition-colors hover:text-fg"
			>
				<span aria-hidden="true">◀</span>
			</a>
			<h2 class="min-w-40 text-center font-display text-xl sm:text-2xl">
				{i18n.month(data.report.month)}
			</h2>
			<a
				href={resolve(`/(app)/reports?month=${nextMonth}&view=${data.view}`)}
				aria-label={i18n.t('reports.month.next')}
				class="grid size-9 place-items-center rounded-full border border-border bg-surface text-sm text-muted transition-colors hover:text-fg"
			>
				<span aria-hidden="true">▶</span>
			</a>
		</div>

		{#if data.isManager}
			<SegmentedControl
				value={data.view}
				label={i18n.t('reports.view.label')}
				options={[
					{ value: 'me', label: i18n.t('reports.view.me') },
					{ value: 'all', label: i18n.t('reports.view.all') }
				]}
				onchange={switchView}
			/>
		{/if}
	</div>

	{#if data.report.days.length === 0}
		<Card class="mt-6" padding="none">
			<EmptyState title={i18n.t('reports.emptyTitle')} description={i18n.t('reports.emptyBody')} />
		</Card>
	{:else if data.view === 'me'}
		{#if person}
			<dl class="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
				<div class="rounded-card border border-border bg-surface p-3">
					<dt class="text-xs text-muted">{i18n.t('reports.totals.daysEaten')}</dt>
					<dd class="mt-1 font-display text-xl tabular-nums sm:text-2xl">
						{i18n.num(person.totals.daysEaten)}
					</dd>
				</div>
				<div class="rounded-card border border-border bg-surface p-3">
					<dt class="text-xs text-muted">{i18n.t('reports.totals.charged')}</dt>
					<dd class="mt-1 font-display text-xl tabular-nums sm:text-2xl">
						<Money value={person.totals.charged} />
					</dd>
				</div>
				<div class="rounded-card border border-border bg-surface p-3">
					<dt class="text-xs text-muted">{i18n.t('reports.totals.paid')}</dt>
					<dd class="mt-1 font-display text-xl tabular-nums sm:text-2xl">
						<Money value={person.totals.paid} />
					</dd>
				</div>
			</dl>

			<Card class="mt-4" padding="sm">
				<MonthCalendar
					month={data.report.month}
					{person}
					today={data.today}
					onpick={(date, el) => pick(person.id, date, el)}
				/>
				<Legend class="mt-4 border-t border-border pt-3" />
			</Card>
		{/if}
	{:else}
		<dl class="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
			<div class="rounded-card border border-border bg-surface p-3">
				<dt class="text-xs text-muted">{i18n.t('reports.totals.breakfastDays')}</dt>
				<dd class="mt-1 font-display text-xl tabular-nums sm:text-2xl">
					{i18n.num(data.report.totals.breakfastDays)}
				</dd>
			</div>
			<div class="rounded-card border border-border bg-surface p-3">
				<dt class="text-xs text-muted">{i18n.t('reports.totals.charged')}</dt>
				<dd class="mt-1 font-display text-xl tabular-nums sm:text-2xl">
					<Money value={data.report.totals.charged} />
				</dd>
			</div>
			<div class="rounded-card border border-border bg-surface p-3">
				<dt class="text-xs text-muted">{i18n.t('reports.totals.paid')}</dt>
				<dd class="mt-1 font-display text-xl tabular-nums sm:text-2xl">
					<Money value={data.report.totals.paid} />
				</dd>
			</div>
		</dl>

		<div class="mt-4">
			<TeamGrid report={data.report} today={data.today} onpick={pick} />
			<Legend class="mt-3" />
		</div>
	{/if}
</main>

<Popover bind:open={popoverOpen} {anchor} labelledby="report-day-title" onclose={clear}>
	{#if selected && selectedPerson && selectedCell}
		<DayDetail
			titleId="report-day-title"
			date={selected.date}
			cell={selectedCell}
			name={data.view === 'all' ? selectedPerson.name : null}
		/>
	{/if}
</Popover>
