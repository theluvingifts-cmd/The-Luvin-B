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

/**
 * Preloads an image URL into browser cache
 */
export const preloadImage = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
};

/**
 * Converts a data URL (base64) to a Blob object without using fetch().
 */
export const dataURLToBlob = (dataURL: string): Blob | null => {
    try {
        const arr = dataURL.split(',');
        if (arr.length < 2) return null;
        
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error converting dataURL to Blob", e);
        return null;
    }
};