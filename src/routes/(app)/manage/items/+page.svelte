<script lang="ts">
	import { enhance } from '$app/forms';
	import ItemFormDialog from '#lib/components/manage/ItemFormDialog.svelte';
	import {
		Alert,
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

	let { data, form }: PageProps = $props();
	const i18n = useI18n();

	type Row = (typeof data.items)[number];

	let formOpen = $state(false);
	let editing = $state<Row | null>(null);
	let deleting = $state<Row | null>(null);
	let deleteOpen = $state(false);
	let actionError = $state<MessageKey | null>(null);

	const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, i18n.locale);
	const active = $derived(data.items.filter((i) => !i.archived).toSorted(byName));
	const archived = $derived(data.items.filter((i) => i.archived).toSorted(byName));

	function openAdd() {
		editing = null;
		formOpen = true;
	}
	function openEdit(row: Row) {
		editing = row;
		formOpen = true;
	}
	function askDelete(row: Row) {
		deleting = row;
		deleteOpen = true;
	}

	/** Enhance for row actions: show a page-level error on failure. */
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
				deleteOpen = false;
				await update();
			}
		};
	};
</script>

<svelte:head><title>{i18n.t('manage.tabs.items')} · {i18n.t('app.name')}</title></svelte:head>

{#snippet rowMeta(row: Row)}
	<span class="block text-sm text-muted">
		{row.usedDays > 0
			? i18n.t(row.usedDays === 1 ? 'items.usedDays.one' : 'items.usedDays.other', {
					count: i18n.num(row.usedDays)
				})
			: i18n.t('items.neverUsed')}
	</span>
{/snippet}

{#snippet rowMenu(row: Row)}
	{@const name = row.name}
	<Menu label={i18n.t('items.more', { name })}>
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
			{#if !row.archived}
				<MenuItem
					onclick={() => {
						close();
						openEdit(row);
					}}>{i18n.t('items.edit')}</MenuItem
				>
				<form method="POST" action="?/archive" use:enhance={rowAction}>
					<input type="hidden" name="id" value={row.id} />
					<MenuItem type="submit">{i18n.t('items.archive')}</MenuItem>
				</form>
			{:else}
				<form method="POST" action="?/restore" use:enhance={rowAction}>
					<input type="hidden" name="id" value={row.id} />
					<MenuItem type="submit">{i18n.t('items.restore')}</MenuItem>
				</form>
			{/if}
			{#if row.usedDays === 0}
				<Separator />
				<MenuItem
					tone="danger"
					onclick={() => {
						close();
						askDelete(row);
					}}>{i18n.t('items.delete')}</MenuItem
				>
			{/if}
		{/snippet}
	</Menu>
{/snippet}

<div class="flex items-center justify-end">
	<Button onclick={openAdd}>{i18n.t('items.add')}</Button>
</div>

{#if actionError || form?.messageKey}
	<Alert tone="danger" class="mt-4">{i18n.t((actionError ?? form?.messageKey) as MessageKey)}</Alert
	>
{/if}

<Card class="mt-4" padding="none">
	{#if active.length === 0}
		<EmptyState
			title={i18n.t('manage.items.emptyTitle')}
			description={i18n.t('manage.items.emptyBody')}
		>
			{#snippet action()}<Button onclick={openAdd}>{i18n.t('items.add')}</Button>{/snippet}
		</EmptyState>
	{:else}
		<ul class="divide-y divide-border">
			{#each active as row (row.id)}
				<li class="flex items-center gap-3 px-4 py-3">
					<button
						type="button"
						class="min-w-0 flex-1 text-left"
						onclick={() => openEdit(row)}
						aria-label="{i18n.t('items.edit')}: {row.name}"
					>
						<span class="block truncate text-lg">
							{row.name}
							<span class="text-base text-muted">({i18n.pick(row.unitBn, row.unitEn)})</span>
						</span>
						{@render rowMeta(row)}
					</button>
					{@render rowMenu(row)}
				</li>
			{/each}
		</ul>
	{/if}
</Card>

{#if archived.length > 0}
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
			{i18n.t('items.archivedTitle', { count: i18n.num(archived.length) })}
		</summary>
		<p class="mt-2 text-sm text-muted">{i18n.t('items.archivedHint')}</p>
		<Card class="mt-3" padding="none">
			<ul class="divide-y divide-border">
				{#each archived as row (row.id)}
					<li class="flex items-center gap-3 px-4 py-3">
						<div class="min-w-0 flex-1 opacity-70">
							<span class="block truncate text-lg">
								{row.name}
								<span class="text-base text-muted">({i18n.pick(row.unitBn, row.unitEn)})</span>
							</span>
							{@render rowMeta(row)}
						</div>
						<Badge>{i18n.t('items.archive')}</Badge>
						{@render rowMenu(row)}
					</li>
				{/each}
			</ul>
		</Card>
	</details>
{/if}

<ItemFormDialog bind:open={formOpen} item={editing} />

<Dialog
	bind:open={deleteOpen}
	size="sm"
	title={deleting ? i18n.t('items.deleteTitle', { name: deleting.name }) : ''}
	description={i18n.t('items.deleteBody')}
>
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>{i18n.t('common.cancel')}</Button>
		<form method="POST" action="?/delete" use:enhance={rowAction}>
			<input type="hidden" name="id" value={deleting?.id} />
			<Button type="submit" variant="danger">{i18n.t('items.delete')}</Button>
		</form>
	{/snippet}
</Dialog>
