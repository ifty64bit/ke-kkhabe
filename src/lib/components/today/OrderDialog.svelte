<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Dialog, QuantityStepper } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';

	type Item = {
		id: string;
		nameBn: string;
		nameEn: string;
		unitBn: string;
		unitEn: string;
		available: boolean;
	};

	let {
		open = $bindable(false),
		items,
		initial
	}: {
		open?: boolean;
		items: Item[];
		/** Current quantities by item id, used when changing an order. */
		initial: Record<string, number>;
	} = $props();

	const i18n = useI18n();
	const fromSaved = () => Object.fromEntries(items.map((i) => [i.id, initial[i.id] ?? 0]));

	let qty = $state<Record<string, number>>(fromSaved());
	let errorKey = $state<MessageKey | null>(null);
	let saving = $state(false);

	// Reset the picker to the saved order each time the dialog opens.
	// `.pre` runs before the DOM updates, so the steppers never bind to a missing value.
	$effect.pre(() => {
		if (open) {
			qty = fromSaved();
			errorKey = null;
		}
	});

	const offered = $derived(
		items
			.filter((i) => i.available)
			.toSorted((a, b) =>
				i18n.pick(a.nameBn, a.nameEn).localeCompare(i18n.pick(b.nameBn, b.nameEn), i18n.locale)
			)
	);
	const total = $derived(Object.values(qty).reduce((a, b) => a + b, 0));
	const isChange = $derived(Object.values(initial).some((q) => q > 0));
</script>

<Dialog bind:open title={i18n.t('order.title')} description={i18n.t('order.description')}>
	<form
		id="order-form"
		method="POST"
		action="?/order"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					open = false;
					await update();
				} else if (result.type === 'failure') {
					errorKey = (result.data?.messageKey as MessageKey) ?? 'order.saveFailed';
				} else {
					await update();
				}
			};
		}}
	>
		<ul class="divide-y divide-border">
			{#each offered as item (item.id)}
				{@const name = i18n.pick(item.nameBn, item.nameEn)}
				<li class="flex items-center justify-between gap-4 py-3">
					<span class="text-lg">
						{name}
						{#if (qty[item.id] ?? 0) > 0}
							<span class="block text-sm text-muted">
								{i18n.num(qty[item.id])}
								{i18n.pick(item.unitBn, item.unitEn)}
							</span>
						{/if}
					</span>
					<QuantityStepper bind:value={qty[item.id]} name="qty:{item.id}" label={name} />
				</li>
			{/each}
		</ul>
		{#if errorKey}<Alert tone="danger" class="mt-3">{i18n.t(errorKey)}</Alert>{/if}
	</form>

	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<Button type="submit" form="order-form" disabled={total === 0} loading={saving}>
			{i18n.t(isChange ? 'order.change' : 'order.submit')}
		</Button>
	{/snippet}
</Dialog>
