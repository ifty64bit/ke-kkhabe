<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>কে খাবে</title>
</svelte:head>

{#if data.user}
	<AppHeader user={data.user} theme={data.theme} />
{/if}

{@render children()}
