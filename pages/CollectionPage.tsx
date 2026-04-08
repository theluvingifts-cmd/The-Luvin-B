
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CollectionTemplate, FrameConfig, FrameOption, LegoPart, Page, DraggableItem, LegoCharacterConfig, OutfitColor } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';
import { calculatePrice, formatCurrency, CHARACTER_BASE_PRICE } from '../utils/pricing';
import { slugify } from '../utils/helpers';
import { SmartImage } from '../components/shared/SmartImage';
import { useLanguage } from '../src/contexts/LanguageContext';
import { getCachedTemplates } from '../services/configService';

interface CollectionPageProps {
    navigateTo: (page: Page) => void, 
    onCustomize: (template: CollectionTemplate) => void, 
    onAddToCart: (config: FrameConfig, openCartPanel?: boolean) => void,
    templates?: CollectionTemplate[],
    onZoomImage: (url: string) => void,
    allParts: Record<string, LegoPart>,
    frames: FrameOption[]
}

const CharacterPreview: React.FC<{ character: LegoCharacterConfig }> = ({ character }) => {
    const { shirt, pants, hat, hair, face } = character;
    const shirtImageUrl = character.selectedShirtColor?.imageUrl || shirt?.imageUrl;
    const pantsImageUrl = character.selectedPantsColor?.imageUrl || pants?.imageUrl;
    const hatImageUrl = character.selectedHatColor?.imageUrl || hat?.imageUrl;
    const hairImageUrl = character.selectedHairColor?.imageUrl || hair?.imageUrl;
    const faceImageUrl = face?.imageUrl;

    const partStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none'
    };

    return (
        <div className="relative w-16 h-24 bg-white rounded-lg shadow-sm border border-pink-100 p-1 flex items-center justify-center overflow-hidden">
            <div className="relative w-full h-full">
                {pantsImageUrl && <img src={pantsImageUrl} alt="pants" style={{ ...partStyle, zIndex: 1 }} referrerPolicy="no-referrer" />}
                {shirtImageUrl && <img src={shirtImageUrl} alt="shirt" style={{ ...partStyle, zIndex: 2 }} referrerPolicy="no-referrer" />}
                {faceImageUrl && <img src={faceImageUrl} alt="face" style={{ ...partStyle, zIndex: 3 }} referrerPolicy="no-referrer" />}
                {hairImageUrl && <img src={hairImageUrl} alt="hair" style={{ ...partStyle, zIndex: 4 }} referrerPolicy="no-referrer" />}
                {hatImageUrl && <img src={hatImageUrl} alt="hat" style={{ ...partStyle, zIndex: 5 }} referrerPolicy="no-referrer" />}
            </div>
        </div>
    );
};

