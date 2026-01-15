
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

// Helper để lấy ID tài liệu theo ngày (VD: daily_2024-03-20)
const getDateId = (date = new Date()) => {
    return `daily_${date.toISOString().split('T')[0]}`;
};

/**
 * Theo dõi bước trong phễu theo thời gian thực (Lưu theo ngày)
 */
export const trackFunnelStep = async (step: FunnelStep) => {
    const docId = getDateId();
    const ref = doc(db, ANALYTICS_COLLECTION, docId);
    const fieldName = `${step}_count`;
    
    try {
        await updateDoc(ref, { 
            [fieldName]: increment(1),
            lastUpdated: new Date().toISOString(),
            date: docId.replace('daily_', '') // Lưu trường date để dễ query nếu cần
        });
    } catch (error: any) {
        if (error.code === 'not-found') {
            // Khởi tạo tài liệu mới cho ngày hôm nay nếu chưa tồn tại
            await setDoc(ref, { 
                [`${step}_count`]: 1,
                lastUpdated: new Date().toISOString(),
                date: docId.replace('daily_', '')
            });
        }
    }
};

/**
 * Lấy thống kê phễu trong một khoảng thời gian
 */
export const getFunnelStatsRange = async (startDate: Date, endDate: Date) => {
    try {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        // Query tất cả tài liệu ngày trong khoảng chọn
        const q = query(
            collection(db, ANALYTICS_COLLECTION),
            where('date', '>=', startStr),
            where('date', '<=', endStr)
        );
        
        const querySnapshot = await getDocs(q);
        
        // Khởi tạo object tổng
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
        console.error("Lỗi lấy thống kê phễu theo ngày:", error);
        return null;
    }
};

// Giữ lại để không lỗi các phần cũ (nếu có)
export const trackAddToCart = () => trackFunnelStep('add_to_cart');
