<script lang="ts">
	import { resolve } from '$app/paths';
	import Logo from '#lib/components/Logo.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { Theme } from '#lib/theme/index.ts';
	import AccountMenu from './AccountMenu.svelte';

	let {
		user,
		theme
	}: {
		user: { name: string; image: string | null; role: string; email: string };
		theme: Theme;
	} = $props();
</script>

<header class="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
	<a href={resolve('/(app)')} aria-label="কে খাবে, আজকের পাতা" class="rounded-xl">
		<Logo size="sm" wordmark />
	</a>
	<div class="flex items-center gap-2">
		<ThemeToggle {theme} />
		<AccountMenu {user} />
	</div>
</header>
