
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
        // 1. Prepare Customer Data
        const customerPayload = {
            name: order.customer.name,
            phone_number: order.customer.phone,
            address: order.customer.address,
        };

        // 2. Prepare Items Data
        // Pancake usually expects an array of items. 
        // Since our items are highly customized, we will create "Custom Items".
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

        // Add Gift Box as an item if applicable
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
        // Note: This matches common Pancake POS API structure. 
        // Verify with actual documentation: https://docs.pancake.vn/pos/
        const payload = {
            shop_id: config.pancakeShopId,
            partner_id: order.id, // Use our order ID as partner reference
            customer: customerPayload,
            items: itemsPayload,
            note: order.delivery.notes || "",
            shipping_fee: order.shipping.fee || 0,
            discount_amount: order.discountAmount || 0,
            // If COD, cod_amount should be the amount to pay
            cod_amount: order.amountToPay,
            order_status_id: 1, // Usually 1 is "New" or "Pending"
        };

        // 4. Send Request
        // Endpoint structure: https://pos.pages.fm/api/v1/shops/{shop_id}/orders?access_token={token}
        const endpoint = `https://pos.pages.fm/api/v1/shops/${config.pancakeShopId}/orders?access_token=${config.pancakeAccessToken}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            return { success: true, data: result.order_id || result.data?.id };
        } else {
            console.error("Pancake API Error:", result);
            return { success: false, error: result.message || JSON.stringify(result) };
        }

    } catch (error: any) {
        console.error("Pancake Push Error:", error);
        return { success: false, error: error.message };
    }
};
