<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';

	const i18n = useI18n();

	const keys = $derived<{ title: MessageKey; body: MessageKey }>(
		page.status === 403
			? { title: 'error.403.title', body: 'error.403.body' }
			: page.status === 404
				? { title: 'error.404.title', body: 'error.404.body' }
				: { title: 'error.generic.title', body: 'error.generic.body' }
	);
</script>

<svelte:head><title>{page.status} · {i18n.t('app.name')}</title></svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
	<div class="khata-page">
		<p class="font-display text-6xl leading-none text-muted tabular-nums">
			{i18n.num(page.status)}
		</p>
		<h1 class="mt-4 font-display text-3xl leading-tight">{i18n.t(keys.title)}</h1>
		<p class="mt-3 text-muted">{i18n.t(keys.body)}</p>
	</div>
	<div class="mt-8">
		<Button href={resolve('/(app)')}>{i18n.t('error.home')}</Button>
	</div>
</main>
