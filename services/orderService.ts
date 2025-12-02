
import { db } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc, where, increment } from 'firebase/firestore';
import type { Order } from '../types';
import { uploadToCloudinary } from './uploadService';
import { adjustStock } from './productService';

// Helper: Đếm số lượng từng part trong đơn hàng
export const countPartsInOrder = (orderItems: Order['items']): Record<string, number> => {
    const counts: Record<string, number> = {};
    const incrementCount = (id?: string) => { if (id) counts[id] = (counts[id] || 0) + 1; };

    orderItems.forEach(item => {
        item.characters.forEach(char => {
            incrementCount(char.hair?.id);
            incrementCount(char.face?.id);
            incrementCount(char.shirt?.id);
            incrementCount(char.pants?.id);
            incrementCount(char.hat?.id);
        });
        item.draggableItems.forEach(di => {
            if (di.type !== 'charm') incrementCount(di.partId);
        });
    });
    return counts;
};

// 1. Hàm tạo đơn hàng mới
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        // Handle images ...
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:')) {
                const cloudUrl = await uploadToCloudinary(item.previewImageUrl);
                if (!cloudUrl) throw new Error("Lỗi upload ảnh thiết kế.");
                return { ...item, previewImageUrl: cloudUrl };
            }
            return item; 
        }));

        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            createdAt: Date.now(),
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: ""
        };

        const sanitizedOrder = JSON.parse(JSON.stringify(finalOrder));
        await setDoc(doc(db, "orders", order.id), sanitizedOrder);

        // Deduct Part Stocks
        const partsUsage = countPartsInOrder(finalOrder.items);
        const stockAdjustments: Record<string, number> = {};
        for (const [partId, qty] of Object.entries(partsUsage)) { stockAdjustments[partId] = -qty; }
        adjustStock(stockAdjustments);

        // NEW: Deduct Gift Box Stock if used
        if (finalOrder.addGiftBox) {
            const configRef = doc(db, 'config', 'general');
            // Using dot notation to update nested field
            await updateDoc(configRef, { "giftBox.stock": increment(-1) });
        }

        return { success: true, data: finalOrder };
    } catch (error: any) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error: { message: error.message || "Lỗi không xác định", original: error } };
    }
};

// ... (Rest of functions: getOrderById, getAllOrders, etc. remain unchanged) ...
export const getOrderById = async (orderId: string): Promise<Order | null> => {
    const docSnap = await getDoc(doc(db, "orders", orderId));
    return docSnap.exists() ? (docSnap.data() as Order) : null;
};
export const getOrdersByPhone = async (phone: string): Promise<Order[]> => {
    const q = query(collection(db, "orders"), where("customer.phone", "==", phone));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Order).sort((a, b) => b.createdAt - a.createdAt);
};
export const getAllOrders = async (): Promise<Order[]> => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc")); 
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Order);
};
export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
        await updateDoc(doc(db, "orders", orderId), JSON.parse(JSON.stringify(updates)));
        return true;
    } catch (error) { return false; }
};
export const deleteOrder = async (orderId: string) => {
    try { await deleteDoc(doc(db, "orders", orderId)); return true; } catch (error) { return false; }
};
