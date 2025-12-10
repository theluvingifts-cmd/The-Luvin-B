
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig } from '../../types';
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
    { id: 'shape', icon: '🟥', label: 'Cấu trúc' }, // Changed Icon for Shape/Structure
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
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

const base64ToBlob = (base64: string) => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

export const AdminDesign: React.FC = () => {
    // State
    const [activeTool, setActiveTool] = useState('templates');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [existingBackgrounds, setExistingBackgrounds] = useState<PresetBackground[]>([]);
    const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
    
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
    
    // Clipboard State for Copy/Paste
    const [clipboard, setClipboard] = useState<{ type: 'text' | 'shape' | 'item'; data: any } | null>(null);

    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // ... (useEffect for font injection same as before)
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

    const handleItemRemove = (id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setSelectedItemId(null);
        setConfig(prev => {
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

                    setConfig(prev => {
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
                    x: Math.max(0, Math.min(100, item.x + (dx / 500 * 100))), // Approximation of pixel nudge to percentage
                    y: Math.max(0, Math.min(100, item.y + (dy / 500 * 100))) 
                });

                setConfig(prev => {
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

    // ... (Helpers, Handlers - No Changes)
    const handleFrameChange = (frameId: string) => {
        setConfig(prev => ({ ...prev, frameId }));
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
        setConfig(prev => ({ ...prev, background: { type, value } }));
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
        setConfig(prev => ({ ...prev, texts: [...prev.texts, newText] }));
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
        setConfig(prev => ({ ...prev, shapes: [...(prev.shapes || []), newShape] }));
        setSelectedItemId(`shape-${newShape.id}`);
        setActiveTool('shape');
    };

    const handleShapeUpdate = (id: number, updates: Partial<ShapeConfig>) => {
        setConfig(prev => ({
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
                    setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
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
        setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
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
            
            setConfig({
                frameId: frameId,
                background: { type: isColor ? 'color' : 'image', value: bg.url },
                texts: bg.overlayConfig?.texts || [],
                draggableItems: bg.overlayConfig?.draggableItems || [],
                shapes: bg.overlayConfig?.shapes || [], // Load shapes
                characters: []
            });
            setActiveTool('layers');
        }
    };

    const handleResetDesign = () => {
        if (confirm("Tạo thiết kế mới? Mọi thay đổi chưa lưu sẽ mất.")) {
            setConfig(INITIAL_FRAME_CONFIG);
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

        setConfig(prev => {
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

        setConfig(prev => {
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

        setConfig(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, lockedContent: !t.lockedContent } : t) };
            }
             if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, lockedContent: !i.lockedContent } : i) };
            }
            // Shapes don't have content lock
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
            const s = config.shapes?.find(s => s.id === numericId);
            return { position: s?.lockedPosition, content: false };
        }
        return { position: false, content: false };
    }, [selectedItemId, config]);

    const handleItemTransform = (id: string, newTransform: any) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);

        setConfig(prev => {
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

        setConfig(prev => {
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

    const handleTextUpdate = (id: number, updates: Partial<TextConfig>) => {
        setConfig(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }));
    };

    const getSelectedText = () => {
        if (!selectedItemId || !selectedItemId.startsWith('text-')) return null;
        const id = parseInt(selectedItemId.split('-')[1]);
        return config.texts.find(t => t.id === id);
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

    // --- SNAPSHOT GENERATION (STRICT) ---
    const handlePrepareSave = async () => {
        setIsSaving(true);
        const originalSelected = selectedItemId;
        setSelectedItemId(null); // Clear selection borders

        try {
            // 1. Wait for UI to update (remove selections) and Fonts to Load
            await new Promise(resolve => setTimeout(resolve, 800)); // Longer delay
            await document.fonts.ready;

            if (previewRef.current && typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(previewRef.current, { 
                    useCORS: true, 
                    allowTaint: true,
                    scale: 2, // Higher quality
                    backgroundColor: '#ffffff', // FORCE WHITE BACKGROUND
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
            } else {
                console.error("Preview ref missing or html2canvas not loaded");
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

    // --- SAVE FINAL (STRICT CHECK) ---
    const handleConfirmSave = async () => {
        if (!bgName) return alert("Vui lòng nhập tên Mẫu nền");
        setIsSaving(true);
        
        try {
            let previewUrl = existingPreviewUrl || '';
            
            // Upload the thumbnail if generated/selected
            if (generatedThumbnailBlob) {
                const fileToUpload = generatedThumbnailBlob instanceof File 
                    ? generatedThumbnailBlob 
                    : new File([generatedThumbnailBlob], "thumbnail.png", { type: "image/png" });
                
                const uploaded = await uploadToCloudinary(fileToUpload);
                if (uploaded) {
                    previewUrl = uploaded;
                } else {
                    // FATAL ERROR if upload fails to prevent broken previews
                    throw new Error("Lỗi upload ảnh thumbnail. Vui lòng kiểm tra mạng và thử lại.");
                }
            }

            // CRITICAL: Prevent saving if previewUrl is empty
            if (!previewUrl) {
                 throw new Error("Chưa có ảnh thumbnail. Vui lòng thử lại nút 'Lưu Mẫu' hoặc tải ảnh lên thủ công.");
            }

            const mainUrl = config.background.value;

            const newBackground: PresetBackground = {
                id: editingBgId || `bg_${Date.now()}`,
                name: bgName,
                url: mainUrl,
                previewUrl: previewUrl, 
                category: bgCategory,
                type: bgType,
                orientation: 'portrait', 
                overlayConfig: {
                    texts: config.texts,
                    draggableItems: config.draggableItems,
                    shapes: config.shapes || []
                }
            };

            let success = false;
            if (editingBgId) {
                success = await updateBackground(editingBgId, newBackground);
                if (success) {
                    setExistingBackgrounds(prev => prev.map(b => b.id === editingBgId ? newBackground : b));
                    alert("Đã cập nhật Mẫu nền thành công!");
                }
            } else {
                success = await addBackground(newBackground);
                if (success) {
                    setExistingBackgrounds(prev => [...prev, newBackground]);
                    alert("Đã tạo mới Mẫu nền thành công!");
                }
            }
            
            if (success) {
                setShowSaveModal(false);
                if (!editingBgId) setBgName('');
                setGeneratedThumbnailBlob(null);
                setGeneratedThumbnailUrl('');
                setExistingPreviewUrl('');
            } else {
                alert("Lỗi khi lưu dữ liệu vào database.");
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
                    {editingBgId && activeTool !== 'templates' && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">
                            Đang sửa: {bgName}
                        </span>
                    )}
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
                                            {/* Show Preview URL or fallback to main URL if it is an image */}
                                            <img 
                                                src={bg.previewUrl || (bg.url.startsWith('#') ? 'https://via.placeholder.com/50?text=Color' : bg.url)} 
                                                className="w-full h-full object-cover" 
                                                alt={bg.name}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50?text=Err';
                                                }}
                                            />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-bold text-gray-800 truncate">{bg.name}</p>
                                            <p className="text-xs text-gray-500">{bg.category} • {bg.type}</p>
                                        </div>
                                        {bg.overlayConfig && (
                                            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">Mẫu</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ... (Background Tool logic same as before) ... */}
                    {activeTool === 'background' && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Màu sắc</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['#ffffff', '#f4eee8', '#e2e8f0', '#fed7aa', '#fbcfe8', '#bbf7d0', '#bfdbfe', '#000000'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleBackgroundChange('color', color)}
                                            className="w-8 h-8 rounded-full border shadow-sm hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <div className="relative w-8 h-8 rounded-full border overflow-hidden">
                                        <input 
                                            type="color" 
                                            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                                            onChange={(e) => handleBackgroundChange('color', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tải nền mới (Tự động lưu)</label>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                                    <div className="text-2xl mb-1">☁️</div>
                                    <span className="text-sm font-medium text-gray-600">Upload ảnh nền</span>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} />
                            </div>
                            
                            {/* Saved Backgrounds Asset Library */}
                            {backgroundAssets.length > 0 && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Thư viện của bạn</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {backgroundAssets.map(asset => (
                                            <div key={asset.id} className="relative group aspect-square rounded overflow-hidden border border-gray-200 cursor-pointer" onClick={() => handleBackgroundChange('image', asset.url)}>
                                                <img src={asset.url} className="w-full h-full object-cover" />
                                                <button 
                                                    onClick={(e) => handleDeleteAsset(asset.id, e)}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Font chữ</label>
                                        <FontSelector 
                                            value={getSelectedText()?.font || 'Playfair Display'}
                                            onChange={(font) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { font })}
                                            onPreview={setPreviewFont}
                                            uploadedFonts={uploadedFonts}
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Cỡ chữ</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border rounded text-sm"
                                                value={getSelectedText()?.size || 12}
                                                onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { size: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Màu</label>
                                            <input 
                                                type="color" 
                                                className="w-10 h-10 border rounded cursor-pointer"
                                                value={getSelectedText()?.color || '#000000'}
                                                onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { color: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Styling Options */}
                                    <div className="space-y-2 pt-2 border-t border-gray-200">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { fontWeight: getSelectedText()!.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                                className={`p-2 rounded border flex-1 text-sm font-bold ${getSelectedText()?.fontWeight === 'bold' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white text-gray-600'}`}
                                            >
                                                B (Đậm)
                                            </button>
                                            <button 
                                                onClick={() => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { background: !getSelectedText()!.background })}
                                                className={`p-2 rounded border flex-1 text-sm ${getSelectedText()?.background ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white text-gray-600'}`}
                                            >
                                                Nền mờ
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="text-border" 
                                                checked={!!getSelectedText()?.border} 
                                                onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { border: e.target.checked })} 
                                                className="w-4 h-4"
                                            />
                                            <label htmlFor="text-border" className="text-sm font-medium text-gray-700">Khung viền (Border)</label>
                                        </div>

                                        {getSelectedText()?.border && (
                                            <div className="pl-6 space-y-2">
                                                <div className="flex gap-2">
                                                    <select 
                                                        className="flex-1 p-1.5 border rounded text-xs"
                                                        value={getSelectedText()?.borderStyle || 'solid'}
                                                        onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { borderStyle: e.target.value as any })}
                                                    >
                                                        <option value="solid">Nét liền (Solid)</option>
                                                        <option value="dashed">Nét đứt (Dashed)</option>
                                                        <option value="dotted">Chấm bi (Dotted)</option>
                                                    </select>
                                                    <input 
                                                        type="number"
                                                        className="w-12 p-1.5 border rounded text-xs"
                                                        value={getSelectedText()?.borderWidth || 2}
                                                        onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { borderWidth: Number(e.target.value) })}
                                                        title="Độ dày"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">Màu viền:</span>
                                                    <input 
                                                        type="color" 
                                                        className="w-6 h-6 border rounded p-0"
                                                        value={getSelectedText()?.borderColor || getSelectedText()?.color || '#000000'}
                                                        onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { borderColor: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Chọn một chữ để chỉnh sửa.</p>
                            )}
                        </div>
                    )}

                    {activeTool === 'shape' && (
                        <div className="space-y-4">
                            <button onClick={handleAddShape} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold shadow-md hover:bg-black transition-transform active:scale-95">
                                + Thêm hình chữ nhật / đường
                            </button>
                            
                            {getSelectedShape() ? (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Đang chỉnh sửa Shape</p>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Kiểu nét</label>
                                        <select 
                                            className="w-full p-2 border rounded text-sm bg-white"
                                            value={getSelectedShape()?.strokeType || 'solid'}
                                            onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { strokeType: e.target.value as any })}
                                        >
                                            <option value="solid">Nét liền (Solid)</option>
                                            <option value="dashed">Nét đứt (Dashed)</option>
                                            <option value="dotted">Chấm bi (Dotted)</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Độ dày nét</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border rounded text-sm"
                                                value={getSelectedShape()?.strokeWidth || 2}
                                                onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { strokeWidth: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Màu viền (Stroke)</label>
                                            <input
                                                type="color"
                                                className="w-full h-8 border rounded cursor-pointer"
                                                value={getSelectedShape()?.strokeColor || '#000000'}
                                                onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { strokeColor: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Màu nền (Fill)</label>
                                            <div className="flex gap-1">
                                                 <input
                                                    type="color"
                                                    className="w-full h-8 border rounded cursor-pointer disabled:opacity-50"
                                                    value={getSelectedShape()?.fillColor === 'transparent' ? '#ffffff' : (getSelectedShape()?.fillColor || '#ffffff')}
                                                    onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { fillColor: e.target.value })}
                                                    disabled={getSelectedShape()?.fillColor === 'transparent'}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const isTransparent = getSelectedShape()?.fillColor === 'transparent';
                                                        handleShapeUpdate(getSelectedShape()!.id, { fillColor: isTransparent ? '#ffffff' : 'transparent' });
                                                    }}
                                                    className={`px-2 rounded border text-xs font-bold ${getSelectedShape()?.fillColor === 'transparent' ? 'bg-gray-200 text-gray-600' : 'bg-white text-red-500'}`}
                                                    title={getSelectedShape()?.fillColor === 'transparent' ? "Bật màu nền" : "Tắt màu nền (Trong suốt)"}
                                                >
                                                    {getSelectedShape()?.fillColor === 'transparent' ? '🚫' : 'Màu'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Bo góc (Radius): {getSelectedShape()?.borderRadius}px</label>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            className="w-full"
                                            value={getSelectedShape()?.borderRadius || 0}
                                            onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { borderRadius: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Chọn một hình để chỉnh sửa.</p>
                            )}
                        </div>
                    )}

                    {activeTool === 'upload' && (
                        <div className="space-y-4">
                            <label className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer block">
                                <input type="file" className="hidden" accept="image/*" onChange={handleAddUploadItem} />
                                <div className="text-2xl mb-2">🖼️</div>
                                <span className="text-sm font-bold text-gray-700">Tải Sticker / Ảnh (Tự động lưu)</span>
                            </label>

                            {stickerAssets.length > 0 && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Sticker đã lưu</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {stickerAssets.map(asset => (
                                            <div key={asset.id} className="relative group aspect-square rounded border border-gray-200 cursor-pointer flex items-center justify-center p-1 bg-gray-50" onClick={() => handleAddSavedSticker(asset.url)}>
                                                <img src={asset.url} className="w-full h-full object-contain" />
                                                <button 
                                                    onClick={(e) => handleDeleteAsset(asset.id, e)}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTool === 'layers' && (
                        <div className="space-y-2">
                            {config.texts.map((t, idx) => (
                                <div key={t.id} className={`flex justify-between items-center p-2 border rounded cursor-pointer ${selectedItemId === `text-${t.id}` ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'}`} onClick={() => setSelectedItemId(`text-${t.id}`)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium truncate w-24">{t.content || 'Text'}</span>
                                        {t.lockedPosition && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">PosLock</span>}
                                        {t.lockedContent && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded">EditLock</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleLayerLockToggle(`text-${t.id}`, 'position'); }} className={`p-1 rounded ${t.lockedPosition ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-600'}`} title={t.lockedPosition ? "Mở khóa vị trí" : "Khóa vị trí"}>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleLayerLockToggle(`text-${t.id}`, 'content'); }} className={`p-1 rounded ${t.lockedContent ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`} title={t.lockedContent ? "Mở khóa sửa chữ" : "Khóa sửa chữ"}>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`text-${t.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                    </div>
                                </div>
                            ))}
                            {config.shapes?.map((s, idx) => (
                                <div key={s.id} className={`flex justify-between items-center p-2 border rounded cursor-pointer ${selectedItemId === `shape-${s.id}` ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'}`} onClick={() => setSelectedItemId(`shape-${s.id}`)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium truncate w-24">Shape {idx+1}</span>
                                        {s.lockedPosition && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">PosLock</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleLayerLockToggle(`shape-${s.id}`, 'position'); }} className={`p-1 rounded ${s.lockedPosition ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-600'}`} title={s.lockedPosition ? "Mở khóa vị trí" : "Khóa vị trí"}>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`shape-${s.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                    </div>
                                </div>
                            ))}
                            {config.draggableItems.map((item, idx) => (
                                <div key={item.id} className={`flex justify-between items-center p-2 border rounded cursor-pointer ${selectedItemId === `item-${item.id}` ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'}`} onClick={() => setSelectedItemId(`item-${item.id}`)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-blue-600 truncate w-24">{item.type === 'charm' ? 'Hình ảnh/Sticker' : item.type}</span>
                                        {item.lockedPosition && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">PosLock</span>}
                                        {item.lockedContent && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded">EditLock</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleLayerLockToggle(`item-${item.id}`, 'position'); }} className={`p-1 rounded ${item.lockedPosition ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-600'}`} title={item.lockedPosition ? "Mở khóa vị trí" : "Khóa vị trí"}>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleLayerLockToggle(`item-${item.id}`, 'content'); }} className={`p-1 rounded ${item.lockedContent ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`} title={item.lockedContent ? "Mở khóa nội dung" : "Khóa nội dung"}>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`item-${item.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                    </div>
                                </div>
                            ))}
                            {config.texts.length === 0 && config.draggableItems.length === 0 && (!config.shapes || config.shapes.length === 0) && (
                                <p className="text-sm text-gray-400 text-center italic">Chưa có lớp nào.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Main Canvas Area */}
            <div className="flex-grow flex flex-col bg-gray-100 relative">
                {/* Top Toolbar */}
                <div className="h-14 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <select 
                            value={config.frameId} 
                            onChange={(e) => handleFrameChange(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 font-bold"
                        >
                            {frames.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.frameWidthCm}x{f.frameHeightCm})</option>
                            ))}
                        </select>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-gray-100 rounded text-gray-600 text-lg font-bold">-</button>
                            <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-gray-100 rounded text-gray-600 text-lg font-bold">+</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleDownloadImage}
                            className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Tải ảnh PNG
                        </button>
                        <button 
                            onClick={handlePrepareSave} // Changed to Prepare Save
                            className={`px-4 py-2 text-xs font-bold text-white rounded shadow-sm flex items-center gap-2 transition-colors ${editingBgId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            {editingBgId ? 'Cập Nhật Mẫu' : 'Lưu Mẫu Mới'}
                        </button>
                    </div>
                </div>

                {/* Floating Alignment Bar (When Item Selected) */}
                {selectedItemId && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-white shadow-md border border-gray-200 rounded-lg p-1.5 flex gap-1 animate-fade-in-up items-center">
                        <button onClick={togglePositionLock} className={`p-1.5 rounded transition-colors ${currentLocks.position ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100 text-gray-500'}`} title={currentLocks.position ? "Mở khóa vị trí" : "Khóa vị trí (Cố định template)"}>
                            <svg className="w-4 h-4" fill={currentLocks.position ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentLocks.position ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"} /></svg>
                        </button>
                        <button onClick={toggleContentLock} className={`p-1.5 rounded transition-colors ${currentLocks.content ? 'bg-orange-50 text-orange-600' : 'hover:bg-gray-100 text-gray-500'}`} title={currentLocks.content ? "Mở khóa sửa chữ" : "Khóa sửa chữ (Khách không sửa được)"}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {currentLocks.content ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                )}
                            </svg>
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                        
                        <button onClick={() => alignItem('left')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn trái"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg></button>
                        <button onClick={() => alignItem('centerH')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn giữa ngang"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="4" x2="12" y2="20"></line><rect x="6" y="8" width="12" height="8"></rect></svg></button>
                        <button onClick={() => alignItem('right')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn phải"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
                        <div className="w-px bg-gray-200 mx-1"></div>
                        <button onClick={() => alignItem('top')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn trên"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 5 5 12"></polyline></svg></button>
                        <button onClick={() => alignItem('centerV')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn giữa dọc"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"></line><rect x="8" y="6" width="8" height="12"></rect></svg></button>
                        <button onClick={() => alignItem('bottom')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Căn dưới"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 19 19 12"></polyline></svg></button>
                    </div>
                )}

                {/* Canvas Workspace */}
                <div className="flex-grow overflow-auto flex items-center justify-center p-8 bg-[url('https://res.cloudinary.com/dbdqd93km/image/upload/v1/transparent-bg.png')] bg-repeat">
                    <div 
                        style={{ 
                            transform: `scale(${zoom})`, 
                            transformOrigin: 'center center',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            transition: 'width 0.3s ease, height 0.3s ease'
                        }}
                        className="bg-white"
                    >
                        <FramePreview 
                            ref={previewRef}
                            config={config}
                            containerWidth={500}
                            onItemTransform={handleItemTransform}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={handleTextUpdate}
                            isInteractive={true}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={() => {}} 
                            allParts={{}} 
                            className="pointer-events-auto"
                            previewFont={previewFont}
                            allowTextScaling={true} // ENABLE SCALING FOR TEXT
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
                            {/* Thumbnail Preview Section */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Thumbnail Hiển Thị</label>
                                <div className="flex items-start gap-4">
                                    <div className="w-24 h-32 bg-white border rounded overflow-hidden flex-shrink-0 relative group flex items-center justify-center">
                                        {generatedThumbnailUrl ? (
                                            <img src={generatedThumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : existingPreviewUrl ? (
                                            <img src={existingPreviewUrl} alt="Existing Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-gray-300 text-xs text-center p-2">No Image</div>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-xs text-gray-600 mb-2">Đây là ảnh sẽ hiển thị trên danh sách mẫu của khách hàng.</p>
                                        <button 
                                            onClick={() => thumbnailInputRef.current?.click()}
                                            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50"
                                        >
                                            Tải ảnh khác
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={thumbnailInputRef} 
                                            className="hidden" 
                                            accept="image/*" 
                                            onChange={handleManualThumbnailUpload} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tên Hiển Thị</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ví dụ: Sinh nhật hồng..."
                                    value={bgName}
                                    onChange={e => setBgName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Danh mục</label>
                                    <select 
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={bgCategory}
                                        onChange={e => setBgCategory(e.target.value)}
                                    >
                                        {BG_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Loại Khung</label>
                                    <select 
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={bgType}
                                        onChange={e => setBgType(e.target.value as 'square' | 'rectangle')}
                                    >
                                        <option value="square">Vuông (15x15, 23x23)</option>
                                        <option value="rectangle">Chữ nhật (A5)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                            
                            {/* If editing, show "Save as New" option too */}
                            {editingBgId && (
                                <button 
                                    onClick={() => { setEditingBgId(null); handleConfirmSave(); }} 
                                    disabled={isSaving} 
                                    className="px-4 py-2 text-sm bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300"
                                >
                                    Lưu thành mới
                                </button>
                            )}

                            <button onClick={handleConfirmSave} disabled={isSaving} className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">
                                {isSaving ? 'Đang lưu...' : (editingBgId ? 'Cập nhật' : 'Lưu Mẫu')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Loading Overlay */}
            {isSaving && (
                <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg flex items-center gap-3 shadow-lg">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                        <span className="font-bold text-sm">Đang xử lý...</span>
                    </div>
                </div>
            )}
        </div>
    );
};
