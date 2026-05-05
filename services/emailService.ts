// services/emailService.ts
import type { Order } from '../types';
import { formatFullAddress } from '../utils/helpers';

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
                address: formatFullAddress(order.customer),
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

export const sendThankYouEmail = async (order: Order) => {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to_name: order.customer.name,
                to_email: order.customer.email,
                order_id: order.id,
                type: 'thank_you'
            }),
        });

        if (response.ok) {
            console.log('Email cảm ơn đã gửi thành công!');
            return true;
        } else {
            console.error('Lỗi gửi email cảm ơn:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Lỗi khi gửi email cảm ơn:', error);
        return false;
    }
};
