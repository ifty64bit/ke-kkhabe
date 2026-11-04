<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		label,
		align = 'end',
		trigger,
		class: className,
		children
	}: {
		/** Accessible name for the trigger button. */
		label: string;
		align?: 'start' | 'end';
		/** Content of the trigger button (icon, avatar...). */
		trigger: Snippet;
		class?: string;
		children: Snippet<[{ close: () => void }]>;
	} = $props();

	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();
	let triggerEl: HTMLButtonElement | undefined = $state();
	const id = $props.id();

	const items = () =>
		Array.from(root?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);

	function close(focusTrigger = true) {
		open = false;
		if (focusTrigger) triggerEl?.focus();
	}

	function toggle() {
		open = !open;
		if (open) queueMicrotask(() => items()[0]?.focus());
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		const list = items();
		const i = list.indexOf(document.activeElement as HTMLElement);
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			list[(i + 1) % list.length]?.focus();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			list[(i - 1 + list.length) % list.length]?.focus();
		} else if (e.key === 'Tab') {
			close(false);
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) close(false);
	}
</script>

<svelte:window onclick={onWindowClick} />

<!--
	@component
	Dropdown menu with keyboard support (↑/↓, Esc, Tab).
	Put `<MenuItem>`s inside; the children snippet receives `{ close }`.
-->
<div
	bind:this={root}
	class={cn('relative inline-block', className)}
	{onkeydown}
	role="presentation"
>
	<button
		bind:this={triggerEl}
		type="button"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={id}
		onclick={toggle}
		class="inline-grid place-items-center rounded-full"
	>
		{@render trigger()}
	</button>
	{#if open}
		<div
			{id}
			role="menu"
			aria-label={label}
			class={cn(
				'absolute z-20 mt-2 min-w-52 origin-top animate-[ke-pop-in_120ms_ease-out] rounded-control border border-border bg-surface p-1.5 shadow-float',
				align === 'end' ? 'right-0' : 'left-0'
			)}
		>
			{@render children({ close })}
		</div>
	{/if}
</div>
