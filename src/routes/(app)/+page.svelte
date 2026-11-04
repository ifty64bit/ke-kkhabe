<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Button, Card, EmptyState, PageHeader } from '#lib/components/ui/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const firstName = $derived(data.user?.name.split(' ')[0] ?? '');
	const isManager = $derived(data.user?.role === 'manager');
	const today = new Intl.DateTimeFormat('bn-BD', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'Asia/Dhaka'
	}).format(new Date());
</script>

<svelte:head><title>আজ · কে খাবে</title></svelte:head>

<PageHeader eyebrow={today} title="আজ খাবেন, {firstName}?" />

<Card class="mt-8" title="আজকের নাস্তা">
	{#snippet actions()}<Badge>মেনু আসেনি</Badge>{/snippet}
	<EmptyState
		class="py-6"
		title="আজকের মেনু এখনো দেওয়া হয়নি"
		description={isManager
			? 'মেনু দিলে সবাই এখান থেকে অর্ডার করতে পারবে।'
			: 'ম্যানেজার মেনু দিলে এখান থেকেই অর্ডার করবেন।'}
	>
		{#snippet action()}
			{#if isManager}<Button href={resolve('/(app)/manage')}>আজকের মেনু দিন</Button>{/if}
		{/snippet}
	</EmptyState>
</Card>
