
import { FrameConfig, FrameOption, LegoPart, Order } from '../types';
import { FRAME_OPTIONS } from '../constants';

export const CHARACTER_BASE_PRICE = 10000;
export const FREE_SHIPPING_THRESHOLD = 349000;

// Helper: Get effective price checking sale conditions
export const getEffectivePrice = (item: { price: number, isOnSale?: boolean, salePrice?: number, saleEndDate?: string }, quantity: number = 1, bulkPricing?: { quantity: number, price: number }[]) => {
    if (!item) return 0;
    
    const price = Number(item.price) || 0;
    
    // 1. Check Bulk Pricing first (Highest Priority)
    if (bulkPricing && bulkPricing.length > 0) {
        // Sort tiers descending (highest quantity first)
        const sortedTiers = [...bulkPricing].sort((a, b) => b.quantity - a.quantity);
        const applicableTier = sortedTiers.find(tier => quantity >= tier.quantity);
        if (applicableTier) {
            return applicableTier.price;
        }
    }

    // 2. Check Sale Price (Must be ON SALE explicitly)
    if (item.isOnSale) {
        const salePrice = Number(item.salePrice);
        if (item.salePrice !== undefined && item.salePrice !== null && !isNaN(salePrice)) {
            // If there's an end date, check if it's still valid
            if (item.saleEndDate) {
                const now = new Date();
                const end = new Date(item.saleEndDate);
                // End date set to end of that day
                end.setHours(23, 59, 59, 999);
                
                if (now <= end) {
                    return salePrice;
                }
            } else {
                // No end date means indefinite sale
                return salePrice;
            }
        }
    }
    
    return price;
};

export interface PriceBreakdownItem {
    label: string;
    value: number;
    originalValue?: number; // To show strikethrough if on sale
    isBase?: boolean; // True if it's a base cost (Frame, Char Fee)
    details?: string; // Optional subtitle
}

