<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	let {
		variant = 'primary',
		size = 'md',
		block = false,
		class: className = '',
		children,
		...rest
	}: {
		variant?: Variant;
		size?: Size;
		block?: boolean;
		class?: string;
		children: Snippet;
	} & HTMLButtonAttributes = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm',
		secondary: 'bg-surface text-fg border border-border hover:bg-surface-2',
		ghost: 'text-fg hover:bg-surface-2',
		danger: 'bg-danger text-white hover:opacity-90'
	};

	const sizes: Record<Size, string> = {
		sm: 'h-8 px-3 text-sm',
		md: 'h-11 px-4 text-base',
		lg: 'h-13 px-6 text-lg'
	};
</script>

<button
	{...rest}
	class="inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 {variants[
		variant
	]} {sizes[size]} {block ? 'w-full' : ''} {className}"
>
	{@render children()}
</button>
