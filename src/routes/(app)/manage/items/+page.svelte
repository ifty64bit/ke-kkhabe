<script lang="ts">
	import { Card, EmptyState } from '#lib/components/ui/index.ts';
</script>

<svelte:head><title>আইটেম · কে খাবে</title></svelte:head>

<Card padding="none">
	<EmptyState
		title="কোনো আইটেম নেই"
		description="পরোটা, ডিম, চা—যা যা সাধারণত আসে, সেগুলো এখানে একবার যোগ করলেই প্রতিদিন বেছে নেওয়া যাবে।"
	/>
</Card>
