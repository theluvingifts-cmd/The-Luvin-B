
import { Order } from '../types';
import { StoreConfig } from './configService';

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
<b>💰 Đã thanh toán:</b> ${formatMoney(order.amountPaid || 0)}
<b>👤 Khách hàng:</b> ${order.customer.name}
<b>📞 SĐT:</b> <a href="tel:${order.customer.phone}">${order.customer.phone}</a>
<b>📍 Địa chỉ:</b> ${order.customer.address}
<b>📝 Note:</b> ${order.delivery.notes || 'Không'}

<b>🛒 Chi tiết sản phẩm:</b>
${itemsList}

<i>Vui lòng kiểm tra Admin Dashboard để xử lý.</i>
    `.trim();

    try {
        // Call the API endpoint (Serverless function or local proxy)
        // Note: Direct fetch to Telegram API from browser is blocked by CORS, so we use the /api/ proxy.
        // If running locally with Vite without backend proxy, this might fail, but works on Vercel.
        const response = await fetch('/api/send-telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: config.telegramBotToken,
                chatId: config.telegramChatId,
                text: message
            })
        });

        if (!response.ok) {
            console.error("Failed to send Telegram notification:", await response.text());
        } else {
            console.log("Telegram notification sent!");
        }
    } catch (e) {
        console.error("Error sending Telegram:", e);
    }
};
