<script lang="ts">
	import { Card, EmptyState } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';

	const i18n = useI18n();
</script>

<svelte:head><title>{i18n.t('manage.title')} · {i18n.t('app.name')}</title></svelte:head>

<Card padding="none">
	<EmptyState
		title={i18n.t('manage.today.emptyTitle')}
		description={i18n.t('manage.today.emptyBody')}
	/>
</Card>
