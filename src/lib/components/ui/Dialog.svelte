<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/cn.ts';

	let {
		open = $bindable(false),
		title,
		description,
		dismissible = true,
		size = 'md',
		footer,
		onclose,
		class: className,
		children
	}: {
		open?: boolean;
		title: string;
		description?: string;
		/** Allow closing with Esc, backdrop click and the × button. */
		dismissible?: boolean;
		size?: 'sm' | 'md' | 'lg';
		footer?: Snippet<[{ close: () => void }]>;
		onclose?: () => void;
		class?: string;
		children?: Snippet<[{ close: () => void }]>;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	const id = $props.id();
	const sizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' };

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	const close = () => (open = false);

	function handleClose() {
		open = false;
		onclose?.();
	}

	function handleCancel(e: Event) {
		if (!dismissible) e.preventDefault();
	}

	function handleBackdrop(e: MouseEvent) {
		if (dismissible && e.target === dialog) close();
	}
</script>

<!--
	@component
	Modal dialog built on native `<dialog>` (focus trap, Esc, top layer for free).
	On phones it docks to the bottom as a sheet; on larger screens it's centered.
	```svelte
	<Dialog bind:open title="নিশ্চিত করুন">
		আজকের অর্ডার বন্ধ করবেন?
		{#snippet footer({ close })}
			<Button variant="secondary" onclick={close}>বাতিল</Button>
			<Button onclick={confirm}>বন্ধ করুন</Button>
		{/snippet}
	</Dialog>
	```
-->
<dialog
	bind:this={dialog}
	aria-labelledby="{id}-title"
	aria-describedby={description ? `${id}-desc` : undefined}
	onclose={handleClose}
	oncancel={handleCancel}
	onclick={handleBackdrop}
	class={cn(
		'm-0 mt-auto w-full max-w-none rounded-t-card border border-border bg-surface p-0 text-fg shadow-float backdrop:bg-black/50 backdrop:backdrop-blur-[2px] sm:m-auto sm:rounded-card',
		'open:animate-[ke-dialog-in_160ms_ease-out]',
		sizes[size],
		className
	)}
>
	{#if open}
		<div class="flex max-h-[85dvh] flex-col">
			<header class="flex items-start justify-between gap-3 px-5 pt-5">
				<div>
					<h2 id="{id}-title" class="text-lg leading-snug font-semibold">{title}</h2>
					{#if description}
						<p id="{id}-desc" class="mt-1 text-sm text-muted">{description}</p>
					{/if}
				</div>
				{#if dismissible}
					<button
						type="button"
						onclick={close}
						aria-label="বন্ধ করুন"
						class="-mt-1 -mr-2 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
					>
						<svg
							viewBox="0 0 24 24"
							class="size-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg
						>
					</button>
				{/if}
			</header>
			<div class="overflow-y-auto px-5 py-4">
				{@render children?.({ close })}
			</div>
			{#if footer}
				<footer
					class="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end"
				>
					{@render footer({ close })}
				</footer>
			{/if}
		</div>
	{/if}
</dialog>
