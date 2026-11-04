<script lang="ts">
	import { useI18n } from '#lib/i18n/index.ts';
	import { cn } from '#lib/utils/cn.ts';

	const i18n = useI18n();

	let { size = 'md', class: className }: { size?: 'sm' | 'md' | 'lg'; class?: string } = $props();
	const sizes = { sm: 'size-4 border-2', md: 'size-6 border-2', lg: 'size-10 border-[3px]' };
</script>

<span
	role="status"
	aria-label={i18n.t('common.loading')}
	class={cn(
		'inline-block animate-spin rounded-full border-current border-r-transparent',
		sizes[size],
		className
	)}
></span>
