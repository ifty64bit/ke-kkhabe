<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { Alert, Button, Card, PageHeader, Switch } from '#lib/components/ui/index.ts';
	import { useI18n, type MessageKey } from '#lib/i18n/index.ts';
	import {
		currentSubscription,
		disablePush,
		enablePush,
		pushSupport,
		type PushSupport
	} from '#lib/push/client.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const i18n = useI18n();

	let support = $state<PushSupport | null>(null);
	let subscribed = $state(false);
	let busy = $state(false);
	let failed = $state(false);
	// svelte-ignore state_referenced_locally
	let prefs = $state({ ...data.prefs });

	onMount(() => {
		void (async () => {
			support = pushSupport();
			subscribed = (await currentSubscription()) !== null;
		})();
	});

	const status = $derived.by((): MessageKey | null => {
		if (data.vapidPublicKey === null) return 'notifications.device.unavailable';
		if (support === null) return null;
		if (support === 'denied') return 'notifications.device.blocked';
		if (support === 'needs-install') return 'notifications.device.needsInstall';
		if (support === 'unsupported') return 'notifications.device.unsupported';
		return subscribed ? 'notifications.device.on' : 'notifications.device.off';
	});

	const canToggle = $derived(
		data.vapidPublicKey !== null &&
			(support === 'default' || support === 'granted') &&
			(!subscribed || support === 'granted')
	);

	async function turnOn() {
		if (!data.vapidPublicKey) return;
		busy = true;
		failed = false;
		const result = await enablePush(data.vapidPublicKey);
		busy = false;
		if (result === 'on') {
			subscribed = true;
			support = 'granted';
		} else if (result === 'denied') {
			support = 'denied';
		} else {
			failed = true;
		}
	}

	async function turnOff() {
		busy = true;
		failed = false;
		try {
			await disablePush();
			subscribed = false;
		} catch {
			failed = true;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{i18n.t('notifications.title')} · {i18n.t('app.name')}</title></svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
	<PageHeader title={i18n.t('notifications.title')} />

	<Card class="mt-8" title={i18n.t('notifications.device.title')}>
		{#if status}
			<p class="font-medium">{i18n.t(status)}</p>
		{:else}
			<p class="text-muted">{i18n.t('common.loading')}</p>
		{/if}

		{#if support === 'denied'}
			<p class="mt-1.5 text-sm text-muted">{i18n.t('notifications.device.blockedHelp')}</p>
		{:else if support === 'needs-install'}
			<p class="mt-1.5 text-sm text-muted">{i18n.t('notifications.device.installHelp')}</p>
		{/if}

		{#if canToggle}
			<Button
				class="mt-4"
				variant={subscribed ? 'secondary' : 'primary'}
				onclick={subscribed ? turnOff : turnOn}
				loading={busy}
			>
				{i18n.t(subscribed ? 'notifications.turnOff' : 'notifications.turnOn')}
			</Button>
		{/if}

		{#if failed}
			<Alert tone="danger" class="mt-4">{i18n.t('notifications.error')}</Alert>
		{/if}
	</Card>

	<Card class="mt-6" title={i18n.t('notifications.prefs.title')}>
		<form method="POST" action="?/savePrefs" use:enhance>
			<div class="space-y-4">
				<Switch
					bind:checked={prefs.dayOpened}
					name="dayOpened"
					label={i18n.t('notifications.prefs.dayOpened')}
				/>
				<Switch
					bind:checked={prefs.dayFinalized}
					name="dayFinalized"
					label={i18n.t('notifications.prefs.dayFinalized')}
				/>
				<Switch
					bind:checked={prefs.settlementPending}
					name="settlementPending"
					label={i18n.t('notifications.prefs.settlementPending')}
				/>
				<Switch
					bind:checked={prefs.settlementDecided}
					name="settlementDecided"
					label={i18n.t('notifications.prefs.settlementDecided')}
				/>
			</div>
			<div class="mt-5 flex flex-wrap items-center gap-3">
				<Button type="submit" variant="secondary">{i18n.t('notifications.prefs.save')}</Button>
				{#if form?.saved}
					<Alert tone="success">{i18n.t('notifications.prefs.saved')}</Alert>
				{/if}
			</div>
		</form>
	</Card>
</main>