export const calculatePrice = (config: FrameConfig, allParts: Record<string, LegoPart>, frames: FrameOption[]) => {
    const breakdown: PriceBreakdownItem[] = [];
    let total = 0;

    // 1. FRAME PRICE
    const frame = frames.find(f => f.id === config.frameId) || frames[0] || FRAME_OPTIONS[0];
    const frameEffective = getEffectivePrice(frame);
    total += frameEffective;
    
    breakdown.push({ 
        label: `Khung ${frame.name}`, 
        value: frameEffective,
        originalValue: frame.price > frameEffective ? frame.price : undefined,
        isBase: true,
        details: frame.description
    });

    // 2. CHARACTER BASE FEE (Fixed Price)
    const charCount = config.characters.length;
    if(charCount > 0) { 
        const charFee = charCount * CHARACTER_BASE_PRICE; 
        total += charFee; 
        breakdown.push({ 
            label: `Phí nhân vật (${charCount})`, 
            value: charFee,
            isBase: true,
            details: `${formatCurrency(CHARACTER_BASE_PRICE)}/NV`
        }); 
    }
    
    // 3. DETAILED PARTS BREAKDOWN
    config.characters.forEach((char, index) => {
        const charLabel = `(NV${index + 1})`;

        // Custom Print
        if (char.customPrintPrice && char.customPrintPrice > 0) {
            total += char.customPrintPrice;
            breakdown.push({ label: `In mặt riêng ${charLabel}`, value: char.customPrintPrice });
        }

        // Helper to add part cost
        const addPartCost = (part: LegoPart | undefined, typeLabel: string) => {
            if (!part) return;
            // Character parts usually don't have bulk pricing logic relative to quantity in single frame in the same way accessories do
            // But we keep the function signature compatible
            const effPrice = getEffectivePrice(part);
            if (effPrice > 0) {
                total += effPrice;
                breakdown.push({
                    label: `${part.name} ${charLabel}`,
                    value: effPrice,
                    originalValue: part.price > effPrice ? part.price : undefined,
                    details: typeLabel
                });
            }
        };

        addPartCost(char.hair, 'Tóc');
        addPartCost(char.hat, 'Mũ');
        addPartCost(char.shirt, 'Áo');
        addPartCost(char.pants, 'Quần');
        addPartCost(char.face, 'Mặt'); // Usually 0 but just in case

        // Color Upgrades (Check if selected color has a price)
        if (char.selectedShirtColor && char.selectedShirtColor.price > 0) {
            total += char.selectedShirtColor.price;
            breakdown.push({
                label: `Màu áo: ${char.selectedShirtColor.name} ${charLabel}`,
                value: char.selectedShirtColor.price,
                details: 'Nâng cấp màu'
            });
        }
        if (char.selectedPantsColor && char.selectedPantsColor.price > 0) {
            total += char.selectedPantsColor.price;
            breakdown.push({
                label: `Màu quần: ${char.selectedPantsColor.name} ${charLabel}`,
                value: char.selectedPantsColor.price,
                details: 'Nâng cấp màu'
            });
        }
        if (char.selectedHairColor && char.selectedHairColor.price > 0) {
            total += char.selectedHairColor.price;
            breakdown.push({
                label: `Màu tóc: ${char.selectedHairColor.name} ${charLabel}`,
                value: char.selectedHairColor.price,
                details: 'Nâng cấp màu'
            });
        }
    });

    // 4. DRAGGABLE ITEMS (Accessories, Pets, Hats) - WITH BULK PRICING LOGIC
    
    // First, count occurrences of each part to apply bulk discounts correctly
    const partCounts: Record<string, number> = {};
    config.draggableItems.forEach((item) => {
        if (item.type !== 'charm' && item.partId) {
            partCounts[item.partId] = (partCounts[item.partId] || 0) + 1;
        }
    });

    // We need to group items in breakdown to show bulk price nicely, 
    // OR list them individually but with the discounted price applied.
    // Listing individually is safer for the UI loop, but price depends on total count.
    
    config.draggableItems.forEach((item) => {
        if (item.type === 'charm') return; 

        const part = allParts[item.partId];
        if (part) {
            const quantity = partCounts[item.partId] || 1;
            const effPrice = getEffectivePrice(part, quantity, part.bulkPricing);
            const colorPrice = item.selectedColor?.price || 0;
            
            // Add Base Item Price
            if (effPrice > 0) {
                total += effPrice;
                
                // Determine if a bulk discount was applied
                const isBulkApplied = part.price > effPrice && part.bulkPricing && part.bulkPricing.length > 0;
                
                breakdown.push({
                    label: part.name,
                    value: effPrice,
                    originalValue: part.price > effPrice ? part.price : undefined,
                    details: isBulkApplied 
                        ? `Giá Combo (SL: ${quantity})` 
                        : (part.type === 'pet' ? 'Thú cưng' : 'Phụ kiện')
                });
            }

            // Add Color Surcharge Separately
            if (colorPrice > 0) {
                total += colorPrice;
                breakdown.push({
                    label: `Màu: ${item.selectedColor?.name || 'Màu đặc biệt'} (${part.name})`,
                    value: colorPrice,
                    details: 'Phụ phí màu'
                });
            }
        }
    });

    return { totalPrice: total, priceBreakdown: breakdown };
};

export const formatCurrency = (amount: number, context: 'price' | 'payment' | 'admin' = 'price') => {
  if (amount === 0) {
      if (context === 'price') return 'Miễn phí';
      return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const calculateOrderTotal = (order: Order, allParts: Record<string, LegoPart>, frames: FrameOption[]) => {
    let subtotal = 0;
    
    order.items.forEach(item => {
        const { totalPrice } = calculatePrice(item, allParts, frames);
        subtotal += totalPrice * (item.quantity || 1);
    });

    const giftBoxFee = order.addGiftBox ? 30000 : 0;
    const shippingFee = order.shipping.fee || 0;
    const discount = order.discountAmount || 0;

    return Math.max(0, subtotal + giftBoxFee + shippingFee - discount);
};