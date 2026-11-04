<script lang="ts">
	import {
		Alert,
		Avatar,
		Badge,
		Button,
		Card,
		Dialog,
		EmptyState,
		Field,
		IconButton,
		Input,
		Menu,
		MenuItem,
		MenuLabel,
		Money,
		QuantityStepper,
		SegmentedControl,
		Select,
		Separator,
		Skeleton,
		Spinner,
		Textarea
	} from '#lib/components/ui/index.ts';
	import GoogleSignInButton from '#lib/components/GoogleSignInButton.svelte';

	let dialogOpen = $state(false);
	let sheetOpen = $state(false);
	let qty = $state(18); // 1½, in twelfths
	let view = $state<'day' | 'month'>('day');
	let name = $state('');
	const nameError = $derived(name.length > 0 && name.length < 3 ? 'কমপক্ষে ৩ অক্ষর' : null);
</script>

<svelte:head><title>UI primitives</title></svelte:head>

<main class="mx-auto max-w-xl space-y-6 px-4 py-6">
	<h1 class="font-display text-4xl">UI primitives</h1>

	<Card title="Button" description="primary, secondary, ghost, danger, link">
		<div class="flex flex-wrap gap-2">
			<Button>হ্যাঁ, খাবো</Button>
			<Button variant="secondary">না</Button>
			<Button variant="ghost">বাতিল</Button>
			<Button variant="danger">মুছুন</Button>
			<Button variant="link" href="/ui">লিংক</Button>
		</div>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<Button size="sm">ছোট</Button>
			<Button size="lg">বড়</Button>
			<Button loading>সেভ হচ্ছে</Button>
			<Button disabled>নিষ্ক্রিয়</Button>
			<IconButton label="সেটিংস">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg
				>
			</IconButton>
		</div>
		<Button class="mt-3" block>Full width</Button>
	</Card>

	<Card title="Google">
		<GoogleSignInButton label="Google দিয়ে সাইন ইন করুন" />
	</Card>

	<Card title="Badge & Money">
		<div class="flex flex-wrap gap-2">
			<Badge>খসড়া</Badge>
			<Badge tone="highlight" dot>খোলা</Badge>
			<Badge tone="warning" dot>বন্ধ</Badge>
			<Badge tone="success" dot>চূড়ান্ত</Badge>
			<Badge tone="danger">বাকি</Badge>
		</div>
		<div class="mt-4 flex flex-wrap gap-4 text-lg">
			<Money value={125050} />
			<Money value={4500} balance />
			<Money value={-12000} balance />
			<Money value={125000} locale="en" />
		</div>
	</Card>

	<Card title="Alert">
		<div class="space-y-2">
			<Alert title="অর্ডার নেওয়া হচ্ছে">ম্যানেজার বন্ধ না করা পর্যন্ত বদলাতে পারবেন।</Alert>
			<Alert tone="success">অর্ডার সেভ হয়েছে।</Alert>
			<Alert tone="warning">মোট টাকা আর পরিশোধ মিলছে না।</Alert>
			<Alert tone="danger" title="ত্রুটি">সার্ভারে সমস্যা হয়েছে।</Alert>
		</div>
	</Card>

	<Card title="Form controls">
		<div class="space-y-4">
			<Field label="আইটেমের নাম" hint="বাংলায় লিখুন" error={nameError} required>
				{#snippet children(f)}
					<Input bind:value={name} placeholder="পরোটা" {...f} />
				{/snippet}
			</Field>
			<Field label="একক">
				{#snippet children(f)}
					<Select
						placeholder="বেছে নিন"
						value=""
						options={[
							{ value: 'pc', label: 'টি' },
							{ value: 'cup', label: 'কাপ' },
							{ value: 'plate', label: 'প্লেট' }
						]}
						{...f}
					/>
				{/snippet}
			</Field>
			<Field label="নোট">
				{#snippet children(f)}<Textarea placeholder="ঐচ্ছিক" {...f} />{/snippet}
			</Field>
		</div>
	</Card>

	<Card title="QuantityStepper & SegmentedControl">
		<div class="flex items-center justify-between">
			<span class="font-medium">পরোটা</span>
			<QuantityStepper bind:value={qty} label="পরোটা" />
		</div>
		<div class="mt-4">
			<SegmentedControl
				bind:value={view}
				label="ভিউ"
				options={[
					{ value: 'day', label: 'দৈনিক' },
					{ value: 'month', label: 'মাসিক' }
				]}
			/>
		</div>
	</Card>

	<Card title="Dialog & Menu">
		<div class="flex flex-wrap items-center gap-2">
			<Button onclick={() => (dialogOpen = true)}>Dialog</Button>
			<Button variant="secondary" onclick={() => (sheetOpen = true)}>Not dismissible</Button>
			<Menu label="মেনু" align="start">
				{#snippet trigger()}<Avatar name="Ifty" />{/snippet}
				{#snippet children({ close })}
					<MenuLabel>অ্যাকাউন্ট</MenuLabel>
					<MenuItem onclick={close}>প্রোফাইল</MenuItem>
					<MenuItem onclick={close}>রিপোর্ট</MenuItem>
					<Separator />
					<MenuItem tone="danger" onclick={close}>লগআউট</MenuItem>
				{/snippet}
			</Menu>
		</div>
	</Card>

	<Card title="Avatar, Spinner, Skeleton">
		<div class="flex items-center gap-3">
			<Avatar name="রহিম" size="sm" />
			<Avatar name="Karim" />
			<Avatar name="Broken" src="https://invalid.example/x.png" size="lg" />
			<Spinner />
			<Spinner size="lg" class="text-primary" />
		</div>
		<div class="mt-4 space-y-2">
			<Skeleton class="w-2/3" />
			<Skeleton class="w-1/2" />
			<Skeleton class="h-10" />
		</div>
	</Card>

	<Card padding="none">
		<EmptyState title="কোনো অর্ডার নেই" description="আজ এখনো কেউ অর্ডার করেনি।">
			{#snippet action()}<Button size="sm">মেনু দিন</Button>{/snippet}
		</EmptyState>
	</Card>
</main>

<Dialog
	bind:open={dialogOpen}
	title="অর্ডার বন্ধ করবেন?"
	description="বন্ধ করলে কেউ আর অর্ডার বদলাতে পারবে না।"
>
	<p>আজ ১২ জন অর্ডার করেছেন।</p>
	{#snippet footer({ close })}
		<Button variant="secondary" onclick={close}>বাতিল</Button>
		<Button onclick={close}>বন্ধ করুন</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={sheetOpen} title="চূড়ান্ত করা হচ্ছে" dismissible={false} size="sm">
	<p class="text-muted">Esc বা বাইরে ক্লিক করে বন্ধ হবে না।</p>
	{#snippet footer({ close })}<Button block onclick={close}>ঠিক আছে</Button>{/snippet}
</Dialog>
