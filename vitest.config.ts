import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests for the pure modules only; no SvelteKit or database involved.
export default defineConfig({
	resolve: {
		alias: { '#lib': path.resolve(import.meta.dirname, 'src/lib') }
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
