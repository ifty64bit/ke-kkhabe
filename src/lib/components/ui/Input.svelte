<script lang="ts" module>
	export const controlBase =
		'w-full rounded-control border border-border bg-surface px-3 text-base text-fg placeholder:text-muted/70 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/20';
</script>

<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';

	let {
		value = $bindable(),
		describedBy,
		invalid = false,
		class: className,
		...rest
	}: HTMLInputAttributes & { describedBy?: string; invalid?: boolean; class?: string } = $props();
</script>

<input
	{...rest}
	bind:value
	aria-describedby={describedBy}
	aria-invalid={invalid || undefined}
	class={cn(controlBase, 'h-11', className)}
/>
