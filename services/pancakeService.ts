
import { Order, LegoPart, FrameOption } from '../types';
import { StoreConfig } from './configService';
import { FRAME_OPTIONS } from '../constants';
import { calculatePrice } from '../utils/pricing';

/**
 * Pushes an order to Pancake POS via Vercel Proxy
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
        const cleanToken = config.pancakeAccessToken.trim();
        const shopIdNum = parseInt(config.pancakeShopId.trim(), 10);

        // 1. Prepare Data
        const customerPayload = {
            name: order.customer.name || "Khách lẻ",
            phone_number: order.customer.phone,
            address: order.customer.address || "",
        };

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

        if (order.addGiftBox) {
            itemsPayload.push({
                variation_info: { name: "Hộp quà cao cấp", retail_price: 30000 },
                quantity: 1,
                price: 30000,
                is_wholesale: false
            });
        }

        const payload = {
            shop_id: shopIdNum,
            partner_id: order.id,
            customer: customerPayload,
            items: itemsPayload,
            note: order.delivery.notes || "",
            shipping_fee: order.shipping.fee || 0,
            discount_amount: order.discountAmount || 0,
            cod_amount: order.amountToPay,
            order_status_id: 1, 
        };

        // 2. Determine Endpoint
        // Creating order usually uses /orders with shop_id in body
        const targetEndpoint = `https://pos.pancake.vn/api/v1/orders?access_token=${cleanToken}`;

        console.log("Pushing via Proxy to:", targetEndpoint);

        // 3. Call Proxy
        const response = await fetch('/api/pancake-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: targetEndpoint,
                method: 'POST',
                payload: payload
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            return { success: true, data: result.order_id || result.data?.id };
        } else {
            console.error("Pancake Proxy Response:", result);
            return { 
                success: false, 
                error: result.message || JSON.stringify(result) 
            };
        }

    } catch (error: any) {
        console.error("Pancake Service Error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Tests connection to Pancake POS API via Proxy
 */
export const testPancakeConnection = async (accessToken: string, shopId: string) => {
    try {
        const cleanToken = accessToken.trim();
        // Use a simpler endpoint to test token validity
        // Note: Checking shop specific orders is a good test of permissions
        const targetEndpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}/orders?access_token=${cleanToken}&page_number=1&page_size=1`;
        
        const response = await fetch('/api/pancake-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: targetEndpoint,
                method: 'GET'
            })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            return { success: true };
        } else {
            return { success: false, error: data.message || "Token hoặc Shop ID không hợp lệ." };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
