<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
	<div class="text-center">
		<h1 class="text-3xl font-bold">কে খাবে</h1>
		<p class="mt-2 text-gray-600">অফিসের নাস্তার হিসাব</p>
	</div>

	<form method="POST" action="?/google">
		<input type="hidden" name="next" value={data.next} />
		<button
			class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium shadow-sm hover:bg-gray-50"
		>
			Google দিয়ে লগইন করুন
		</button>
	</form>

	{#if form?.message}
		<p class="text-center text-sm text-red-600">{form.message}</p>
	{/if}
</main>
