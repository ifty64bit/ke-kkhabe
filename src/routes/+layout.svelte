<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { setI18n } from '#lib/i18n/index.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	setI18n(() => data.locale);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>কে খাবে</title>
</svelte:head>

{@render children()}
