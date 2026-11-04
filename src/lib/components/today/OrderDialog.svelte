<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Dialog, QuantityStepper } from '#lib/components/ui/index.ts';

	type Item = { id: string; nameBn: string; unitBn: string; available: boolean };

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

	let qty = $state<Record<string, number>>({});
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Reset the picker to the saved order each time the dialog opens.
	$effect(() => {
		if (open) {
			qty = Object.fromEntries(items.map((i) => [i.id, initial[i.id] ?? 0]));
			error = null;
		}
	});

	const offered = $derived(items.filter((i) => i.available));
	const total = $derived(Object.values(qty).reduce((a, b) => a + b, 0));
	const isChange = $derived(Object.values(initial).some((q) => q > 0));
</script>

<Dialog bind:open title="আজ কী খাবেন?" description="যা যা লাগবে, কয়টা লাগবে বেছে নিন।">
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
					error = (result.data?.message as string) ?? 'অর্ডার সেভ করা যায়নি।';
				} else {
					await update();
				}
			};
		}}
	>
		<ul class="divide-y divide-border">
			{#each offered as item (item.id)}
				<li class="flex items-center justify-between gap-4 py-3">
					<span class="text-lg">
						{item.nameBn}
						{#if (qty[item.id] ?? 0) > 0}
							<span class="block text-sm text-muted">{qty[item.id]} {item.unitBn}</span>
						{/if}
					</span>
					<QuantityStepper bind:value={qty[item.id]} name="qty:{item.id}" label={item.nameBn} />
				</li>
			{/each}
		</ul>
		{#if error}<Alert tone="danger" class="mt-3">{error}</Alert>{/if}
	</form>

	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>বাতিল</Button>
		<Button type="submit" form="order-form" disabled={total === 0} loading={saving}>
			{isChange ? 'অর্ডার বদলান' : 'অর্ডার করুন'}
		</Button>
	{/snippet}
</Dialog>
