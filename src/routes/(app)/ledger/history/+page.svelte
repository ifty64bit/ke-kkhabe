<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, EmptyState, Money, PageHeader, Select } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { groupHistory } from '#lib/ledger.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const i18n = useI18n();

	/** '' shows everyone; otherwise the id of one person I settled with. */
	let withId = $state('');

	const counterparts = $derived(
		[
			...new Map(
				data.rows.map((r) => (r.fromId === data.meId ? [r.toId, r.toName] : [r.fromId, r.fromName]))
			)
		]
			.map(([value, label]) => ({ value, label }))
			.toSorted((a, b) => a.label.localeCompare(b.label, i18n.locale))
	);

	const months = $derived(
		groupHistory(
			withId ? data.rows.filter((r) => r.fromId === withId || r.toId === withId) : data.rows,
			data.meId
		)
	);

	type Entry = (typeof months)[number]['entries'][number];

	/** One quiet line saying what happened to an entry that does not count, or who logged it. */
	const fateOf = (e: Entry): string | null => {
		if (e.voidedAt)
			return i18n.t(e.status === 'pending' ? 'history.cancelledBy' : 'history.voidedBy', {
				name: e.voidedByName ?? ''
			});
		if (e.status === 'rejected')
			return e.rejectReason
				? i18n.t('ledger.rejectedBy', { name: e.decidedByName ?? '', reason: e.rejectReason })
				: i18n.t('ledger.rejectedByNoReason', { name: e.decidedByName ?? '' });
		if (e.createdByName && e.createdBy !== e.fromId && e.createdBy !== e.toId)
			return i18n.t('ledger.loggedBy', { name: e.createdByName });
		return null;
	};
</script>

<svelte:head><title>{i18n.t('history.title')} · {i18n.t('app.name')}</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<a
		href={resolve('/(app)/ledger')}
		class="inline-block rounded-control text-sm text-muted underline-offset-2 hover:text-fg hover:underline"
	>
		{i18n.t('history.back')}
	</a>

	<PageHeader
		class="mt-3"
		title={i18n.t('history.title')}
		description={i18n.t('history.description')}
	/>

	{#if data.rows.length === 0}
		<EmptyState
			class="mt-8"
			title={i18n.t('history.emptyTitle')}
			description={i18n.t('history.emptyBody')}
		/>
	{:else}
		{#if counterparts.length > 1}
			<label class="mt-8 block max-w-xs">
				<span class="mb-1.5 block text-sm text-muted">{i18n.t('history.filter')}</span>
				<Select
					bind:value={withId}
					options={[{ value: '', label: i18n.t('history.everyone') }, ...counterparts]}
				/>
			</label>
		{/if}

		{#each months as m (m.month)}
			<section class="mt-10" aria-labelledby="month-{m.month}">
				<h2 id="month-{m.month}" class="font-display text-2xl leading-tight">
					{i18n.month(m.month)}
				</h2>

				<!-- A khata page: two money columns, paid and received, totalled at the foot. -->
				<table class="mt-3 w-full border-collapse text-left">
					<thead>
						<tr class="border-b border-border text-sm text-muted">
							<th scope="col" class="w-16 py-2 pr-2 font-normal">
								<span class="sr-only">{i18n.t('history.date')}</span>
							</th>
							<th scope="col" class="py-2 pr-2 font-normal">
								<span class="sr-only">{i18n.t('history.with')}</span>
							</th>
							<th scope="col" class="w-24 py-2 pl-2 text-right font-normal">
								{i18n.t('history.paid')}
							</th>
							<th scope="col" class="w-24 py-2 pl-2 text-right font-normal">
								{i18n.t('history.received')}
							</th>
						</tr>
					</thead>
					<tbody>
						{#each m.entries as e (e.id)}
							{@const fate = fateOf(e)}
							{@const struck = !e.counts && e.status !== 'pending'}
							{@const amountClass = struck
								? 'text-muted line-through decoration-primary/70'
								: e.counts
									? ''
									: 'text-muted'}
							<tr class="border-b border-border align-top">
								<td class="py-3 pr-2 text-sm text-muted tabular-nums">{i18n.shortDay(e.date)}</td>
								<td class="py-3 pr-2">
									<span class="font-medium" class:text-muted={struck}>
										{e.direction === 'out' ? e.toName : e.fromName}
									</span>
									{#if e.note}<span class="block text-sm text-muted">{e.note}</span>{/if}
									{#if e.status === 'pending' && !e.voidedAt}
										<Badge tone="warning" class="mt-1">{i18n.t('ledger.status.pending')}</Badge>
									{/if}
									{#if fate}<span class="mt-1 block text-xs text-muted">{fate}</span>{/if}
								</td>
								<td class="py-3 pl-2 text-right tabular-nums">
									{#if e.direction === 'out'}<span class={amountClass}
											><Money value={e.amount} /></span
										>{/if}
								</td>
								<td class="py-3 pl-2 text-right tabular-nums">
									{#if e.direction === 'in'}<span class={amountClass}
											><Money value={e.amount} /></span
										>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<!-- The double rule under a khata total. -->
						<tr class="border-t-4 border-double border-fg/40 font-semibold">
							<th scope="row" colspan="2" class="py-3 pr-2 text-left">{i18n.t('history.total')}</th>
							<td class="py-3 pl-2 text-right tabular-nums"><Money value={m.paid} /></td>
							<td class="py-3 pl-2 text-right tabular-nums"><Money value={m.received} /></td>
						</tr>
					</tfoot>
				</table>
			</section>
		{/each}
	{/if}
</main>
