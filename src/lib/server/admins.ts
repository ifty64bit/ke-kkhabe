import { ADMIN_EMAILS } from '$app/env/private';

const admins = new Set(
	(ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)
);

export const isAdminEmail = (email: string) => admins.has(email.trim().toLowerCase());
