
import { FrameConfig, FrameOption, LegoPart, Order } from '../types';
import { FRAME_OPTIONS } from '../constants';

export const CHARACTER_BASE_PRICE = 10000;
export const FREE_SHIPPING_THRESHOLD = 349000;

// Helper: Get effective price checking sale conditions
export const getEffectivePrice = (item: { price: number, salePrice?: number, saleEndDate?: string }) => {
    // If salePrice exists and is lower than regular price
    if (item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.price) {
        // If there's an end date, check if it's still valid
        if (item.saleEndDate) {
            const now = new Date();
            const end = new Date(item.saleEndDate);
            // End date set to end of that day
            end.setHours(23, 59, 59, 999);
            
            if (now <= end) {
                return item.salePrice;
            }
        } else {
            // No end date means indefinite sale
            return item.salePrice;
        }
    }
    return item.price;
};

export const calculatePrice = (config: FrameConfig, allParts: Record<string, LegoPart>, frames: FrameOption[]) => {
    const breakdown: {label: string, value: number}[] = [];
    const frame = frames.find(f => f.id === config.frameId) || frames[0] || FRAME_OPTIONS[0];
    
    // Use Effective Price for Frame
    const framePrice = getEffectivePrice(frame);
    let total = framePrice;
    breakdown.push({ label: `Khung ${frame.name}`, value: framePrice });

    if(config.characters.length > 0) { const val = config.characters.length * CHARACTER_BASE_PRICE; total += val; breakdown.push({ label: `${config.characters.length} nhân vật`, value: val}); }
    
    config.characters.forEach((char, index) => {
        const customPrint = char.customPrintPrice || 0;
        if(customPrint > 0) {
            total += customPrint;
            breakdown.push({ label: `NV ${index + 1} - In yêu cầu`, value: customPrint });
        }
    });

    // Use Effective Price for Parts
    const hairPrice = config.characters.reduce((acc, char) => acc + (char.hair ? getEffectivePrice(char.hair) : 0) + (char.selectedHairColor?.price || 0), 0);
    if(hairPrice > 0) { breakdown.push({ label: 'Tóc & Màu', value: hairPrice }); total += hairPrice; }

    const hatPrice = config.characters.reduce((acc, char) => acc + (char.hat ? getEffectivePrice(char.hat) : 0), 0) +
                     config.draggableItems.filter(i => i.type === 'hat').reduce((acc, item) => acc + (allParts[item.partId] ? getEffectivePrice(allParts[item.partId]) : 0), 0);
    
    if(hatPrice > 0) { breakdown.push({ label: 'Mũ', value: hatPrice }); total += hatPrice; }

    const shirtBasePrice = config.characters.reduce((acc, char) => acc + (char.shirt ? getEffectivePrice(char.shirt) : 0), 0);
    const shirtColorPrice = config.characters.reduce((acc, char) => acc + (char.selectedShirtColor?.price || 0), 0);
    const totalShirtPrice = shirtBasePrice + shirtColorPrice;
    if(totalShirtPrice > 0) { 
        total += totalShirtPrice; 
        breakdown.push({ label: 'Áo & Màu', value: totalShirtPrice }); 
    }

    const pantsBasePrice = config.characters.reduce((acc, char) => acc + (char.pants ? getEffectivePrice(char.pants) : 0), 0);
    const pantsColorPrice = config.characters.reduce((acc, char) => acc + (char.selectedPantsColor?.price || 0), 0);
    const totalPantsPrice = pantsBasePrice + pantsColorPrice;
    if(totalPantsPrice > 0) { 
        total += totalPantsPrice; 
        breakdown.push({ label: 'Quần & Màu', value: totalPantsPrice }); 
    }

    const accessoryPrice = config.draggableItems.filter(i => i.type === 'accessory').reduce((acc, item) => acc + (allParts[item.partId] ? getEffectivePrice(allParts[item.partId]) : 0) + (item.selectedColor?.price || 0), 0);
    if(accessoryPrice > 0) { total += accessoryPrice; breakdown.push({ label: 'Phụ kiện', value: accessoryPrice }); }
    
    const petPrice = config.draggableItems.filter(i => i.type === 'pet').reduce((acc, item) => acc + (allParts[item.partId] ? getEffectivePrice(allParts[item.partId]) : 0) + (item.selectedColor?.price || 0), 0);
    if(petPrice > 0) { total += petPrice; breakdown.push({ label: 'Thú cưng', value: petPrice }); }

    return { totalPrice: total, priceBreakdown: breakdown };
};

export const formatCurrency = (amount: number, context: 'price' | 'payment' | 'admin' = 'price') => {
  if (amount === 0) {
      if (context === 'price') return 'Miễn phí';
      // For payment/admin/input contexts, we want to show 0 ₫ explicitly
      return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const calculateOrderTotal = (order: Order, allParts: LegoPart[], frames: FrameOption[]) => {
    let subtotal = 0;
    // Tạo map để tra cứu nhanh
    const partLookup = allParts.reduce((acc, p) => ({...acc, [p.id]: p}), {} as Record<string, LegoPart>);

    order.items.forEach(item => {
        const { totalPrice } = calculatePrice(item, partLookup, frames);
        subtotal += totalPrice * (item.quantity || 1);
    });

    const giftBoxFee = order.addGiftBox ? 30000 : 0;
    const shippingFee = order.shipping.fee || 0;
    const discount = order.discountAmount || 0;

    return Math.max(0, subtotal + giftBoxFee + shippingFee - discount);
};
