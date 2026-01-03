
// services/productService.ts
import { db } from '../config/firebase';
// Fix: Import firestore functions from 'firebase/firestore'
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, writeBatch, increment, getDoc } from 'firebase/firestore';
import { LEGO_PARTS } from '../constants'; // Lấy dữ liệu mẫu ban đầu
import type { LegoPart } from '../types';

// Tên collection trong Firebase
const COLLECTION_NAME = "lego_parts";

// 1. Hàm lấy toàn bộ sản phẩm từ Firebase
export const getAllParts = async (): Promise<LegoPart[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const parts: LegoPart[] = [];
        querySnapshot.forEach((doc) => {
            parts.push(doc.data() as LegoPart);
        });
        // Sort by order if available, otherwise by index/default
        return parts.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    } catch (error: any) {
        if (error.code === 'permission-denied') {
             console.warn("Firestore: Không có quyền đọc 'lego_parts'. Dùng dữ liệu mẫu.");
             return [];
        }
        console.error("Lỗi lấy danh sách sản phẩm:", error);
        return [];
    }
};

// 2. Hàm thêm sản phẩm mới
export const addPart = async (part: LegoPart) => {
    try {
        // Dùng part.id làm ID document luôn cho dễ quản lý
        // Initialize order with a high number or based on count
        await setDoc(doc(db, COLLECTION_NAME, part.id), { ...part, order: 9999 });
        return true;
    } catch (error) {
        console.error("Lỗi thêm sản phẩm:", error);
        return false;
    }
};

// 3. Hàm sửa sản phẩm
export const updatePart = async (partId: string, updates: Partial<LegoPart>) => {
    try {
        const partRef = doc(db, COLLECTION_NAME, partId);
        await updateDoc(partRef, updates);
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật sản phẩm:", error);
        return false;
    }
};

// 4. Hàm xóa sản phẩm
export const deletePart = async (partId: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, partId));
        return true;
    } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);
        return false;
    }
};

// 5. HÀM MỚI: Điều chỉnh tồn kho hàng loạt
// usageMap: { partId: quantityChange }
// quantityChange < 0: Trừ tồn kho (Khách mua)
// quantityChange > 0: Cộng kho (Hoàn tác, hủy đơn)
export const adjustStock = async (usageMap: Record<string, number>) => {
    try {
        const batch = writeBatch(db);
        let hasUpdates = false;

        for (const [partId, change] of Object.entries(usageMap)) {
            if (change === 0) continue;

            const partRef = doc(db, COLLECTION_NAME, partId);
            
            // Note: Since we are using standard firestore now, we could use a transaction to read and write safely,
            // but batch with increment is atomic for simple increment/decrement.
            // However, we want to check if the doc exists first ideally, or just try to update.
            // But writeBatch updates fail if doc doesn't exist? No, update fails, set doesn't.
            // Let's verify existence to be safe or just attempt update.
            // Since we're doing batch, we can't await inside loop easily for existence check unless we do it before.
            // Assuming products exist if they are in the order.
            
            // However, to be robust against missing documents:
            const partDoc = await getDoc(partRef);
            if (partDoc.exists()) {
                const data = partDoc.data() as LegoPart;
                if (typeof data.stock === 'number') {
                    batch.update(partRef, { stock: increment(change) });
                    hasUpdates = true;
                }
            }
        }

        if (hasUpdates) {
            await batch.commit();
            console.log("Đã cập nhật tồn kho thành công.");
        }
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật tồn kho:", error);
        return false;
    }
};

// 6. HÀM ĐẶC BIỆT: Đẩy dữ liệu mẫu từ constants.tsx lên Firebase (Chạy 1 lần đầu)
export const seedDatabase = async () => {
    try {
        console.log("Bắt đầu đồng bộ dữ liệu mẫu...");
        const allParts = Object.values(LEGO_PARTS).flat();
        
        let count = 0;
        for (const part of allParts) {
            // Set default order based on index
            await setDoc(doc(db, COLLECTION_NAME, part.id), { ...part, order: count });
            count++;
        }
        console.log(`Đã đồng bộ thành công ${count} sản phẩm!`);
        return count;
    } catch (error) {
        console.error("Lỗi đồng bộ:", error);
        return 0;
    }
};

// 7. Hàm sắp xếp lại vị trí sản phẩm
export const reorderParts = async (parts: LegoPart[]) => {
    try {
        // Firebase batch has a limit of 500 operations.
        const batch = writeBatch(db);
        
        parts.forEach((part, index) => {
            const partRef = doc(db, COLLECTION_NAME, part.id);
            batch.update(partRef, { order: index });
        });

        await batch.commit();
        console.log("Đã cập nhật thứ tự sản phẩm.");
        return true;
    } catch (error) {
        console.error("Lỗi sắp xếp sản phẩm:", error);
        return false;
    }
};
