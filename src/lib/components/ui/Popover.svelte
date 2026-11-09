<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		anchor = null,
		open = $bindable(false),
		labelledby,
		onclose,
		class: className,
		children
	}: {
		/** The element the panel points at. Hover, focus and tap on it open the panel. */
		anchor?: HTMLElement | null;
		open?: boolean;
		/** id of the heading rendered inside the panel. */
		labelledby: string;
		onclose?: () => void;
		class?: string;
		children: Snippet;
	} = $props();

	const id = $props.id();
	let panel = $state<HTMLDivElement>();
	let style = $state('visibility: hidden; top: 0; left: 0;');
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let suppressOpen = false;

	function cancelClose() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = undefined;
	}

	function close() {
		if (!open) return;
		open = false;
		onclose?.();
	}

	function scheduleClose() {
		cancelClose();
		closeTimer = setTimeout(close, 140);
	}

	function show() {
		if (suppressOpen) return;
		cancelClose();
		open = true;
	}

	async function place() {
		if (!anchor || !panel) return;
		await tick();
		const margin = 8;
		const gap = 8;
		const a = anchor.getBoundingClientRect();
		const p = panel.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const below = vh - a.bottom - gap;
		const above = a.top - gap;
		const top = below >= p.height || below >= above ? a.bottom + gap : a.top - gap - p.height;
		const left = Math.min(
			Math.max(margin, a.left + a.width / 2 - p.width / 2),
			vw - p.width - margin
		);
		const clampedTop = Math.min(Math.max(margin, top), vh - p.height - margin);
		style = `top: ${Math.round(clampedTop)}px; left: ${Math.round(left)}px;`;
	}

	/** Hover, keyboard focus and tap all open. A short linger lets the pointer cross the gap. */
	$effect(() => {
		const el = anchor;
		if (!el) return;
		cancelClose();
		el.setAttribute('aria-haspopup', 'dialog');
		el.setAttribute('aria-controls', id);
		el.addEventListener('mouseenter', show);
		el.addEventListener('focus', show);
		el.addEventListener('click', show);
		el.addEventListener('mouseleave', scheduleClose);
		return () => {
			el.removeEventListener('mouseenter', show);
			el.removeEventListener('focus', show);
			el.removeEventListener('click', show);
			el.removeEventListener('mouseleave', scheduleClose);
			el.removeAttribute('aria-haspopup');
			el.removeAttribute('aria-controls');
		};
	});

	$effect(() => {
		const el = anchor;
		if (!el) return;
		el.setAttribute('aria-expanded', String(open));
		return () => el.removeAttribute('aria-expanded');
	});

	$effect(() => {
		if (!open) return;
		function onKeydown(e: KeyboardEvent) {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			const focusWasInside = panel?.contains(document.activeElement);
			close();
			if (focusWasInside) {
				suppressOpen = true;
				anchor?.focus();
				queueMicrotask(() => (suppressOpen = false));
			}
		}
		function onPointerDown(e: PointerEvent) {
			const target = e.target as Node;
			if (panel?.contains(target) || anchor?.contains(target)) return;
			close();
		}
		window.addEventListener('keydown', onKeydown);
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('pointerdown', onPointerDown, true);
		};
	});

	$effect(() => {
		if (!open) {
			style = 'visibility: hidden; top: 0; left: 0;';
			return;
		}
		if (!panel) return;
		void place();
		const observer = new ResizeObserver(() => void place());
		observer.observe(panel);
		const onMove = () => void place();
		window.addEventListener('resize', onMove);
		window.addEventListener('scroll', onMove, true);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', onMove);
			window.removeEventListener('scroll', onMove, true);
		};
	});
</script>

<!--
	@component
	A non-modal popover anchored to an existing element. Opens on hover, focus or tap;
	closes on Escape, an outside tap, or when the pointer leaves for a moment.
	The panel flips above the anchor when there is no room below.
	```svelte
	<button bind:this={anchor}>9 November</button>
	<Popover {anchor} bind:open labelledby="day-title">
		<h2 id="day-title">9 November</h2>
	</Popover>
	```
-->
{#if open}
	<div
		bind:this={panel}
		{id}
		role="dialog"
		tabindex="-1"
		aria-labelledby={labelledby}
		{style}
		onmouseenter={cancelClose}
		onmouseleave={scheduleClose}
		class={cn(
			'fixed z-50 w-80 max-w-[calc(100vw-1rem)] animate-[ke-pop-in_120ms_ease-out] rounded-card border border-border bg-surface p-4 text-left text-fg shadow-float',
			className
		)}
	>
		{@render children()}
	</div>
{/if}
