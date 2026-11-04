<script lang="ts">
	import GoogleSignInButton from '#lib/components/GoogleSignInButton.svelte';
	import LanguageSwitcher from '#lib/components/LanguageSwitcher.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { Alert } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const i18n = useI18n();
	let submitting = $state(false);
</script>

<div class="absolute top-4 right-4 flex items-center gap-2">
	<LanguageSwitcher />
	<ThemeToggle theme={data.theme} />
</div>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
	<div class="text-center">
		<Logo size="lg" />
		<h1 class="mt-6 font-display text-5xl leading-tight">{i18n.t('login.title')}</h1>
		<p class="mt-2 text-muted">{i18n.t('login.tagline')}</p>
	</div>

	<form method="POST" action="?/google" class="mt-10" onsubmit={() => (submitting = true)}>
		<input type="hidden" name="next" value={data.next} />
		<GoogleSignInButton label={i18n.t('login.google')} disabled={submitting} />
	</form>

	{#if form?.failed}
		<Alert tone="danger" class="mt-4">{i18n.t('login.error')}</Alert>
	{/if}
</main>
