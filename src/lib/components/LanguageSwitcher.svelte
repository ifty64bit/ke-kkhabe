<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { useI18n } from '#lib/i18n/index.ts';

	const i18n = useI18n();
	let busy = $state(false);

	async function toggle() {
		busy = true;
		try {
			const next = i18n.locale === 'bn' ? 'en' : 'bn';
			const res = await fetch('/locale', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ locale: next })
			});
			if (res.ok) {
				document.documentElement.lang = next;
				await invalidateAll();
			}
		} finally {
			busy = false;
		}
	}
</script>

<!--
	@component
	One-tap language switch. Shows the language you'd switch TO, named in that language.
-->
<button
	type="button"
	onclick={toggle}
	disabled={busy}
	aria-label={i18n.t('lang.switch')}
	title={i18n.t('lang.switch')}
	lang={i18n.locale === 'bn' ? 'en' : 'bn'}
	class="grid h-9 min-w-11 place-items-center rounded-full border border-border bg-surface-2 px-3 text-sm font-semibold text-muted transition-colors hover:text-fg disabled:opacity-60"
>
	{i18n.t('lang.short')}
</button>
