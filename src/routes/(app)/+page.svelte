<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import OrderDialog from '#lib/components/today/OrderDialog.svelte';
	import { Alert, Button, Money } from '#lib/components/ui/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let ordering = $state(false);
	let skipping = $state(false);

	const firstName = $derived(data.user?.name.split(' ')[0] ?? '');
	const isManager = $derived(data.user?.role === 'manager');
	const status = $derived(data.day?.status ?? null);
	const orderSummary = $derived(
		data.items
			.filter((i) => (data.lines[i.id] ?? 0) > 0)
			.map((i) => `${i.nameBn} ${data.lines[i.id]} ${i.unitBn}`)
	);
	const answered = $derived(data.response !== null);
	const eating = $derived(data.response?.eating === true && orderSummary.length > 0);

	type Link = {
		route: '/(app)/ledger' | '/(app)/reports' | '/(app)/manage';
		label: string;
		hint: string;
	};
	const links = $derived<Link[]>([
		{ route: '/(app)/ledger', label: 'হিসাব', hint: 'কার কাছে কত বাকি' },
		{ route: '/(app)/reports', label: 'রিপোর্ট', hint: 'মাসের হিসাব' },
		...(isManager
			? [{ route: '/(app)/manage', label: 'ম্যানেজ', hint: 'আজকের দিন চালান' } satisfies Link]
			: [])
	]);
</script>

<svelte:head><title>আজ খাবেন? · কে খাবে</title></svelte:head>

<main
	class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-12 text-center"
>
	<p class="text-muted">{data.dateLabel}</p>
	<h1 class="mt-3 font-display text-5xl leading-[1.15] text-balance sm:text-6xl">
		আজ খাবেন, {firstName}?
	</h1>

	<div class="mt-10 flex w-full flex-col items-center gap-4">
		{#if !status || status === 'draft'}
			<p class="text-lg text-muted">আজকের মেনু এখনো দেওয়া হয়নি।</p>
			{#if isManager}
				<Button href={resolve('/(app)/manage')}>আজকের মেনু দিন</Button>
			{:else}
				<p class="text-sm text-muted">মেনু এলে এখানেই অর্ডার করতে পারবেন।</p>
			{/if}
		{:else if status === 'open'}
			{#if eating}
				<p class="text-lg">
					আপনার অর্ডার: <span class="font-semibold">{orderSummary.join(', ')}</span>
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					<Button variant="secondary" onclick={() => (ordering = true)}>অর্ডার বদলান</Button>
					<form
						method="POST"
						action="?/skip"
						use:enhance={() => {
							skipping = true;
							return async ({ update }) => {
								skipping = false;
								await update();
							};
						}}
					>
						<Button type="submit" variant="ghost" loading={skipping}>আজ খাবো না</Button>
					</form>
				</div>
			{:else}
				{#if answered}
					<p class="text-lg text-muted">আজ খাচ্ছেন না বলে রেখেছেন।</p>
				{/if}
				<div class="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
					<Button size="lg" class="flex-1" onclick={() => (ordering = true)}>হ্যাঁ, খাবো</Button>
					{#if !answered}
						<form
							method="POST"
							action="?/skip"
							class="flex flex-1"
							use:enhance={() => {
								skipping = true;
								return async ({ update }) => {
									skipping = false;
									await update();
								};
							}}
						>
							<Button type="submit" size="lg" variant="secondary" class="flex-1" loading={skipping}>
								আজ না
							</Button>
						</form>
					{/if}
				</div>
				<p class="text-sm text-muted">ম্যানেজার অর্ডার বন্ধ করার আগ পর্যন্ত বদলাতে পারবেন।</p>
			{/if}
		{:else if status === 'closed'}
			<p class="text-lg">
				{#if eating}
					আপনার অর্ডার: <span class="font-semibold">{orderSummary.join(', ')}</span>
				{:else}
					আজ আপনার কোনো অর্ডার নেই।
				{/if}
			</p>
			<p class="text-sm text-muted">অর্ডার নেওয়া বন্ধ। ম্যানেজার নাস্তা আনতে গেছেন।</p>
		{:else if status === 'finalized'}
			{#if eating}
				<p class="text-lg">
					আজ খেয়েছেন: <span class="font-semibold">{orderSummary.join(', ')}</span>
				</p>
				{#if data.charge !== null}
					<p class="text-muted">
						আপনার খরচ <Money value={data.charge} class="font-semibold text-fg" />
					</p>
				{/if}
			{:else}
				<p class="text-lg text-muted">আজ আপনার কোনো অর্ডার ছিল না।</p>
			{/if}
		{/if}

		{#if form?.message}<Alert tone="danger" class="w-full max-w-sm text-left">{form.message}</Alert
			>{/if}
	</div>
</main>

<nav aria-label="অন্যান্য পাতা" class="mx-auto w-full max-w-xl px-6 pb-10">
	<ul
		class="grid border-t border-border"
		style:grid-template-columns="repeat({links.length}, minmax(0, 1fr))"
	>
		{#each links as link (link.route)}
			<li>
				<a
					href={resolve(link.route)}
					class="flex flex-col items-center gap-0.5 rounded-control px-2 pt-5 pb-2 text-center transition-colors hover:bg-surface-2"
				>
					<span class="font-semibold">{link.label}</span>
					<span class="text-xs text-muted">{link.hint}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

{#if status === 'open'}
	<OrderDialog bind:open={ordering} items={data.items} initial={data.lines} />
{/if}
