<script lang="ts">
	import { Card, EmptyState, PageHeader } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';

	const i18n = useI18n();
</script>

<svelte:head><title>{i18n.t('reports.headTitle')} · {i18n.t('app.name')}</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader title={i18n.t('reports.title')} description={i18n.t('reports.description')} />

	<Card class="mt-8" padding="none">
		<EmptyState title={i18n.t('reports.emptyTitle')} description={i18n.t('reports.emptyBody')} />
	</Card>
</main>
