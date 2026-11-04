<script lang="ts">
	import { cn } from '#lib/utils/cn.ts';

	let {
		size = 'md',
		wordmark = false,
		class: className
	}: { size?: 'sm' | 'md' | 'lg'; wordmark?: boolean; class?: string } = $props();

	const tiles = {
		sm: 'size-9 rounded-xl text-lg',
		md: 'size-12 rounded-2xl text-2xl',
		lg: 'size-20 rounded-[1.75rem] text-4xl'
	};
</script>

<!--
	@component
	Brand mark: the egg-pan tile in turmeric, optionally with the wordmark.
-->
<span class={cn('inline-flex items-center gap-2.5', className)}>
	<span class={cn('grid shrink-0 place-items-center bg-haldi', tiles[size])} aria-hidden="true"
		>🍳</span
	>
	{#if wordmark}<span class="font-display text-2xl leading-none">কে খাবে</span>{/if}
</span>
