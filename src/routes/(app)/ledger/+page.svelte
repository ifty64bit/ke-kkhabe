<script lang="ts">
	import { Card, EmptyState, PageHeader } from '#lib/components/ui/index.ts';
</script>

<svelte:head><title>হিসাব · কে খাবে</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader title="হিসাব" description="কে কত পাবে, কে কত দেবে, আর কীভাবে মিটিয়ে ফেলা যায়।" />

	<Card class="mt-8" padding="none">
		<EmptyState
			title="এখনো কোনো হিসাব নেই"
			description="প্রথম দিনের নাস্তা চূড়ান্ত হলে সবার ব্যালান্স এখানে দেখাবে।"
		/>
	</Card>
</main>
