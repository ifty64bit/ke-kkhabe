<script lang="ts">
	import { enhance } from '$app/forms';
	import { computeCharges } from '#lib/charges.ts';
	import { formatTaka, parseTaka, type Poisha } from '#lib/money.ts';
	import {
		Alert,
		Avatar,
		Button,
		Dialog,
		Field,
		IconButton,
		Input,
		Money,
		QuantityStepper,
		Select
	} from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';

	type Menu = {
		id: string;
		name: string;
		unitBn: string;
		unitEn: string;
		available: boolean;
		purchaseUnits: number;
		totalCost: Poisha | null;
		suggestion: { suggestion: number; perUnit: number } | null;
	};

	type Person = {
		id: string;
		name: string;
		image: string | null;
		lines: { itemId: string; quantity: number; finalQuantity: number | null }[];
	};

	type PaymentRow = { id: number; userId: string; amount: string };

	let {
		open = $bindable(false),
		menu,
		people,
		existingPayments = null,
		deliveryFee = 0,
		meId,
		payerOptions,
		errors = {},
		errorParams = {}
	}: {
		open?: boolean;
		menu: Menu[];
		/** Members with order lines, in display order. */
		people: Person[];
		/** Existing rows after reopening a finalized day, if any. */
		existingPayments: { userId: string; amount: Poisha }[] | null;
		/** The day's delivery fee, non-zero after reopening. */
		deliveryFee?: Poisha;
		meId: string;
		payerOptions: { value: string; label: string }[];
		errors?: Record<string, MessageKey>;
		errorParams?: Record<string, Record<string, string | number>>;
	} = $props();

	const i18n = useI18n();

	const lineKey = (userId: string, itemId: string) => `${userId}:${itemId}`;
	const takaInput = (p: Poisha) =>
		p === 0 ? '' : p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2);
	const isAvailable = (itemId: string) => menu.find((m) => m.id === itemId)?.available !== false;

	const initialCosts = () =>
		Object.fromEntries(
			menu.map((m) => [
				m.id,
				m.totalCost !== null && m.totalCost !== undefined
					? takaInput(m.totalCost)
					: m.suggestion
						? takaInput(m.suggestion.suggestion)
						: ''
			])
		);
	const initialFinal = () =>
		Object.fromEntries(
			people.flatMap((p) =>
				p.lines.map((l) => [
					lineKey(p.id, l.itemId),
					l.finalQuantity ?? (isAvailable(l.itemId) ? l.quantity : 0)
				])
			)
		);
	let rowId = 0;
	const initialRows = (total: Poisha): PaymentRow[] => {
		const make = (userId: string, amount: string) => ({ id: rowId++, userId, amount });
		return existingPayments && existingPayments.length > 0
			? existingPayments.map((p) => make(p.userId, takaInput(p.amount)))
			: [make(meId, total === 0 ? '' : takaInput(total))];
	};
	const initialFee = () => takaInput(deliveryFee);
	const initialTotal = () =>
		menu.reduce((a, m) => a + (m.totalCost ?? m.suggestion?.suggestion ?? 0), 0) + deliveryFee;

	let costs = $state<Record<string, string>>(initialCosts());
	let finalQty = $state<Record<string, number>>(initialFinal());
	let fee = $state(initialFee());
	let rows = $state<PaymentRow[]>(initialRows(initialTotal()));
	let saving = $state(false);

	// Rebuild the form each time the dialog opens; `.pre` so no control binds to
	// a missing value on first open (see OrderDialog).
	$effect.pre(() => {
		if (open) {
			costs = initialCosts();
			finalQty = initialFinal();
			fee = initialFee();
			rows = initialRows(initialTotal());
			saving = false;
		}
	});

	const errText = (field: string) => {
		const key = errors[field];
		return key ? i18n.t(key, errorParams[field]) : null;
	};

	const hintOf = (m: Menu) => {
		const unit = i18n.pick(m.unitBn, m.unitEn);
		const parts: string[] = [];
		if (m.suggestion)
			parts.push(
				i18n.t('manage.finalize.perUnitHint', {
					unit,
					price: formatTaka(Math.round(m.suggestion.perUnit), i18n.locale)
				})
			);
		parts.push(i18n.t('manage.finalize.unitsTotal', { count: i18n.num(m.purchaseUnits), unit }));
		return parts.join(' · ');
	};

	// Live totals, computed exactly like the server does.
	const itemsTotal = $derived(menu.reduce((a, m) => a + (parseTaka(costs[m.id] ?? '') ?? 0), 0));
	const feePoisha = $derived(parseTaka(fee) ?? 0);
	const grandTotal = $derived(itemsTotal + feePoisha);
	const paidTotal = $derived(rows.reduce((a, r) => a + (parseTaka(r.amount) ?? 0), 0));
	const mismatch = $derived(grandTotal - paidTotal);
	/** Same rule as the server: an empty taka field means 0. */
	const takaOrZero = (raw: string | undefined) =>
		(raw ?? '').trim() === '' ? 0 : parseTaka(raw ?? '');
	const amountsValid = $derived(
		menu.every((m) => takaOrZero(costs[m.id]) !== null) &&
			takaOrZero(fee) !== null &&
			rows.every((r) => takaOrZero(r.amount) !== null)
	);
	const canSubmit = $derived(amountsValid && mismatch === 0);

	// Client-side preview with the same rules as `chargesForDay`.
	const preview = $derived(
		computeCharges(
			menu.map((m) => ({ itemId: m.id, totalCost: parseTaka(costs[m.id] ?? '') ?? 0 })),
			people.flatMap((p) =>
				p.lines.map((l) => ({
					userId: p.id,
					itemId: l.itemId,
					finalQuantity: finalQty[lineKey(p.id, l.itemId)] ?? 0
				}))
			),
			feePoisha
		)
	);
	const previewRows = $derived(
		people
			.map((p) => ({ person: p, amount: preview.get(p.id) ?? null }))
			.filter((r): r is { person: Person; amount: Poisha } => r.amount !== null)
	);
