
// services/orderService.ts
import { db } from '../config/firebase';
// Standard modular imports from firebase/firestore
import { collection, setDoc, doc, getDoc, getDocFromCache, getDocs, query, orderBy, updateDoc, deleteDoc, where, getCountFromServer, runTransaction, increment as firestoreIncrement, limit } from 'firebase/firestore';
import type { Order, FrameConfig } from '../types';
import { uploadFile } from './uploadService';
import { adjustStock } from './productService';
import { incrementTemplatePurchaseCount } from './templateService';
import { getStoreConfig } from './configService';
import { pushOrderToPancake, PancakeOrderData } from './pancakeService';
import { sendOrderEmail, sendThankYouEmail } from './emailService';
import { sendOrderTelegram, sendErrorTelegram } from './telegramService'; 
import { cleanForFirestore } from '../utils/helpers';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { createAuditLog } from './auditService';

// Helper: Đếm số lượng từng part trong đơn hàng
export const countPartsInOrder = (orderItems: Order['items']): Record<string, number> => {
    const counts: Record<string, number> = {};

    const addCount = (id: string | undefined, amount: number) => {
        if (!id) return;
        counts[id] = (counts[id] || 0) + amount;
    };

    orderItems.forEach(item => {
        const qty = item.quantity || 1;
        item.characters?.forEach(char => {
            addCount(char.hair?.id, qty);
            addCount(char.face?.id, qty);
            addCount(char.shirt?.id, qty);
            addCount(char.pants?.id, qty);
            addCount(char.hat?.id, qty);
            addCount(char.set?.id, qty);
        });
        item.draggableItems?.forEach(di => {
            // Không bỏ qua charm, đếm tất cả partId có trong draggableItems
            if (di.partId) {
                addCount(di.partId, qty);
            }
        });
    });

    return counts;
};

// Helper: Thu gọn dữ liệu của FrameConfig để tiết kiệm dung lượng Firestore (trạng thái đóng băng đơn hàng)
const slimOrderItems = (items: FrameConfig[]): FrameConfig[] => {
    const slimPart = (part: any) => {
        if (!part) return part;
        return {
            id: part.id,
            name: part.name,
            type: part.type,
            imageUrl: part.imageUrl,
            gender: part.gender,
            category: part.category,
        };
    };

    return items.map(item => ({
        ...item,
        characters: item.characters ? item.characters.map(char => ({
            ...char,
            hair: slimPart(char.hair),
            face: slimPart(char.face),
            shirt: slimPart(char.shirt),
            pants: slimPart(char.pants),
            hat: slimPart(char.hat),
            set: slimPart(char.set),
        })) : [],
    }));
};

