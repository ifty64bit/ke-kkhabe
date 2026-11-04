<script lang="ts">
	import { cn } from '#lib/utils/cn.ts';
	let { class: className }: { class?: string } = $props();
</script>

<hr class={cn('my-1.5 border-border', className)} />
