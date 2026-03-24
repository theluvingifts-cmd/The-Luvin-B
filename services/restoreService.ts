
import { db, storage } from '../config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { LegoPart, PresetBackground } from '../types';

export interface RestoreResult {
    success: boolean;
    message: string;
    updatedCount: number;
}

/**
 * Hàm khôi phục ảnh bằng cách upload file mới và tự động khớp với dữ liệu cũ dựa trên tên file
 */
export const restoreImagesByFileName = async (
    files: File[], 
    onProgress?: (msg: string) => void
): Promise<RestoreResult> => {
    try {
        let updatedCount = 0;
        
        // 1. Lấy toàn bộ dữ liệu từ Firestore để so sánh
        onProgress?.("Đang tải dữ liệu từ Firestore...");
        const partsSnapshot = await getDocs(collection(db, "lego_parts"));
        const backgroundsSnapshot = await getDocs(collection(db, "backgrounds"));
        
        const allParts: LegoPart[] = [];
        partsSnapshot.forEach(d => allParts.push(d.data() as LegoPart));
        
        const allBackgrounds: PresetBackground[] = [];
        backgroundsSnapshot.forEach(d => allBackgrounds.push(d.data() as PresetBackground));

        onProgress?.(`Bắt đầu xử lý ${files.length} tệp tin...`);

        for (const file of files) {
            const fileName = file.name;
            onProgress?.(`Đang xử lý: ${fileName}`);

            // Tìm xem file này thuộc về linh kiện nào hoặc background nào
            // Logic: Tên file chứa trong URL cũ hoặc khớp với ID/Name
            const targetPart = allParts.find(p => p.imageUrl.includes(fileName) || p.id === fileName.split('.')[0]);
            const targetBg = allBackgrounds.find(b => b.url.includes(fileName) || b.id === fileName.split('.')[0]);

            if (targetPart || targetBg) {
                // Upload file lên Storage
                const storageRef = ref(storage, `uploads/${Date.now()}_${fileName}`);
                const uploadRes = await uploadBytes(storageRef, file);
                const newUrl = await getDownloadURL(uploadRes.ref);

                if (targetPart) {
                    await updateDoc(doc(db, "lego_parts", targetPart.id), { imageUrl: newUrl });
                    onProgress?.(`✅ Đã khôi phục linh kiện: ${targetPart.name}`);
                } else if (targetBg) {
                    await updateDoc(doc(db, "backgrounds", targetBg.id), { url: newUrl });
                    onProgress?.(`✅ Đã khôi phục hình nền: ${targetBg.name}`);
                }
                
                updatedCount++;
            } else {
                onProgress?.(`❓ Không tìm thấy dữ liệu khớp cho: ${fileName}`);
            }
        }

        return {
            success: true,
            message: `Hoàn tất! Đã khôi phục thành công ${updatedCount} mục.`,
            updatedCount
        };
    } catch (error: any) {
        console.error("Lỗi khôi phục:", error);
        return {
            success: false,
            message: `Lỗi: ${error.message}`,
            updatedCount: 0
        };
    }
};
