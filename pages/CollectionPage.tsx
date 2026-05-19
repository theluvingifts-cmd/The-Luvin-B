
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CollectionTemplate, FrameConfig, FrameOption, LegoPart, Page, DraggableItem, LegoCharacterConfig, OutfitColor } from '../types';
import { COLLECTION_TEMPLATES } from '../constants';
import { calculatePrice, formatCurrency, CHARACTER_BASE_PRICE, getEffectivePrice } from '../utils/pricing';
import { slugify } from '../utils/helpers';
import { SmartImage } from '../components/shared/SmartImage';
import { useLanguage } from '../src/contexts/LanguageContext';
import { CharacterPreview } from '../components/shared/CharacterPreview';
import { getCachedTemplates } from '../services/configService';

const getOutOfStockParts = (config: FrameConfig | null, allParts: Record<string, LegoPart>) => {
    if (!config) return [];
    const oos: string[] = [];
    
    // Check characters
    config.characters.forEach(char => {
        if (char.hair && allParts[char.hair.id] && allParts[char.hair.id].stock === 0) oos.push(char.hair.name);
        if (char.face && allParts[char.face.id] && allParts[char.face.id].stock === 0) oos.push(char.face.name);
        if (char.shirt && allParts[char.shirt.id] && allParts[char.shirt.id].stock === 0) oos.push(char.shirt.name);
        if (char.pants && allParts[char.pants.id] && allParts[char.pants.id].stock === 0) oos.push(char.pants.name);
        if (char.hat && allParts[char.hat.id] && allParts[char.hat.id].stock === 0) oos.push(char.hat.name);
        if (char.set && allParts[char.set.id] && allParts[char.set.id].stock === 0) oos.push(char.set.name);
    });
    
    // Check draggable items
    config.draggableItems.forEach(item => {
        const part = allParts[item.partId];
        if (part && part.stock === 0) oos.push(part.name);
    });
    
    return Array.from(new Set(oos)); // Unique names
};

interface CollectionPageProps {
    navigateTo: (page: Page) => void, 
    onCustomize: (template: CollectionTemplate) => void, 
    onAddToCart: (config: FrameConfig, openCartPanel?: boolean) => void,
    templates?: CollectionTemplate[],
    onZoomImage: (url: string) => void,
    allParts: Record<string, LegoPart>,
    frames: FrameOption[],
    isLoadingParts?: boolean
}

