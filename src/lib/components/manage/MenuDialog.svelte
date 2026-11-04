<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import { Alert, Button, Dialog } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';

	type Item = { id: string; name: string; unitBn: string; unitEn: string };

	let {
		open = $bindable(false),
		items,
		/** Items currently offered today and available. */
		availableIds,
		/** Called after a successful save with the count of unavailable items that had orders. */
		onwarn
	}: {
		open?: boolean;
		items: Item[];
		availableIds: string[];
		onwarn: (count: number) => void;
	} = $props();

	const i18n = useI18n();

	const checkedIds = () => new SvelteSet(availableIds);
	let checked = $state<SvelteSet<string>>(checkedIds());
	let saving = $state(false);
	let errorKey = $state<MessageKey | null>(null);

	$effect.pre(() => {
		if (open) {
			checked = checkedIds();
			errorKey = null;
		}
	});

	const toggle = (id: string, on: boolean) => {
		if (on) checked.add(id);
		else checked.delete(id);
	};
</script>

<Dialog
	bind:open
	size="lg"
	title={i18n.t('manage.menu.title')}
	description={i18n.t('manage.menu.description')}
>
	<form
		id="menu-form"
		method="POST"
		action="?/setItems"
		use:enhance={() => {
			saving = true;
			errorKey = null;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					onwarn(Number((result.data as { warn?: number })?.warn ?? 0));
					open = false;
					await update();
				} else if (result.type === 'failure') {
					errorKey = (result.data?.messageKey as MessageKey) ?? 'manage.error.invalid';
				} else {
					await update();
				}
			};
		}}
	>
		<ul class="divide-y divide-border">
			{#each items as item (item.id)}
				<li>
					<label class="flex items-center gap-3 py-3">
						<input
							type="checkbox"
							name="itemId"
							value={item.id}
							checked={checked.has(item.id)}
							onchange={(e) => toggle(item.id, e.currentTarget.checked)}
							class="size-5 shrink-0 accent-primary"
						/>
						<span class="text-lg">
							{item.name}
							<span class="text-base text-muted">({i18n.pick(item.unitBn, item.unitEn)})</span>
						</span>
					</label>
				</li>
			{/each}
		</ul>
		{#if errorKey}<Alert tone="danger" class="mt-3">{i18n.t(errorKey)}</Alert>{/if}
	</form>

	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<Button type="submit" form="menu-form" loading={saving}>{i18n.t('items.save')}</Button>
	{/snippet}
</Dialog>
