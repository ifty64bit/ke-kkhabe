<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Dialog, Field, Input, Select } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import { UNITS, unitIdFor } from '#lib/units.ts';

	type Item = { id: string; nameBn: string; nameEn: string; unitEn: string };

	let {
		open = $bindable(false),
		item = null
	}: {
		open?: boolean;
		/** The item being edited, or null to add a new one. */
		item?: Item | null;
	} = $props();

	const i18n = useI18n();

	let nameBn = $state('');
	let nameEn = $state('');
	let unit = $state<string>('pc');
	let errors = $state<Partial<Record<'nameBn' | 'nameEn' | 'unitId', MessageKey>>>({});
	let formError = $state<MessageKey | null>(null);
	let saving = $state(false);

	$effect.pre(() => {
		if (open) {
			nameBn = item?.nameBn ?? '';
			nameEn = item?.nameEn ?? '';
			unit = item ? unitIdFor(item.unitEn) : 'pc';
			errors = {};
			formError = null;
		}
	});

	const unitOptions = $derived(
		UNITS.map((u) => ({ value: u.id, label: i18n.locale === 'bn' ? `${u.bn} (${u.en})` : u.en }))
	);
</script>

<Dialog bind:open title={i18n.t(item ? 'items.editTitle' : 'items.addTitle')} size="sm">
	<form
		id="item-form"
		method="POST"
		action={item ? '?/update' : '?/create'}
		class="flex flex-col gap-4"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					open = false;
					await update();
				} else if (result.type === 'failure') {
					errors = (result.data?.errors as typeof errors) ?? {};
					formError = (result.data?.messageKey as MessageKey) ?? null;
				} else {
					await update();
				}
			};
		}}
	>
		{#if item}<input type="hidden" name="id" value={item.id} />{/if}

		<Field
			label={i18n.t('items.nameBn')}
			error={errors.nameBn ? i18n.t(errors.nameBn) : null}
			required
		>
			{#snippet children(f)}
				<Input
					name="nameBn"
					bind:value={nameBn}
					maxlength={40}
					lang="bn"
					autocomplete="off"
					{...f}
				/>
			{/snippet}
		</Field>

		<Field
			label={i18n.t('items.nameEn')}
			hint={i18n.t('items.nameEnHint')}
			error={errors.nameEn ? i18n.t(errors.nameEn) : null}
		>
			{#snippet children(f)}
				<Input
					name="nameEn"
					bind:value={nameEn}
					maxlength={40}
					lang="en"
					autocomplete="off"
					{...f}
				/>
			{/snippet}
		</Field>

		<Field label={i18n.t('items.unit')} error={errors.unitId ? i18n.t(errors.unitId) : null}>
			{#snippet children(f)}
				<Select name="unit" bind:value={unit} options={unitOptions} {...f} />
			{/snippet}
		</Field>

		{#if formError}<Alert tone="danger">{i18n.t(formError)}</Alert>{/if}
	</form>

	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<Button type="submit" form="item-form" loading={saving}>
			{i18n.t(item ? 'items.save' : 'items.create')}
		</Button>
	{/snippet}
</Dialog>
