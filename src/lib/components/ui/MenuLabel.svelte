<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="px-2.5 py-1.5 text-xs text-muted">{@render children()}</div>
