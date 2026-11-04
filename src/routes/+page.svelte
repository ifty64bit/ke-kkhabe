<script lang="ts">
	import { Badge, Button, Card, EmptyState } from '#lib/components/ui/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const firstName = $derived(data.user?.name.split(' ')[0] ?? '');
	const today = new Intl.DateTimeFormat('bn-BD', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'Asia/Dhaka'
	}).format(new Date());
</script>

<main class="mx-auto max-w-xl px-4 py-8">
	<section class="khata-page">
		<p class="text-muted">{today}</p>
		<h1 class="mt-2 font-display text-5xl leading-[1.1]">আজ খাবেন, {firstName}?</h1>
	</section>

	<Card class="mt-8" title="আজকের নাস্তা">
		{#snippet actions()}<Badge>মেনু আসেনি</Badge>{/snippet}
		<EmptyState
			class="py-6"
			title="এখনো মেনু দেওয়া হয়নি"
			description="ম্যানেজার আজকের মেনু দিলে এখান থেকে অর্ডার করবেন।"
		/>
		{#snippet footer()}
			<Button variant="secondary" disabled>আজ খাবো না</Button>
			<Button disabled>অর্ডার করুন</Button>
		{/snippet}
	</Card>
</main>
