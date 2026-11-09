<script lang="ts">
	import { resolve } from '$app/paths';
	import { Avatar, Menu, MenuItem, MenuLabel, Separator } from '#lib/components/ui/index.ts';
	import { useI18n } from '#lib/i18n/index.ts';

	const i18n = useI18n();

	let {
		user,
		align = 'end',
		showName = false
	}: {
		user: { name: string; image: string | null; role: string; email: string };
		align?: 'start' | 'end';
		/** Show the name next to the avatar (desktop rail). */
		showName?: boolean;
	} = $props();
</script>

<Menu label={i18n.t('account.label')} {align} class={showName ? 'w-full' : ''}>
	{#snippet trigger()}
		<span class="flex items-center gap-2.5 {showName ? 'rounded-control px-1 py-1 text-left' : ''}">
			<Avatar name={user.name} src={user.image} />
			{#if showName}
				<span class="min-w-0">
					<span class="block truncate text-sm font-medium">{user.name}</span>
					<span class="block text-xs text-muted">
						{i18n.t(user.role === 'manager' ? 'account.manager' : 'account.member')}
					</span>
				</span>
			{/if}
		</span>
	{/snippet}
	<MenuLabel>
		<span class="block truncate text-sm font-medium text-fg">{user.name}</span>
		<span class="block truncate">{user.email}</span>
	</MenuLabel>
	<MenuItem href={resolve('/(app)/notifications')}>{i18n.t('account.notifications')}</MenuItem>
	<Separator />
	<form method="POST" action="/logout">
		<MenuItem type="submit" tone="danger">{i18n.t('common.logout')}</MenuItem>
	</form>
</Menu>
