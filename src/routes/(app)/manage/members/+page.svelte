<script lang="ts">
	import { enhance } from '$app/forms';
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
		Separator
	} from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const i18n = useI18n();

	type Member = (typeof data.members)[number];

	let actionError = $state<MessageKey | null>(null);
	let deactivating = $state<Member | null>(null);
	let confirmOpen = $state(false);

	const active = $derived(data.members.filter((m) => m.active));
	const inactive = $derived(data.members.filter((m) => !m.active));

	const rowAction = () => {
		actionError = null;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			if (result.type === 'failure') actionError = (result.data?.messageKey as MessageKey) ?? null;
			else {
				confirmOpen = false;
				await update();
			}
		};
	};
</script>

<svelte:head><title>{i18n.t('manage.tabs.members')} · {i18n.t('app.name')}</title></svelte:head>

{#snippet memberRow(m: Member)}
	{@const isMe = m.id === data.meId}
	<li class="flex items-center gap-3 px-4 py-3">
		<Avatar name={m.name} src={m.image} class={m.active ? '' : 'opacity-60'} />
		<div class="min-w-0 flex-1 {m.active ? '' : 'opacity-70'}">
			<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
				<span class="truncate font-medium">{m.name}</span>
				{#if isMe}<Badge>{i18n.t('members.you')}</Badge>{/if}
				{#if m.role === 'manager'}
					<Badge tone="highlight">{i18n.t('account.manager')}</Badge>
				{/if}
				{#if m.fromConfig}
					<span title={i18n.t('members.fromConfigHint')}>
						<Badge>{i18n.t('members.fromConfig')}</Badge>
					</span>
				{/if}
			</p>
			<p class="truncate text-sm text-muted">{m.email}</p>
			<p class="text-xs text-muted">
				{i18n.t('members.joined', { date: i18n.date(new Date(m.createdAt)) })}
			</p>
		</div>

		{#if !isMe}
			<Menu label={i18n.t('members.more', { name: m.name })}>
				{#snippet trigger()}
					<span
						class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
					>
						<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true"
							><circle cx="12" cy="5" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle
								cx="12"
								cy="19"
								r="1.75"
							/></svg
						>
					</span>
				{/snippet}
				{#snippet children({ close })}
					{#if m.active}
						{#if m.role === 'manager'}
							{#if !m.fromConfig}
								<form method="POST" action="?/setRole" use:enhance={rowAction}>
									<input type="hidden" name="id" value={m.id} />
									<input type="hidden" name="role" value="member" />
									<MenuItem type="submit">{i18n.t('members.makeMember')}</MenuItem>
								</form>
							{/if}
						{:else}
							<form method="POST" action="?/setRole" use:enhance={rowAction}>
								<input type="hidden" name="id" value={m.id} />
								<input type="hidden" name="role" value="manager" />
								<MenuItem type="submit">{i18n.t('members.makeManager')}</MenuItem>
							</form>
						{/if}
						<Separator />
						<MenuItem
							tone="danger"
							onclick={() => {
								close();
								deactivating = m;
								confirmOpen = true;
							}}>{i18n.t('members.deactivate')}</MenuItem
						>
					{:else}
						<form method="POST" action="?/setActive" use:enhance={rowAction}>
							<input type="hidden" name="id" value={m.id} />
							<input type="hidden" name="active" value="true" />
							<MenuItem type="submit">{i18n.t('members.reactivate')}</MenuItem>
						</form>
					{/if}
				{/snippet}
			</Menu>
		{/if}
	</li>
{/snippet}

<p class="text-sm text-muted">{i18n.t('members.count', { count: i18n.num(active.length) })}</p>

{#if actionError}
	<Alert tone="danger" class="mt-4">{i18n.t(actionError)}</Alert>
{/if}

<Card class="mt-3" padding="none">
	{#if active.length === 0}
		<EmptyState
			title={i18n.t('manage.members.emptyTitle')}
			description={i18n.t('manage.members.emptyBody')}
		/>
	{:else}
		<ul class="divide-y divide-border">
			{#each active as m (m.id)}{@render memberRow(m)}{/each}
		</ul>
	{/if}
</Card>

{#if inactive.length > 0}
	<details class="group mt-8">
		<summary
			class="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden"
		>
			<svg
				viewBox="0 0 24 24"
				class="size-4 transition-transform group-open:rotate-90"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg
			>
			{i18n.t('members.inactiveTitle', { count: i18n.num(inactive.length) })}
		</summary>
		<p class="mt-2 text-sm text-muted">{i18n.t('members.inactiveHint')}</p>
		<Card class="mt-3" padding="none">
			<ul class="divide-y divide-border">
				{#each inactive as m (m.id)}{@render memberRow(m)}{/each}
			</ul>
		</Card>
	</details>
{/if}

<Dialog
	bind:open={confirmOpen}
	size="sm"
	title={deactivating ? i18n.t('members.deactivateTitle', { name: deactivating.name }) : ''}
	description={i18n.t('members.deactivateBody')}
>
	{#if actionError}<Alert tone="danger">{i18n.t(actionError)}</Alert>{/if}
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<form method="POST" action="?/setActive" use:enhance={rowAction}>
			<input type="hidden" name="id" value={deactivating?.id} />
			<input type="hidden" name="active" value="false" />
			<Button type="submit" variant="danger">{i18n.t('members.deactivate')}</Button>
		</form>
	{/snippet}
</Dialog>
