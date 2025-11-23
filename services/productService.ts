
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
// quantityChange < 0: Trừ kho (Khách mua)
// quantityChange > 0: Cộng kho (Hoàn tác, hủy đơn)
// Key có thể là "partId" hoặc "partId:color:ColorName"
export const adjustStock = async (usageMap: Record<string, number>) => {
    try {
        // 1. Identify unique part IDs involved
        const partIds = new Set<string>();
        Object.keys(usageMap).forEach(key => {
            const [partId] = key.split(':color:');
            partIds.add(partId);
        });

        if (partIds.size === 0) return true;

        // 2. Fetch documents
        const docsMap: Record<string, any> = {};
        const docRefs: Record<string, any> = {};

        await Promise.all(Array.from(partIds).map(async (pid) => {
            const ref = doc(db, COLLECTION_NAME, pid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                docsMap[pid] = snap.data();
                docRefs[pid] = ref;
            }
        }));

        const batch = writeBatch(db);
        let hasUpdates = false;

        // 3. Apply updates in memory
        for (const [key, change] of Object.entries(usageMap)) {
            if (change === 0) continue;
            
            if (key.includes(':color:')) {
                // Handle Color Variant Stock
                const [partId, colorName] = key.split(':color:');
                const partData = docsMap[partId];
                
                if (partData && partData.colors && Array.isArray(partData.colors)) {
                    const colorIdx = partData.colors.findIndex((c: any) => c.name === colorName);
                    
                    if (colorIdx !== -1) {
                        const currentColor = partData.colors[colorIdx];
                        // Only update if stock is a number (finite). If undefined, it's unlimited.
                        if (typeof currentColor.stock === 'number') {
                            partData.colors[colorIdx].stock += change;
                            // Don't allow negative stock unless we want backorders? Let's allow negatives for tracking overselling.
                        }
                    }
                }
            } else {
                // Handle Main Part Stock
                const partId = key;
                const partData = docsMap[partId];
                if (partData && typeof partData.stock === 'number') {
                    partData.stock += change;
                }
            }
        }

        // 4. Add updates to batch
        // Since we modified the objects in `docsMap` directly (including nested arrays),
        // we can just overwrite the document. `set` with `merge: false` replaces it, 
        // or `update` works if doc exists. We know doc exists.
        for (const partId of partIds) {
            if (docsMap[partId] && docRefs[partId]) {
                batch.set(docRefs[partId], docsMap[partId]); 
                hasUpdates = true;
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
