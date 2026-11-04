<script lang="ts">
	import { SegmentedControl } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { THEME_COOKIE, type Theme } from '#lib/theme/index.ts';

	const i18n = useI18n();

	let { theme = $bindable('system') }: { theme?: Theme } = $props();

	function apply(value: Theme) {
		document.documentElement.dataset.theme = value;
		document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
	}
</script>

{#snippet sun()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		aria-hidden="true"
		><circle cx="12" cy="12" r="4" /><path
			d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
		/></svg
	>
{/snippet}
{#snippet monitor()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		aria-hidden="true"
		><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8m-4-4v4" /></svg
	>
{/snippet}
{#snippet moon()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg
	>
{/snippet}

<SegmentedControl
	bind:value={theme}
	label={i18n.t('theme.label')}
	iconOnly
	onchange={apply}
	options={[
		{ value: 'light', label: i18n.t('theme.light'), icon: sun },
		{ value: 'system', label: i18n.t('theme.system'), icon: monitor },
		{ value: 'dark', label: i18n.t('theme.dark'), icon: moon }
	]}
/>
