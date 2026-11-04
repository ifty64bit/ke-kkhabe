import { error } from '@sveltejs/kit';

/** Throw 403 unless the signed-in user is a manager. Call in every manage load and action. */
export function requireManager(locals: App.Locals) {
	if (locals.user?.role !== 'manager') error(403, 'Managers only');
	return locals.user;
}
