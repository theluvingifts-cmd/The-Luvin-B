
import { db } from '../config/firebase';
// Proper imports for the modular Firestore SDK
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc, increment, writeBatch, query, orderBy, runTransaction, getDoc } from 'firebase/firestore';
import { COLLECTION_TEMPLATES } from '../constants';
import type { CollectionTemplate, AutoOrderDailyLog, AutoOrderDailyLogItem, AutoOrderSummary } from '../types';
import { cleanForFirestore } from '../utils/helpers';

const COLLECTION_NAME = "templates";

export const getAllTemplates = async (): Promise<CollectionTemplate[]> => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
        let querySnapshot = await getDocs(q).catch(async (err) => {
            // Fallback if index is not created yet
            console.warn("Index not found or error, falling back to unordered fetch:", err);
            return await getDocs(collection(db, COLLECTION_NAME));
        });

        const templates: CollectionTemplate[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as CollectionTemplate;
            templates.push({ ...data, id: doc.id });
        });

        // If fallback was used or order is missing, templates might not be sorted correctly here in JS
        // but we'll return them anyway
        
        // JS sort as safety net if order field exists
        templates.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        return templates;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("Firestore: Permission denied for templates.");
            return [];
        }
        console.error("Error fetching templates:", error);
        return [];
    }
};

export const addTemplate = async (template: CollectionTemplate) => {
    try {
        const cleaned = cleanForFirestore({
            ...template,
            fakeOrderCount: Number(template.fakeOrderCount || template.purchaseCount || 0),
            realOrderCount: Number(template.realOrderCount || template.orders || 0),
            order: template.order ?? 9999
        });
        await setDoc(doc(db, COLLECTION_NAME, template.id), cleaned);
        return true;
    } catch (error) {
        console.error("Error adding template:", error);
        return false;
    }
};

export const updateTemplate = async (id: string, updates: Partial<CollectionTemplate>) => {
    try {
        const cleaned = cleanForFirestore(updates);
        await updateDoc(doc(db, COLLECTION_NAME, id), cleaned);
        return true;
    } catch (error) {
        console.error("Error updating template:", error);
        return false;
    }
};

export const deleteTemplate = async (id: string) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        return true;
    } catch (error) {
        console.error("Error deleting template:", error);
        return false;
    }
};

export const incrementTemplatePurchaseCount = async (templateId: string, amount: number = 1) => {
    try {
        if (!templateId) return;
        const docRef = doc(db, COLLECTION_NAME, templateId);
        await setDoc(docRef, {
            id: templateId,
            realOrderCount: increment(amount),
            orders: increment(amount)
        }, { merge: true });
    } catch (error) {
        console.error("Error incrementing purchase count:", error);
    }
};

export const seedTemplates = async () => {
    try {
        for (const t of COLLECTION_TEMPLATES) {
            const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await setDoc(doc(db, COLLECTION_NAME, id), { ...t, id, purchaseCount: 0 });
        }
        return true;
    } catch (error) {
        console.error("Seed templates error:", error);
        return false;
    }
};

