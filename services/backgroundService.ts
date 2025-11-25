
// services/backgroundService.ts
import { db } from '../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { PRESET_BACKGROUNDS_SQUARE, PRESET_BACKGROUNDS_RECTANGLE } from '../constants';
import type { PresetBackground } from '../types';

const COLLECTION_NAME = "backgrounds";

// 1. Lấy tất cả background
export const getAllBackgrounds = async (): Promise<PresetBackground[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const backgrounds: PresetBackground[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            backgrounds.push({
                id: doc.id,
                name: data.name || doc.id,
                url: data.url,
                category: data.category || 'Khác',
                type: data.type || 'square',
                order: data.order
            } as PresetBackground);
        });
        // Sort by order
        return backgrounds.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    } catch (error: any) {
        // Bắt lỗi quyền truy cập để không làm crash app, trả về mảng rỗng để App dùng fallback constants
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Không có quyền đọc 'backgrounds'. Đang sử dụng dữ liệu mẫu cục bộ.");
        } else {
            console.error("Lỗi lấy danh sách background:", error);
        }
        return [];
    }
};

// 2. Thêm background mới
export const addBackground = async (bg: PresetBackground) => {
    try {
        await setDoc(doc(db, COLLECTION_NAME, bg.id), { ...bg, order: 9999 });
        return true;
    } catch (error) {
        console.error("Lỗi thêm background:", error);
        return false;
    }
};

// 3. Sửa background
export const updateBackground = async (bgId: string, updates: Partial<PresetBackground>) => {
    try {
        const bgRef = doc(db, COLLECTION_NAME, bgId);
        await updateDoc(bgRef, updates);
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật background:", error);
        return false;
    }
};

// 4. Xóa background
export const deleteBackground = async (bgId: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, bgId));
        return true;
    } catch (error) {
        console.error("Lỗi xóa background:", error);
        return false;
    }
};

// 5. Seed dữ liệu mẫu (Chạy 1 lần)
export const seedBackgrounds = async () => {
    try {
        console.log("Bắt đầu đồng bộ background mẫu...");
        let count = 0;
        const batch = writeBatch(db);
        
        // Seed Square
        for (const bg of PRESET_BACKGROUNDS_SQUARE) {
            const id = `bg_sq_${Date.now()}_${count}`;
            const newBg: PresetBackground = { ...bg, id, type: 'square', order: count };
            batch.set(doc(db, COLLECTION_NAME, id), newBg);
            count++;
        }

        // Seed Rectangle
        for (const bg of PRESET_BACKGROUNDS_RECTANGLE) {
            const id = `bg_rect_${Date.now()}_${count}`;
            const newBg: PresetBackground = { ...bg, id, type: 'rectangle', order: count };
            batch.set(doc(db, COLLECTION_NAME, id), newBg);
            count++;
        }

        await batch.commit();
        console.log(`Đã đồng bộ thành công ${count} background!`);
        return count;
    } catch (error) {
        console.error("Lỗi đồng bộ background:", error);
        return 0;
    }
};

// 6. Hàm sắp xếp lại background
export const reorderBackgrounds = async (items: PresetBackground[]) => {
    try {
        const batch = writeBatch(db);
        items.forEach((item, index) => {
            const ref = doc(db, COLLECTION_NAME, item.id);
            batch.update(ref, { order: index });
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Lỗi sắp xếp background:", error);
        return false;
    }
};