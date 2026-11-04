<script lang="ts">
	import { Card, EmptyState, PageHeader } from '#lib/components/ui/index.ts';
</script>

<svelte:head><title>রিপোর্ট · কে খাবে</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader
		title="মাসিক রিপোর্ট"
		description="প্রতি মাসে কে কী খেয়েছে, কত দিয়েছে, আর মাস শেষে কার কত বাকি।"
	/>

	<Card class="mt-8" padding="none">
		<EmptyState
			title="এই মাসের রিপোর্ট এখনো খালি"
			description="চূড়ান্ত হওয়া প্রতিটি দিন এখানে যোগ হবে।"
		/>
	</Card>
</main>
