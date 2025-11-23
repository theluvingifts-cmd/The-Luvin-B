
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
// usageMap: { partId: quantityChange }
// quantityChange < 0: Trừ kho (Khách mua)
// quantityChange > 0: Cộng kho (Hoàn tác, hủy đơn)
export const adjustStock = async (usageMap: Record<string, number>) => {
    try {
        const batch = writeBatch(db);
        let hasUpdates = false;

        for (const [partId, change] of Object.entries(usageMap)) {
            if (change === 0) continue;

            const partRef = doc(db, COLLECTION_NAME, partId);
            // Chúng ta cần kiểm tra xem sản phẩm có quản lý tồn kho không (stock != undefined)
            // Tuy nhiên, Firestore `increment` hoạt động tốt, nếu field không tồn tại nó sẽ tạo mới.
            // Để an toàn, ta nên chỉ update nếu sản phẩm tồn tại và có field stock.
            // Nhưng để tối ưu hiệu năng batch, ta sẽ giả định admin đã setup đúng.
            // Lưu ý: increment hoạt động atomic.
            
            // Để tránh cập nhật các sản phẩm "Vô hạn" (stock = undefined hoặc null),
            // Ta cần đọc trước hoặc chấp nhận rủi ro.
            // Cách tốt nhất ở đây: Đọc document, kiểm tra, sau đó add vào batch.
            // Nhưng đọc nhiều doc sẽ tốn quota read.
            // Giải pháp: updateDoc chỉ update nếu doc tồn tại.
            
            // Tạm thời: Logic client (AdminPage/OrderService) đã lọc các part cần update.
            // Ở đây chỉ thực hiện lệnh.
            
            // CHÚ Ý QUAN TRỌNG: Nếu stock đang là undefined (vô hạn), increment sẽ biến nó thành NaN hoặc số.
            // Cần kiểm tra trước khi update. Do batch không cho đọc, ta sẽ đọc từng doc trước (chấp nhận tốn read 1 chút để an toàn).
            
            const partDoc = await getDoc(partRef);
            if (partDoc.exists()) {
                const data = partDoc.data();
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
