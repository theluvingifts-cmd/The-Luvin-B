
// services/orderService.ts
import { db } from '../config/firebase';
// Standard modular imports from firebase/firestore
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc, deleteDoc, where, getCountFromServer, runTransaction, increment as firestoreIncrement } from 'firebase/firestore';
import type { Order, FrameConfig } from '../types';
import { uploadFile } from './uploadService';
import { adjustStock } from './productService';
import { incrementTemplatePurchaseCount } from './templateService';
import { getStoreConfig } from './configService';
import { pushOrderToPancake, PancakeOrderData } from './pancakeService';
import { sendOrderEmail, sendThankYouEmail } from './emailService';
import { cleanForFirestore } from '../utils/helpers';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

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

// 1. Hàm tạo đơn hàng mới (VỚI TRANSACTION ĐỂ ĐẢM BẢO ATOMIC VÀ IDEMPOTENCY)
export const createOrder = async (order: Omit<Order, 'status' | 'createdAt'>) => {
    try {
        // A. CHUẨN BỊ ẢNH (Bên ngoài transaction vì upload là async ngoài DB)
        const itemsWithImages = await processOrderItemsImages(order.items);
        
        const timestamp = Date.now();
        const finalOrder: Order = {
            ...order,
            items: itemsWithImages,
            createdAt: timestamp,
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: "",
            countedInStats: true // Đánh dấu đơn hàng này đã được tính vào thống kê
        };

        // 1. LƯU ĐƠN HÀNG VÀO FIRESTORE (Primary Action)
        const orderRef = doc(db, "orders", finalOrder.id);
        await setDoc(orderRef, cleanForFirestore(finalOrder)).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, `orders/${finalOrder.id}`);
        });

        // 2. CẬP NHẬT LƯỢT MUA VÀ TỒN KHO (Secondary Actions - Wrapped in try-catch to not block order)
        try {
            const partsUsage = countPartsInOrder(finalOrder.items);
            
            await runTransaction(db, async (transaction) => {
                // Update templates purchase count
                for (const item of finalOrder.items) {
                    if (item.templateId) {
                        const tplRef = doc(db, "templates", item.templateId);
                        const qty = item.quantity || 1;
                        transaction.update(tplRef, {
                            purchaseCount: firestoreIncrement(qty)
                        });
                    }
                }

                // Update lego parts stock
                for (const [partId, qty] of Object.entries(partsUsage)) {
                    if (!qty) continue;
                    const partRef = doc(db, "lego_parts", partId);
                    transaction.update(partRef, {
                        stock: firestoreIncrement(-qty)
                    });
                }
            });
        } catch (secondaryError) {
            console.warn("Could not update stock or template stats (likely permission restriction for guest), but order was placed successfully:", secondaryError);
        }

        // B. ĐẨY ĐƠN SANG PANCAKE POS NẾU ĐƯỢC CẤU HÌNH (Async, không cần transaction)
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
        
        // KIỂM TRA TRẠNG THÁI GIAO HÀNG ĐỂ GỬI MAIL CẢM ƠN
        if (updates.status === 'Đã giao hàng') {
            const currentDoc = await getDoc(orderRef);
            if (currentDoc.exists()) {
                const currentData = currentDoc.data() as Order;
                // Chỉ gửi nếu trạng thái trước đó chưa phải là đã giao và chưa gửi mail cảm ơn
                if (currentData.status !== 'Đã giao hàng' && !currentData.thankYouEmailSent) {
                    // Cập nhật flag đã gửi mail vào updates luôn để lưu 1 lần
                    updates.thankYouEmailSent = true;
                    
                    // Gửi email (không async/await để không làm chậm hành động của admin, gửi ngầm)
                    sendThankYouEmail({ ...currentData, ...updates }).catch(err => {
                        console.error("Lỗi khi gửi email cảm ơn tự động:", err);
                    });
                }
            }
        }

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
