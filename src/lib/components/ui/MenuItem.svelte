<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';

	let {
		tone = 'default',
		href,
		class: className,
		children,
		...rest
	}: {
		tone?: 'default' | 'danger';
		href?: string;
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes = $props();

	const classes = $derived(
		cn(
			'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors [&_svg]:size-4',
			tone === 'danger'
				? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
				: 'text-fg hover:bg-surface-2 focus-visible:bg-surface-2',
			className
		)
	);
</script>

{#if href}
	<!-- Callers pass an already-resolved path, e.g. href={resolve('/report')} -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a {href} role="menuitem" class={classes}>{@render children()}</a>
{:else}
	<button {...rest} type={rest.type ?? 'button'} role="menuitem" class={classes}>
		{@render children()}
	</button>
{/if}
