
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, FormField } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';

declare var html2canvas: any;

const TOOLS = [
    { id: 'templates', icon: '📂', label: 'Mẫu' }, 
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'shape', icon: '🟥', label: 'Cấu trúc' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'form', icon: '📝', label: 'Form' }, // NEW: Form Field management
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

const BG_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Khác'];

// Reusable FontSelector (same as in BuilderPage)
const FontSelector: React.FC<{ 
    value: string; 
    onChange: (font: string) => void;
    onPreview: (font: string | null) => void;
    uploadedFonts: CustomFont[];
}> = ({ value, onChange, onPreview, uploadedFonts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const groups = [
        { label: 'Phông chữ cơ bản', fonts: DEFAULT_FONTS },
        { label: 'Phông chữ tải lên', fonts: uploadedFonts.map(f => f.name) }
    ];

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
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {groups.map((group) => (
                        group.fonts.length > 0 && (
                            <div key={group.label}>
                                <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{group.label}</div>
                                {group.fonts.map(font => (
                                    <div 
                                        key={font}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-pink-50 transition-colors ${value === font ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`}
                                        onMouseEnter={() => onPreview(font)}
                                        onClick={() => { onChange(font); setIsOpen(false); }}
                                    >
                                        <span style={{ fontFamily: font }}>{font}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    ))}
                </div>
            )}
        </div>
    );
};

export const AdminDesign: React.FC = () => {
    // State
    const [activeTool, setActiveTool] = useState('templates');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [existingBackgrounds, setExistingBackgrounds] = useState<PresetBackground[]>([]);
    const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
    
    // History State
    const [history, setHistory] = useState<FrameConfig[]>([INITIAL_FRAME_CONFIG]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Edit/Save State
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [existingPreviewUrl, setExistingPreviewUrl] = useState<string>(''); // To preserve previewUrl on edit
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    // Thumbnail Preview State
    const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Font Manager State
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const [quickFontName, setQuickFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);
    
    // Clipboard State for Copy/Paste
    const [clipboard, setClipboard] = useState<{ type: 'text' | 'shape' | 'item'; data: any } | null>(null);

    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // HISTORY HELPER
    const setConfigWithHistory = useCallback((newConfigOrFn: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => {
        setConfig(prev => {
            const newConfig = typeof newConfigOrFn === 'function' ? newConfigOrFn(prev) : newConfigOrFn;
            
            // Only push to history if different
            if (JSON.stringify(newConfig) !== JSON.stringify(prev)) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(newConfig);
                // Limit history size to 30 steps
                if (newHistory.length > 30) newHistory.shift();
                
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
            return newConfig;
        });
    }, [history, historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setConfig(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setConfig(history[newIndex]);
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, assetsData] = await Promise.all([
                getAllFrames(),
                getStoreConfig(),
                getAllBackgrounds(),
                getAllAssets()
            ]);
            
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
            if (bgData) setExistingBackgrounds(bgData);
            if (assetsData) setSavedAssets(assetsData);
        };
        fetchInitialData();
    }, []);

    // Effect: Load Fonts
    useEffect(() => {
        const styleId = 'admin-dynamic-fonts';
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
            style = document.createElement('style');
            style.id = 'admin-dynamic-fonts';
            document.head.appendChild(style);
        }
        
        let css = '';
        uploadedFonts.forEach(font => {
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
    }, [uploadedFonts]);

    const handleQuickFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!quickFontName.trim()) {
            alert("Vui lòng nhập tên font trước.");
            e.target.value = ''; 
            return;
        }

        if (e.target.files && e.target.files[0]) {
            setIsUploadingFont(true);
            try {
                const file = e.target.files[0];
                const url = await uploadToCloudinary(file);
                
                if (url) {
                    const newFont: CustomFont = {
                        id: `font_${Date.now()}`,
                        name: quickFontName.trim(),
                        url: url
                    };
                    
                    // Update Cloud
                    const currentConfig = await getStoreConfig();
                    const updatedFonts = [...(currentConfig?.uploadedFonts || []), newFont];
                    await updateStoreConfig({ uploadedFonts: updatedFonts });
                    
                    // Update Local
                    setUploadedFonts(updatedFonts);
                    setQuickFontName('');
                    alert(`Font "${newFont.name}" đã sẵn sàng sử dụng!`);
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi upload font.");
            } finally {
                setIsUploadingFont(false);
            }
        }
    };

    const handleItemRemove = (id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setSelectedItemId(null);
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== numericId) };
            return prev;
        });
    };

    // Keyboard Shortcuts Effect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const isCtrl = e.ctrlKey || e.metaKey;

            // UNDO / REDO
            if (isCtrl && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
                return;
            }
            if (isCtrl && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                handleRedo();
                return;
            }

            // DELETE
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedItemId) {
                    e.preventDefault();
                    handleItemRemove(selectedItemId);
                }
                return;
            }

            // ENTER (Deselect / Confirm)
            if (e.key === 'Enter') {
                e.preventDefault();
                setSelectedItemId(null);
                return;
            }

            // COPY (Ctrl+C)
            if (isCtrl && e.key === 'c') {
                if (selectedItemId) {
                    e.preventDefault();
                    const [type, idStr] = selectedItemId.split('-');
                    const id = parseInt(idStr);
                    let data = null;
                    let itemType: 'text' | 'shape' | 'item' | null = null;

                    if (type === 'text') {
                        data = config.texts.find(t => t.id === id);
                        itemType = 'text';
                    } else if (type === 'shape') {
                        data = config.shapes?.find(s => s.id === id);
                        itemType = 'shape';
                    } else if (type === 'item') {
                        data = config.draggableItems.find(i => i.id === id);
                        itemType = 'item';
                    }

                    if (data && itemType) {
                        setClipboard({ type: itemType, data: JSON.parse(JSON.stringify(data)) });
                    }
                }
                return;
            }

            // PASTE (Ctrl+V)
            if (isCtrl && e.key === 'v') {
                if (clipboard) {
                    e.preventDefault();
                    const newId = Date.now();
                    const newItem = { 
                        ...clipboard.data, 
                        id: newId, 
                        x: Math.min(95, (clipboard.data.x || 50) + 2), 
                        y: Math.min(95, (clipboard.data.y || 50) + 2) 
                    };

                    setConfigWithHistory(prev => {
                        const next = { ...prev };
                        if (clipboard.type === 'text') {
                            next.texts = [...prev.texts, newItem];
                        } else if (clipboard.type === 'shape') {
                            next.shapes = [...(prev.shapes || []), newItem];
                        } else if (clipboard.type === 'item') {
                            next.draggableItems = [...prev.draggableItems, newItem];
                        }
                        return next;
                    });
                    setSelectedItemId(`${clipboard.type}-${newId}`);
                }
                return;
            }

            // ARROW KEYS (Nudge)
            if (selectedItemId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 5 : 0.5;
                let dx = 0; let dy = 0;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;

                const [type, idStr] = selectedItemId.split('-');
                const id = parseInt(idStr);
                
                const updatePos = (item: any) => ({ 
                    ...item, 
                    x: Math.max(0, Math.min(100, item.x + (dx / 500 * 100))), 
                    y: Math.max(0, Math.min(100, item.y + (dy / 500 * 100))) 
                });

                setConfigWithHistory(prev => {
                    if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? updatePos(t) : t) };
                    if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? updatePos(s) : s) };
                    if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? updatePos(i) : i) };
                    return prev;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [config, selectedItemId, clipboard]);

    const handleFrameChange = (frameId: string) => {
        setConfigWithHistory(prev => ({ ...prev, frameId }));
        // Auto set Type suggestion based on frame
        const frame = frames.find(f => f.id === frameId);
        if (frame) {
            if (Math.abs(frame.frameWidthCm - frame.frameHeightCm) > 1) {
                setBgType('rectangle');
            } else {
                setBgType('square');
            }
        }
    };

    const handleBackgroundChange = (type: 'color' | 'image', value: string) => {
        setConfigWithHistory(prev => ({ ...prev, background: { type, value } }));
    };

    const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    handleBackgroundChange('image', url);
                    // Save to Assets
                    const newAsset = await addAsset(url, 'background');
                    if (newAsset) setSavedAssets(prev => [newAsset, ...prev]);
                }
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleDeleteAsset = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Xóa ảnh này khỏi thư viện?")) {
            const success = await deleteAsset(id);
            if (success) setSavedAssets(prev => prev.filter(a => a.id !== id));
        }
    }

    const handleAddText = () => {
        const newText: TextConfig = {
            id: Date.now(),
            content: 'Nhập nội dung',
            font: 'Playfair Display',
            size: 24,
            color: '#333333',
            x: 50, y: 50, rotation: 0, scale: 1,
            background: false,
            width: 40,
            lockedPosition: false,
            lockedContent: false
        };
        setConfigWithHistory(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newText.id}`);
        setActiveTool('text');
    };

    const handleAddShape = () => {
        const newShape: ShapeConfig = {
            id: Date.now(),
            type: 'rect',
            x: 50, y: 50, rotation: 0, 
            width: 20, height: 15,
            strokeColor: '#333333',
            fillColor: 'transparent',
            strokeWidth: 2,
            strokeType: 'dashed',
            borderRadius: 0,
            lockedPosition: false
        };
        setConfigWithHistory(prev => ({ ...prev, shapes: [...(prev.shapes || []), newShape] }));
        setSelectedItemId(`shape-${newShape.id}`);
        setActiveTool('shape');
    };

    const handleShapeUpdate = (id: number, updates: Partial<ShapeConfig>) => {
        setConfigWithHistory(prev => ({
            ...prev,
            shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s)
        }));
    };

    const getSelectedShape = () => {
        if (!selectedItemId || !selectedItemId.startsWith('shape-')) return null;
        const id = parseInt(selectedItemId.split('-')[1]);
        return config.shapes?.find(s => s.id === id);
    };

    const handleAddUploadItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    const newItem: DraggableItem = {
                        id: Date.now(),
                        partId: url, // Store URL in partId for charms/uploads
                        type: 'charm',
                        x: 50, y: 50, rotation: 0, scale: 1
                    };
                    setConfigWithHistory(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
                    // Save to Assets
                    const newAsset = await addAsset(url, 'sticker');
                    if (newAsset) setSavedAssets(prev => [newAsset, ...prev]);
                }
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleAddSavedSticker = (url: string) => {
        const newItem: DraggableItem = {
            id: Date.now(),
            partId: url,
            type: 'charm',
            x: 50, y: 50, rotation: 0, scale: 1
        };
        setConfigWithHistory(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
    }

    const handleLoadTemplate = (bg: PresetBackground) => {
        if (confirm("Tải mẫu này sẽ thay thế thiết kế hiện tại. Tiếp tục?")) {
            setEditingBgId(bg.id);
            setBgName(bg.name);
            setBgCategory(bg.category);
            setBgType(bg.type);
            setExistingPreviewUrl(bg.previewUrl || ''); // Store existing preview
            
            // Reconstruct Config
            const isColor = bg.url.startsWith('#');
            // Try to match frame type (square/rect)
            let frameId = 'lg'; // Default square
            if (bg.type === 'rectangle') frameId = 'md';
            
            setConfigWithHistory({
                frameId: frameId,
                background: { type: isColor ? 'color' : 'image', value: bg.url },
                texts: bg.overlayConfig?.texts || [],
                draggableItems: bg.overlayConfig?.draggableItems || [],
                shapes: bg.overlayConfig?.shapes || [], // Load shapes
                formFields: bg.formFields || [], // Load existing form fields
                characters: []
            });
            setActiveTool('layers');
        }
    };

    const handleResetDesign = () => {
        if (confirm("Tạo thiết kế mới? Mọi thay đổi chưa lưu sẽ mất.")) {
            setConfigWithHistory(INITIAL_FRAME_CONFIG);
            setEditingBgId(null);
            setBgName('');
            setExistingPreviewUrl('');
            setSelectedItemId(null);
        }
    }

    const alignItem = (direction: 'centerH' | 'centerV' | 'top' | 'bottom' | 'left' | 'right') => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);

        const updateFn = (item: any) => {
            let updates = {};
            switch (direction) {
                case 'centerH': updates = { x: 50 }; break;
                case 'centerV': updates = { y: 50 }; break;
                case 'top': updates = { y: 10 }; break;
                case 'bottom': updates = { y: 90 }; break;
                case 'left': updates = { x: 10 }; break;
                case 'right': updates = { x: 90 }; break;
            }
            return { ...item, ...updates };
        };

        setConfigWithHistory(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? updateFn(t) : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? updateFn(i) : i) };
            }
            if (type === 'shape') {
                return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? updateFn(s) : s) };
            }
            return prev;
        });
    };

    const togglePositionLock = () => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);

        setConfigWithHistory(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, lockedPosition: !t.lockedPosition } : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, lockedPosition: !i.lockedPosition } : i) };
            }
            if (type === 'shape') {
                return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? { ...s, lockedPosition: !s.lockedPosition } : s) };
            }
            return prev;
        });
    };

    const toggleContentLock = () => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);

        setConfigWithHistory(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, lockedContent: !t.lockedContent } : t) };
            }
             if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, lockedContent: !i.lockedContent } : i) };
            }
            return prev;
        });
    };

    const currentLocks = useMemo(() => {
        if (!selectedItemId) return { position: false, content: false };
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);
        if (type === 'text') {
            const t = config.texts.find(t => t.id === numericId);
            return { position: t?.lockedPosition, content: t?.lockedContent };
        }
        if (type === 'item') {
            const i = config.draggableItems.find(i => i.id === numericId);
            return { position: i?.lockedPosition, content: i?.lockedContent };
        }
        if (type === 'shape') {
            // Fix: Changed "id" to "numericId" to fix scoping error
            const s = config.shapes?.find(s => s.id === numericId);
            return { position: s?.lockedPosition, content: false };
        }
        return { position: false, content: false };
    }, [selectedItemId, config]);

    const handleItemTransform = (id: string, newTransform: any) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);

        setConfigWithHistory(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, ...newTransform } : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...newTransform } : i) };
            }
            if (type === 'shape') {
                return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? { ...s, ...newTransform } : s) };
            }
            return prev;
        });
    };

    const handleLayerLockToggle = (id: string, lockType: 'position' | 'content') => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);

        setConfigWithHistory(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { 
                    ...t, 
                    lockedPosition: lockType === 'position' ? !t.lockedPosition : t.lockedPosition,
                    lockedContent: lockType === 'content' ? !t.lockedContent : t.lockedContent
                } : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { 
                    ...i, 
                    lockedPosition: lockType === 'position' ? !i.lockedPosition : i.lockedPosition,
                    lockedContent: lockType === 'content' ? !i.lockedContent : i.lockedContent
                } : i) };
            }
            if (type === 'shape') {
                return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? { 
                    ...s, 
                    lockedPosition: lockType === 'position' ? !s.lockedPosition : s.lockedPosition,
                } : s) };
            }
            return prev;
        });
    }

    const changeLayerOrder = (direction: 'front' | 'back') => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);

        setConfigWithHistory(prev => {
            const next = { ...prev };
            
            if (type === 'text') {
                const idx = prev.texts.findIndex(t => t.id === numericId);
                if (idx === -1) return prev;
                const item = prev.texts[idx];
                const newArr = [...prev.texts];
                newArr.splice(idx, 1);
                if (direction === 'front') newArr.push(item);
                else newArr.unshift(item);
                next.texts = newArr;
            } else if (type === 'item') {
                const idx = prev.draggableItems.findIndex(i => i.id === numericId);
                if (idx === -1) return prev;
                const item = prev.draggableItems[idx];
                const newArr = [...prev.draggableItems];
                newArr.splice(idx, 1);
                if (direction === 'front') newArr.push(item);
                else newArr.unshift(item);
                next.draggableItems = newArr;
            } else if (type === 'shape') {
                const idx = (prev.shapes || []).findIndex(s => s.id === numericId);
                if (idx === -1) return prev;
                const item = (prev.shapes || [])[idx];
                const newArr = [...(prev.shapes || [])];
                newArr.splice(idx, 1);
                if (direction === 'front') newArr.push(item);
                else newArr.unshift(item);
                next.shapes = newArr;
            }
            return next;
        });
    }

    const handleTextUpdate = (id: number, updates: Partial<TextConfig>) => {
        setConfigWithHistory(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }));
    };

    const handleItemUpdate = (id: number | string, updates: Partial<DraggableItem>) => {
        let numericId: number;
        if (typeof id === 'string') {
            const parts = id.split('-');
            numericId = parts.length > 1 ? parseInt(parts[1]) : parseInt(id);
        } else {
            numericId = id;
        }
        setConfigWithHistory(prev => ({ ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...updates } : i) }));
    };

    const getSelectedText = () => {
        if (!selectedItemId || !selectedItemId.startsWith('text-')) return null;
        const id = parseInt(selectedItemId.split('-')[1]);
        return config.texts.find(t => t.id === id);
    };

    const getSelectedItem = () => {
        if (!selectedItemId || !selectedItemId.startsWith('item-')) return null;
        const id = parseInt(selectedItemId.split('-')[1]);
        return config.draggableItems.find(i => i.id === id);
    };

    const handleDownloadImage = async () => {
        const originalSelected = selectedItemId;
        setSelectedItemId(null);
        setIsSaving(true);
        setTimeout(async () => {
            if (previewRef.current && typeof html2canvas !== 'undefined') {
                try {
                    const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 2, backgroundColor: null });
                    const link = document.createElement('a');
                    link.download = `background_preview_${Date.now()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                } catch (e) {
                    console.error(e);
                    alert("Lỗi xuất ảnh");
                }
            }
            setIsSaving(false);
            setSelectedItemId(originalSelected);
        }, 100);
    };

    // --- FORM FIELD MANAGEMENT ---
    const handleAddField = () => {
        const newField: FormField = {
            id: `f_${Date.now()}`,
            label: 'Nhãn trường mới',
            type: 'text',
            required: false,
            placeholder: ''
        };
        setConfigWithHistory(prev => ({
            ...prev,
            formFields: [...(prev.formFields || []), newField]
        }));
    };

    const handleUpdateField = (id: string, updates: Partial<FormField>) => {
        setConfigWithHistory(prev => ({
            ...prev,
            formFields: (prev.formFields || []).map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    };

    const handleRemoveField = (id: string) => {
        setConfigWithHistory(prev => ({
            ...prev,
            formFields: (prev.formFields || []).filter(f => f.id !== id)
        }));
    };

    // --- SNAPSHOT GENERATION ---
    const handlePrepareSave = async () => {
        setIsSaving(true);
        const originalSelected = selectedItemId;
        setSelectedItemId(null); 

        try {
            await new Promise(resolve => setTimeout(resolve, 800)); 
            await document.fonts.ready;

            if (previewRef.current && typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(previewRef.current, { 
                    useCORS: true, 
                    allowTaint: true,
                    scale: 2, 
                    backgroundColor: '#ffffff', 
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                });
                
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    setGeneratedThumbnailBlob(blob);
                    setGeneratedThumbnailUrl(URL.createObjectURL(blob));
                } else {
                    console.error("Blob generation failed");
                    alert("Lỗi tạo ảnh thumbnail. Vui lòng thử lại.");
                }
            }
            setShowSaveModal(true);
        } catch (e) {
            console.error("Error generating thumbnail:", e);
            alert("Lỗi tạo ảnh thumbnail. Vui lòng thử lại hoặc tải ảnh thủ công.");
            setShowSaveModal(true); 
        } finally {
            setIsSaving(false);
            setSelectedItemId(originalSelected);
        }
    };

    const handleManualThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setGeneratedThumbnailBlob(file);
            setGeneratedThumbnailUrl(URL.createObjectURL(file));
        }
    };

    const handleConfirmSave = async () => {
        if (!bgName) return alert("Vui lòng nhập tên Mẫu nền");
        setIsSaving(true);
        
        try {
            let previewUrl = existingPreviewUrl || '';
            if (generatedThumbnailBlob) {
                const fileToUpload = generatedThumbnailBlob instanceof File 
                    ? generatedThumbnailBlob 
                    : new File([generatedThumbnailBlob], "thumbnail.png", { type: "image/png" });
                
                const uploaded = await uploadToCloudinary(fileToUpload);
                if (uploaded) previewUrl = uploaded;
                else throw new Error("Lỗi upload ảnh thumbnail.");
            }

            if (!previewUrl) {
                 throw new Error("Chưa có ảnh thumbnail.");
            }

            const newBackground: PresetBackground = {
                id: editingBgId || `bg_${Date.now()}`,
                name: bgName,
                url: config.background.value,
                previewUrl: previewUrl, 
                category: bgCategory,
                type: bgType,
                orientation: 'portrait', 
                formFields: config.formFields || [], // SAVE FORM FIELDS
                overlayConfig: {
                    texts: config.texts,
                    draggableItems: config.draggableItems,
                    shapes: config.shapes || []
                }
            };

            let success = false;
            if (editingBgId) {
                success = await updateBackground(editingBgId, newBackground);
                if (success) setExistingBackgrounds(prev => prev.map(b => b.id === editingBgId ? newBackground : b));
            } else {
                success = await addBackground(newBackground);
                if (success) setExistingBackgrounds(prev => [...prev, newBackground]);
            }
            
            if (success) {
                setShowSaveModal(false);
                alert("Đã lưu Mẫu nền thành công!");
                if (!editingBgId) setBgName('');
                setGeneratedThumbnailBlob(null);
                setGeneratedThumbnailUrl('');
                setExistingPreviewUrl('');
            }
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Lỗi không xác định khi lưu.");
        } finally {
            setIsSaving(false);
        }
    };

    const backgroundAssets = savedAssets.filter(a => a.type === 'background');
    const stickerAssets = savedAssets.filter(a => a.type === 'sticker');

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in relative">
            {/* 1. Sidebar Tools */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20 overflow-y-auto no-scrollbar">
                {TOOLS.map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className={`w-14 h-14 flex-shrink-0 flex flex-col items-center justify-center rounded-lg transition-all ${
                            activeTool === tool.id ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                    >
                        <span className="text-xl mb-1">{tool.icon}</span>
                        <span className="text-[10px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* 2. Tool Panel (Dynamic) */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm transition-all">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">
                        {TOOLS.find(t => t.id === activeTool)?.label}
                    </h3>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    
                    {activeTool === 'templates' && (
                        <div className="space-y-4">
                            <button onClick={handleResetDesign} className="w-full border-2 border-dashed border-gray-300 py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-600 transition-all">
                                + Tạo thiết kế mới
                            </button>
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase">Mẫu có sẵn ({existingBackgrounds.length})</p>
                                {existingBackgrounds.map(bg => (
                                    <div 
                                        key={bg.id} 
                                        onClick={() => handleLoadTemplate(bg)}
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer border hover:shadow-sm transition-all ${editingBgId === bg.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0 border flex items-center justify-center">
                                            <img 
                                                src={bg.previewUrl || (bg.url.startsWith('#') ? 'https://via.placeholder.com/50?text=Color' : bg.url)} 
                                                className="w-full h-full object-cover" 
                                                alt={bg.name}
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50?text=Err'; }}
                                            />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-bold text-gray-800 truncate">{bg.name}</p>
                                            <p className="text-xs text-gray-500">{bg.category} • {bg.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTool === 'background' && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Màu sắc</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['#ffffff', '#f4eee8', '#e2e8f0', '#fed7aa', '#fbcfe8', '#bbf7d0', '#bfdbfe', '#000000'].map(color => (
                                        <button key={color} onClick={() => handleBackgroundChange('color', color)} className="w-8 h-8 rounded-full border shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: color }} />
                                    ))}
                                    <div className="relative w-8 h-8 rounded-full border overflow-hidden">
                                        <input type="color" className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" onChange={(e) => handleBackgroundChange('color', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tải nền mới</label>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                                    <div className="text-2xl mb-1">☁️</div>
                                    <span className="text-sm font-medium text-gray-600">Upload ảnh nền</span>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} />
                            </div>
                        </div>
                    )}

                    {activeTool === 'text' && (
                        <div className="space-y-4">
                            <button onClick={handleAddText} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold shadow-md hover:bg-black transition-transform active:scale-95">
                                + Thêm văn bản
                            </button>
                            {selectedItemId && selectedItemId.startsWith('text') ? (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Đang chỉnh sửa</p>
                                    <FontSelector 
                                        value={getSelectedText()?.font || 'Playfair Display'}
                                        onChange={(font) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { font })}
                                        onPreview={setPreviewFont}
                                        uploadedFonts={uploadedFonts}
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Cỡ</label>
                                            <input type="number" className="w-full p-2 border rounded text-sm" value={getSelectedText()?.size || 12} onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { size: parseInt(e.target.value) })} />
                                        </div>
                                        <input type="color" className="w-10 h-10 border rounded cursor-pointer" value={getSelectedText()?.color || '#000000'} onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { color: e.target.value })} />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Chọn một chữ để chỉnh sửa.</p>
                            )}
                        </div>
                    )}

                    {activeTool === 'form' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-gray-400 uppercase">Trường nhập liệu khách hàng</label>
                                <button onClick={handleAddField} className="text-blue-600 text-xs font-bold hover:underline">+ Thêm trường</button>
                            </div>
                            
                            <div className="space-y-3">
                                {(config.formFields || []).map((field, idx) => (
                                    <div key={field.id} className="p-3 bg-gray-50 border rounded-lg space-y-2 relative group/field">
                                        <button onClick={() => handleRemoveField(field.id)} className="absolute top-1 right-1 text-red-500 font-bold p-1 opacity-0 group-hover/field:opacity-100 transition-opacity">×</button>
                                        
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tên nhãn (Label)</label>
                                            <input 
                                                className="w-full p-1.5 border rounded text-xs"
                                                value={field.label}
                                                onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                                                placeholder="VD: Nhập tên hai bạn..."
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Loại</label>
                                                <select 
                                                    className="w-full p-1.5 border rounded text-[10px] font-bold"
                                                    value={field.type}
                                                    onChange={e => handleUpdateField(field.id, { type: e.target.value as any })}
                                                >
                                                    <option value="text">Chữ ngắn</option>
                                                    <option value="textarea">Chữ dài</option>
                                                    <option value="date">Ngày tháng</option>
                                                    <option value="image">Tải ảnh</option>
                                                </select>
                                            </div>
                                            <div className="flex items-end pb-1.5">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={field.required}
                                                        onChange={e => handleUpdateField(field.id, { required: e.target.checked })}
                                                        className="w-3 h-3 accent-blue-600"
                                                    />
                                                    <span className="text-[10px] font-bold text-gray-600">Bắt buộc</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {(config.formFields || []).length === 0 && (
                                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
                                        <p className="text-xs">Chưa có trường nhập liệu.</p>
                                        <p className="text-[10px] mt-1">Bấm "+ Thêm trường" để khách nhập thông tin (Ví dụ: 5 ảnh)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTool === 'layers' && (
                        <div className="space-y-2">
                            {config.texts.map((t) => (
                                <div key={t.id} className={`flex justify-between items-center p-2 border rounded cursor-pointer ${selectedItemId === `text-${t.id}` ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'}`} onClick={() => setSelectedItemId(`text-${t.id}`)}>
                                    <span className="text-xs font-medium truncate w-32">{t.content}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`text-${t.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                </div>
                            ))}
                            {config.draggableItems.map((item) => (
                                <div key={item.id} className={`flex justify-between items-center p-2 border rounded cursor-pointer ${selectedItemId === `item-${item.id}` ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'}`} onClick={() => setSelectedItemId(`item-${item.id}`)}>
                                    <span className="text-xs font-medium truncate w-32">{item.type}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`item-${item.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Main Canvas Area */}
            <div className="flex-grow flex flex-col bg-gray-100 relative">
                <div className="h-14 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <select value={config.frameId} onChange={(e) => handleFrameChange(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2 font-bold">
                            {frames.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                        </select>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleUndo()} disabled={historyIndex <= 0} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                            <button onClick={() => handleRedo()} disabled={historyIndex >= history.length - 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m-6-6l-6-6" /></svg></button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleDownloadImage} className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Tải ảnh</button>
                        <button onClick={handlePrepareSave} className={`px-4 py-2 text-xs font-bold text-white rounded shadow-sm flex items-center gap-2 transition-colors ${editingBgId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>{editingBgId ? 'Cập Nhật Mẫu' : 'Lưu Mẫu Mới'}</button>
                    </div>
                </div>

                {selectedItemId && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-white shadow-md border border-gray-200 rounded-lg p-1.5 flex gap-1 animate-fade-in-up items-center">
                        <button onClick={togglePositionLock} className={`p-1.5 rounded transition-colors ${currentLocks.position ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100 text-gray-500'}`} title="Khóa vị trí"><svg className="w-4 h-4" fill={currentLocks.position ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentLocks.position ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"} /></svg></button>
                        <button onClick={toggleContentLock} className={`p-1.5 rounded transition-colors ${currentLocks.content ? 'bg-orange-50 text-orange-600' : 'hover:bg-gray-100 text-gray-500'}`} title="Khóa nội dung"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{currentLocks.content ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />}</svg></button>
                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                        <button onClick={() => alignItem('centerH')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn giữa ngang"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="4" x2="12" y2="20"></line><rect x="6" y="8" width="12" height="8"></rect></svg></button>
                        <button onClick={() => alignItem('centerV')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn giữa dọc"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"></line><rect x="8" y="6" width="8" height="12"></rect></svg></button>
                    </div>
                )}

                <div className="flex-grow overflow-auto flex items-center justify-center p-8 bg-[url('https://res.cloudinary.com/dbdqd93km/image/upload/v1/transparent-bg.png')] bg-repeat">
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', transition: 'width 0.3s ease, height 0.3s ease' }} className="bg-white">
                        <FramePreview 
                            ref={previewRef}
                            config={config}
                            containerWidth={500}
                            onItemTransform={handleItemTransform}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={handleTextUpdate}
                            onItemUpdate={handleItemUpdate}
                            isInteractive={true}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={() => {}} 
                            allParts={{}} 
                            className="pointer-events-auto"
                            previewFont={previewFont}
                            allowTextScaling={true}
                            onAlign={(type) => { 
                                if (type === 'center') { alignItem('centerH'); alignItem('centerV'); }
                                else if (type === 'horizontal') alignItem('centerH');
                                else if (type === 'vertical') alignItem('centerV');
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center font-sans">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-2">{editingBgId ? 'Cập Nhật Mẫu Nền' : 'Lưu Mẫu Nền Mới'}</h3>
                        <div className="space-y-4 mt-4">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Thumbnail Hiển Thị</label>
                                <div className="flex items-start gap-4">
                                    <div className="w-24 h-32 bg-white border rounded overflow-hidden flex-shrink-0 relative group flex items-center justify-center">
                                        {generatedThumbnailUrl ? <img src={generatedThumbnailUrl} alt="Preview" className="w-full h-full object-cover" /> : existingPreviewUrl ? <img src={existingPreviewUrl} alt="Existing Preview" className="w-full h-full object-cover" /> : <div className="text-gray-300 text-xs text-center p-2">No Image</div>}
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-xs text-gray-600 mb-2">Ảnh hiển thị trên danh sách mẫu.</p>
                                        <button onClick={() => thumbnailInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50">Tải ảnh khác</button>
                                        <input type="file" ref={thumbnailInputRef} className="hidden" accept="image/*" onChange={handleManualThumbnailUpload} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tên Hiển Thị</label>
                                <input type="text" className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" value={bgName} onChange={e => setBgName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Danh mục</label>
                                    <select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>{BG_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Loại Khung</label>
                                    <select className="w-full p-2.5 border border-gray-300 rounded-lg outline-none" value={bgType} onChange={e => setBgType(e.target.value as any)}><option value="square">Vuông</option><option value="rectangle">Chữ nhật</option></select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                            <button onClick={handleConfirmSave} disabled={isSaving} className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">{isSaving ? 'Đang lưu...' : 'Lưu Mẫu'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
