<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	type Option = { value: T; label: string; icon?: Snippet };

	let {
		value = $bindable(),
		options,
		label,
		iconOnly = false,
		onchange,
		class: className
	}: {
		value: T;
		options: Option[];
		/** Accessible name for the group. */
		label: string;
		/** Show only icons; labels become tooltips/aria-labels. */
		iconOnly?: boolean;
		onchange?: (value: T) => void;
		class?: string;
	} = $props();

	function select(v: T) {
		value = v;
		onchange?.(v);
	}

	function onkeydown(e: KeyboardEvent) {
		const i = options.findIndex((o) => o.value === value);
		const delta =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? -1
					: 0;
		if (!delta) return;
		e.preventDefault();
		const next = options[(i + delta + options.length) % options.length];
		select(next.value);
		(e.currentTarget as HTMLElement)
			.querySelector<HTMLElement>(`[data-value="${next.value}"]`)
			?.focus();
	}
</script>

<div
	role="radiogroup"
	aria-label={label}
	tabindex="-1"
	{onkeydown}
	class={cn('inline-flex rounded-full border border-border bg-surface-2 p-0.5', className)}
>
	{#each options as opt (opt.value)}
		{@const checked = value === opt.value}
		<button
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={iconOnly ? opt.label : undefined}
			title={iconOnly ? opt.label : undefined}
			tabindex={checked ? 0 : -1}
			data-value={opt.value}
			onclick={() => select(opt.value)}
			class={cn(
				'inline-flex h-8 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-muted transition-colors hover:text-fg [&_svg]:size-4',
				iconOnly ? 'w-8' : 'px-3',
				checked && 'bg-surface text-fg ring-1 ring-border'
			)}
		>
			{@render opt.icon?.()}
			{#if !iconOnly}<span>{opt.label}</span>{/if}
		</button>
	{/each}
</div>
