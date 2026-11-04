<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Button,
		Dialog,
		Field,
		Input,
		SegmentedControl,
		Select
	} from '#lib/components/ui/index.ts';
	import { canRecordSettlement } from '#lib/ledger.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import { formatTaka, parseTaka, type Poisha } from '#lib/money.ts';

	type Person = { id: string; name: string; active: boolean };
	type Transfer = { from: string; to: string; amount: Poisha };

	let {
		open = $bindable(false),
		prefill = null,
		people,
		meId,
		isManager,
		balances,
		today
	}: {
		open?: boolean;
		/** A suggested transfer to start from, or null for a blank form. */
		prefill?: Transfer | null;
		people: Person[];
		meId: string;
		isManager: boolean;
		/** Current balance per user id (poisha), for the soft over-payment warning. */
		balances: Record<string, Poisha>;
		/** Today in Dhaka, the default settlement date. */
		today: string;
	} = $props();

	const i18n = useI18n();

	type Result = { messageKey?: MessageKey; errors?: Record<string, MessageKey> } | null;

	let direction = $state<'paid' | 'received'>('paid');
	let otherId = $state('');
	let fromId = $state('');
	let toId = $state('');
	let amount = $state('');
	let note = $state('');
	let date = $state('');
	let saving = $state(false);
	let result = $state<Result>(null);

	// Initialize the controls before the DOM updates so no bind:value ever sees undefined.
	$effect.pre(() => {
		if (!open) return;
		const taka = (poisha: number) =>
			poisha % 100 === 0 ? String(poisha / 100) : (poisha / 100).toFixed(2);
		if (prefill && canRecordSettlement(meId, isManager, prefill.from, prefill.to)) {
			if (isManager) {
				fromId = prefill.from;
				toId = prefill.to;
			} else {
				direction = prefill.from === meId ? 'paid' : 'received';
				otherId = prefill.from === meId ? prefill.to : prefill.from;
			}
			amount = taka(prefill.amount);
		} else {
			direction = 'paid';
			otherId = '';
			fromId = '';
			toId = '';
			amount = '';
		}
		note = '';
		date = today;
		result = null;
	});

	const from = $derived(isManager ? fromId : direction === 'paid' ? meId : otherId);
	const to = $derived(isManager ? toId : direction === 'paid' ? otherId : meId);

	const option = (p: Person) => ({
		value: p.id,
		label: p.active ? p.name : `${p.name} (${i18n.t('manage.person.inactive')})`
	});
	const others = $derived(people.filter((p) => p.id !== meId).map(option));
	const pickFrom = $derived(people.filter((p) => p.id !== to).map(option));
	const pickTo = $derived(people.filter((p) => p.id !== from).map(option));

	// Soft, never blocking: paying more than is owed is fine (people pay ahead).
	// The most that can be owed between two people: the payer's debt, capped by the receiver's credit.
	const owedBetween = $derived.by(() => {
		if (!from || !to || from === to) return 0;
		const debt = Math.max(0, -(balances[from] ?? 0));
		const credit = Math.max(0, balances[to] ?? 0);
		return Math.min(debt, credit);
	});
	const parsedAmount = $derived(parseTaka(amount));
	const overOwed = $derived(
		from !== '' && to !== '' && from !== to && parsedAmount !== null && parsedAmount > owedBetween
	);
	const ready = $derived(from !== '' && to !== '' && from !== to && parsedAmount !== null);

	const fieldError = (field: string) => {
		const key = result?.errors?.[field];
		return key ? i18n.t(key) : null;
	};

	const submit = () => {
		saving = true;
		return async ({
			result: r,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			saving = false;
			if (r.type === 'success') {
				result = null;
				open = false;
				await update();
			} else if (r.type === 'failure') {
				result = (r.data ?? {}) as Result;
			} else {
				await update();
			}
		};
	};
</script>

<Dialog bind:open title={i18n.t('ledger.recordTitle')} description={i18n.t('ledger.recordBody')}>
	<form
		id="record-form"
		method="POST"
		action="?/record"
		use:enhance={submit}
		class="flex flex-col gap-4"
	>
		{#if !isManager}
			<input type="hidden" name="from" value={from} />
			<input type="hidden" name="to" value={to} />
		{/if}

		{#if isManager}
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label={i18n.t('ledger.fromLabel')} error={fieldError('from')}>
					{#snippet children(f)}
						<Select
							name="from"
							bind:value={fromId}
							options={pickFrom}
							placeholder={i18n.t('ledger.pickMember')}
							describedBy={f.describedBy}
							invalid={f.invalid}
						/>
					{/snippet}
				</Field>
				<Field label={i18n.t('ledger.toLabel')} error={fieldError('to')}>
					{#snippet children(f)}
						<Select
							name="to"
							bind:value={toId}
							options={pickTo}
							placeholder={i18n.t('ledger.pickMember')}
							describedBy={f.describedBy}
							invalid={f.invalid}
						/>
					{/snippet}
				</Field>
			</div>
		{:else}
			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium">{i18n.t('ledger.direction')}</span>
				<SegmentedControl
					bind:value={direction}
					label={i18n.t('ledger.direction')}
					options={[
						{ value: 'paid', label: i18n.t('ledger.dirPaid') },
						{ value: 'received', label: i18n.t('ledger.dirReceived') }
					]}
				/>
			</div>
			<Field label={i18n.t('ledger.pickMember')} error={fieldError('to')}>
				{#snippet children(f)}
					<Select
						bind:value={otherId}
						options={others}
						placeholder={i18n.t('ledger.pickMember')}
						describedBy={f.describedBy}
						invalid={f.invalid}
					/>
				{/snippet}
			</Field>
		{/if}

		<Field label={i18n.t('ledger.amountLabel')} error={fieldError('amount')}>
			{#snippet children(f)}
				<Input
					name="amount"
					inputmode="decimal"
					autocomplete="off"
					bind:value={amount}
					describedBy={f.describedBy}
					invalid={f.invalid}
				/>
			{/snippet}
		</Field>
		{#if overOwed}
			<Alert tone="warning" class="-mt-2">
				{owedBetween > 0
					? i18n.t('ledger.warnOver', { amount: formatTaka(owedBetween, i18n.locale) })
					: i18n.t('ledger.warnNothingOwed')}
			</Alert>
		{/if}

		<Field label={i18n.t('ledger.noteLabel')} error={fieldError('note')}>
			{#snippet children(f)}
				<Input
					name="note"
					maxlength={100}
					autocomplete="off"
					bind:value={note}
					describedBy={f.describedBy}
					invalid={f.invalid}
				/>
			{/snippet}
		</Field>

		<Field label={i18n.t('ledger.dateLabel')} error={fieldError('date')}>
			{#snippet children(f)}
				<Input
					name="date"
					type="date"
					bind:value={date}
					describedBy={f.describedBy}
					invalid={f.invalid}
				/>
			{/snippet}
		</Field>

		{#if result?.messageKey}
			<Alert tone="danger">{i18n.t(result.messageKey)}</Alert>
		{/if}
	</form>

	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<Button type="submit" form="record-form" disabled={!ready} loading={saving}>
			{i18n.t('ledger.recordSubmit')}
		</Button>
	{/snippet}
</Dialog>
