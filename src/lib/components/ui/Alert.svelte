<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	type Tone = 'info' | 'success' | 'warning' | 'danger';

	let {
		tone = 'info',
		title,
		class: className,
		children
	}: { tone?: Tone; title?: string; class?: string; children?: Snippet } = $props();

	const tones: Record<Tone, string> = {
		info: 'border-border bg-surface-2 text-fg',
		success: 'border-success/30 bg-success-soft text-success',
		warning: 'border-warning/30 bg-warning-soft text-warning',
		danger: 'border-danger/30 bg-danger-soft text-danger'
	};
</script>

<div
	role={tone === 'danger' ? 'alert' : 'status'}
	class={cn('rounded-control border px-4 py-3 text-sm', tones[tone], className)}
>
	{#if title}<p class="font-semibold">{title}</p>{/if}
	{#if children}<div class={title ? 'mt-0.5 opacity-90' : ''}>{@render children()}</div>{/if}
</div>
