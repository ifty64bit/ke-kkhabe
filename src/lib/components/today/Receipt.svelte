<script lang="ts">
	import { Money } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { formatTaka, type Poisha } from '#lib/money.ts';
	import { formatQty } from '#lib/quantity.ts';

	type Line = {
		name: string;
		unitBn: string;
		unitEn: string;
		/** In twelfths of an item. */
		quantity: number;
		unitPrice: Poisha;
		amount: Poisha;
	};

	let {
		lines,
		deliveryShare,
		discountShare,
		total
	}: {
		lines: Line[];
		deliveryShare: Poisha;
		discountShare: Poisha;
		total: Poisha;
	} = $props();

	const i18n = useI18n();
</script>

<!--
	@component
	The viewer's share of a finalized day, as a small receipt slip.
	Amounts come from `computeBreakdown`, so the lines always add up to the total.
-->
<section
	aria-label={i18n.t('today.receiptTitle')}
	class="w-full max-w-sm rounded-control border border-border bg-surface px-5 py-4 text-left"
>
	<h2 class="text-sm font-semibold text-muted">{i18n.t('today.receiptTitle')}</h2>

	<ul class="mt-3 flex flex-col gap-2.5">
		{#each lines as line (line.name)}
			{@const unit = i18n.pick(line.unitBn, line.unitEn)}
			<li class="flex items-baseline justify-between gap-4">
				<span class="min-w-0">
					<span class="block">{line.name}</span>
					<span class="block text-sm text-muted tabular-nums">
						{i18n.t('today.receiptLine', {
							count: formatQty(line.quantity, i18n.locale),
							unit,
							price: formatTaka(line.unitPrice, i18n.locale)
						})}
					</span>
				</span>
				<Money value={line.amount} />
			</li>
		{/each}

		{#if deliveryShare > 0}
			<li class="flex items-baseline justify-between gap-4 text-sm text-muted">
				<span>{i18n.t('today.receiptDelivery')}</span>
				<Money value={deliveryShare} />
			</li>
		{/if}
		{#if discountShare > 0}
			<li class="flex items-baseline justify-between gap-4 text-sm text-muted">
				<span>{i18n.t('today.receiptDiscount')}</span>
				<span class="tabular-nums">−<Money value={discountShare} /></span>
			</li>
		{/if}
	</ul>

	<p
		class="mt-3 flex items-baseline justify-between gap-4 border-t border-dashed border-border pt-3 text-lg font-semibold"
	>
		<span>{i18n.t('today.yourCost')}</span>
		<Money value={total} />
	</p>
</section>
