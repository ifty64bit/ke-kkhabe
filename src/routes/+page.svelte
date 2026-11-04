<script lang="ts">
	import Card from '#lib/components/ui/Card.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const firstName = $derived(data.user?.name.split(' ')[0] ?? '');
</script>

<main class="mx-auto max-w-xl px-4 py-6">
	<p class="text-muted">সুপ্রভাত, {firstName}</p>
	<h1 class="mt-1 font-display text-3xl font-bold tracking-tight">আজ খাবেন?</h1>

	<Card class="mt-6">
		<p class="text-muted">আজকের মেনু এখনো দেওয়া হয়নি।</p>
		<div class="mt-4 flex gap-2">
			<Button disabled>হ্যাঁ, খাবো</Button>
			<Button variant="secondary" disabled>না</Button>
		</div>
	</Card>
</main>
