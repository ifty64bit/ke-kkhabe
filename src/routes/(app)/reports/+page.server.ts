import { dhakaToday } from '#lib/date.ts';
import { buildMonthReport } from '#lib/report.ts';
import { loadMonthInput } from '#lib/server/report.ts';
import type { PageServerLoad } from './$types';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A manager sees everyone by default and may ask for their own month with `view=me`.
 * A member always gets only their own row, whatever the query string says.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const me = locals.user!;
	const isManager = me.role === 'manager';
	const today = dhakaToday();

	const requestedMonth = url.searchParams.get('month');
	const month = requestedMonth && MONTH.test(requestedMonth) ? requestedMonth : today.slice(0, 7);
	const view: 'me' | 'all' = isManager && url.searchParams.get('view') !== 'me' ? 'all' : 'me';

	const input = await loadMonthInput(locals.db, month);
	return {
		report: buildMonthReport(input, view === 'all' ? 'all' : [me.id]),
		isManager,
		view,
		today
	};
};
