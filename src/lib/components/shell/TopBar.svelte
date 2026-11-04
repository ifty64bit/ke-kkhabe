<script lang="ts">
	import { resolve } from '$app/paths';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import { useI18n } from '#lib/i18n/index.ts';
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

	const i18n = useI18n();
</script>

<header class="container flex h-16 items-center justify-between gap-3">
	<a href={resolve('/(app)')} aria-label={i18n.t('nav.home')} class="rounded-xl">
		<Logo size="sm" wordmark />
	</a>
	<div class="flex items-center gap-2">
		<LanguageSwitcher />
		<ThemeToggle {theme} />
		<AccountMenu {user} />
	</div>
</header>
