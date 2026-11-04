<script lang="ts">
	import AppShell from '#lib/components/shell/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.user}
	<AppShell user={data.user} theme={data.theme}>
		{@render children()}
	</AppShell>
{/if}
