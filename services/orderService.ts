// services/orderService.ts
import { db, storage } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Order } from '../types';

// Hàm phụ: Upload ảnh Base64 (Preview) lên Storage
const uploadBase64Image = async (dataUrl: string, orderId: string, index: number) => {
    try {
        // Tạo reference: orders/ORDER_ID/item_INDEX.png
        const storageRef = ref(storage, `orders/${orderId}/item_${index}.png`);
        
        // Upload chuỗi base64
        await uploadString(storageRef, dataUrl, 'data_url');
        
        // Lấy URL
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh preview:", error);
        return null;
    }
};

// Hàm phụ: Upload file ảnh thật (Admin dùng)
export const uploadOrderImageFile = async (file: File, orderId: string, index: number) => {
    try {
        const storageRef = ref(storage, `orders/${orderId}/final_item_${index}_${Date.now()}.png`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh final:", error);
        return null;
    }
};

// 1. Hàm tạo đơn hàng mới
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        const timestamp = Date.now();
        
        // Xử lý upload ảnh preview cho từng item trong đơn hàng
        const itemsWithUploadedImages = await Promise.all(order.items.map(async (item, index) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                // Nếu là base64, upload lên Storage
                const uploadedUrl = await uploadBase64Image(item.previewImageUrl, order.id, index);
                return { 
                    ...item, 
                    previewImageUrl: uploadedUrl || item.previewImageUrl // Fallback về base64 nếu lỗi (dù rủi ro)
                };
            }
            return item;
        }));

        const finalOrder: Order = {
            ...order,
            items: itemsWithUploadedImages,
            createdAt: timestamp,
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: ""
        };

        // Lưu đơn hàng vào Firestore
        await setDoc(doc(db, "orders", order.id), finalOrder);

        return { success: true, data: finalOrder };
    } catch (error) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error };
    }
};

// 2. Hàm tra cứu đơn hàng
export const getOrderById = async (orderId: string): Promise<Order | null> => {
    try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as Order) : null;
    } catch (error: any) {
        console.error("Lỗi lấy đơn hàng:", error);
        throw error; 
    }
};

// 3. Hàm lấy toàn bộ danh sách đơn hàng (cho trang Admin)
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        // Sắp xếp theo createdAt mới nhất
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });
        return orders;
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn:", error);
        return [];
    }
};

// 4. Hàm cập nhật thông tin đơn hàng
export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, updates);
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật đơn hàng:", error);
        return false;
    }
};

// 5. Hàm xóa đơn hàng (Dành cho Admin dọn đơn rác)
export const deleteOrder = async (orderId: string) => {
    try {
        await deleteDoc(doc(db, "orders", orderId));
        return true;
    } catch (error) {
        console.error("Lỗi xóa đơn hàng:", error);
        return false;
    }
};