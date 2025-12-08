
import { FrameConfig, FrameOption, LegoPart, Order } from '../types';
import { FRAME_OPTIONS } from '../constants';

export const CHARACTER_BASE_PRICE = 10000;
export const FREE_SHIPPING_THRESHOLD = 349000;

// Helper: Get effective price checking sale conditions
export const getEffectivePrice = (item: { price: number, salePrice?: number, saleEndDate?: string }) => {
    if (!item) return 0;
    
    const price = Number(item.price) || 0;
    const salePrice = Number(item.salePrice);

    // If salePrice exists, is valid number, and is lower than regular price
    if (item.salePrice !== undefined && item.salePrice !== null && !isNaN(salePrice) && salePrice < price) {
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
            // Check if this part actually costs extra (base parts might be 0 or high price)
            // Logic: If effective price > 0, we list it.
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

    // 4. DRAGGABLE ITEMS (Accessories, Pets, Hats)
    config.draggableItems.forEach((item) => {
        if (item.type === 'charm') return; // Charms are usually free or handled differently

        const part = allParts[item.partId];
        if (part) {
            const effPrice = getEffectivePrice(part);
            const colorPrice = item.selectedColor?.price || 0;
            
            // Add Base Item Price
            if (effPrice > 0) {
                total += effPrice;
                breakdown.push({
                    label: part.name,
                    value: effPrice,
                    originalValue: part.price > effPrice ? part.price : undefined,
                    details: part.type === 'pet' ? 'Thú cưng' : 'Phụ kiện'
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
