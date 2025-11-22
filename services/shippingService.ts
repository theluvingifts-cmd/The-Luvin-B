
// services/shippingService.ts
import type { Order, ShippingDetails } from '../types';

// CẤU HÌNH MOCKUP API (Trong thực tế, các key này nên ở Backend)
// Đây là service giả lập để demo luồng dữ liệu.
// Để chạy thật, bạn cần thay thế phần `setTimeout` bằng `fetch` tới API thật của VTP/SPX.

interface ShippingPayload {
    orderId: string;
    sender: {
        name: string;
        phone: string;
        address: string;
    };
    receiver: {
        name: string;
        phone: string;
        address: string;
    };
    weight: number; // gram
    length: number; // cm
    width: number; // cm
    height: number; // cm
    cod: number; // VND
    insuranceValue: number; // VND
    note: string;
}

// Thông tin kho gửi hàng (Hardcode tạm thời)
const SENDER_INFO = {
    name: "The Luvin Store",
    phone: "0964393115",
    address: "Khu 6, Thư Lâm, Hà Nội"
};

/**
 * Tạo đơn hàng Viettel Post
 */
export const createVTPOrder = async (
    order: Order, 
    weight: number, 
    l: number, 
    w: number, 
    h: number
): Promise<{ success: boolean; data?: ShippingDetails; error?: string }> => {
    
    // 1. Chuẩn bị dữ liệu gửi sang API VTP
    const payload: ShippingPayload = {
        orderId: order.id,
        sender: SENDER_INFO,
        receiver: {
            name: order.customer.name,
            phone: order.customer.phone,
            address: order.customer.address
        },
        weight: weight,
        length: l,
        width: w,
        height: h,
        cod: order.amountToPay, // Thu hộ số tiền còn thiếu
        insuranceValue: order.totalPrice, // Khai giá
        note: order.delivery.notes || "Hàng dễ vỡ, xin nhẹ tay"
    };

    console.log("🔵 [VTP API] Sending payload:", payload);

    // 2. Giả lập gọi API (Thay bằng fetch thực tế ở đây)
    // API VTP Endpoint: https://partner.viettelpost.vn/v2/order/create
    return new Promise((resolve) => {
        setTimeout(() => {
            // Giả lập thành công 90%
            const isSuccess = true; 
            
            if (isSuccess) {
                const trackingCode = `VTP${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
                resolve({
                    success: true,
                    data: {
                        carrier: 'VTP',
                        trackingCode: trackingCode,
                        status: 'READY_TO_PICK',
                        codAmount: payload.cod,
                        fee: 35000, // Phí ship giả định trả về từ API
                        weight: weight,
                        dimensions: { l, w, h },
                        createdAt: new Date().toISOString()
                    }
                });
            } else {
                resolve({ success: false, error: "Địa chỉ người nhận không hợp lệ (Mô phỏng lỗi)." });
            }
        }, 1500);
    });
};

/**
 * Tạo đơn hàng Shopee Express (SPX)
 */
export const createSPXOrder = async (
    order: Order, 
    weight: number, 
    l: number, 
    w: number, 
    h: number
): Promise<{ success: boolean; data?: ShippingDetails; error?: string }> => {

    const payload: ShippingPayload = {
        orderId: order.id,
        sender: SENDER_INFO,
        receiver: {
            name: order.customer.name,
            phone: order.customer.phone,
            address: order.customer.address
        },
        weight: weight,
        length: l,
        width: w,
        height: h,
        cod: order.amountToPay,
        insuranceValue: order.totalPrice,
        note: order.delivery.notes
    };

    console.log("🟠 [SPX API] Sending payload:", payload);

    // Giả lập gọi API SPX
    return new Promise((resolve) => {
        setTimeout(() => {
            const trackingCode = `SPXVN${Date.now().toString().slice(-9)}`;
            resolve({
                success: true,
                data: {
                    carrier: 'SPX',
                    trackingCode: trackingCode,
                    status: 'PENDING_PICKUP',
                    codAmount: payload.cod,
                    fee: 30000,
                    weight: weight,
                    dimensions: { l, w, h },
                    createdAt: new Date().toISOString()
                }
            });
        }, 1500);
    });
};

/**
 * Hủy vận đơn (Giả lập)
 */
export const cancelShippingOrder = async (trackingCode: string, carrier: 'VTP' | 'SPX') => {
    console.log(`🔴 Canceling order ${trackingCode} on ${carrier}`);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, 500);
    });
};
