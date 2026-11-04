<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Theme } from '#lib/theme/index.ts';
	import ThemeToggle from './ThemeToggle.svelte';

	let {
		user,
		theme
	}: {
		user: { name: string; image: string | null; role: string };
		theme: Theme;
	} = $props();

	const initial = $derived(user.name.trim().charAt(0).toUpperCase());
</script>

<header class="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
		<a href={resolve('/')} class="font-display text-xl font-bold tracking-tight">
			কে <span class="ml-1 text-primary">খাবে</span>
		</a>
		<div class="flex items-center gap-2">
			<ThemeToggle {theme} />
			<details class="relative">
				<summary
					class="grid size-9 cursor-pointer list-none place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"
					aria-label="অ্যাকাউন্ট"
				>
					{#if user.image}
						<img
							src={user.image}
							alt=""
							class="size-full object-cover"
							referrerpolicy="no-referrer"
						/>
					{:else}
						{initial}
					{/if}
				</summary>
				<div
					class="absolute right-0 mt-2 w-52 rounded-control border border-border bg-surface p-2 shadow-card"
				>
					<p class="truncate px-2 py-1 text-sm font-medium">{user.name}</p>
					{#if user.role === 'manager'}
						<p class="px-2 pb-1 text-xs text-muted">ম্যানেজার</p>
					{/if}
					<form method="POST" action="/logout">
						<button
							class="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-danger hover:bg-danger-soft"
						>
							লগআউট
						</button>
					</form>
				</div>
			</details>
		</div>
	</div>
</header>
