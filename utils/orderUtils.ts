
import { CollectionTemplate } from '../types';

export interface OrderCountable {
    fakeOrderCount?: number;
    purchaseCount?: number;
    realOrderCount?: number;
    orders?: number;
}

/**
 * Calculates the total display order count for a template or part.
 * Total = Virtual (seed/fake) orders + Actual real orders
 * 
 * @param item The collection template or part
 * @returns number Total orders to display
 */
export const getDisplayOrderCount = (item: OrderCountable): number => {
    // Virtual orders: prioritize fakeOrderCount, fallback to purchaseCount
    const virtualOrders = Number(item.fakeOrderCount ?? item.purchaseCount ?? 0);
    
    // Real orders: prioritize the maximum of realOrderCount and orders (legacy field)
    const realOrders = Math.max(Number(item.realOrderCount || 0), Number(item.orders || 0));
    
    return virtualOrders + realOrders;
};

/**
 * Formats the order count number with local separators
 * @param count The number of orders
 * @returns string Formatted number (e.g. "1,000" or "1.000")
 */
export const formatOrderNumber = (count: number): string => {
    return count.toLocaleString('vi-VN');
};