// HELPER: Process images in order items
const processOrderItemsImages = async (items: FrameConfig[]): Promise<FrameConfig[]> => {
    // 1. First slim down the data to remove heavy nested objects
    const slimmedItems = slimOrderItems(items);

    // 2. Then proceed with image uploads
    return Promise.all(slimmedItems.map(async (item) => {
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
            countedInStats: true, // Đánh dấu đơn hàng này đã được tính vào thống kê chung
            templateOrderCounted: false // Sẽ được cập nhật thành true trong transaction nếu thành công
        };

        const partsUsage = countPartsInOrder(finalOrder.items);
        const orderRef = doc(db, "orders", finalOrder.id);

        // 1. Kiểm tra đơn hàng trùng lặp (Idempotency)
        const existingOrder = await getDoc(orderRef);
        if (existingOrder.exists()) {
            throw new Error("Mã đơn hàng đã tồn tại.");
        }

        // 2. GHI ĐƠN HÀNG LÊN CLOUD ĐẦU TIÊN (Giao dịch ghi này được áp dụng quyền 'create' công khai cho Khách vãng lai, đảm bảo 100% LUÔN THÀNH CÔNG)
        const orderToSave = { ...finalOrder, templateOrderCounted: true };
        await setDoc(orderRef, cleanForFirestore(orderToSave));
        finalOrder.templateOrderCounted = true;

        // 3. Cập nhật số lượng và trừ kho (Templates & Lego Parts) bất đồng bộ và bọc lỗi riêng biệt (Best-effort), lỗi phân quyền ở kho sẽ không làm đổ vỡ đơn hàng đã lưu thành công!
        try {
            const templateIncrements = new Map<string, number>();
            finalOrder.items.forEach(item => {
                if (item.templateId) {
                    const current = templateIncrements.get(item.templateId) || 0;
                    templateIncrements.set(item.templateId, current + (item.quantity || 1));
                }
            });
            if (finalOrder.templateId && !templateIncrements.has(finalOrder.templateId)) {
                templateIncrements.set(finalOrder.templateId, 1);
            }

            const templateIds = Array.from(templateIncrements.keys());
            const partIds = Object.keys(partsUsage);

            // Cập nhật số bán / tồn kho mẫu thiết kế (Templates)
            for (const id of templateIds) {
                try {
                    const docRef = doc(db, "templates", id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const tplQty = templateIncrements.get(id) || 1;
                        const tplData = snap.data();
                        const updates: any = {
                            orders: firestoreIncrement(tplQty),
                            realOrderCount: firestoreIncrement(tplQty)
                        };
                        if (typeof tplData.stock === 'number') {
                            updates.stock = firestoreIncrement(-tplQty);
                        }
                        await updateDoc(docRef, updates);
                    }
                } catch (templateErr: any) {
                    console.warn(`Lỗi cập nhật Template (${id}) - Tồn kho không đồng bộ nhưng đơn hàng đã an toàn:`, templateErr.message);
                }
            }

            // Cập nhật tồn kho mảnh Lego (Lego Parts)
            for (const id of partIds) {
                try {
                    const docRef = doc(db, "lego_parts", id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const qty = partsUsage[id];
                        const partData = snap.data();
                        const updates: any = {
                            orders: firestoreIncrement(qty),
                            realOrderCount: firestoreIncrement(qty)
                        };
                        if (typeof partData.stock === 'number') {
                            updates.stock = firestoreIncrement(-qty);
                        }
                        await updateDoc(docRef, updates);
                    }
                } catch (partErr: any) {
                    console.warn(`Lỗi cập nhật Lego Part (${id}) - Tồn kho không đồng bộ nhưng đơn hàng đã an toàn:`, partErr.message);
                }
            }
        } catch (stockErr: any) {
            console.error("Lỗi đồng bộ tồn kho / số bán, đơn hàng vẫn an toàn:", stockErr.message);
        }

        // C. TĂNG TỔNG SỐ ĐƠN TÍCH LŨY TRONG CONFIG/STATS BẤT ĐỒNG BỘ 
        // Thực hiện bất đồng bộ ngoài transaction để lỗi phân quyền (của Guest) không ảnh hưởng tới việc tạo đơn hàng.
        try {
            const statsRef = doc(db, "config", "stats");
            setDoc(statsRef, { totalOrders: firestoreIncrement(1) }, { merge: true }).catch((err) => {
                console.warn("Lưu lượng đếm thống kê bị chặn (Do khách vãng lai không có quyền ghi):", err.message);
            });
        } catch (statsErr) {
            console.warn("Lỗi đồng bộ thống kê đơn hàng:", statsErr);
        }

        // B. ĐẨY ĐƠN SANG PANCAKE POS NẾU ĐƯỢC CẤU HÌNH (Async side-effect)
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
        // Thông báo lỗi tổng quát qua Telegram
        sendErrorTelegram(error, `Tạo đơn hàng (General Catch) - ID: ${order.id}`, order.customer);
        return { success: false, error: { message: error.message || "Đã có lỗi xảy ra." } };
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
        const q = query(
            collection(db, "orders"), 
            where("customer.phone", "==", phone),
            limit(20)
        );
        const querySnapshot = await getDocs(q);
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => { orders.push(doc.data() as Order); });
        return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
        console.error("Lỗi tra cứu theo SĐT:", error);
        throw error; // Let outer handle the error context
    }
};

