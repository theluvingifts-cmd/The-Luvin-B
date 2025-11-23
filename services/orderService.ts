
// services/orderService.ts
import { db } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
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

// 1. Hàm tạo đơn hàng mới
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        // Xử lý ảnh: Upload ảnh preview lên Cloudinary nếu là chuỗi base64
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:')) {
                const cloudUrl = await uploadToCloudinary(item.previewImageUrl);
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

        // 1. Lưu đơn hàng vào Firestore
        await setDoc(doc(db, "orders", order.id), finalOrder);

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
