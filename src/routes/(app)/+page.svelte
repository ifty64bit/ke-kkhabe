<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import OrderDialog from '#lib/components/today/OrderDialog.svelte';
	import { Alert, Button, Money } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const i18n = useI18n();

	let ordering = $state(false);
	let skipping = $state(false);

	const firstName = $derived(data.user?.name.split(' ')[0] ?? '');
	const isManager = $derived(data.user?.role === 'manager');
	const status = $derived(data.day?.status ?? null);
	const orderSummary = $derived(
		data.items
			.filter((i) => (data.lines[i.id] ?? 0) > 0)
			.map((i) => `${i.name} ${i18n.num(data.lines[i.id])} ${i18n.pick(i.unitBn, i.unitEn)}`)
			.join(', ')
	);
	const answered = $derived(data.response !== null);
	const eating = $derived(data.response?.eating === true && orderSummary.length > 0);

	type Link = {
		route: '/(app)/ledger' | '/(app)/reports' | '/(app)/manage';
		label: MessageKey;
		hint: MessageKey;
	};
	const links = $derived<Link[]>([
		{ route: '/(app)/ledger', label: 'links.ledger', hint: 'links.ledgerHint' },
		{ route: '/(app)/reports', label: 'links.reports', hint: 'links.reportsHint' },
		...(isManager
			? [{ route: '/(app)/manage', label: 'links.manage', hint: 'links.manageHint' } satisfies Link]
			: [])
	]);

	const skipEnhance = () => {
		skipping = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			skipping = false;
			await update();
		};
	};
</script>

<svelte:head><title>{i18n.t('today.headTitle')} · {i18n.t('app.name')}</title></svelte:head>

<main
	class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-12 text-center"
>
	<p class="text-muted">{i18n.day(data.date)}</p>
	<h1 class="mt-3 font-display text-5xl leading-[1.15] text-balance sm:text-6xl">
		{i18n.t('today.prompt', { name: firstName })}
	</h1>

	<div class="mt-10 flex w-full flex-col items-center gap-4">
		{#if !status || status === 'draft'}
			<p class="text-lg text-muted">{i18n.t('today.noMenu')}</p>
			{#if isManager}
				<Button href={resolve('/(app)/manage')}>{i18n.t('today.noMenuCta')}</Button>
			{:else}
				<p class="text-sm text-muted">{i18n.t('today.noMenuMember')}</p>
			{/if}
		{:else if status === 'open'}
			{#if eating}
				<p class="text-lg">
					{i18n.t('today.yourOrder')} <span class="font-semibold">{orderSummary}</span>
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<Button variant="secondary" onclick={() => (ordering = true)}>
						{i18n.t('today.change')}
					</Button>
					<form method="POST" action="?/skip" use:enhance={skipEnhance}>
						<Button type="submit" variant="ghost" loading={skipping}>
							{i18n.t('today.skipToday')}
						</Button>
					</form>
				</div>
			{:else}
				{#if answered}
					<p class="text-lg text-muted">{i18n.t('today.saidNo')}</p>
				{/if}
				<div class="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
					<Button size="lg" class="flex-1" onclick={() => (ordering = true)}>
						{i18n.t('today.yes')}
					</Button>
					{#if !answered}
						<form method="POST" action="?/skip" class="flex flex-1" use:enhance={skipEnhance}>
							<Button type="submit" size="lg" variant="secondary" class="flex-1" loading={skipping}>
								{i18n.t('today.no')}
							</Button>
						</form>
					{/if}
				</div>
				<p class="text-sm text-muted">{i18n.t('today.editUntilClose')}</p>
			{/if}
		{:else if status === 'closed'}
			<p class="text-lg">
				{#if eating}
					{i18n.t('today.yourOrder')} <span class="font-semibold">{orderSummary}</span>
				{:else}
					{i18n.t('today.closedNone')}
				{/if}
			</p>
			<p class="text-sm text-muted">{i18n.t('today.closedNote')}</p>
		{:else if status === 'finalized'}
			{#if eating}
				<p class="text-lg">
					{i18n.t('today.ate')} <span class="font-semibold">{orderSummary}</span>
				</p>
				{#if data.charge !== null}
					<p class="text-muted">
						{i18n.t('today.yourCost')}
						<Money value={data.charge} class="font-semibold text-fg" />
					</p>
				{/if}
			{:else}
				<p class="text-lg text-muted">{i18n.t('today.finalizedNone')}</p>
			{/if}
		{/if}

		{#if form?.messageKey}
			<Alert tone="danger" class="w-full max-w-sm text-left">{i18n.t(form.messageKey)}</Alert>
		{/if}
	</div>
</main>

<nav aria-label={i18n.t('links.label')} class="mx-auto w-full max-w-xl px-6 pb-10">
	<ul
		class="grid gap-2 border-t border-border pt-3"
		style:grid-template-columns="repeat({links.length}, minmax(0, 1fr))"
	>
		{#each links as link (link.route)}
			<li>
				<a
					href={resolve(link.route)}
					class="flex flex-col items-center gap-0.5 rounded-control px-2 py-3 text-center transition-colors hover:bg-surface-2"
				>
					<span class="font-semibold">{i18n.t(link.label)}</span>
					<span class="text-xs text-muted">{i18n.t(link.hint)}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

{#if status === 'open'}
	<OrderDialog bind:open={ordering} items={data.items} initial={data.lines} />
{/if}
