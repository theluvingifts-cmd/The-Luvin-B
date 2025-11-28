
import { FrameConfig, FrameOption, LegoPart } from '../types';
import { FRAME_OPTIONS } from '../constants';

export const CHARACTER_BASE_PRICE = 10000;
export const FREE_SHIPPING_THRESHOLD = 349000;

export const calculatePrice = (config: FrameConfig, allParts: Record<string, LegoPart>, frames: FrameOption[]) => {
    const breakdown: {label: string, value: number}[] = [];
    const frame = frames.find(f => f.id === config.frameId) || frames[0] || FRAME_OPTIONS[0];
    let total = frame.price;
    breakdown.push({ label: `Khung ${frame.name}`, value: frame.price });

    if(config.characters.length > 0) { const val = config.characters.length * CHARACTER_BASE_PRICE; total += val; breakdown.push({ label: `${config.characters.length} nhân vật`, value: val}); }
    
    config.characters.forEach((char, index) => {
        const customPrint = char.customPrintPrice || 0;
        if(customPrint > 0) {
            total += customPrint;
            breakdown.push({ label: `NV ${index + 1} - In yêu cầu`, value: customPrint });
        }
    });

    const hairPrice = config.characters.reduce((acc, char) => acc + (char.hair?.price || 0) + (char.selectedHairColor?.price || 0), 0);
    if(hairPrice > 0) { breakdown.push({ label: 'Tóc & Màu', value: hairPrice }); total += hairPrice; }

    const hatPrice = config.draggableItems.filter(i => i.type === 'hat').reduce((acc, item) => acc + (allParts[item.partId]?.price || 0), 0);
    if(hatPrice > 0) { breakdown.push({ label: 'Mũ', value: hatPrice }); total += hatPrice; }

    const shirtBasePrice = config.characters.reduce((acc, char) => acc + (char.shirt?.price || 0), 0);
    const shirtColorPrice = config.characters.reduce((acc, char) => acc + (char.selectedShirtColor?.price || 0), 0);
    const totalShirtPrice = shirtBasePrice + shirtColorPrice;
    if(totalShirtPrice > 0) { 
        total += totalShirtPrice; 
        breakdown.push({ label: 'Áo & Màu', value: totalShirtPrice }); 
    }

    const pantsBasePrice = config.characters.reduce((acc, char) => acc + (char.pants?.price || 0), 0);
    const pantsColorPrice = config.characters.reduce((acc, char) => acc + (char.selectedPantsColor?.price || 0), 0);
    const totalPantsPrice = pantsBasePrice + pantsColorPrice;
    if(totalPantsPrice > 0) { 
        total += totalPantsPrice; 
        breakdown.push({ label: 'Quần & Màu', value: totalPantsPrice }); 
    }

    const accessoryPrice = config.draggableItems.filter(i => i.type === 'accessory').reduce((acc, item) => acc + (allParts[item.partId]?.price || 0) + (item.selectedColor?.price || 0), 0);
    if(accessoryPrice > 0) { total += accessoryPrice; breakdown.push({ label: 'Phụ kiện', value: accessoryPrice }); }
    
    const petPrice = config.draggableItems.filter(i => i.type === 'pet').reduce((acc, item) => acc + (allParts[item.partId]?.price || 0) + (item.selectedColor?.price || 0), 0);
    if(petPrice > 0) { total += petPrice; breakdown.push({ label: 'Thú cưng', value: petPrice }); }

    return { totalPrice: total, priceBreakdown: breakdown };
};

export const formatCurrency = (amount: number, context: 'price' | 'payment' = 'price') => {
  if (amount === 0 && context === 'price') return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
