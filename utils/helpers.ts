
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
 * Thu nhỏ và nén ảnh để tiết kiệm bộ nhớ State và LocalStorage
 */
export const resizeImage = (file: File, maxWidth = 1200, maxHeight = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Nén xuống định dạng JPEG với chất lượng 0.7 để giảm dung lượng tối đa
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
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

/**
 * Slugifies a string for URL usage
 */
export const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

/**
 * Formats a full address string from customer details
 */
export const formatFullAddress = (customer: { address: string; ward?: string; district?: string; province?: string }) => {
    const parts = [customer.address, customer.ward, customer.district, customer.province].filter(Boolean);
    return parts.join(', ');
};

/**
 * Chuyển đổi một đối tượng thành chuỗi JSON một cách an toàn,
 * xử lý được các cấu trúc vòng (circular structure).
 */
export const safeJsonStringify = (obj: any): string => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return '[Circular]';
            }
            cache.add(value);
        }
        return value;
    });
};

/**
 * Removes undefined values and handles complex/circular objects.
 */
export const cleanForFirestore = (obj: any, seen = new WeakSet()): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    // Xử lý Circular References
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    
    // Nếu là Array
    if (Array.isArray(obj)) {
        return obj
            .map(item => cleanForFirestore(item, seen))
            .filter(item => item !== undefined);
    }

    // Kiểm tra xem có phải plain object không
    const prototype = Object.getPrototypeOf(obj);
    const isPlainObject = prototype === null || prototype === Object.prototype;

    if (!isPlainObject) {
        // Trả về type hoặc string representation cho các class lạ
        if (typeof obj.toString === 'function' && obj.toString() !== '[object Object]') {
            return obj.toString();
        }
        return undefined; // Bỏ qua các đối tượng phức tạp
    }

    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = cleanForFirestore(obj[key], seen);
            if (val !== undefined) {
                newObj[key] = val;
            }
        }
    }
    return newObj;
};
