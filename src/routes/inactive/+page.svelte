<script lang="ts">
	import { Button } from '#lib/components/ui/index.ts';
</script>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
	<div class="khata-page">
		<h1 class="font-display text-3xl leading-tight">আপনার অ্যাকাউন্ট বন্ধ আছে</h1>
		<p class="mt-3 text-muted">আবার চালু করতে একজন ম্যানেজারকে বলুন।</p>
	</div>
	<form method="POST" action="/logout" class="mt-8">
		<Button type="submit" variant="secondary" block>লগআউট</Button>
	</form>
</main>
