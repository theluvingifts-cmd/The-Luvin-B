
import { FrameConfig, FrameOption, LegoPart, Order, CollectionTemplate } from '../types';
import { FRAME_OPTIONS } from '../constants';

export const CHARACTER_BASE_PRICE = 10000;
export const FREE_SHIPPING_THRESHOLD = 349000;

// Helper: Get effective price checking sale conditions
export const getEffectivePrice = (item: { price: number, salePrice?: number, saleEndDate?: string }, quantity: number = 1, bulkPricing?: { quantity: number, price: number }[]) => {
    if (!item) return 0;
    
    const price = Number(item.price) || 0;
    
    // 1. Check Bulk Pricing first
    if (bulkPricing && bulkPricing.length > 0) {
        const sortedTiers = [...bulkPricing].sort((a, b) => b.quantity - a.quantity);
        const applicableTier = sortedTiers.find(tier => quantity >= tier.quantity);
        if (applicableTier) return applicableTier.price;
    }

    // 2. Check Sale Price
    const salePrice = Number(item.salePrice);
    if (item.salePrice !== undefined && item.salePrice !== null && !isNaN(salePrice) && salePrice < price) {
        if (item.saleEndDate) {
            const now = new Date();
            const end = new Date(item.saleEndDate);
            end.setHours(23, 59, 59, 999);
            if (now <= end) return salePrice;
        } else {
            return salePrice;
        }
    }
    return price;
};

export interface PriceBreakdownItem {
    label: string;
    value: number;
    originalValue?: number;
    isBase?: boolean;
    details?: string;
}

