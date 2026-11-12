<script lang="ts">
	import { Money, Popover } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { formatTaka, type Poisha } from '#lib/money.ts';
	import { formatQty } from '#lib/quantity.ts';

	type Day = {
		date: string;
		amount: Poisha;
		dayNet: Poisha;
		items: { name: string; quantity: number }[];
	};

	let {
		amount,
		title,
		eater,
		days
	}: {
		amount: Poisha;
		/** e.g. "Md. Rasheeq Zaman → Sahim Sakir". */
		title: string;
		/** Whose orders the days list. */
		eater: string;
		days: Day[];
	} = $props();

	const i18n = useI18n();
	const titleId = $props.id();
	let anchor = $state<HTMLButtonElement | null>(null);
	let open = $state(false);

	const covered = $derived(days.reduce((a, d) => a + d.amount, 0));
</script>

<button
	bind:this={anchor}
	type="button"
	class="shrink-0 rounded-control tabular-nums underline decoration-dotted underline-offset-4 transition-colors hover:text-fg"
>
	<Money value={amount} />
</button>

<Popover {anchor} bind:open labelledby={titleId}>
	<h3 id={titleId} class="flex items-baseline justify-between gap-3 font-medium">
		<span class="min-w-0 truncate">{title}</span>
		<Money value={amount} class="shrink-0" />
	</h3>
	{#if days.length > 0}
		<p class="mt-0.5 text-xs text-muted">{i18n.t('ledger.days.ordersOf', { name: eater })}</p>
		<ul class="mt-3 divide-y divide-border text-sm">
			{#each days as d (d.date)}
				<li class="py-2 first:pt-0 last:pb-0">
					<p class="flex items-baseline justify-between gap-3">
						<span class="font-medium">{i18n.day(d.date)}</span>
						<span class="shrink-0 tabular-nums">
							<Money value={d.amount} />
							{#if d.amount < d.dayNet}
								<span class="text-xs text-muted">
									{i18n.t('ledger.days.partOf', { amount: formatTaka(d.dayNet, i18n.locale) })}
								</span>
							{/if}
						</span>
					</p>
					{#if d.items.length > 0}
						<p class="mt-0.5 text-muted">
							{d.items
								.map((it) => `${it.name} × ${formatQty(it.quantity, i18n.locale)}`)
								.join(', ')}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#if covered < amount}
		<p class="mt-3 text-xs text-muted">
			{i18n.t('ledger.days.rest', { amount: formatTaka(amount - covered, i18n.locale) })}
		</p>
	{/if}
</Popover>
