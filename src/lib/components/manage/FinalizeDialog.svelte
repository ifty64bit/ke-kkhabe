<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { computeCharges } from '#lib/charges.ts';
	import { formatTaka, lineTotal, parseTaka, type Poisha } from '#lib/money.ts';
	import { formatQty, pricePerPiece, toBuy } from '#lib/quantity.ts';
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

	/** `auto`: the amount follows the bill total until the manager types their own. */
	type PaymentRow = { id: number; userId: string; amount: string; auto: boolean };

	let {
		open = $bindable(false),
		menu,
		people,
		existingPayments = null,
		deliveryFee = 0,
		discount = 0,
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
		/** The day's discount, non-zero after reopening. */
		discount?: Poisha;
		meId: string;
		payerOptions: { value: string; label: string }[];
		errors?: Record<string, MessageKey>;
		errorParams?: Record<string, Record<string, string | number>>;
	} = $props();

	const i18n = useI18n();

	const lineKey = (userId: string, itemId: string) => `${userId}:${itemId}`;
	/** Poisha to an input string; anything that isn't a finite amount becomes empty, never "NaN". */
	const takaInput = (p: Poisha | null | undefined) =>
		typeof p !== 'number' || !Number.isFinite(p) || p === 0
			? ''
			: p % 100 === 0
				? String(p / 100)
				: (p / 100).toFixed(2);
	const isAvailable = (itemId: string) => menu.find((m) => m.id === itemId)?.available !== false;
	/** Same rule as the server: an empty taka field means 0. */
	const takaOrZero = (raw: string | undefined) =>
		(raw ?? '').trim() === '' ? 0 : parseTaka(raw ?? '');

	const initialFinal = () =>
		Object.fromEntries(
			people.flatMap((p) =>
				p.lines.map((l) => [
					lineKey(p.id, l.itemId),
					l.finalQuantity ?? (isAvailable(l.itemId) ? l.quantity : 0)
				])
			)
		);
	const unitsIn = (q: Record<string, number>, itemId: string) =>
		people.reduce(
			(a, p) =>
				a +
				p.lines.reduce(
					(b, l) => b + (l.itemId === itemId ? (q[lineKey(p.id, l.itemId)] ?? 0) : 0),
					0
				),
			0
		);

	/** Saved per-piece price after a reopen, else the last price used, else empty. */
	const initialPrices = (q: Record<string, number>) => {
		const prices: Record<string, string> = {};
		for (const m of menu) {
			const n = unitsIn(q, m.id);
			prices[m.id] =
				m.totalCost !== null && m.totalCost !== undefined && n > 0
					? takaInput(pricePerPiece(m.totalCost, n)) || '0'
					: m.suggestion
						? takaInput(Math.round(m.suggestion.perUnit))
						: '';
		}
		return prices;
	};

	let finalQty = $state<Record<string, number>>(initialFinal());
	let prices = $state<Record<string, string>>(initialPrices(initialFinal()));
	const initialFee = () => takaInput(deliveryFee);
	const initialDiscount = () => takaInput(discount);
	let fee = $state(initialFee());
	let disc = $state(initialDiscount());
	let rowId = 0;
	type Row = PaymentRow;
	let rows = $state<Row[]>([]);
	let saving = $state(false);

	const unitsOf = (itemId: string) => unitsIn(finalQty, itemId);
	/** An item's cost from the current inputs, or null while its input is invalid or missing. */
	const costOf = (itemId: string): Poisha | null => {
		const n = unitsOf(itemId);
		if (n === 0) return 0;
		const raw = prices[itemId];
		if ((raw ?? '').trim() === '') return null;
		const v = parseTaka(raw ?? '');
		if (v === null) return null;
		return lineTotal(toBuy(n), v);
	};

	const makeRows = (total: Poisha): Row[] =>
		existingPayments && existingPayments.length > 0
			? existingPayments.map((p) => ({
					id: rowId++,
					userId: p.userId,
					amount: takaInput(p.amount),
					auto: false
				}))
			: [{ id: rowId++, userId: meId, amount: total <= 0 ? '' : takaInput(total), auto: true }];
	const currentTotal = () =>
		menu.reduce((a, m) => a + (costOf(m.id) ?? 0), 0) +
		(takaOrZero(fee) ?? 0) -
		(takaOrZero(disc) ?? 0);

	// Rebuild the form each time the dialog opens; `.pre` so no control binds to
	// a missing value on first open (see OrderDialog).
	// Only `open` is tracked: the reset reads the very state it writes, which would loop.
	$effect.pre(() => {
		if (!open) return;
		untrack(() => {
			finalQty = initialFinal();
			prices = initialPrices(finalQty);
			fee = initialFee();
			disc = initialDiscount();
			rows = makeRows(currentTotal());
			saving = false;
		});
	});

	const errText = (field: string) => {
		const key = errors[field];
		return key ? i18n.t(key, errorParams[field]) : null;
	};

	const eaten = $derived(menu.filter((m) => unitsOf(m.id) > 0));
	const itemsTotal = $derived(menu.reduce((a, m) => a + (costOf(m.id) ?? 0), 0));
	const feePoisha = $derived(takaOrZero(fee) ?? 0);
	const discPoisha = $derived(takaOrZero(disc) ?? 0);
	const grandTotal = $derived(itemsTotal + feePoisha - discPoisha);
	const paidTotal = $derived(rows.reduce((a, r) => a + (takaOrZero(r.amount) ?? 0), 0));
	const mismatch = $derived(grandTotal - paidTotal);

	// Client-side preview with the same rules as `chargesForDay`.
	const preview = $derived(
		computeCharges(
			menu.map((m) => ({ itemId: m.id, totalCost: costOf(m.id) ?? 0 })),
			people.flatMap((p) =>
				p.lines.map((l) => ({
					userId: p.id,
					itemId: l.itemId,
					finalQuantity: finalQty[lineKey(p.id, l.itemId)] ?? 0
				}))
			),
			feePoisha,
			discPoisha
		)
	);
	const discountTooHigh = $derived([...preview.values()].some((c) => c < 0));
	const amountsValid = $derived(
		eaten.every((m) => costOf(m.id) !== null) &&
			takaOrZero(fee) !== null &&
			takaOrZero(disc) !== null &&
			rows.every((r) => takaOrZero(r.amount) !== null)
	);
	const canSubmit = $derived(amountsValid && !discountTooHigh && mismatch === 0);

	// One payer who hasn't typed an amount paid the whole bill: keep their amount equal to the total.
	$effect(() => {
		const total = grandTotal;
		if (rows.length !== 1 || !rows[0].auto) return;
		untrack(() => (rows[0].amount = total > 0 ? takaInput(total) : ''));
	});
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
			<div class="mt-2 flex flex-col gap-5">
				{#each eaten as m (m.id)}
					{@const unit = i18n.pick(m.unitBn, m.unitEn)}
					{@const n = unitsOf(m.id)}
					{@const cost = costOf(m.id)}
					<Field
						label={i18n.t('manage.finalize.priceLabel', { name: m.name, unit })}
						hint={cost !== null
							? i18n.t('manage.finalize.lineTotal', {
									count: i18n.num(toBuy(n)),
									unit,
									price: formatTaka(parseTaka(prices[m.id] ?? '') ?? 0, i18n.locale),
									total: formatTaka(cost, i18n.locale)
								})
							: m.suggestion
								? i18n.t('manage.finalize.perUnitHint', {
										unit,
										price: formatTaka(Math.round(m.suggestion.perUnit), i18n.locale)
									})
								: i18n.t('manage.finalize.unitsTotal', { count: formatQty(n, i18n.locale), unit })}
						error={errText(`price:${m.id}`)}
					>
						{#snippet children(f)}
							<Input name="price:{m.id}" bind:value={prices[m.id]} inputmode="decimal" {...f} />
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
									<span class="text-sm text-muted tabular-nums"
										>{formatQty(units, i18n.locale)}</span
									>
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

		<section class="mt-6 grid gap-4 sm:grid-cols-2">
			<Field label={i18n.t('manage.finalize.feeLabel')} error={errText('deliveryFee')}>
				{#snippet children(f)}
					<Input name="deliveryFee" bind:value={fee} inputmode="decimal" {...f} />
				{/snippet}
			</Field>
			<Field
				label={i18n.t('manage.finalize.discountLabel')}
				hint={i18n.t('manage.finalize.discountHint')}
				error={discountTooHigh
					? i18n.t('manage.finalize.error.discountTooHigh')
					: errText('discount')}
			>
				{#snippet children(f)}
					<Input name="discount" bind:value={disc} inputmode="decimal" {...f} />
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
								<Input
									name="paid"
									bind:value={row.amount}
									oninput={() => (row.auto = false)}
									inputmode="decimal"
									{...f}
								/>
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
				onclick={() => rows.push({ id: rowId++, userId: '', amount: '', auto: false })}
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
			{#if discPoisha > 0}
				<div class="flex justify-between text-sm">
					<span class="text-muted">{i18n.t('manage.finalize.discount')}</span>
					<span class="tabular-nums">−<Money value={discPoisha} /></span>
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
