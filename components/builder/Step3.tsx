
import React, { useState, useMemo, useEffect } from 'react';
import type { FrameConfig, LegoPart, LegoCharacterConfig, DraggableItem, OutfitColor } from '../../types';
import { LEGO_PARTS, defaultShirtColors, defaultPantsColors } from '../../constants';
import { getEffectivePrice, formatCurrency, CHARACTER_BASE_PRICE, isPartOutOfStock, getPartImageUrl } from '../../utils/pricing';
import { getDisplayOrderCount } from '../../utils/orderUtils';
import { SmartImage } from '../shared/SmartImage';
import { useLanguage } from '../../src/contexts/LanguageContext';

const isNeckAccessory = (part?: LegoPart) => {
    if (!part || part.type !== 'accessory') return false;
    const cat = (part.category || '').toLowerCase();
    const name = (part.name || '').toLowerCase();
    const keywords = ['khăn', 'vòng cổ', 'huy chương', 'scarf', 'necklace', 'medal'];
    return keywords.some(k => cat.includes(k) || name.includes(k));
};

const PartButton = React.memo<{
    part: LegoPart;
    isSelected: boolean;
    onClick: () => void;
    priceToDisplay: number; 
    originalPrice?: number;
    isHot?: boolean;
    priority?: boolean;
    disableTransition?: boolean;
}>(({ part, isSelected, onClick, priceToDisplay, originalPrice, isHot, priority, disableTransition }) => {
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
        setIsClicked(true);
        onClick();
        setTimeout(() => setIsClicked(false), 300);
    };
    
    const isSale = originalPrice !== undefined && priceToDisplay < originalPrice;
    const isBulk = part.bulkPricing && part.bulkPricing.length > 0;
    const isOutOfStock = isPartOutOfStock(part);
    const displayImageUrl = getPartImageUrl(part);
    
    const hasMultipleColors = useMemo(() => {
        if (part.colors && part.colors.length > 1) return true;
        const nameLower = part.name.toLowerCase();
        if (part.type === 'shirt' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'shirt1')) return true;
        if (part.type === 'pants' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'pants1')) return true;
        return false;
    }, [part]);

    return (
        <button
            onClick={isOutOfStock ? undefined : handleClick}
            disabled={isOutOfStock}
            className={`border rounded-lg p-1.5 flex flex-col items-center justify-start gap-1.5 transition-all text-center w-full relative overflow-hidden ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            } ${isClicked ? 'ring-2 ring-luvin-pink ring-opacity-50 scale-95' : 'hover:scale-[1.02]'} ${isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
            {isClicked && (
                <div className="absolute inset-0 bg-luvin-pink opacity-20 z-10 animate-ping rounded-lg"></div>
            )}
            {isHot && (
                <div className="absolute top-0 right-0 z-20 bg-red-500 text-white text-[10px] px-1 rounded-bl shadow-sm flex items-center justify-center w-5 h-5" title="Hot Trend">
                    🔥
                </div>
            )}
            {isSale && (
                <div className="absolute top-0 left-0 z-20 bg-yellow-400 text-yellow-900 text-[9px] px-1 rounded-br shadow-sm font-bold">
                    SALE
                </div>
            )}
            {isBulk && !isSale && (
                <div className="absolute top-0 left-0 z-20 bg-green-500 text-white text-[8px] px-1 rounded-br shadow-sm font-bold" title="Mua nhiều giảm giá">
                    COMBO
                </div>
            )}
            
            {/* Remove product line tags as per user request */}
            
            <div className="w-full aspect-square rounded-md bg-gray-100 overflow-hidden flex items-center justify-center relative border border-gray-100/50">
                <SmartImage 
                    src={displayImageUrl} 
                    alt={part.name} 
                    className="w-full h-full"
                    loading={priority ? "eager" : "lazy"}
                    disableTransition={disableTransition}
                />

                {hasMultipleColors && (
                    <div className="absolute bottom-1 right-1 z-20 bg-white/95 rounded-full w-6 h-6 flex items-center justify-center shadow-md border border-pink-100 animate-fade-in" title="Có thể đổi màu">
                        <span className="text-[11px]">🎨</span>
                    </div>
                )}
            </div>
            <div className="flex flex-col justify-center items-center flex-shrink-0 h-10 leading-tight">
                <span className="text-[12px] sm:text-[13px] font-semibold text-gray-800 line-clamp-1">
                    {part.name}
                    {isOutOfStock && <span className="ml-1 text-[8px] text-red-500 font-bold">(Hết)</span>}
                </span>
                {isSale ? (
                    <div className="flex flex-col">
                        <span className="text-[9px] font-normal text-gray-400 line-through">
                            {formatCurrency(originalPrice!)}
                        </span>
                        <span className={`text-[12px] sm:text-[13px] font-bold ${isSelected ? 'text-red-600' : 'text-red-500'} ${isOutOfStock ? 'text-gray-400' : ''}`}>
                            {formatCurrency(priceToDisplay)}
                        </span>
                    </div>
                ) : (
                    <span className={`text-[12px] sm:text-[13px] font-bold ${isSelected ? 'text-red-600' : 'text-luvin-pink'} ${isOutOfStock ? 'text-gray-400' : ''}`}>
                        {formatCurrency(priceToDisplay)}
                    </span>
                )}
            </div>
        </button>
    );
});

const sortParts = (parts: LegoPart[], mode: 'default' | 'price_asc' | 'price_desc', hotIds: string[] = []) => {
    if (mode === 'default') {
        return [...parts].sort((a, b) => {
            // Priority 1: Multi-factor Popularity (Virtual + Real)
            const popA = getDisplayOrderCount(a);
            const popB = getDisplayOrderCount(b);
            if (popA !== popB) return popB - popA;

            // Priority 2: isHot flag
            if (a.isHot && !b.isHot) return -1;
            if (!a.isHot && b.isHot) return 1;

            // Priority 3: hotIds from recent orders analytics
            const aAnalyticsHot = hotIds.includes(a.id);
            const bAnalyticsHot = hotIds.includes(b.id);
            if (aAnalyticsHot && !bAnalyticsHot) return -1;
            if (!aAnalyticsHot && bAnalyticsHot) return 1;

            // Priority 4: Manual order attribute
            return (a.order || 9999) - (b.order || 9999);
        });
    }
    return [...parts].sort((a, b) => {
        const priceA = getEffectivePrice(a) || 0;
        const priceB = getEffectivePrice(b) || 0;
        return mode === 'price_asc' ? priceA - priceB : priceB - priceA;
    });
};

const PartSkeleton = () => (
    <div className="border rounded-lg p-1.5 flex flex-col items-center justify-start gap-1.5 w-full animate-pulse">
        <div className="w-full aspect-square rounded-md bg-gray-200"></div>
        <div className="h-3 w-3/4 bg-gray-200 rounded mt-1"></div>
        <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
    </div>
);

export const Step3Characters: React.FC<{ 
    config: FrameConfig; 
    setConfig: (fn: (prev: FrameConfig) => FrameConfig) => void;
    legoParts: typeof LEGO_PARTS;
    selectedItemId?: string | null;
    setSelectedItemId: (id: string | null) => void;
    activePartType: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set';
    setActivePartType: (type: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set') => void;
    hotPartIds: string[];
    showToast?: (msg: string, type: 'success' | 'error') => void;
    allParts: Record<string, LegoPart>; 
    isLoadingParts?: boolean;
    storeConfig?: any;
}> = ({ config, setConfig, legoParts, selectedItemId, setSelectedItemId, activePartType, setActivePartType, hotPartIds, showToast, allParts, isLoadingParts, storeConfig }) => {
    const { t } = useLanguage();
    const [activeCharId, setActiveCharId] = useState<number | null>(config.characters[0]?.id || null);
    const activeCharacter = config.characters.find(c => c.id === activeCharId);
    
    const [sortMode, setSortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');
    const [accessorySortMode, setAccessorySortMode] = useState<'default' | 'price_asc' | 'price_desc' | 'hot_trend'>('default');
    const [accessoryCategory, setAccessoryCategory] = useState<string>(t('studio.all'));
    const [accessorySearch, setAccessorySearch] = useState<string>('');

    const getAvailableParts = (list: LegoPart[]) => {
        // Show ALL parts, but we will mark out of stock ones in the UI
        return list;
    };

     useEffect(() => {
        if (!config.characters.find(c => c.id === activeCharId)) {
            setActiveCharId(config.characters[config.characters.length - 1]?.id || null);
        }
     }, [config.characters, activeCharId]);

     useEffect(() => {
        if (selectedItemId && selectedItemId.startsWith('character-')) {
            const id = parseInt(selectedItemId.split('-')[1]);
            if (!isNaN(id)) {
                setActiveCharId(id);
            }
        }
     }, [selectedItemId]);

    const handleAddChar = () => {
        const newId = Date.now();
        const availableShirts = getAvailableParts(legoParts.shirt);
        const availablePants = getAvailableParts(legoParts.pants);
        const availableHair = getAvailableParts(legoParts.hair);
        const availableFace = getAvailableParts(legoParts.face);

        const newCharacter: LegoCharacterConfig = {
            id: newId, 
            hair: availableHair.find(h => h.id === 'hair-1') || availableHair[0] || legoParts.hair[0],
            face: availableFace.find(f => f.id === 'face-1') || availableFace[0] || legoParts.face[0],
            shirt: availableShirts[0] || legoParts.shirt[0], 
            pants: availablePants[0] || legoParts.pants[0],
            x: 30 + (config.characters.length % 3) * 20, 
            y: 75, 
            rotation: 0, 
            scale: 1,
            selectedShirtColor: availableShirts[0]?.colors?.find(c => c.stock === undefined || c.stock === null || c.stock !== 0) || availableShirts[0]?.colors?.[0],
            selectedPantsColor: availablePants[0]?.colors?.find(c => c.stock === undefined || c.stock === null || c.stock !== 0) || availablePants[0]?.colors?.[0],
            selectedHairColor: (availableHair.find(h => h.id === 'hair-1') || availableHair[0])?.colors?.find(c => c.stock === undefined || c.stock === null || c.stock !== 0) || (availableHair.find(h => h.id === 'hair-1') || availableHair[0])?.colors?.[0],
        };
        setConfig(prev => ({ ...prev, characters: [...prev.characters, newCharacter] }));
        setActiveCharId(newId);
        
        setSelectedItemId(`character-${newId}`);
        setActivePartType('shirt');
    };
    
    const handleRemoveChar = (id: number) => {
        setConfig(prev => ({...prev, characters: prev.characters.filter(c => c.id !== id)}));
    };
    
    const addDraggableItem = (part: LegoPart) => {
        if (part.type !== 'accessory' && part.type !== 'pet' && part.type !== 'hat') return;
        
        if (activeCharacter) {
            const isNeck = isNeckAccessory(part);
            if (isNeck && activeCharacter.hair?.preventScarf) {
                if (showToast) showToast(t('studio.scarf_conflict_error'), 'error');
                return;
            }
        }

        let startX = 50;
        let startY = 50;
        
        if (part.type === 'hat' && activeCharacter) {
            startX = activeCharacter.x;
            startY = activeCharacter.y - 35; 
        } else {
            startX = 50 + (Math.random() - 0.5) * 20;
            startY = 50 + (Math.random() - 0.5) * 20;
        }

        const newItem: DraggableItem = {
            id: Date.now(), 
            partId: part.id, 
            type: part.type as 'accessory' | 'pet' | 'hat', 
            x: startX, 
            y: startY, 
            rotation: 0, 
            scale: 1, 
            isFlipped: false, 
            selectedColor: part.colors?.find(c => c.stock === undefined || c.stock === null || c.stock !== 0) || part.colors?.[0],
            linkedCharId: activeCharacter?.id 
        };
        setConfig(prev => ({...prev, draggableItems: [...(Array.isArray(prev.draggableItems) ? prev.draggableItems : []), newItem]}));
    };

    const handlePartSelect = (part: LegoPart | undefined) => {
        if (!activeCharId || !part) return;

        if (part.type === 'hat') {
            addDraggableItem(part);
            return;
        }

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar = { ...c };
                    if (part.type === 'set') {
                        newChar.set = part;
                        newChar.shirt = undefined;
                        newChar.pants = undefined; 
                    } else {
                        (newChar as any)[part.type] = part;
                        if (part.type === 'shirt' || part.type === 'pants') {
                            newChar.set = undefined;
                        }
                    }

                    let partColors = part.colors;
                    if (!partColors || partColors.length === 0) {
                        const nameLower = part.name.toLowerCase();
                        if (part.type === 'shirt' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'shirt1')) {
                            partColors = defaultShirtColors;
                        }
                        if (part.type === 'pants' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'pants1')) {
                            partColors = defaultPantsColors;
                        }
                    }

                    const inStockColor = partColors?.find(c => c.stock === undefined || c.stock === null || c.stock !== 0) || partColors?.[0];

                    if (part.type === 'shirt') newChar.selectedShirtColor = inStockColor;
                    if (part.type === 'set') newChar.selectedSetColor = inStockColor;
                    if (part.type === 'pants') newChar.selectedPantsColor = inStockColor;
                    if (part.type === 'hair') newChar.selectedHairColor = inStockColor;
                    if (part.type === 'hat') newChar.selectedHatColor = inStockColor;
                    
                    return newChar;
                }
                return c;
            })
        }));

        if (part.type === 'hair' && part.preventScarf) {
            setTimeout(() => { 
                setConfig((prev: FrameConfig) => {
                    const char = prev.characters.find(c => c.id === activeCharId);
                    if (!char || !char.hair?.preventScarf) return prev;

                    const conflictingItems = (Array.isArray(prev.draggableItems) ? prev.draggableItems : []).filter(
                        item => {
                            if (item.linkedCharId !== activeCharId) return false;
                            const itemPart = allParts[item.partId];
                            return isNeckAccessory(itemPart);
                        }
                    );

                    if (conflictingItems.length > 0) {
                        if (showToast) showToast(t('studio.scarf_removed_notice'), 'error');
                        return {
                            ...prev,
                            draggableItems: (Array.isArray(prev.draggableItems) ? prev.draggableItems : []).filter(item => !conflictingItems.includes(item))
                        };
                    }
                    return prev;
                });
            }, 50);
        }
    };

    const handlePartDeselect = (partType: 'hat') => {
      if (!activeCharId) return;
      if (partType === 'hat') {
          setConfig(prev => ({
              ...prev,
              draggableItems: (Array.isArray(prev.draggableItems) ? prev.draggableItems : []).filter(item => item.type !== 'hat' || item.linkedCharId !== activeCharId)
          }));
          return;
      }
    };
    
    useEffect(() => {
        if (activeCharId) {
            const viewportWidth = window.innerWidth;
            if (viewportWidth < 1024) { // Only scroll on mobile/tablet where preview is at top
                const el = document.getElementById('part-selector-area');
                if (el) {
                    const offset = 80; // Header offset
                    const elementPosition = el.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - offset;
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }, [activeCharId]);

    const handleRandomizeOutfit = () => {
        if (!activeCharId) return;
        
        const availableShirt = getAvailableParts(legoParts.shirt);
        const availablePants = getAvailableParts(legoParts.pants);

        const getRandomItem = (list: LegoPart[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : undefined;
        
        const getRandomColor = (colors: OutfitColor[] | undefined) => {
            if (!colors) return undefined;
            const availableColors = colors.filter(c => c.stock === undefined || c.stock > 0);
            return availableColors.length > 0 ? availableColors[Math.floor(Math.random() * availableColors.length)] : undefined;
        };

        const randomShirt = getRandomItem(availableShirt);
        const randomPants = getRandomItem(availablePants);

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar: LegoCharacterConfig = { ...c };
                    
                    newChar.shirt = randomShirt || c.shirt;
                    newChar.pants = randomPants || c.pants;

                    let shirtColors = newChar.shirt?.colors;
                    if (!shirtColors || shirtColors.length === 0) {
                         const nameLower = newChar.shirt?.name.toLowerCase() || '';
                         if (nameLower.includes('trơn') || nameLower.includes('basic')) shirtColors = defaultShirtColors;
                    }
                    
                    let pantsColors = newChar.pants?.colors;
                    if (!pantsColors || pantsColors.length === 0) {
                         const nameLower = newChar.pants?.name.toLowerCase() || '';
                         if (nameLower.includes('trơn') || nameLower.includes('basic')) pantsColors = defaultPantsColors;
                    }

                    newChar.selectedShirtColor = getRandomColor(shirtColors) || shirtColors?.[0];
                    newChar.selectedPantsColor = getRandomColor(pantsColors) || pantsColors?.[0];

                    return newChar;
                }
                return c;
            })
        }));
    };
    
    const partTypes: { key: 'hair' | 'face' | 'shirt' | 'pants' | 'set' | 'hat', label: string }[] = [
        { key: 'hair', label: t('studio.hair') },
        { key: 'face', label: t('studio.face') },
        { key: 'shirt', label: t('studio.shirt') },
        { key: 'pants', label: t('studio.pants') },
        { key: 'set', label: t('studio.set') },
        { key: 'hat', label: t('studio.hat') },
    ];

    const currentPartList = useMemo(() => {
        let list = getAvailableParts(legoParts[activePartType] || []);
        
        // Filter by product line compatibility
        const currentLine = config.productLine || 'lego';
        list = list.filter(p => {
            if (!p.supportedProductLines || p.supportedProductLines.length === 0) return true;
            return p.supportedProductLines.includes(currentLine);
        });

        return sortParts(list, sortMode, hotPartIds);
    }, [legoParts, activePartType, sortMode, hotPartIds, config.frameId, config.productLine]);

    const uniqueAccessoryCategories = useMemo(() => {
        const cats = new Set<string>();
        legoParts.accessory.forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return [t('studio.all'), ...Array.from(cats).sort()];
    }, [legoParts.accessory, t]);

    const filteredAccessories = useMemo(() => {
        let list = (legoParts.accessory || []);
        
        // Filter by product line compatibility
        const currentLine = config.productLine || 'lego';
        list = list.filter(p => {
            if (!p.supportedProductLines || p.supportedProductLines.length === 0) return true;
            return p.supportedProductLines.includes(currentLine);
        });

        if (accessoryCategory !== t('studio.all')) {
            list = list.filter(p => p.category === accessoryCategory);
        }

        if (accessorySearch.trim()) {
            const query = accessorySearch.toLowerCase().trim();
            list = list.filter(p => p.name.toLowerCase().includes(query));
        }

        return sortParts(list, accessorySortMode === 'hot_trend' ? 'default' : accessorySortMode as any, hotPartIds);
    }, [legoParts.accessory, accessorySortMode, accessoryCategory, accessorySearch, hotPartIds, config.frameId, config.productLine]);

    const availablePets = useMemo(() => {
        let list = (legoParts.pet || []);

        // Filter by product line compatibility
        const currentLine = config.productLine || 'lego';
        list = list.filter(p => {
            if (!p.supportedProductLines || p.supportedProductLines.length === 0) return true;
            return p.supportedProductLines.includes(currentLine);
        });

        if (accessorySearch.trim()) {
            const query = accessorySearch.toLowerCase().trim();
            list = list.filter(p => p.name.toLowerCase().includes(query));
        }
        return sortParts(list, accessorySortMode === 'hot_trend' ? 'default' : accessorySortMode as any, hotPartIds);
    }, [legoParts.pet, hotPartIds, accessorySortMode, accessorySearch, config.frameId, config.productLine]);

    const [showPrintExample, setShowPrintExample] = useState<string | null>(null);

    return (
        <div className="space-y-4 text-left">
            {/* Modal for Print Examples */}
            {showPrintExample && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowPrintExample(null)}>
                    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="relative aspect-[4/3]">
                            <img 
                                src={showPrintExample === 'standard' 
                                    ? (storeConfig?.standardPrintImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80') 
                                    : (storeConfig?.premiumPrintImageUrl || 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&q=80')
                                } 
                                className="w-full h-full object-cover" 
                                alt="Print Example" 
                            />
                            <button 
                                onClick={() => setShowPrintExample(null)}
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full p-2 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-2">
                                {showPrintExample === 'standard' ? (t('studio.standard_print') || 'In thường') : (t('studio.premium_print') || 'In cao cấp')}
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {showPrintExample === 'standard' 
                                    ? (t('studio.standard_print_desc') || 'Độ chi tiết tương đối, in bề mặt áo quần (không bao gồm cánh tay), phù hợp các thiết kế đơn giản. Thời gian hoàn thiện nhanh hơn.') 
                                    : (t('studio.premium_print_desc') || 'In độ phân giải cực cao, mực in chất lượng Nhật Bản, bền màu và sắc nét tới từng chi tiết nhỏ nhất (bao gồm cả cánh tay & phụ kiện).')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-800 uppercase tracking-tight text-sm">{t('studio.character_management')}</h4>
                    {activeCharacter && (
                        <button 
                            onClick={handleRandomizeOutfit}
                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors active:scale-95"
                            title={t('studio.randomize_outfit')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            {t('studio.random')}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {config.characters.map((char, index) => (
                        <div key={char.id} className="relative">
                            <button onClick={() => setActiveCharId(char.id)} className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeCharId === char.id ? 'bg-pink-100 text-luvin-pink border border-luvin-pink shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                {t('studio.character_index', { index: index + 1 })}
                            </button>
                            <button onClick={() => handleRemoveChar(char.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold shadow-sm hover:scale-110 transition-transform">
                                &times;
                            </button>
                        </div>
                    ))}
                    <button onClick={handleAddChar} className="bg-green-500 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-green-600 transition-colors active:scale-95">{t('studio.add_char')} ({formatCurrency(CHARACTER_BASE_PRICE)})</button>
                </div>
                {activeCharacter && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            {t('studio.custom_print') || 'In theo yêu cầu'}
                        </label>
                        <div className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            7-10 {t('common.days') || 'ngày'}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'none', label: t('studio.none') || 'Không chọn', price: 0 },
                            { id: 'standard', label: t('studio.standard_print') || 'In thường', price: storeConfig?.customPrintStandardPrice ?? 100000 },
                            { id: 'premium', label: t('studio.premium_print') || 'In cao cấp', price: storeConfig?.customPrintPremiumPrice ?? 300000 }
                        ].filter(opt => opt.id !== 'standard' || !storeConfig?.standardPrintOutOfStock).map(opt => (
                            <div key={opt.id} className="relative group">
                                <button
                                    onClick={() => {
                                        setConfig(prev => ({
                                            ...prev,
                                            characters: prev.characters.map(c => 
                                                c.id === activeCharacter.id ? { ...c, customPrintOption: opt.id as any, customPrintPrice: opt.price } : c
                                            )
                                        }));
                                    }}
                                    className={`w-full flex flex-col items-center justify-center py-3 px-1 rounded-xl border-2 transition-all min-h-[70px] ${
                                        (activeCharacter.customPrintOption || 'none') === opt.id 
                                            ? 'border-luvin-pink bg-pink-50 shadow-sm' 
                                            : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                                    }`}
                                >
                                    <span className={`text-[9px] font-black uppercase tracking-tighter mb-1 text-center leading-tight ${(activeCharacter.customPrintOption || 'none') === opt.id ? 'text-luvin-pink' : 'text-gray-500'}`}>{opt.label}</span>
                                    <span className={`text-[10px] font-bold ${(activeCharacter.customPrintOption || 'none') === opt.id ? 'text-luvin-pink' : 'text-gray-400'}`}>{opt.price === 0 ? '0 ₫' : formatCurrency(opt.price)}</span>
                                </button>
                                
                                {opt.id !== 'none' && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPrintExample(opt.id);
                                        }}
                                        className="absolute -top-2 -right-1 bg-pink-50 text-luvin-pink border border-pink-200/80 hover:bg-luvin-pink hover:text-white rounded-full px-2 py-0.5 text-[9px] font-semibold transition-all z-10 flex items-center gap-1 shadow-2xs"
                                        title="Bấm để xem ảnh mẫu in thực tế"
                                    >
                                        <span className="w-3 h-3 bg-pink-100 text-luvin-pink rounded-full inline-flex items-center justify-center text-[8px] font-bold leading-none">i</span>
                                        <span>Mẫu in</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100/80 text-[10px] text-gray-500 leading-relaxed font-medium space-y-1.5">
                        <p>{t('studio.custom_print_tip')}</p>
                        <div className="flex items-center gap-1.5 pt-0.5 text-gray-600 flex-wrap">
                            <span className="font-semibold text-gray-400">Xem mẫu:</span>
                            {(!storeConfig?.standardPrintOutOfStock) && (
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowPrintExample('standard');
                                    }}
                                    className="px-2 py-0.5 bg-white border border-gray-200 hover:border-pink-300 hover:text-luvin-pink rounded-md text-[10px] font-medium text-gray-700 transition-colors inline-flex items-center gap-1"
                                >
                                    In Thường ⓘ
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowPrintExample('premium');
                                }}
                                className="px-2 py-0.5 bg-white border border-gray-200 hover:border-pink-300 hover:text-luvin-pink rounded-md text-[10px] font-medium text-gray-700 transition-colors inline-flex items-center gap-1"
                            >
                                In Cao Cấp ⓘ
                            </button>
                        </div>
                    </div>
                  </div>
                )}
            </div>

            {activeCharacter && (
                <div id="part-selector-area" className="p-4 border border-gray-200 rounded-lg relative scroll-mt-20">
                    <div className="flex flex-col mb-4 border-b border-gray-200 pb-4">
                        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar items-center w-full px-1 py-1 mb-2">
                            {partTypes.map(pt => (
                                <button key={pt.key} onClick={() => setActivePartType(pt.key)} className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors whitespace-nowrap ${activePartType === pt.key ? 'bg-luvin-pink text-white shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                    {pt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                     <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                         {activePartType === 'hat' && (
                             <button 
                                onClick={() => handlePartDeselect('hat')} 
                                className="border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center gap-1 transition-all text-center w-full aspect-square bg-gray-50 hover:bg-gray-100 hover:border-gray-300"
                             >
                               <span className="text-xl font-bold text-gray-400">&times;</span>
                               <span className="text-[10px] font-bold text-gray-400 uppercase">{t('studio.none')}</span>
                             </button>
                         )}
                        {isLoadingParts ? (
                            Array.from({ length: 8 }).map((_, i) => <PartSkeleton key={i} />)
                        ) : currentPartList.length > 0 ? currentPartList.map((part, index) => {
                            const isSelected = activePartType === 'hat' ? false : activeCharacter[activePartType]?.id === part.id;
                            let effectiveBasePrice = getEffectivePrice(part);
                            let originalBasePrice = part.price;
                            let priceToDisplay = effectiveBasePrice;
                            let originalPriceToDisplay = originalBasePrice;
                            if (isSelected) {
                                let surcharge = 0;
                                if (activePartType === 'shirt') surcharge = (activeCharacter.selectedShirtColor?.price || 0);
                                else if (activePartType === 'set') surcharge = (activeCharacter.selectedSetColor?.price || 0);
                                else if (activePartType === 'pants') surcharge = (activeCharacter.selectedPantsColor?.price || 0);
                                else if (activePartType === 'hair') surcharge = (activeCharacter.selectedHairColor?.price || 0);
                                priceToDisplay += surcharge;
                                originalPriceToDisplay += surcharge;
                            }
                            return (
                                <PartButton 
                                    key={part.id} 
                                    part={part}
                                    isSelected={isSelected}
                                    onClick={() => handlePartSelect(part)}
                                    priceToDisplay={priceToDisplay}
                                    originalPrice={originalPriceToDisplay}
                                    priority={index < 8} 
                                    disableTransition={['shirt', 'pants', 'set'].includes(activePartType)}
                                />
                            );
                        }) : (
                            <div className="col-span-4 text-center text-sm text-gray-400 py-4">
                                {legoParts[activePartType].length > 0 ? t('studio.out_of_stock_parts') : t('studio.loading_parts')}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <div className="flex flex-col gap-4 mb-4">
                    <h4 className="font-bold text-gray-800 uppercase tracking-tight text-base sm:text-lg">{t('studio.add_accessories_charms')}</h4>
                    
                    {/* Search bar for accessories */}
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder={t('studio.search_charms_placeholder')} 
                            value={accessorySearch}
                            onChange={(e) => setAccessorySearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-luvin-pink focus:border-transparent transition-all"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-luvin-pink transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {accessorySearch && (
                            <button 
                                onClick={() => setAccessorySearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full py-1">
                            {uniqueAccessoryCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setAccessoryCategory(cat)}
                                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                        accessoryCategory === cat 
                                            ? 'bg-[#1a202c] text-white border-[#1a202c] shadow-md' 
                                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="flex-shrink-0 w-full sm:w-auto">
                            <select 
                                value={accessorySortMode} 
                                onChange={(e: any) => setAccessorySortMode(e.target.value)}
                                className="w-full sm:w-auto p-2 border border-gray-200 rounded-xl text-xs font-bold bg-white focus:ring-1 focus:ring-gray-900 outline-none appearance-none pr-8 relative"
                                style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.2em' }}
                            >
                                <option value="default">{t('studio.sort_default')}</option>
                                <option value="price_asc">{t('studio.sort_price_asc')}</option>
                                <option value="price_desc">{t('studio.sort_price_desc')}</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    {isLoadingParts ? (
                        Array.from({ length: 8 }).map((_, i) => <PartSkeleton key={i} />)
                    ) : filteredAccessories.length > 0 ? filteredAccessories.map((part, index) => (
                        <PartButton 
                            key={part.id} 
                            part={part} 
                            isSelected={false} 
                            onClick={() => addDraggableItem(part)} 
                            priceToDisplay={getEffectivePrice(part) + (part.colors?.[0]?.price || 0)} 
                            originalPrice={part.price + (part.colors?.[0]?.price || 0)}
                            isHot={hotPartIds.includes(part.id)}
                            priority={index < 4 || hotPartIds.includes(part.id)} 
                        />
                    )) : (
                        <div className="col-span-4 text-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
                            <p className="text-xs text-gray-400 italic">{t('studio.no_accessories_found')}</p>
                        </div>
                    )}
                </div>

                {availablePets.length > 0 && accessoryCategory === t('studio.all') && (
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-gray-800 uppercase tracking-tight text-sm mb-4">{t('studio.add_pets')}</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                            {availablePets.map((part, index) => (
                                <PartButton 
                                    key={part.id} 
                                    part={part} 
                                    isSelected={false} 
                                    onClick={() => addDraggableItem(part)} 
                                    priceToDisplay={getEffectivePrice(part) + (part.colors?.[0]?.price || 0)} 
                                    originalPrice={part.price + (part.colors?.[0]?.price || 0)}
                                    isHot={hotPartIds.includes(part.id)}
                                    priority={index < 4 || hotPartIds.includes(part.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
