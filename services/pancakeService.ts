import { StoreConfig } from './configService';

export interface PancakeOrderData {
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    customer_province?: string;
    customer_district?: string;
    customer_ward?: string;
    note?: string;
    products: {
        name: string;
        quantity: number;
        price: number;
        sku?: string;
        variation_info?: string;
    }[];
    total_price: number;
    discount_amount?: number;
    shipping_fee?: number;
}

export const pushOrderToPancake = async (config: StoreConfig, orderData: PancakeOrderData) => {
    if (!config.enablePancakePush || !config.pancakeShopId || !config.pancakeAccessToken) {
        console.log('Pancake push is disabled or not configured.');
        return null;
    }

    const url = `https://pos.pancake.vn/api/v1/shops/${config.pancakeShopId}/orders?access_token=${config.pancakeAccessToken}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
        });

        const result = await response.json();
        console.log('Pancake POS Response:', result);
        return result;
    } catch (error) {
        console.error('Error pushing order to Pancake POS:', error);
        return null;
    }
};
