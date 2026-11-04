import { extendTailwindMerge } from 'tailwind-merge';

/** Theme token names registered in layout.css so tailwind-merge resolves conflicts correctly. */
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			color: [
				'bg',
				'surface',
				'surface-2',
				'fg',
				'muted',
				'border',
				'ring',
				'primary',
				'primary-hover',
				'primary-fg',
				'haldi',
				'haldi-soft',
				'success',
				'success-soft',
				'danger',
				'danger-soft',
				'warning',
				'warning-soft'
			],
			radius: ['card', 'control'],
			shadow: ['float'],
			font: ['display', 'google']
		}
	}
});

type ClassValue = string | false | null | undefined;

/** Join class names, dropping falsy values and letting later Tailwind classes win. */
export const cn = (...classes: ClassValue[]) => twMerge(classes.filter(Boolean).join(' '));
