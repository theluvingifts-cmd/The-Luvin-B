
// services/uploadService.ts
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { dataURLToBlob } from '../utils/helpers';

/**
 * Uploads a file or base64 string directly to Firebase Storage.
 * @param file File object or Base64 string
 * @returns Public Download URL or null if failed
 */
// Renamed from uploadToFirebase to uploadToCloudinary to fix missing export errors across the project
export const uploadToCloudinary = async (file: File | string): Promise<string | null> => {
    try {
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
        const snapshot = await uploadBytes(storageRef, blob);

        // Get the permanent download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log("Upload success to Firebase Storage:", downloadURL);
        return downloadURL;
    } catch (error: any) {
        console.error("Firebase Storage Upload Error:", error);
        
        if (error.code === 'storage/unauthorized') {
            alert("Lỗi quyền truy cập (403): Vui lòng kiểm tra Firebase Storage Rules trong Console.");
        } else {
            alert(`Lỗi upload: ${error.message || "Kết nối thất bại"}`);
        }
        return null;
    }
};
