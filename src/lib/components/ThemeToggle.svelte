<script lang="ts">
	import { THEME_COOKIE, type Theme } from '#lib/theme/index.ts';

	let { theme = $bindable('system') }: { theme?: Theme } = $props();

	const options: { value: Theme; label: string; icon: string }[] = [
		{
			value: 'light',
			label: 'লাইট',
			icon: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
		},
		{ value: 'system', label: 'সিস্টেম', icon: 'M4 5h16v11H4zM8 20h8m-4-4v4' },
		{ value: 'dark', label: 'ডার্ক', icon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z' }
	];

	function select(value: Theme) {
		theme = value;
		document.documentElement.dataset.theme = value;
		document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
	}
</script>

<div
	role="radiogroup"
	aria-label="থিম"
	class="inline-flex rounded-full border border-border bg-surface-2 p-0.5"
>
	{#each options as opt (opt.value)}
		<button
			type="button"
			role="radio"
			aria-checked={theme === opt.value}
			aria-label={opt.label}
			title={opt.label}
			onclick={() => select(opt.value)}
			class="grid size-8 place-items-center rounded-full text-muted transition-colors hover:text-fg aria-checked:bg-surface aria-checked:text-fg aria-checked:shadow-sm"
		>
			<svg
				viewBox="0 0 24 24"
				class="size-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d={opt.icon} />
			</svg>
		</button>
	{/each}
</div>
