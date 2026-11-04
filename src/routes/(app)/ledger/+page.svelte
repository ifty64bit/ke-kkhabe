<script lang="ts">
	import { enhance } from '$app/forms';
	import RecordDialog from '#lib/components/ledger/RecordDialog.svelte';
	import { canRecordSettlement, canVoidSettlement } from '#lib/ledger.ts';
	import { formatTaka } from '#lib/money.ts';
	import {
		Alert,
		Avatar,
		Badge,
		Button,
		Card,
		Dialog,
		EmptyState,
		Menu,
		MenuItem,
		Money,
		PageHeader
	} from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const i18n = useI18n();

	type Suggestion = (typeof data.suggestions)[number];
	type SettlementRow = (typeof data.recent)[number];

	let recordOpen = $state(false);
	let prefill = $state<Suggestion | null>(null);

	const openRecord = (p: Suggestion | null) => {
		prefill = p;
		recordOpen = true;
	};

	const myTransfers = $derived(data.suggestions.filter((s) => s.from === data.meId));
	const balanceKey = $derived<MessageKey>(
		data.myBalance > 0
			? 'ledger.youGet'
			: data.myBalance < 0
				? 'ledger.youOwe'
				: 'ledger.youSettled'
	);
	const balanceTone = $derived(
		data.myBalance > 0 ? 'text-success' : data.myBalance < 0 ? 'text-danger' : 'text-fg'
	);

	let voiding = $state<SettlementRow | null>(null);
	let voidOpen = $state(false);
	let voidError = $state<MessageKey | null>(null);
	let voidSaving = $state(false);

	const askVoid = (s: SettlementRow) => {
		voiding = s;
		voidError = null;
		voidOpen = true;
	};
	const voidEnhance = () => {
		voidSaving = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			voidSaving = false;
			if (result.type === 'failure')
				voidError = (result.data?.messageKey as MessageKey) ?? 'ledger.error.invalid';
			else {
				voidOpen = false;
				await update();
			}
		};
	};

	const transferText = (s: { fromName: string; toName: string; amount: number }) =>
		i18n.t('ledger.transferRow', {
			from: s.fromName,
			to: s.toName,
			amount: formatTaka(s.amount, i18n.locale)
		});
</script>

