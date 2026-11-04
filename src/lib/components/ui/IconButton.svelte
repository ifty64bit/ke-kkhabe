<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';
	import { buttonVariants, type ButtonVariant } from './Button.svelte';

	let {
		label,
		variant = 'ghost',
		size = 'md',
		class: className,
		children,
		...rest
	}: {
		/** Accessible name; required because the button has no visible text. */
		label: string;
		variant?: Exclude<ButtonVariant, 'link'>;
		size?: 'sm' | 'md';
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes = $props();
</script>

<button
	{...rest}
	type={rest.type ?? 'button'}
	aria-label={label}
	title={label}
	class={cn(
		'inline-grid shrink-0 place-items-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5',
		size === 'sm' ? 'size-8' : 'size-10',
		buttonVariants[variant],
		className
	)}
>
	{@render children()}
</button>
