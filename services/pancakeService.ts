
import { Order, LegoPart, FrameOption } from '../types';
import { StoreConfig } from './configService';
import { FRAME_OPTIONS } from '../constants';
import { calculatePrice } from '../utils/pricing';

/**
 * Pushes an order to Pancake POS via API
 * @param order The order object to push
 * @param config The store configuration containing Pancake credentials
 * @param allParts All lego parts for price calculation
 * @param frames All frames for price calculation
 * @returns { success: boolean, data?: any, error?: string }
 */
export const pushOrderToPancake = async (
    order: Order, 
    config: StoreConfig,
    allParts: Record<string, LegoPart>,
    frames: FrameOption[]
) => {
    if (!config.pancakeAccessToken || !config.pancakeShopId) {
        return { success: false, error: "Chưa cấu hình Pancake Access Token hoặc Shop ID." };
    }

    try {
        // Clean token
        const cleanToken = config.pancakeAccessToken.trim();
        const shopIdNum = config.pancakeShopId.trim();

        // 1. Prepare Customer Data
        const customerPayload = {
            name: order.customer.name || "Khách lẻ",
            phone_number: order.customer.phone,
            address: order.customer.address || "",
        };

        // 2. Prepare Items Data
        const itemsPayload = order.items.map(item => {
            const { totalPrice } = calculatePrice(item, allParts, frames);
            
            const frame = frames.find(f => f.id === item.frameId) || FRAME_OPTIONS[0];
            const charCount = item.characters.length;
            const itemDescription = `${frame.name} - ${charCount} NV${item.background.type === 'upload' ? ' (Nền tự tải)' : ''}`;

            return {
                variation_info: {
                    name: `Khung LEGO ${itemDescription}`,
                    retail_price: totalPrice,
                },
                quantity: item.quantity || 1,
                price: totalPrice,
                is_wholesale: false
            };
        });

        // Add Gift Box
        if (order.addGiftBox) {
            itemsPayload.push({
                variation_info: {
                    name: "Hộp quà cao cấp",
                    retail_price: 30000,
                },
                quantity: 1,
                price: 30000,
                is_wholesale: false
            });
        }

        // 3. Prepare Order Payload
        const payload = {
            shop_id: parseInt(shopIdNum),
            partner_id: order.id,
            customer: customerPayload,
            items: itemsPayload,
            note: order.delivery.notes || "",
            shipping_fee: order.shipping.fee || 0,
            discount_amount: order.discountAmount || 0,
            cod_amount: order.amountToPay,
            order_status_id: 1, // New
        };

        // 4. Send Request
        // Using correct endpoint structure: /api/v1/shops/{shop_id}/orders
        const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopIdNum}/orders?access_token=${cleanToken}`;

        console.log("Pushing to Pancake:", endpoint, payload);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Safely handle non-JSON responses (like 404 HTML pages)
        const textResponse = await response.text();
        let result;
        
        try {
            result = JSON.parse(textResponse);
        } catch (e) {
            console.error("Invalid JSON from Pancake:", textResponse);
            return { 
                success: false, 
                error: `Lỗi kết nối Pancake (${response.status}): ${textResponse.includes('Page not found') ? 'Sai đường dẫn API' : textResponse.substring(0, 100)}` 
            };
        }

        if (response.ok && result.success) {
            return { success: true, data: result.order_id || result.data?.id };
        } else {
            console.error("Pancake API Error Response:", result);
            return { success: false, error: result.message || JSON.stringify(result) };
        }

    } catch (error: any) {
        console.error("Pancake Push Exception:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Tests connection to Pancake POS API
 */
export const testPancakeConnection = async (accessToken: string, shopId: string) => {
    try {
        const cleanToken = accessToken.trim();
        // Using GET request to list orders is a safe read-only check
        const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}/orders?access_token=${cleanToken}&page_number=1&page_size=1`;
        
        const response = await fetch(endpoint);
        const textResponse = await response.text();
        let data;

        try {
            data = JSON.parse(textResponse);
        } catch (e) {
             return { success: false, error: `Phản hồi không hợp lệ (${response.status})` };
        }
        
        if (response.ok && data.success) {
            return { success: true };
        } else {
            return { success: false, error: data.message || "Kết nối thất bại. Kiểm tra lại Token/Shop ID." };
        }
    } catch (error: any) {
        console.error("Pancake Connection Error:", error);
        return { success: false, error: error.message };
    }
};
