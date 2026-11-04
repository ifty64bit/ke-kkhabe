<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { PageHeader } from '#lib/components/ui/index.ts';
	import { cn } from '#lib/utils/cn.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ route: '/(app)/manage', label: 'আজকের দিন' },
		{ route: '/(app)/manage/items', label: 'আইটেম' },
		{ route: '/(app)/manage/members', label: 'সদস্য' }
	] as const;
</script>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader title="ম্যানেজ" />

	<nav aria-label="ম্যানেজ" class="mt-6 border-b border-border">
		<ul class="-mb-px flex gap-1 overflow-x-auto">
			{#each tabs as tab (tab.route)}
				{@const active = page.route.id === tab.route}
				<li>
					<a
						href={resolve(tab.route)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'block border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap text-muted transition-colors hover:text-fg',
							active && 'border-primary font-semibold text-fg'
						)}>{tab.label}</a
					>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="mt-6">{@render children()}</div>
</main>
