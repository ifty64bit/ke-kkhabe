/** Unit presets: managers pick one; both languages are stored on the item. */
export const UNITS = [
	{ id: 'pc', bn: 'টি', en: 'pc' },
	{ id: 'piece', bn: 'পিস', en: 'piece' },
	{ id: 'cup', bn: 'কাপ', en: 'cup' },
	{ id: 'glass', bn: 'গ্লাস', en: 'glass' },
	{ id: 'bowl', bn: 'বাটি', en: 'bowl' },
	{ id: 'plate', bn: 'প্লেট', en: 'plate' },
	{ id: 'packet', bn: 'প্যাকেট', en: 'packet' }
] as const;

export type UnitId = (typeof UNITS)[number]['id'];

export const unitById = (id: string) => UNITS.find((u) => u.id === id);

/** Find the preset an item uses (by its English unit), falling back to "pc". */
export const unitIdFor = (unitEn: string): UnitId => UNITS.find((u) => u.en === unitEn)?.id ?? 'pc';
