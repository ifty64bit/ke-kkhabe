<script lang="ts">
	let { d, active = false }: { d: string; active?: boolean } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	class="size-6 shrink-0"
	fill="none"
	stroke="currentColor"
	stroke-width={active ? 2.25 : 1.75}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path {d} /></svg
>
