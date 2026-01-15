
import { db } from '../config/firebase';
import { doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

const ANALYTICS_COLLECTION = 'analytics';
const FUNNEL_DOC = 'funnel_stats';

export type FunnelStep = 
    | 'builder_start' 
    | 'step2_info' 
    | 'step3_parts' 
    | 'step4_summary' 
    | 'add_to_cart' 
    | 'checkout_start' 
    | 'order_complete';

// Hàm theo dõi từng bước trong phễu
export const trackFunnelStep = async (step: FunnelStep) => {
    const ref = doc(db, ANALYTICS_COLLECTION, FUNNEL_DOC);
    const fieldName = `${step}_count`;
    
    try {
        await updateDoc(ref, { 
            [fieldName]: increment(1),
            lastUpdated: new Date().toISOString()
        });
    } catch (error: any) {
        if (error.code === 'not-found') {
            await setDoc(ref, { 
                [`${step}_count`]: 1,
                lastUpdated: new Date().toISOString()
            });
        }
    }
};

// Hàm cũ giữ nguyên cho tương thích
export const trackAddToCart = () => trackFunnelStep('add_to_cart');

// Lấy toàn bộ dữ liệu phễu cho Admin
export const getFunnelStats = async () => {
    try {
        const ref = doc(db, ANALYTICS_COLLECTION, FUNNEL_DOC);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data();
        }
        return null;
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
