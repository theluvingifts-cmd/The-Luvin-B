
import { Order } from '../types';
import { StoreConfig } from './configService';
import { formatFullAddress } from '../utils/helpers';

// Helper function to escape HTML special characters for safe Telegram delivery
const escapeHtml = (unsafe: string): string => {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

// Helper to send message/photo via API with robust retry and backoff mechanism
const sendTelegramMessage = async (token: string, chatId: string, text: string, photoUrl?: string) => {
    let attempts = 3;
    let delay = 1000; // start with 1s delay
    
    while (attempts > 0) {
        try {
            const response = await fetch('/api/send-telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    chatId,
                    text,
                    photoUrl // Gửi kèm URL ảnh nếu có
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                return { success: true };
            } else {
                console.warn(`Telegram send attempt failed (status ${response.status}): ${data.error || 'Unknown error'}. Attempts remaining: ${attempts - 1}`);
                attempts--;
                if (attempts === 0) {
                    return { success: false, error: data.error || 'Unknown error' };
                }
            }
        } catch (e: any) {
            console.error(`Error sending Telegram (attempt ${4 - attempts}):`, e);
            attempts--;
            if (attempts === 0) {
                return { success: false, error: e.message };
            }
        }
        
        if (attempts > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
        }
    }
    return { success: false, error: 'Failed after maximum retries' };
};

export const sendOrderTelegram = async (order: Order, config: StoreConfig) => {
    // If config is missing, we can't send
    if (!config.telegramBotToken || !config.telegramChatId) {
        console.log("Telegram config missing. Skipping notification.");
        return;
    }

    // Lấy ảnh thiết kế đầu tiên trong đơn hàng (nếu có)
    const firstItemWithImage = order.items.find(item => item.previewImageUrl);
    const photoUrl = firstItemWithImage?.previewImageUrl;

    // Format items list
    const itemsList = order.items.map((item, i) => {
        const frameName = item.frameId.toUpperCase();
        const chars = item.characters.length;
        const note = item.background.type === 'upload' ? ' (Nền tự tải)' : '';
        return `${i + 1}. <b>Khung ${frameName}</b>: ${chars} NV${note}`;
    }).join('\n');

    // Format money
    const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    // Create message content (HTML)
    const message = `
<b>🔥 ĐƠN HÀNG MỚI: ${escapeHtml(order.id)}</b>
--------------------------------
<b>💵 Tổng tiền:</b> ${formatMoney(order.totalPrice)}
<b>🗓️ Ngày nhận:</b> ${new Date(order.delivery.date).toLocaleDateString('vi-VN')}
<b>👤 Khách hàng:</b> ${escapeHtml(order.customer.name)}
<b>📞 SĐT:</b> <a href="tel:${escapeHtml(order.customer.phone)}">${escapeHtml(order.customer.phone)}</a>
<b>📍 Địa chỉ:</b> ${escapeHtml(formatFullAddress(order.customer))}
<b>📝 Note:</b> ${escapeHtml(order.delivery.notes || 'Không')}

<b>🛒 Chi tiết sản phẩm:</b>
${itemsList}

<i>Vui lòng kiểm tra Admin Dashboard để xử lý.</i>
    `.trim();

    const result = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message, photoUrl);
    if (!result.success) {
        console.error("Failed to send Telegram notification:", result.error);
    } else {
        console.log("Telegram notification sent with image!");
    }
};

export const sendErrorTelegram = async (error: any, context: string, customerInfo?: any) => {
    // We need to fetch config manually since this might be called outside of normal flow
    const { getStoreConfig } = await import('./configService');
    const config = await getStoreConfig();

    if (!config?.telegramBotToken || !config?.telegramChatId) return;

    const safeStringify = (obj: any): string => {
        try {
            const seen = new WeakSet();
            return JSON.stringify(obj, (key, value) => {
                if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) {
                        return "[Circular]";
                    }
                    seen.add(value);
                }
                return value;
            });
        } catch (e) {
            return "[Unserializable Error]";
        }
    };

    const errorMessage = typeof error === 'string' ? error : (error.message || safeStringify(error));
    const customerStr = customerInfo ? `\n👤 <b>Khách:</b> ${escapeHtml(customerInfo.name)} (${escapeHtml(customerInfo.phone)})` : '';

    const message = `
<b>⚠️ LỖI HỆ THỐNG (THANH TOÁN/TẠO ĐƠN)</b>
--------------------------------
🛑 <b>Lỗi:</b> <code>${escapeHtml(errorMessage)}</code>
📍 <b>Ngữ cảnh:</b> ${escapeHtml(context)}${customerStr}
⏰ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}

<i>Vui lòng sửa lỗi ngay để không mất đơn hàng.</i>
    `.trim();

    await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);
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
