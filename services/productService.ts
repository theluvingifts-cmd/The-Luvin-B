// services/productService.ts
import { db, storage } from '../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
    } catch (error) {
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

// 5. Hàm upload ảnh sản phẩm lên Firebase Storage
export const uploadProductImage = async (file: File): Promise<string | null> => {
    try {
        // Tạo đường dẫn: products/timestamp_tenfile
        const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
        
        // Upload file
        await uploadBytes(storageRef, file);
        
        // Lấy URL tải về
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error("Lỗi upload ảnh sản phẩm:", error);
        return null;
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