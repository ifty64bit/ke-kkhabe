<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FinalizeDialog from '#lib/components/manage/FinalizeDialog.svelte';
	import MemberOrderDialog from '#lib/components/manage/MemberOrderDialog.svelte';
	import MenuDialog from '#lib/components/manage/MenuDialog.svelte';
	import {
		Alert,
		Avatar,
		Badge,
		Button,
		Card,
		Dialog,
		EmptyState,
		Money
	} from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const i18n = useI18n();

	const status = $derived(data.day?.status ?? null);

	// --- start form (no day yet): defaults to the most recent day's items
	const defaultStart = () => data.lastDayItems;
	let startSel = $state<string[]>(defaultStart());
	const toggleStart = (id: string, on: boolean) =>
		(startSel = on ? [...startSel, id] : startSel.filter((x) => x !== id));

	// --- page-level feedback
	let actionError = $state<MessageKey | null>(null);
	let menuWarn = $state(0);

	// --- dialogs
	let memberOf = $state<string | null>(null);
	let memberOpen = $state(false);
	let menuOpen = $state(false);
	let finalizeOpen = $state(false);
	let closeOpen = $state(false);
	let reopenOpen = $state(false);

	/** Enhance for the plain row actions: surface a failure message at the top. */
	const rowAction = () => {
		actionError = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			if (result.type === 'failure') {
				actionError = (result.data?.messageKey as MessageKey) ?? null;
				return;
			}
			// Close any confirmation that triggered this action, then refresh.
			closeOpen = false;
			reopenOpen = false;
			await update();
		};
	};

	const editing = $derived(data.people.find((p) => p.id === memberOf) ?? null);

	const purchaseSummary = $derived(
		data.menu
			.filter((m) => m.purchaseUnits > 0)
			.map((m) => `${m.name} ${i18n.num(m.purchaseUnits)} ${i18n.pick(m.unitBn, m.unitEn)}`)
			.join(' · ')
	);

	const orderText = (person: (typeof data.people)[number]) =>
		person.lines
			.filter((l) => l.quantity > 0)
			.map((l) => {
				const m = data.menu.find((x) => x.id === l.itemId);
				return m ? `${m.name} ${i18n.num(l.quantity)} ${i18n.pick(m.unitBn, m.unitEn)}` : '';
			})
			.filter(Boolean)
			.join(', ');

	// Active members for the payer select, plus anyone already a payer today.
	const payerOptions = $derived(
		data.members
			.filter((m) => m.active || (data.payments ?? []).some((p) => p.userId === m.id))
			.map((m) => ({ value: m.id, label: m.name }))
	);

	type ChargeRow = { person: (typeof data.people)[number]; amount: number };
	const chargeRows = $derived(
		data.people
			.map((p) => ({
				person: p,
				amount: data.charges?.find((c) => c.userId === p.id)?.amount ?? null
			}))
			.filter((r): r is ChargeRow => r.amount !== null)
	);
	const paymentRows = $derived(
		(data.payments ?? [])
			.map((p) => ({ ...p, person: data.people.find((x) => x.id === p.userId) }))
			.filter((r) => r.person)
	);
</script>

<svelte:head><title>{i18n.t('manage.tabs.today')} · {i18n.t('app.name')}</title></svelte:head>

