<script lang="ts">
	import { Button } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';

	const i18n = useI18n();
</script>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
	<div class="khata-page">
		<h1 class="font-display text-3xl leading-tight">{i18n.t('inactive.title')}</h1>
		<p class="mt-3 text-muted">{i18n.t('inactive.body')}</p>
	</div>
	<form method="POST" action="/logout" class="mt-8">
		<Button type="submit" variant="secondary" block>{i18n.t('common.logout')}</Button>
	</form>
</main>
