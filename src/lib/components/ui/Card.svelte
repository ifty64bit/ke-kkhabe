<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		class: className = '',
		children,
		...rest
	}: { class?: string; children: Snippet } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div {...rest} class="rounded-card border border-border bg-surface p-5 shadow-card {className}">
	{@render children()}
</div>
