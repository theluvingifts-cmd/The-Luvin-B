
import React, { useState, useMemo, useEffect } from 'react';
import type { FrameConfig, LegoPart, LegoCharacterConfig, DraggableItem, OutfitColor } from '../../types';
import { LEGO_PARTS, defaultShirtColors, defaultPantsColors } from '../../constants';
import { getEffectivePrice, formatCurrency, CHARACTER_BASE_PRICE } from '../../utils/pricing';
import { SmartImage } from '../shared/SmartImage';

const isNeckAccessory = (part?: LegoPart) => {
    if (!part || part.type !== 'accessory') return false;
    const cat = (part.category || '').toLowerCase();
    const name = (part.name || '').toLowerCase();
    return cat.includes('khăn') || cat.includes('vòng cổ') || cat.includes('huy chương') || 
           name.includes('khăn') || name.includes('vòng cổ') || name.includes('huy chương');
};

const PartButton: React.FC<{
    part: LegoPart;
    isSelected: boolean;
    onClick: () => void;
    priceToDisplay: number; 
    originalPrice?: number;
    isHot?: boolean;
    priority?: boolean;
    disableTransition?: boolean;
}> = ({ part, isSelected, onClick, priceToDisplay, originalPrice, isHot, priority, disableTransition }) => {
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
        setIsClicked(true);
        onClick();
        setTimeout(() => setIsClicked(false), 300);
    };
    
    const isSale = originalPrice !== undefined && priceToDisplay < originalPrice;
    const isBulk = part.bulkPricing && part.bulkPricing.length > 0;
    
    const hasMultipleColors = useMemo(() => {
        if (part.colors && part.colors.length > 1) return true;
        const nameLower = part.name.toLowerCase();
        if (part.type === 'shirt' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'shirt1')) return true;
        if (part.type === 'pants' && (nameLower.includes('trơn') || nameLower.includes('plain') || nameLower.includes('basic') || part.id === 'pants1')) return true;
        return false;
    }, [part]);

    return (
        <button
            onClick={handleClick}
            className={`border rounded-lg p-1.5 flex flex-col items-center justify-start gap-1.5 transition-all text-center w-full relative overflow-hidden ${
                isSelected
                    ? 'border-luvin-pink bg-pink-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
            } ${isClicked ? 'ring-2 ring-luvin-pink ring-opacity-50 scale-95' : 'hover:scale-[1.02]'}`}
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
            
            <div className="w-full aspect-square rounded-md bg-gray-100 overflow-hidden flex items-center justify-center relative border border-gray-100/50">
                <SmartImage 
                    src={part.imageUrl} 
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
                <span className="text-[11px] font-semibold text-gray-800 line-clamp-1">{part.name}</span>
                {isSale ? (
                    <div className="flex flex-col">
                        <span className="text-[9px] font-normal text-gray-400 line-through">
                            {formatCurrency(originalPrice!)}
                        </span>
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-red-600' : 'text-red-500'}`}>
                            {formatCurrency(priceToDisplay)}
                        </span>
                    </div>
                ) : (
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-red-600' : 'text-luvin-pink'}`}>
                        {formatCurrency(priceToDisplay)}
                    </span>
                )}
            </div>
        </button>
    );
};

