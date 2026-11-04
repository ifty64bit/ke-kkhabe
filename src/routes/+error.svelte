<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/index.ts';

	const messages: Record<number, { title: string; body: string }> = {
		403: {
			title: 'এই পাতাটা শুধু ম্যানেজারদের জন্য',
			body: 'আপনার অ্যাকাউন্ট সদস্য হিসেবে আছে। ম্যানেজার হতে চাইলে একজন ম্যানেজারকে বলুন।'
		},
		404: {
			title: 'এই পাতাটা খুঁজে পাওয়া যায়নি',
			body: 'লিংকটা ভুল হতে পারে, অথবা পাতাটা সরিয়ে ফেলা হয়েছে।'
		}
	};

	const content = $derived(
		messages[page.status] ?? {
			title: 'কিছু একটা ঠিকমতো কাজ করেনি',
			body: 'একটু পরে আবার চেষ্টা করুন। সমস্যা থেকে গেলে ম্যানেজারকে জানান।'
		}
	);
</script>

<svelte:head><title>{page.status} · কে খাবে</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
	<div class="khata-page">
		<p class="font-display text-6xl leading-none text-muted tabular-nums">{page.status}</p>
		<h1 class="mt-4 font-display text-3xl leading-tight">{content.title}</h1>
		<p class="mt-3 text-muted">{content.body}</p>
	</div>
	<div class="mt-8">
		<Button href={resolve('/(app)')}>আজকের পাতায় যান</Button>
	</div>
</main>
