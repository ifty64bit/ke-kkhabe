<script lang="ts">
	import { cn } from '#lib/utils/cn.ts';

	let {
		name,
		src = null,
		size = 'md',
		class: className
	}: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg'; class?: string } = $props();

	let failed = $state(false);
	const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
	const sizes = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' };
</script>

<span
	class={cn(
		'inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold',
		sizes[size],
		className
	)}
>
	{#if src && !failed}
		<img
			{src}
			alt=""
			class="size-full object-cover"
			referrerpolicy="no-referrer"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span aria-hidden="true">{initial}</span>
	{/if}
</span>
