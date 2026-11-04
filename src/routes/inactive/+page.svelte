<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Card from '#lib/components/ui/Card.svelte';
</script>

<main class="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-sm flex-col justify-center px-6">
	<Card class="text-center">
		<h1 class="font-display text-xl font-bold">আপনার অ্যাকাউন্ট নিষ্ক্রিয়</h1>
		<p class="mt-2 text-muted">একজন ম্যানেজারের সাথে যোগাযোগ করুন।</p>
		<form method="POST" action="/logout" class="mt-5">
			<Button variant="secondary" block>লগআউট</Button>
		</form>
	</Card>
</main>