{#if form?.messageKey}
	<Alert tone="danger" class="mb-4">{i18n.t(form.messageKey)}</Alert>
{/if}
{#if actionError}
	<Alert tone="danger" class="mb-4">{i18n.t(actionError)}</Alert>
{/if}
{#if menuWarn > 0}
	<Alert tone="warning" class="mb-4"
		>{i18n.t('manage.menu.warn', { count: i18n.num(menuWarn) })}</Alert
	>
{/if}

{#snippet peopleList()}
	<Card padding="none">
		<h2 class="px-4 pt-4 text-sm font-semibold text-muted">{i18n.t('manage.day.peopleTitle')}</h2>
		<ul class="mt-1 divide-y divide-border pb-1">
			{#each data.people as p (p.id)}
				<li class="flex items-center gap-3 px-4 py-3">
					<Avatar name={p.name} src={p.image} size="sm" />
					<div class="min-w-0 flex-1">
						<span class="flex items-center gap-2 truncate">
							{p.name}
							{#if !p.active}<Badge>{i18n.t('manage.person.inactive')}</Badge>{/if}
						</span>
						<span
							class="block truncate text-sm {p.eating === null || p.eating === false
								? 'text-muted'
								: ''}"
						>
							{p.eating === null
								? i18n.t('manage.person.noAnswer')
								: p.eating
									? orderText(p) || i18n.t('manage.person.eating')
									: i18n.t('manage.person.saidNo')}
						</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							memberOf = p.id;
							memberOpen = true;
						}}>{i18n.t('manage.person.edit')}</Button
					>
				</li>
			{/each}
		</ul>
	</Card>
{/snippet}

{#if !status || status === 'draft'}
	<Card title={i18n.t('manage.today.emptyTitle')} description={i18n.t('manage.today.emptyBody')}>
		{#if data.items.length === 0}
			<EmptyState
				title={i18n.t('manage.items.emptyTitle')}
				description={i18n.t('manage.items.emptyBody')}
			>
				{#snippet action()}
					<Button href={resolve('/(app)/manage/items')}>{i18n.t('items.add')}</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<form method="POST" action="?/start" use:enhance={rowAction}>
				<p class="text-sm font-semibold text-muted">{i18n.t('manage.start.pickItems')}</p>
				<ul class="mt-1 divide-y divide-border">
					{#each data.items as it (it.id)}
						<li>
							<label class="flex items-center gap-3 py-2.5">
								<input
									type="checkbox"
									name="itemId"
									value={it.id}
									checked={startSel.includes(it.id)}
									onchange={(e) => toggleStart(it.id, e.currentTarget.checked)}
									class="size-5 shrink-0 accent-primary"
								/>
								<span class="text-lg">{it.name}</span>
							</label>
						</li>
					{/each}
				</ul>
				<Button type="submit" block class="mt-4" disabled={startSel.length === 0}>
					{i18n.t('manage.start.submit')}
				</Button>
			</form>
		{/if}
	</Card>
{:else if status === 'open'}
	<Card>
		{#snippet actions()}
			<Badge tone="highlight" dot>{i18n.t('manage.day.open')}</Badge>
		{/snippet}
		<p>
			{i18n.t('manage.day.counts', {
				yes: i18n.num(data.counts.yes),
				no: i18n.num(data.counts.no),
				noAnswer: i18n.num(data.counts.noAnswer)
			})}
		</p>
		<div class="mt-3 rounded-control bg-surface-2 p-3">
			{#if purchaseSummary}
				<p class="text-sm text-muted">{i18n.t('manage.day.purchase')}</p>
				<p class="mt-1 font-semibold">{purchaseSummary}</p>
			{:else}
				<p class="text-sm text-muted">{i18n.t('manage.day.noOrders')}</p>
			{/if}
		</div>
	</Card>

	<div class="mt-4">
		{@render peopleList()}
	</div>

	<div class="mt-4 flex flex-wrap gap-2">
		<Button variant="secondary" onclick={() => (menuOpen = true)}>
			{i18n.t('manage.menu.change')}
		</Button>
		<Button class="flex-1" onclick={() => (closeOpen = true)}>
			{i18n.t('manage.day.closeOrders')}
		</Button>
	</div>
{:else if status === 'closed'}
	<Card title={i18n.t('manage.shopping.title')} description={i18n.t('manage.shopping.hint')}>
		<!-- Shared columns (name | quantity | unit) so quantities line up whatever the unit's length. -->
		<ul class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-2 gap-y-3">
			{#each data.menu.filter((m) => m.purchaseUnits > 0) as m (m.id)}
				<li class="col-span-3 grid grid-cols-subgrid items-baseline">
					<span class="text-xl">{m.name}</span>
					<span class="text-right text-3xl font-semibold tabular-nums">
						{i18n.num(m.purchaseUnits)}
					</span>
					<span class="text-base text-muted">{i18n.pick(m.unitBn, m.unitEn)}</span>
				</li>
			{/each}
		</ul>
	</Card>

	<div class="mt-4">
		{@render peopleList()}
	</div>

	<div class="mt-4 flex flex-wrap gap-2">
		<form method="POST" action="?/reopenOrders" use:enhance={rowAction}>
			<Button type="submit" variant="secondary">{i18n.t('manage.day.reopenOrders')}</Button>
		</form>
		<Button variant="secondary" onclick={() => (menuOpen = true)}>
			{i18n.t('manage.menu.change')}
		</Button>
		<Button class="flex-1" onclick={() => (finalizeOpen = true)}>
			{i18n.t('manage.day.finalizeCta')}
		</Button>
	</div>
{:else if status === 'finalized'}
	<Card>
		{#snippet actions()}
			<Badge tone="success" dot>{i18n.t('manage.day.finalized')}</Badge>
		{/snippet}
		<p class="text-sm text-muted">{i18n.t('manage.summary.grandTotal')}</p>
		<p class="mt-1 text-3xl font-semibold">
			<Money value={data.grandTotal ?? 0} />
		</p>

		{#if paymentRows.length > 0}
			<h3 class="mt-5 text-sm font-semibold text-muted">{i18n.t('manage.summary.paidBy')}</h3>
			<ul class="mt-1 divide-y divide-border">
				{#each paymentRows as row (row.id)}
					<li class="flex items-center gap-3 py-2">
						<Avatar name={row.person!.name} src={row.person!.image} size="sm" />
						<span class="min-w-0 flex-1 truncate">{row.person!.name}</span>
						<Money value={row.amount} />
					</li>
				{/each}
			</ul>
		{/if}

		{#if chargeRows.length > 0}
			<h3 class="mt-5 text-sm font-semibold text-muted">{i18n.t('manage.summary.charges')}</h3>
			<ul class="mt-1 divide-y divide-border">
				{#each chargeRows as row (row.person.id)}
					<li class="flex items-center gap-3 py-2">
						<Avatar name={row.person.name} src={row.person.image} size="sm" />
						<span class="min-w-0 flex-1 truncate">
							{row.person.name}
							{#if !row.person.active}<Badge class="ml-1">{i18n.t('manage.person.inactive')}</Badge
								>{/if}
						</span>
						<Money value={row.amount} />
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-5">
			<Button variant="secondary" onclick={() => (reopenOpen = true)}>
				{i18n.t('manage.summary.reopen')}
			</Button>
		</div>
	</Card>
{/if}

<MemberOrderDialog bind:open={memberOpen} member={editing} items={data.menu} />

<MenuDialog
	bind:open={menuOpen}
	items={data.items}
	availableIds={data.menu.filter((m) => m.available).map((m) => m.id)}
	onwarn={(n) => (menuWarn = n)}
/>

{#if status === 'closed'}
	<FinalizeDialog
		bind:open={finalizeOpen}
		menu={data.menu}
		people={data.people.filter((p) => p.lines.length > 0)}
		existingPayments={data.payments}
		deliveryFee={data.day?.deliveryFee ?? 0}
		discount={data.day?.discount ?? 0}
		meId={data.meId}
		{payerOptions}
		errors={finalizeOpen ? (form?.errors ?? {}) : {}}
		errorParams={finalizeOpen ? (form?.errorParams ?? {}) : {}}
	/>
{/if}

<Dialog
	bind:open={closeOpen}
	size="sm"
	title={i18n.t('manage.day.closeTitle')}
	description={i18n.t('manage.day.closeBody')}
>
	<p>
		{i18n.t('manage.day.counts', {
			yes: i18n.num(data.counts.yes),
			no: i18n.num(data.counts.no),
			noAnswer: i18n.num(data.counts.noAnswer)
		})}
	</p>
	{#if actionError}<Alert tone="danger" class="mt-3">{i18n.t(actionError)}</Alert>{/if}
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<form method="POST" action="?/close" use:enhance={rowAction}>
			<Button type="submit">{i18n.t('manage.day.closeOrders')}</Button>
		</form>
	{/snippet}
</Dialog>

<Dialog
	bind:open={reopenOpen}
	size="sm"
	title={i18n.t('manage.summary.reopenTitle')}
	description={i18n.t('manage.summary.reopenBody')}
>
	{#if actionError}<Alert tone="danger">{i18n.t(actionError)}</Alert>{/if}
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<form method="POST" action="?/reopenDay" use:enhance={rowAction}>
			<Button type="submit">{i18n.t('manage.summary.reopen')}</Button>
		</form>
	{/snippet}
</Dialog>
