<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, Card } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';
	import { currentSubscription, enablePush, pushSupport } from '#lib/push/client.ts';

	let { publicKey }: { publicKey: string | null } = $props();
	const i18n = useI18n();

	const STORAGE_KEY = 'ke-push-nudge';

	let visible = $state(false);
	let busy = $state(false);
	let denied = $state(false);
	let failed = $state(false);

	onMount(() => {
		void (async () => {
			if (!publicKey) return;
			const support = pushSupport();
			if (support !== 'default' && support !== 'granted') return;
			if ((await currentSubscription()) !== null) return;
			let dismissed = false;
			try {
				dismissed = localStorage.getItem(STORAGE_KEY) === 'dismissed';
			} catch {
				// Storage unavailable: treat the nudge as not dismissed.
			}
			if (!dismissed) visible = true;
		})();
	});

	function storeDismissal() {
		try {
			localStorage.setItem(STORAGE_KEY, 'dismissed');
		} catch {
			// Per-device convenience only; storage can be unavailable.
		}
	}

	function dismiss() {
		storeDismissal();
		visible = false;
	}

	async function turnOn() {
		if (!publicKey) return;
		busy = true;
		failed = false;
		const result = await enablePush(publicKey);
		busy = false;
		if (result === 'on') {
			visible = false;
		} else if (result === 'denied') {
			denied = true;
			storeDismissal();
		} else {
			failed = true;
		}
	}
</script>

{#if visible}
	<Card padding="sm" class="w-full max-w-sm text-left">
		{#if denied}
			<Alert tone="warning">{i18n.t('push.nudge.denied')}</Alert>
			<Button size="sm" variant="ghost" class="mt-2" onclick={dismiss}>
				{i18n.t('push.nudge.dismiss')}
			</Button>
		{:else}
			<p class="text-sm">{i18n.t('push.nudge.text')}</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button size="sm" onclick={turnOn} loading={busy}>{i18n.t('push.nudge.turnOn')}</Button>
				<Button size="sm" variant="ghost" onclick={dismiss}>
					{i18n.t('push.nudge.dismiss')}
				</Button>
			</div>
			{#if failed}
				<Alert tone="danger" class="mt-3">{i18n.t('notifications.error')}</Alert>
			{/if}
		{/if}
	</Card>
{/if}
