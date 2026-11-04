<script lang="ts">
	import { resolve } from '$app/paths';
	import { Avatar, Menu, MenuItem, MenuLabel, Separator } from '#lib/components/ui/index.ts';
	import type { Theme } from '#lib/theme/index.ts';
	import ThemeToggle from './ThemeToggle.svelte';

	let {
		user,
		theme
	}: {
		user: { name: string; image: string | null; role: string };
		theme: Theme;
	} = $props();
</script>

<header class="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
		<a href={resolve('/')} class="font-display text-2xl leading-none">কে খাবে</a>
		<div class="flex items-center gap-2">
			<ThemeToggle {theme} />
			<Menu label="অ্যাকাউন্ট">
				{#snippet trigger()}
					<Avatar name={user.name} src={user.image} />
				{/snippet}
				<MenuLabel>
					<span class="block truncate text-sm font-medium text-fg">{user.name}</span>
					{#if user.role === 'manager'}ম্যানেজার{/if}
				</MenuLabel>
				<Separator />
				<form method="POST" action="/logout">
					<MenuItem type="submit" tone="danger">লগআউট</MenuItem>
				</form>
			</Menu>
		</div>
	</div>
</header>
