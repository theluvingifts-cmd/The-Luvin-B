
// services/orderService.ts
import { db } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc, where } from 'firebase/firestore';
import type { Order } from '../types';
import { uploadToCloudinary } from './uploadService';
import { adjustStock } from './productService';

// Helper: Đếm số lượng từng part trong đơn hàng
export const countPartsInOrder = (orderItems: Order['items']): Record<string, number> => {
    const counts: Record<string, number> = {};

    const increment = (id?: string) => {
        if (!id) return;
        counts[id] = (counts[id] || 0) + 1;
    };

    orderItems.forEach(item => {
        item.characters.forEach(char => {
            increment(char.hair?.id);
            increment(char.face?.id);
            increment(char.shirt?.id);
            increment(char.pants?.id);
            increment(char.hat?.id);
        });
        item.draggableItems.forEach(di => {
            if (di.type !== 'charm') {
                increment(di.partId);
            }
        });
    });

    return counts;
};

// HELPER: Deep clean data for Firestore (Removes undefined, empty array slots, ensuring strict plain objects)
const cleanForFirestore = (data: any): any => {
    if (Array.isArray(data)) {
        // Filter out undefined/null items in arrays
        return data
            .filter(item => item !== undefined && item !== null)
            .map(cleanForFirestore);
    }
    if (data !== null && typeof data === 'object') {
        const newObj: any = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const value = cleanForFirestore(data[key]);
                if (value !== undefined) {
                    newObj[key] = value;
                }
            }
        }
        return newObj;
    }
    return data;
};

// 1. Hàm tạo đơn hàng mới
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        // Xử lý ảnh: Upload ảnh preview lên Cloudinary nếu là chuỗi base64
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:')) {
                const cloudUrl = await uploadToCloudinary(item.previewImageUrl);
                if (!cloudUrl) throw new Error("Lỗi upload ảnh thiết kế. Vui lòng kiểm tra kết nối mạng.");
                return { ...item, previewImageUrl: cloudUrl || item.previewImageUrl };
            }
            return item; 
        }));

        const timestamp = Date.now();
        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            createdAt: timestamp,
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: ""
        };

        // SANITIZE: Use deep clean instead of just JSON.parse(JSON.stringify)
        const sanitizedOrder = cleanForFirestore(finalOrder);

        // 1. Lưu đơn hàng vào Firestore
        await setDoc(doc(db, "orders", order.id), sanitizedOrder);

        // 2. Trừ tồn kho
        const partsUsage = countPartsInOrder(finalOrder.items);
        // Chuyển số lượng thành số âm để trừ
        const stockAdjustments: Record<string, number> = {};
        for (const [partId, qty] of Object.entries(partsUsage)) {
            stockAdjustments[partId] = -qty;
        }
        
        // Gọi hàm cập nhật kho (không await để không chặn UI, chạy ngầm)
        adjustStock(stockAdjustments);

        return { success: true, data: finalOrder };
    } catch (error: any) {
        console.error("Lỗi tạo đơn hàng:", error);
        
        // Return structured error
        let errorMessage = "Đã có lỗi xảy ra.";
        if (error.code === 'permission-denied') errorMessage = "Lỗi quyền truy cập hệ thống. Vui lòng liên hệ Admin.";
        else if (error.code === 'unavailable') errorMessage = "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.";
        else if (error.message) errorMessage = error.message;

        return { success: false, error: { message: errorMessage, original: error } };
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

// 2b. Hàm tra cứu đơn hàng bằng SĐT
export const getOrdersByPhone = async (phone: string): Promise<Order[]> => {
    try {
        // FIX: Removed orderBy("createdAt", "desc") from Firestore query to avoid "Requires Index" error.
        // We sort the results on the client side instead.
        const q = query(collection(db, "orders"), where("customer.phone", "==", phone));
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });
        // Sort desc by time (Client-side sort)
        return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
        console.error("Lỗi tra cứu theo SĐT:", error);
        return [];
    }
};

// 3. Hàm lấy toàn bộ danh sách đơn hàng (cho trang Admin)
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });
        return orders;
    } catch (error: any) {
        console.error("Lỗi lấy danh sách đơn hàng:", error);
        return [];
    }
};

// 4. Update Order
export const updateOrder = async (orderId: string, updates: Partial<Order>): Promise<boolean> => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, updates);
        return true;
    } catch (error) {
        console.error("Error updating order:", error);
        return false;
    }
};

// 5. Delete Order
export const deleteOrder = async (orderId: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, "orders", orderId));
        return true;
    } catch (error) {
        console.error("Error deleting order:", error);
        return false;
    }
};
