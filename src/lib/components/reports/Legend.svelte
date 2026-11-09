<script lang="ts">
	import type { MessageKey } from '#lib/i18n/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { cn } from '#lib/utils/cn.ts';

	let { class: className }: { class?: string } = $props();

	const i18n = useI18n();
	const items: { tone: string; label: MessageKey }[] = [
		{ tone: 'bg-primary', label: 'reports.legend.ate' },
		{ tone: 'bg-surface-2', label: 'reports.legend.skipped' },
		{ tone: 'border border-border bg-surface', label: 'reports.legend.noAnswer' },
		{ tone: 'bg-surface-2/40', label: 'reports.legend.noBreakfast' }
	];
</script>

<ul
	class={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted', className)}
	aria-label={i18n.t('reports.legend.label')}
>
	{#each items as item (item.label)}
		<li class="inline-flex items-center gap-1.5">
			<span class={cn('size-3 shrink-0 rounded-[0.2rem]', item.tone)} aria-hidden="true"></span>
			{i18n.t(item.label)}
		</li>
	{/each}
</ul>
