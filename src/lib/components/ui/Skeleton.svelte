<script lang="ts">
	import { cn } from '#lib/utils/cn.ts';
	let { class: className }: { class?: string } = $props();
</script>

<div aria-hidden="true" class={cn('h-4 animate-pulse rounded-md bg-surface-2', className)}></div>
