
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground } from '../../services/backgroundService'; // Changed from addTemplate
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';

declare var html2canvas: any;

const TOOLS = [
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

const BG_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Khác'];

export const AdminDesign: React.FC = () => {
    // State
    const [activeTool, setActiveTool] = useState('background');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Save Modal State
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    // Font Manager State
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [isUploadingFont, setIsUploadingFont] = useState(false);
    
    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fontInputRef = useRef<HTMLInputElement>(null);

    // Initial Data Fetch
    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData] = await Promise.all([
                getAllFrames(),
                getStoreConfig()
            ]);
            
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
        };
        fetchInitialData();
    }, []);

    // Inject fonts into DOM
    useEffect(() => {
        const styleId = 'admin-dynamic-fonts';
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
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

    // Helpers
    const selectedFrame = useMemo(() => frames.find(f => f.id === config.frameId) || frames[0], [frames, config.frameId]);
    
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
                if (url) handleBackgroundChange('image', url);
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

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
            locked: false
        };
        setConfig(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newText.id}`);
        setActiveTool('text');
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
                }
            } catch (err) {
                alert('Lỗi upload ảnh');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleUploadFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const fontName = prompt("Nhập tên font (VD: MyCustomFont):", file.name.split('.')[0]);
            
            if (!fontName) return;

            setIsUploadingFont(true);
            try {
                const url = await uploadToCloudinary(file);
                if (url) {
                    const newFont: CustomFont = {
                        id: `font_${Date.now()}`,
                        name: fontName,
                        url: url
                    };
                    const updatedFonts = [...uploadedFonts, newFont];
                    
                    // Save to server
                    await updateStoreConfig({ uploadedFonts: updatedFonts });
                    setUploadedFonts(updatedFonts);
                    alert("Đã upload font thành công!");
                }
            } catch (err) {
                alert('Lỗi upload font');
            } finally {
                setIsUploadingFont(false);
            }
        }
    };

    // Alignment & Tooling
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
            return prev;
        });
    };

    const toggleLock = () => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);

        setConfig(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, locked: !t.locked } : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, locked: !i.locked } : i) };
            }
            return prev;
        });
    };

    // Get current locked status
    const isCurrentLocked = useMemo(() => {
        if (!selectedItemId) return false;
        const [type, idStr] = selectedItemId.split('-');
        const numericId = parseInt(idStr);
        if (type === 'text') return config.texts.find(t => t.id === numericId)?.locked;
        if (type === 'item') return config.draggableItems.find(i => i.id === numericId)?.locked;
        return false;
    }, [selectedItemId, config]);

    // FramePreview Handlers
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
            return prev;
        });
    };

    const handleItemRemove = (id: string) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        setSelectedItemId(null);
        setConfig(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            return prev;
        });
    };

    const handleTextUpdate = (id: number, updates: Partial<TextConfig>) => {
        setConfig(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }));
    };

    const getSelectedText = () => {
        if (!selectedItemId || !selectedItemId.startsWith('text-')) return null;
        const id = parseInt(selectedItemId.split('-')[1]);
        return config.texts.find(t => t.id === id);
    };

    // Export & Save
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

    const handleSaveBackgroundTemplate = async () => {
        if (!bgName) return alert("Vui lòng nhập tên Mẫu nền");
        setIsSaving(true);
        
        const originalSelected = selectedItemId;
        setSelectedItemId(null);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for deselect/render

            // The main URL of the background is either the color or the image URL
            const mainUrl = config.background.value;

            // Prepare the PresetBackground object
            const newBackground: PresetBackground = {
                id: `bg_${Date.now()}`,
                name: bgName,
                url: mainUrl,
                category: bgCategory,
                type: bgType,
                orientation: 'portrait', // Default, logic can be expanded
                overlayConfig: {
                    texts: config.texts,
                    draggableItems: config.draggableItems
                }
            };

            await addBackground(newBackground);
            
            alert("Đã lưu Mẫu nền (Bước 2) thành công! Khách hàng sẽ có thể chỉnh sửa chữ khi chọn mẫu này.");
            setShowSaveModal(false);
            setBgName('');
        } catch (e) {
            console.error(e);
            alert("Lỗi khi lưu mẫu nền");
        } finally {
            setIsSaving(false);
            setSelectedItemId(originalSelected);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in relative">
            {/* 1. Sidebar Tools */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition-all ${
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
                <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 text-lg">
                        {TOOLS.find(t => t.id === activeTool)?.label}
                    </h3>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    
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
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Hình nền (Gốc)</label>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                                    <div className="text-2xl mb-1">☁️</div>
                                    <span className="text-sm font-medium text-gray-600">Tải ảnh nền gốc</span>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} />
                            </div>
                        </div>
                    )}

                    {activeTool === 'text' && (
                        <div className="space-y-4">
                            <button onClick={handleAddText} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold shadow-md hover:bg-black transition-transform active:scale-95">
                                + Thêm văn bản (Khách sửa được)
                            </button>
                            
                            {selectedItemId && selectedItemId.startsWith('text') ? (
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Đang chỉnh sửa</p>
                                    
                                    {/* Font Selector */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Font chữ</label>
                                        <select 
                                            className="w-full p-2 border rounded text-sm bg-white"
                                            value={getSelectedText()?.font || 'Playfair Display'}
                                            onChange={(e) => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { font: e.target.value })}
                                        >
                                            <optgroup label="Cơ bản">
                                                {DEFAULT_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                            </optgroup>
                                            <optgroup label="Đã tải lên">
                                                {uploadedFonts.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>

                                    {/* Size & Color */}
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
                                    
                                    {/* Style Toggles */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => getSelectedText() && handleTextUpdate(getSelectedText()!.id, { background: !getSelectedText()!.background })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded border ${getSelectedText()?.background ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white text-gray-600'}`}
                                        >
                                            Nền mờ
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Chọn một chữ để chỉnh sửa.</p>
                            )}

                            <div className="border-t pt-4">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Upload Font (.ttf, .otf)</label>
                                <button onClick={() => fontInputRef.current?.click()} disabled={isUploadingFont} className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-600 hover:bg-gray-50">
                                    {isUploadingFont ? 'Đang tải...' : 'Tải font mới'}
                                </button>
                                <input type="file" ref={fontInputRef} className="hidden" accept=".ttf,.otf,.woff" onChange={handleUploadFont} />
                            </div>
                        </div>
                    )}

                    {activeTool === 'upload' && (
                        <div className="space-y-4">
                            <label className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer block">
                                <input type="file" className="hidden" accept="image/*" onChange={handleAddUploadItem} />
                                <div className="text-2xl mb-2">🖼️</div>
                                <span className="text-sm font-bold text-gray-700">Tải Sticker / Ảnh trang trí</span>
                                <p className="text-xs text-gray-400 mt-1">Sẽ là lớp phủ trên nền</p>
                            </label>
                        </div>
                    )}

                    {activeTool === 'layers' && (
                        <div className="space-y-2">
                            {config.texts.map((t, idx) => (
                                <div key={t.id} className="flex justify-between items-center p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedItemId(`text-${t.id}`)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium truncate w-32">{t.content || 'Text'}</span>
                                        {t.locked && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Locked</span>}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`text-${t.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                </div>
                            ))}
                            {config.draggableItems.map((item, idx) => (
                                <div key={item.id} className="flex justify-between items-center p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedItemId(`item-${item.id}`)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-blue-600">{item.type === 'charm' ? 'Hình ảnh/Sticker' : item.type}</span>
                                        {item.locked && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Locked</span>}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleItemRemove(`item-${item.id}`); }} className="text-red-500 hover:bg-red-100 p-1 rounded">×</button>
                                </div>
                            ))}
                            {config.texts.length === 0 && config.draggableItems.length === 0 && (
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
                            onClick={() => setShowSaveModal(true)}
                            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            Lưu Mẫu Nền (Step 2)
                        </button>
                    </div>
                </div>

                {/* Floating Alignment Bar (When Item Selected) */}
                {selectedItemId && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-white shadow-md border border-gray-200 rounded-lg p-1.5 flex gap-1 animate-fade-in-up items-center">
                        <button onClick={toggleLock} className={`p-1.5 rounded transition-colors ${isCurrentLocked ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100 text-gray-500'}`} title={isCurrentLocked ? "Mở khóa vị trí" : "Khóa vị trí (Cố định template)"}>
                            {isCurrentLocked ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.757-2.243-5-5-5zm2 5v3h-4V7c0-1.103.897-2 2-2s2 .897 2 2z"/></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                            )}
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
                            containerWidth={500} // Fixed base width, scaled by zoom
                            onItemTransform={handleItemTransform}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={handleTextUpdate}
                            isInteractive={true}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={() => {}} // Not needed for admin
                            allParts={{}} // Empty parts list as we use direct uploads mostly
                            className="pointer-events-auto"
                        />
                    </div>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center font-sans">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-[450px]">
                        <h3 className="text-xl font-bold mb-2">Lưu Mẫu Nền (Step 2)</h3>
                        <p className="text-sm text-gray-500 mb-4 bg-blue-50 p-2 rounded border border-blue-100">
                            <strong>Tính năng:</strong> Tạo ra các nền có sẵn chữ/sticker để khách hàng chọn ở Bước 2. 
                            Khách hàng có thể <strong>click vào chữ</strong> để sửa nội dung (tên, ngày tháng...)
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tên Hiển Thị</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ví dụ: Sinh nhật hồng, Kỷ niệm..."
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
                            <button onClick={handleSaveBackgroundTemplate} disabled={isSaving} className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">
                                {isSaving ? 'Đang lưu...' : 'Lưu Mẫu Nền'}
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