export const CollectionPage: React.FC<CollectionPageProps> = ({ navigateTo, onCustomize, onAddToCart, templates: propTemplates, onZoomImage, allParts, frames }) => {
    const { t } = useLanguage();
    const { category: urlCategory, templateId: urlTemplateId } = useParams();
    const navigate = useNavigate();
    
    // 1. Initialize from Cache immediately
    const [displayTemplates, setDisplayTemplates] = useState<CollectionTemplate[]>(() => {
        const cached = getCachedTemplates();
        if (cached && cached.length > 0) return cached;
        return (propTemplates && propTemplates.length > 0) ? propTemplates : COLLECTION_TEMPLATES;
    });

    // 2. Sync with Prop when server data arrives
    useEffect(() => {
        if (propTemplates && propTemplates.length > 0) {
            setDisplayTemplates(propTemplates);
        }
    }, [propTemplates]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState(t('common.all'));
    const [selectedTemplate, setSelectedTemplate] = useState<CollectionTemplate | null>(null);
    const [customConfig, setCustomConfig] = useState<FrameConfig | null>(null);
    const [orderNote, setOrderNote] = useState('');
    const [charmSearch, setCharmSearch] = useState('');
    const [editingCharacterId, setEditingCharacterId] = useState<number | null>(null);

    // Handle initial template selection from URL
    useEffect(() => {
        if (urlTemplateId && displayTemplates.length > 0) {
            const template = displayTemplates.find(t => t.id === urlTemplateId);
            if (template) {
                setSelectedTemplate(template);
                setCustomConfig({ ...template.config, templateId: template.id });
                
                // Also set active category if it matches
                if (template.category) {
                    setActiveCategory(template.category);
                }
            }
        }
    }, [urlTemplateId, displayTemplates]);

    const partsByType = useMemo(() => {
        const result: Record<string, LegoPart[]> = {
            hair: [], face: [], shirt: [], pants: [], accessory: [], pet: [], hat: [], set: []
        };
        (Object.values(allParts) as LegoPart[]).forEach(p => {
            // Filter out out-of-stock items
            if (result[p.type] && (p.stock === undefined || p.stock > 0)) {
                result[p.type].push(p);
            }
        });
        return result;
    }, [allParts]);

    const categories = useMemo(() => {
        const dynamicCats = new Set<string>();
        displayTemplates.forEach(t => {
            if (t.category && t.category.trim() !== '') {
                dynamicCats.add(t.category.trim());
            }
        });
        return [t('common.all'), ...Array.from(dynamicCats).sort()];
    }, [displayTemplates, t]);

    const filteredTemplates = useMemo(() => {
        return displayTemplates.filter(template => {
            const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === t('common.all') || template.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [displayTemplates, searchTerm, activeCategory, t]);

    const isInitialLoading = useMemo(() => {
        return displayTemplates.length === 0;
    }, [displayTemplates]);

    const handleSelectTemplate = (template: CollectionTemplate) => {
        const categorySlug = slugify(template.category || 'all');
        navigate(`/collection/${categorySlug}/${template.id}`, { replace: true });
        setSelectedTemplate(template);
        setCustomConfig({ ...template.config, templateId: template.id });
        setOrderNote('');
    };

    const handleCloseModal = () => {
        setSelectedTemplate(null);
        setEditingCharacterId(null);
        navigate('/collection', { replace: true });
    };

    const updateCharacterQuantity = (charId: number, delta: number) => {
        if (!customConfig || !selectedTemplate) return;
        
        const currentChars = customConfig.characters;
        const targetChar = currentChars.find(c => c.id === charId);
        if (!targetChar) return;

        if (delta > 0) {
            const newChar = { ...targetChar, id: Date.now() + Math.floor(Math.random() * 1000) };
            setCustomConfig({ ...customConfig, characters: [...currentChars, newChar] });
        } else {
            // Find all characters that are "identical" to this one
            const isIdentical = (c1: LegoCharacterConfig, c2: LegoCharacterConfig) => {
                return c1.shirt?.id === c2.shirt?.id && 
                       c1.pants?.id === c2.pants?.id && 
                       c1.hat?.id === c2.hat?.id &&
                       c1.selectedShirtColor?.hex === c2.selectedShirtColor?.hex &&
                       c1.selectedPantsColor?.hex === c2.selectedPantsColor?.hex;
            };

            const identicalChars = currentChars.filter(c => isIdentical(c, targetChar));
            if (identicalChars.length <= 1 && currentChars.length <= 1) return; // Keep at least one char if it's the last one? 
            // Actually, allow removing if there are other characters.
            
            const indexToRemove = currentChars.findLastIndex(c => isIdentical(c, targetChar));
            if (indexToRemove !== -1) {
                const newChars = [...currentChars];
                newChars.splice(indexToRemove, 1);
                setCustomConfig({ ...customConfig, characters: newChars });
            }
        }
    };

    const addDefaultCharacter = () => {
        if (!customConfig) return;
        const firstChar = customConfig.characters[0];
        
        // Default parts if no characters exist
        const defaultParts = {
            hair: partsByType.hair.find(p => p.id.includes('hair-1')) || partsByType.hair[0],
            face: partsByType.face.find(p => p.id.includes('face-1')) || partsByType.face[0],
            shirt: partsByType.shirt[0],
            pants: partsByType.pants[0],
            hat: partsByType.hat?.[0],
        };

        const newChar: LegoCharacterConfig = firstChar 
            ? { ...firstChar, id: Date.now(), x: 50, y: 50 }
            : { 
                id: Date.now(), 
                x: 50, y: 50, 
                rotation: 0, 
                scale: 1,
                ...defaultParts,
                selectedShirtColor: defaultParts.shirt?.colors?.[0],
                selectedPantsColor: defaultParts.pants?.colors?.[0],
                selectedHatColor: defaultParts.hat?.colors?.[0],
                selectedHairColor: defaultParts.hair?.colors?.[0],
            };
        
        setCustomConfig({ ...customConfig, characters: [...customConfig.characters, newChar] });
        setEditingCharacterId(newChar.id);
    };

    const updateCharmQuantity = (partId: string, delta: number) => {
        if (!customConfig || !selectedTemplate) return;
        
        const currentItems = customConfig.draggableItems;
        const group = groupedTemplateCharms.find(g => g.partId === partId);
        if (!group) return;
        
        const currentInConfig = currentItems.filter(i => group.originalItems.some(oi => oi.id === i.id));
        const currentCount = currentInConfig.length;
        const newCount = Math.max(0, Math.min(group.originalItems.length, currentCount + delta));
        
        if (newCount === currentCount) return;
        
        let newDraggableItems = [...currentItems];
        
        if (delta > 0) {
            // Add items from original template that are not in config
            const itemsToAdd = group.originalItems.filter(oi => !currentItems.some(ci => ci.id === oi.id)).slice(0, delta);
            newDraggableItems = [...newDraggableItems, ...itemsToAdd];
        } else {
            // Remove items from config that match this partId and were in template
            const itemsToRemove = currentInConfig.slice(0, Math.abs(delta));
            const idsToRemove = new Set(itemsToRemove.map(i => i.id));
            newDraggableItems = newDraggableItems.filter(i => !idsToRemove.has(i.id));
        }
        
        setCustomConfig({ ...customConfig, draggableItems: newDraggableItems });
    };

    const removeSpecificCharacter = (charId: number) => {
        if (!customConfig) return;
        if (customConfig.characters.length <= 1) return;
        setCustomConfig({
            ...customConfig,
            characters: customConfig.characters.filter(c => c.id !== charId)
        });
        if (editingCharacterId === charId) setEditingCharacterId(null);
    };

    const handleBuyNow = () => {
        if (!customConfig) return;
        const finalConfig = {
            ...customConfig,
            customFormData: {
                ...(customConfig.customFormData || {}),
                order_note: orderNote
            }
        };
        onAddToCart(finalConfig, false);
        navigateTo('checkout');
        setSelectedTemplate(null);
        setEditingCharacterId(null);
    };

    const handleQuickAddToCart = () => {
        if (!customConfig) return;
        const finalConfig = {
            ...customConfig,
            customFormData: {
                ...(customConfig.customFormData || {}),
                order_note: orderNote
            }
        };
        onAddToCart(finalConfig, true);
        setSelectedTemplate(null);
        setEditingCharacterId(null);
    };

    const currentPrice = useMemo(() => {
        if (!customConfig || !selectedTemplate) return 0;
        
        // If simple, use template price as base and add extra charms + characters
        if (selectedTemplate.isSimple) {
            const basePrice = selectedTemplate.price || 0;
            
            // Calculate characters price
            const charactersPrice = customConfig.characters.reduce((sum, char) => {
                let charSum = CHARACTER_BASE_PRICE; // Base fee per character
                if (char.customPrintPrice) charSum += char.customPrintPrice;
                
                const addPartCost = (part: LegoPart | undefined) => {
                    if (part) charSum += (part.price || 0);
                };
                addPartCost(char.shirt);
                addPartCost(char.pants);
                addPartCost(char.hat);
                
                if (char.selectedShirtColor?.price) charSum += char.selectedShirtColor.price;
                if (char.selectedPantsColor?.price) charSum += char.selectedPantsColor.price;
                
                return sum + charSum;
            }, 0);

            const extraCharmsPrice = customConfig.draggableItems.reduce((sum, item) => {
                const part = allParts[item.partId];
                return sum + (part?.price || 0);
            }, 0);
            
            return basePrice + charactersPrice + extraCharmsPrice;
        }

        const { totalPrice } = calculatePrice(customConfig, allParts, frames);
        return totalPrice;
    }, [customConfig, selectedTemplate, allParts, frames]);

    const groupedCharacters = useMemo(() => {
        if (!customConfig) return [];
        const groups: { char: LegoCharacterConfig, count: number, ids: number[] }[] = [];
        
        const isIdentical = (c1: LegoCharacterConfig, c2: LegoCharacterConfig) => {
            return c1.shirt?.id === c2.shirt?.id && 
                   c1.pants?.id === c2.pants?.id && 
                   c1.hat?.id === c2.hat?.id &&
                   c1.selectedShirtColor?.hex === c2.selectedShirtColor?.hex &&
                   c1.selectedPantsColor?.hex === c2.selectedPantsColor?.hex;
        };

        customConfig.characters.forEach(char => {
            const existingGroup = groups.find(g => isIdentical(g.char, char));
            if (existingGroup) {
                existingGroup.count++;
                existingGroup.ids.push(char.id);
            } else {
                groups.push({ char, count: 1, ids: [char.id] });
            }
        });
        
        return groups;
    }, [customConfig]);

    const groupedTemplateCharms = useMemo(() => {
        if (!selectedTemplate) return [];
        const groups: Record<string, { partId: string, originalItems: DraggableItem[], part: LegoPart }> = {};
        
        selectedTemplate.config.draggableItems.forEach(item => {
            if (!groups[item.partId]) {
                groups[item.partId] = { 
                    partId: item.partId, 
                    originalItems: [], 
                    part: allParts[item.partId] 
                };
            }
            groups[item.partId].originalItems.push(item);
        });
        
        return Object.values(groups);
    }, [selectedTemplate, allParts]);

    const extraCharms = useMemo(() => {
        if (!allParts) return [];
        // Filter for accessories, pets, and hats that are NOT already in the template
        // AND are in stock
        const templatePartIds = new Set(selectedTemplate?.config.draggableItems.map(i => i.partId) || []);
        return (Object.values(allParts) as LegoPart[]).filter(p => 
            (p.type === 'accessory' || p.type === 'pet' || p.type === 'hat') && 
            !templatePartIds.has(p.id) &&
            (p.stock === undefined || p.stock > 0)
        );
    }, [allParts, selectedTemplate]);

    const filteredExtraCharms = useMemo(() => {
        if (!charmSearch) return extraCharms;
        const search = charmSearch.toLowerCase();
        return extraCharms.filter(p => p.name.toLowerCase().includes(search));
    }, [extraCharms, charmSearch]);

    const addExtraCharm = (part: LegoPart) => {
        if (!customConfig) return;
        const newItem: DraggableItem = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            partId: part.id,
            type: part.type === 'hat' ? 'hat' : (part.type === 'pet' ? 'pet' : 'accessory'),
            x: 50, y: 50, rotation: 0, scale: 1,
            selectedColor: part.colors?.[0]
        };
        setCustomConfig({
            ...customConfig,
            draggableItems: [...(customConfig.draggableItems || []), newItem]
        });
    };

    const groupedAddedExtraCharms = useMemo(() => {
        if (!customConfig || !selectedTemplate) return [];
        
        const templateItemIds = new Set(selectedTemplate.config.draggableItems.map(i => i.id));
        const extraItems = customConfig.draggableItems.filter(i => !templateItemIds.has(i.id));
        
        const groups: Record<string, { key: string, partId: string, items: DraggableItem[], part: LegoPart, selectedColor?: OutfitColor }> = {};
        
        extraItems.forEach(item => {
            const colorKey = item.selectedColor?.hex || 'default';
            const key = `${item.partId}_${colorKey}`;
            if (!groups[key]) {
                groups[key] = { 
                    key,
                    partId: item.partId, 
                    items: [], 
                    part: allParts[item.partId],
                    selectedColor: item.selectedColor
                };
            }
            groups[key].items.push(item);
        });
        
        return Object.values(groups);
    }, [customConfig, selectedTemplate, allParts]);

    const updateExtraCharmQuantity = (partId: string, delta: number, selectedColor?: OutfitColor) => {
        if (!customConfig) return;
        
        const currentItems = customConfig.draggableItems;
        const matchingItems = currentItems.filter(i => 
            i.partId === partId && 
            (selectedColor ? i.selectedColor?.hex === selectedColor.hex : !i.selectedColor)
        );
        const currentCount = matchingItems.length;
        const newCount = Math.max(0, currentCount + delta);
        
        if (newCount === currentCount) return;
        
        let newDraggableItems = [...currentItems];
        if (delta > 0) {
            const part = allParts[partId];
            for (let i = 0; i < delta; i++) {
                newDraggableItems.push({
                    id: Date.now() + Math.floor(Math.random() * 1000) + i,
                    partId,
                    type: part.type === 'hat' ? 'hat' : (part.type === 'pet' ? 'pet' : 'accessory'),
                    x: 50, y: 50, rotation: 0, scale: 1,
                    selectedColor
                });
            }
        } else {
            const itemsToRemove = matchingItems.slice(0, Math.abs(delta));
            const idsToRemove = new Set(itemsToRemove.map(i => i.id));
            newDraggableItems = newDraggableItems.filter(i => !idsToRemove.has(i.id));
        }
        
        setCustomConfig({ ...customConfig, draggableItems: newDraggableItems });
    };

    const updateExtraCharmColor = (partId: string, oldColor: OutfitColor | undefined, newColor: OutfitColor) => {
        if (!customConfig) return;
        const newItems = customConfig.draggableItems.map(item => {
            if (item.partId === partId && (oldColor ? item.selectedColor?.hex === oldColor.hex : !item.selectedColor)) {
                return { ...item, selectedColor: newColor };
            }
            return item;
        });
        setCustomConfig({ ...customConfig, draggableItems: newItems });
    };

    const removeExtraCharm = (itemId: number) => {
        if (!customConfig) return;
        setCustomConfig({
            ...customConfig,
            draggableItems: customConfig.draggableItems.filter(i => i.id !== itemId)
        });
    };

    return ( 
      <div className="min-h-screen bg-[#f1f3f5] pb-20 font-body text-site-text relative">
        {/* Simple Clean Header */}
        {selectedTemplate && customConfig && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={handleCloseModal}>
                <div 
                    className="bg-white w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">{selectedTemplate.name}</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('collection.quick_customize_title')}</p>
                        </div>
                        <button onClick={handleCloseModal} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto px-4 py-6 sm:p-6 space-y-8 custom-scrollbar">
                        {/* Preview Image */}
                        <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gray-100 shadow-inner relative group flex items-center justify-center">
                            {selectedTemplate.isSimple ? (
                                <div className="relative w-full h-full p-4 sm:p-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 content-center">
                                    {customConfig.characters.length === 0 && customConfig.draggableItems.length === 0 && (
                                        <div className="text-center">
                                            <img 
                                                src={selectedTemplate.imageUrl} 
                                                alt={selectedTemplate.name} 
                                                className="max-h-48 mx-auto object-contain rounded-xl opacity-50 grayscale" 
                                            />
                                            <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vui lòng chọn nhân vật & charm</p>
                                        </div>
                                    )}
                                    {customConfig.characters.map((char) => (
                                        <div key={char.id} className="transform scale-125">
                                            <CharacterPreview character={char} />
                                        </div>
                                    ))}
                                    {customConfig.draggableItems.map((item) => (
                                        <div key={item.id} className="w-12 h-12 bg-white rounded-xl shadow-sm border border-pink-50 p-1 flex items-center justify-center">
                                            <img src={item.selectedColor?.imageUrl || allParts[item.partId]?.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <img 
                                        src={selectedTemplate.imageUrl} 
                                        alt={selectedTemplate.name} 
                                        className="w-full h-full object-cover" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                                </>
                            )}
                        </div>

                        {/* Characters Section */}
                        {(selectedTemplate.isSimple || groupedCharacters.length > 0) && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Nhân vật ({customConfig.characters.length})
                                    </h3>
                                    <button 
                                        onClick={addDefaultCharacter}
                                        className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
                                    >
                                        + Thêm nhân vật
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {customConfig.characters.map((char, idx) => (
                                        <div 
                                            key={char.id} 
                                            className={`flex flex-col rounded-2xl border-2 transition-all cursor-pointer ${editingCharacterId === char.id ? 'border-primary bg-primary/5' : 'border-primary/10 bg-white shadow-sm hover:border-primary/30'}`}
                                            onClick={() => setEditingCharacterId(editingCharacterId === char.id ? null : char.id)}
                                        >
                                            <div className="flex items-center gap-4 p-3">
                                                <CharacterPreview character={char} />
                                                <div className="flex-grow">
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">Nhân vật {idx + 1}</p>
                                                    <p className="text-[9px] text-primary font-black uppercase tracking-tighter">
                                                        {editingCharacterId === char.id ? 'Đang chỉnh sửa' : 'Nhấn để tùy chỉnh'}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-100 p-1" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => removeSpecificCharacter(char.id)}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-all shadow-sm"
                                                        title="Xóa nhân vật"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Part Selector */}
                                            {editingCharacterId === char.id && (
                                                <div className="p-4 border-t border-primary/10 space-y-5 bg-white rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
                                                    {(['hair', 'face', 'shirt', 'pants', 'hat'] as const).map(type => (
                                                        <div key={type} className="space-y-2.5">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                                    {type === 'hair' ? 'Tóc' : type === 'face' ? 'Mặt' : type === 'shirt' ? 'Áo' : type === 'pants' ? 'Quần' : 'Mũ'}
                                                                </label>
                                                                {char[type] && (
                                                                    <span className="text-[8px] font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded uppercase">{char[type].name}</span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                                {type === 'hat' && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newChars = customConfig.characters.map(c => c.id === char.id ? { ...c, [type]: undefined } : c);
                                                                            setCustomConfig({ ...customConfig, characters: newChars });
                                                                        }}
                                                                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${!char[type] ? 'border-primary bg-primary/5' : 'border-gray-100'}`}
                                                                    >
                                                                        NONE
                                                                    </button>
                                                                )}
                                                                {partsByType[type].map(part => (
                                                                    <button 
                                                                        key={part.id}
                                                                        onClick={() => {
                                                                            const newChars = customConfig.characters.map(c => {
                                                                                if (c.id === char.id) {
                                                                                    const updated = { ...c, [type]: part };
                                                                                    if (type === 'shirt') updated.selectedShirtColor = part.colors?.[0];
                                                                                    if (type === 'pants') updated.selectedPantsColor = part.colors?.[0];
                                                                                    if (type === 'hair') updated.selectedHairColor = part.colors?.[0];
                                                                                    if (type === 'hat') updated.selectedHatColor = part.colors?.[0];
                                                                                    return updated;
                                                                                }
                                                                                return c;
                                                                            });
                                                                            setCustomConfig({ ...customConfig, characters: newChars });
                                                                        }}
                                                                        className={`w-10 h-10 rounded-lg border-2 flex-shrink-0 p-1 transition-all ${char[type]?.id === part.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
                                                                    >
                                                                        <img src={part.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            {/* Color selection for the part */}
                                                            {char[type]?.colors && char[type].colors.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 pt-1">
                                                                    {char[type].colors.map(color => (
                                                                        <button
                                                                            key={color.hex}
                                                                            onClick={() => {
                                                                                const newChars = customConfig.characters.map(c => {
                                                                                    if (c.id === char.id) {
                                                                                        const updated = { ...c };
                                                                                        if (type === 'shirt') updated.selectedShirtColor = color;
                                                                                        if (type === 'pants') updated.selectedPantsColor = color;
                                                                                        if (type === 'hat') updated.selectedHatColor = color;
                                                                                        if (type === 'hair') updated.selectedHairColor = color;
                                                                                        return updated;
                                                                                    }
                                                                                    return c;
                                                                                });
                                                                                setCustomConfig({ ...customConfig, characters: newChars });
                                                                            }}
                                                                            className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                                                                                (type === 'shirt' ? char.selectedShirtColor?.hex : 
                                                                                 type === 'pants' ? char.selectedPantsColor?.hex : 
                                                                                 type === 'hair' ? char.selectedHairColor?.hex :
                                                                                 char.selectedHatColor?.hex) === color.hex 
                                                                                ? 'border-primary scale-110 shadow-md' 
                                                                                : 'border-gray-100'
                                                                            }`}
                                                                            style={{ backgroundColor: color.hex }}
                                                                            title={color.name}
                                                                        >
                                                                            {(type === 'shirt' ? char.selectedShirtColor?.hex : 
                                                                              type === 'pants' ? char.selectedPantsColor?.hex : 
                                                                              type === 'hair' ? char.selectedHairColor?.hex :
                                                                              char.selectedHatColor?.hex) === color.hex && (
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Charms List (From Template) */}
                        {!selectedTemplate.isSimple && groupedTemplateCharms.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Phụ kiện theo mẫu
                                    </h3>
                                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        {customConfig.draggableItems.filter(i => selectedTemplate.config.draggableItems.some(oi => oi.id === i.id)).length} / {selectedTemplate.config.draggableItems.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {groupedTemplateCharms.map((group) => {
                                        const { part, originalItems, partId } = group;
                                        const currentInConfig = customConfig.draggableItems.filter(i => originalItems.some(oi => oi.id === i.id));
                                        const currentCount = currentInConfig.length;
                                        const maxCount = originalItems.length;
                                        const isSelected = currentCount > 0;

                                        return (
                                            <div 
                                                key={partId}
                                                className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center p-1 border border-gray-100">
                                                    <img src={part?.imageUrl || partId} alt="Charm" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                </div>
                                                <div className="flex-grow text-left">
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{part?.name || 'Phụ kiện'}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold">{formatCurrency(part?.price || 0)}</p>
                                                </div>
                                                
                                                <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-1">
                                                    <button 
                                                        onClick={() => updateCharmQuantity(partId, -1)}
                                                        disabled={currentCount === 0}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${currentCount === 0 ? 'text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-primary'}`}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                                    </button>
                                                    <div className="flex flex-col items-center min-w-[20px]">
                                                        <span className="text-xs font-black text-gray-900 leading-none">{currentCount}</span>
                                                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">/{maxCount}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => updateCharmQuantity(partId, 1)}
                                                        disabled={currentCount === maxCount}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${currentCount === maxCount ? 'text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-primary'}`}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Extra Charms Section */}
                        {(selectedTemplate.isSimple || extraCharms.length > 0) && (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        {selectedTemplate.isSimple ? 'Chọn thêm Charm (Phụ kiện)' : 'Thêm phụ kiện khác'}
                                    </h3>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            placeholder="Tìm kiếm charm..."
                                            value={charmSearch}
                                            onChange={(e) => setCharmSearch(e.target.value)}
                                            className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-[10px] focus:outline-none focus:border-primary/30 transition-all"
                                        />
                                        <svg className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredExtraCharms.map((part) => (
                                        <button
                                            key={part.id}
                                            onClick={() => addExtraCharm(part)}
                                            className="relative aspect-square rounded-2xl border-2 border-gray-100 hover:border-primary transition-all p-1 bg-white group"
                                        >
                                            <img 
                                                src={part.imageUrl} 
                                                alt={part.name} 
                                                className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                                                referrerPolicy="no-referrer"
                                            />
                                            <div className="absolute bottom-0 right-0 bg-primary/10 text-primary rounded-tl-xl px-1.5 py-0.5 text-[8px] font-black">
                                                +{formatCurrency(part.price).replace('₫', '')}
                                            </div>
                                        </button>
                                    ))}
                                    {filteredExtraCharms.length === 0 && (
                                        <div className="col-span-full py-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                            Không tìm thấy charm phù hợp
                                        </div>
                                    )}
                                    {!selectedTemplate.isSimple && (
                                        <button 
                                            onClick={() => onCustomize(selectedTemplate)}
                                            className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all bg-gray-50/50"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Xem thêm</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Added Extra Charms */}
                        {groupedAddedExtraCharms.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                    Phụ kiện đã thêm
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {groupedAddedExtraCharms.map((group) => {
                                        const { part, items, partId, selectedColor, key } = group;
                                        return (
                                            <div key={key} className="flex flex-col p-3 rounded-2xl border border-primary/10 bg-primary/5 space-y-3">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-white rounded-xl p-1 shadow-sm border border-primary/5">
                                                        <img src={selectedColor?.imageUrl || part?.imageUrl} alt={part?.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                    </div>
                                                    <div className="flex-grow text-left">
                                                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">{part?.name}</p>
                                                        <p className="text-[9px] text-primary font-bold">{formatCurrency(part?.price || 0)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-white rounded-lg border border-primary/10 p-0.5">
                                                        <button 
                                                            onClick={() => updateExtraCharmQuantity(partId, -1, selectedColor)}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-primary transition-all"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                                        </button>
                                                        <span className="text-[10px] font-black text-gray-900 min-w-[12px] text-center">{items.length}</span>
                                                        <button 
                                                            onClick={() => updateExtraCharmQuantity(partId, 1, selectedColor)}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-primary transition-all"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Color selection for charm */}
                                                {part?.colors && part.colors.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-1 border-t border-primary/5 pt-3">
                                                        {part.colors.map(color => (
                                                            <button
                                                                key={color.hex}
                                                                onClick={() => updateExtraCharmColor(partId, selectedColor, color)}
                                                                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                                                                    selectedColor?.hex === color.hex 
                                                                    ? 'border-primary scale-110 shadow-sm' 
                                                                    : 'border-white'
                                                                }`}
                                                                style={{ backgroundColor: color.hex }}
                                                                title={color.name}
                                                            >
                                                                {selectedColor?.hex === color.hex && (
                                                                    <div className="w-1 h-1 rounded-full bg-white shadow-sm"></div>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Order Notes */}
                        <div className="space-y-3">
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                {t('common.order_note')}
                            </h3>
                            <textarea 
                                value={orderNote}
                                onChange={e => setOrderNote(e.target.value)}
                                placeholder={t('common.order_note_placeholder')}
                                rows={3}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-4 py-6 sm:p-6 border-t border-gray-100 bg-white space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-1">{t('common.total')}</span>
                                <span className="text-2xl font-black text-gray-900">{formatCurrency(currentPrice)}</span>
                            </div>
                            <button 
                                onClick={() => onCustomize(selectedTemplate)}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                                {t('common.customize')} 
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleQuickAddToCart}
                                className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                🛒 {t('common.add_to_cart')}
                            </button>
                            <button 
                                onClick={handleBuyNow}
                                className="flex-[1.5] py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                ⚡ Mua ngay
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Simple Clean Header */}
        <div className="bg-white border-b border-gray-100 pt-16 pb-8 px-4">
            <div className="container mx-auto text-center">
                <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4 text-gray-900 leading-tight">
                    {t('collection.title')} <span className="text-primary italic">{t('collection.subtitle')}</span>
                </h1>
                
                {/* Search Bar */}
                <div className="max-w-md mx-auto relative px-2 mt-6">
                    <input 
                        type="text" 
                        placeholder={t('collection.search_placeholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-6 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm transition-all outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>
        </div>

        {/* Filter Section */}
        <div className="sticky top-16 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 shadow-sm">
            <div className="container mx-auto px-4 overflow-x-auto no-scrollbar flex items-center gap-2">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            activeCategory === cat 
                                ? 'bg-primary text-white shadow-md' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Product Grid */}
        <div className="container mx-auto px-3 sm:px-6 py-8">
            {isInitialLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
                            <div className="aspect-[3/4] bg-gray-200"></div>
                            <div className="p-5 space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-10 bg-gray-200 rounded-xl w-full mt-4"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {filteredTemplates.map((template, index) => {
                    const { totalPrice } = calculatePrice(template.config, allParts, frames);
                    const purchaseCount = template.purchaseCount || 0;
                    
                    return ( 
                        <div key={template.id || index} className="group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full">
                            {/* Image Container */}
                            <div className="relative aspect-[3/4] overflow-hidden bg-gray-50 cursor-pointer" onClick={() => handleSelectTemplate(template)}>
                                <SmartImage 
                                    src={template.imageUrl} 
                                    alt={template.name} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                />
                                
                                <div className="absolute top-2 left-2 right-2 flex flex-col gap-1.5 pointer-events-none">
                                    <div className="bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-black text-primary uppercase tracking-tight shadow-sm border border-primary/10 w-fit">
                                        ✨ {t('collection.customizable')}
                                    </div>
                                    {template.category && (
                                        <div className="bg-gray-900/80 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-bold text-white uppercase tracking-tight shadow-sm w-fit">
                                            {template.category}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="p-3 sm:p-5 flex flex-col flex-grow">
                                <h3 className="text-xs sm:text-base font-bold text-gray-900 mb-2 line-clamp-1">
                                    {template.name}
                                </h3>
                                
                                <div className="flex items-center gap-1.5 mb-4">
                                    <div className="flex items-center gap-1 bg-blue-50/80 px-1.5 py-1 rounded-lg">
                                        <span className="text-[10px]">⭐</span>
                                        <span className="text-[8px] sm:text-[9px] text-blue-700 font-black uppercase">{t('collection.trusted')}</span>
                                    </div>
                                    <div className="text-[8px] sm:text-[9px] text-gray-400 font-bold leading-tight">
                                        {purchaseCount > 0 ? `${purchaseCount} ${t('collection.orders')}` : t('collection.hot')}
                                    </div>
                                </div>

                                <div className="mt-auto space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="text-[8px] text-gray-400 font-black block uppercase mb-0.5 tracking-tighter">{t('collection.base_price')}</span>
                                            <span className="text-sm sm:text-lg font-black text-gray-900 leading-none">{formatCurrency(totalPrice)}</span>
                                        </div>
                                        <div className="bg-gray-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-gray-500 mb-0.5">
                                            {template.config.characters.length} {t('collection.characters_count')}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleSelectTemplate(template)} 
                                        className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-primary transition-all active:scale-95 group/btn"
                                    >
                                        {t('collection.select_template')}
                                        <svg className="w-3.5 h-3.5 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div> 
                    );
                  })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="text-5xl mb-4 opacity-50">🔍</div>
                    <h3 className="text-lg font-bold text-gray-800">{t('collection.no_results')}</h3>
                    <button onClick={() => {setSearchTerm(''); setActiveCategory(t('common.all'))}} className="mt-4 text-primary font-bold hover:underline">{t('collection.view_all')}</button>
                </div>
            )}
        </div>
      </div> 
    );
};
