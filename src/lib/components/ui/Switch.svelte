<script lang="ts">
	import { cn } from '#lib/utils/cn.ts';

	let {
		checked = $bindable(false),
		label,
		description,
		name,
		disabled = false,
		class: className
	}: {
		checked: boolean;
		label: string;
		description?: string;
		/** When set, renders a hidden `value="on"` input while checked, for form posts. */
		name?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	const id = $props.id();
</script>

<!--
	@component
	Accessible on/off switch. Bind `checked`, pass `name` to include it in a form post.
-->
<div class={cn('flex items-center justify-between gap-4', className)}>
	<div class="min-w-0">
		<label for={id} class={cn('block text-sm font-medium', disabled && 'opacity-60')}>{label}</label
		>
		{#if description}
			<p class="mt-0.5 text-sm text-muted">{description}</p>
		{/if}
	</div>
	<button
		{id}
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={label}
		{disabled}
		onclick={() => (checked = !checked)}
		class={cn(
			'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
			checked ? 'border-primary bg-primary' : 'border-border bg-surface-2'
		)}
	>
		<span
			aria-hidden="true"
			class={cn(
				'block size-5 rounded-full transition-transform',
				checked ? 'translate-x-[22px] bg-primary-fg' : 'translate-x-0.5 bg-surface'
			)}
		></span>
	</button>
</div>
{#if name && checked}
	<input type="hidden" {name} value="on" />
{/if}