export const formatCurrency = (amount: number, context: 'price' | 'payment' | 'admin' = 'price') => {
  if (amount === 0) {
      if (context === 'price') return 'Miễn phí';
      return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const calculatePrice = (config: FrameConfig, allParts: Record<string, LegoPart>, frames: FrameOption[], templates?: CollectionTemplate[], explicitTemplateId?: string): { totalPrice: number, priceBreakdown: PriceBreakdownItem[] } => {
    const breakdown: PriceBreakdownItem[] = [];
    let total = 0;

    // 1. FRAME PRICE
    let baseItem: { name: string, price: number, salePrice?: number, saleEndDate?: string, description?: string } | undefined;
    
    // Primary: Find by config.frameId in frames
    baseItem = (frames && frames.length > 0) ? frames.find(f => f.id === config.frameId) : undefined;
    
    // Default to FRAME_OPTIONS if still not found in dynamic frames
    if (!baseItem && config.frameId) {
        baseItem = FRAME_OPTIONS.find(f => f.id === config.frameId);
    }

    // Default to first frame if still not found
    if (!baseItem) {
        // Find best match by product line
        const lineFrames = (frames && frames.length > 0) ? frames.filter(f => (f.supportedProductLines || ['lego']).includes(config.productLine || 'lego')) : [];
        baseItem = lineFrames[0] || frames[0] || FRAME_OPTIONS[0];
    }

    const baseEffective = getEffectivePrice(baseItem as any);
    total += baseEffective;
    
    breakdown.push({ 
        label: baseItem.name, 
        value: baseEffective,
        originalValue: (baseItem.price && baseItem.price > baseEffective) ? baseItem.price : undefined,
        isBase: true,
        details: baseItem.description
    });

    // 1.1 GALLERY OPTIONS (PHOTO & LIGHTS)
    if (config.productLine === 'gallery' && config.galleryOptions) {
        const { photoFrameCount, lightCount } = config.galleryOptions;
        
        // Fee per photo frame (Fixed to 0 for Gallery as requested)
        if (photoFrameCount && photoFrameCount > 0) {
            const photoPrice = 0; 
            total += photoPrice;
            breakdown.push({
                label: `Khung ảnh (${photoFrameCount} khung)`,
                value: photoPrice,
                details: ' Gallery (Miễn phí)'
            });
        }
        
        // Fee per light (Fixed to 0 for Gallery as requested)
        if (lightCount && lightCount > 0) {
            const lightPrice = 0;
            total += lightPrice;
            breakdown.push({
                label: `Đèn LED (${lightCount} bóng)`,
                value: lightPrice,
                details: ' Gallery (Miễn phí)'
            });
        }
    }

    // 2. CHARACTER BASE FEE
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
        const isGallery = config.productLine === 'gallery';
        
        if (char.customPrintOption && char.customPrintOption !== 'none') {
            const printPrice = char.customPrintPrice || (char.customPrintOption === 'premium' ? 300000 : 100000);
            total += printPrice;
            breakdown.push({ 
                label: `In theo yêu cầu ${char.customPrintOption === 'premium' ? '(Cao cấp)' : '(Thường)'} ${charLabel}`, 
                value: printPrice 
            });
        } else if (char.customPrintPrice && char.customPrintPrice > 0) {
            total += char.customPrintPrice;
            breakdown.push({ label: `In mặt riêng ${charLabel}`, value: char.customPrintPrice });
        }

        const addPartCost = (part: LegoPart | undefined, typeLabel: string, type: string) => {
            if (!part) return;
            
            // Try to get fresh price from allParts if available
            const latestPart = (allParts && part.id && allParts[part.id]) ? allParts[part.id] : part;
            let effPrice = getEffectivePrice(latestPart);
            
            // CUSTOM RULE: for Gallery line, only 'hair' and 'accessory' (charms) are NOT $0.
            // Other parts like shirt, pants, face, hat, set are $0 for Gallery.
            if (isGallery && !['hair', 'accessory'].includes(type)) {
                effPrice = 0;
            }

            if (effPrice > 0 || (isGallery && effPrice === 0 && ['shirt', 'pants', 'face', 'hat', 'set'].includes(type))) {
                total += effPrice;
                breakdown.push({
                    label: `${part.name} ${charLabel}`,
                    value: effPrice,
                    originalValue: (part.price > effPrice && effPrice > 0) ? part.price : undefined,
                    details: isGallery && effPrice === 0 ? `${typeLabel} (Gallery)` : typeLabel
                });
            }
        };

        addPartCost(char.hair, 'Tóc', 'hair');
        addPartCost(char.hat, 'Mũ', 'hat');
        addPartCost(char.shirt, 'Áo', 'shirt');
        addPartCost(char.pants, 'Quần', 'pants');
        addPartCost(char.set, 'Bộ đồ', 'set');
        addPartCost(char.face, 'Mặt', 'face');

        if (char.selectedShirtColor && char.selectedShirtColor.price > 0 && !isGallery) {
            total += char.selectedShirtColor.price;
            breakdown.push({ label: `Màu áo: ${char.selectedShirtColor.name} ${charLabel}`, value: char.selectedShirtColor.price });
        }
        if (char.selectedPantsColor && char.selectedPantsColor.price > 0 && !isGallery) {
            total += char.selectedPantsColor.price;
            breakdown.push({ label: `Màu quần: ${char.selectedPantsColor.name} ${charLabel}`, value: char.selectedPantsColor.price });
        }
        if (char.selectedHairColor && char.selectedHairColor.price > 0) {
            total += char.selectedHairColor.price;
            breakdown.push({ label: `Màu tóc: ${char.selectedHairColor.name} ${charLabel}`, value: char.selectedHairColor.price });
        }
        if (char.selectedHatColor && char.selectedHatColor.price > 0 && !isGallery) {
            total += char.selectedHatColor.price;
            breakdown.push({ label: `Màu mũ: ${char.selectedHatColor.name} ${charLabel}`, value: char.selectedHatColor.price });
        }
        if (char.selectedSetColor && char.selectedSetColor.price > 0 && !isGallery) {
            total += char.selectedSetColor.price;
            breakdown.push({ label: `Màu bộ đồ: ${char.selectedSetColor.name} ${charLabel}`, value: char.selectedSetColor.price });
        }
    });

    // 4. DRAGGABLE ITEMS
    const partCounts: Record<string, number> = {};
    config.draggableItems.forEach((item) => {
        if (item.partId) {
            partCounts[item.partId] = (partCounts[item.partId] || 0) + 1;
        }
    });

    config.draggableItems.forEach((item) => {
        const part = allParts[item.partId];
        if (part) {
            const quantity = partCounts[item.partId] || 1;
            const effPrice = getEffectivePrice(part, quantity, part.bulkPricing);
            const colorPrice = item.selectedColor?.price || 0;
            if (effPrice > 0) {
                total += effPrice;
                breakdown.push({
                    label: part.name,
                    value: effPrice,
                    originalValue: part.price > effPrice ? part.price : undefined,
                    details: (part.price > effPrice) ? `Giá Combo (SL: ${quantity})` : (part.type === 'pet' ? 'Thú cưng' : (part.type === 'hat' ? 'Mũ' : 'Phụ kiện'))
                });
            }
            if (colorPrice > 0) {
                total += colorPrice;
                breakdown.push({ label: `Màu: ${item.selectedColor?.name} (${part.name})`, value: colorPrice });
            }
        }
    });

    return { totalPrice: total, priceBreakdown: breakdown };
};

export const calculateOrderTotal = (order: Order, allParts: Record<string, LegoPart>, frames: FrameOption[], templates?: CollectionTemplate[]) => {
    let subtotal = 0;
    order.items.forEach(item => {
        const { totalPrice } = calculatePrice(item, allParts, frames, templates);
        subtotal += totalPrice * (item.quantity || 1);
    });
    const giftBoxFee = order.addGiftBox ? 30000 : 0;
    const shippingFee = order.shipping.fee || 0;
    const discount = order.discountAmount || 0;
    return Math.max(0, subtotal + giftBoxFee + shippingFee - discount);
};
