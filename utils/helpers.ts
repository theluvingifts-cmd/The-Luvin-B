
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
 * An toàn sao chép sâu (deep clone) một đối tượng mà không bị lỗi Circular structure hay DOM elements
 */
export const safeClone = <T>(obj: T): T => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    const seen = new WeakSet();
    const clone = (item: any): any => {
        if (item === null || item === undefined) return item;
        if (typeof item !== 'object') return item;
        if (typeof item === 'function') return undefined;
        if (typeof Node !== 'undefined' && item instanceof Node) return undefined;
        if (item.nodeType && typeof item.nodeName === 'string') return undefined;
        if (item.$$typeof) return undefined; // React element

        if (seen.has(item)) return undefined;
        seen.add(item);

        if (Array.isArray(item)) {
            return item.map(i => clone(i)).filter(i => i !== undefined);
        }

        if (item instanceof Date) return new Date(item.getTime());

        const result: any = {};
        for (const key in item) {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                const val = clone(item[key]);
                if (val !== undefined) {
                    result[key] = val;
                }
            }
        }
        return result;
    };

    return clone(obj);
};

/**
 * Chuyển đổi một đối tượng thành chuỗi JSON một cách an toàn,
 * xử lý được các cấu trúc vòng (circular structure).
 */
export const safeJsonStringify = (obj: any): string => {
    const seen = new WeakSet();
    const cleanObject = (val: any): any => {
        if (val === null || val === undefined) return val;
        
        if (typeof val !== 'object') {
            if (typeof val === 'function') return '[Function]';
            if (typeof val === 'symbol') return val.toString();
            if (typeof val === 'bigint') return val.toString();
            return val;
        }

        // DOM Elements
        if (typeof Node !== 'undefined' && val instanceof Node) {
            return `[Element ${val.nodeName}]`;
        }
        if (val.nodeType && typeof val.nodeName === 'string') {
            return `[Element ${val.nodeName}]`;
        }

        // Firestore DocumentReference
        if (val.path && typeof val.path === 'string' && val.firestore) {
            return `[FirestoreRef: ${val.path}]`;
        }

        if (seen.has(val)) {
            return '[Circular]';
        }
        seen.add(val);

        if (Array.isArray(val)) {
            return val.map(item => cleanObject(item));
        }

        if (val instanceof Date) {
            return val.toISOString();
        }

        if (val instanceof RegExp) {
            return val.toString();
        }

        const prototype = Object.getPrototypeOf(val);
        const isPlainObject = prototype === null || prototype === Object.prototype;

        if (!isPlainObject) {
            if (val.constructor && (
                val.constructor.name === 'DocumentReference' || 
                val.constructor.name === 'FieldValue' ||
                val.constructor.name === 'GeoPoint'
            )) {
                return `[Firestore: ${val.constructor.name}]`;
            }
            if (typeof val.toString === 'function' && val.toString() !== '[object Object]') {
                return val.toString();
            }
            const className = val.constructor ? val.constructor.name : 'UnknownClass';
            if (className !== 'Object' && className !== '') {
                return `[Instance of ${className}]`;
            }
        }

        const cleaned: any = {};
        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) {
                cleaned[key] = cleanObject(val[key]);
            }
        }
        return cleaned;
    };

    try {
        return JSON.stringify(cleanObject(obj));
    } catch (e) {
        return '[Serialization Error]';
    }
};

/**
 * Removes undefined values and handles complex/circular objects.
 */
export const cleanForFirestore = (obj: any, seen = new WeakSet()): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    // Preserve Firestore classes so they can be written to DB
    if (obj.constructor && (
        obj.constructor.name === 'DocumentReference' || 
        obj.constructor.name === 'FieldValue' ||
        obj.constructor.name === 'GeoPoint' ||
        (typeof obj.path === 'string' && obj.firestore)
    )) {
        return obj;
    }

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

/**
 * Automatically calculates photo frame and LED light counts for gallery products or configurations
 */
export const getGalleryCounts = (
    customConfig?: any | null, 
    template?: any | null
): { photoFrameCount: number; lightCount: number } => {
    const isGallery = template?.productLine === 'gallery' 
        || customConfig?.productLine === 'gallery' 
        || customConfig?.isMuseumStyle 
        || customConfig?.frameId === 'gallery-1520'
        || (typeof customConfig?.frameId === 'string' && customConfig.frameId.toLowerCase().includes('gallery'))
        || (template?.name && template.name.toUpperCase().includes('GALLERY'));

    if (!isGallery) {
        return { photoFrameCount: 0, lightCount: 0 };
    }

    let photoFrameCount = customConfig?.galleryOptions?.photoFrameCount 
        ?? template?.galleryOptions?.photoFrameCount 
        ?? template?.config?.galleryOptions?.photoFrameCount;

    if (photoFrameCount === undefined || photoFrameCount === null || photoFrameCount === 0) {
        // 1. Check formFields for image upload fields (e.g. photo frames on the wall)
        const formFields = customConfig?.formFields || template?.config?.formFields || [];
        const imageFieldsCount = Array.isArray(formFields) ? formFields.filter((f: any) => f && f.type === 'image').length : 0;

        // 2. Check draggableItems for photo frames
        const draggableItems = customConfig?.draggableItems || template?.config?.draggableItems || [];
        const frameItemsCount = Array.isArray(draggableItems) ? draggableItems.filter((item: any) => 
            item && (
                item.type === 'frame' || 
                item.isPhotoFrame || 
                (typeof item.partId === 'string' && (item.partId.toLowerCase().includes('frame') || item.partId.toLowerCase().includes('khung')))
            )
        ).length : 0;

        photoFrameCount = Math.max(imageFieldsCount, frameItemsCount);
    }

    let lightCount = customConfig?.galleryOptions?.lightCount 
        ?? template?.galleryOptions?.lightCount 
        ?? template?.config?.galleryOptions?.lightCount;

    if (lightCount === undefined || lightCount === null || lightCount === 0) {
        const draggableItems = customConfig?.draggableItems || template?.config?.draggableItems || [];
        const lightItems = Array.isArray(draggableItems) ? draggableItems.filter((item: any) => 
            item && (
                item.type === 'light' || 
                (typeof item.partId === 'string' && (item.partId.toLowerCase().includes('light') || item.partId.toLowerCase().includes('den') || item.partId.toLowerCase().includes('led')))
            )
        ) : [];
        
        if (lightItems.length > 0) {
            lightCount = lightItems.length;
        } else {
            const isGallery = template?.productLine === 'gallery' || customConfig?.productLine === 'gallery' || (template?.name && template.name.toUpperCase().includes('GALLERY'));
            if (isGallery) {
                // Standard top LED spotlights for gallery frames
                lightCount = 2;
            } else {
                lightCount = 0;
            }
        }
    }

    return {
        photoFrameCount: Number(photoFrameCount) || 0,
        lightCount: Number(lightCount) || 0
    };
};
