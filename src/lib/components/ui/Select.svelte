<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/cn.ts';
	import { controlBase } from './Input.svelte';

	type Option = { value: string; label: string; disabled?: boolean };

	let {
		value = $bindable(),
		options,
		placeholder,
		describedBy,
		invalid = false,
		class: className,
		...rest
	}: HTMLSelectAttributes & {
		options: Option[];
		placeholder?: string;
		describedBy?: string;
		invalid?: boolean;
		class?: string;
	} = $props();
</script>

<div class="relative">
	<select
		{...rest}
		bind:value
		aria-describedby={describedBy}
		aria-invalid={invalid || undefined}
		class={cn(controlBase, 'h-11 appearance-none pr-9', className)}
	>
		{#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
		{#each options as opt (opt.value)}
			<option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
		{/each}
	</select>
	<svg
		class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
	>
</div>
