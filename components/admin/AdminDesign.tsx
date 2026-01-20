
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, FormField } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';
import { dataURLToBlob } from '../../utils/helpers';

declare var html2canvas: any;

type Transform = {
    x: number;
    y: number;
    rotation: number;
    scale: number;
    width?: number;
    height?: number;
}

const TOOLS = [
    { id: 'templates', icon: '📂', label: 'Mẫu' }, 
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'shape', icon: '🟥', label: 'Khối' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'form', icon: '📝', label: 'Form' }, 
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];
const QUICK_COLORS = ['#333333', '#ffffff', '#efa3b5', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const FontSelector: React.FC<{ 
    value: string; 
    onChange: (font: string) => void;
    onPreview: (font: string | null) => void;
    uploadedFonts: CustomFont[];
}> = ({ value, onChange, onPreview, uploadedFonts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

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
        <div className="relative" ref={dropdownRef} onMouseLeave={() => onPreview(null)}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex justify-between items-center"
            >
                <span className="truncate">{value}</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-hidden flex flex-col">
                    <div className="p-2 border-b bg-gray-50 sticky top-0 z-10">
                        <div className="relative">
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                placeholder="Tìm font..." 
                                className="w-full p-1.5 pl-7 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <svg className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        {filteredGroups.length > 0 ? filteredGroups.map((group) => (
                            <div key={group.label}>
                                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase bg-gray-50">{group.label}</div>
                                {group.fonts.map(font => (
                                    <div 
                                        key={font}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${value === font ? 'bg-blue-50 text-blue-600 font-bold' : ''}`}
                                        onMouseEnter={() => onPreview(font)}
                                        onClick={() => { onChange(font); setIsOpen(false); }}
                                        style={{ fontFamily: font }}
                                    >
                                        {font}
                                    </div>
                                ))}
                            </div>
                        )) : (
                            <div className="px-3 py-4 text-center text-xs text-gray-400 italic">
                                Không tìm thấy font nào
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const AdminDesign: React.FC = () => {
    const [activeTool, setActiveTool] = useState('templates');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [existingBackgrounds, setExistingBackgrounds] = useState<PresetBackground[]>([]);
    const [history, setHistory] = useState<FrameConfig[]>([INITIAL_FRAME_CONFIG]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<any>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    
    // Metadata states
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    
    const [existingPreviewUrl, setExistingPreviewUrl] = useState<string>('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');
    const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const dynamicCategories = useMemo(() => {
        const cats = new Set(['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Doanh nghiệp', 'Khác']);
        existingBackgrounds.forEach(bg => { if(bg.category) cats.add(bg.category); });
        return Array.from(cats).sort();
    }, [existingBackgrounds]);

    const setConfigWithHistory = useCallback((newConfigOrFn: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => {
        setConfig(prev => {
            const newConfig = typeof newConfigOrFn === 'function' ? newConfigOrFn(prev) : newConfigOrFn;
            if (JSON.stringify(newConfig) !== JSON.stringify(prev)) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(newConfig);
                if (newHistory.length > 40) newHistory.shift();
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
            return newConfig;
        });
    }, [history, historyIndex]);

    const handleUndo = useCallback(() => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setConfig(history[newIndex]); } }, [history, historyIndex]);
    const handleRedo = useCallback(() => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setConfig(history[newIndex]); } }, [history, historyIndex]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData] = await Promise.all([
                getAllFrames(), getStoreConfig(), getAllBackgrounds()
            ]);
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
            if (bgData) setExistingBackgrounds(bgData);
        };
        fetchInitialData();
    }, []);

    const updateSelected = useCallback((updates: any) => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? { ...i, ...updates } : i) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s) };
            return prev;
        });
    }, [selectedItemId, setConfigWithHistory]);

    const handleItemRemove = useCallback((id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setSelectedItemId(null);
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== numericId) };
            return prev;
        });
    }, [setConfigWithHistory]);

    const duplicateSelected = useCallback(() => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        const newId = Date.now();
        
        setConfigWithHistory(prev => {
            if (type === 'text') {
                const source = prev.texts.find(t => t.id === id);
                if (!source) return prev;
                return { ...prev, texts: [...prev.texts, { ...source, id: newId, x: source.x + 4, y: source.y + 4 }] };
            }
            if (type === 'shape') {
                const source = prev.shapes?.find(s => s.id === id);
                if (!source) return prev;
                return { ...prev, shapes: [...(prev.shapes || []), { ...source, id: newId, x: source.x + 4, y: source.y + 4 }] };
            }
            if (type === 'item') {
                const source = prev.draggableItems.find(i => i.id === id);
                if (!source) return prev;
                return { ...prev, draggableItems: [...prev.draggableItems, { ...source, id: newId, x: source.x + 4, y: source.y + 4 }] };
            }
            return prev;
        });
        setSelectedItemId(`${type}-${newId}`);
    }, [selectedItemId, setConfigWithHistory]);

    const moveLayer = useCallback((id: string, direction: 'front' | 'back' | 'up' | 'down') => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setConfigWithHistory(prev => {
            const next = { ...prev };
            let arr: any[] = [];
            let key: 'texts' | 'shapes' | 'draggableItems' = 'texts';
            
            if (type === 'text') { arr = [...next.texts]; key = 'texts'; }
            else if (type === 'shape') { arr = [...(next.shapes || [])]; key = 'shapes'; }
            else if (type === 'item') { arr = [...next.draggableItems]; key = 'draggableItems'; }
            
            const idx = arr.findIndex(item => item.id === numericId);
            if (idx === -1) return prev;
            
            const [item] = arr.splice(idx, 1);
            if (direction === 'front') arr.push(item);
            else if (direction === 'back') arr.unshift(item);
            else if (direction === 'up') arr.splice(Math.min(arr.length, idx + 1), 0, item);
            else if (direction === 'down') arr.splice(Math.max(0, idx - 1), 0, item);
            
            (next as any)[key] = arr;
            return next;
        });
    }, [setConfigWithHistory]);

    // HỆ THỐNG PHÍM TẮT & NUDGE (DI CHUYỂN TINH VI)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // DI CHUYỂN BẰNG PHÍM MŨI TÊN
            if (selectedItemId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 2 : 0.5; // Shift di chuyển 2% (~10px), bình thường 0.5% (~2px)
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                
                const [type, idStr] = selectedItemId.split('-');
                const id = parseInt(idStr);
                setConfigWithHistory(prev => {
                    const updateItem = (item: any) => item.id === id ? { ...item, x: Math.max(0, Math.min(100, item.x + dx)), y: Math.max(0, Math.min(100, item.y + dy)) } : item;
                    if (type === 'text') return { ...prev, texts: prev.texts.map(updateItem) };
                    if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(updateItem) };
                    if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(updateItem) };
                    return prev;
                });
                return;
            }

            // XÓA: Delete/Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedItemId) { e.preventDefault(); handleItemRemove(selectedItemId); }
            }

            // COPY/PASTE
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedItemId) {
                    const [type, idStr] = selectedItemId.split('-');
                    const id = parseInt(idStr);
                    const source = type === 'text' ? config.texts.find(t => t.id === id) : type === 'shape' ? config.shapes?.find(s => s.id === id) : config.draggableItems.find(i => i.id === id);
                    if (source) setClipboard({ type, data: source });
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (clipboard) {
                    const newId = Date.now();
                    const newData = { ...clipboard.data, id: newId, x: Math.min(95, clipboard.data.x + 5), y: Math.min(95, clipboard.data.y + 5) };
                    setConfigWithHistory(prev => {
                        if (clipboard.type === 'text') return { ...prev, texts: [...prev.texts, newData] };
                        if (clipboard.type === 'shape') return { ...prev, shapes: [...(prev.shapes || []), newData] };
                        if (clipboard.type === 'item') return { ...prev, draggableItems: [...prev.draggableItems, newData] };
                        return prev;
                    });
                    setSelectedItemId(`${clipboard.type}-${newId}`);
                }
            }

            // UNDO/REDO
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }

            // LAYER ORDER: Ctrl + [ / ]
            if ((e.ctrlKey || e.metaKey) && e.key === '[') {
                if (selectedItemId) { e.preventDefault(); moveLayer(selectedItemId, 'down'); }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === ']') {
                if (selectedItemId) { e.preventDefault(); moveLayer(selectedItemId, 'up'); }
            }

            // DESELECT: Escape
            if (e.key === 'Escape') { setSelectedItemId(null); }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, config, clipboard, handleItemRemove, handleUndo, handleRedo, setConfigWithHistory, moveLayer]);

    const handleAlign = (type: 'center' | 'horizontal' | 'vertical' | 'left' | 'right' | 'top' | 'bottom') => {
        if (!selectedItemId) return;
        let upd = {};
        if (type === 'center') upd = { x: 50, y: 50 };
        else if (type === 'horizontal') upd = { x: 50 };
        else if (type === 'vertical') upd = { y: 50 };
        else if (type === 'left') upd = { x: 10 };
        else if (type === 'right') upd = { x: 90 };
        else if (type === 'top') upd = { y: 10 };
        else if (type === 'bottom') upd = { y: 90 };
        updateSelected(upd);
    };

    const handleBackgroundChange = useCallback((type: 'color' | 'image', value: string) => {
        setConfigWithHistory(prev => ({ ...prev, background: { type, value } }));
    }, [setConfigWithHistory]);

    const handleFrameChange = useCallback((frameId: string) => {
        setConfigWithHistory(prev => ({ ...prev, frameId }));
    }, [setConfigWithHistory]);

    const handlePrepareSave = async () => {
        setIsSaving(true);
        try {
            const container = previewRef.current;
            if (container && typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(container, {
                    backgroundColor: null,
                    useCORS: true,
                    scale: 1,
                    logging: false
                });
                const dataUrl = canvas.toDataURL('image/png');
                const blob = dataURLToBlob(dataUrl);
                setGeneratedThumbnailUrl(dataUrl);
                setGeneratedThumbnailBlob(blob);
                setShowSaveModal(true);
            }
        } catch (error) {
            console.error("Error generating thumbnail:", error);
            alert("Lỗi tạo ảnh thumbnail.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmSave = async () => {
        if (!bgName.trim()) return alert("Vui lòng nhập tên mẫu!");
        setIsSaving(true);
        try {
            let thumbnailUrl = existingPreviewUrl;
            if (generatedThumbnailBlob) {
                const file = new File([generatedThumbnailBlob], "thumb.png", { type: "image/png" });
                const uploadedUrl = await uploadToCloudinary(file);
                if (uploadedUrl) thumbnailUrl = uploadedUrl;
            }

            const backgroundData: PresetBackground = {
                id: editingBgId || `bg_${Date.now()}`,
                name: bgName,
                category: bgCategory,
                type: bgType,
                url: config.background.value,
                previewUrl: thumbnailUrl,
                orientation: config.isRotated ? 'landscape' : 'portrait',
                overlayConfig: {
                    texts: config.texts,
                    draggableItems: config.draggableItems,
                    shapes: config.shapes,
                    // @ts-ignore
                    frameId: config.frameId 
                },
                formFields: config.formFields || []
            };

            let success = false;
            if (editingBgId) success = await updateBackground(editingBgId, backgroundData);
            else success = await addBackground(backgroundData);

            if (success) {
                alert("Đã lưu mẫu thiết kế thành công!");
                setShowSaveModal(false);
                const bgData = await getAllBackgrounds();
                setExistingBackgrounds(bgData);
            } else alert("Lỗi khi lưu vào database.");
        } catch (error) {
            console.error(error);
            alert("Đã có lỗi xảy ra.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadTemplate = (bg: PresetBackground) => {
        if (confirm("Tải mẫu này sẽ thay thế thiết kế hiện tại. Tiếp tục?")) {
            setEditingBgId(bg.id);
            setBgName(bg.name);
            setBgCategory(bg.category);
            setBgType(bg.type);
            setExistingPreviewUrl(bg.previewUrl || ''); 
            
            const newConfig: FrameConfig = {
                frameId: bg.type === 'rectangle' ? 'md' : 'lg',
                background: { type: bg.url.startsWith('#') ? 'color' : 'image', value: bg.url },
                texts: bg.overlayConfig?.texts || [],
                draggableItems: bg.overlayConfig?.draggableItems || [],
                shapes: bg.overlayConfig?.shapes || [],
                formFields: bg.formFields || [], 
                characters: []
            };
            if ((bg.overlayConfig as any)?.frameId) newConfig.frameId = (bg.overlayConfig as any).frameId;
            setConfigWithHistory(newConfig);
            setActiveTool('form');
        }
    };

    const handleNewDesign = () => {
        if (confirm("Xóa thiết kế hiện tại để tạo mẫu mới?")) {
            setEditingBgId(null);
            setBgName('');
            setBgCategory('Tình yêu');
            setBgType('square');
            setExistingPreviewUrl('');
            setConfig(INITIAL_FRAME_CONFIG);
            setHistory([INITIAL_FRAME_CONFIG]);
            setHistoryIndex(0);
            setSelectedItemId(null);
        }
    };

    const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    if (activeTool === 'background') {
                        setConfigWithHistory(prev => ({ ...prev, background: { type: 'image', value: url } }));
                        await addAsset(url, 'background');
                    } else {
                        const newItem: DraggableItem = { id: Date.now(), partId: url, type: 'charm', x: 50, y: 50, rotation: 0, scale: 0.5 };
                        setConfigWithHistory(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
                        await addAsset(url, 'sticker');
                    }
                }
            } catch (error) { console.error(error); } finally { setIsSaving(false); }
        }
    };

    const addText = () => {
        const newId = Date.now();
        const newText: TextConfig = { id: newId, content: 'Văn bản mới', font: 'Montserrat', size: 14, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, textAlign: 'center', width: 30 };
        setConfigWithHistory(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newId}`);
    };

    const addShape = (type: 'rect' | 'circle') => {
        const newId = Date.now();
        const newShape: ShapeConfig = {
            id: newId, type, x: 50, y: 50, width: 20, height: 20, rotation: 0,
            fillColor: '#efa3b5', strokeColor: '#000000', strokeWidth: 1, strokeType: 'solid', borderRadius: type === 'circle' ? 100 : 0
        };
        setConfigWithHistory(prev => ({ ...prev, shapes: [...(prev.shapes || []), newShape] }));
        setSelectedItemId(`shape-${newId}`);
    };

    const selectedObject = useMemo(() => {
        if (!selectedItemId) return null;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        if (type === 'text') return config.texts.find(t => t.id === id) || null;
        if (type === 'item') return config.draggableItems.find(i => i.id === id) || null;
        if (type === 'shape') return config.shapes?.find(s => s.id === id) || null;
        return null;
    }, [selectedItemId, config]);

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in relative">
            
            {/* TOOLBAR LEFT */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button key={tool.id} onClick={() => { setActiveTool(tool.id); setSelectedItemId(null); }} className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition-all ${activeTool === tool.id ? 'bg-white text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                        <span className="text-xl mb-1">{tool.icon}</span>
                        <span className="text-[10px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
                <div className="mt-auto mb-2">
                    <button onClick={() => setShowShortcuts(true)} className="w-10 h-10 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-lg">?</button>
                </div>
            </div>

            {/* PROPERTY PANEL */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-black text-gray-800 uppercase tracking-tight text-xs">
                        {selectedObject ? 'Thuộc tính đối tượng' : (TOOLS.find(t => t.id === activeTool)?.label)}
                    </h3>
                    {selectedObject && <button onClick={() => setSelectedItemId(null)} className="text-[10px] bg-gray-200 px-2 py-1 rounded font-bold hover:bg-gray-300">Đóng</button>}
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {selectedObject ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex gap-2">
                                <button onClick={duplicateSelected} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100 hover:bg-blue-100">👯 Nhân bản</button>
                                <button onClick={() => handleItemRemove(selectedItemId!)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold border border-red-100 hover:bg-red-100">🗑️ Xóa</button>
                            </div>

                            {/* ALIGNMENT TOOLS */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Căn chỉnh nhanh</label>
                                <div className="grid grid-cols-4 gap-1">
                                    <button onClick={() => handleAlign('left')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn trái">⇤</button>
                                    <button onClick={() => handleAlign('horizontal')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn giữa ngang">↔</button>
                                    <button onClick={() => handleAlign('right')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn phải">⇥</button>
                                    <button onClick={() => handleAlign('center')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn chính giữa">⊹</button>
                                    <button onClick={() => handleAlign('top')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn trên">⤒</button>
                                    <button onClick={() => handleAlign('vertical')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn giữa dọc">↕</button>
                                    <button onClick={() => handleAlign('bottom')} className="p-2 bg-gray-50 border rounded hover:bg-gray-100" title="Căn dưới">⤓</button>
                                    <button 
                                        onClick={() => {
                                            if (selectedItemId?.startsWith('item-')) {
                                                updateSelected({ isFlipped: !(selectedObject as DraggableItem).isFlipped });
                                            }
                                        }} 
                                        className="p-2 bg-gray-50 border rounded hover:bg-gray-100" 
                                        title="Lật ngang"
                                    >
                                        ⇄
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">🔒 Khóa vị trí</span>
                                <button onClick={() => updateSelected({ lockedPosition: !selectedObject.lockedPosition })} className={`w-10 h-5 rounded-full p-1 transition-colors ${selectedObject.lockedPosition ? 'bg-red-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full transition-transform ${selectedObject.lockedPosition ? 'translate-x-5' : ''}`}></div></button>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Độ trong suốt</label>
                                <div className="flex items-center gap-3"><input type="range" min="0" max="1" step="0.01" value={selectedObject.opacity ?? 1} onChange={e => updateSelected({ opacity: parseFloat(e.target.value) })} className="flex-grow accent-blue-600" /><span className="text-xs font-mono w-8 text-right">{Math.round((selectedObject.opacity ?? 1) * 100)}%</span></div>
                            </div>

                            {selectedItemId?.startsWith('text-') && (
                                <div className="space-y-4 pt-2">
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                                        <label className="block text-[10px] font-black text-blue-700 uppercase tracking-tight">🔗 LIÊN KẾT FORM</label>
                                        <select className="w-full p-2 border rounded-lg text-xs font-bold bg-white" value={(selectedObject as TextConfig).linkedFieldId || ''} onChange={e => updateSelected({ linkedFieldId: e.target.value })}>
                                            <option value="">-- Không liên kết --</option>
                                            {(config.formFields || []).map(f => (<option key={f.id} value={f.id}>{f.label}</option>))}
                                        </select>
                                    </div>
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nội dung</label><textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={(selectedObject as TextConfig).content} onChange={e => updateSelected({ content: e.target.value })} /></div>
                                    <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Font chữ</label><FontSelector value={(selectedObject as TextConfig).font} onChange={f => updateSelected({ font: f })} onPreview={setPreviewFont} uploadedFonts={uploadedFonts} /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cỡ chữ</label><input type="number" className="w-full p-2 border rounded-lg text-sm" value={(selectedObject as TextConfig).size} onChange={e => updateSelected({ size: Number(e.target.value) })} /></div>
                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Màu sắc</label><input type="color" className="w-full h-9 border rounded-lg" value={(selectedObject as TextConfig).color} onChange={e => updateSelected({ color: e.target.value })} /></div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {QUICK_COLORS.map(c => <button key={c} onClick={() => updateSelected({ color: c })} className="w-6 h-6 rounded-full border border-gray-200" style={{backgroundColor: c}}></button>)}
                                    </div>
                                </div>
                            )}

                            {selectedItemId?.startsWith('shape-') && (
                                <div className="space-y-4 pt-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Màu nền</label><input type="color" className="w-full h-9 border rounded-lg" value={(selectedObject as ShapeConfig).fillColor} onChange={e => updateSelected({ fillColor: e.target.value })} /></div>
                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Màu viền</label><input type="color" className="w-full h-9 border rounded-lg" value={(selectedObject as ShapeConfig).strokeColor} onChange={e => updateSelected({ strokeColor: e.target.value })} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Độ dày viền</label><input type="number" step="0.1" className="w-full p-2 border rounded-lg text-sm" value={(selectedObject as ShapeConfig).strokeWidth} onChange={e => updateSelected({ strokeWidth: Number(e.target.value) })} /></div>
                                        <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bo góc</label><input type="number" className="w-full p-2 border rounded-lg text-sm" value={(selectedObject as ShapeConfig).borderRadius} onChange={e => updateSelected({ borderRadius: Number(e.target.value) })} /></div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Kiểu viền (Stroke Style)</label>
                                        <select 
                                            className="w-full p-2 border rounded-lg text-xs font-bold bg-white" 
                                            value={(selectedObject as ShapeConfig).strokeType || 'solid'} 
                                            onChange={e => updateSelected({ strokeType: e.target.value })}
                                        >
                                            <option value="solid">———— Liền mạch (Solid)</option>
                                            <option value="dashed">---- Nét đứt (Dashed)</option>
                                            <option value="dotted">.... Chấm bi (Dotted)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-100 space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase">Thứ tự lớp</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => moveLayer(selectedItemId!, 'front')} className="p-2 bg-gray-50 border rounded text-[10px] font-bold hover:bg-gray-100 flex items-center justify-center gap-2">🔝 Trên cùng</button>
                                    <button onClick={() => moveLayer(selectedItemId!, 'back')} className="p-2 bg-gray-50 border rounded text-[10px] font-bold hover:bg-gray-100 flex items-center justify-center gap-2">🔙 Dưới cùng</button>
                                    <button onClick={() => moveLayer(selectedItemId!, 'up')} className="p-2 bg-gray-50 border rounded text-[10px] font-bold hover:bg-gray-100 flex items-center justify-center gap-2">⤒ Lên 1 lớp</button>
                                    <button onClick={() => moveLayer(selectedItemId!, 'down')} className="p-2 bg-gray-50 border rounded text-[10px] font-bold hover:bg-gray-100 flex items-center justify-center gap-2">⤓ Xuống 1 lớp</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTool === 'templates' && (
                                <div className="space-y-4">
                                    <button onClick={handleNewDesign} className="w-full border-2 border-dashed border-gray-300 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all">+ Thiết kế mới</button>
                                    <div className="space-y-2">
                                        {existingBackgrounds.map(bg => (
                                            <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className={`flex items-center gap-3 p-2 rounded cursor-pointer border hover:shadow-sm transition-all ${editingBgId === bg.id ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
                                                <div className="w-10 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0"><img src={bg.previewUrl || bg.url} className="w-full h-full object-cover" alt={bg.name} /></div>
                                                <div className="flex-grow min-w-0"><p className="text-xs font-bold text-gray-800 truncate">{bg.name}</p><p className="text-[10px] text-gray-400">{bg.category} • {bg.type}</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeTool === 'text' && <button onClick={addText} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold shadow-md hover:bg-black transition-all">+ Thêm văn bản</button>}
                            {activeTool === 'background' && (
                                <div className="space-y-4">
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 flex flex-col items-center gap-2"><span className="text-2xl">📸</span><span className="text-[10px] font-bold uppercase">Tải ảnh nền mới</span></button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadAsset} />
                                    <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                                        {QUICK_COLORS.map(c => <button key={c} onClick={() => handleBackgroundChange('color', c)} className="h-10 rounded-lg border shadow-sm" style={{backgroundColor: c}}></button>)}
                                    </div>
                                </div>
                            )}
                            {activeTool === 'shape' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => addShape('rect')} className="aspect-square bg-gray-100 border border-gray-200 rounded flex flex-col items-center justify-center gap-2 hover:bg-gray-200"><span>⬜</span><span className="text-[10px] font-bold uppercase">Hình vuông</span></button>
                                    <button onClick={() => addShape('circle')} className="aspect-square bg-gray-100 border border-gray-200 rounded flex flex-col items-center justify-center gap-2 hover:bg-gray-200"><span>⚪</span><span className="text-[10px] font-bold uppercase">Hình tròn</span></button>
                                </div>
                            )}
                            {activeTool === 'upload' && (
                                <div className="space-y-4">
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 flex flex-col items-center gap-2"><span className="text-2xl">🖼️</span><span className="text-[10px] font-bold uppercase">Tải Sticker PNG</span></button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png" onChange={handleUploadAsset} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* CANVAS MAIN */}
            <div className="flex-grow flex flex-col relative bg-[#f1f3f5] cursor-default" onMouseDown={() => setSelectedItemId(null)}>
                <div className="h-14 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-10" onMouseDown={e => e.stopPropagation()}>
                    <div className="flex items-center gap-4">
                        <select value={config.frameId} onChange={(e) => handleFrameChange(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg px-3 py-1.5 font-bold outline-none">{frames.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}</select>
                        <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="w-4 h-4 accent-gray-800" /><span className="text-xs font-bold text-gray-500">Lưới (Grid)</span></label>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex border rounded-lg bg-white p-1">
                            <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 hover:bg-gray-100 disabled:opacity-30 rounded" title="Hoàn tác (Ctrl+Z)">⤺</button>
                            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 hover:bg-gray-100 disabled:opacity-30 rounded" title="Làm lại (Ctrl+Y)">⤻</button>
                        </div>
                        <button onClick={handlePrepareSave} className="px-5 py-2 text-xs font-black text-white bg-blue-600 rounded-xl shadow-lg hover:bg-blue-700 transition-all">{editingBgId ? 'CẬP NHẬT MẪU' : 'LƯU MẪU MỚI'}</button>
                    </div>
                </div>

                <div className="flex-grow overflow-auto flex items-center justify-center p-12 relative">
                    {showGrid && <div className="absolute inset-0 pointer-events-none opacity-20" style={{backgroundImage: 'linear-gradient(to right, #ccc 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>}
                    <div style={{ transform: `scale(${zoom})` }} className="bg-white shadow-2xl transition-transform duration-300" onMouseDown={e => e.stopPropagation()}>
                        <FramePreview 
                            ref={previewRef} config={config} containerWidth={500} onItemTransform={(id, t) => {
                                const [type, idStr] = id.split('-');
                                const numId = parseInt(idStr);
                                setConfigWithHistory(prev => {
                                    const update = (item: any) => item.id === numId ? { ...item, ...t } : item;
                                    if (type === 'text') return { ...prev, texts: prev.texts.map(update) };
                                    if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(update) };
                                    if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(update) };
                                    return prev;
                                });
                            }} 
                            onItemRemove={handleItemRemove} onTextUpdate={(id, u) => updateSelected(u)} isInteractive={true} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} setIsEditingText={() => {}} allParts={{}} allowTextScaling={true} previewFont={previewFont} onAlign={handleAlign}
                        />
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur border rounded-full px-4 py-2 shadow-xl z-20" onMouseDown={e => e.stopPropagation()}>
                        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="text-gray-500 font-black">➖</button>
                        <span className="text-xs font-black w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="text-gray-500 font-black">➕</button>
                        <button onClick={() => setZoom(1)} className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded-full text-gray-500 hover:bg-gray-200 ml-2">RESET</button>
                    </div>
                </div>
            </div>

            {/* SHORTCUT HELP MODAL */}
            {showShortcuts && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black mb-6 border-b pb-2">⌨️ Phím tắt Studio</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span>Di chuyển:</span><span className="font-bold text-blue-600">Mũi tên (↑ ↓ ← →)</span></div>
                            <div className="flex justify-between"><span>Di chuyển nhanh (10px):</span><span className="font-bold text-blue-600">Shift + Mũi tên</span></div>
                            <div className="flex justify-between"><span>Sao chép:</span><span className="font-bold text-blue-600">Ctrl + C</span></div>
                            <div className="flex justify-between"><span>Dán:</span><span className="font-bold text-blue-600">Ctrl + V</span></div>
                            <div className="flex justify-between"><span>Xóa đối tượng:</span><span className="font-bold text-red-600">Del / Backspace</span></div>
                            <div className="flex justify-between"><span>Lớp lên / xuống:</span><span className="font-bold text-blue-600">Ctrl + [ / ]</span></div>
                            <div className="flex justify-between"><span>Hoàn tác:</span><span className="font-bold text-blue-600">Ctrl + Z</span></div>
                            <div className="flex justify-between"><span>Bỏ chọn:</span><span className="font-bold text-blue-600">Esc</span></div>
                        </div>
                        <button onClick={() => setShowShortcuts(false)} className="w-full mt-8 py-3 bg-gray-900 text-white font-bold rounded-xl">Đã hiểu!</button>
                    </div>
                </div>
            )}

            {/* SAVE MODAL */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in p-4" onClick={() => setShowSaveModal(false)}>
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-black mb-6 text-gray-900 uppercase tracking-tighter">{editingBgId ? 'Cập Nhật Mẫu' : 'Lưu Mẫu Mới'}</h3>
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4">
                                <h4 className="text-xs font-bold text-blue-700 uppercase mb-2">📸 Kiểm tra Thumbnail</h4>
                                <div className="aspect-square w-32 mx-auto border rounded-lg bg-white overflow-hidden shadow-sm">
                                    {generatedThumbnailUrl ? <img src={generatedThumbnailUrl} className="w-full h-full object-contain" alt="thumbnail" /> : <div className="w-full h-full animate-pulse bg-gray-100"></div>}
                                </div>
                            </div>
                            <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Tên mẫu thiết kế</label><input className="w-full p-3 border border-gray-200 rounded-2xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" value={bgName} onChange={e => setBgName(e.target.value)} placeholder="Ví dụ: Tốt nghiệp ABC..." /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Danh mục</label><select className="w-full p-3 border border-gray-200 rounded-2xl bg-gray-50" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>{dynamicCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Loại khung</label><select className="w-full p-3 border border-gray-200 rounded-2xl bg-gray-50 font-bold" value={bgType} onChange={e => setBgType(e.target.value as any)}><option value="square">Vuông</option><option value="rectangle">Chữ nhật</option></select></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10">
                            <button onClick={() => setShowSaveModal(false)} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">Hủy</button>
                            <button onClick={handleConfirmSave} disabled={isSaving} className="px-10 py-3 text-sm bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">{isSaving ? 'ĐANG LƯU...' : 'XÁC NHẬN LƯU'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
