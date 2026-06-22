
// services/uploadService.ts
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { dataURLToBlob, resizeImage } from '../utils/helpers';

/**
 * Xác định thư mục lưu trữ dựa trên loại file hoặc tên file
 */
const getStorageFolder = (file: File | string): string => {
    let fileName = '';
    let mimeType = '';

    if (typeof file !== 'string') {
        fileName = file.name.toLowerCase();
        mimeType = file.type.toLowerCase();
    } else if (file.startsWith('data:')) {
        mimeType = file.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || '';
    }

    // 1. Nhóm Assets: Font chữ, Logo, Ảnh nền hệ thống
    const assetExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const assetKeywords = ['logo', 'bg', 'background', 'banner', 'icon', 'system', 'asset', 'font'];
    
    const isAsset = assetExtensions.some(ext => fileName.endsWith(ext)) || 
                    assetKeywords.some(key => fileName.includes(key)) ||
                    mimeType.includes('font');

    if (isAsset) return 'uploads/assets';

    // 2. Nhóm Temp: Bill chuyển khoản, Preview thiết kế, Ảnh tạm
    const tempKeywords = ['bill', 'preview', 'design', 'receipt', 'payment', 'chuyenkhoan', 'thietke', 'temp'];
    if (tempKeywords.some(key => fileName.includes(key))) {
        return 'uploads/temp';
    }

    // Mặc định cho các file khác (đưa vào temp để dễ cài đặt Lifecycle dọn dẹp)
    return 'uploads/temp';
};

/**
 * Uploads a file or base64 string directly to Firebase Storage.
 * @param file File object or Base64 string
 * @param customFolder Optional folder override (e.g., 'avatars')
 * @returns Public Download URL or null if failed
 */
export const uploadFile = async (file: File | string, customFolder?: string): Promise<string | null> => {
    try {
        let blob: Blob | null;
        const folder = customFolder ? `uploads/${customFolder}` : getStorageFolder(file);
        let fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}`;

        if (typeof file === 'string') {
            // Handle Base64 String
            if (file.startsWith('data:')) {
                blob = dataURLToBlob(file);
                if (!blob) {
                    console.error("Failed to convert dataURL to blob");
                    return null;
                }
                
                // Try to detect extension from mime type
                const mimeType = file.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1];
                const extension = mimeType?.split('/')[1] || 'png';
                fileName += `.${extension}`;
            } else if (file.startsWith('http')) {
                // If it's already a URL, just return it
                return file;
            } else {
                console.error("Invalid string provided to upload service (not dataURL or HTTP)");
                return null;
            }
        } else {
            // Handle File Object
            blob = file;
            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            fileName += `_${cleanName}`;
        }

        // Create a reference in Firebase Storage
        const storageRef = ref(storage, fileName);

        // Upload the bytes
        const snapshot = await uploadBytes(storageRef, blob);

        // Get the permanent download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log(`Upload success to Firebase Storage (${folder}):`, downloadURL);
        return downloadURL;
    } catch (error: any) {
        console.warn("Storage upload failed - activating failsafe compressed Base64 fallback instead:", error);
        
        // Failsafe fallback: return compressed/raw Base64 dataURL directly so order creation never breaks
        try {
            if (typeof file !== 'string') {
                // Compress browser File object to standard lightweight JPEG base64 string
                const compressedBase = await resizeImage(file, 800, 800);
                console.log("Converted File to failsafe Base64 string successfully");
                return compressedBase;
            } else if (file.startsWith('data:')) {
                // If already base64, return as is
                return file;
            }
        } catch (fallbackError) {
            console.error("Failsafe Base64 conversion also failed:", fallbackError);
        }
        
        return null;
    }
};
