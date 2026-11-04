<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { Theme } from '#lib/theme/index.ts';
	import { cn } from '#lib/utils/cn.ts';
	import AccountMenu from './AccountMenu.svelte';
	import NavIcon from './NavIcon.svelte';
	import { isActive, navFor } from './nav.ts';

	let {
		user,
		theme,
		children
	}: {
		user: { name: string; image: string | null; role: string; email: string };
		theme: Theme;
		children: Snippet;
	} = $props();

	const items = $derived(navFor(user.role));
</script>

<!--
	@component
	Signed-in shell. Phone: header + bottom tab bar. Desktop (lg+): left rail.
	Spec: docs/ia-ke-khabe.md
-->
<div class="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
	<!-- Desktop rail -->
	<aside
		class="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-3 py-5 lg:flex"
	>
		<a href={resolve('/(app)')} class="px-3 font-display text-3xl leading-none">কে খাবে</a>
		<nav aria-label="প্রধান" class="mt-8 flex flex-col gap-1">
			{#each items as item (item.route)}
				{@const active = isActive(item, page.route.id)}
				<a
					href={resolve(item.route)}
					aria-current={active ? 'page' : undefined}
					class={cn(
						'relative flex items-center gap-3 rounded-control px-3 py-2.5 text-[15px] text-muted transition-colors hover:bg-surface-2 hover:text-fg',
						active &&
							'bg-surface-2 font-semibold text-fg before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
					)}
				>
					<NavIcon d={item.icon} {active} />
					{item.label}
				</a>
			{/each}
		</nav>
		<div class="mt-auto flex flex-col gap-3 border-t border-border pt-4">
			<AccountMenu {user} align="start" showName />
			<div class="px-1"><ThemeToggle {theme} /></div>
		</div>
	</aside>

	<div class="flex min-w-0 flex-col">
		<!-- Phone header -->
		<header
			class="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden"
		>
			<a href={resolve('/(app)')} class="font-display text-2xl leading-none">কে খাবে</a>
			<div class="flex items-center gap-2">
				<ThemeToggle {theme} />
				<AccountMenu {user} />
			</div>
		</header>

		<main
			class="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-28 lg:mx-0 lg:px-10 lg:pt-10 lg:pb-12"
		>
			{@render children()}
		</main>
	</div>

	<!-- Phone tab bar -->
	<nav
		aria-label="প্রধান"
		class="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
	>
		<ul class="mx-auto flex max-w-2xl">
			{#each items as item (item.route)}
				{@const active = isActive(item, page.route.id)}
				<li class="flex-1">
					<a
						href={resolve(item.route)}
						aria-current={active ? 'page' : undefined}
						class={cn(
							'relative flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted transition-colors',
							active &&
								'font-semibold text-fg before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:bg-primary'
						)}
					>
						<NavIcon d={item.icon} {active} />
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
