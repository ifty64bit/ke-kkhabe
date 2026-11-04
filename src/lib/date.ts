const TZ = 'Asia/Dhaka';

/** Today's date in Dhaka as YYYY-MM-DD (the key used for `day.date`). */
export const dhakaToday = (now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);

/** Long Bangla date for a YYYY-MM-DD key, e.g. "বুধবার, ৪ নভেম্বর". */
export const formatDayBn = (date: string) =>
	new Intl.DateTimeFormat('bn-BD', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: TZ
	}).format(new Date(`${date}T06:00:00Z`));