<svelte:head><title>{i18n.t('ledger.title')} · {i18n.t('app.name')}</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader title={i18n.t('ledger.title')} description={i18n.t('ledger.description')}>
		{#snippet actions()}
			{#if data.hasFinalized}
				<Button variant="secondary" onclick={() => openRecord(null)}>
					{i18n.t('ledger.payCta')}
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if !data.hasFinalized}
		<Card class="mt-8" padding="none">
			<EmptyState title={i18n.t('ledger.emptyTitle')} description={i18n.t('ledger.emptyBody')} />
		</Card>
	{:else}
		<section class="mt-8">
			<p class="text-2xl font-semibold sm:text-3xl {balanceTone}">
				{i18n.t(balanceKey, { amount: formatTaka(Math.abs(data.myBalance), i18n.locale) })}
			</p>
			{#if myTransfers.length > 0}
				<ul class="mt-4 space-y-2">
					{#each myTransfers as t (t.to)}
						<li
							class="flex items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3"
						>
							<span class="min-w-0 truncate">
								{i18n.t('ledger.transferGive', {
									name: t.toName,
									amount: formatTaka(t.amount, i18n.locale)
								})}
							</span>
							<Button variant="secondary" size="sm" onclick={() => openRecord(t)}>
								{i18n.t('ledger.markPaid')}
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<Card class="mt-8" title={i18n.t('ledger.everyoneTitle')} padding="none">
			<ul class="divide-y divide-border">
				{#each data.balances as p (p.id)}
					<li class="flex items-center gap-3 px-4 py-3">
						<Avatar name={p.name} src={p.image} class={p.active ? '' : 'opacity-60'} />
						<div class="min-w-0 flex-1">
							<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="truncate font-medium">{p.name}</span>
								{#if p.id === data.meId}<Badge>{i18n.t('members.you')}</Badge>{/if}
								{#if p.role === 'manager'}
									<Badge tone="highlight">{i18n.t('account.manager')}</Badge>
								{/if}
								{#if !p.active}
									<Badge>{i18n.t('manage.person.inactive')}</Badge>
								{/if}
							</p>
						</div>
						<Money value={p.balance} balance class="font-semibold" />
					</li>
				{/each}
			</ul>
		</Card>

		{#if data.suggestions.length > 0}
			<Card
				class="mt-8"
				title={i18n.t('ledger.suggestTitle')}
				description={i18n.t('ledger.suggestBody')}
			>
				<ul class="-mx-1 divide-y divide-border">
					{#each data.suggestions as s, i (i)}
						<li class="flex items-center justify-between gap-3 px-1 py-2.5">
							<span class="min-w-0 truncate">{transferText(s)}</span>
							{#if canRecordSettlement(data.meId, data.isManager, s.from, s.to)}
								<Button variant="secondary" size="sm" onclick={() => openRecord(s)}>
									{i18n.t('ledger.recordShort')}
								</Button>
							{/if}
						</li>
					{/each}
				</ul>
			</Card>
		{/if}

		<Card class="mt-8" title={i18n.t('ledger.recentTitle')} padding="none">
			{#if data.recent.length === 0}
				<p class="px-4 pb-4 text-sm text-muted">{i18n.t('ledger.recentEmpty')}</p>
			{:else}
				<ul class="divide-y divide-border">
					{#each data.recent as s (s.id)}
						{@const canVoid = canVoidSettlement(data.meId, data.isManager, s.createdBy)}
						<li class="flex items-start justify-between gap-2 px-4 py-3">
							<div class="min-w-0">
								<p class="truncate font-medium">{transferText(s)}</p>
								<p class="text-sm text-muted">
									{i18n.day(s.date)}{#if s.note}<span class="truncate"> · {s.note}</span>{/if}
								</p>
								{#if s.createdByName && s.createdBy !== s.fromId && s.createdBy !== s.toId}
									<p class="text-xs text-muted">
										{i18n.t('ledger.loggedBy', { name: s.createdByName })}
									</p>
								{/if}
							</div>
							{#if canVoid}
								<Menu label={i18n.t('ledger.rowMenu')}>
									{#snippet trigger()}
										<span
											class="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
										>
											<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true"
												><circle cx="12" cy="5" r="1.75" /><circle
													cx="12"
													cy="12"
													r="1.75"
												/><circle cx="12" cy="19" r="1.75" /></svg
											>
										</span>
									{/snippet}
									{#snippet children({ close })}
										<MenuItem
											tone="danger"
											onclick={() => {
												close();
												askVoid(s);
											}}>{i18n.t('ledger.voidCta')}</MenuItem
										>
									{/snippet}
								</Menu>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	{/if}
</main>

<RecordDialog
	bind:open={recordOpen}
	{prefill}
	people={data.people}
	meId={data.meId}
	isManager={data.isManager}
	suggestions={data.suggestions}
	balances={Object.fromEntries(data.balances.map((b) => [b.id, b.balance]))}
	today={data.today}
/>

<Dialog bind:open={voidOpen} size="sm" title={i18n.t('ledger.voidTitle')}>
	{#if voiding}
		<p class="font-medium">{transferText(voiding)}</p>
	{/if}
	<p class="mt-2 text-sm text-muted">{i18n.t('ledger.voidBody')}</p>
	{#if voidError}<Alert tone="danger" class="mt-3">{i18n.t(voidError)}</Alert>{/if}
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<form method="POST" action="?/void" use:enhance={voidEnhance}>
			<input type="hidden" name="id" value={voiding?.id} />
			<Button type="submit" variant="danger" loading={voidSaving}>
				{i18n.t('ledger.voidCta')}
			</Button>
		</form>
	{/snippet}
</Dialog>
