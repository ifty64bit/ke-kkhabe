<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main class="mx-auto max-w-md p-6">
	<header class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">কে খাবে</h1>
		<form method="POST" action="/logout">
			<button class="text-sm text-gray-600 underline">লগআউট</button>
		</form>
	</header>
	<p class="mt-6 text-lg">আজ খাবেন, {data.user?.name}?</p>
	{#if data.user?.role === 'manager'}
		<p class="mt-2 text-sm text-gray-500">আপনি ম্যানেজার</p>
	{/if}
</main>
