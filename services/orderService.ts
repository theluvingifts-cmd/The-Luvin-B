
// services/orderService.ts
import { db } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import type { Order } from '../types';
import { uploadToCloudinary } from './uploadService';

// 1. Hàm tạo đơn hàng mới (Có transaction trừ kho)
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

        // Dùng transaction để đảm bảo trừ kho an toàn
        await runTransaction(db, async (transaction) => {
            // B1: Tính toán số lượng cần trừ cho từng partId
            const stockUpdates = new Map<string, number>();

            for (const item of order.items) {
                // Duyệt qua nhân vật
                for (const char of item.characters) {
                    ['hair', 'face', 'shirt', 'pants', 'hat'].forEach(type => {
                        const part = (char as any)[type];
                        if (part && part.id) {
                            stockUpdates.set(part.id, (stockUpdates.get(part.id) || 0) + 1);
                        }
                    });
                }
                // Duyệt qua đồ trang trí (trừ charm vì là ảnh upload)
                for (const drag of item.draggableItems) {
                    if (drag.type !== 'charm') {
                        stockUpdates.set(drag.partId, (stockUpdates.get(drag.partId) || 0) + 1);
                    }
                }
            }

            // B2: Đọc dữ liệu tồn kho hiện tại
            for (const [partId, qty] of stockUpdates.entries()) {
                const partRef = doc(db, "lego_parts", partId);
                const partDoc = await transaction.get(partRef);
                
                if (!partDoc.exists()) {
                    // Nếu part không tồn tại trong DB (có thể là dữ liệu cũ), bỏ qua hoặc throw error
                    continue; 
                }

                const currentStock = partDoc.data().stock;
                // Nếu stock là undefined hoặc null -> coi như vô hạn -> không cần check
                if (currentStock !== undefined && currentStock !== null) {
                    if (currentStock < qty) {
                        throw new Error(`Sản phẩm "${partDoc.data().name}" hiện không đủ số lượng (Còn: ${currentStock}).`);
                    }
                    // B3: Ghi nhận update stock vào transaction
                    transaction.update(partRef, { stock: currentStock - qty });
                }
            }

            // B4: Tạo đơn hàng
            const orderRef = doc(db, "orders", finalOrder.id);
            transaction.set(orderRef, finalOrder);
        });

        return { success: true, data: finalOrder };
    } catch (error: any) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error: error };
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
