<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';
	import { controlBase } from './Input.svelte';

	let {
		value = $bindable(),
		describedBy,
		invalid = false,
		class: className,
		...rest
	}: HTMLTextareaAttributes & {
		describedBy?: string;
		invalid?: boolean;
		class?: string;
	} = $props();
</script>

<textarea
	rows={3}
	{...rest}
	bind:value
	aria-describedby={describedBy}
	aria-invalid={invalid || undefined}
	class={cn(controlBase, 'min-h-20 py-2.5', className)}></textarea>
