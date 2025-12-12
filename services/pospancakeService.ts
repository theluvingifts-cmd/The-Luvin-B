
import { Order } from '../types';

// CẤU HÌNH POSPANCAKE (Bạn cần điền thông tin thật)
const POS_API_URL = "https://api.pos.pages.fm/api/v1/shops/{SHOP_ID}/orders"; // Ví dụ URL
const POS_API_TOKEN = "YOUR_ACCESS_TOKEN"; // Nên lưu trong biến môi trường hoặc Config Service

export const pushOrderToPospancake = async (order: Order) => {
    // Nếu chưa cấu hình, bỏ qua
    if (POS_API_TOKEN === "YOUR_ACCESS_TOKEN") {
        console.warn("Pospancake chưa được cấu hình token.");
        return { success: false, message: "Chưa cấu hình API Token" };
    }

    try {
        // 1. Map dữ liệu từ Order của Luvin sang format của Pancake/POS
        // Đây là format giả định chuẩn, bạn cần sửa lại theo document của Pancake
        const payload = {
            uid: order.id, // Mã đơn bên mình
            customer_name: order.customer.name,
            customer_phone: order.customer.phone,
            customer_address: order.customer.address,
            note: order.delivery.notes,
            total_amount: order.totalPrice,
            shipping_fee: order.shipping.fee,
            items: order.items.map(item => ({
                product_name: `Khung LEGO ${item.frameId}`,
                quantity: item.quantity || 1,
                price: 0, // Giá chi tiết từng món nếu cần tính toán lại
                variation_info: `${item.characters.length} nhân vật`
            })),
            status: 1, // 1 = Mới
            cod: order.amountToPay, // Số tiền cần thu hộ
            tags: ["Website", "TheLuvin"]
        };

        // 2. Gửi Request
        const response = await fetch(POS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POS_API_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Đẩy đơn sang PosPancake thành công:", data);
            return { success: true, data };
        } else {
            console.error("Lỗi đẩy đơn PosPancake:", data);
            return { success: false, message: JSON.stringify(data) };
        }

    } catch (error: any) {
        console.error("Lỗi kết nối PosPancake:", error);
        return { success: false, message: error.message };
    }
};
