
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset } from '../../types';
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
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    // Font Manager State
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    
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

    // useEffect for font injection
    useEffect(() => {
        const styleId = 'admin-dynamic-fonts';
        let style = document.getElementById(styleId) as HTMLStyleElement;
        if (!style) {
            style = document.createElement('style');
            style.id = 'admin-preview-fonts';
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

    const handleAddUploadItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    const newItem: DraggableItem = {
                        id: Date.now(),
                        partId: url, // Store URL in partId for charms/uploaded stickers
                        type: 'charm',
                        x: 50, y: 50, rotation: 0, scale: 1
                    };
                    setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
                    
                    const newAsset = await addAsset(url, 'sticker');
                    if (newAsset) setSavedAssets(prev => [newAsset, ...prev]);
                }
            } catch (err) {
                alert('Lỗi upload sticker');
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleLoadTemplate = (bg: PresetBackground) => {
        setEditingBgId(bg.id);
        setBgName(bg.name);
        setBgCategory(bg.category);
        setBgType(bg.type);
        
        let newFrameId = config.frameId;
        // Auto switch frame to match template type
        if (bg.type === 'square') {
            const sqFrame = frames.find(f => Math.abs(f.frameWidthCm - f.frameHeightCm) < 1);
            if(sqFrame) newFrameId = sqFrame.id;
        } else {
            const rectFrame = frames.find(f => Math.abs(f.frameWidthCm - f.frameHeightCm) > 1);
            if(rectFrame) newFrameId = rectFrame.id;
        }

        setConfig({
            ...config,
            frameId: newFrameId,
            background: { type: bg.url.startsWith('#') ? 'color' : 'image', value: bg.url },
            isRotated: bg.orientation === 'landscape',
            texts: bg.overlayConfig?.texts || [],
            draggableItems: bg.overlayConfig?.draggableItems || []
        });
        
        // Auto select tool based on content
        if (bg.overlayConfig?.texts.length) setActiveTool('text');
    };

    const captureThumbnail = async () => {
        if (!previewRef.current) return null;

        // 1. Store current zoom
        const originalZoom = zoom;
        
        // 2. Temporarily reset zoom to 1 to ensure 1:1 capture without scale distortion
        setZoom(1);
        
        // 3. Wait for re-render/transition (Important!)
        await new Promise(resolve => setTimeout(resolve, 300)); 

        try {
            const canvas = await html2canvas(previewRef.current, {
                useCORS: true,
                scale: 2, // Capture at 2x quality
                backgroundColor: null, 
                logging: false,
                ignoreElements: (element: Element) => element.classList.contains('transform-handle') // Ignore handles
            });

            // 4. Restore zoom immediately
            setZoom(originalZoom);

            const base64 = canvas.toDataURL('image/png');
            const blob = await (await fetch(base64)).blob();
            const file = new File([blob], "thumbnail.png", { type: "image/png" });
            
            return await uploadToCloudinary(file);
        } catch (e) {
            console.error("Capture error", e);
            setZoom(originalZoom); // Restore zoom even on error
            return null;
        }
    };

    const handleSaveBackgroundTemplate = async () => {
        if (!bgName) return alert("Vui lòng nhập tên background!");
        
        setIsSaving(true);
        // Clear selection to hide edit handles
        setSelectedItemId(null);
        
        // Wait for UI update (deselect)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate Thumbnail
        const thumbnailUrl = await captureThumbnail();

        const newBg: PresetBackground = {
            id: editingBgId || `bg_${Date.now()}`,
            name: bgName,
            category: bgCategory,
            type: bgType,
            url: config.background.value,
            thumbnailUrl: thumbnailUrl || undefined,
            orientation: bgType === 'rectangle' ? (config.isRotated ? 'landscape' : 'portrait') : undefined,
            overlayConfig: {
                texts: config.texts,
                draggableItems: config.draggableItems
            }
        };

        if (editingBgId) {
            await updateBackground(newBg.id, newBg);
        } else {
            await addBackground(newBg);
        }
        
        // Refresh local list
        setExistingBackgrounds(await getAllBackgrounds());
        setIsSaving(false);
        setShowSaveModal(false);
        setEditingBgId(newBg.id); // Stay in edit mode for this item
        alert("Đã lưu mẫu thành công!");
    };

    const handleCreateNew = () => {
        setEditingBgId(null);
        setBgName('');
        setConfig(INITIAL_FRAME_CONFIG);
        setSelectedItemId(null);
    };

    return (
        <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-gray-100 -mx-4 -mb-8">
            {/* Left Toolbar */}
            <div className="w-16 sm:w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 z-20 shadow-sm">
                {TOOLS.map(tool => (
                    <button 
                        key={tool.id} 
                        onClick={() => setActiveTool(tool.id)}
                        className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all w-14 ${activeTool === tool.id ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <span className="text-xl">{tool.icon}</span>
                        <span className="text-[10px] font-bold">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* Tool Panel (Slide out) */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col z-10 overflow-hidden">
                <div className="p-4 border-b font-bold text-gray-800 bg-gray-50">
                    {TOOLS.find(t => t.id === activeTool)?.label}
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {activeTool === 'templates' && (
                        <div className="space-y-4">
                            <button onClick={handleCreateNew} className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded font-bold text-sm text-gray-700 mb-2 border border-gray-300 border-dashed">+ Tạo mới</button>
                            {existingBackgrounds.map(bg => (
                                <div key={bg.id} className="group relative">
                                    <button 
                                        onClick={() => handleLoadTemplate(bg)}
                                        className="w-full text-left border rounded-lg p-2 hover:bg-gray-50 transition-colors flex gap-3 items-center"
                                    >
                                        <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                            <img src={bg.thumbnailUrl || bg.url} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{bg.name}</p>
                                            <p className="text-xs text-gray-500">{bg.type} • {bg.category}</p>
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTool === 'background' && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Màu nền</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#ffffff', '#f8f9fa', '#fffbf0', '#fce7f3', '#dbeafe', '#f3f4f6', '#1a202c'].map(color => (
                                        <button 
                                            key={color} 
                                            onClick={() => handleBackgroundChange('color', color)}
                                            className="w-8 h-8 rounded-full border shadow-sm hover:scale-110 transition-transform" 
                                            style={{backgroundColor: color}} 
                                        />
                                    ))}
                                    <input type="color" className="w-8 h-8 rounded-full cursor-pointer p-0 border-0" onChange={(e) => handleBackgroundChange('color', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tải ảnh nền</label>
                                <input type="file" onChange={handleUploadBackground} className="text-xs w-full" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Thư viện của bạn</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {savedAssets.filter(a => a.type === 'background').map(asset => (
                                        <div key={asset.id} className="relative group cursor-pointer" onClick={() => handleBackgroundChange('image', asset.url)}>
                                            <img src={asset.url} className="w-full h-16 object-cover rounded border" />
                                            <button onClick={(e) => handleDeleteAsset(asset.id, e)} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-bl">&times;</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTool === 'text' && (
                        <div className="space-y-4">
                            <button onClick={handleAddText} className="w-full bg-gray-900 text-white py-2 rounded font-bold text-sm">+ Thêm chữ mới</button>
                            {selectedItemId && selectedItemId.startsWith('text-') ? (
                                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Chỉnh sửa chữ đang chọn</p>
                                    <div className="space-y-2">
                                        <textarea 
                                            value={config.texts.find(t => t.id === parseInt(selectedItemId.split('-')[1]))?.content || ''}
                                            onChange={(e) => setConfig(prev => ({
                                                ...prev,
                                                texts: prev.texts.map(t => t.id === parseInt(selectedItemId.split('-')[1]) ? { ...t, content: e.target.value } : t)
                                            }))}
                                            className="w-full p-2 border rounded text-sm"
                                            rows={2}
                                        />
                                        <FontSelector 
                                            value={config.texts.find(t => t.id === parseInt(selectedItemId.split('-')[1]))?.font || 'Playfair Display'}
                                            onChange={(font) => setConfig(prev => ({
                                                ...prev,
                                                texts: prev.texts.map(t => t.id === parseInt(selectedItemId.split('-')[1]) ? { ...t, font } : t)
                                            }))}
                                            onPreview={setPreviewFont}
                                            uploadedFonts={uploadedFonts}
                                        />
                                        <div className="flex gap-2">
                                            <input type="color" className="w-8 h-8 rounded cursor-pointer border-0" 
                                                value={config.texts.find(t => t.id === parseInt(selectedItemId.split('-')[1]))?.color || '#000000'}
                                                onChange={(e) => setConfig(prev => ({
                                                    ...prev,
                                                    texts: prev.texts.map(t => t.id === parseInt(selectedItemId.split('-')[1]) ? { ...t, color: e.target.value } : t)
                                                }))}
                                            />
                                            <input type="number" className="w-16 p-1 border rounded text-sm" 
                                                value={config.texts.find(t => t.id === parseInt(selectedItemId.split('-')[1]))?.size || 24}
                                                onChange={(e) => setConfig(prev => ({
                                                    ...prev,
                                                    texts: prev.texts.map(t => t.id === parseInt(selectedItemId.split('-')[1]) ? { ...t, size: parseInt(e.target.value) } : t)
                                                }))}
                                            />
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={config.texts.find(t => t.id === parseInt(selectedItemId.split('-')[1]))?.lockedContent || false}
                                                onChange={(e) => setConfig(prev => ({
                                                    ...prev,
                                                    texts: prev.texts.map(t => t.id === parseInt(selectedItemId.split('-')[1]) ? { ...t, lockedContent: e.target.checked } : t)
                                                }))}
                                                className="w-4 h-4 accent-gray-900"
                                            />
                                            <label className="text-xs text-gray-700 font-medium">Khóa nội dung (Khách không sửa được)</label>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic text-center">Chọn một dòng chữ trên khung để sửa</p>
                            )}
                        </div>
                    )}

                    {activeTool === 'upload' && (
                        <div className="space-y-4">
                            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded font-bold text-sm hover:bg-gray-50">Tải Sticker/Ảnh</button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddUploadItem} />
                            
                            <div className="grid grid-cols-3 gap-2">
                                {savedAssets.filter(a => a.type === 'sticker').map(asset => (
                                    <div key={asset.id} className="relative group cursor-pointer p-1 border rounded hover:bg-gray-50" onClick={() => {
                                        const newItem: DraggableItem = { id: Date.now(), partId: asset.url, type: 'charm', x: 50, y: 50, rotation: 0, scale: 1 };
                                        setConfig(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] }));
                                    }}>
                                        <img src={asset.url} className="w-full h-12 object-contain" />
                                        <button onClick={(e) => handleDeleteAsset(asset.id, e)} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-bl">&times;</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTool === 'layers' && (
                        <div className="space-y-2">
                            {[...config.texts, ...config.draggableItems].length === 0 && <p className="text-sm text-gray-400 text-center">Chưa có lớp nào.</p>}
                            
                            {config.texts.map(t => (
                                <div key={t.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border hover:bg-white text-xs">
                                    <span className="truncate max-w-[150px]">{t.content}</span>
                                    <button onClick={() => setConfig(prev => ({ ...prev, texts: prev.texts.filter(text => text.id !== t.id) }))} className="text-red-500 font-bold">&times;</button>
                                </div>
                            ))}
                            {config.draggableItems.map(d => (
                                <div key={d.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border hover:bg-white text-xs">
                                    <span className="truncate">Sticker/Item</span>
                                    <button onClick={() => setConfig(prev => ({ ...prev, draggableItems: prev.draggableItems.filter(item => item.id !== d.id) }))} className="text-red-500 font-bold">&times;</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-grow flex flex-col relative">
                {/* Canvas Toolbar */}
                <div className="h-12 bg-white border-b flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <select 
                            value={config.frameId} 
                            onChange={(e) => handleFrameChange(e.target.value)}
                            className="text-sm border rounded p-1 bg-gray-50"
                        >
                            {frames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <button onClick={() => setConfig(prev => ({ ...prev, isRotated: !prev.isRotated }))} className="p-1 hover:bg-gray-100 rounded" title="Xoay khung">
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Zoom: {Math.round(zoom * 100)}%</span>
                        <input type="range" min="0.5" max="2" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-24 accent-gray-900" />
                    </div>
                    <button onClick={() => setShowSaveModal(true)} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 shadow-sm">
                        Lưu Mẫu
                    </button>
                </div>

                {/* Canvas */}
                <div className="flex-grow flex items-center justify-center bg-gray-100 overflow-hidden relative">
                    <div 
                        style={{ 
                            transform: `scale(${zoom})`, 
                            transition: 'transform 0.2s',
                            transformOrigin: 'center center' 
                        }}
                    >
                        <FramePreview 
                            ref={previewRef}
                            config={config} 
                            containerWidth={400} 
                            onItemTransform={(id, transform) => {
                                // Re-use logic from BuilderPage (simplified here for admin)
                                const [type, rawId] = id.split('-');
                                const numId = parseInt(rawId);
                                if (type === 'text') {
                                    setConfig(prev => ({ ...prev, texts: prev.texts.map(t => t.id === numId ? { ...t, ...transform } : t) }));
                                } else if (type === 'item') {
                                    setConfig(prev => ({ ...prev, draggableItems: prev.draggableItems.map(i => i.id === numId ? { ...i, ...transform } : i) }));
                                }
                            }}
                            onItemRemove={(id) => {
                                const [type, rawId] = id.split('-');
                                const numId = parseInt(rawId);
                                if (type === 'text') setConfig(prev => ({ ...prev, texts: prev.texts.filter(t => t.id !== numId) }));
                                else if (type === 'item') setConfig(prev => ({ ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numId) }));
                                setSelectedItemId(null);
                            }}
                            onTextUpdate={() => {}} 
                            selectedItemId={selectedItemId} 
                            setSelectedItemId={setSelectedItemId} 
                            isInteractive={true} 
                            setIsEditingText={() => {}} 
                            allParts={{}} // Not needed for templates usually
                            onItemUpdate={() => {}} 
                            onCharacterUpdate={() => {}} 
                            previewFont={previewFont}
                        />
                    </div>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
                        <h3 className="text-lg font-bold mb-4 text-gray-800">Lưu Mẫu Background</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tên Mẫu</label>
                                <input className="w-full p-2 border rounded text-sm" value={bgName} onChange={(e) => setBgName(e.target.value)} placeholder="VD: Sinh nhật 1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Danh mục</label>
                                <select className="w-full p-2 border rounded text-sm" value={bgCategory} onChange={(e) => setBgCategory(e.target.value)}>
                                    {BG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Loại Khung</label>
                                <select className="w-full p-2 border rounded text-sm" value={bgType} onChange={(e) => setBgType(e.target.value as any)}>
                                    <option value="square">Vuông</option>
                                    <option value="rectangle">Chữ nhật</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded text-sm">Hủy</button>
                            <button onClick={handleSaveBackgroundTemplate} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-bold rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                                {isSaving ? 'Đang lưu...' : 'Lưu Ngay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
