
// services/orderService.ts
import { db } from '../config/firebase';
// Standard modular imports from firebase/firestore
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc, where, getCountFromServer } from 'firebase/firestore';
import type { Order, FrameConfig } from '../types';
import { uploadFile } from './uploadService';
import { adjustStock } from './productService';
import { incrementTemplatePurchaseCount } from './templateService';
import { getStoreConfig } from './configService';
import { pushOrderToPancake, PancakeOrderData } from './pancakeService';
import { cleanForFirestore } from '../utils/helpers';

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

// HELPER: Process images in order items
const processOrderItemsImages = async (items: FrameConfig[]): Promise<FrameConfig[]> => {
    return Promise.all(items.map(async (item) => {
        let newItem = { ...item };
        
        // 1. Preview Image
        if (newItem.previewImageUrl && newItem.previewImageUrl.startsWith('data:')) {
            try {
                const cloudUrl = await uploadFile(newItem.previewImageUrl);
                if (cloudUrl) newItem.previewImageUrl = cloudUrl;
            } catch (e: any) {
                console.error("Error uploading preview image:", e);
                throw new Error(`Lỗi tải ảnh xem trước: ${e.message}`);
            }
        }
        
        // 2. Custom Background
        if (newItem.background && newItem.background.type === 'upload' && newItem.background.value.startsWith('data:')) {
             try {
                const bgCloudUrl = await uploadFile(newItem.background.value);
                if (bgCloudUrl) newItem.background = { ...newItem.background, value: bgCloudUrl };
             } catch (e: any) {
                console.error("Error uploading background image:", e);
                throw new Error(`Lỗi tải ảnh nền: ${e.message}`);
             }
        }
        
        // 3. Draggable Items (Charms)
        if (newItem.draggableItems && newItem.draggableItems.length > 0) {
            const processedDraggables = await Promise.all(newItem.draggableItems.map(async (di) => {
                if (di.type === 'charm' && di.partId && di.partId.startsWith('data:')) {
                    try {
                        const charmUrl = await uploadFile(di.partId);
                        if (charmUrl) return { ...di, partId: charmUrl };
                    } catch (e: any) {
                        console.error("Error uploading charm image:", e);
                        throw new Error(`Lỗi tải ảnh charm: ${e.message}`);
                    }
                }
                return di;
            }));
            newItem.draggableItems = processedDraggables;
        }
        
        return newItem; 
    }));
};

// 1. Hàm tạo đơn hàng mới
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        const itemsWithImages = await processOrderItemsImages(order.items);
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
        const sanitizedOrder = cleanForFirestore(finalOrder);
        await setDoc(doc(db, "orders", order.id), sanitizedOrder);
        
        // CẬP NHẬT LƯỢT MUA CHO TEMPLATE
        for (const item of finalOrder.items) {
            if (item.templateId) {
                await incrementTemplatePurchaseCount(item.templateId);
            }
        }

        const partsUsage = countPartsInOrder(finalOrder.items);
        const stockAdjustments: Record<string, number> = {};
        for (const [partId, qty] of Object.entries(partsUsage)) {
            stockAdjustments[partId] = -qty;
        }
        adjustStock(stockAdjustments);

        // ĐẨY ĐƠN SANG PANCAKE POS NẾU ĐƯỢC CẤU HÌNH
        try {
            const config = await getStoreConfig();
            if (config && config.enablePancakePush) {
                const pancakeData: PancakeOrderData = {
                    customer_name: finalOrder.customer.name,
                    customer_phone: finalOrder.customer.phone,
                    customer_address: `${finalOrder.customer.address}, ${finalOrder.customer.ward}, ${finalOrder.customer.district}, ${finalOrder.customer.province}`,
                    customer_province: finalOrder.customer.province,
                    customer_district: finalOrder.customer.district,
                    customer_ward: finalOrder.customer.ward,
                    note: `Đơn hàng từ Website: ${finalOrder.id}. ${finalOrder.customer.note || ''}`,
                    products: finalOrder.items.map(item => ({
                        name: `Khung LEGO: ${item.characters.length} nhân vật`,
                        quantity: item.quantity || 1,
                        price: item.price || 0,
                        sku: item.templateId || 'LEGO_FRAME',
                        variation_info: `Nhân vật: ${item.characters.length}, Phụ kiện: ${item.draggableItems.length}`
                    })),
                    total_price: finalOrder.totalPrice,
                    discount_amount: finalOrder.discountAmount || 0,
                    shipping_fee: finalOrder.shipping.fee || 0
                };
                await pushOrderToPancake(config, pancakeData);
            }
        } catch (pancakeError) {
            console.error("Lỗi khi đẩy đơn sang Pancake:", pancakeError);
            // Không chặn quy trình tạo đơn nếu Pancake lỗi
        }

        return { success: true, data: finalOrder };
    } catch (error: any) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error: { message: error.message || "Đã có lỗi xảy ra.", original: error } };
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
        const q = query(collection(db, "orders"), where("customer.phone", "==", phone));
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => { orders.push(doc.data() as Order); });
        return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
        console.error("Lỗi tra cứu theo SĐT:", error);
        return [];
    }
};

// 2c. Hàm tra cứu đơn hàng bằng mã giới thiệu
export const getOrdersByReferralCode = async (referralCode: string): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), where("referredBy", "==", referralCode));
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => { orders.push(doc.data() as Order); });
        return orders;
    } catch (error) {
        console.error("Lỗi tra cứu theo mã giới thiệu:", error);
        return [];
    }
};

// 3. Hàm lấy toàn bộ danh sách đơn hàng
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => { orders.push(doc.data() as Order); });
        return orders;
    } catch (error: any) {
        console.error("Lỗi lấy danh sách đơn hàng:", error);
        return [];
    }
};

// 3b. Hàm lấy danh sách đơn hàng gần đây (giới hạn số lượng)
export const getRecentOrders = async (limitCount: number = 50): Promise<Order[]> => {
    try {
        const { limit } = await import('firebase/firestore');
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => { orders.push(doc.data() as Order); });
        return orders;
    } catch (error: any) {
        console.error("Lỗi lấy danh sách đơn hàng gần đây:", error);
        return [];
    }
};

// 4. Lấy tổng số lượng đơn hàng thực tế
export const getTotalOrderCount = async (): Promise<number> => {
    try {
        const coll = collection(db, "orders");
        const snapshot = await getCountFromServer(coll);
        return snapshot.data().count;
    } catch (error) {
        console.error("Lỗi lấy tổng số đơn hàng:", error);
        return 0;
    }
};

// 5. Update Order
export const updateOrder = async (orderId: string, updates: Partial<Order>): Promise<boolean> => {
    try {
        if (updates.items && Array.isArray(updates.items)) {
            updates.items = await processOrderItemsImages(updates.items);
        }
        const orderRef = doc(db, "orders", orderId);
        const cleanUpdates = cleanForFirestore(updates);
        await updateDoc(orderRef, cleanUpdates);
        return true;
    } catch (error) {
        console.error("Error updating order:", error);
        return false;
    }
};

// 6. Delete Order
export const deleteOrder = async (orderId: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, "orders", orderId));
        return true;
    } catch (error) {
        console.error("Error deleting order:", error);
        return false;
    }
};