export const reorderTemplatesList = async (items: CollectionTemplate[]) => {
    try {
        const batch = writeBatch(db);
        items.forEach((item, index) => {
            const ref = doc(db, COLLECTION_NAME, item.id);
            batch.update(ref, { order: index });
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error reordering templates:", error);
        return false;
    }
};

/**
 * Tự động cộng tầm 5 lượt đặt hàng vào random các mẫu mỗi ngày.
 */
export const processDailyAutoOrderIncrement = async (
    forceRun: boolean = false, 
    targetTemplates?: CollectionTemplate[]
): Promise<{ processed: boolean; count?: number; date?: string }> => {
    try {
        // Lấy ngày hiện tại theo giờ Việt Nam (YYYY-MM-DD)
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        const autoOrdersDocRef = doc(db, 'config', 'auto_orders');

        // Kiểm tra xem hôm nay đã chạy chưa (trừ khi forceRun = true)
        if (!forceRun) {
            let shouldProcess = false;
            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(autoOrdersDocRef);
                    const lastDate = snap.exists() ? snap.data()?.lastDate : null;
                    if (lastDate !== todayStr) {
                        transaction.set(autoOrdersDocRef, {
                            lastDate: todayStr,
                            updatedAt: Date.now()
                        }, { merge: true });
                        shouldProcess = true;
                    }
                });
            } catch (transErr) {
                // Trường hợp lỗi transaction do xung đột đồng thời, fallback kiểm tra trực tiếp
                const snap = await getDoc(autoOrdersDocRef);
                if (!snap.exists() || snap.data()?.lastDate !== todayStr) {
                    await setDoc(autoOrdersDocRef, { lastDate: todayStr, updatedAt: Date.now() }, { merge: true });
                    shouldProcess = true;
                }
            }

            if (!shouldProcess) {
                return { processed: false };
            }
        }

        // Lấy tất cả mẫu hiện có (sử dụng targetTemplates nếu có sẵn)
        const templates = (targetTemplates && targetTemplates.length > 0) 
            ? targetTemplates 
            : await getAllTemplates();
            
        if (!templates || templates.length === 0) {
            console.warn("[AutoOrders] Không tìm thấy mẫu nào để cộng đơn.");
            return { processed: false };
        }

        // Tổng số lượt cộng hôm nay: ngẫu nhiên từ 4 đến 6 lượt (tầm 5 lượt)
        const totalAdditions = Math.floor(Math.random() * 3) + 4;

        // Chọn ngẫu nhiên mẫu để cộng
        const incrementsMap: Record<string, { count: number; template: CollectionTemplate }> = {};
        for (let i = 0; i < totalAdditions; i++) {
            const randomIdx = Math.floor(Math.random() * templates.length);
            const chosen = templates[randomIdx];
            if (!incrementsMap[chosen.id]) {
                incrementsMap[chosen.id] = { count: 0, template: chosen };
            }
            incrementsMap[chosen.id].count += 1;
        }

        // Cập nhật Firestore theo batch
        const batch = writeBatch(db);
        const logItems: AutoOrderDailyLogItem[] = [];

        Object.entries(incrementsMap).forEach(([templateId, data]) => {
            const tRef = doc(db, COLLECTION_NAME, templateId);
            const currentFake = Number(data.template.fakeOrderCount ?? data.template.purchaseCount ?? 0);
            const nextCount = currentFake + data.count;

            batch.set(tRef, {
                fakeOrderCount: nextCount,
                purchaseCount: nextCount
            }, { merge: true });

            logItems.push({
                templateId,
                templateName: data.template.name,
                templateThumbnail: data.template.imageUrl || '',
                count: data.count
            });
        });

        // Get existing summary to preserve and append to dailyLogs history
        let currentSummaryData: any = {};
        try {
            const currentSummarySnap = await getDoc(autoOrdersDocRef);
            if (currentSummarySnap.exists()) {
                currentSummaryData = currentSummarySnap.data();
            }
        } catch {
            // Ignore if doc does not exist yet
        }

        // Save daily log document: config/auto_orders/daily_logs/{todayStr}
        let finalItems = logItems;
        let finalTotalAdded = totalAdditions;

        const existingDailyLogs: AutoOrderDailyLog[] = Array.isArray(currentSummaryData?.dailyLogs) 
            ? currentSummaryData.dailyLogs 
            : [];

        const existingTodayLog = existingDailyLogs.find(l => l.date === todayStr);
        if (existingTodayLog) {
            const itemMap: Record<string, AutoOrderDailyLogItem> = {};
            (existingTodayLog.items || []).forEach(item => {
                itemMap[item.templateId] = { ...item };
            });
            logItems.forEach(newItem => {
                if (itemMap[newItem.templateId]) {
                    itemMap[newItem.templateId].count += newItem.count;
                } else {
                    itemMap[newItem.templateId] = newItem;
                }
            });
            finalItems = Object.values(itemMap);
            finalTotalAdded = (existingTodayLog.totalAdded || 0) + totalAdditions;
        }

        const todayLogEntry: AutoOrderDailyLog = {
            id: todayStr,
            date: todayStr,
            timestamp: Date.now(),
            totalAdded: finalTotalAdded,
            items: finalItems
        };

        const updatedDailyLogs = [
            todayLogEntry,
            ...existingDailyLogs.filter(log => log.date !== todayStr)
        ].slice(0, 90); // Keep last 90 days

        const currentTotalAllTime = Number(currentSummaryData?.totalAutoAddedAllTime || 0);

        const templateTotals = { ...(currentSummaryData?.templateTotals || {}) };
        logItems.forEach(item => {
            const prevTotal = Number(templateTotals[item.templateId]?.totalAdded || 0);
            templateTotals[item.templateId] = {
                templateId: item.templateId,
                templateName: item.templateName,
                templateThumbnail: item.templateThumbnail || '',
                totalAdded: prevTotal + item.count,
                lastUpdated: Date.now()
            };
        });

        // Update overall summary in config/auto_orders
        const summaryUpdates: Record<string, any> = {
            lastDate: todayStr,
            lastUpdated: Date.now(),
            totalAutoAddedAllTime: currentTotalAllTime + totalAdditions,
            templateTotals,
            dailyLogs: updatedDailyLogs
        };

        batch.set(autoOrdersDocRef, summaryUpdates, { merge: true });

        await batch.commit();

        // Optional: Save to subcollection for backward compatibility (non-blocking, won't fail the batch if rules reject subcollections)
        try {
            const dailyLogRef = doc(db, 'config', 'auto_orders', 'daily_logs', todayStr);
            await setDoc(dailyLogRef, todayLogEntry, { merge: true });
        } catch {
            // Ignored safely if subcollection rule is not configured
        }

        console.log(`[AutoOrders] Đã tự động cộng ${totalAdditions} lượt đặt hàng ngẫu nhiên cho ${Object.keys(incrementsMap).length} mẫu trong ngày ${todayStr}.`);
        return { processed: true, count: totalAdditions, date: todayStr };
    } catch (error) {
        console.error("Lỗi tự động cộng lượt đặt hàng hàng ngày:", error);
        return { processed: false };
    }
};

