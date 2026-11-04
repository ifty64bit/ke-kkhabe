/** Today's date in Dhaka as YYYY-MM-DD (the key used for `day.date`). */
export const dhakaToday = (now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Dhaka',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
