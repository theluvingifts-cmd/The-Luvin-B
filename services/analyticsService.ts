
import { db } from '../config/firebase';
import { doc, updateDoc, increment, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

const ANALYTICS_COLLECTION = 'analytics';

export type FunnelStep = 
    | 'builder_start' 
    | 'step2_info' 
    | 'step3_parts' 
    | 'step4_summary' 
    | 'add_to_cart' 
    | 'checkout_start' 
    | 'order_complete';

/**
 * Lấy ID document theo ngày hiện tại (VD: daily_2024-05-20)
 */
const getCurrentDateId = () => {
    return `daily_${new Date().toISOString().split('T')[0]}`;
};

/**
 * Theo dõi bước trong phễu và lưu vào document của ngày hôm nay
 */
export const trackFunnelStep = async (step: FunnelStep) => {
    const docId = getCurrentDateId();
    const ref = doc(db, ANALYTICS_COLLECTION, docId);
    const fieldName = `${step}_count`;
    
    try {
        await updateDoc(ref, { 
            [fieldName]: increment(1),
            lastUpdated: new Date().toISOString(),
            dateStr: new Date().toISOString().split('T')[0] // Dùng để filter sau này
        });
    } catch (error: any) {
        if (error.code === 'not-found') {
            await setDoc(ref, { 
                [fieldName]: 1,
                lastUpdated: new Date().toISOString(),
                dateStr: new Date().toISOString().split('T')[0]
            });
        }
    }
};

/**
 * Lấy thống kê phễu trong một khoảng thời gian cụ thể
 */
export const getFunnelStatsRange = async (startDate: Date, endDate: Date) => {
    try {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        const q = query(
            collection(db, ANALYTICS_COLLECTION),
            where('dateStr', '>=', startStr),
            where('dateStr', '<=', endStr)
        );
        
        const querySnapshot = await getDocs(q);
        const totals: any = {
            builder_start_count: 0,
            step2_info_count: 0,
            step3_parts_count: 0,
            step4_summary_count: 0,
            add_to_cart_count: 0,
            checkout_start_count: 0,
            order_complete_count: 0
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            Object.keys(totals).forEach(key => {
                totals[key] += (data[key] || 0);
            });
        });

        return totals;
    } catch (error) {
        console.error("Lỗi lấy thống kê phễu theo khoảng ngày:", error);
        return null;
    }
};

// Hàm cũ giữ nguyên cho tương thích ngược (fallback)
export const trackAddToCart = () => trackFunnelStep('add_to_cart');
export const getFunnelStats = async () => getFunnelStatsRange(new Date(0), new Date());
