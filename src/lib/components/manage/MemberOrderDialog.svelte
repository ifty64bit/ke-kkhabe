<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Dialog, QuantityStepper } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';

	type Item = {
		id: string;
		name: string;
		unitBn: string;
		unitEn: string;
		available: boolean;
	};

	type Person = {
		id: string;
		name: string;
		eating: boolean | null;
		lines: { itemId: string; quantity: number }[];
	};

	let {
		open = $bindable(false),
		member,
		items
	}: {
		open?: boolean;
		/** The member whose order is being edited; null while the dialog is closed. */
		member: Person | null;
		items: Item[];
	} = $props();

	const i18n = useI18n();

	const fromSaved = () =>
		Object.fromEntries(
			items.map((i) => [i.id, member?.lines.find((l) => l.itemId === i.id)?.quantity ?? 0])
		);

	let qty = $state<Record<string, number>>(fromSaved());
	let errorKey = $state<MessageKey | null>(null);
	let saving = $state(false);

	// Reset to the saved order each time the dialog opens; `.pre` so the steppers
	// never bind to a missing value (see OrderDialog).
	$effect.pre(() => {
		if (open) {
			qty = fromSaved();
			errorKey = null;
		}
	});

	const offered = $derived(items.filter((i) => i.available));
	const total = $derived(Object.values(qty).reduce((a, b) => a + b, 0));
</script>

<Dialog
	bind:open
	title={member ? i18n.t('manage.memberOrder.title', { name: member.name }) : ''}
	description={i18n.t('manage.memberOrder.description')}
>
	<form
		id="member-order-form"
		method="POST"
		action="?/saveMemberOrder"
		use:enhance={() => {
			saving = true;
			errorKey = null;
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
		<input type="hidden" name="userId" value={member?.id} />
		<ul class="divide-y divide-border">
			{#each offered as item (item.id)}
				{@const name = item.name}
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
		<Button type="submit" form="member-order-form" name="eating" value="false" variant="secondary">
			{i18n.t('manage.memberOrder.notEating')}
		</Button>
		<Button type="submit" form="member-order-form" disabled={total === 0} loading={saving}>
			{i18n.t('items.save')}
		</Button>
	{/snippet}
</Dialog>
