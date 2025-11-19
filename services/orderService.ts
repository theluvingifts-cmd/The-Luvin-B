// services/orderService.ts
import { db, storage } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Order } from '../types';

// Hàm phụ: Upload ảnh (Giữ nguyên để sau này dùng)
const uploadImageToStorage = async (dataUrl: string, orderId: string, timestamp: number) => {
    try {
        const storageRef = ref(storage, `orders/${orderId}/preview_${timestamp}.png`);
        await uploadString(storageRef, dataUrl, 'data_url');
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return null;
    }
};

// 1. Hàm tạo đơn hàng mới (ĐÃ TẮT UPLOAD ĐỂ TRÁNH LỖI TREO)
export const createOrder = async (order: Omit<Order, 'status'>) => {
    try {
        // Xử lý ảnh: Bỏ qua upload để tránh lỗi CORS
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                
                // --- QUAN TRỌNG: Không upload nữa ---
                // const cloudUrl = await uploadImageToStorage(item.previewImageUrl, order.id, Date.now());
                
                // --- Thay bằng: Trả về rỗng để đơn hàng đi qua luôn ---
                return { ...item, previewImageUrl: "" }; 
            }
            return item;
        }));

        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
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
        throw error; // Ném lại lỗi để component gọi có thể xử lý
    }
};

// 3. Hàm lấy toàn bộ danh sách đơn hàng (cho trang Admin)
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), orderBy("id", "desc")); 
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