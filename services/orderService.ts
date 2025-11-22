
// services/orderService.ts
import { db } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Order } from '../types';
import { uploadToCloudinary } from './uploadService';

// 1. Hàm tạo đơn hàng mới
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        // Xử lý ảnh: Upload ảnh preview lên Cloudinary nếu là chuỗi base64
        // Điều này giúp giảm kích thước document Firestore tránh lỗi QuotaExceeded
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:')) {
                const cloudUrl = await uploadToCloudinary(item.previewImageUrl);
                // Nếu upload thành công thì dùng link mới, nếu lỗi thì giữ nguyên base64 (fallback)
                return { ...item, previewImageUrl: cloudUrl || item.previewImageUrl };
            }
            return item; 
        }));

        const timestamp = Date.now();
        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            createdAt: timestamp, // Thêm timestamp thực
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
