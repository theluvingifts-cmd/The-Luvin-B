
// services/productService.ts
import { db } from '../config/firebase';
// Proper modular firestore imports
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, writeBatch, increment, getDoc, query, orderBy } from 'firebase/firestore';
import { LEGO_PARTS } from '../constants'; // Lấy dữ liệu mẫu ban đầu
import type { LegoPart } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { createAuditLog } from './auditService';
import { cleanForFirestore } from '../utils/helpers';

// Tên collection trong Firebase
const COLLECTION_NAME = "lego_parts";

// 1. Hàm lấy toàn bộ sản phẩm từ Firebase
export const getAllParts = async (): Promise<LegoPart[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
        let querySnapshot = await getDocs(q).catch(async (err) => {
            console.warn("Index not found or error, falling back to unordered fetch:", err);
            return await getDocs(collection(db, COLLECTION_NAME)).catch(e => {
                handleFirestoreError(e, OperationType.LIST, COLLECTION_NAME);
                throw e;
            });
        });

        const parts: LegoPart[] = [];
        querySnapshot.forEach((doc) => {
            parts.push(doc.data() as LegoPart);
        });
        
        // Safety sort
        parts.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        
        return parts;
    } catch (error: any) {
        if (error.message && error.message.includes('{')) throw error; // Already handled
        console.error("Lỗi lấy danh sách sản phẩm:", error);
        return [];
    }
};

// 2. Hàm thêm sản phẩm mới
export const addPart = async (part: LegoPart) => {
    try {
        const cleaned = cleanForFirestore({ ...part, order: 9999 });
        await setDoc(doc(db, COLLECTION_NAME, part.id), cleaned);
        await createAuditLog('create_part', 'lego_part', part.id, { name: part.name });
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${COLLECTION_NAME}/${part.id}`);
        return false;
    }
};

// 3. Hàm sửa sản phẩm
export const updatePart = async (partId: string, updates: Partial<LegoPart>) => {
    try {
        const partRef = doc(db, COLLECTION_NAME, partId);
        const cleaned = cleanForFirestore(updates);
        await updateDoc(partRef, cleaned);
        await createAuditLog('update_part', 'lego_part', partId, updates);
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${partId}`);
        return false;
    }
};

// 4. Hàm xóa sản phẩm
export const deletePart = async (partId: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, partId));
        await createAuditLog('delete_part', 'lego_part', partId);
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${partId}`);
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
            await createAuditLog('adjust_stock', 'lego_part', 'multiple', usageMap);
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
export const reorderPartsList = async (parts: LegoPart[]) => {
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
