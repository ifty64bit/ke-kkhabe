<script lang="ts">
	import { Badge, Money } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { formatQty } from '#lib/quantity.ts';
	import type { Cell } from '#lib/report.ts';

	let {
		date,
		cell,
		name = null,
		titleId
	}: {
		date: string;
		cell: Cell;
		/** Shown in the everyone view so the popover says whose day it is. */
		name?: string | null;
		titleId: string;
	} = $props();

	const i18n = useI18n();
</script>

<div>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h2 id={titleId} class="font-display text-lg leading-tight">{i18n.day(date)}</h2>
			{#if name}<p class="mt-0.5 text-sm text-muted">{name}</p>{/if}
		</div>
		{#if !cell.final}
			<Badge tone="warning">{i18n.t('reports.popover.notFinal')}</Badge>
		{/if}
	</div>

	{#if cell.state === 'skipped'}
		<p class="mt-3 text-sm text-muted">{i18n.t('reports.popover.skipped')}</p>
	{:else if cell.state === 'noAnswer'}
		<p class="mt-3 text-sm text-muted">{i18n.t('reports.popover.noAnswer')}</p>
	{/if}

	{#if cell.lines.length > 0}
		<ul class="mt-3 space-y-1.5 text-sm">
			{#each cell.lines as line (line.itemId)}
				<li class="flex items-baseline justify-between gap-3">
					<span>
						{i18n.t('reports.popover.line', {
							name: line.name,
							qty: formatQty(line.quantity12ths, i18n.locale),
							unit: i18n.pick(line.unitBn, line.unitEn)
						})}
					</span>
					{#if line.share !== null}
						<span class="shrink-0 tabular-nums"><Money value={line.share} /></span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if cell.final}
		<dl class="mt-3 space-y-1 border-t border-border pt-3 text-sm">
			{#if cell.deliveryShare > 0}
				<div class="flex justify-between gap-3">
					<dt class="text-muted">{i18n.t('reports.popover.delivery')}</dt>
					<dd class="tabular-nums"><Money value={cell.deliveryShare} /></dd>
				</div>
			{/if}
			{#if cell.discountShare > 0}
				<div class="flex justify-between gap-3">
					<dt class="text-muted">{i18n.t('reports.popover.discount')}</dt>
					<dd class="tabular-nums"><Money value={-cell.discountShare} /></dd>
				</div>
			{/if}
			<div class="flex justify-between gap-3 font-semibold">
				<dt>{i18n.t('reports.popover.charge')}</dt>
				<dd class="tabular-nums"><Money value={cell.charge ?? 0} /></dd>
			</div>
		</dl>
	{/if}

	{#if cell.paid > 0}
		<div class="mt-3 flex justify-between gap-3 border-t border-border pt-3 text-sm">
			<span class="text-muted">{i18n.t('reports.popover.paid')}</span>
			<span class="tabular-nums"><Money value={cell.paid} /></span>
		</div>
	{/if}
</div>
