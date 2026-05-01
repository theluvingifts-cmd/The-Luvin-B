
import { db } from '../config/firebase';
import { doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

const ANALYTICS_COLLECTION = 'analytics';
const FUNNEL_DOC = 'funnel_stats';

export type FunnelStep = 
    | 'view_home'
    | 'view_collection'
    | 'view_product'
    | 'builder_start' 
    | 'step2_info' 
    | 'step3_parts' 
    | 'step4_summary' 
    | 'add_to_cart' 
    | 'checkout_start' 
    | 'order_complete';

// Hàm theo dõi từng bước trong phễu
export const trackFunnelStep = async (step: FunnelStep) => {
    const today = new Date().toISOString().split('T')[0];
    const fieldName = `${step}_count`;
    
    // Track daily stats
    const dailyRef = doc(db, ANALYTICS_COLLECTION, `daily_${today}`);
    try {
        await updateDoc(dailyRef, { 
            [fieldName]: increment(1),
            lastUpdated: new Date().toISOString()
        });
    } catch (error: any) {
        if (error.code === 'not-found') {
            await setDoc(dailyRef, { 
                [fieldName]: 1,
                lastUpdated: new Date().toISOString()
            });
        }
    }

    // Track original funnel doc (cumulative)
    const ref = doc(db, ANALYTICS_COLLECTION, FUNNEL_DOC);
    try {
        await updateDoc(ref, { 
            [fieldName]: increment(1),
            lastUpdated: new Date().toISOString()
        });
    } catch (error: any) {
        if (error.code === 'not-found') {
            await setDoc(ref, { 
                [fieldName]: 1,
                lastUpdated: new Date().toISOString()
            });
        }
    }
};

// Hàm cũ giữ nguyên cho tương thích
export const trackAddToCart = () => trackFunnelStep('add_to_cart');

// Lấy toàn bộ dữ liệu phễu cho Admin - hỗ trợ lọc theo ngày
export const getFunnelStats = async (startDate?: Date, endDate?: Date) => {
    try {
        // Nếu không có ngày, trả về tích lũy
        if (!startDate || !endDate) {
            const ref = doc(db, ANALYTICS_COLLECTION, FUNNEL_DOC);
            const snap = await getDoc(ref);
            return snap.exists() ? snap.data() : null;
        }

        // Aggregate daily stats
        const aggregated: Record<string, number> = {};
        const tempDate = new Date(startDate);
        const promises = [];

        while (tempDate <= endDate) {
            const dateStr = tempDate.toISOString().split('T')[0];
            const ref = doc(db, ANALYTICS_COLLECTION, `daily_${dateStr}`);
            promises.push(getDoc(ref));
            tempDate.setDate(tempDate.getDate() + 1);
        }

        const snaps = await Promise.all(promises);
        snaps.forEach(snap => {
            if (snap.exists()) {
                const data = snap.data();
                Object.entries(data).forEach(([key, val]) => {
                    if (key.endsWith('_count') && typeof val === 'number') {
                        aggregated[key] = (aggregated[key] || 0) + val;
                    }
                });
            }
        });

        return Object.keys(aggregated).length > 0 ? aggregated : null;
    } catch (error) {
        console.error("Lỗi lấy thống kê phễu:", error);
        return null;
    }
};

// Hàm lấy số lượt thêm giỏ (để dashboard cũ không lỗi)
export const getCartStats = async (): Promise<number> => {
    const stats = await getFunnelStats();
    return stats?.add_to_cart_count || 0;
};
