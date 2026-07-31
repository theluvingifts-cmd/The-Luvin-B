
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

// Helper: Check if a part is truly out of stock (accounting for colors)
export const isPartOutOfStock = (part: LegoPart | undefined) => {
    if (!part) return false;
    
    // If it has colors, it is out of stock only if ALL colors that have stock tracking are <= 0
    if (part.colors && part.colors.length > 0) {
        return part.colors.every(c => c.stock !== undefined && c.stock !== null && Number(c.stock) <= 0);
    }
    
    // If stock is not tracked (undefined or null), it's considered in stock
    if (part.stock === undefined || part.stock === null) return false;
    
    return Number(part.stock) <= 0;
};

// Helper: Get display image (first in-stock color or default)
export const getPartImageUrl = (part: LegoPart | undefined) => {
    if (!part) return '';
    
    // If it has colors, try to find the first one that is NOT out of stock
    if (part.colors && part.colors.length > 0) {
        const firstInStockColor = part.colors.find(c => c.stock === undefined || c.stock === null || c.stock > 0);
        if (firstInStockColor) {
            return firstInStockColor.imageUrl || part.imageUrl;
        }
    }
    
    return part.imageUrl;
};

export const calculatePrice = (config: FrameConfig, allParts: Record<string, LegoPart>, frames: FrameOption[], templates?: CollectionTemplate[], explicitTemplateId?: string, storeConfig?: any): { totalPrice: number, priceBreakdown: PriceBreakdownItem[] } => {
    const breakdown: PriceBreakdownItem[] = [];
    let total = 0;

    // 1. FRAME PRICE
    let baseItem: { name: string, price: number, salePrice?: number, saleEndDate?: string, description?: string } | undefined;
    
    if (config.frameId === 'accessory-only') {
        baseItem = { name: 'Linh kiện / dịch vụ lẻ', price: 0, description: 'Mua lẻ phụ kiện, charm hoặc dịch vụ' };
    } else {
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
    }

    const isBaseOOS = (baseItem as any).stock !== undefined && (baseItem as any).stock !== null && (baseItem as any).stock <= 0;
    const baseEffective = isBaseOOS ? 0 : getEffectivePrice(baseItem as any);
    total += baseEffective;
    
    breakdown.push({ 
        label: baseItem.name, 
        value: baseEffective,
        originalValue: (baseItem.price && baseItem.price > baseEffective) ? baseItem.price : (isBaseOOS ? baseItem.price : undefined),
        isBase: true,
        details: isBaseOOS ? 'Hết hàng (0 ₫)' : baseItem.description
    });

    // 1.1 GALLERY OPTIONS (PHOTO & LIGHTS)
    if (config.productLine === 'gallery') {
        const assembly = config.galleryOptions?.assembly || 'diy';

        // Shop Surcharge for Gallery (Added only if customer chooses shop assembly)
        if (assembly === 'pre-assembled') {
            let gallerySurcharge = 70000;
            if (storeConfig && typeof storeConfig.museumSurcharge === 'number') {
                gallerySurcharge = storeConfig.museumSurcharge;
            } else {
                try {
                    const cached = typeof window !== 'undefined' ? (localStorage.getItem('store_config') || localStorage.getItem('store_config_cache')) : null;
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (parsed && typeof parsed.museumSurcharge === 'number') {
                            gallerySurcharge = parsed.museumSurcharge;
                        }
                    }
                } catch (e) {}
            }
            total += gallerySurcharge;
            breakdown.push({
                label: 'Shop lắp hoàn thiện',
                value: gallerySurcharge,
                details: 'Phụ phí lắp đặt & đóng gói'
            });
        }

        if (config.galleryOptions) {
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
            
            // If part is out of stock, it should be $0 in price breakdown
            if (isPartOutOfStock(latestPart)) {
                breakdown.push({
                    label: `${part.name} ${charLabel}`,
                    value: 0,
                    originalValue: latestPart.price,
                    details: 'Hết hàng (0 ₫)'
                });
                return;
            }

            let effPrice = getEffectivePrice(latestPart);
            
            // CUSTOM RULE: for Gallery line, only 'hair', 'accessory' (charms), and 'set' (outfits) are NOT $0.
            // Other parts like shirt, pants, face, hat are $0 for Gallery.
            if (isGallery && !['hair', 'accessory', 'set'].includes(type)) {
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
            const isColorOOS = char.selectedShirtColor.stock !== undefined && char.selectedShirtColor.stock !== null && Number(char.selectedShirtColor.stock) <= 0;
            if (isColorOOS) {
                breakdown.push({ label: `Màu áo: ${char.selectedShirtColor.name} ${charLabel}`, value: 0, originalValue: char.selectedShirtColor.price, details: 'Hết hàng (0 ₫)' });
            } else {
                total += char.selectedShirtColor.price;
                breakdown.push({ label: `Màu áo: ${char.selectedShirtColor.name} ${charLabel}`, value: char.selectedShirtColor.price });
            }
        }
        if (char.selectedPantsColor && char.selectedPantsColor.price > 0 && !isGallery) {
            const isColorOOS = char.selectedPantsColor.stock !== undefined && char.selectedPantsColor.stock !== null && Number(char.selectedPantsColor.stock) <= 0;
            if (isColorOOS) {
                breakdown.push({ label: `Màu quần: ${char.selectedPantsColor.name} ${charLabel}`, value: 0, originalValue: char.selectedPantsColor.price, details: 'Hết hàng (0 ₫)' });
            } else {
                total += char.selectedPantsColor.price;
                breakdown.push({ label: `Màu quần: ${char.selectedPantsColor.name} ${charLabel}`, value: char.selectedPantsColor.price });
            }
        }
        if (char.selectedHairColor && char.selectedHairColor.price > 0) {
            const isColorOOS = char.selectedHairColor.stock !== undefined && char.selectedHairColor.stock !== null && Number(char.selectedHairColor.stock) <= 0;
            if (isColorOOS) {
                breakdown.push({ label: `Màu tóc: ${char.selectedHairColor.name} ${charLabel}`, value: 0, originalValue: char.selectedHairColor.price, details: 'Hết hàng (0 ₫)' });
            } else {
                total += char.selectedHairColor.price;
                breakdown.push({ label: `Màu tóc: ${char.selectedHairColor.name} ${charLabel}`, value: char.selectedHairColor.price });
            }
        }
        if (char.selectedHatColor && char.selectedHatColor.price > 0 && !isGallery) {
            const isColorOOS = char.selectedHatColor.stock !== undefined && char.selectedHatColor.stock !== null && Number(char.selectedHatColor.stock) <= 0;
            if (isColorOOS) {
                breakdown.push({ label: `Màu mũ: ${char.selectedHatColor.name} ${charLabel}`, value: 0, originalValue: char.selectedHatColor.price, details: 'Hết hàng (0 ₫)' });
            } else {
                total += char.selectedHatColor.price;
                breakdown.push({ label: `Màu mũ: ${char.selectedHatColor.name} ${charLabel}`, value: char.selectedHatColor.price });
            }
        }
        if (char.selectedSetColor && char.selectedSetColor.price > 0 && !isGallery) {
            const isColorOOS = char.selectedSetColor.stock !== undefined && char.selectedSetColor.stock !== null && Number(char.selectedSetColor.stock) <= 0;
            if (isColorOOS) {
                breakdown.push({ label: `Màu bộ đồ: ${char.selectedSetColor.name} ${charLabel}`, value: 0, originalValue: char.selectedSetColor.price, details: 'Hết hàng (0 ₫)' });
            } else {
                total += char.selectedSetColor.price;
                breakdown.push({ label: `Màu bộ đồ: ${char.selectedSetColor.name} ${charLabel}`, value: char.selectedSetColor.price });
            }
        }
    });

    // 4. DRAGGABLE ITEMS
    const draggables = Array.isArray(config.draggableItems) ? config.draggableItems : [];
    const partCounts: Record<string, number> = {};
    draggables.forEach((item) => {
        if (item && item.partId) {
            partCounts[item.partId] = (partCounts[item.partId] || 0) + 1;
        }
    });

    draggables.forEach((item) => {
        if (!item) return;
        const part = allParts[item.partId];
        if (part) {
            // If part is out of stock, it should be $0 in price breakdown
            if (isPartOutOfStock(part)) {
                breakdown.push({
                    label: part.name,
                    value: 0,
                    originalValue: part.price,
                    details: 'Hết hàng (0 ₫)'
                });
                return;
            }

            const quantity = partCounts[item.partId] || 1;
            const effPrice = getEffectivePrice(part, quantity, part.bulkPricing);
            const colorPrice = item.selectedColor?.price || 0;
            const isColorOOS = item.selectedColor?.stock !== undefined && item.selectedColor?.stock !== null && Number(item.selectedColor.stock) <= 0;

            if (effPrice > 0) {
                total += effPrice;
                breakdown.push({
                    label: part.name,
                    value: effPrice,
                    originalValue: part.price > effPrice ? part.price : undefined,
                    details: (part.price > effPrice) ? `Giá Combo (SL: ${quantity})` : (part.type === 'pet' ? 'Thú cưng' : (part.type === 'hat' ? 'Mũ' : 'Phụ kiện'))
                });
            }

            if (isColorOOS) {
                breakdown.push({ 
                    label: `Màu: ${item.selectedColor?.name} (${part.name})`, 
                    value: 0, 
                    originalValue: colorPrice, 
                    details: 'Hết hàng (0 ₫)' 
                });
            } else if (colorPrice > 0) {
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
    const totalQuantityForGiftBox = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const legoQuantity = order.items
        .filter(item => (item.productLine || 'lego') === 'lego')
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    const giftBoxFee = order.addGiftBox ? 30000 * totalQuantityForGiftBox : 0;
    const lightFee = order.addLight ? 50000 * legoQuantity : 0;
    const polaroidFee = Number(order.addPolaroid) === 2 ? 15000 : Number(order.addPolaroid) === 4 ? 25000 : 0;
    const shippingFee = order.shipping.fee || 0;
    const discount = order.discountAmount || 0;
    return Math.max(0, subtotal + giftBoxFee + lightFee + polaroidFee + shippingFee - discount);
};
