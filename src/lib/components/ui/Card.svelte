<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';

	let {
		title,
		description,
		actions,
		footer,
		padding = 'md',
		class: className,
		children,
		...rest
	}: {
		title?: string;
		description?: string;
		/** Rendered at the right of the header (e.g. a badge or menu). */
		actions?: Snippet;
		footer?: Snippet;
		padding?: 'none' | 'sm' | 'md';
		class?: string;
		children?: Snippet;
	} & HTMLAttributes<HTMLElement> = $props();

	const pad = { none: '', sm: 'p-4', md: 'p-5' };
</script>

<section
	{...rest}
	class={cn('rounded-card border border-border bg-surface', pad[padding], className)}
>
	{#if title || actions}
		<header class="mb-4 flex items-start justify-between gap-3">
			<div class="min-w-0">
				{#if title}<h2 class="text-base leading-snug font-semibold">{title}</h2>{/if}
				{#if description}<p class="mt-1 text-sm text-muted">{description}</p>{/if}
			</div>
			{@render actions?.()}
		</header>
	{/if}
	{@render children?.()}
	{#if footer}
		<footer class="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
			{@render footer()}
		</footer>
	{/if}
</section>
