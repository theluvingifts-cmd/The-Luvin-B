
import { db } from '../config/firebase';
// Fix: Import firestore functions from 'firebase/firestore'
import { doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

const ANALYTICS_COLLECTION = 'analytics';
const CART_STATS_DOC = 'cart_stats';

// Hàm gọi khi người dùng bấm thêm vào giỏ
export const trackAddToCart = async () => {
    const ref = doc(db, ANALYTICS_COLLECTION, CART_STATS_DOC);
    try {
        // Tăng biến đếm lên 1
        await updateDoc(ref, { 
            totalAddCount: increment(1),
            lastUpdated: new Date().toISOString()
        });
    } catch (error: any) {
        // Nếu document chưa tồn tại (lần đầu tiên), tạo mới
        if (error.code === 'not-found') {
            await setDoc(ref, { 
                totalAddCount: 1,
                lastUpdated: new Date().toISOString()
            });
        } else {
            console.error("Lỗi tracking:", error);
        }
    }
};

// Hàm lấy số liệu cho Admin
export const getCartStats = async (): Promise<number> => {
    try {
        const ref = doc(db, ANALYTICS_COLLECTION, CART_STATS_DOC);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as { totalAddCount?: number };
            return data.totalAddCount || 0;
        }
        return 0;
    } catch (error) {
        console.error("Lỗi lấy thống kê giỏ hàng:", error);
        return 0;
    }
};