</script>

<Dialog
	bind:open
	size="lg"
	title={i18n.t('manage.finalize.title')}
	description={i18n.t('manage.finalize.description')}
>
	<form
		id="finalize-form"
		method="POST"
		action="?/finalize"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					open = false;
					await update();
				} else if (result.type === 'failure') {
					await update();
				} else {
					await update();
				}
			};
		}}
	>
		<section>
			<h3 class="text-sm font-semibold text-muted">{i18n.t('manage.finalize.itemsTitle')}</h3>
			<div class="mt-2 flex flex-col gap-4">
				{#each menu as m (m.id)}
					<Field
						label={i18n.t('manage.finalize.costLabel', { name: m.name })}
						hint={hintOf(m)}
						error={errText(`cost:${m.id}`)}
					>
						{#snippet children(f)}
							<Input name="cost:{m.id}" bind:value={costs[m.id]} inputmode="decimal" {...f} />
						{/snippet}
					</Field>
				{/each}
			</div>
		</section>

		{#if people.length > 0}
			<section class="mt-6">
				<h3 class="text-sm font-semibold text-muted">{i18n.t('manage.finalize.peopleTitle')}</h3>
				<p class="mt-1 text-sm text-muted">{i18n.t('manage.finalize.peopleHint')}</p>
				<ul class="mt-2 divide-y divide-border">
					{#each people as p, i (p.id)}
						{@const units = p.lines.reduce(
							(a, l) => a + (finalQty[lineKey(p.id, l.itemId)] ?? 0),
							0
						)}
						<li>
							<details open={i === 0} class="group py-1">
								<summary
									class="flex cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden"
								>
									<Avatar name={p.name} src={p.image} size="sm" />
									<span class="min-w-0 flex-1 truncate">{p.name}</span>
									<span class="text-sm text-muted tabular-nums">{i18n.num(units)}</span>
									<svg
										viewBox="0 0 24 24"
										class="size-4 text-muted transition-transform group-open:rotate-90"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg
									>
								</summary>
								<div class="pb-2">
									{#each p.lines as l (l.itemId)}
										{@const m = menu.find((x) => x.id === l.itemId)}
										<div class="flex items-center justify-between gap-4 py-2">
											<span>{m?.name ?? ''}</span>
											<QuantityStepper
												bind:value={finalQty[lineKey(p.id, l.itemId)]}
												name="final:{lineKey(p.id, l.itemId)}"
												label={m?.name ?? ''}
											/>
										</div>
									{/each}
								</div>
							</details>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="mt-6">
			<Field
				label={i18n.t('manage.finalize.feeLabel')}
				error={errText('deliveryFee')}
				class="max-w-48"
			>
				{#snippet children(f)}
					<Input name="deliveryFee" bind:value={fee} inputmode="decimal" {...f} />
				{/snippet}
			</Field>
		</section>

		<section class="mt-6">
			<h3 class="text-sm font-semibold text-muted">{i18n.t('manage.finalize.paymentsTitle')}</h3>
			{#if errText('payments')}
				<Alert tone="danger" class="mt-2">{errText('payments')}</Alert>
			{/if}
			<ul class="mt-2 flex flex-col gap-3">
				{#each rows as row, n (row.id)}
					<li class="flex items-start gap-2">
						<Field
							label={i18n.t('manage.finalize.payerLabel', { n: n + 1 })}
							error={errText(`payer:${n}`)}
							class="min-w-0 flex-1"
						>
							{#snippet children(f)}
								<Select
									name="payer"
									bind:value={row.userId}
									options={payerOptions}
									placeholder={i18n.t('manage.finalize.payerPlaceholder')}
									{...f}
								/>
							{/snippet}
						</Field>
						<Field
							label={i18n.t('manage.finalize.paidLabel')}
							error={errText(`paid:${n}`)}
							class="w-28 sm:w-36"
						>
							{#snippet children(f)}
								<Input name="paid" bind:value={row.amount} inputmode="decimal" {...f} />
							{/snippet}
						</Field>
						<IconButton
							class="mt-7"
							label={i18n.t('manage.finalize.removeRow')}
							onclick={() => rows.splice(n, 1)}
						>
							<svg
								viewBox="0 0 24 24"
								class="size-5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg
							>
						</IconButton>
					</li>
				{/each}
			</ul>
			<Button
				variant="ghost"
				size="sm"
				class="mt-1"
				onclick={() => rows.push({ id: rowId++, userId: '', amount: '' })}
			>
				+ {i18n.t('manage.finalize.addPayment')}
			</Button>
		</section>

		{#if previewRows.length > 0}
			<section class="mt-6">
				<h3 class="text-sm font-semibold text-muted">{i18n.t('manage.finalize.previewTitle')}</h3>
				<ul class="mt-2 divide-y divide-border">
					{#each previewRows as { person, amount } (person.id)}
						<li class="flex items-center gap-3 py-2">
							<Avatar name={person.name} src={person.image} size="sm" />
							<span class="min-w-0 flex-1 truncate">{person.name}</span>
							<Money value={amount} />
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div
			class="sticky bottom-0 -mx-5 mt-6 -mb-4 flex flex-col gap-1 border-t border-border bg-surface px-5 pt-3 pb-4"
		>
			<div class="flex justify-between text-sm">
				<span class="text-muted">{i18n.t('manage.finalize.itemsCost')}</span>
				<Money value={itemsTotal} />
			</div>
			{#if feePoisha > 0}
				<div class="flex justify-between text-sm">
					<span class="text-muted">{i18n.t('manage.finalize.deliveryFee')}</span>
					<Money value={feePoisha} />
				</div>
			{/if}
			<div class="flex justify-between font-semibold">
				<span>{i18n.t('manage.finalize.grandTotal')}</span>
				<Money value={grandTotal} />
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-muted">{i18n.t('manage.finalize.paid')}</span>
				<Money value={paidTotal} />
			</div>
			{#if mismatch !== 0}
				<div class="flex justify-between text-sm text-danger">
					<span>{i18n.t(mismatch > 0 ? 'manage.finalize.remaining' : 'manage.finalize.extra')}</span
					>
					<Money value={Math.abs(mismatch)} />
				</div>
			{/if}
		</div>
	</form>

	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<Button type="submit" form="finalize-form" disabled={!canSubmit} loading={saving}>
			{i18n.t('manage.finalize.submit')}
		</Button>
	{/snippet}
</Dialog>
