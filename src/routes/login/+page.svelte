<script lang="ts">
	import GoogleSignInButton from '#lib/components/GoogleSignInButton.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<div class="absolute top-4 right-4">
	<ThemeToggle theme={data.theme} />
</div>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
	<div class="text-center">
		<div
			class="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-primary text-4xl shadow-card"
			aria-hidden="true"
		>
			🍳
		</div>
		<h1 class="mt-6 font-display text-4xl font-bold tracking-tight">
			কে <span class="ml-1 text-primary">খাবে</span>?
		</h1>
		<p class="mt-2 text-muted">অফিসের নাস্তা, অর্ডার আর হিসাব এক জায়গায়</p>
	</div>

	<form method="POST" action="?/google" class="mt-10" onsubmit={() => (submitting = true)}>
		<input type="hidden" name="next" value={data.next} />
		<GoogleSignInButton disabled={submitting} />
	</form>

	{#if form?.message}
		<p class="mt-4 rounded-control bg-danger-soft px-3 py-2 text-center text-sm text-danger">
			{form.message}
		</p>
	{/if}
</main>