/**
 * Lấy lịch sử cộng lượt đặt hàng theo ngày và bảng tổng hợp.
 */
export const getAutoOrderLogsAndStats = async (): Promise<{
    summary: AutoOrderSummary;
    dailyLogs: AutoOrderDailyLog[];
}> => {
    try {
        const autoOrdersDocRef = doc(db, 'config', 'auto_orders');
        const summarySnap = await getDoc(autoOrdersDocRef);
        const data = summarySnap.exists() ? summarySnap.data() : null;

        const summary: AutoOrderSummary = data ? {
            lastDate: data.lastDate,
            lastUpdated: data.lastUpdated,
            totalAutoAddedAllTime: data.totalAutoAddedAllTime || 0,
            templateTotals: data.templateTotals || {}
        } : {
            totalAutoAddedAllTime: 0,
            templateTotals: {}
        };

        // First prioritize embedded dailyLogs in config/auto_orders
        let dailyLogs: AutoOrderDailyLog[] = Array.isArray(data?.dailyLogs) ? data.dailyLogs : [];

        // If dailyLogs array is empty in parent doc, attempt to read from subcollection as fallback
        if (dailyLogs.length === 0) {
            try {
                const logsColRef = collection(db, 'config', 'auto_orders', 'daily_logs');
                const logsQuery = query(logsColRef, orderBy('timestamp', 'desc'));
                const logsSnap = await getDocs(logsQuery);
                if (!logsSnap.empty) {
                    dailyLogs = logsSnap.docs.map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    })) as AutoOrderDailyLog[];
                }
            } catch {
                // Subcollection read permission might not be set in cloud rules, fallback silently
            }
        }

        return { summary, dailyLogs };
    } catch (error) {
        console.error("Lỗi lấy nhật ký và thống kê cộng đơn tự động:", error);
        return {
            summary: { totalAutoAddedAllTime: 0, templateTotals: {} },
            dailyLogs: []
        };
    }
};


