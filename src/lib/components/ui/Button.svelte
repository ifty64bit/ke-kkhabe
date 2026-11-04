<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
	export type ButtonSize = 'sm' | 'md' | 'lg';

	export const buttonVariants: Record<ButtonVariant, string> = {
		primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
		secondary: 'border border-border bg-surface text-fg hover:bg-surface-2',
		ghost: 'text-fg hover:bg-surface-2',
		danger: 'border border-danger/50 bg-surface text-danger hover:bg-danger-soft',
		link: 'h-auto px-0 text-primary underline-offset-4 hover:underline'
	};

	export const buttonSizes: Record<ButtonSize, string> = {
		sm: 'h-8 px-3 text-sm',
		md: 'h-11 px-4 text-base',
		lg: 'h-13 px-6 text-lg'
	};

	export const buttonBase =
		'inline-flex select-none items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-[background-color,opacity,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';
	import Spinner from './Spinner.svelte';

	type Common = {
		variant?: ButtonVariant;
		size?: ButtonSize;
		block?: boolean;
		loading?: boolean;
		class?: string;
		children: Snippet;
	};

	let {
		variant = 'primary',
		size = 'md',
		block = false,
		loading = false,
		class: className,
		children,
		...rest
	}: Common &
		(
			(HTMLButtonAttributes & { href?: never }) | (HTMLAnchorAttributes & { href: string })
		) = $props();

	const classes = $derived(
		cn(buttonBase, buttonSizes[size], buttonVariants[variant], block && 'w-full', className)
	);
</script>

<!--
	@component
	Button, or a link styled as one when `href` is set.
	`loading` shows a spinner and disables the button.
-->
{#if 'href' in rest && rest.href !== undefined}
	<a {...rest as HTMLAnchorAttributes} class={classes}>
		{@render children()}
	</a>
{:else}
	{@const btn = rest as HTMLButtonAttributes}
	<button
		{...btn}
		type={btn.type ?? 'button'}
		disabled={btn.disabled || loading}
		aria-busy={loading || undefined}
		class={classes}
	>
		{#if loading}<Spinner size="sm" />{/if}
		{@render children()}
	</button>
{/if}
