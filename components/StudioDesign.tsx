
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FrameConfig, PresetBackground, TextConfig, DraggableItem, LegoPart, LegoCharacterConfig } from '../types';
import { uploadToCloudinary } from '../services/uploadService';
import { addFont } from '../services/fontService';
import FramePreview from './FramePreview';
import { ZoomIcon } from './ZoomIcon';

interface StudioDesignProps {
    config: FrameConfig;
    setConfig: (config: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => void;
    backgrounds: PresetBackground[];
    selectedItemId: string | null;
    setSelectedItemId: (id: string | null) => void;
    onZoomImage: (url: string) => void;
    onStepChange: (step: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    historyIndex: number;
    historyLength: number;
    logoUrl?: string;
    allParts: Record<string, LegoPart>;
    onItemTransform: (id: string, newTransform: any) => void;
    onItemRemove: (id: string) => void;
    onTextUpdate: (id: number, updates: any) => void;
    onItemUpdate: (id: string, updates: any) => void;
    onCharacterUpdate: (id: number, updates: any) => void;
    onItemFlip: (id: string) => void;
    setIsEditingText: (isEditing: boolean) => void;
    frameCaptureRef: React.RefObject<HTMLDivElement>;
    customFonts: {name: string, label: string}[];
    setCustomFonts: React.Dispatch<React.SetStateAction<{name: string, label: string}[]>>;
    showToast?: (message: string, type: 'success' | 'error') => void;
    isAdmin?: boolean;
    onSaveTemplate?: () => void;
}

type StudioTab = 'template' | 'text' | 'upload' | 'layers'; 

const DEFAULT_FONTS = [
    { name: 'Montserrat', label: 'Hiện đại' },
    { name: 'Playfair Display', label: 'Sang trọng' },
    { name: 'Dancing Script', label: 'Viết tay' },
    { name: 'Pacifico', label: 'Vui nhộn' },
    { name: 'Roboto', label: 'Cơ bản' },
    { name: 'Merriweather', label: 'Cổ điển' },
    { name: 'Nunito', label: 'Thân thiện' },
];

export const StudioDesign: React.FC<StudioDesignProps> = ({ 
    config, 
    setConfig, 
    backgrounds, 
    selectedItemId, 
    setSelectedItemId, 
    onZoomImage, 
    onStepChange, 
    onUndo, 
    onRedo, 
    historyIndex, 
    historyLength, 
    logoUrl, 
    allParts, 
    onItemTransform, 
    onItemRemove, 
    onTextUpdate, 
    onItemUpdate, 
    onCharacterUpdate, 
    onItemFlip, 
    setIsEditingText, 
    frameCaptureRef, 
    customFonts, 
    setCustomFonts, 
    showToast,
    isAdmin,
    onSaveTemplate
}) => {
    const [activeTab, setActiveTab] = useState<StudioTab>('template');
    const [isUploading, setIsUploading] = useState(false);
    const [isFontUploading, setIsFontUploading] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [bgCategory, setBgCategory] = useState('All');
    
    const charmUploadRef = useRef<HTMLInputElement>(null);
    const fontUploadRef = useRef<HTMLInputElement>(null);

    // Helpers
    const updateConfig = (updates: Partial<FrameConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    };

    // Keyboard Delete Listener - Improved Robustness
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const activeEl = document.activeElement;
                const isInputActive = activeEl instanceof HTMLInputElement || 
                                      activeEl instanceof HTMLTextAreaElement || 
                                      activeEl instanceof HTMLSelectElement;
                
                if (!isInputActive && selectedItemId) {
                    onItemRemove(selectedItemId);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, onItemRemove]);

    const addText = () => {
        const newId = Date.now();
        const newText: TextConfig = { 
            id: newId, 
            content: 'Nhập chữ...', 
            font: 'Montserrat', 
            size: 20, 
            color: '#333333', 
            x: 50, y: 50, 
            rotation: 0, 
            scale: 1, 
            background: false, 
            textAlign: 'center', 
            width: 40 
        };
        updateConfig({ texts: [...config.texts, newText] });
        setSelectedItemId(`text-${newId}`);
    };

    const handleCharmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setIsUploading(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    const newItem: DraggableItem = { 
                        id: Date.now(), 
                        partId: url, 
                        type: 'charm', 
                        x: 50, y: 50, 
                        rotation: 0, 
                        scale: 0.5 
                    };
                    updateConfig({ draggableItems: [...config.draggableItems, newItem] });
                    if(showToast) showToast('Tải ảnh thành công!', 'success');
                }
            } finally {
                setIsUploading(false);
            }
        }
    };

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsFontUploading(true);
        // Sanitize name: remove non-alphanumeric chars to ensure valid CSS identifier
        const fontName = file.name.split('.')[0]; 
        const safeFontName = fontName.replace(/[^a-zA-Z0-9]/g, '');
        
        try {
            const url = await uploadToCloudinary(file);
            if (!url) throw new Error("Upload failed");

            // Use FontFace API to load font immediately
            const newFontFace = new FontFace(safeFontName, `url(${url})`);
            await newFontFace.load();
            document.fonts.add(newFontFace);

            // Add to session list
            setCustomFonts(prev => [...prev, { name: safeFontName, label: `${fontName} (Tải lên)` }]);
            
            // IF ADMIN: Save to Firestore for all users
            if (isAdmin) {
                await addFont({ id: `font_${Date.now()}`, name: safeFontName, url });
                if(showToast) showToast(`Font đã được lưu vào hệ thống cho mọi người dùng.`, 'success');
            } else {
                if(showToast) showToast(`Font đã tải lên (Phiên này).`, 'success');
            }

            // Apply immediately if text selected
            if (activeText) {
                onTextUpdate(activeText.id, { font: safeFontName });
            }

        } catch (error) {
            console.error(error);
            if(showToast) showToast('Lỗi tải font. Vui lòng thử lại.', 'error');
        } finally {
            setIsFontUploading(false);
        }
    };

    // ... (activeText, activeItem, activeCharacter memoized logic remains same)
    const activeText = useMemo(() => {
        if (selectedItemId?.startsWith('text-')) {
            const id = parseInt(selectedItemId.split('-')[1]);
            return config.texts.find(t => t.id === id);
        }
        return null;
    }, [selectedItemId, config.texts]);

    const activeItem = useMemo(() => {
        if (selectedItemId?.startsWith('item-')) {
            const id = parseInt(selectedItemId.split('-')[1]);
            return config.draggableItems.find(i => i.id === id);
        }
        return null;
    }, [selectedItemId, config.draggableItems]);

    const activeCharacter = useMemo(() => {
        if (selectedItemId?.startsWith('character-')) {
            const id = parseInt(selectedItemId.split('-')[1]);
            return config.characters.find(c => c.id === id);
        }
        return null;
    }, [selectedItemId, config.characters]);

    const bringToFront = (fullId: string) => {
        const [type, idStr] = fullId.split('-');
        const id = parseInt(idStr);

        if (type === 'text') {
            const item = config.texts.find(t => t.id === id);
            if (!item) return;
            const others = config.texts.filter(t => t.id !== id);
            updateConfig({ texts: [...others, item] });
        } else if (type === 'item') {
            const item = config.draggableItems.find(i => i.id === id);
            if (!item) return;
            const others = config.draggableItems.filter(i => i.id !== id);
            updateConfig({ draggableItems: [...others, item] });
        }
    }

    const handleAlign = (alignment: 'center' | 'middle') => {
        // Center on Canvas (Position)
        if (activeText) {
            if (alignment === 'center') onTextUpdate(activeText.id, { x: 50 });
            if (alignment === 'middle') onTextUpdate(activeText.id, { y: 50 });
        } else if (activeItem) {
            if (alignment === 'center') onItemTransform(selectedItemId!, { ...activeItem, x: 50 });
            if (alignment === 'middle') onItemTransform(selectedItemId!, { ...activeItem, y: 50 });
        } else if (activeCharacter) {
            if (alignment === 'center') onItemTransform(selectedItemId!, { ...activeCharacter, x: 50 });
            if (alignment === 'middle') onItemTransform(selectedItemId!, { ...activeCharacter, y: 50 });
        }
    };

    const handleTextAlign = (align: 'left' | 'center' | 'right') => {
        if (activeText) {
            onTextUpdate(activeText.id, { textAlign: align });
        }
    }

    const templates = useMemo(() => {
        const isSquare = config.frameId === 'sm' || config.frameId === 'lg';
        const typeNeeded = isSquare ? 'square' : 'rectangle';
        let filtered = backgrounds.filter(bg => bg.type === typeNeeded && !bg.url.startsWith('#'));
        
        if (bgCategory !== 'All') {
            filtered = filtered.filter(bg => bg.category === bgCategory);
        }
        return filtered;
    }, [config.frameId, backgrounds, bgCategory]);

    const categories = useMemo(() => {
        const cats = new Set(backgrounds.map(b => b.category || 'Khác'));
        return ['All', ...Array.from(cats)];
    }, [backgrounds]);

    const allFonts = [...DEFAULT_FONTS, ...customFonts];

    return (
        <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans text-gray-900" tabIndex={0}>
            {/* 1. Left Sidebar (Tools) */}
            <div className="w-16 md:w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 shadow-sm z-30">
                <div className="mb-2">
                    <button onClick={() => onStepChange(1)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors" title="Quay lại">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                </div>
                {[
                    { id: 'template', icon: '🖼️', label: 'Mẫu Nền' },
                    { id: 'text', icon: 'T', label: 'Văn bản' },
                    { id: 'upload', icon: '☁️', label: 'Tải lên' },
                    { id: 'layers', icon: '☰', label: 'Lớp' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as StudioTab)}
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                            activeTab === tab.id 
                                ? 'bg-pink-50 text-luvin-pink shadow-inner border border-pink-100' 
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                        title={tab.label}
                    >
                        <span className="text-xl">{tab.icon}</span>
                        <span className="text-[9px] md:text-[10px] font-bold">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* 2. Left Drawer (Options) - Content remains same ... */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg capitalize">
                        {activeTab === 'template' && 'Mẫu Nền Thiết Kế'}
                        {activeTab === 'text' && 'Thêm Văn Bản'}
                        {activeTab === 'upload' && 'Tải Ảnh & Icon'}
                        {activeTab === 'layers' && 'Quản Lý Lớp'}
                    </h3>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
                    {/* ... (Templates, Text, Upload, Layers content same as previous implementation) ... */}
                    {activeTab === 'template' && (
                        <>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
                                {categories.map(cat => (
                                    <button key={cat} onClick={() => setBgCategory(cat)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors border ${bgCategory === cat ? 'bg-luvin-pink text-white border-luvin-pink' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{cat === 'All' ? 'Tất cả' : cat}</button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                <button onClick={() => updateConfig({ background: { type: 'color', value: '#ffffff' } })} className={`relative aspect-[4/5] rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:bg-gray-50 transition-all ${config.background.value === '#ffffff' ? 'border-luvin-pink bg-pink-50' : ''}`}><span className="w-6 h-6 rounded-full border border-gray-200 bg-white shadow-sm mb-1"></span><span className="text-[10px] text-gray-500 font-bold">Trắng (Mặc định)</span></button>
                                {templates.map(bg => (
                                    <button key={bg.id} onClick={() => updateConfig({ background: { type: 'image', value: bg.url } })} className={`relative aspect-[4/5] rounded-lg overflow-hidden border-2 transition-all group hover:shadow-md ${config.background.value === bg.url ? 'border-luvin-pink ring-2 ring-luvin-pink/30' : 'border-transparent hover:border-gray-300'}`}><img src={bg.url} className="w-full h-full object-cover" loading="lazy" />{config.background.value === bg.url && (<div className="absolute inset-0 bg-luvin-pink/10 flex items-center justify-center"><div className="bg-white rounded-full p-1 shadow-sm"><svg className="w-4 h-4 text-luvin-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div></div>)}<div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate px-1 text-center">{bg.name}</div></button>
                                ))}
                            </div>
                        </>
                    )}
                    {activeTab === 'text' && (
                        <div className="animate-fade-in space-y-4">
                            <button onClick={addText} className="w-full py-4 bg-luvin-pink text-white rounded-xl font-bold text-sm shadow-lg hover:brightness-90 transition-transform active:scale-95 flex items-center justify-center gap-2"><span className="text-xl font-light">+</span> Thêm tiêu đề</button>
                            <div className="border-t pt-4"><p className="text-xs text-gray-500 mb-3">Font chữ phổ biến</p><div className="space-y-2">{DEFAULT_FONTS.slice(0, 3).map((font, idx) => (<button key={idx} onClick={() => { addText(); setTimeout(() => { const lastText = config.texts[config.texts.length-1]; if(lastText) onTextUpdate(lastText.id, { font: font.name }); }, 50); }} className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors text-2xl truncate bg-white text-gray-800" style={{ fontFamily: font.name }}>Mẫu văn bản</button>))}</div></div>
                        </div>
                    )}
                    {activeTab === 'upload' && (
                        <div className="animate-fade-in space-y-4">
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4"><button className="flex-1 py-1.5 text-xs font-bold bg-white shadow-sm rounded-md text-gray-800">Ảnh & Icons</button></div>
                            <div onClick={() => charmUploadRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-white"><div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div><h4 className="font-bold text-gray-800 text-sm">Tải ảnh / Icon</h4><p className="text-xs text-gray-500 mt-1">Hỗ trợ PNG trong suốt</p><input type="file" ref={charmUploadRef} accept="image/*" className="hidden" onChange={handleCharmUpload} /></div>
                            <div><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Đã tải lên</h4><div className="grid grid-cols-3 gap-2">{config.draggableItems.filter(i => i.type === 'charm').map(item => (<div key={item.id} onClick={() => setSelectedItemId(`item-${item.id}`)} className={`relative aspect-square bg-white rounded-lg border p-1 cursor-pointer overflow-hidden ${selectedItemId === `item-${item.id}` ? 'border-luvin-pink ring-1 ring-luvin-pink' : 'border-gray-200'}`}><img src={item.partId} className="w-full h-full object-contain" /><button onClick={(e) => { e.stopPropagation(); onItemRemove(`item-${item.id}`); }} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-bl text-xs opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10">×</button></div>))}</div>{config.draggableItems.filter(i => i.type === 'charm').length === 0 && (<p className="text-center text-xs text-gray-400 italic py-4">Chưa có ảnh nào.</p>)}</div>
                        </div>
                    )}
                    {activeTab === 'layers' && (
                        <div className="animate-fade-in space-y-2">
                            {config.texts.map((t, idx) => (<div key={`layer-text-${t.id}`} onClick={() => { setSelectedItemId(`text-${t.id}`); }} className={`flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm cursor-pointer transition-all ${selectedItemId === `text-${t.id}` ? 'border-luvin-pink bg-pink-50' : 'border-gray-200'}`}><div className="flex items-center gap-3"><span className="text-lg font-serif font-bold text-gray-400">T</span><div><p className="text-sm font-bold text-gray-800 truncate w-32">{t.content || 'Văn bản'}</p></div></div><div className="flex items-center gap-1"><button onClick={(e) => { e.stopPropagation(); bringToFront(`text-${t.id}`); }} className="p-1.5 text-gray-400 hover:text-blue-600" title="Lên trên">⬆️</button><button onClick={(e) => { e.stopPropagation(); onItemRemove(`text-${t.id}`); }} className="p-1.5 text-gray-400 hover:text-red-600" title="Xóa">🗑️</button></div></div>))}
                            {config.draggableItems.map((d, idx) => (<div key={`layer-item-${d.id}`} onClick={() => setSelectedItemId(`item-${d.id}`)} className={`flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm cursor-pointer transition-all ${selectedItemId === `item-${d.id}` ? 'border-luvin-pink bg-pink-50' : 'border-gray-200'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden border"><img src={d.partId} className="w-full h-full object-contain" /></div><div><p className="text-sm font-bold text-gray-800 truncate w-32">{d.type === 'charm' ? 'Ảnh cá nhân' : 'Phụ kiện'}</p></div></div><div className="flex items-center gap-1"><button onClick={(e) => { e.stopPropagation(); bringToFront(`item-${d.id}`); }} className="p-1.5 text-gray-400 hover:text-blue-600" title="Lên trên">⬆️</button><button onClick={(e) => { e.stopPropagation(); onItemRemove(`item-${d.id}`); }} className="p-1.5 text-gray-400 hover:text-red-600" title="Xóa">🗑️</button></div></div>))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Center Canvas Area */}
            <div className="flex-grow relative bg-[#e5e5e5] overflow-hidden flex flex-col">
                {/* Top Action Bar */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white shadow-md rounded-full px-4 py-2 flex items-center gap-4 border border-gray-200">
                    <div className="flex gap-1">
                        <button onClick={onUndo} disabled={historyIndex <= 0} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-700" title="Hoàn tác (Ctrl+Z)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                        <button onClick={onRedo} disabled={historyIndex >= historyLength - 1} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-700" title="Làm lại (Ctrl+Shift+Z)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                    </div>
                    
                    {/* Admin Action: Save Template */}
                    {isAdmin && onSaveTemplate && (
                        <>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <button onClick={onSaveTemplate} className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow hover:bg-purple-700 transition-transform active:scale-95 flex items-center gap-1">
                                <span>💾</span> Lưu làm Mẫu
                            </button>
                        </>
                    )}

                    <div className="w-px h-6 bg-gray-200"></div>
                    <button onClick={() => onStepChange(3)} className="bg-gray-900 text-white px-6 py-2 rounded-full text-sm font-bold shadow hover:bg-black transition-transform active:scale-95 flex items-center gap-2">Tiếp theo <span className="text-xs">&rarr;</span></button>
                </div>

                {/* Canvas */}
                <div className="flex-grow flex items-center justify-center p-8 overflow-auto">
                    <div className="shadow-2xl transition-transform duration-200 ease-out border border-gray-200" style={{ transform: `scale(${zoomLevel})` }}>
                        <FramePreview 
                            ref={frameCaptureRef}
                            config={config}
                            containerWidth={500} 
                            onItemTransform={onItemTransform} 
                            onItemRemove={onItemRemove}
                            onTextUpdate={onTextUpdate}
                            onItemUpdate={onItemUpdate}
                            onCharacterUpdate={onCharacterUpdate}
                            onItemFlip={onItemFlip}
                            className="bg-white"
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={setIsEditingText}
                            allParts={allParts}
                            logoUrl={logoUrl}
                        />
                    </div>
                </div>

                {/* Bottom Zoom Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-4 z-40 border border-gray-200">
                    <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="text-gray-600 hover:text-gray-900 p-1 font-bold">-</button>
                    <span className="text-xs font-bold text-gray-500 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))} className="text-gray-600 hover:text-gray-900 p-1 font-bold">+</button>
                    <div className="w-px h-4 bg-gray-200"></div>
                    <button onClick={() => setZoomLevel(1)} className="text-xs text-luvin-pink font-bold hover:underline">Fit</button>
                </div>
            </div>

            {/* 4. Right Sidebar (Contextual Properties) - Content remains same ... */}
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full z-20 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300">
                {activeText ? (
                    <div className="p-4 space-y-6 animate-fade-in">
                        <div className="border-b pb-3">
                            <h3 className="font-bold text-gray-800">Chỉnh sửa Văn bản</h3>
                        </div>
                        {/* ... Text Controls ... */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Căn chỉnh văn bản</label>
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => handleTextAlign('left')} className={`flex-1 py-1.5 rounded transition-colors ${activeText.textAlign === 'left' ? 'bg-white shadow text-luvin-pink' : 'text-gray-500 hover:bg-gray-200'}`} title="Trái"><svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" /></svg></button>
                                <button onClick={() => handleTextAlign('center')} className={`flex-1 py-1.5 rounded transition-colors ${!activeText.textAlign || activeText.textAlign === 'center' ? 'bg-white shadow text-luvin-pink' : 'text-gray-500 hover:bg-gray-200'}`} title="Giữa"><svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                                <button onClick={() => handleTextAlign('right')} className={`flex-1 py-1.5 rounded transition-colors ${activeText.textAlign === 'right' ? 'bg-white shadow text-luvin-pink' : 'text-gray-500 hover:bg-gray-200'}`} title="Phải"><svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M13 18h7" /></svg></button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Căn lề (Alignment)</label>
                            <div className="flex gap-2">
                                <button onClick={() => handleAlign('center')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-xs font-bold transition-colors">Giữa (Ngang)</button>
                                <button onClick={() => handleAlign('middle')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-xs font-bold transition-colors">Giữa (Dọc)</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Nội dung</label>
                            <textarea value={activeText.content} onChange={(e) => onTextUpdate(activeText.id, { content: e.target.value })} className="w-full p-3 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-luvin-pink transition-all" rows={3} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Font chữ</label>
                            <select value={activeText.font} onChange={(e) => onTextUpdate(activeText.id, { font: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-white">
                                {allFonts.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                            </select>
                            <button onClick={() => fontUploadRef.current?.click()} disabled={isFontUploading} className="text-xs text-luvin-pink font-bold mt-2 hover:underline block">{isFontUploading ? 'Đang tải font...' : '+ Tải font khác (.ttf/.otf)'}</button>
                            <input type="file" ref={fontUploadRef} accept=".ttf,.otf" className="hidden" onChange={handleFontUpload} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Cỡ chữ</label><div className="flex items-center gap-2"><input type="number" value={activeText.size} onChange={(e) => onTextUpdate(activeText.id, { size: Number(e.target.value) })} className="w-full p-2 border rounded-lg text-sm" min="8" max="100" /></div></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Màu sắc</label><div className="flex items-center gap-2 border rounded-lg p-1.5 bg-white"><input type="color" value={activeText.color} onChange={(e) => onTextUpdate(activeText.id, { color: e.target.value })} className="w-6 h-6 rounded border-0 cursor-pointer" /><span className="text-xs text-gray-600 font-mono">{activeText.color}</span></div></div>
                        </div>
                        <button onClick={() => onItemRemove(`text-${activeText.id}`)} className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Xóa văn bản</button>
                    </div>
                ) : activeItem || activeCharacter ? (
                    <div className="p-4 space-y-6 animate-fade-in">
                        {/* ... Item Controls ... */}
                        <div className="border-b pb-3"><h3 className="font-bold text-gray-800">Chỉnh sửa {activeCharacter ? 'Nhân vật' : 'Đối tượng'}</h3></div>
                        {activeItem && (<div className="bg-gray-50 p-4 rounded-xl flex justify-center border border-gray-200"><img src={activeItem.partId} className="h-32 object-contain" /></div>)}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Căn lề</label>
                            <div className="flex gap-2">
                                <button onClick={() => handleAlign('center')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-xs font-bold transition-colors">Giữa (Ngang)</button>
                                <button onClick={() => handleAlign('middle')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-xs font-bold transition-colors">Giữa (Dọc)</button>
                            </div>
                        </div>
                        {activeItem && (<div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Xoay & Lật</label><div className="flex gap-2"><button onClick={() => onItemFlip(`item-${activeItem.id}`)} className="flex-1 py-2 bg-white border rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50">Lật ảnh ↔</button></div><div className="mt-3"><label className="text-xs text-gray-500 mb-1 block">Góc xoay ({Math.round(activeItem.rotation)}°)</label><input type="range" min="0" max="360" value={activeItem.rotation || 0} onChange={(e) => onItemTransform(`item-${activeItem.id}`, { rotation: Number(e.target.value) })} className="w-full accent-gray-900" /></div></div>)}
                        <div><label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Kích thước</label><div className="flex items-center gap-2"><input type="range" min="0.2" max="3" step="0.1" value={(activeItem || activeCharacter)?.scale || 1} onChange={(e) => onItemTransform(selectedItemId!, { scale: Number(e.target.value) })} className="flex-grow accent-gray-900" /><input type="number" min="0.2" max="3" step="0.1" value={((activeItem || activeCharacter)?.scale || 1).toFixed(1)} onChange={(e) => onItemTransform(selectedItemId!, { scale: Number(e.target.value) })} className="w-16 p-1 border rounded text-center text-sm" /></div></div>
                        {activeItem && (<button onClick={() => onItemRemove(`item-${activeItem.id}`)} className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Xóa đối tượng</button>)}
                    </div>
                ) : (
                    <div className="p-6 text-center h-full flex flex-col items-center justify-center text-gray-400">
                        <span className="text-4xl mb-4 opacity-30">🎨</span>
                        <p className="text-sm font-medium">Chọn một đối tượng trên hình<br/>để xem thuộc tính</p>
                    </div>
                )}
            </div>
        </div>
    );
};
