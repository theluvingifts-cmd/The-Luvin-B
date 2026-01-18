
import { Order } from '../types';
import { StoreConfig } from './configService';

// Helper to send message via API
const sendTelegramMessage = async (token: string, chatId: string, text: string) => {
    try {
        const response = await fetch('/api/send-telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token,
                chatId,
                text
            })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            return { success: true };
        } else {
            return { success: false, error: data.error || 'Unknown error' };
        }
    } catch (e: any) {
        console.error("Error sending Telegram:", e);
        return { success: false, error: e.message };
    }
};

export const sendOrderTelegram = async (order: Order, config: StoreConfig) => {
    // If config is missing, we can't send
    if (!config.telegramBotToken || !config.telegramChatId) {
        console.log("Telegram config missing. Skipping notification.");
        return;
    }

    // Format items list
    const itemsList = order.items.map((item, i) => {
        const frameName = item.frameId.toUpperCase();
        const chars = item.characters.length;
        const note = item.background.type === 'upload' ? ' (Nền tự tải)' : '';
        return `- <b>Khung ${frameName}</b>: ${chars} NV${note}`;
    }).join('\n');

    // Format money
    const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    // Create message content (HTML)
    const message = `
<b>🔥 ĐƠN HÀNG MỚI: ${order.id}</b>
--------------------------------
<b>💵 Tổng tiền:</b> ${formatMoney(order.totalPrice)}
<b>🗓️ Ngày nhận dự kiến:</b> ${order.delivery.date ? new Date(order.delivery.date).toLocaleDateString('vi-VN') : 'Liên hệ'}
<b>👤 Khách hàng:</b> ${order.customer.name}
<b>📞 SĐT:</b> <a href="tel:${order.customer.phone}">${order.customer.phone}</a>
<b>📍 Địa chỉ:</b> ${order.customer.address}
<b>📝 Ghi chú:</b> ${order.delivery.notes || 'Không'}

<b>🛒 Chi tiết sản phẩm:</b>
${itemsList}

<i>Hệ thống tự động đồng bộ. Vui lòng kiểm tra Admin để xử lý.</i>
    `.trim();

    const result = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);
    if (!result.success) {
        console.error("Failed to send Telegram notification:", result.error);
    } else {
        console.log("Telegram notification sent!");
    }
};

export const testTelegramConnection = async (token: string, chatId: string) => {
    const message = `
<b>🔔 KIỂM TRA KẾT NỐI TELEGRAM</b>
--------------------------------
Nếu bạn nhận được tin nhắn này, hệ thống thông báo đã hoạt động chính xác!
🚀 Ready to rock!
    `.trim();
    return await sendTelegramMessage(token, chatId, message);
};
