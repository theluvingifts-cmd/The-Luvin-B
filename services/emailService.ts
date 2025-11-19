// services/emailService.ts
import type { Order } from '../types';

export const sendOrderEmail = async (order: Order) => {
    try {
        const itemsSummary = order.items.map((item) => 
            `- Khung ${item.frameId} (${item.characters.length} nhân vật)`
        ).join('\n');

        // Gọi API do chính Vercel host (file trong folder /api)
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to_name: order.customer.name,
                to_email: order.customer.email,
                order_id: order.id,
                total_price: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalPrice),
                address: order.customer.address,
                items_list: itemsSummary,
            }),
        });

        if (response.ok) {
            console.log('Email đã gửi thành công!');
            return true;
        } else {
            console.error('Lỗi gửi email:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Lỗi kết nối API email:', error);
        return false;
    }
};