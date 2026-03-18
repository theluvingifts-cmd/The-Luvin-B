
// services/uploadService.ts
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { dataURLToBlob } from '../utils/helpers';

/**
 * Uploads a file or base64 string directly to Firebase Storage.
 * @param file File object or Base64 string
 * @returns Public Download URL or null if failed
 */
export const uploadToCloudinary = async (file: File | string): Promise<string | null> => {
    try {
        console.log("Starting Firebase Storage upload...");
        let blob: Blob | null;
        let fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
        console.log("Uploading blob to path:", fileName);
        const snapshot = await uploadBytes(storageRef, blob);

        // Get the permanent download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log("Firebase Storage Upload Success:", downloadURL);
        return downloadURL;
    } catch (error: any) {
        console.error("Firebase Storage Upload Error:", error);
        
        // Detailed error handling for Vercel CORS/Rules issues
        if (error.code === 'storage/unauthorized') {
            alert("Lỗi 403: Bạn chưa cấu hình Rules cho Firebase Storage. Vui lòng vào Firebase Console -> Storage -> Rules và đổi thành 'allow read, write: if true;' (hoặc cấu hình bảo mật hơn).");
        } else if (error.message && error.message.includes('CORS')) {
            alert("Lỗi CORS: Bạn cần cấu hình CORS cho Firebase Storage để cho phép upload từ Vercel. Hãy xem hướng dẫn trong phần chat.");
        } else {
            alert(`Lỗi upload Firebase: ${error.message || "Kết nối thất bại"}`);
        }
        return null;
    }
};
