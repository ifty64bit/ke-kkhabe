<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import GoogleLogo from './GoogleLogo.svelte';

	let { label, ...rest }: { label: string } & HTMLButtonAttributes = $props();
</script>

<!--
	@component
	"Sign in with Google" button following Google's branding guidelines:
	pill shape, 40px tall, Roboto Medium, official G mark on the left,
	Google's light (#FFF / #747775 / #1F1F1F) and dark (#131314 / #8E918F / #E3E3E3) palettes.
-->
<button
	{...rest}
	class="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-[#747775] bg-white px-3 font-google text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F7F8F8] active:bg-[#EEEFEF] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1F2020] dark:active:bg-[#2A2B2B]"
>
	<GoogleLogo size={20} />
	<span>{label}</span>
</button>
