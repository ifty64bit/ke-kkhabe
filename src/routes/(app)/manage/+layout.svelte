<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { PageHeader } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { cn } from '#lib/utils/cn.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const i18n = useI18n();

	const tabs = [
		{ route: '/(app)/manage', label: 'manage.tabs.today' },
		{ route: '/(app)/manage/items', label: 'manage.tabs.items' },
		{ route: '/(app)/manage/members', label: 'manage.tabs.members' }
	] as const;
</script>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader title={i18n.t('manage.title')} />

	<nav aria-label={i18n.t('manage.title')} class="mt-6 border-b border-border">
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
						)}>{i18n.t(tab.label)}</a
					>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="mt-6">{@render children()}</div>
</main>
