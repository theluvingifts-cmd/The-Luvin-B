
// services/productService.ts
import { db } from '../config/firebase';
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
        return parts;
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
        await setDoc(doc(db, COLLECTION_NAME, part.id), part);
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
// usageMap: { key: quantityChange }
// key can be "partId" OR "partId:color:ColorName"
// quantityChange < 0: Trừ kho (Khách mua)
// quantityChange > 0: Cộng kho (Hoàn tác, hủy đơn)
export const adjustStock = async (usageMap: Record<string, number>) => {
    try {
        // We cannot use a single batch for everything because updating a specific object in an array
        // requires reading, modifying, and writing back the whole array (or document).
        // Standard Firestore `increment` only works on top-level numeric fields or map values, not array elements.
        
        const batch = writeBatch(db);
        let hasBatchUpdates = false;

        for (const [key, change] of Object.entries(usageMap)) {
            if (change === 0) continue;

            // Check if key targets a specific color variant
            if (key.includes(':color:')) {
                const [partId, , colorName] = key.split(':');
                const partRef = doc(db, COLLECTION_NAME, partId);
                
                // For array updates, we must read-modify-write. 
                // NOTE: This is not atomic inside this loop if multiple users buy same item at exact same millisecond,
                // but acceptable for this scale. For strict consistency, transactions are needed.
                const partDoc = await getDoc(partRef);
                if (partDoc.exists()) {
                    const data = partDoc.data() as LegoPart;
                    if (data.colors && data.colors.length > 0) {
                        let colorUpdated = false;
                        const newColors = data.colors.map(c => {
                            if (c.name === colorName && typeof c.stock === 'number') {
                                colorUpdated = true;
                                return { ...c, stock: Math.max(0, c.stock + change) };
                            }
                            return c;
                        });

                        if (colorUpdated) {
                            // We can't use batch for this read-dependent update mixed with others easily
                            // So we just await the update here.
                            await updateDoc(partRef, { colors: newColors });
                        }
                    }
                }
            } else {
                // Standard Part ID update
                const partRef = doc(db, COLLECTION_NAME, key);
                
                // Optimization: We assume document exists. increment handles non-existent fields safely (creates them).
                // However, we should ideally check if 'stock' field exists to avoid creating it on items that shouldn't have it.
                // For now, we trust the calling logic only passes keys for trackable items.
                
                // To prevent writing to undefined (unlimited stock) items, we'll read first.
                // This sacrifices some performance for data integrity.
                const partDoc = await getDoc(partRef);
                if (partDoc.exists()) {
                    const data = partDoc.data();
                    if (typeof data.stock === 'number') {
                        batch.update(partRef, { stock: increment(change) });
                        hasBatchUpdates = true;
                    }
                }
            }
        }

        if (hasBatchUpdates) {
            await batch.commit();
        }
        console.log("Đã cập nhật tồn kho thành công.");
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
            await setDoc(doc(db, COLLECTION_NAME, part.id), part);
            count++;
        }
        console.log(`Đã đồng bộ thành công ${count} sản phẩm!`);
        return count;
    } catch (error) {
        console.error("Lỗi đồng bộ:", error);
        return 0;
    }
};