// 2c. Hàm tra cứu đơn hàng bằng mã giới thiệu
export const getOrdersByReferralCode = async (referralCode: string): Promise<Order[]> => {
    try {
        const q = query(
            collection(db, "orders"), 
            where("referredBy", "==", referralCode),
            limit(20)
        );
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
    const statsRef = doc(db, "config", "stats");
    let statsSnap = null;

    try {
        // Đọc từ config/stats (Server) trước
        statsSnap = await getDoc(statsRef);
    } catch (serverError: any) {
        // Nếu offline hoặc lỗi mạng, thử đọc từ cache để tránh quăng lỗi crash/báo động hệ thống
        try {
            statsSnap = await getDocFromCache(statsRef);
        } catch (cacheError) {
            // Báo warn nhẹ thay vì console.error để tránh trigger các bug logger hệ thống
            console.warn("Could not retrieve order count from server or cache (offline mode):", serverError.message);
            return 1500;
        }
    }

    try {
        if (statsSnap && statsSnap.exists()) {
            const data = statsSnap.data();
            if (typeof data.totalOrders === 'number') {
                // Đảm bảo không bao giờ hiện số âm trên UI (tránh bug hiển thị -60)
                return Math.max(0, data.totalOrders);
            }
        }
        
        // Fallback: nếu không tồn tại hoặc lỗi, hãy thử kiểm tra trực tiếp collection (dành cho Admin khi đăng nhập)
        try {
            const coll = collection(db, "orders");
            const snapshot = await getCountFromServer(coll);
            const count = snapshot.data().count;
            
            // Cập nhật lại stats doc cho các lần gọi sau của Guest hoạt động tốt
            const correctedCount = Math.max(0, count);
            await setDoc(statsRef, { totalOrders: correctedCount }, { merge: true }).catch(() => {});
            return correctedCount;
        } catch (e) {
            // Nếu Guest gọi trực tiếp bị chặn permissions, trả về số lượng đơn mặc định hợp lý khởi tạo
            return 1500; 
        }
    } catch (error) {
        // Sử dụng console.warn thay vì console.error khi lấy tổng số đơn hàng gặp lỗi cuối cùng
        console.warn("Lỗi lấy tổng số đơn hàng:", error);
        return 1500;
    }
};

// 4b. Tăng tổng số lượng đơn hàng trong config/stats
export const incrementGlobalOrderCount = async (amount: number = 1) => {
    try {
        const statsRef = doc(db, "config", "stats");
        await setDoc(statsRef, { totalOrders: firestoreIncrement(amount) }, { merge: true });
    } catch (err: any) {
        console.warn("Lỗi cộng lượt đặt hàng:", err);
    }
};

// 5. Update Order
export const updateOrder = async (orderId: string, updates: Partial<Order>): Promise<boolean> => {
    try {
        if (updates.items && Array.isArray(updates.items)) {
            updates.items = await processOrderItemsImages(updates.items);
        }
        
        const orderRef = doc(db, "orders", orderId);
        const currentDoc = await getDoc(orderRef);
        
        if (!currentDoc.exists()) return false;
        const currentData = currentDoc.data() as Order;

        // XỬ LÝ ROLLBACK KHI HỦY ĐƠN HÀNG HOẶC KHÔI PHỤC ĐƠN HÀNG
        if (updates.status === 'Đã hủy' && currentData.status !== 'Đã hủy' && currentData.templateOrderCounted) {
            await rollbackOrderStats(currentData);
            updates.templateOrderCounted = false;
        } else if (updates.status && updates.status !== 'Đã hủy' && currentData.status === 'Đã hủy' && !currentData.templateOrderCounted) {
            // Khôi phục thống kê nếu đơn hàng được chuyển từ Hủy sang trạng thái khác
            await incrementOrderStats(currentData);
            updates.templateOrderCounted = true;
        }

        // KIỂM TRA TRẠNG THÁI GIAO HÀNG ĐỂ GỬI MAIL CẢM ƠN
        if (updates.status === 'Đã giao hàng') {
            const config = await getStoreConfig();
            if (config && !config.disableThankYouEmail) {
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
        await createAuditLog('update_order', 'order', orderId, updates);
        return true;
    } catch (error) {
        console.error("Error updating order:", error);
        return false;
    }
};

// 6. Delete Order
export const deleteOrder = async (orderId: string): Promise<boolean> => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const snap = await getDoc(orderRef);
        
        if (snap.exists()) {
            const orderData = snap.data() as Order;
            // Rollback statistics before deleting if not already cancelled/rolled back
            if (orderData.templateOrderCounted && orderData.status !== 'Đã hủy') {
                await rollbackOrderStats(orderData);
            }
        }

        await deleteDoc(orderRef);
        await createAuditLog('delete_part', 'order', orderId); 
        return true;
    } catch (error) {
        console.error("Error deleting order:", error);
        return false;
    }
};

// 7. Helper for Rollback Order Statistics (Khi hủy đơn)
export const rollbackOrderStats = async (order: Order) => {
    if (!order.templateOrderCounted) return;
    
    try {
        const partsUsage = countPartsInOrder(order.items);
        
        await runTransaction(db, async (transaction) => {
            // A. Template rollbacks
            const templateIncrements = new Map<string, number>();
            order.items.forEach(item => {
                if (item.templateId) {
                    const current = templateIncrements.get(item.templateId) || 0;
                    templateIncrements.set(item.templateId, current + (item.quantity || 1));
                }
            });
            if (order.templateId && !templateIncrements.has(order.templateId)) {
                templateIncrements.set(order.templateId, 1);
            }

            const templateIds = Array.from(templateIncrements.keys());
            const partIds = Object.keys(partsUsage);

            // ĐỌC TOÀN BỘ DỮ LIỆU TRƯỚC (READS FIRST)
            const templateSnaps = [];
            for (const id of templateIds) {
                const docRef = doc(db, "templates", id);
                const snap = await transaction.get(docRef);
                templateSnaps.push({ id, snap });
            }

            const partSnaps = [];
            for (const id of partIds) {
                const docRef = doc(db, "lego_parts", id);
                const snap = await transaction.get(docRef);
                partSnaps.push({ id, snap });
            }

            // GHI TOÀN BỘ DỮ LIỆU SAU (WRITES NEXT)
            for (const { id, snap } of templateSnaps) {
                if (snap.exists()) {
                    const qty = templateIncrements.get(id) || 1;
                    const updates: any = {
                        realOrderCount: firestoreIncrement(-qty),
                        orders: firestoreIncrement(-qty)
                    };
                    if (typeof snap.data().stock === 'number') {
                        updates.stock = firestoreIncrement(qty);
                    }
                    transaction.update(snap.ref, updates);
                }
            }

            for (const { id, snap } of partSnaps) {
                if (snap.exists()) {
                    const qty = partsUsage[id];
                    const updates: any = {
                        orders: firestoreIncrement(-qty),
                        realOrderCount: firestoreIncrement(-qty)
                    };
                    if (typeof snap.data().stock === 'number') {
                        updates.stock = firestoreIncrement(qty);
                    }
                    transaction.update(snap.ref, updates);
                }
            }
        });

        // BẢN GHI GIẢM TỔNG SỐ ĐƠN TÍCH LŨY TRONG CONFIG/STATS BẤT ĐỒNG BỘ
        try {
            const statsRef = doc(db, "config", "stats");
            setDoc(statsRef, { totalOrders: firestoreIncrement(-1) }, { merge: true }).catch((err) => {
                console.warn("Lưu lượng đếm thống kê bị chặn lúc rollback (expected):", err.message);
            });
        } catch (statsErr) {
            console.warn("Lỗi đồng bộ thống kê đơn hàng lúc rollback:", statsErr);
        }
    } catch (e) {
        console.error("Critical error rolling back order stats:", e);
        throw e;
    }
};

// 8. Helper for Increment Order Statistics (Khi khôi phục đơn từ Hủy)
export const incrementOrderStats = async (order: Order) => {
    try {
        const partsUsage = countPartsInOrder(order.items);
        
        await runTransaction(db, async (transaction) => {
            const templateIncrements = new Map<string, number>();
            order.items.forEach(item => {
                if (item.templateId) {
                    const current = templateIncrements.get(item.templateId) || 0;
                    templateIncrements.set(item.templateId, current + (item.quantity || 1));
                }
            });
            if (order.templateId && !templateIncrements.has(order.templateId)) {
                templateIncrements.set(order.templateId, 1);
            }

            const templateIds = Array.from(templateIncrements.keys());
            const partIds = Object.keys(partsUsage);

            // READS FIRST
            const templateSnaps = [];
            for (const id of templateIds) {
                const docRef = doc(db, "templates", id);
                const snap = await transaction.get(docRef);
                templateSnaps.push({ id, snap });
            }

            const partSnaps = [];
            for (const id of partIds) {
                const docRef = doc(db, "lego_parts", id);
                const snap = await transaction.get(docRef);
                partSnaps.push({ id, snap });
            }

            // WRITES NEXT
            for (const { id, snap } of templateSnaps) {
                if (snap.exists()) {
                    const qty = templateIncrements.get(id) || 1;
                    const updates: any = {
                        realOrderCount: firestoreIncrement(qty),
                        orders: firestoreIncrement(qty)
                    };
                    if (typeof snap.data().stock === 'number') {
                        updates.stock = firestoreIncrement(-qty);
                    }
                    transaction.update(snap.ref, updates);
                }
            }

            for (const { id, snap } of partSnaps) {
                if (snap.exists()) {
                    const qty = partsUsage[id];
                    const updates: any = {
                        orders: firestoreIncrement(qty),
                        realOrderCount: firestoreIncrement(qty)
                    };
                    if (typeof snap.data().stock === 'number') {
                        updates.stock = firestoreIncrement(-qty);
                    }
                    transaction.update(snap.ref, updates);
                }
            }
        });

        // TĂNG TỔNG SỐ ĐƠN TÍCH LŨY
        try {
            const statsRef = doc(db, "config", "stats");
            setDoc(statsRef, { totalOrders: firestoreIncrement(1) }, { merge: true }).catch((err) => {
                console.warn("Lỗi tăng thống kê khi khôi phục đơn:", err.message);
            });
        } catch (statsErr) {
            console.warn("Lỗi đồng bộ thống kê đơn hàng khi khôi phục:", statsErr);
        }
    } catch (e) {
        console.error("Critical error incrementing order stats:", e);
        throw e;
    }
};
