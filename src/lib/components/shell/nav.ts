export type NavItem = {
	/** Route id; pass to `resolve()` and compare with `page.route.id`. */
	route: '/(app)' | '/(app)/ledger' | '/(app)/reports' | '/(app)/manage';
	label: string;
	/** SVG path data, 24×24 viewBox, stroked. */
	icon: string;
	managerOnly?: boolean;
};

export const NAV: NavItem[] = [
	{
		route: '/(app)',
		label: 'আজ',
		icon: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3'
	},
	{
		route: '/(app)/ledger',
		label: 'হিসাব',
		icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11M9 8h6'
	},
	{
		route: '/(app)/reports',
		label: 'রিপোর্ট',
		icon: 'M4 20h16M7 16v-5M12 16V6M17 16v-8'
	},
	{
		route: '/(app)/manage',
		label: 'ম্যানেজ',
		icon: 'M9 4h6v3H9zM7 5.5H5.5A1.5 1.5 0 0 0 4 7v12.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H17M8 12l2.5 2.5L16 9',
		managerOnly: true
	}
];

export const navFor = (role: string) => NAV.filter((n) => !n.managerOnly || role === 'manager');

/** A destination is active on its own route and any route nested under it. */
export const isActive = (item: NavItem, routeId: string | null) =>
	item.route === '/(app)' ? routeId === '/(app)' : (routeId?.startsWith(item.route) ?? false);
