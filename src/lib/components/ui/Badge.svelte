<script lang="ts" module>
	export type BadgeTone = 'neutral' | 'highlight' | 'success' | 'warning' | 'danger';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		tone = 'neutral',
		dot = false,
		class: className,
		children
	}: { tone?: BadgeTone; dot?: boolean; class?: string; children: Snippet } = $props();

	const tones: Record<BadgeTone, string> = {
		neutral: 'bg-surface-2 text-muted',
		highlight: 'bg-haldi-soft text-fg',
		success: 'bg-success-soft text-success',
		warning: 'bg-warning-soft text-warning',
		danger: 'bg-danger-soft text-danger'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
		tones[tone],
		className
	)}
>
	{#if dot}<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>{/if}
	{@render children()}
</span>