const sortParts = (parts: LegoPart[], mode: 'default' | 'price_asc' | 'price_desc') => {
    if (mode === 'default') return parts;
    return [...parts].sort((a, b) => {
        const priceA = getEffectivePrice(a) || 0;
        const priceB = getEffectivePrice(b) || 0;
        return mode === 'price_asc' ? priceA - priceB : priceB - priceA;
    });
};

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
}> = ({ config, setConfig, legoParts, selectedItemId, setSelectedItemId, activePartType, setActivePartType, hotPartIds, showToast, allParts }) => {
    const [activeCharId, setActiveCharId] = useState<number | null>(config.characters[0]?.id || null);
    const activeCharacter = config.characters.find(c => c.id === activeCharId);
    const [printDialogCharId, setPrintDialogCharId] = useState<number | null>(null);
    
    const [sortMode, setSortMode] = useState<'default' | 'price_asc' | 'price_desc'>('default');
    const [accessorySortMode, setAccessorySortMode] = useState<'default' | 'price_asc' | 'price_desc' | 'hot_trend'>('hot_trend');
    const [accessoryCategory, setAccessoryCategory] = useState<string>('Tất cả');
    const [accessorySearch, setAccessorySearch] = useState<string>('');

    const getAvailableParts = (list: LegoPart[]) => {
        return list.filter(p => p.stock === undefined || p.stock > 0);
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
        const availableFaces = getAvailableParts(legoParts.face);
        const availableHairs = getAvailableParts(legoParts.hair);

        const newCharacter: LegoCharacterConfig = {
            id: newId, 
            shirt: availableShirts[0] || legoParts.shirt[0], 
            pants: availablePants[0] || legoParts.pants[0],
            face: availableFaces[0] || legoParts.face[0], 
            hair: availableHairs[0] || legoParts.hair[0],
            x: 30 + (config.characters.length % 3) * 20, 
            y: 75, 
            rotation: 0, 
            scale: 1,
            selectedShirtColor: availableShirts[0]?.colors?.[0],
            selectedPantsColor: availablePants[0]?.colors?.[0],
            selectedHairColor: availableHairs[0]?.colors?.[0],
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
                if (showToast) showToast('Kiểu tóc này che cổ, không thể đeo thêm khăn/vòng cổ!', 'error');
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
            selectedColor: part.colors?.[0],
            linkedCharId: activeCharacter?.id 
        };
        setConfig(prev => ({...prev, draggableItems: [...prev.draggableItems, newItem]}));
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
                        newChar.shirt = part;
                        newChar.pants = undefined; 
                    } else {
                        (newChar as any)[part.type] = part;
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

                    if (part.type === 'shirt' || part.type === 'set') newChar.selectedShirtColor = partColors?.[0];
                    if (part.type === 'pants') newChar.selectedPantsColor = partColors?.[0];
                    if (part.type === 'hair') newChar.selectedHairColor = partColors?.[0];
                    
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

                    const conflictingItems = prev.draggableItems.filter(
                        item => {
                            if (item.linkedCharId !== activeCharId) return false;
                            const itemPart = allParts[item.partId];
                            return isNeckAccessory(itemPart);
                        }
                    );

                    if (conflictingItems.length > 0) {
                        if (showToast) showToast("Đã tháo phụ kiện ở cổ để phù hợp với kiểu tóc mới", 'error');
                        return {
                            ...prev,
                            draggableItems: prev.draggableItems.filter(item => !conflictingItems.includes(item))
                        };
                    }
                    return prev;
                });
            }, 50);
        }
    };

    const handlePartDeselect = (partType: 'hair' | 'hat') => {
      if (!activeCharId) return;
      if (partType === 'hat') return;

      setConfig(prev => ({
        ...prev,
        characters: prev.characters.map(c => {
            if (c.id === activeCharId) {
                const updatedChar = { ...c, [partType]: undefined };
                return updatedChar;
            }
            return c;
        })
      }));
    };
    
    const handleCustomPrintSelect = (price: number) => {
      if (!printDialogCharId) return;
      setConfig(prev => ({
        ...prev,
        characters: prev.characters.map(c => 
          c.id === printDialogCharId ? { ...c, customPrintPrice: price } : c
        )
      }));
      setPrintDialogCharId(null);
    };

    const handleRandomizeOutfit = () => {
        if (!activeCharId) return;
        
        const availableHair = getAvailableParts(legoParts.hair);
        const availableFace = getAvailableParts(legoParts.face);
        const availableShirt = getAvailableParts(legoParts.shirt);
        const availablePants = getAvailableParts(legoParts.pants);

        const getRandomItem = (list: LegoPart[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : undefined;
        
        const getRandomColor = (colors: OutfitColor[] | undefined) => {
            if (!colors) return undefined;
            const availableColors = colors.filter(c => c.stock === undefined || c.stock > 0);
            return availableColors.length > 0 ? availableColors[Math.floor(Math.random() * availableColors.length)] : undefined;
        };

        const randomHair = getRandomItem(availableHair);
        const randomFace = getRandomItem(availableFace);
        const randomShirt = getRandomItem(availableShirt);
        const randomPants = getRandomItem(availablePants);

        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => {
                if (c.id === activeCharId) {
                    const newChar: LegoCharacterConfig = { ...c };
                    
                    newChar.face = randomFace || c.face;
                    newChar.shirt = randomShirt || c.shirt;
                    newChar.pants = randomPants || c.pants;
                    newChar.hair = randomHair || c.hair;

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
                    newChar.selectedHairColor = getRandomColor(newChar.hair?.colors) || newChar.hair?.colors?.[0];

                    return newChar;
                }
                return c;
            })
        }));
    };
    
    const partTypes: { key: 'hair' | 'hat' | 'face' | 'shirt' | 'pants' | 'set', label: string }[] = [
        { key: 'shirt', label: 'Áo' },
        { key: 'pants', label: 'Quần' },
        { key: 'set', label: 'Theo bộ' },
        { key: 'face', label: 'Mặt' },
        { key: 'hair', label: 'Tóc' },
        { key: 'hat', label: 'Mũ' },
    ];

    const currentPartList = useMemo(() => {
        const list = getAvailableParts(legoParts[activePartType] || []);
        return sortParts(list, sortMode);
    }, [legoParts, activePartType, sortMode]);

    const uniqueAccessoryCategories = useMemo(() => {
        const cats = new Set<string>();
        legoParts.accessory.forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return ['Tất cả', ...Array.from(cats)];
    }, [legoParts.accessory]);

    const filteredAccessories = useMemo(() => {
        let list = getAvailableParts(legoParts.accessory || []);
        
        if (accessoryCategory !== 'Tất cả') {
            list = list.filter(p => p.category === accessoryCategory);
        }

        if (accessorySearch.trim()) {
            const query = accessorySearch.toLowerCase().trim();
            list = list.filter(p => p.name.toLowerCase().includes(query));
        }

        if (accessorySortMode === 'hot_trend') {
             return list.sort((a, b) => {
                const indexA = hotPartIds.indexOf(a.id);
                const indexB = hotPartIds.indexOf(b.id);
                const aIsHot = indexA !== -1;
                const bIsHot = indexB !== -1;
                if (aIsHot && bIsHot) return indexA - indexB;
                if (aIsHot) return -1;
                if (bIsHot) return 1;
                return 0;
            });
        }

        return sortParts(list, accessorySortMode as any);
    }, [legoParts.accessory, accessorySortMode, accessoryCategory, accessorySearch, hotPartIds]);

    const availablePets = useMemo(() => {
        return getAvailableParts(legoParts.pet || []);
    }, [legoParts.pet]);

    return (
        <div className="space-y-4 text-left">
            {printDialogCharId && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center">
                  <h3 className="font-bold text-lg mb-2">Chọn chất lượng in</h3>
                  <p className="text-sm text-gray-600 mb-4">In theo yêu cầu sẽ có chi phí cao hơn. Vui lòng chọn chất lượng mong muốn cho nhân vật này.</p>
                  <div className="space-y-2">
                    <button onClick={() => handleCustomPrintSelect(150000)} className="w-full bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg hover:bg-gray-300">In thường - {formatCurrency(150000)}</button>
                    <button onClick={() => handleCustomPrintSelect(300000)} className="w-full bg-luvin-pink text-gray-800 font-semibold py-2 rounded-lg hover:opacity-90">In cao cấp - {formatCurrency(300000)}</button>
                    {config.characters.find(c => c.id === printDialogCharId)?.customPrintPrice && 
                      <button onClick={() => handleCustomPrintSelect(0)} className="w-full bg-red-100 text-red-700 font-semibold py-2 rounded-lg hover:bg-red-200">Bỏ in yêu cầu</button>
                    }
                  </div>
                  <button onClick={() => setPrintDialogCharId(null)} className="text-xs text-gray-500 mt-4 hover:underline">Hủy</button>
                </div>
              </div>
            )}
            <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-800 uppercase tracking-tight text-sm">QUẢN LÝ NHÂN VẬT</h4>
                    {activeCharacter && (
                        <button 
                            onClick={handleRandomizeOutfit}
                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors active:scale-95"
                            title="Chọn ngẫu nhiên trang phục"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            Ngẫu nhiên
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {config.characters.map((char, index) => (
                        <div key={char.id} className="relative">
                            <button onClick={() => setActiveCharId(char.id)} className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeCharId === char.id ? 'bg-pink-100 text-luvin-pink border border-luvin-pink shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                NV {index + 1}
                            </button>
                            <button onClick={() => handleRemoveChar(char.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold shadow-sm hover:scale-110 transition-transform">
                                &times;
                            </button>
                        </div>
                    ))}
                    <button onClick={handleAddChar} className="bg-green-500 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-green-600 transition-colors active:scale-95">+ Thêm ({formatCurrency(CHARACTER_BASE_PRICE)})</button>
                </div>
                {activeCharacter && 
                  <div className="mt-4 pt-4 border-t flex items-center justify-start">
                    <button onClick={() => setPrintDialogCharId(activeCharacter.id)} className="text-sm text-blue-600 hover:underline font-semibold">
                      {activeCharacter.customPrintPrice ? `In yêu cầu (${formatCurrency(activeCharacter.customPrintPrice)})` : 'Thêm in yêu cầu?'}
                    </button>
                  </div>
                }
            </div>

            {activeCharacter && (
                <div className="p-4 border border-gray-200 rounded-lg relative">
                    <div className="flex flex-col mb-4 border-b border-gray-200 pb-4">
                        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar items-center w-full px-1 py-1 mb-2">
                            {partTypes.map(pt => (
                                <button key={pt.key} onClick={() => setActivePartType(pt.key)} className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors whitespace-nowrap ${activePartType === pt.key ? 'bg-luvin-pink text-white shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
                                    {pt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                     <div className="grid grid-cols-4 gap-2">
                         {(activePartType === 'hair') && (
                             <button onClick={() => handlePartDeselect(activePartType)} className="border-2 border-dashed border-gray-300 rounded-lg p-1.5 flex flex-col items-center justify-center gap-1 transition-colors text-center w-full h-full min-h-[100px] text-gray-500 hover:bg-gray-100 hover:border-gray-400">
                               <span className="text-2xl font-bold">&times;</span>
                               <span className="text-[11px] font-semibold">Không chọn</span>
                             </button>
                         )}
                        {currentPartList.length > 0 ? currentPartList.map((part, index) => {
                            const isSelected = activePartType === 'hat' ? false : activeCharacter[activePartType === 'set' ? 'shirt' : activePartType]?.id === part.id;
                            let effectiveBasePrice = getEffectivePrice(part);
                            let originalBasePrice = part.price;
                            let priceToDisplay = effectiveBasePrice;
                            let originalPriceToDisplay = originalBasePrice;
                            if (isSelected) {
                                let surcharge = 0;
                                if (activePartType === 'shirt' || activePartType === 'set') surcharge = (activeCharacter.selectedShirtColor?.price || 0);
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
                                    priority={index < 8} // Ưu tiên load 8 món đầu tiên cực nhanh
                                    disableTransition={['hair', 'face', 'shirt', 'pants', 'set'].includes(activePartType)}
                                />
                            );
                        }) : (
                            <div className="col-span-4 text-center text-sm text-gray-400 py-4">
                                {legoParts[activePartType].length > 0 ? "Các sản phẩm này đang hết hàng." : "Đang tải hoặc chưa có dữ liệu..."}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h4 className="font-bold text-gray-800 uppercase tracking-tight text-sm">THÊM PHỤ KIỆN</h4>
                        <div className="relative w-full sm:w-64">
                            <input 
                                type="text"
                                placeholder="Tìm kiếm phụ kiện..."
                                value={accessorySearch}
                                onChange={(e) => setAccessorySearch(e.target.value)}
                                className="w-full pl-8 pr-4 py-1.5 text-xs border border-gray-300 rounded-full focus:ring-2 focus:ring-luvin-pink focus:border-transparent outline-none bg-gray-50 transition-all"
                            />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {filteredAccessories.length > 0 ? filteredAccessories.map((part, index) => (
                        <PartButton 
                            key={part.id} 
                            part={part} 
                            isSelected={false} 
                            onClick={() => addDraggableItem(part)} 
                            priceToDisplay={getEffectivePrice(part) + (part.colors?.[0]?.price || 0)} 
                            originalPrice={part.price + (part.colors?.[0]?.price || 0)}
                            isHot={hotPartIds.includes(part.id)}
                            priority={index < 4 || hotPartIds.includes(part.id)} // Ưu tiên các món "Hot" hoặc 4 món đầu
                        />
                    )) : null}
                </div>

                {/* PHẦN THÚ CƯNG (PETS) */}
                {availablePets.length > 0 && (
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-gray-800 uppercase tracking-tight text-sm mb-4">THÊM THÚ CƯNG</h4>
                        <div className="grid grid-cols-4 gap-2">
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
