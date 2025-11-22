
import type { Order, ShippingDetails } from '../types';

// Interface cho dữ liệu đầu vào để tạo vận đơn
export interface ShipmentPayload {
    weight: number; // Gram
    length: number; // cm
    width: number; // cm
    height: number; // cm
    note?: string;
    codAmount: number; // Tiền thu hộ
}

// Giả lập API Response
interface ShipmentResponse {
    success: boolean;
    data?: ShippingDetails;
    error?: string;
}

// URL tra cứu vận đơn (Public)
const VTP_TRACKING_URL = "https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/van-don?code=";
const SPX_TRACKING_URL = "https://spx.vn/track/";

/**
 * MOCK: Tạo đơn hàng Viettel Post
 * Thực tế: Gọi API POST https://partner.viettelpost.vn/v2/order/create
 */
export const createViettelPostOrder = async (
    order: Order, 
    payload: ShipmentPayload
): Promise<ShipmentResponse> => {
    console.log("🚀 Đang gửi đơn sang Viettel Post...", { orderId: order.id, payload });

    // Giả lập độ trễ mạng
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Giả lập thành công (90%)
    if (Math.random() > 0.1) {
        const trackingCode = `VTP${Math.floor(100000000 + Math.random() * 900000000)}`;
        return {
            success: true,
            data: {
                carrier: 'ViettelPost',
                trackingCode: trackingCode,
                status: 'NEW', // Trạng thái mới tạo
                codAmount: payload.codAmount,
                fee: 16500 + (payload.weight > 500 ? 5000 : 0), // Phí giả lập
                createdAt: new Date().toISOString(),
                trackingUrl: VTP_TRACKING_URL + trackingCode
            }
        };
    } else {
        return { success: false, error: "Lỗi kết nối Viettel Post API: Invalid Token or Timeout." };
    }
};

/**
 * MOCK: Tạo đơn hàng Shopee Express (SPX)
 * Thực tế: Gọi API SPX Open Platform
 */
export const createSPXOrder = async (
    order: Order, 
    payload: ShipmentPayload
): Promise<ShipmentResponse> => {
    console.log("🚀 Đang gửi đơn sang Shopee Express...", { orderId: order.id, payload });

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (Math.random() > 0.1) {
        const trackingCode = `SPXVN${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        return {
            success: true,
            data: {
                carrier: 'ShopeeExpress',
                trackingCode: trackingCode,
                status: 'READY_TO_PICK',
                codAmount: payload.codAmount,
                fee: 15000 + (payload.weight > 500 ? 3000 : 0),
                createdAt: new Date().toISOString(),
                trackingUrl: SPX_TRACKING_URL // SPX thường check bằng mã trên trang chủ
            }
        };
    } else {
        return { success: false, error: "Lỗi hệ thống SPX: Service Unavailable." };
    }
};

/**
 * Hủy đơn hàng (Mock)
 */
export const cancelShippingOrder = async (carrier: string, trackingCode: string) => {
    console.log(`Hủy đơn ${carrier}: ${trackingCode}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return true; 
};
