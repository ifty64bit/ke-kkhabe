<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		title,
		eyebrow,
		description,
		actions,
		class: className
	}: {
		title: string;
		/** Small context line above the title, e.g. today's date. */
		eyebrow?: string;
		description?: string;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<!--
	@component
	Page title block with the ledger margin rule. Use once per page.
-->
<header class={cn('flex flex-wrap items-end justify-between gap-4', className)}>
	<div class="khata-page min-w-0">
		{#if eyebrow}<p class="text-muted">{eyebrow}</p>{/if}
		<h1 class="font-display text-4xl leading-[1.1] sm:text-5xl {eyebrow ? 'mt-2' : ''}">
			{title}
		</h1>
		{#if description}<p class="mt-3 max-w-[60ch] text-muted">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex shrink-0 gap-2">{@render actions()}</div>{/if}
</header>
