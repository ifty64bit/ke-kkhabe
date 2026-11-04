<script lang="ts">
	import GoogleSignInButton from '#lib/components/GoogleSignInButton.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { Alert } from '#lib/components/ui/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<div class="absolute top-4 right-4">
	<ThemeToggle theme={data.theme} />
</div>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
	<div class="khata-page py-2">
		<h1 class="font-display text-6xl leading-[1.05]">কে খাবে</h1>
		<p class="mt-4 max-w-[28ch] text-lg text-muted">
			অফিসের নাস্তার অর্ডার, দাম আর কার কাছে কত বাকি, সব এক খাতায়।
		</p>
	</div>

	<form method="POST" action="?/google" class="mt-12" onsubmit={() => (submitting = true)}>
		<input type="hidden" name="next" value={data.next} />
		<GoogleSignInButton disabled={submitting} />
	</form>

	{#if form?.message}
		<Alert tone="danger" class="mt-4">{form.message}</Alert>
	{/if}
</main>
