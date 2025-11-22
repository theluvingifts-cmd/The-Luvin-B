
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

// Response chuẩn
interface ShipmentResponse {
    success: boolean;
    data?: ShippingDetails;
    error?: string;
}

// URL API Viettel Post
const VTP_BASE_URL = "https://partner.viettelpost.vn/v2/order";
const VTP_TOKEN = "F4214BC9CBA7D7CD1BCC6C94AA57D4BA";

// URL tra cứu (Public)
const VTP_TRACKING_URL = "https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/van-don?code=";
const SPX_TRACKING_URL = "https://spx.vn/track/";

/**
 * Tạo đơn hàng Viettel Post (API Thực)
 */
export const createViettelPostOrder = async (
    order: Order, 
    payload: ShipmentPayload
): Promise<ShipmentResponse> => {
    console.log("🚀 Đang gửi đơn sang Viettel Post...", { orderId: order.id });

    // Cấu trúc Body theo tài liệu Viettel Post API
    const body = {
        ORDER_NUMBER: order.id.replace('#', ''), // Mã đơn hàng riêng
        GROUPADDRESS_ID: 0, // 0 = Lấy kho mặc định của tài khoản
        CUS_ID: 0, 
        DELIVERY_DATE: new Date().toLocaleDateString('en-GB').split('/').join('/'), // DD/MM/YYYY
        
        // Thông tin người gửi (Cần cấu hình chính xác trong tài khoản VTP hoặc điền vào đây)
        SENDER_FULLNAME: "The Luvin",
        SENDER_ADDRESS: "Khu 6, Thư Lâm, Hà Nội", 
        SENDER_PHONE: "0964393115",
        SENDER_EMAIL: "theluvin.gifts@gmail.com",
        SENDER_WARD: 0, 
        SENDER_DISTRICT: 0,
        SENDER_PROVINCE: 0,

        // Thông tin người nhận
        RECEIVER_FULLNAME: order.customer.name,
        RECEIVER_ADDRESS: order.customer.address,
        RECEIVER_PHONE: order.customer.phone || "",
        RECEIVER_EMAIL: order.customer.email || "",
        RECEIVER_WARD: 0, 
        RECEIVER_DISTRICT: 0,
        RECEIVER_PROVINCE: 0,

        // Thông tin hàng hóa
        PRODUCT_NAME: "Khung ảnh LEGO thiết kế",
        PRODUCT_DESCRIPTION: payload.note || "Hàng dễ vỡ",
        PRODUCT_QUANTITY: 1,
        PRODUCT_PRICE: order.totalPrice,
        PRODUCT_WEIGHT: payload.weight, // gram
        PRODUCT_LENGTH: payload.length,
        PRODUCT_WIDTH: payload.width,
        PRODUCT_HEIGHT: payload.height,

        // Dịch vụ
        ORDER_PAYMENT: 3, // 3: Thu hộ tiền cước + tiền hàng (người nhận trả)
        ORDER_SERVICE: "LCOD", // Chuyển phát tiết kiệm COD
        ORDER_NOTE: payload.note,
        MONEY_COLLECTION: payload.codAmount, // Tiền thu hộ
        CHECK_UNIQUE: "true" 
    };

    try {
        const response = await fetch(`${VTP_BASE_URL}/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Token': VTP_TOKEN
            },
            body: JSON.stringify(body)
        });

        const resData = await response.json();

        if (response.ok && resData.status === 200) {
            // Thành công
            const trackingCode = resData.data.ORDER_NUMBER;
            return {
                success: true,
                data: {
                    carrier: 'ViettelPost',
                    trackingCode: trackingCode,
                    status: 'NEW',
                    codAmount: payload.codAmount,
                    fee: resData.data.MONEY_TOTAL || 0,
                    createdAt: new Date().toISOString(),
                    trackingUrl: VTP_TRACKING_URL + trackingCode
                }
            };
        } else {
            console.error("VTP API Error:", resData);
            return { success: false, error: resData.message || "Lỗi không xác định từ Viettel Post" };
        }
    } catch (error: any) {
        console.error("Lỗi kết nối VTP:", error);
        return { success: false, error: "Lỗi kết nối mạng hoặc CORS (Thử lại sau hoặc dùng Backend proxy)" };
    }
};

/**
 * MOCK: Tạo đơn hàng Shopee Express (SPX)
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
                trackingUrl: SPX_TRACKING_URL 
            }
        };
    } else {
        return { success: false, error: "Lỗi hệ thống SPX: Service Unavailable." };
    }
};

/**
 * Hủy đơn hàng
 */
export const cancelShippingOrder = async (
    carrier: string, 
    trackingCode: string
): Promise<{ success: boolean; error?: string }> => {
    console.log(`Đang hủy đơn ${carrier}: ${trackingCode}`);

    if (carrier === 'ViettelPost') {
        try {
            const body = {
                TYPE: 4, // 4 = Hủy đơn
                ORDER_NUMBER: trackingCode,
                NOTE: "Khách hủy đơn"
            };

            const response = await fetch(`${VTP_BASE_URL}/UpdateOrder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Token': VTP_TOKEN
                },
                body: JSON.stringify(body)
            });

            const resData = await response.json();
            
            if (response.ok && (resData.status === 200 || resData.status === 202)) {
                return { success: true };
            } else {
                console.warn("VTP Cancel Error:", resData);
                return { success: false, error: resData.message || "Lỗi hủy đơn VTP" };
            }
        } catch (error) {
            console.error("Lỗi kết nối khi hủy VTP:", error);
            return { success: false, error: "Lỗi mạng khi gọi API hủy" };
        }
    }

    // Mock cancel cho SPX
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true };
};
