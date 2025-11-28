
import { LegoPart } from '../types';
import { LEGO_PARTS } from '../constants';

export const categorizeParts = (parts: LegoPart[]) => {
    const categories: typeof LEGO_PARTS = {
        hair: [], face: [], shirt: [], pants: [], hat: [], accessory: [], pet: [], set: []
    };
    parts.forEach(p => {
        if (p.type in categories) {
            categories[p.type as keyof typeof LEGO_PARTS].push(p);
        }
    });
    return categories;
};
