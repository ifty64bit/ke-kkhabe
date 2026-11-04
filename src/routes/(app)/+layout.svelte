<script lang="ts">
	import TopBar from '#lib/components/shell/TopBar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.user}
	<div class="flex min-h-dvh flex-col">
		<TopBar user={data.user} theme={data.theme} />
		<div class="flex flex-1 flex-col">{@render children()}</div>
	</div>
{/if}
