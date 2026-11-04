import type { MessageKey } from './bn.ts';

/** English UI strings. Typed against the Bangla keys so none can be missing. */
export const en: Record<MessageKey, string> = {
	'app.name': 'কে খাবে',
	'nav.home': 'Ke Khabe, today',

	'common.cancel': 'Cancel',
	'common.close': 'Close',
	'common.loading': 'Loading',
	'common.logout': 'Log out',

	'theme.label': 'Theme',
	'theme.light': 'Light',
	'theme.system': 'System',
	'theme.dark': 'Dark',

	'lang.short': 'বাং',
	'lang.switch': 'বাংলায় দেখুন',

	'account.label': 'Account',
	'account.manager': 'Manager',
	'account.member': 'Member',

	'stepper.decrease': 'Fewer {label}',
	'stepper.increase': 'More {label}',

	'login.title': 'Ke Khabe?',
	'login.tagline': 'Office breakfast orders and dues, all in one place',
	'login.google': 'Sign in with Google',
	'login.error': "Couldn't start Google sign-in. Try again.",

	'today.headTitle': 'Breakfast today?',
	'today.prompt': 'Breakfast today, {name}?',
	'today.noMenu': "Today's menu isn't up yet.",
	'today.noMenuCta': "Post today's menu",
	'today.noMenuMember': "You can order here once it's posted.",
	'today.yourOrder': 'Your order:',
	'today.change': 'Change order',
	'today.skipToday': 'Skip today',
	'today.yes': "Yes, I'll eat",
	'today.no': 'Not today',
	'today.saidNo': "You've said you're skipping today.",
	'today.editUntilClose': 'You can change this until the manager closes orders.',
	'today.closedNone': "You don't have an order today.",
	'today.closedNote': 'Orders are closed. The manager is getting breakfast.',
	'today.ate': 'You had:',
	'today.yourCost': 'Your share',
	'today.finalizedNone': "You didn't order today.",

	'links.label': 'Other pages',
	'links.ledger': 'Ledger',
	'links.ledgerHint': 'Who owes whom',
	'links.reports': 'Reports',
	'links.reportsHint': 'Monthly totals',
	'links.manage': 'Manage',
	'links.manageHint': 'Run today',

	'order.title': 'What would you like?',
	'order.description': 'Pick what you want and how many.',
	'order.submit': 'Place order',
	'order.change': 'Change order',
	'order.saveFailed': "Couldn't save your order. Try again.",
	'order.error.noMenu': "Today's menu isn't up yet.",
	'order.error.closed': 'Orders for today are closed.',
	'order.error.invalid': 'Some quantities are invalid. Try again.',
	'order.error.empty': 'Pick at least one item, or choose "Not today".',

	'ledger.title': 'Ledger',
	'ledger.description': 'Who is owed, who owes, and the simplest way to settle up.',
	'ledger.emptyTitle': 'Nothing in the ledger yet',
	'ledger.emptyBody': "Everyone's balance shows up here once the first day is finalized.",

	'reports.headTitle': 'Reports',
	'reports.title': 'Monthly report',
	'reports.description': 'What everyone had and paid each month, and what is left at month end.',
	'reports.emptyTitle': "This month's report is empty",
	'reports.emptyBody': 'Each finalized day is added here.',

	'manage.title': 'Manage',
	'manage.tabs.today': 'Today',
	'manage.tabs.items': 'Items',
	'manage.tabs.members': 'Members',
	'manage.today.emptyTitle': "Today hasn't started",
	'manage.today.emptyBody': "Pick today's menu from the item list and open orders from here.",
	'manage.items.emptyTitle': 'No items yet',
	'manage.items.emptyBody':
		'Add the usual items once (paratha, egg, tea) and pick from them every day.',
	'manage.members.emptyTitle': 'Members',
	'manage.members.emptyBody':
		'Everyone who has signed in with Google appears here. Make someone a manager or deactivate them from here.',

	'inactive.title': 'Your account is deactivated',
	'inactive.body': 'Ask a manager to turn it back on.',

	'error.403.title': 'This page is for managers',
	'error.403.body': 'Your account is a member account. Ask a manager if you need access.',
	'error.404.title': "This page doesn't exist",
	'error.404.body': 'The link may be wrong, or the page has moved.',
	'error.generic.title': 'Something went wrong',
	'error.generic.body': 'Try again in a moment. If it keeps happening, tell a manager.',
	'error.home': 'Go to today'
};
