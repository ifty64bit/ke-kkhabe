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
		Field,
		Menu,
		MenuItem,
		Money,
		PageHeader,
		Textarea
	} from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const i18n = useI18n();

	type Suggestion = (typeof data.suggestions)[number];
	type SettlementRow = (typeof data.recent)[number];
	type AwaitingRow = (typeof data.awaitingMe)[number];

	let recordOpen = $state(false);
	let prefill = $state<Suggestion | null>(null);
	/** Name of the receiver of the last pending settlement, for the sent-for-approval alert. */
	let sentTo = $state<string | null>(null);

	const openRecord = (p: Suggestion | null) => {
		prefill = p;
		sentTo = null;
		recordOpen = true;
	};

	const onsaved = (pending: boolean, toName: string) => {
		if (pending) sentTo = toName;
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

	let approving = $state<string | null>(null);
	let approveError = $state<MessageKey | null>(null);
	let rejectOpen = $state(false);
	let rejecting = $state<AwaitingRow | null>(null);
	let rejectError = $state<MessageKey | null>(null);
	let rejectSaving = $state(false);

	const askReject = (a: AwaitingRow) => {
		rejecting = a;
		rejectError = null;
		rejectOpen = true;
	};

	const failKeyOf = (data: Record<string, unknown> | undefined): MessageKey =>
		(data?.messageKey as MessageKey) ?? 'ledger.error.invalid';

	const approveEnhance = (id: string) => {
		approving = id;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			approving = null;
			if (result.type === 'failure') approveError = failKeyOf(result.data);
			else await update();
		};
	};

	const rejectEnhance = () => {
		rejectSaving = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			rejectSaving = false;
			if (result.type === 'failure') {
				const reason = result.data?.errors as Record<string, MessageKey> | undefined;
				rejectError = reason?.reason ?? failKeyOf(result.data);
			} else {
				rejectOpen = false;
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

	{#if data.awaitingMe.length > 0}
		<Card class="mt-8" title={i18n.t('ledger.awaiting.title')} padding="none">
			<ul class="divide-y divide-border">
				{#each data.awaitingMe as a (a.id)}
					<li class="flex items-start justify-between gap-2 px-4 py-3">
						<div class="min-w-0">
							<p class="truncate font-medium">
								{i18n.t('ledger.transferRow', {
									from: a.fromName,
									to: i18n.t('members.you'),
									amount: formatTaka(a.amount, i18n.locale)
								})}
							</p>
							<p class="text-sm text-muted">
								{i18n.day(a.date)}{#if a.note}<span class="truncate"> · {a.note}</span>{/if}
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<Button variant="secondary" size="sm" onclick={() => askReject(a)}>
								{i18n.t('ledger.awaiting.reject')}
							</Button>
							<form method="POST" action="?/approve" use:enhance={() => approveEnhance(a.id)}>
								<input type="hidden" name="id" value={a.id} />
								<Button type="submit" size="sm" loading={approving === a.id}>
									{i18n.t('ledger.awaiting.approve')}
								</Button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
			{#if approveError}
				<Alert tone="danger" class="mx-4 mb-4">{i18n.t(approveError)}</Alert>
			{/if}
		</Card>
	{/if}

	{#if !data.hasFinalized}
		<Card class="mt-8" padding="none">
			<EmptyState title={i18n.t('ledger.emptyTitle')} description={i18n.t('ledger.emptyBody')} />
		</Card>
	{:else}
		<section class="mt-8">
			<p class="text-2xl font-semibold sm:text-3xl {balanceTone}">
				{i18n.t(balanceKey, { amount: formatTaka(Math.abs(data.myBalance), i18n.locale) })}
			</p>
			{#if data.myPending > 0}
				<p class="mt-1 text-sm text-muted">
					{i18n.t('ledger.myPending', { amount: formatTaka(data.myPending, i18n.locale) })}
				</p>
			{/if}
			{#if sentTo}
				<Alert tone="success" class="mt-4">
					{i18n.t('ledger.sentForApproval', { name: sentTo })}
				</Alert>
			{/if}
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
				padding="sm"
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
						{@const canVoid = canVoidSettlement(data.meId, data.isManager, s.createdBy, s.status)}
						<li class="flex items-start justify-between gap-2 px-4 py-3">
							<div class="min-w-0">
								<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
									<span class="truncate font-medium">{transferText(s)}</span>
									{#if s.status === 'pending'}
										<Badge>{i18n.t('ledger.status.pending')}</Badge>
									{:else if s.status === 'rejected'}
										<Badge tone="danger">{i18n.t('ledger.status.rejected')}</Badge>
									{/if}
								</p>
								<p class="text-sm text-muted">
									{i18n.day(s.date)}{#if s.note}<span class="truncate"> · {s.note}</span>{/if}
								</p>
								{#if s.createdByName && s.createdBy !== s.fromId && s.createdBy !== s.toId}
									<p class="text-xs text-muted">
										{i18n.t('ledger.loggedBy', { name: s.createdByName })}
									</p>
								{/if}
								{#if s.status === 'rejected' && s.decidedByName}
									<p class="text-xs text-muted">
										{s.rejectReason
											? i18n.t('ledger.rejectedBy', {
													name: s.decidedByName,
													reason: s.rejectReason
												})
											: i18n.t('ledger.rejectedByNoReason', { name: s.decidedByName })}
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
											}}
											>{s.status === 'pending'
												? i18n.t('ledger.cancelRequest')
												: i18n.t('ledger.voidCta')}</MenuItem
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
	balances={Object.fromEntries(data.balances.map((b) => [b.id, b.balance]))}
	today={data.today}
	{onsaved}
/>

<Dialog bind:open={rejectOpen} size="sm" title={i18n.t('ledger.rejectTitle')}>
	{#if rejecting}
		<p class="font-medium">
			{i18n.t('ledger.transferRow', {
				from: rejecting.fromName,
				to: i18n.t('members.you'),
				amount: formatTaka(rejecting.amount, i18n.locale)
			})}
		</p>
	{/if}
	<form
		id="reject-form"
		method="POST"
		action="?/reject"
		use:enhance={rejectEnhance}
		class="mt-3 flex flex-col gap-3"
	>
		<input type="hidden" name="id" value={rejecting?.id} />
		<Field label={i18n.t('ledger.rejectReason')}>
			{#snippet children(f)}
				<Textarea name="reason" maxlength={100} describedBy={f.describedBy} invalid={f.invalid} />
			{/snippet}
		</Field>
		{#if rejectError}<Alert tone="danger">{i18n.t(rejectError)}</Alert>{/if}
	</form>
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<Button type="submit" form="reject-form" variant="danger" loading={rejectSaving}>
			{i18n.t('ledger.awaiting.reject')}
		</Button>
	{/snippet}
</Dialog>

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
