<script lang="ts">
	import GoogleSignInButton from '#lib/components/GoogleSignInButton.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { Alert } from '#lib/components/ui/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<div class="absolute top-4 right-4">
	<ThemeToggle theme={data.theme} />
</div>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
	<div class="text-center">
		<Logo size="lg" />
		<h1 class="mt-6 font-display text-5xl leading-tight">কে খাবে?</h1>
		<p class="mt-2 text-muted">অফিসের নাস্তা, অর্ডার আর হিসাব এক জায়গায়</p>
	</div>

	<form method="POST" action="?/google" class="mt-10" onsubmit={() => (submitting = true)}>
		<input type="hidden" name="next" value={data.next} />
		<GoogleSignInButton disabled={submitting} />
	</form>

	{#if form?.message}
		<Alert tone="danger" class="mt-4">{form.message}</Alert>
	{/if}
</main>
