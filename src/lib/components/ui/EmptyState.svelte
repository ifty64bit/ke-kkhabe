<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		title,
		description,
		icon,
		action,
		class: className
	}: {
		title: string;
		description?: string;
		/** Optional glyph or emoji shown above the title. */
		icon?: string;
		action?: Snippet;
		class?: string;
	} = $props();
</script>

<div class={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
	{#if icon}
		<div
			class="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-xl"
			aria-hidden="true"
		>
			{icon}
		</div>
	{/if}
	<p class=" text-base font-semibold">{title}</p>
	{#if description}<p class="mt-1 max-w-xs text-sm text-muted">{description}</p>{/if}
	{#if action}<div class="mt-5">{@render action()}</div>{/if}
</div>
