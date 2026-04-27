
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, FormField, LegoPart, LegoCharacterConfig, OutfitColor } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG, LEGO_PARTS } from '../../constants';
import FramePreview from '../FramePreview';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { addTemplate, updateTemplate, getAllTemplates } from '../../services/templateService';
import { uploadFile } from '../../services/uploadService';
import html2canvas from 'html2canvas';
import { getStoreConfig } from '../../services/configService';
import { getAllParts } from '../../services/productService';

const MUSEUM_FRAMES = [
    { id: 'gold_rect', nameKey: 'studio.museum.gold_rect', url: '' },
    { id: 'gold_oval', nameKey: 'studio.museum.gold_oval', url: '' },
    { id: 'gold_heart', nameKey: 'studio.museum.gold_heart', url: '' },
    { id: 'gold_square', nameKey: 'studio.museum.gold_square', url: '' },
    { id: 'spotlight', nameKey: 'studio.museum.spotlight', url: '' },
];

const VELVET_COLORS = [
    { name: 'Đỏ Đô', hex: '#800000' },
    { name: 'Xanh Emerald', hex: '#046307' },
    { name: 'Đen Tuyến', hex: '#0a0a0a' },
    { name: 'Tím Hoàng Gia', hex: '#4b0082' },
    { name: 'Xanh Navy', hex: '#000080' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Poppins', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

const FontSelector: React.FC<{ 
    value: string; 
    onChange: (font: string) => void;
    onPreview: (font: string | null) => void;
    uploadedFonts: CustomFont[];
}> = ({ value, onChange, onPreview, uploadedFonts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const groups = useMemo(() => [
        { label: 'Cơ bản', fonts: DEFAULT_FONTS },
        { label: 'Tải lên', fonts: uploadedFonts.map(f => f.name) }
    ], [uploadedFonts]);

    const filteredGroups = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return groups;
        return groups.map(group => ({
            ...group,
            fonts: group.fonts.filter(font => font.toLowerCase().includes(query))
        })).filter(group => group.fonts.length > 0);
    }, [searchTerm, groups]);

    return (
        <div className="relative text-left" ref={dropdownRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white flex justify-between items-center shadow-sm hover:border-blue-400 transition-all">
                <span className="truncate font-medium" style={{ fontFamily: value }}>{value}</span>
                <span className="text-[10px] opacity-40">▼</span>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-2xl z-[110] max-h-64 overflow-hidden flex flex-col animate-fade-in">
                    <input 
                        className="w-full p-2.5 text-xs border-b outline-none sticky top-0 bg-white z-10" 
                        placeholder="Tìm phông chữ..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        onClick={e => e.stopPropagation()} 
                    />
                    <div className="overflow-y-auto custom-scrollbar">
                        {filteredGroups.map(group => (
                            <div key={group.label}>
                                <div className="px-2 py-1.5 text-[9px] font-black text-gray-400 uppercase bg-gray-50 tracking-widest">{group.label}</div>
                                {group.fonts.map(font => (
                                    <div 
                                        key={font} 
                                        className={`px-3 py-2.5 text-sm hover:bg-blue-50 cursor-pointer transition-colors ${value === font ? 'bg-blue-50 text-blue-600 font-bold' : ''}`} 
                                        style={{ fontFamily: font }} 
                                        onClick={() => { onChange(font); setIsOpen(false); }}
                                        onMouseEnter={() => onPreview(font)}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const AdminDesign: React.FC = () => {
    const { t } = useLanguage();

    const TOOLS = [
        { id: 'templates', icon: '📂', label: t('studio.tools.templates') }, 
        { id: 'khung', icon: '🖼️', label: 'Khung' },
        { id: 'character', icon: '👤', label: 'Nhân vật' },
        { id: 'background', icon: '🎨', label: t('studio.tools.background') },
        { id: 'museum', icon: '🏛️', label: t('studio.tools.museum') },
        { id: 'shape', icon: '🟥', label: t('studio.tools.shape') },
        { id: 'text', icon: 'abc', label: t('studio.tools.text') },
        { id: 'upload', icon: '🖼️', label: t('studio.tools.upload') },
        { id: 'form', icon: '📝', label: t('studio.tools.form') }, 
        { id: 'layers', icon: '📚', label: t('studio.tools.layers') },
    ];

    const [activeTool, setActiveTool] = useState('templates');
    const [activePartType, setActivePartType] = useState<'hair' | 'face' | 'shirt' | 'pants' | 'hat' | 'set'>('hair');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [existingBackgrounds, setExistingBackgrounds] = useState<PresetBackground[]>([]);
    const [history, setHistory] = useState<string[]>([JSON.stringify(INITIAL_FRAME_CONFIG)]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [saveType, setSaveType] = useState<'background' | 'template'>('background');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isNewCategory, setIsNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [clipboard, setClipboard] = useState<any>(null);
    const [testFormData, setTestFormData] = useState<Record<string, string>>({});
    const [isTestMode, setIsTestMode] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const skipHistoryRef = useRef(false);

    useEffect(() => {
        setBgType(config.frameId === 'md' ? 'rectangle' : 'square');
    }, [config.frameId]);

    const categories = useMemo(() => {
        const uniqueCats = Array.from(new Set(existingBackgrounds.map(bg => bg.category)));
        if (!uniqueCats.includes('Tình yêu')) uniqueCats.unshift('Tình yêu');
        return uniqueCats;
    }, [existingBackgrounds]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, productsData] = await Promise.all([
                getAllFrames(), getStoreConfig(), getAllBackgrounds(), getAllParts()
            ]);
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) {
                setUploadedFonts(configData.uploadedFonts);
                
                // Inject custom fonts into head
                const existingStyle = document.getElementById('admin-design-fonts');
                if (existingStyle) existingStyle.remove();
                const style = document.createElement('style');
                style.id = 'admin-design-fonts';
                let css = '';
                configData.uploadedFonts.forEach((font: CustomFont) => {
                    css += `
                        @font-face {
                            font-family: '${font.name}';
                            src: url('${font.url}');
                            font-weight: normal;
                            font-style: normal;
                            font-display: swap;
                        }
                    `;
                });
                style.innerHTML = css;
                document.head.appendChild(style);
            }
            if (bgData) setExistingBackgrounds(bgData);
            if (productsData) setProducts(productsData);
        };
        fetchInitialData();
    }, []);

    const allKnownParts = useMemo(() => {
        const dbParts = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        const defaultParts = Object.values(LEGO_PARTS).flat().reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, LegoPart>);
        return { ...defaultParts, ...dbParts }; 
    }, [products]);

    // History Logic
    useEffect(() => {
        if (skipHistoryRef.current) {
            skipHistoryRef.current = false;
            return;
        }
        const currentStr = JSON.stringify(config);
        if (currentStr !== history[historyIndex]) {
            setHistory(prev => {
                const next = prev.slice(0, historyIndex + 1);
                next.push(currentStr);
                return next.slice(-30);
            });
            setHistoryIndex(prev => Math.min(prev + 1, 29));
        }
    }, [config]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            skipHistoryRef.current = true;
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setConfig(JSON.parse(history[newIndex]));
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            skipHistoryRef.current = true;
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setConfig(JSON.parse(history[newIndex]));
        }
    }, [history, historyIndex]);

    const updateSelected = useCallback((updates: any) => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        setConfig(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? { ...i, ...updates } : i) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s) };
            if (type === 'character') return { ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c) };
            return prev;
        });
    }, [selectedItemId]);

    const handleItemRemove = useCallback((id: string) => {
        const [type, ...rest] = id.split('-');
        const rawId = rest.join('-');
        const itemId = parseInt(rawId);
        setSelectedItemId(null);
        setConfig((prev: FrameConfig) => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== itemId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== itemId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== itemId) };
            if (type === 'character') return { ...prev, characters: prev.characters.filter(c => c.id !== itemId) };
            return prev;
        });
    }, []);

    const selectedObject = useMemo(() => {
        if (!selectedItemId) return null;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        if (type === 'text') return config.texts.find(t => t.id === id);
        if (type === 'item') return config.draggableItems.find(i => i.id === id);
        if (type === 'shape') return config.shapes?.find(s => s.id === id);
        if (type === 'character') return config.characters.find(c => c.id === id);
        return null;
    }, [selectedItemId, config]);

    const handleDuplicate = useCallback(() => {
        if (!selectedItemId || !selectedObject) return;
        const [type] = selectedItemId.split('-');
        const newId = Date.now();
        const offset = 2; // Offset for the duplicate
        
        setConfig(prev => {
            if (type === 'text') {
                const item = prev.texts.find(t => t.id === parseInt(selectedItemId.split('-')[1]));
                if (!item) return prev;
                return { ...prev, texts: [...prev.texts, { ...item, id: newId, x: Math.min(100, item.x + offset), y: Math.min(100, item.y + offset) }] };
            }
            if (type === 'item') {
                const item = prev.draggableItems.find(i => i.id === parseInt(selectedItemId.split('-')[1]));
                if (!item) return prev;
                return { ...prev, draggableItems: [...prev.draggableItems, { ...item, id: newId, x: Math.min(100, item.x + offset), y: Math.min(100, item.y + offset) }] };
            }
            if (type === 'shape') {
                const item = (prev.shapes || []).find(s => s.id === parseInt(selectedItemId.split('-')[1]));
                if (!item) return prev;
                return { ...prev, shapes: [...(prev.shapes || []), { ...item, id: newId, x: Math.min(100, item.x + offset), y: Math.min(100, item.y + offset) }] };
            }
            return prev;
        });
        
        // Select the new item
        setTimeout(() => setSelectedItemId(`${type}-${newId}`), 50);
    }, [selectedItemId, selectedObject]);

    const handleCopy = useCallback(() => {
        if (!selectedItemId || !selectedObject) return;
        setClipboard({ type: selectedItemId.split('-')[0], data: { ...selectedObject } });
    }, [selectedItemId, selectedObject]);

    const handlePaste = useCallback(() => {
        if (!clipboard) return;
        const newId = Date.now();
        const offset = 5;
        setConfig(prev => {
            const newData = { ...clipboard.data, id: newId, x: Math.min(100, clipboard.data.x + offset), y: Math.min(100, clipboard.data.y + offset) };
            if (clipboard.type === 'text') return { ...prev, texts: [...prev.texts, newData] };
            if (clipboard.type === 'item') return { ...prev, draggableItems: [...prev.draggableItems, newData] };
            if (clipboard.type === 'shape') return { ...prev, shapes: [...(prev.shapes || []), newData] };
            if (clipboard.type === 'character') return { ...prev, characters: [...prev.characters, newData] };
            return prev;
        });
        setTimeout(() => setSelectedItemId(`${clipboard.type}-${newId}`), 50);
    }, [clipboard]);

    const handleAddCharacter = () => {
        const newChar: LegoCharacterConfig = {
            id: Date.now(),
            x: 50,
            y: 50,
            rotation: 0,
            scale: 1,
            hair: allKnownParts['hair-1'] || null,
            face: allKnownParts['face-1'] || null,
            shirt: allKnownParts['shirt-1'] || null,
            pants: allKnownParts['pants-1'] || null,
            selectedShirtColor: allKnownParts['shirt-1']?.colors?.[0],
            selectedPantsColor: allKnownParts['pants-1']?.colors?.[0],
            selectedHairColor: allKnownParts['hair-1']?.colors?.[0],
        };
        setConfig(prev => ({
            ...prev,
            characters: [...prev.characters, newChar]
        }));
        setSelectedItemId(`character-${newChar.id}`);
        setActiveTool('character');
    };

    const handleCharacterUpdate = (id: number, updates: Partial<LegoCharacterConfig>) => {
        setConfig(prev => ({
            ...prev,
            characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    };

    const handleSave = useCallback(() => {
        setShowSaveModal(true);
    }, []);

    // KEYBOARD SHORTCUTS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

            if (isTyping) return;

            // Di chuyển bằng phím mũi tên
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedItemId) {
                if ((selectedObject as any)?.lockedPosition) return;
                e.preventDefault();
                const step = e.shiftKey ? 2.0 : 0.5;
                let dx = 0, dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;

                const current = selectedObject as any;
                updateSelected({
                    x: Math.max(0, Math.min(100, current.x + dx)),
                    y: Math.max(0, Math.min(100, current.y + dy))
                });
            }

            // Xoá vật thể
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
                e.preventDefault();
                handleItemRemove(selectedItemId);
            }

            // Bỏ chọn
            if ((e.key === 'Escape' || e.key === 'Enter') && selectedItemId) {
                setSelectedItemId(null);
            }

            // Duplicate (Ctrl+D)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedItemId) {
                e.preventDefault();
                handleDuplicate();
            }

            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedItemId) {
                e.preventDefault();
                handleCopy();
            }

            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                handlePaste();
            }

            // Save (Ctrl+S)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }

            // Hoàn tác
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, selectedObject, updateSelected, handleItemRemove, handleUndo, handleRedo, handleDuplicate, handleCopy, handlePaste, handleSave]);

    const handleLoadTemplate = (bg: PresetBackground) => {
        setEditingBgId(bg.id);
        setBgName(bg.name);
        setBgCategory(bg.category);
        setBgType(bg.type);
        setConfig({
            frameId: bg.type === 'rectangle' ? 'md' : 'lg',
            background: { type: bg.url.startsWith('#') ? 'color' : 'image', value: bg.url },
            texts: bg.overlayConfig?.texts || [],
            draggableItems: bg.overlayConfig?.draggableItems || [],
            shapes: bg.overlayConfig?.shapes || [],
            formFields: bg.formFields || [],
            characters: []
        });
    };

    const handleItemTransform = useCallback((id: string, nTransform: any) => {
        const [type, ...rest] = id.split('-');
        const rawId = rest.join('-');
        const itemId = parseInt(rawId);
        setConfig((prev: FrameConfig) => {
            if (type === 'text') return { ...prev, texts: prev.texts.map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map((item: any) => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'character') return { ...prev, characters: prev.characters.map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            return prev;
        });
    }, []);

    const handleUpdateTestForm = (fieldId: string, value: string) => {
        setTestFormData(prev => ({ ...prev, [fieldId]: value }));
        
        let displayValue = value;
        if (value && value.includes('-') && value.split('-').length === 3 && value.length === 10) {
            const p = value.split('-');
            displayValue = `${p[2]}/${p[1]}/${p[0]}`;
        }

        setConfig(prev => ({
            ...prev,
            customFormData: { ...(prev.customFormData || {}), [fieldId]: value },
            texts: prev.texts.map(t => {
                if (t.linkedFieldId === fieldId) {
                    const field = (prev.formFields || []).find(f => f.id === fieldId);
                    if (field?.type === 'color') return { ...t, color: value };
                    return { ...t, content: displayValue || ' ' };
                }
                return t;
            }),
            shapes: (prev.shapes || []).map(s => {
                if (s.linkedFieldId === fieldId) {
                    const field = (prev.formFields || []).find(f => f.id === fieldId);
                    if (field?.type === 'color') return { ...s, fillColor: value };
                }
                return s;
            }),
            draggableItems: (prev.draggableItems || []).map(item => {
                if (item.linkedFieldId === fieldId) {
                    const field = (prev.formFields || []).find(f => f.id === fieldId);
                    if (field?.type === 'image' && value) return { ...item, partId: value };
                }
                return item;
            })
        }));
    };

    const handleAddField = () => {
        const newField: FormField = { id: `field_${Date.now()}`, label: 'Trường mới', type: 'text', required: false };
        setConfig(prev => ({ ...prev, formFields: [...(prev.formFields || []), newField] }));
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setConfig(prev => ({ ...prev, formFields: (prev.formFields || []).map(f => f.id === id ? { ...f, ...updates } : f) }));
    };

    const removeField = (id: string) => {
        setConfig(prev => ({ ...prev, formFields: (prev.formFields || []).filter(f => f.id !== id) }));
    };

    const isFieldLinked = (fieldId: string) => {
        return config.texts.some(t => t.linkedFieldId === fieldId) || 
               config.draggableItems.some(i => i.linkedFieldId === fieldId) ||
               (config.shapes || []).some(s => s.linkedFieldId === fieldId);
    };

    const alignItem = (type: 'h-center' | 'v-center') => {
        if (!selectedItemId) return;
        const [itemType, ...rest] = selectedItemId.split('-');
        const rawId = rest.join('-');
        const id = parseInt(rawId);

        setConfig(prev => {
            const updates: any = {};
            if (type === 'h-center') updates.x = 50;
            if (type === 'v-center') updates.y = 50;

            if (itemType === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) };
            if (itemType === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? { ...i, ...updates } : i) };
            if (itemType === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s) };
            if (itemType === 'character') return { ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c) };
            return prev;
        });
    };

    const moveLayer = (direction: 'front' | 'back') => {
        if (!selectedItemId) return;
        const [itemType, ...rest] = selectedItemId.split('-');
        const rawId = rest.join('-');
        const id = parseInt(rawId);

        setConfig(prev => {
            if (itemType === 'text') {
                const item = prev.texts.find(t => t.id === id);
                if (!item) return prev;
                const filtered = prev.texts.filter(t => t.id !== id);
                return { ...prev, texts: direction === 'front' ? [...filtered, item] : [item, ...filtered] };
            }
            if (itemType === 'item') {
                const item = prev.draggableItems.find(i => i.id === id);
                if (!item) return prev;
                const filtered = prev.draggableItems.filter(i => i.id !== id);
                return { ...prev, draggableItems: direction === 'front' ? [...filtered, item] : [item, ...filtered] };
            }
            if (itemType === 'shape') {
                const item = (prev.shapes || []).find(s => s.id === id);
                if (!item) return prev;
                const filtered = (prev.shapes || []).filter(s => s.id !== id);
                return { ...prev, shapes: direction === 'front' ? [...filtered, item] : [item, ...filtered] };
            }
            return prev;
        });
    };

    const handleTestImageUpload = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try {
                const url = await uploadFile(e.target.files[0]);
                if (url) {
                    handleUpdateTestForm(fieldId, url);
                }
            } catch (error) {
                console.error("Error uploading test image:", error);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleUploadMuseumFrame = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            const url = await uploadFile(e.target.files[0]);
            if (url) {
                const id = Date.now();
                setConfig(prev => ({
                    ...prev,
                    draggableItems: [...prev.draggableItems, { 
                        id, 
                        partId: 'https://firebasestorage.googleapis.com/v0/b/the-luvin.firebasestorage.app/o/uploads%2F1741542152648_d106r_photo_placeholder.png?alt=media&token=4e1e0a9d-5a6b-4e9e-b8d2-4b3d8a9e6e8b', // Transparent placeholder
                        type: 'charm', 
                        x: 50, 
                        y: 50, 
                        rotation: 0, 
                        scale: 0.5,
                        frameUrl: url // The uploaded museum frame
                    }]
                }));
                setSelectedItemId(`item-${id}`);
            }
            setIsUploading(false);
        }
    };

    const handleUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            const url = await uploadFile(e.target.files[0]);
            if (url) {
                const id = Date.now();
                setConfig(prev => ({
                    ...prev,
                    draggableItems: [...prev.draggableItems, { id, partId: url, type: 'charm', x: 50, y: 50, rotation: 0, scale: 0.5 }]
                }));
                setSelectedItemId(`item-${id}`);
            }
            setIsUploading(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl overflow-hidden border shadow-lg relative">
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button key={tool.id} onClick={() => { setActiveTool(tool.id); setSelectedItemId(null); }} className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition-all ${activeTool === tool.id ? 'bg-white text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                        <span className="text-xl">{tool.icon}</span>
                        <span className="text-[9px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
            </div>

            <div className="w-80 bg-white border-r flex flex-col z-10">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500">
                        {selectedObject ? 'Thuộc tính đối tượng' : TOOLS.find(t => t.id === activeTool)?.label}
                    </h3>
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {selectedObject ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-3 bg-gray-50 border rounded-xl flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">🔒 Khóa vị trí</label>
                                <button onClick={() => updateSelected({ lockedPosition: !(selectedObject as any).lockedPosition })} className={`w-10 h-5 rounded-full p-1 transition-all ${(selectedObject as any).lockedPosition ? 'bg-red-500' : 'bg-gray-300'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${(selectedObject as any).lockedPosition ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>

                            {/* LIÊN KẾT FORM: HIỂN THỊ CHO TEXT, STICKER VÀ CẢ HÌNH KHỐI */}
                            {(selectedItemId?.startsWith('text-') || 
                             selectedItemId?.startsWith('shape-') || 
                             (selectedItemId?.startsWith('item-') && (selectedObject as DraggableItem).type === 'charm')) && (
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-blue-600 uppercase mb-1 tracking-widest">🔗 Liên kết Form</label>
                                    <p className="text-[9px] text-gray-400 italic mb-2 leading-tight">
                                        {selectedItemId?.startsWith('text-') 
                                            ? 'Khi khách điền vào trường này, nội dung chữ sẽ tự động thay đổi.' 
                                            : selectedItemId?.startsWith('shape-')
                                            ? 'Khi khách chọn màu ở trường này, màu của khối hình sẽ thay đổi theo.'
                                            : 'Khi khách upload ảnh vào trường này, ảnh trên thiết kế sẽ được thay thế bằng ảnh của khách.'}
                                    </p>
                                    <select 
                                        className="w-full p-2.5 border-2 border-blue-100 rounded-lg text-xs font-bold bg-blue-50 focus:border-blue-400 outline-none transition-all" 
                                        value={(selectedObject as any).linkedFieldId || ''} 
                                        onChange={e => updateSelected({ linkedFieldId: e.target.value })}
                                    >
                                        <option value="">-- Không kết nối --</option>
                                        {(config.formFields || [])
                                            .filter(f => {
                                                if (selectedItemId?.startsWith('text-')) return f.type !== 'image';
                                                if (selectedItemId?.startsWith('shape-')) return f.type === 'color' || f.type === 'image';
                                                return f.type === 'image';
                                            })
                                            .map(f => <option key={f.id} value={f.id}>{f.label} ({f.type === 'image' ? 'Ảnh' : f.type === 'color' ? 'Màu' : 'Chữ'})</option>)}
                                    </select>
                                    {(!config.formFields || config.formFields.length === 0) ? (
                                        <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                                            <p className="text-[10px] text-red-600 font-black uppercase mb-2">⚠️ Chưa có trường Form</p>
                                            <p className="text-[9px] text-gray-500 mb-3 leading-tight">Bạn cần tạo các câu hỏi (như Nhập tên, Tải ảnh...) trước khi có thể liên kết chúng vào thiết kế.</p>
                                            <button 
                                                onClick={() => setActiveTool('form')}
                                                className="w-full py-2 bg-red-500 text-white text-[10px] font-black rounded-md hover:bg-red-600 transition-colors uppercase"
                                            >
                                                Mở Tab Form để tạo ngay
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-[9px] text-gray-400 mt-1 italic">Mẹo: Bạn có thể liên kết hình khối với trường "Màu sắc" hoặc "Hình ảnh".</p>
                                    )}
                                </div>
                            )}

                             {selectedItemId?.startsWith('character-') && (
                                 <div className="space-y-4">
                                     <div className="flex justify-between items-center">
                                         <span className="text-xs font-bold text-gray-500">Nhân vật</span>
                                     </div>
                                     <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                         <p className="text-[10px] text-gray-500 leading-relaxed italic">Sử dụng công cụ "Nhân vật" ở thanh bên trái để thay đổi trang phục, tóc và mặt của nhân vật này.</p>
                                     </div>
                                 </div>
                             )}
                            {selectedItemId?.startsWith('text-') && (
                                <div className="space-y-5">
                                    <div><label className="text-[10px] font-black text-gray-400 mb-1.5 block uppercase">Nội dung mặc định</label>
                                        <textarea className="w-full p-2 border rounded-lg text-sm" value={(selectedObject as TextConfig).content} onChange={e => updateSelected({ content: e.target.value })} />
                                    </div>
                                    <FontSelector value={(selectedObject as TextConfig).font} onChange={f => updateSelected({ font: f })} onPreview={setPreviewFont} uploadedFonts={uploadedFonts} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="number" className="w-full p-2 border rounded-lg" value={(selectedObject as TextConfig).size} onChange={e => updateSelected({ size: Number(e.target.value) })} />
                                        <input type="color" className="w-full h-10 border rounded-lg" value={(selectedObject as TextConfig).color} onChange={e => updateSelected({ color: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {selectedItemId?.startsWith('shape-') && (
                                <div className="space-y-4">
                                    <div><label className="text-[10px] font-black text-gray-400 mb-1 uppercase">Màu đổ</label><input type="color" className="w-full h-10 border rounded-lg" value={(selectedObject as ShapeConfig).fillColor} onChange={e => updateSelected({ fillColor: e.target.value })} /></div>
                                    <div><label className="text-[10px] font-black text-gray-400 mb-1 uppercase">Bo góc</label><input type="range" min="0" max="100" className="w-full" value={(selectedObject as ShapeConfig).borderRadius} onChange={e => updateSelected({ borderRadius: Number(e.target.value) })} /></div>
                                    <div><label className="text-[10px] font-black text-gray-400 mb-1 uppercase">Độ đục</label><input type="range" min="0" max="1" step="0.1" className="w-full" value={(selectedObject as ShapeConfig).opacity ?? 1} onChange={e => updateSelected({ opacity: Number(e.target.value) })} /></div>
                                </div>
                            )}

                            {selectedItemId?.startsWith('item-') && (selectedObject as DraggableItem).type === 'charm' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 mb-1 uppercase block">Hình dạng Mask</label>
                                        <select className="w-full p-2 border rounded-lg text-xs" value={(selectedObject as DraggableItem).maskShape || 'none'} onChange={e => updateSelected({ maskShape: e.target.value as any })}>
                                            <option value="none">Gốc</option><option value="circle">Hình tròn</option><option value="rounded">Bo góc</option><option value="heart">Trái tim</option><option value="star">Ngôi sao</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase block">Căn chỉnh & Lớp</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => alignItem('h-center')} 
                                        className="flex items-center justify-center gap-1.5 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[9px] font-black uppercase transition-all"
                                        title="Căn giữa theo chiều ngang"
                                    >
                                        ↔️ Giữa ngang
                                    </button>
                                    <button 
                                        onClick={() => alignItem('v-center')} 
                                        className="flex items-center justify-center gap-1.5 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[9px] font-black uppercase transition-all"
                                        title="Căn giữa theo chiều dọc"
                                    >
                                        ↕️ Giữa dọc
                                    </button>
                                    <button 
                                        onClick={() => moveLayer('front')} 
                                        className="flex items-center justify-center gap-1.5 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[9px] font-black uppercase transition-all"
                                        title="Đưa lên lớp trên cùng"
                                    >
                                        🔝 Lên trên
                                    </button>
                                    <button 
                                        onClick={() => moveLayer('back')} 
                                        className="flex items-center justify-center gap-1.5 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-[9px] font-black uppercase transition-all"
                                        title="Đưa xuống lớp dưới cùng"
                                    >
                                        bottom Xuống dưới
                                    </button>
                                </div>
                            </div>

                            <button onClick={() => handleItemRemove(selectedItemId!)} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest mt-4">🗑️ Xóa đối tượng</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeTool === 'museum' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                                        <p className="text-[10px] text-amber-800 font-bold leading-tight uppercase">
                                            🏛️ {t('studio.museum.title')}
                                        </p>
                                        <p className="text-[9px] text-amber-700 mt-1">
                                            {t('studio.museum.desc')}
                                        </p>
                                    </div>

                                    <div className="bg-amber-100/50 p-4 rounded-xl border border-amber-200/50">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-[11px] font-bold text-amber-900 uppercase">{t('studio.museum.toggle_3d')}</h4>
                                                <p className="text-[9px] text-amber-800 opacity-80">{t('studio.museum.toggle_3d_desc')}</p>
                                            </div>
                                            <button
                                                onClick={() => setConfig(prev => ({ ...prev, isMuseumStyle: !prev.isMuseumStyle }))}
                                                className={`w-10 h-5 rounded-full transition-colors relative ${config.isMuseumStyle ? 'bg-amber-600' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${config.isMuseumStyle ? 'left-6' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">{t('studio.museum.select_velvet')}</label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {VELVET_COLORS.map(color => (
                                                <button 
                                                    key={color.hex}
                                                    onClick={() => setConfig(prev => ({...prev, background: { type: 'color', value: color.hex }}))}
                                                    className={`w-full aspect-square rounded-lg border-2 transition-all ${config.background.value === color.hex ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color.hex }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="border-2 border-dashed border-amber-300 p-4 rounded-2xl text-center relative hover:bg-amber-50/50 transition-all">
                                            <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadMuseumFrame} disabled={isUploading} />
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-tight">
                                                {isUploading ? 'ĐANG TẢI...' : '+ TẢI KHUNG MUSEUM CỦA BẠN (PNG RỖNG)'}
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">{t('studio.museum.add_gold_frames')}</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {MUSEUM_FRAMES.map(frame => (
                                                    <button 
                                                        key={frame.id}
                                                        onClick={() => {
                                                            const id = Date.now();
                                                            setConfig(prev => ({
                                                                ...prev,
                                                                draggableItems: [...prev.draggableItems, { 
                                                                    id, 
                                                                    partId: 'https://firebasestorage.googleapis.com/v0/b/the-luvin.firebasestorage.app/o/uploads%2F1741542152648_d106r_photo_placeholder.png?alt=media&token=4e1e0a9d-5a6b-4e9e-b8d2-4b3d8a9e6e8b',
                                                                    type: 'charm', 
                                                                    x: 50, 
                                                                    y: 50, 
                                                                    rotation: 0, 
                                                                    scale: frame.id === 'spotlight' ? 0.8 : 0.4,
                                                                    frameUrl: frame.url,
                                                                    maskShape: frame.id === 'gold_oval' ? 'circle' : frame.id === 'gold_heart' ? 'heart' : 'none'
                                                                }]
                                                            }));
                                                            setSelectedItemId(`item-${id}`);
                                                        }}
                                                        className="p-2 border rounded-xl flex flex-col items-center gap-2 hover:bg-amber-50 hover:border-amber-200 transition-all group"
                                                    >
                                                        <div className="w-12 h-12 flex items-center justify-center">
                                                            <img src={frame.url} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform" alt={t(frame.nameKey)} referrerPolicy="no-referrer" />
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase text-gray-500">{t(frame.nameKey)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                        <p className="text-[9px] text-blue-700 leading-snug italic">
                                            💡 {t('studio.museum.tip_layers')}
                                        </p>
                                    </div>

                                    <button 
                                        onClick={() => setActiveTool('form')}
                                        className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        ➕ {t('studio.museum.create_upload_field')}
                                    </button>
                                </div>
                            )}

                            {activeTool === 'templates' && (
                                <div className="space-y-4">
                                    <button 
                                        onClick={() => {
                                            if (confirm("Làm mới toàn bộ thiết kế hiện tại?")) {
                                                setConfig(INITIAL_FRAME_CONFIG);
                                                setEditingBgId(null);
                                                setBgName('');
                                                setSelectedItemId(null);
                                            }
                                        }}
                                        className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        ✨ Thiết kế mới (Làm sạch)
                                    </button>
                                    
                                    <div className="pt-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Sửa từ mẫu cũ / Nền cũ</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {existingBackgrounds.map(bg => (
                                                <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer transition-all">
                                                    <img src={bg.previewUrl || bg.url} className="w-10 h-10 object-cover rounded shadow-sm" />
                                                    <div className="min-w-0 flex-grow">
                                                        <p className="text-xs font-bold truncate">{bg.name}</p>
                                                        <p className="text-[9px] text-gray-400 uppercase">{bg.category}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTool === 'khung' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">KÍCH THƯỚC KHUNG</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {frames.map(f => (
                                                <button 
                                                    key={f.id}
                                                    onClick={() => setConfig(prev => ({ ...prev, frameId: f.id }))}
                                                    className={`p-3 border-2 rounded-xl flex items-center justify-between transition-all ${config.frameId === f.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <div className="text-left">
                                                        <p className="text-xs font-black uppercase">{f.name}</p>
                                                        <p className="text-[9px] text-gray-400 italic">{f.description}</p>
                                                    </div>
                                                    {config.frameId === f.id && <span className="text-blue-600">✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">MÀU KHUNG THỰC TẾ</label>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => setConfig(prev => ({ ...prev, frameColor: 'white' }))}
                                                className={`flex-1 p-3 border-2 rounded-xl transition-all ${config.frameColor === 'white' ? 'border-gray-900 shadow-md' : 'border-gray-100'}`}
                                            >
                                                <div className="w-full h-8 bg-white border mb-2 rounded shadow-inner"></div>
                                                <span className="text-[10px] font-bold uppercase">Trắng</span>
                                            </button>
                                            <button 
                                                onClick={() => setConfig(prev => ({ ...prev, frameColor: 'black' }))}
                                                className={`flex-1 p-3 border-2 rounded-xl transition-all ${config.frameColor === 'black' ? 'border-gray-900 shadow-md' : 'border-gray-100'}`}
                                            >
                                                <div className="w-full h-8 bg-gray-900 mb-2 rounded shadow-inner"></div>
                                                <span className="text-[10px] font-bold uppercase">Đen</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTool === 'character' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <h3 className="font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <span>👤</span> Cấu hình nhân vật
                                </h3>
                                <button 
                                    onClick={handleAddCharacter}
                                    className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-lg hover:bg-gray-800 transition-all uppercase tracking-widest"
                                >
                                    + Thêm nhân vật
                                </button>
                            </div>

                            <div className="space-y-4">
                                {config.characters.map((char, idx) => (
                                    <div 
                                        key={char.id} 
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedItemId === `character-${char.id}` ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                                        onClick={() => setSelectedItemId(`character-${char.id}`)}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-bold text-gray-900">Nhân vật {idx + 1}</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleItemRemove(`character-${char.id}`); }}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>

                                        {selectedItemId === `character-${char.id}` && (
                                            <div className="space-y-4 pt-2 border-t border-gray-100">
                                                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                                                    {(['hair', 'face', 'shirt', 'pants', 'hat'] as const).map(type => (
                                                        <button
                                                            key={type}
                                                            onClick={() => setActivePartType(type)}
                                                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-md transition-all ${activePartType === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                        >
                                                            {type === 'hair' ? 'Tóc' : type === 'face' ? 'Mặt' : type === 'shirt' ? 'Áo' : type === 'pants' ? 'Quần' : 'Mũ'}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                    <button
                                                        onClick={() => handleCharacterUpdate(char.id, { [activePartType]: null })}
                                                        className={`aspect-square flex flex-col items-center justify-center border-2 rounded-lg transition-all ${!char[activePartType] ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                                                    >
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Trống</span>
                                                    </button>
                                                    {(products.filter(p => p.type === activePartType && (p.stock === undefined || p.stock > 0))).map(part => (
                                                        <button
                                                            key={part.id}
                                                            onClick={() => handleCharacterUpdate(char.id, { [activePartType]: part })}
                                                            className={`aspect-square flex flex-col items-center justify-center border-2 rounded-lg transition-all overflow-hidden ${char[activePartType]?.id === part.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                                                        >
                                                            <img src={part.imageUrl} alt={part.name} className="w-full h-full object-contain p-1" />
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Color selection for shirt/pants/hair if applicable */}
                                                {((activePartType === 'shirt' && char.shirt?.colors) || (activePartType === 'pants' && char.pants?.colors) || (activePartType === 'hair' && char.hair?.colors)) && (
                                                    <div className="space-y-2">
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Màu sắc</span>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(activePartType === 'shirt' ? char.shirt!.colors : activePartType === 'pants' ? char.pants!.colors : char.hair!.colors)!.map(color => (
                                                                <button
                                                                    key={color.hex}
                                                                    onClick={() => {
                                                                        if (activePartType === 'shirt') handleCharacterUpdate(char.id, { selectedShirtColor: color });
                                                                        else if (activePartType === 'pants') handleCharacterUpdate(char.id, { selectedPantsColor: color });
                                                                        else if (activePartType === 'hair') handleCharacterUpdate(char.id, { selectedHairColor: color });
                                                                    }}
                                                                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                                                                        (activePartType === 'shirt' ? char.selectedShirtColor?.hex === color.hex : 
                                                                         activePartType === 'pants' ? char.selectedPantsColor?.hex === color.hex : 
                                                                         char.selectedHairColor?.hex === color.hex) 
                                                                        ? 'border-gray-900 scale-110 shadow-md' : 'border-white shadow-sm hover:scale-105'
                                                                    }`}
                                                                    style={{ backgroundColor: color.hex }}
                                                                    title={color.name}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-3 pt-2">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Độ mờ</label>
                                                        <input 
                                                            type="range" min="0" max="1" step="0.1" 
                                                            value={char.opacity ?? 1} 
                                                            onChange={(e) => handleCharacterUpdate(char.id, { opacity: parseFloat(e.target.value) })}
                                                            className="w-full accent-gray-900"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" id={`lock-${char.id}`}
                                                            checked={char.lockedPosition || false}
                                                            onChange={(e) => handleCharacterUpdate(char.id, { lockedPosition: e.target.checked })}
                                                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                                        />
                                                        <label htmlFor={`lock-${char.id}`} className="text-[9px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer">Khóa vị trí</label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTool === 'background' && (
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Màu nền đơn sắc</label>
                                    <input type="color" className="w-full h-12 rounded-lg cursor-pointer" value={config.background.value} onChange={e => setConfig(prev => ({...prev, background: { type: 'color', value: e.target.value }}))} />
                                    <div className="border-t pt-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Thư viện ảnh nền</label>
                                        <input type="file" className="text-xs" onChange={async (e) => {
                                            if (e.target.files?.[0]) {
                                                const url = await uploadFile(e.target.files[0]);
                                                if (url) setConfig(prev => ({...prev, background: { type: 'image', value: url }}));
                                            }
                                        }} />
                                    </div>
                                </div>
                            )}
                            {activeTool === 'shape' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => {
                                        const id = Date.now();
                                        setConfig(prev => ({...prev, shapes: [...(prev.shapes || []), { id, type: 'rect', x: 50, y: 50, width: 20, height: 20, rotation: 0, strokeColor: '#000000', strokeWidth: 0, strokeType: 'solid', borderRadius: 0, fillColor: '#cccccc', opacity: 1 }]}));
                                        setSelectedItemId(`shape-${id}`);
                                    }} className="p-4 border rounded-xl flex flex-col items-center gap-2 hover:bg-gray-50 transition-all"><div className="w-8 h-8 bg-gray-300 rounded-sm"></div><span className="text-[10px] font-bold uppercase">Hình vuông</span></button>
                                    <button onClick={() => {
                                        const id = Date.now();
                                        setConfig(prev => ({...prev, shapes: [...(prev.shapes || []), { id, type: 'circle', x: 50, y: 50, width: 20, height: 20, rotation: 0, strokeColor: '#000000', strokeWidth: 0, strokeType: 'solid', borderRadius: 100, fillColor: '#cccccc', opacity: 1 }]}));
                                        setSelectedItemId(`shape-${id}`);
                                    }} className="p-4 border rounded-xl flex flex-col items-center gap-2 hover:bg-gray-50 transition-all"><div className="w-8 h-8 bg-gray-300 rounded-full"></div><span className="text-[10px] font-bold uppercase">Hình tròn</span></button>
                                </div>
                            )}
                            {activeTool === 'text' && (
                                <div className="space-y-4">
                                    <button onClick={() => {
                                        const id = Date.now();
                                        setConfig(prev => ({ ...prev, texts: [...prev.texts, { id, content: 'Chữ mới', font: 'Montserrat', size: 14, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, textAlign: 'center', width: 40 }] }));
                                        setSelectedItemId(`text-${id}`);
                                    }} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-xs font-black text-gray-400 hover:bg-gray-50 transition-all uppercase">+ Thêm văn bản</button>
                                    
                                    <div className="pt-4 border-t">
                                        <p className="text-[9px] text-gray-400 italic mb-2">Bạn muốn dùng font riêng của mình?</p>
                                        <button 
                                            onClick={() => window.location.href = '/admin?tab=config&configTab=fonts'} 
                                            className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold uppercase hover:bg-gray-200 transition-all"
                                        >
                                            ⚙️ Quản lý Font tải lên
                                        </button>
                                    </div>
                                </div>
                            )}
                            {activeTool === 'upload' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-2">
                                        <p className="text-[10px] text-blue-700 font-bold leading-tight">
                                            💡 Mẹo: Tải ảnh lên rồi chọn "Liên kết Form" để tạo ô cho khách tự thay ảnh của họ (ví dụ: ảnh chân dung, ảnh kỷ niệm).
                                        </p>
                                    </div>
                                    <div className="border-2 border-dashed border-gray-300 p-6 rounded-2xl text-center relative hover:bg-gray-50 transition-all">
                                        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadSticker} disabled={isUploading} />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isUploading ? 'ĐANG TẢI...' : '+ TẢI ẢNH / STICKER'}</p>
                                    </div>
                                </div>
                            )}
                            {activeTool === 'form' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex flex-col">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh sách trường</h4>
                                            <p className="text-[9px] text-gray-400 italic">Thiết lập các ô nhập liệu cho khách</p>
                                        </div>
                                        <button onClick={handleAddField} className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-[10px] uppercase shadow-sm hover:bg-blue-700 transition-all">+ Thêm</button>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                                        <span className="text-[10px] font-black text-blue-700 uppercase">Chế độ Test (Xem thử)</span>
                                        <button 
                                            onClick={() => setIsTestMode(!isTestMode)} 
                                            className={`w-10 h-5 rounded-full p-1 transition-all ${isTestMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isTestMode ? 'translate-x-5' : ''}`}></div>
                                        </button>
                                    </div>

                                    {isTestMode ? (
                                        <div className="space-y-3 animate-fade-in">
                                            <p className="text-[9px] text-blue-600 font-bold bg-blue-50 p-2 rounded border border-blue-100 italic">💡 Nhập thử vào đây để xem thông tin thay đổi trên thiết kế như thế nào.</p>
                                            {(config.formFields || []).map(f => (
                                                <div key={f.id} className="space-y-1">
                                                    <label className="text-[9px] font-black text-gray-500 uppercase ml-1">{f.label}</label>
                                                    {f.type === 'color' ? (
                                                        <input type="color" value={testFormData[f.id] || '#000000'} onChange={e => handleUpdateTestForm(f.id, e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                                                    ) : f.type === 'image' ? (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex gap-2">
                                                                <input type="text" value={testFormData[f.id] || ''} onChange={e => handleUpdateTestForm(f.id, e.target.value)} className="flex-1 p-2 border rounded-lg text-xs" placeholder="Dán link hoặc tải ảnh..." />
                                                                <div className="relative w-8 h-8 border rounded overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                                    {testFormData[f.id] ? (
                                                                        <img src={testFormData[f.id]} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[8px] text-gray-400">Ảnh</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="relative">
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                                                    onChange={(e) => handleTestImageUpload(f.id, e)}
                                                                    disabled={isUploading}
                                                                />
                                                                <button className={`w-full py-1.5 border-2 border-dashed border-blue-200 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${isUploading ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                                                                    {isUploading ? 'ĐANG TẢI...' : '↑ TẢI ẢNH TEST'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : f.type === 'textarea' ? (
                                                        <textarea value={testFormData[f.id] || ''} onChange={e => handleUpdateTestForm(f.id, e.target.value)} className="w-full p-2 border rounded-lg text-xs" rows={2} placeholder={f.placeholder} />
                                                    ) : (
                                                        <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} value={testFormData[f.id] || ''} onChange={e => handleUpdateTestForm(f.id, e.target.value)} className="w-full p-2 border rounded-lg text-xs" placeholder={f.placeholder} />
                                                    )}
                                                </div>
                                            ))}
                                            {(!config.formFields || config.formFields.length === 0) && (
                                                <p className="text-center py-4 text-xs text-gray-400 italic">Chưa có trường nào để test.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 animate-fade-in">
                                            {(config.formFields || []).map((f) => (
                                                <div key={f.id} className="p-3 bg-gray-50 border rounded-xl space-y-2 relative group hover:border-blue-300 transition-all">
                                                    <button onClick={() => removeField(f.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">&times;</button>
                                                    
                                                    <div className="flex gap-2">
                                                        <div className="flex-grow">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <label className="text-[8px] font-black text-gray-400 uppercase block">Tên nhãn (Label)</label>
                                                                {isFieldLinked(f.id) && (
                                                                    <span className="text-[7px] bg-green-500 text-white px-1 rounded font-black animate-pulse">LIVE</span>
                                                                )}
                                                            </div>
                                                            <input className="w-full p-1.5 border rounded text-xs font-bold" value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} placeholder="Tên trường..." />
                                                        </div>
                                                        <div className="w-24">
                                                            <label className="text-[8px] font-black text-gray-400 uppercase mb-0.5 block">Loại</label>
                                                            <select className="w-full p-1.5 border rounded text-[10px] font-bold bg-white" value={f.type} onChange={e => updateField(f.id, { type: e.target.value as any })}>
                                                                <option value="text">Chữ ngắn</option>
                                                                <option value="textarea">Chữ dài</option>
                                                                <option value="date">Ngày tháng</option>
                                                                <option value="number">Số lượng</option>
                                                                <option value="select">Lựa chọn</option>
                                                                <option value="color">Màu sắc</option>
                                                                <option value="image">Hình ảnh</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-1">
                                                        <label className="flex items-center gap-1 text-[9px] cursor-pointer font-bold text-gray-500 uppercase">
                                                            <input type="checkbox" checked={f.required} onChange={e => updateField(f.id, { required: e.target.checked })} /> Cần nhập
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-gray-400 uppercase">ID:</span>
                                                            <span className="text-[8px] font-mono text-gray-400 bg-gray-100 px-1 rounded">{f.id.slice(-6)}</span>
                                                        </div>
                                                    </div>

                                                    {['text', 'textarea', 'number'].includes(f.type) && (
                                                        <input 
                                                            className="w-full p-1 border-b border-dashed bg-transparent text-[9px] outline-none italic text-gray-400" 
                                                            value={f.placeholder || ''} 
                                                            onChange={e => updateField(f.id, { placeholder: e.target.value })} 
                                                            placeholder="Gợi ý nhập (Placeholder)..." 
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTool === 'layers' && (
                                <div className="space-y-2">
                                    {config.texts.map(t => (
                                        <div key={t.id} onClick={() => setSelectedItemId(`text-${t.id}`)} className={`p-2 border rounded-lg text-xs flex justify-between items-center cursor-pointer ${selectedItemId === `text-${t.id}` ? 'border-blue-500 bg-blue-50' : ''}`}>
                                            <span className="truncate">Chữ: {t.content}</span>
                                        </div>
                                    ))}
                                    {config.draggableItems.map(i => (
                                        <div key={i.id} onClick={() => setSelectedItemId(`item-${i.id}`)} className={`p-2 border rounded-lg text-xs flex justify-between items-center cursor-pointer ${selectedItemId === `item-${i.id}` ? 'border-blue-500 bg-blue-50' : ''}`}>
                                            <span>{i.type === 'charm' ? 'Sticker/Ảnh' : 'Linh kiện'}</span>
                                        </div>
                                    ))}
                                    {(config.shapes || []).map(s => (
                                        <div key={s.id} onClick={() => setSelectedItemId(`shape-${s.id}`)} className={`p-2 border rounded-lg text-xs flex justify-between items-center cursor-pointer ${selectedItemId === `shape-${s.id}` ? 'border-blue-500 bg-blue-50' : ''}`}>
                                            <span>Khối hình</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-grow flex flex-col bg-[#f5f6f7] overflow-hidden">
                <div className="h-14 bg-white border-b flex items-center justify-between px-6 z-30 shadow-sm">
                    <div className="flex items-center gap-6">
                        <select className="border-0 p-0 text-sm font-black text-gray-900 bg-transparent focus:ring-0 outline-none cursor-pointer" value={config.frameId} onChange={e => setConfig(prev => ({ ...prev, frameId: e.target.value }))}>
                            {frames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1 hover:bg-white rounded disabled:opacity-30" title="Ctrl + Z">⟲</button>
                            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1 hover:bg-white rounded disabled:opacity-30" title="Ctrl + Y">⟳</button>
                        </div>
                        <input type="range" min="0.2" max="2" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-24 accent-gray-900" />
                    </div>
                    <button onClick={() => setShowSaveModal(true)} className="px-8 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">Lưu mẫu thiết kế</button>
                </div>

                <div className="flex-grow relative flex items-center justify-center p-8 overflow-auto custom-scrollbar" onMouseDown={() => setSelectedItemId(null)}>
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="bg-white shadow-2xl transition-transform duration-300 ring-1 ring-gray-200">
                        <FramePreview 
                            ref={previewRef} 
                            config={config} 
                            containerWidth={500} 
                            onItemTransform={handleItemTransform} 
                            onItemRemove={handleItemRemove} 
                            onTextUpdate={(id, updates) => {
                                setConfig(prev => ({
                                    ...prev,
                                    texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t)
                                }));
                            }}
                            onCharacterUpdate={handleCharacterUpdate}
                            isInteractive={true} 
                            selectedItemId={selectedItemId} 
                            setSelectedItemId={(id) => {
                                setSelectedItemId(id);
                                if (id?.startsWith('character-')) setActiveTool('character');
                            }} 
                            setIsEditingText={() => {}} 
                            allParts={allKnownParts} 
                            activePartType={activePartType}
                            previewFont={previewFont} 
                            allowTextScaling 
                        />
                    </div>
                </div>
            </div>

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSaveModal(false)}>
                    <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black mb-6 uppercase">Lưu mẫu thiết kế</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">Lưu dưới dạng</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setSaveType('background')} 
                                        className={`p-3 rounded-xl font-bold text-[10px] border transition-all uppercase tracking-widest ${saveType === 'background' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-gray-500 border-gray-200'}`}
                                    >
                                        🖼️ Nền thiết kế
                                    </button>
                                    <button 
                                        onClick={() => setSaveType('template')} 
                                        className={`p-3 rounded-xl font-bold text-[10px] border transition-all uppercase tracking-widest ${saveType === 'template' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-gray-500 border-gray-200'}`}
                                    >
                                        🛍️ Mẫu sản phẩm
                                    </button>
                                </div>
                                <p className="text-[9px] text-gray-400 mt-2 italic leading-tight">
                                    {saveType === 'background' 
                                        ? 'Nền sẽ xuất hiện ở Bước 2 trong Studio để khách chọn làm nền.' 
                                        : 'Mẫu sẽ xuất hiện ở trang Bộ sưu tập, khách có thể mua ngay.'}
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Tên {saveType === 'background' ? 'nền' : 'mẫu'}</label>
                                <input className="w-full p-3 border rounded-xl font-bold focus:ring-2 focus:ring-black outline-none" value={bgName} onChange={e => setBgName(e.target.value)} placeholder={saveType === 'background' ? "Ví dụ: Nền hoa hồng..." : "Ví dụ: Mẫu kỷ niệm 1 năm..."} />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Dịp / Chủ đề (Bộ lọc)</label>
                                {!isNewCategory ? (
                                    <div className="flex gap-2">
                                        <select className="flex-grow p-3 border rounded-xl font-bold focus:ring-2 focus:ring-black outline-none" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                        <button onClick={() => setIsNewCategory(true)} className="px-4 bg-gray-100 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">Mới</button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input className="flex-grow p-3 border rounded-xl font-bold focus:ring-2 focus:ring-black outline-none" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nhập dịp mới..." autoFocus />
                                        <button onClick={() => setIsNewCategory(false)} className="px-4 bg-gray-100 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">Hủy</button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Loại khung</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setBgType('square')} className={`p-3 rounded-xl font-bold text-xs border transition-all ${bgType === 'square' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}>Vuông (1:1)</button>
                                    <button onClick={() => setBgType('rectangle')} className={`p-3 rounded-xl font-bold text-xs border transition-all ${bgType === 'rectangle' ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}>Chữ nhật (3:4)</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowSaveModal(false)} className="px-6 py-3 font-bold text-gray-400 uppercase text-xs">Hủy</button>
                            <button onClick={async () => {
                                if (!bgName) return alert("Vui lòng nhập tên!");
                                const finalCategory = isNewCategory ? newCategoryName.trim() : bgCategory;
                                if (!finalCategory) return alert("Vui lòng chọn hoặc nhập dịp!");

                                setIsUploading(true);
                                try {
                                    // Chụp ảnh preview nếu là template
                                    let previewUrl = config.background.value;
                                    if (saveType === 'template' && previewRef.current) {
                                        try {
                                            // Tạm thời bỏ outline và các handle để chụp ảnh sạch
                                            setSelectedItemId(null);
                                            // Đợi một chút để UI cập nhật
                                            await new Promise(r => setTimeout(r, 100));
                                            
                                            const canvas = await html2canvas(previewRef.current, {
                                                useCORS: true,
                                                scale: 2,
                                                backgroundColor: config.frameColor === 'black' ? '#1a1a1a' : '#ffffff',
                                                logging: false
                                            });
                                            
                                            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
                                            if (blob) {
                                                const file = new File([blob], `preview_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                                const uploadedUrl = await uploadFile(file);
                                                if (uploadedUrl) previewUrl = uploadedUrl;
                                            }
                                        } catch (captureErr) {
                                            console.error("Lỗi khi chụp ảnh preview:", captureErr);
                                            // Fallback to background image if capture fails
                                        }
                                    } else if (!previewUrl.startsWith('http')) {
                                        previewUrl = "";
                                    }

                                    if (saveType === 'background') {
                                        const newId = editingBgId || `bg_${Date.now()}`;
                                        const backgroundData: PresetBackground = {
                                            id: newId,
                                            name: bgName, 
                                            category: finalCategory, 
                                            type: bgType, 
                                            url: config.background.value,
                                            overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes },
                                            formFields: config.formFields || []
                                        };
                                        const success = editingBgId ? await updateBackground(editingBgId, backgroundData) : await addBackground(backgroundData);
                                        if (success) {
                                            alert("Đã lưu nền thành công!");
                                            setEditingBgId(newId);
                                        }
                                    } else {
                                        const newId = editingBgId || `tpl_${Date.now()}`;
                                        const templateData = {
                                            id: newId,
                                            name: bgName,
                                            imageUrl: previewUrl,
                                            category: finalCategory,
                                            config: { ...config, previewImageUrl: previewUrl },
                                            purchaseCount: 0
                                        };
                                        const success = editingBgId ? await updateTemplate(editingBgId, templateData) : await addTemplate(templateData);
                                        if (success) {
                                            alert("Đã lưu mẫu sản phẩm thành công!");
                                            setEditingBgId(newId);
                                        }
                                    }

                                    setShowSaveModal(false); 
                                    setIsNewCategory(false);
                                    setNewCategoryName('');
                                } catch (err) {
                                    console.error(err);
                                    alert("Đã xảy ra lỗi không xác định!");
                                } finally {
                                    setIsUploading(false);
                                }
                            }} className="px-10 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all disabled:opacity-50" disabled={isUploading}>
                                {isUploading ? 'Đang xử lý...' : 'Xác nhận Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
