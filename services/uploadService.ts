
// services/uploadService.ts
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a file or base64 string to Firebase Storage
 * @param file File object or Base64 string
 * @returns Download URL or null
 */
export const uploadToCloudinary = async (file: File | string): Promise<string | null> => {
    // Note: Function name kept as 'uploadToCloudinary' for backward compatibility,
    // but logic now uses Firebase Storage.
    
    try {
        let blob: Blob;
        // Tạo tên file unique để tránh trùng lặp
        let fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}`;

        if (typeof file === 'string') {
            // Handle Base64 String (from html2canvas or charms)
            if (file.startsWith('data:')) {
                const response = await fetch(file);
                blob = await response.blob();
                
                // Try to detect extension from mime type
                const mimeType = file.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1];
                const extension = mimeType?.split('/')[1] || 'png';
                fileName += `.${extension}`;
            } else if (file.startsWith('http')) {
                // If it's already a URL, just return it
                return file;
            } else {
                console.error("Invalid file format provided to upload service");
                return null;
            }
        } else {
            // Handle File Object (from input type='file')
            blob = file;
            // Sanitize filename
            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            fileName += `_${cleanName}`;
        }

        // Create a reference
        const storageRef = ref(storage, fileName);

        // Upload the file
        const snapshot = await uploadBytes(storageRef, blob);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log("Upload success to Firebase Storage:", downloadURL);
        return downloadURL;
    } catch (error: any) {
        console.error("Firebase Storage Upload Error:", error);
        
        // Gợi ý lỗi thường gặp cho người dùng
        if (error.code === 'storage/unauthorized') {
            alert("Lỗi quyền truy cập (403): Vui lòng vào Firebase Console -> Storage -> Rules và đổi 'allow write: if false' thành 'allow write: if true' (chế độ test).");
        } else if (error.code === 'storage/canceled') {
            alert("Đã hủy upload.");
        } else if (error.code === 'storage/unknown') {
            alert("Lỗi không xác định. Vui lòng kiểm tra lại kết nối mạng hoặc cấu hình bucket.");
        } else {
            alert(`Lỗi upload ảnh: ${error.message}`);
        }
        return null;
    }
};