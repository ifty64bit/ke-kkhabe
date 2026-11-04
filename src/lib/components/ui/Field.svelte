<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		label,
		hint,
		error,
		required = false,
		class: className,
		children
	}: {
		label: string;
		hint?: string;
		error?: string | null;
		required?: boolean;
		class?: string;
		/** Receives the ids to wire onto the control: `{ id, describedBy, invalid }`. */
		children: Snippet<[{ id: string; describedBy: string | undefined; invalid: boolean }]>;
	} = $props();

	const id = $props.id();
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const describedBy = $derived(
		[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
	);
</script>

<!--
	@component
	Label + control + hint/error, with ids wired for accessibility.
	```svelte
	<Field label="নাম" error={form?.errors?.name}>
		{#snippet children(f)}<Input name="name" {...f} />{/snippet}
	</Field>
	```
-->
<div class={cn('flex flex-col gap-1.5', className)}>
	<label for={id} class="text-sm font-medium">
		{label}{#if required}<span class="text-danger" aria-hidden="true"> *</span>{/if}
	</label>
	{@render children({ id, describedBy, invalid: !!error })}
	{#if error}
		<p id={errorId} class="text-sm text-danger">{error}</p>
	{:else if hint}
		<p id={hintId} class="text-sm text-muted">{hint}</p>
	{/if}
</div>
