<script lang="ts">
	import { Card, EmptyState } from '#lib/components/ui/index.ts';
</script>

<svelte:head><title>সদস্য · কে খাবে</title></svelte:head>

<Card padding="none">
	<EmptyState
		title="সদস্যদের তালিকা"
		description="যারা Google দিয়ে লগইন করেছেন তারা এখানে দেখাবেন। এখান থেকে কাউকে ম্যানেজার বানানো বা বন্ধ করা যাবে।"
	/>
</Card>