export const CollectionPage: React.FC<CollectionPageProps> = ({ navigateTo, onCustomize, onAddToCart, templates: propTemplates, onZoomImage, allParts, frames, isLoadingParts }) => {
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

    // Filter and Sort states
    const [priceRange, setPriceRange] = useState<'all' | 'under300' | '300to500' | 'above500'>('all');
    const [charCount, setCharCount] = useState<'all' | '1' | '2' | '3plus'>('all');
    const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'mostPurchased'>('default');

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

    const categories = useMemo(() => {
        const dynamicCats = new Set<string>();
        displayTemplates.forEach(t => {
            if (t.category && t.category.trim() !== '') {
                dynamicCats.add(t.category.trim());
            }
        });
        return [t('common.all'), ...Array.from(dynamicCats).sort()];
    }, [displayTemplates, t]);

    const partsByType = useMemo(() => {
        const result: Record<string, LegoPart[]> = {
            hair: [], face: [], shirt: [], pants: [], accessory: [], pet: [], hat: [], set: []
        };
        (Object.values(allParts) as LegoPart[]).forEach(p => {
            // Keep all parts in the map, but we'll handle the visual display of OOS elsewhere
            // or filter them for the user selection if desired. 
            // Change: Don't filter out negative stock here, treat it as OOS but available to see.
            if (result[p.type]) {
                result[p.type].push(p);
            }
        });
        return result;
    }, [allParts]);

    // Update active category when URL changes (category only)
    useEffect(() => {
        if (urlCategory && !urlTemplateId && displayTemplates.length > 0) {
            const catMatch = categories.find(cat => slugify(cat) === urlCategory);
            if (catMatch) {
                setActiveCategory(catMatch);
            }
        }
    }, [urlCategory, urlTemplateId, displayTemplates, categories]);

    useEffect(() => {
        if (selectedTemplate) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedTemplate]);

    // Derived counts for filters
    const filterCounts = useMemo(() => {
        const counts = {
            categories: {} as Record<string, number>,
            prices: { all: 0, under300: 0, '300to500': 0, above500: 0 },
            characters: { all: 0, '1': 0, '2': 0, '3plus': 0 }
        };

        displayTemplates.forEach(template => {
            // Category counts
            const cat = template.category || t('common.all');
            counts.categories[cat] = (counts.categories[cat] || 0) + 1;
            counts.categories[t('common.all')] = (counts.categories[t('common.all')] || 0) + 1;

            const { totalPrice } = calculatePrice(template.config, allParts, frames, displayTemplates);
            
            // Price counts
            counts.prices.all++;
            if (totalPrice < 300000) counts.prices.under300++;
            else if (totalPrice >= 300000 && totalPrice <= 500000) counts.prices['300to500']++;
            else if (totalPrice > 500000) counts.prices.above500++;

            // Character counts
            const numChars = template.config.characters.length;
            counts.characters.all++;
            if (numChars === 1) counts.characters['1']++;
            else if (numChars === 2) counts.characters['2']++;
            else if (numChars >= 3) counts.characters['3plus']++;
        });

        return counts;
    }, [displayTemplates, allParts, frames, t]);

    const filteredTemplates = useMemo(() => {
        let result = displayTemplates.filter(template => {
            const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === t('common.all') || template.category === activeCategory;
            
            // Price Filter
            const { totalPrice } = calculatePrice(template.config, allParts, frames, displayTemplates);
            let matchesPrice = true;
            if (priceRange === 'under300') matchesPrice = totalPrice < 300000;
            else if (priceRange === '300to500') matchesPrice = totalPrice >= 300000 && totalPrice <= 500000;
            else if (priceRange === 'above500') matchesPrice = totalPrice > 500000;

            // Character Count Filter
            const numChars = template.config.characters.length;
            let matchesChars = true;
            if (charCount === '1') matchesChars = numChars === 1;
            else if (charCount === '2') matchesChars = numChars === 2;
            else if (charCount === '3plus') matchesChars = numChars >= 3;

            return matchesSearch && matchesCategory && matchesPrice && matchesChars;
        });

        // Sorting
        if (sortBy === 'priceAsc') {
            result.sort((a, b) => {
                const priceA = calculatePrice(a.config, allParts, frames, displayTemplates).totalPrice;
                const priceB = calculatePrice(b.config, allParts, frames, displayTemplates).totalPrice;
                return priceA - priceB;
            });
        } else if (sortBy === 'priceDesc') {
            result.sort((a, b) => {
                const priceA = calculatePrice(a.config, allParts, frames, displayTemplates).totalPrice;
                const priceB = calculatePrice(b.config, allParts, frames, displayTemplates).totalPrice;
                return priceB - priceA;
            });
        } else if (sortBy === 'mostPurchased') {
            result.sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
        }

        return result;
    }, [displayTemplates, searchTerm, activeCategory, priceRange, charCount, sortBy, t, allParts, frames]);

    const isInitialLoading = useMemo(() => {
        return displayTemplates.length === 0;
    }, [displayTemplates]);

    const handleCategoryChange = (cat: string) => {
        setActiveCategory(cat);
        const categorySlug = slugify(cat);
        if (cat === t('common.all')) {
            navigate('/collection', { replace: true });
        } else {
            navigate(`/collection/${categorySlug}`, { replace: true });
        }
    };

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

    const updateTemplateCharmColor = (partId: string, oldColor: OutfitColor | undefined, newColor: OutfitColor) => {
        if (!customConfig || !selectedTemplate) return;
        const templateItemIds = new Set(selectedTemplate.config.draggableItems.map(i => i.id));
        const newItems = customConfig.draggableItems.map(item => {
            // Match items that were part of the template AND share the same partId and current color
            const isMatch = templateItemIds.has(item.id) && 
                          item.partId === partId && 
                          (oldColor ? item.selectedColor?.hex === oldColor.hex : !item.selectedColor);
            
            if (isMatch) {
                return { ...item, selectedColor: newColor };
            }
            return item;
        });
        setCustomConfig({ ...customConfig, draggableItems: newItems });
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

        const oosParts = getOutOfStockParts(customConfig, allParts);
        if ((selectedTemplate?.stock === 0) || oosParts.length > 0) {
            alert(selectedTemplate?.stock === 0 
                ? "Mẫu này hiện đang hết hàng." 
                : `Một số phụ kiện trong mẫu này hiện đang hết hàng: ${oosParts.join(', ')}. Vui lòng thay thế phụ kiện khác.`);
            return;
        }

        if (!orderNote.trim()) {
            alert(t('collection.enter_order_note'));
            scrollToNote();
            return;
        }
        const finalConfig = {
            ...customConfig,
            previewImageUrl: selectedTemplate?.imageUrl,
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

        const oosParts = getOutOfStockParts(customConfig, allParts);
        if ((selectedTemplate?.stock === 0) || oosParts.length > 0) {
            alert(selectedTemplate?.stock === 0 
                ? "Mẫu này hiện đang hết hàng." 
                : `Một số phụ kiện trong mẫu này hiện đang hết hàng: ${oosParts.join(', ')}. Vui lòng thay thế phụ kiện khác.`);
            return;
        }

        if (!orderNote.trim()) {
            alert(t('collection.enter_order_note'));
            scrollToNote();
            return;
        }
        const finalConfig = {
            ...customConfig,
            previewImageUrl: selectedTemplate?.imageUrl,
            customFormData: {
                ...(customConfig.customFormData || {}),
                order_note: orderNote
            }
        };
        onAddToCart(finalConfig, true);
        setSelectedTemplate(null);
        setEditingCharacterId(null);
    };

    const { currentPrice, originalPrice } = useMemo(() => {
        if (!customConfig || !selectedTemplate) return { currentPrice: 0, originalPrice: 0 };
        
        // Stabilize price during initial load
        if (isLoadingParts && selectedTemplate.price) {
            const current = selectedTemplate.salePrice && selectedTemplate.salePrice < selectedTemplate.price ? selectedTemplate.salePrice : selectedTemplate.price;
            return { currentPrice: current, originalPrice: selectedTemplate.price };
        }

        const { totalPrice, priceBreakdown } = calculatePrice(customConfig, allParts, frames, displayTemplates);
        const originalPrice = priceBreakdown.reduce((sum, item) => sum + (item.originalValue ?? item.value), 0);
        return { currentPrice: totalPrice, originalPrice };
    }, [customConfig, selectedTemplate, allParts, frames, displayTemplates, isLoadingParts]);

    const handleContactZalo = (templateName: string, price: number, imageUrl: string) => {
        let fullImageUrl = imageUrl;
        if (imageUrl && !imageUrl.startsWith('http')) {
            const origin = window.location.origin;
            const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
            fullImageUrl = origin + path;
        }
        const message = `${t('collection.zalo_message_prefix')}${templateName}\n- ${t('studio.price')}: ${formatCurrency(price)}\n- ${t('collection.sample_image')}${fullImageUrl}`;
        
        const openZalo = () => {
            const zaloUrl = `https://zalo.me/0964393115`;
            window.open(zaloUrl, '_blank');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(message)
                .then(() => {
                    alert(t('collection.zalo_copy_success'));
                    openZalo();
                })
                .catch(() => {
                    // Fallback to manual prompt if clipboard fails
                    const textArea = document.createElement("textarea");
                    textArea.value = message;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    textArea.style.top = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        alert(t('collection.zalo_copy_success'));
                        openZalo();
                    } catch (err) {
                        openZalo();
                        alert(t('collection.zalo_copy_error').replace('{name}', templateName));
                    }
                    document.body.removeChild(textArea);
                });
        } else {
            openZalo();
            alert(t('collection.zalo_fallback').replace('{name}', templateName));
        }
    };

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
        if (!selectedTemplate || !customConfig) return [];
        const groups: Record<string, { key: string, partId: string, originalItems: DraggableItem[], part: LegoPart, selectedColor?: OutfitColor }> = {};
        
        // Create a map of current items in customConfig for quick lookup by ID
        const currentItemsMap = new Map<string, DraggableItem>(customConfig.draggableItems.map(i => [i.id, i]));

        selectedTemplate.config.draggableItems.forEach(templateItem => {
            // Look up the current state of this template item in the active config
            const currentItem = currentItemsMap.get(templateItem.id);
            if (!currentItem) return;

            // Grouping should consider the current color to differentiate slots if the template has different colors for the same part
            const colorKey = currentItem.selectedColor?.hex || 'default';
            const key = `${templateItem.partId}_${colorKey}`;
            
            if (!groups[key]) {
                groups[key] = { 
                    key,
                    partId: templateItem.partId, 
                    originalItems: [], 
                    part: allParts[templateItem.partId],
                    selectedColor: currentItem.selectedColor
                };
            }
            // We store the template items here to know which IDs belong to this group
            groups[key].originalItems.push(templateItem);
        });
        
        return Object.values(groups);
    }, [selectedTemplate, customConfig, allParts]);

    const extraCharms = useMemo(() => {
        if (!allParts) return [];
        // Filter for accessories, pets, and hats that are NOT already in the template
        // AND are in stock
        const templatePartIds = new Set(selectedTemplate?.config.draggableItems.map(i => i.partId) || []);
        return (Object.values(allParts) as LegoPart[]).filter(p => 
            (p.type === 'accessory' || p.type === 'pet' || p.type === 'hat') && 
            !templatePartIds.has(p.id) &&
            (p.stock === undefined || p.stock === null || p.stock !== 0)
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

    const customizeSectionRef = React.useRef<HTMLDivElement>(null);
    const noteSectionRef = React.useRef<HTMLDivElement>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const scrollToCustomize = () => {
        if (customizeSectionRef.current) {
            customizeSectionRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    const scrollToNote = () => {
        if (noteSectionRef.current) {
            noteSectionRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    };

    return ( 
      <div className="min-h-screen bg-[#f1f3f5] pb-20 font-body text-site-text relative">
        {/* Simple Clean Header */}
        {selectedTemplate && customConfig && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in" onClick={handleCloseModal}>
                <div 
                    className="bg-white w-full max-w-2xl rounded-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[90vh] sm:max-h-[90vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative px-5 py-6 border-b border-gray-100 bg-white">
                        {/* Close Button - Absolute for better spacing */}
                        <button 
                            onClick={handleCloseModal} 
                            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all z-10"
                            title={t('common.close')}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="flex flex-col items-center text-center px-6">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-tight mb-3">
                                {selectedTemplate.name}
                            </h2>
                            
                            {/* Prominent Scroll-down Guide */}
                            <button 
                                onClick={scrollToCustomize}
                                className="bg-gray-900 text-white px-6 py-2.5 rounded-full shadow-xl border border-white/10 flex items-center gap-3 hover:bg-black transition-all active:scale-95 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary shadow-[0_0_10px_rgba(var(--color-primary),1)]"></span>
                                </span>
                                <span className="relative text-[11px] font-black uppercase tracking-[0.12em] flex items-center gap-2">
                                    {t('collection.quick_customize_title') || 'Lướt xuống để tùy chỉnh mẫu'}
                                    <svg className="w-4 h-4 animate-bounce text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </div>

                    <div 
                        ref={scrollContainerRef}
                        className="flex-grow overflow-y-auto px-4 py-6 sm:p-6 space-y-8 custom-scrollbar overscroll-contain scroll-smooth"
                    >
                        {/* Out of Stock Warning */}
                        {(() => {
                            const isOutOfStock = (selectedTemplate.stock === 0);
                            const missingParts = getOutOfStockParts(customConfig, allParts);
                            if (isOutOfStock || missingParts.length > 0) {
                                return (
                                    <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-5 mb-2 animate-pulse">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl">🚫</span>
                                            <h4 className="font-black text-[12px] text-red-900 uppercase tracking-widest">
                                                {isOutOfStock ? "Mẫu này tạm hết hàng" : "Một số phụ kiện tạm hết"}
                                            </h4>
                                        </div>
                                        <p className="text-[10px] text-red-700 font-bold leading-relaxed">
                                            {isOutOfStock 
                                                ? "Rất tiếc, mẫu thiết kế này hiện không còn hàng. Vui lòng quay lại sau hoặc chọn mẫu khác."
                                                : `Các linh kiện sau hiện đang hết hàng: ${missingParts.join(', ')}. Bạn vẫn có thể xem mẫu, nhưng không thể đặt hàng lúc này.`}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Preview Image with Scroll Hint */}
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
                                            <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('collection.select_char_charm')}</p>
                                        </div>
                                    )}
                                    {customConfig.characters.map((char) => (
                                        <div key={char.id} className="transform scale-125">
                                            <CharacterPreview character={char} hideHat={true} />
                                        </div>
                                    ))}
                                    {customConfig.draggableItems.map((item) => (
                                        <div key={item.id} className="w-12 h-12 bg-white rounded-xl shadow-sm border border-pink-50 p-1 flex items-center justify-center">
                                            <img src={item.selectedColor?.imageUrl || allParts[item.partId]?.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt="Item" />
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
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
                                    
                                    {/* Mobile Scroll Instructions */}
                                    <div className="absolute bottom-6 inset-x-0 px-6 flex flex-col items-center gap-3">
                                        <button 
                                            onClick={scrollToCustomize}
                                            className="w-full py-4.5 bg-gray-900 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-black/30 flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 sm:hidden border border-white/10"
                                        >
                                            <span className="text-primary animate-pulse">✨</span> {t('collection.start_customizing')}
                                            <svg className="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                        </button>
                                        <div className="hidden sm:flex items-center gap-3 px-6 py-2.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl">
                                            <div className="flex items-center justify-center">
                                                <div className="relative">
                                                  <span className="absolute -inset-1 rounded-full bg-primary animate-ping opacity-20"></span>
                                                  <span className="relative block w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--color-primary),0.8)]"></span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-white font-black uppercase tracking-[0.25em]">{t('collection.scroll_to_customize')}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Included Gifts Notification */}
                        <div className="bg-blue-50/50 border border-blue-100/50 rounded-3xl p-4 mt-2 animate-fade-in text-left">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm border border-blue-100/50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                </div>
                                <h4 className="font-black text-[11px] text-blue-900 uppercase tracking-widest">Sản phẩm bao gồm:</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col items-center p-2 bg-white rounded-2xl border border-blue-50/50 shadow-sm">
                                    <span className="text-lg mb-1">🎁</span>
                                    <span className="text-[9px] font-black text-blue-800 uppercase text-center">{t('studio.include_box')}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-white rounded-2xl border border-blue-50/50 shadow-sm">
                                    <span className="text-lg mb-1">🛍️</span>
                                    <span className="text-[9px] font-black text-blue-800 uppercase text-center">{t('studio.include_bag')}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-white rounded-2xl border border-blue-50/50 shadow-sm">
                                    <span className="text-lg mb-1">✉️</span>
                                    <span className="text-[9px] font-black text-blue-800 uppercase text-center">{t('studio.include_card')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Characters Section */}
                        {(selectedTemplate.isSimple || groupedCharacters.length > 0) && (
                            <div ref={customizeSectionRef} className="space-y-4 scroll-mt-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                        Nhân vật ({customConfig.characters.length}) 
                                        {(() => {
                                            const draggableCharms = customConfig.draggableItems.filter(i => 
                                                i.type === 'charm' || i.type === 'accessory' || i.type === 'pet' || i.type === 'hat'
                                            ).length || 0;
                                            const characterExtras = customConfig.characters.reduce((acc, char) => {
                                                return acc + (char.hat ? 1 : 0) + (char.set ? 1 : 0);
                                            }, 0);
                                            const totalCharms = draggableCharms + characterExtras;
                                            return totalCharms > 0 ? ` - Charm (${totalCharms})` : '';
                                        })()}
                                    </h3>
                                    <button 
                                        onClick={addDefaultCharacter}
                                        className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
                                    >
                                        {t('studio.add_character')}
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
                                                <CharacterPreview character={char} hideHat={true} />
                                                <div className="flex-grow">
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{t('studio.character_index').replace('{index}', (idx + 1).toString())}</p>
                                                    <p className="text-[9px] text-primary font-black uppercase tracking-tighter">
                                                        {editingCharacterId === char.id ? t('common.editing') : t('collection.click_to_customize')}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-100 p-1" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => removeSpecificCharacter(char.id)}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-all shadow-sm"
                                                        title={t('studio.remove_char')}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Part Selector */}
                                            {editingCharacterId === char.id && (
                                                <div className="p-4 border-t border-primary/10 space-y-5 bg-white rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
                                                    {(['hair', 'face', 'shirt', 'pants', 'set'] as const).map(type => (
                                                        <div key={type} className="space-y-2.5">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                                    {type === 'hair' ? 'Tóc' : type === 'face' ? 'Mặt' : type === 'shirt' ? 'Áo' : type === 'pants' ? 'Quần' : 'Bộ đồ'}
                                                                </label>
                                                                {char[type] && (
                                                                    <span className="text-[8px] font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded uppercase">{char[type].name}</span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                                {partsByType[type]
                                                                    .filter(p => p.stock === undefined || p.stock === null || p.stock !== 0)
                                                                    .map(part => (
                                                                    <button 
                                                                        key={part.id}
                                                                        onClick={() => {
                                                                            const newChars = customConfig.characters.map(c => {
                                                                                if (c.id === char.id) {
                                                                                    const updated = { ...c, [type]: part };
                                                                                    if (type === 'shirt') updated.selectedShirtColor = part.colors?.[0];
                                                                                    if (type === 'pants') updated.selectedPantsColor = part.colors?.[0];
                                                                                    if (type === 'hair') updated.selectedHairColor = part.colors?.[0];
                                                                                    if (type === 'set') {
                                                                                        updated.selectedSetColor = part.colors?.[0];
                                                                                        updated.shirt = undefined;
                                                                                        updated.pants = undefined;
                                                                                    } else {
                                                                                        updated.set = undefined;
                                                                                    }
                                                                                    return updated;
                                                                                }
                                                                                return c;
                                                                            });
                                                                            setCustomConfig({ ...customConfig, characters: newChars });
                                                                        }}
                                                                        className={`w-10 h-10 rounded-lg border-2 flex-shrink-0 p-1 transition-all relative ${char[type]?.id === part.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}
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
                                                                                        if (type === 'hair') updated.selectedHairColor = color;
                                                                                        if (type === 'set') updated.selectedSetColor = color;
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
                                                                                 char.selectedSetColor?.hex) === color.hex 
                                                                                ? 'border-primary scale-110 shadow-md' 
                                                                                : 'border-gray-100'
                                                                            }`}
                                                                            style={{ backgroundColor: color.hex }}
                                                                            title={color.name}
                                                                        >
                                                                            {(type === 'shirt' ? char.selectedShirtColor?.hex : 
                                                                              type === 'pants' ? char.selectedPantsColor?.hex : 
                                                                              type === 'hair' ? char.selectedHairColor?.hex :
                                                                              char.selectedSetColor?.hex) === color.hex && (
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
                                        {t('collection.included_accessories')}
                                    </h3>
                                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        {customConfig.draggableItems.filter(i => selectedTemplate.config.draggableItems.some(oi => oi.id === i.id)).length} / {selectedTemplate.config.draggableItems.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {/* Graduation Hats from Characters */}
                                    {customConfig.characters.map((char, charIdx) => {
                                        if (!char.hat) return null;
                                        const hat = char.hat;
                                        return (
                                            <div 
                                                key={`char-hat-${char.id}`}
                                                className="flex items-center gap-4 p-3 rounded-2xl border-2 border-primary bg-primary/5 shadow-sm"
                                            >
                                                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center p-1 border border-gray-100">
                                                    <img src={char.selectedHatColor?.imageUrl || hat.imageUrl} alt="Hat" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                </div>
                                                <div className="flex-grow text-left">
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{hat.name} (NV {charIdx + 1})</p>
                                                    <p className="text-[10px] text-primary font-bold">{formatCurrency(hat.price || 0)}</p>
                                                    
                                                    {/* Color selection for the hat */}
                                                    {hat.colors && hat.colors.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {hat.colors.map(color => (
                                                                <button
                                                                    key={color.hex}
                                                                    onClick={() => {
                                                                        const newChars = customConfig.characters.map(c => {
                                                                            if (c.id === char.id) return { ...c, selectedHatColor: color };
                                                                            return c;
                                                                        });
                                                                        setCustomConfig({ ...customConfig, characters: newChars });
                                                                    }}
                                                                    className={`w-4 h-4 rounded-full border border-white shadow-sm ${char.selectedHatColor?.hex === color.hex ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                                                                    style={{ backgroundColor: color.hex }}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-1">
                                                    <button 
                                                        onClick={() => {
                                                            const newChars = customConfig.characters.map(c => {
                                                                if (c.id === char.id) return { ...c, hat: undefined, selectedHatColor: undefined };
                                                                return c;
                                                            });
                                                            setCustomConfig({ ...customConfig, characters: newChars });
                                                        }}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                                    </button>
                                                    <span className="text-xs font-black text-gray-900 leading-none">1</span>
                                                    <button 
                                                        disabled
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-200"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {groupedTemplateCharms.map((group) => {
                                        const { part, originalItems, partId, selectedColor, key } = group;
                                        const currentInConfig = customConfig.draggableItems.filter(i => originalItems.some(oi => oi.id === i.id));
                                        const currentCount = currentInConfig.length;
                                        const maxCount = originalItems.length;
                                        const isSelected = currentCount > 0;

                                        return (
                                            <div 
                                                key={key}
                                                className={`flex flex-col p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center p-1 border border-gray-100">
                                                        <img src={selectedColor?.imageUrl || part?.imageUrl || partId} alt="Charm" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                    </div>
                                                    <div className="flex-grow text-left">
                                                        <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{part?.name || 'Phụ kiện'}</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[10px] text-primary font-bold">
                                                                {formatCurrency(getEffectivePrice(part, currentCount, part?.bulkPricing) + (selectedColor?.price || 0))}
                                                            </p>
                                                            {part && (getEffectivePrice(part, currentCount, part.bulkPricing) < part.price) && (
                                                                <p className="text-[8px] text-gray-400 line-through font-medium">
                                                                    {formatCurrency(part.price)}
                                                                </p>
                                                            )}
                                                        </div>
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

                                                {/* Color selection for Template charm */}
                                                {isSelected && part?.colors && part.colors.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-primary/5">
                                                        {part.colors.map(color => (
                                                            <button
                                                                key={color.hex}
                                                                onClick={() => updateTemplateCharmColor(partId, selectedColor, color)}
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

                        {/* Added Extra Charms */}
                        {groupedAddedExtraCharms.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                    {t('collection.added_accessories')}
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
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[9px] text-primary font-bold">
                                                                {formatCurrency(getEffectivePrice(part, items.length, part?.bulkPricing))}
                                                            </p>
                                                            {part && (getEffectivePrice(part, items.length, part.bulkPricing) < part.price) && (
                                                                <p className="text-[8px] text-gray-400 line-through font-medium">
                                                                    {formatCurrency(part.price)}
                                                                </p>
                                                            )}
                                                        </div>
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
                                            <div className="absolute bottom-0 right-0 bg-primary/10 text-primary rounded-tl-xl px-1.5 py-0.5 text-[8px] font-black flex flex-col items-end">
                                                {part.salePrice && getEffectivePrice(part) < part.price && (
                                                    <span className="text-[6px] text-gray-400 line-through font-medium opacity-70 leading-none mb-0.5">
                                                        {formatCurrency(part.price).replace('₫', '')}
                                                    </span>
                                                )}
                                                <span>+{formatCurrency(getEffectivePrice(part)).replace('₫', '')}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredExtraCharms.length === 0 && (
                                        <div className="col-span-full py-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                            {t('studio.no_accessories_found')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Order Notes */}
                        <div ref={noteSectionRef} className="space-y-3 scroll-mt-20">
                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                {t('common.order_note')} <span className="text-[10px] text-red-500 font-bold lowercase tracking-normal">(bắt buộc)</span>
                            </h3>
                            <div className="relative">
                                <textarea 
                                    value={orderNote}
                                    onChange={e => setOrderNote(e.target.value)}
                                    placeholder={t('common.order_note_placeholder')}
                                    rows={3}
                                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                                />
                                <div className="mt-2 flex items-start gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                    <span className="text-blue-500 text-xs">ℹ️</span>
                                    <p className="text-[10px] sm:text-[11px] text-blue-700 font-medium leading-relaxed">
                                        {t('common.order_note_demo_note')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-4 py-6 sm:p-6 border-t border-gray-100 bg-white space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block mb-1">{t('common.total')}</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-gray-900">{formatCurrency(currentPrice)}</span>
                                    {originalPrice > currentPrice && (
                                        <span className="text-sm text-gray-400 line-through font-bold">
                                            {formatCurrency(originalPrice)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleQuickAddToCart}
                                disabled={(selectedTemplate.stock !== undefined && selectedTemplate.stock <= 0) || getOutOfStockParts(customConfig, allParts).length > 0}
                                className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                🛒 {t('common.add_to_cart')}
                            </button>
                            <button 
                                onClick={handleBuyNow}
                                disabled={(selectedTemplate.stock !== undefined && selectedTemplate.stock <= 0) || getOutOfStockParts(customConfig, allParts).length > 0}
                                className="flex-[1.5] py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ⚡ {t('common.buy_now')}
                            </button>
                        </div>
                        <button 
                            onClick={() => handleContactZalo(selectedTemplate.name, currentPrice, selectedTemplate.image)}
                            className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {t('collection.need_advice') || 'Cần tư vấn mẫu này'}
                        </button>
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

                <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50/50 border border-yellow-100/50 rounded-full">
                        <span className="text-[10px] sm:text-xs text-yellow-600">✨</span>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                            {t('collection.templates_disclaimer')}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Filter Section */}
        <div className="relative sm:sticky sm:top-16 z-30 bg-white border-b border-gray-100 py-3 mb-2 sm:mb-0 shadow-sm">
            <div className="container mx-auto px-4 space-y-3">
                {/* Categories */}
                <div className="overflow-x-auto no-scrollbar flex items-center gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryChange(cat)}
                            className={`px-5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                activeCategory === cat 
                                    ? 'bg-primary text-white shadow-md' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {cat} <span className="opacity-40 text-[9px]">({filterCounts.categories[cat] || 0})</span>
                        </button>
                    ))}
                </div>

                {/* Sub-filters */}
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {/* Price Range */}
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                         <span className="pl-2 opacity-50">{t('collection.budget')}</span>
                         {[
                             { id: 'all', label: t('common.all') },
                             { id: 'under300', label: '< 300k' },
                             { id: '300to500', label: '300k - 500k' }
                         ].map(range => (
                            <button 
                                key={range.id}
                                onClick={() => setPriceRange(range.id as any)}
                                className={`px-3 py-1 rounded-lg transition-all ${priceRange === range.id ? 'bg-white shadow-sm text-primary' : 'hover:text-gray-900'}`}
                            >
                                {range.label} <span className="opacity-40 text-[8px]">({filterCounts.prices[range.id as keyof typeof filterCounts.prices]})</span>
                            </button>
                        ))}
                    </div>

                    {/* Character Count */}
                     <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                         <span className="pl-2 opacity-50">{t('studio.characters')}:</span>
                         {[
                             { id: 'all', label: t('common.all') },
                             { id: '1', label: `1 ${t('studio.character_index').split(' ')[0]}` },
                            { id: '2', label: `2 ${t('studio.character_index').split(' ')[0]}` },
                            { id: '3plus', label: `3+ ${t('studio.character_index').split(' ')[0]}` }
                        ].map(count => (
                            <button 
                                key={count.id}
                                onClick={() => setCharCount(count.id as any)}
                                className={`px-3 py-1 rounded-lg transition-all ${charCount === count.id ? 'bg-white shadow-sm text-primary' : 'hover:text-gray-900'}`}
                            >
                                {count.label} <span className="opacity-40 text-[8px]">({filterCounts.characters[count.id as keyof typeof filterCounts.characters]})</span>
                            </button>
                        ))}
                    </div>

                    {/* Sorting */}
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100 ml-auto">
                        <span className="pl-2 opacity-50">{t('collection.sort_by')}</span>
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-transparent border-none outline-none pr-4 text-gray-900 cursor-pointer"
                        >
                            <option value="default">{t('studio.sort_default')}</option>
                            <option value="mostPurchased">{t('collection.hot')}</option>
                            <option value="priceAsc">{t('studio.sort_price_asc')}</option>
                            <option value="priceDesc">{t('studio.sort_price_desc')}</option>
                        </select>
                    </div>
                </div>
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
                    const hasParts = Object.keys(allParts).length > 0;
                    const calculated = calculatePrice(template.config, allParts, frames, displayTemplates);
                    const totalPrice = hasParts 
                        ? calculated.totalPrice 
                        : (template.salePrice && template.salePrice < template.price ? template.salePrice : (template.price || 290000));
                    const originalPrice = hasParts 
                        ? calculated.priceBreakdown.reduce((sum, item) => sum + (item.originalValue ?? item.value), 0)
                        : (template.price || 290000);
                    const purchaseCount = template.purchaseCount || 0;
                    const isOutOfStock = template.stock === 0;
                    const oosParts = getOutOfStockParts(template.config, allParts);
                    const hasOosParts = oosParts.length > 0;
                    
                    return ( 
                        <div key={template.id || index} className={`group flex flex-col bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full ${isOutOfStock ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                            {/* Image Container */}
                            <div className="relative aspect-[3/4] overflow-hidden bg-gray-50 cursor-pointer" onClick={() => handleSelectTemplate(template)}>
                                <SmartImage 
                                    src={template.imageUrl} 
                                    alt={template.name} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                />
                                
                                <div className="absolute top-2 left-2 right-2 flex flex-col gap-1.5 pointer-events-none">
                                    <div className="flex flex-wrap gap-1">
                                         {isOutOfStock ? (
                                             <div className="bg-gray-800 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight shadow-md flex items-center gap-1">
                                                 🚫 Hết hàng
                                             </div>
                                         ) : hasOosParts ? (
                                             <div className="bg-amber-500 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight shadow-md flex items-center gap-1">
                                                 ⚠️ Thiếu phụ kiện
                                             </div>
                                         ) : (
                                             <>
                                                 {(template.isHot || purchaseCount > 20) && (
                                                     <div className="bg-orange-500 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight shadow-md flex items-center gap-1 animate-pulse">
                                                         🔥 {t('collection.hot')}
                                                     </div>
                                                 )}
                                                 {template.isNew && (
                                                     <div className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight shadow-md flex items-center gap-1">
                                                         ✨ {t('common.new')}
                                                     </div>
                                                 )}
                                             </>
                                         )}
                                        {template.price && template.salePrice && template.salePrice < template.price && !isOutOfStock && (
                                            <div className="bg-red-600 text-white px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight shadow-md">
                                                OFF {Math.round((1 - template.salePrice / template.price) * 100)}%
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-black text-primary uppercase tracking-tight shadow-sm border border-primary/10 w-fit">
                                        🎨 {t('collection.customizable')}
                                    </div>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="p-3 sm:p-5 flex flex-col flex-grow">
                                <h3 className="text-xs sm:text-base font-bold text-gray-900 mb-2 line-clamp-1">
                                    {template.name}
                                </h3>
                                
                                <div className="flex items-center gap-1.5 mb-4">
                                     <div className="text-[10px] sm:text-[11px] text-gray-400 font-bold leading-tight">
                                         {purchaseCount} {t('collection.orders')}
                                     </div>
                                     <div className="h-3 w-px bg-gray-200 mx-1"></div>
                                     <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                                         <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter whitespace-nowrap">
                                             + {t('studio.include_box')}, {t('studio.include_bag')}, {t('studio.include_card')}
                                         </span>
                                     </div>
                                </div>

                                <div className="mt-auto space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="text-[8px] text-gray-400 font-black block uppercase mb-0.5 tracking-tighter">{t('collection.base_price')}</span>
                                            <span className="text-sm sm:text-lg font-black text-gray-900 leading-none">
                                                {formatCurrency(totalPrice)}
                                            </span>
                                            {originalPrice > totalPrice && (
                                                <span className="text-[10px] sm:text-xs text-gray-400 line-through ml-1.5 font-bold">
                                                    {formatCurrency(originalPrice)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-gray-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-gray-500 mb-0.5">
                                            {template.config.characters.length} {t('collection.characters_count')}
                                            {(() => {
                                                const draggableCharms = template.config.draggableItems?.filter(item => 
                                                    item.type === 'charm' || item.type === 'accessory' || item.type === 'pet' || item.type === 'hat'
                                                ).length || 0;
                                                const characterExtras = template.config.characters.reduce((acc, char) => {
                                                    return acc + (char.hat ? 1 : 0) + (char.set ? 1 : 0);
                                                }, 0);
                                                const totalCharms = draggableCharms + characterExtras;
                                                return totalCharms > 0 ? ` - ${totalCharms} Charm` : '';
                                            })()}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleSelectTemplate(template)} 
                                            className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-primary transition-all active:scale-95 group/btn"
                                        >
                                            {t('collection.select_template')}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContactZalo(template.name, totalPrice, template.image);
                                            }}
                                            className="px-3 py-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-1.5"
                                            title="Cần tư vấn mẫu này"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        </button>
                                    </div>
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