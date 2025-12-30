
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, LegoPart, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadFile } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';

declare var html2canvas: any;

const TOOLS = [
    { id: 'templates', icon: '📂', label: 'Mẫu' }, 
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'shape', icon: '🟥', label: 'Cấu trúc' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

const BG_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Khác'];

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
    const [frames, setFrames] = useState<FrameOption[]>([]);
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
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');

    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const [quickFontName, setQuickFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);
    
    const [clipboard, setClipboard] = useState<{ type: 'text' | 'shape' | 'item'; data: any } | null>(null);

    // Refs
    const previewRef = useRef<HTMLDivElement>(null);
    const frameCaptureRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setConfigWithHistory = useCallback((newConfigOrFn: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => {
        setConfig(prev => {
            const newConfig = typeof newConfigOrFn === 'function' ? newConfigOrFn(prev) : newConfigOrFn;
            if (JSON.stringify(newConfig) !== JSON.stringify(prev)) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(newConfig);
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

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, assetsData] = await Promise.all([
                getAllFrames(),
                getStoreConfig(),
                getAllBackgrounds(),
                getAllAssets()
            ]);
            
            if (framesData.length > 0) {
                setFrames(framesData);
                if (config.frameId === 'lg' && framesData.length > 0) {
                    setConfig(prev => ({ ...prev, frameId: framesData[0].id }));
                }
            }
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
            if (bgData) setExistingBackgrounds(bgData);
            if (assetsData) setSavedAssets(assetsData);
        };
        fetchInitialData();
    }, []);

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
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== numericId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== numericId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== numericId) };
            return prev;
        });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const isCtrl = e.ctrlKey || e.metaKey;
            
            if (isCtrl && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
                return;
            }
            if (isCtrl && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                handleRedo();
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedItemId) {
                    e.preventDefault();
                    handleItemRemove(selectedItemId);
                }
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                setSelectedItemId(null);
                return;
            }
            if (isCtrl && e.key === 'c') {
                if (selectedItemId) {
                    e.preventDefault();
                    const [type, idStr] = selectedItemId.split('-');
                    const id = parseInt(idStr);
                    let data = null;
                    let itemType: 'text' | 'shape' | 'item' | null = null;
                    if (type === 'text') { data = config.texts.find(t => t.id === id); itemType = 'text'; }
                    else if (type === 'shape') { data = config.shapes?.find(s => s.id === id); itemType = 'shape'; }
                    else if (type === 'item') { data = config.draggableItems.find(i => i.id === id); itemType = 'item'; }
                    if (data && itemType) { setClipboard({ type: itemType, data: JSON.parse(JSON.stringify(data)) }); }
                }
                return;
            }
            if (isCtrl && e.key === 'v') {
                if (clipboard) {
                    e.preventDefault();
                    const newId = Date.now();
                    const newItem = { ...clipboard.data, id: newId, x: Math.min(95, (clipboard.data.x || 50) + 2), y: Math.min(95, (clipboard.data.y || 50) + 2) };
                    setConfigWithHistory(prev => {
                        const next = { ...prev };
                        if (clipboard.type === 'text') next.texts = [...prev.texts, newItem];
                        else if (clipboard.type === 'shape') next.shapes = [...(prev.shapes || []), newItem];
                        else if (clipboard.type === 'item') next.draggableItems = [...prev.draggableItems, newItem];
                        return next;
                    });
                    setSelectedItemId(`${clipboard.type}-${newId}`);
                }
                return;
            }
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

                setConfigWithHistory(prev => {
                    const next = { ...prev };
                    if (type === 'text') next.texts = next.texts.map(t => t.id === id ? { ...t, x: Math.max(0, Math.min(100, t.x + dx)), y: Math.max(0, Math.min(100, t.y + dy)) } : t);
                    else if (type === 'shape') next.shapes = next.shapes.map(s => s.id === id ? { ...s, x: Math.max(0, Math.min(100, s.x + dx)), y: Math.max(0, Math.min(100, s.y + dy)) } : s);
                    else if (type === 'item') next.draggableItems = next.draggableItems.map(i => i.id === id ? { ...i, x: Math.max(0, Math.min(100, i.x + dx)), y: Math.max(0, Math.min(100, i.y + dy)) } : i);
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, config, clipboard]);

    const handleSaveTemplate = async () => {
        if (!bgName.trim()) { alert("Vui lòng nhập tên mẫu!"); return; }
        setIsSaving(true);
        try {
            const originalSelectedId = selectedItemId;
            setSelectedItemId(null);
            
            const canvas = await html2canvas(frameCaptureRef.current, { backgroundColor: null, useCORS: true, scale: 2 });
            const previewUrl = canvas.toDataURL('image/png');
            setSelectedItemId(originalSelectedId);

            const overlayConfig = {
                texts: config.texts,
                draggableItems: config.draggableItems,
                shapes: config.shapes || []
            };

            const bgData: PresetBackground = {
                id: editingBgId || `bg_tpl_${Date.now()}`,
                name: bgName,
                url: config.background.value,
                previewUrl: previewUrl,
                category: bgCategory,
                type: bgType,
                overlayConfig: overlayConfig
            };

            if (editingBgId) {
                await updateBackground(editingBgId, bgData);
            } else {
                await addBackground(bgData);
            }
            
            alert("Lưu mẫu thành công!");
            setShowSaveModal(false);
            const freshBgs = await getAllBackgrounds();
            setExistingBackgrounds(freshBgs);
        } catch (e) {
            console.error(e);
            alert("Lỗi lưu mẫu.");
        } finally {
            setIsSaving(false);
        }
    };

    const loadTemplate = (tpl: PresetBackground) => {
        setEditingBgId(tpl.id);
        setBgName(tpl.name);
        setBgCategory(tpl.category);
        setBgType(tpl.type);
        
        const newConfig = {
            ...INITIAL_FRAME_CONFIG,
            background: { type: tpl.url.startsWith('#') ? 'color' : 'image', value: tpl.url } as any,
            texts: tpl.overlayConfig?.texts || [],
            draggableItems: tpl.overlayConfig?.draggableItems || [],
            shapes: tpl.overlayConfig?.shapes || []
        };
        
        setConfig(newConfig);
        setHistory([newConfig]);
        setHistoryIndex(0);
        setSelectedItemId(null);
    };

    const addText = () => {
        const newId = Date.now();
        const newText: TextConfig = {
            id: newId, content: 'NHẬP CHỮ...', font: 'Montserrat', size: 24, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, textAlign: 'center', width: 40
        };
        setConfigWithHistory(prev => ({ ...prev, texts: [...prev.texts, newText] }));
        setSelectedItemId(`text-${newId}`);
    };

    const addShape = (type: 'rect' | 'circle') => {
        const newId = Date.now();
        const newShape: ShapeConfig = {
            id: newId, type, x: 50, y: 50, width: 20, height: 20, rotation: 0, strokeColor: '#000000', strokeWidth: 2, strokeType: 'solid', borderRadius: type === 'circle' ? 100 : 0
        };
        setConfigWithHistory(prev => ({ ...prev, shapes: [...(prev.shapes || []), newShape] }));
        setSelectedItemId(`shape-${newId}`);
    };

    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            const url = await uploadFile(e.target.files[0]);
            if (url) {
                const asset = await addAsset(url, 'sticker');
                if (asset) setSavedAssets(prev => [asset, ...prev]);
            }
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl overflow-hidden shadow-sm font-sans border border-gray-200">
            {/* Sidebar Tools */}
            <div className="w-16 sm:w-20 bg-gray-900 flex flex-col items-center py-6 gap-6 z-20">
                {TOOLS.map(tool => (
                    <button 
                        key={tool.id} 
                        onClick={() => setActiveTool(tool.id)}
                        className={`group relative flex flex-col items-center gap-1 transition-all ${activeTool === tool.id ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeTool === tool.id ? 'bg-primary/20 scale-110' : 'group-hover:bg-gray-800'}`}>
                            <span className="text-xl">{tool.icon}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{tool.label}</span>
                    </button>
                ))}
                <div className="mt-auto border-t border-gray-800 w-full pt-6 flex flex-col items-center gap-4">
                    <button onClick={handleUndo} disabled={historyIndex === 0} className="text-gray-500 hover:text-white disabled:opacity-20"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                    <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                </div>
            </div>

            {/* Asset Panel */}
            <div className="w-64 sm:w-80 bg-white border-r border-gray-200 flex flex-col z-10">
                <div className="p-4 border-b border-gray-100 font-bold text-sm uppercase tracking-widest text-gray-400">
                    {TOOLS.find(t => t.id === activeTool)?.label} Studio
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {activeTool === 'templates' && (
                        <div className="grid grid-cols-2 gap-3">
                            {existingBackgrounds.map(bg => (
                                <button key={bg.id} onClick={() => loadTemplate(bg)} className="group relative aspect-[3/4] rounded-lg border border-gray-100 overflow-hidden hover:border-primary transition-all">
                                    <img src={bg.previewUrl || bg.url} className="w-full h-full object-cover" alt={bg.name} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">Sửa mẫu</span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-1 text-[8px] font-bold text-center truncate">{bg.name}</div>
                                </button>
                            ))}
                            <button onClick={() => { setConfig(INITIAL_FRAME_CONFIG); setEditingBgId(null); setBgName(''); setHistory([INITIAL_FRAME_CONFIG]); setHistoryIndex(0); }} className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:bg-gray-50 hover:border-gray-300">
                                <span className="text-2xl">+</span>
                                <span className="text-[10px] font-bold uppercase">Mẫu mới</span>
                            </button>
                        </div>
                    )}

                    {activeTool === 'background' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-2">
                                {['#ffffff', '#f8f9fa', '#fce4ec', '#fff9c4', '#e1f5fe', '#e8f5e9', '#333333'].map(c => (
                                    <button key={c} onClick={() => setConfigWithHistory(prev => ({ ...prev, background: { type: 'color', value: c } }))} className="w-full aspect-square rounded border" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {existingBackgrounds.filter(bg => !bg.url.startsWith('#')).map(bg => (
                                    <button key={bg.id} onClick={() => setConfigWithHistory(prev => ({ ...prev, background: { type: 'image', value: bg.url } }))} className="aspect-square rounded border overflow-hidden">
                                        <img src={bg.url} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTool === 'shape' && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => addShape('rect')} className="p-4 rounded-xl border border-gray-200 flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors">
                                <div className="w-12 h-8 border-2 border-gray-800 rounded-sm"></div>
                                <span className="text-xs font-bold uppercase">Hình chữ nhật</span>
                            </button>
                            <button onClick={() => addShape('circle')} className="p-4 rounded-xl border border-gray-200 flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors">
                                <div className="w-10 h-10 border-2 border-gray-800 rounded-full"></div>
                                <span className="text-xs font-bold uppercase">Hình tròn</span>
                            </button>
                        </div>
                    )}

                    {activeTool === 'text' && (
                        <button onClick={addText} className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold uppercase text-xs tracking-widest hover:bg-black transition-all">+ Thêm văn bản</button>
                    )}

                    {activeTool === 'upload' && (
                        <div className="space-y-6">
                            <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-xs uppercase hover:bg-gray-50">+ Tải Sticker lên</button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAssetUpload} />
                            <div className="grid grid-cols-3 gap-2">
                                {savedAssets.map(asset => (
                                    <div key={asset.id} className="relative group aspect-square rounded border overflow-hidden bg-gray-50">
                                        <img src={asset.url} className="w-full h-full object-contain p-1" />
                                        <button onClick={() => setConfigWithHistory(prev => ({ ...prev, draggableItems: [...prev.draggableItems, { id: Date.now(), partId: asset.url, type: 'charm', x: 50, y: 50, rotation: 0, scale: 0.5 }] }))} className="absolute inset-0 bg-blue-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[20px] text-white">+</span>
                                        </button>
                                        <button onClick={async () => { if(confirm("Xóa sticker?")) { await deleteAsset(asset.id); setSavedAssets(prev => prev.filter(a => a.id !== asset.id)); } }} className="absolute top-0 right-0 p-0.5 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-grow flex flex-col bg-gray-200 relative overflow-hidden">
                <div className="flex-grow flex items-center justify-center p-12 transition-all duration-300" style={{ transform: `scale(${zoom})` }}>
                    <div ref={frameCaptureRef} className="relative shadow-2xl">
                        <FramePreview 
                            config={config} 
                            containerWidth={500} 
                            onItemTransform={(id, transform) => setConfigWithHistory(prev => {
                                const [type, idStr] = id.split('-');
                                const numericId = parseInt(idStr);
                                if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, ...transform } : t) };
                                if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? { ...s, ...transform } : s) };
                                if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...transform } : i) };
                                return prev;
                            })}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={(id, updates) => setConfigWithHistory(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }))}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            isInteractive={true}
                            setIsEditingText={() => {}}
                            allParts={{}}
                            logoUrl={undefined}
                            previewFont={previewFont}
                            onAlign={(type) => {
                                if (!selectedItemId) return;
                                setConfigWithHistory(prev => {
                                    const [itemType, idStr] = selectedItemId.split('-');
                                    const id = parseInt(idStr);
                                    let updates = {};
                                    if (type === 'center') updates = { x: 50, y: 50 };
                                    else if (type === 'horizontal') updates = { x: 50 };
                                    else if (type === 'vertical') updates = { y: 50 };

                                    if (itemType === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) };
                                    if (itemType === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s) };
                                    if (itemType === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? { ...i, ...updates } : i) };
                                    return prev;
                                });
                            }}
                        />
                    </div>
                </div>

                {/* Status Bar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-gray-100 flex items-center gap-6 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors font-bold">-</button>
                        <span className="text-xs font-black w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors font-bold">+</button>
                    </div>
                    <div className="w-px h-6 bg-gray-200"></div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowSaveModal(true)} className="bg-primary text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-md hover:brightness-105 transition-all">Lưu mẫu thiết kế</button>
                    </div>
                </div>
            </div>

            {/* Properties Panel (Right) */}
            <div className="w-72 sm:w-80 bg-white border-l border-gray-200 p-6 z-10 overflow-y-auto custom-scrollbar">
                {selectedItemId ? (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                            <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Tùy chỉnh</h3>
                            <button onClick={() => setSelectedItemId(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Đóng</button>
                        </div>

                        {selectedItemId.startsWith('text-') && (
                            <div className="space-y-6">
                                {(() => {
                                    const id = parseInt(selectedItemId.split('-')[1]);
                                    const text = config.texts.find(t => t.id === id);
                                    if (!text) return null;
                                    const updateText = (updates: Partial<TextConfig>) => setConfigWithHistory(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) }));
                                    
                                    return (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nội dung</label>
                                                <textarea value={text.content} onChange={e => updateText({ content: e.target.value })} className="w-full p-3 border rounded-xl text-sm focus:border-primary outline-none min-h-[100px]" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phông chữ</label>
                                                <FontSelector value={text.font} onChange={font => updateText({ font })} onPreview={setPreviewFont} uploadedFonts={uploadedFonts} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cỡ chữ</label>
                                                    <input type="number" value={text.size} onChange={e => updateText({ size: parseInt(e.target.value) })} className="w-full p-2.5 border rounded-xl text-sm" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Màu sắc</label>
                                                    <input type="color" value={text.color} onChange={e => updateText({ color: e.target.value })} className="w-full h-10 p-1 border rounded-xl cursor-pointer" />
                                                </div>
                                            </div>
                                            <div className="space-y-4 pt-4 border-t border-gray-50">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-600">Khóa vị trí</span>
                                                    <input type="checkbox" checked={text.lockedPosition || false} onChange={e => updateText({ lockedPosition: e.target.checked })} className="w-5 h-5 accent-primary" />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-600">Khóa nội dung</span>
                                                    <input type="checkbox" checked={text.lockedContent || false} onChange={e => updateText({ lockedContent: e.target.checked })} className="w-5 h-5 accent-primary" />
                                                </div>
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        )}

                        {selectedItemId.startsWith('shape-') && (
                            <div className="space-y-6">
                                {(() => {
                                    const id = parseInt(selectedItemId.split('-')[1]);
                                    const shape = config.shapes?.find(s => s.id === id);
                                    if (!shape) return null;
                                    const updateShape = (updates: Partial<ShapeConfig>) => setConfigWithHistory(prev => ({ ...prev, shapes: prev.shapes.map(s => s.id === id ? { ...s, ...updates } : s) }));

                                    return (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Màu đường viền</label>
                                                    <input type="color" value={shape.strokeColor} onChange={e => updateShape({ strokeColor: e.target.value })} className="w-full h-10 p-1 border rounded-xl" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Màu tô (Fill)</label>
                                                    <input type="color" value={shape.fillColor || '#ffffff'} onChange={e => updateShape({ fillColor: e.target.value })} className="w-full h-10 p-1 border rounded-xl" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Độ dày viền ({shape.strokeWidth}px)</label>
                                                <input type="range" min="0" max="20" value={shape.strokeWidth} onChange={e => updateShape({ strokeWidth: parseInt(e.target.value) })} className="w-full accent-primary" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bo góc ({shape.borderRadius}px)</label>
                                                <input type="range" min="0" max="100" value={shape.borderRadius} onChange={e => updateShape({ borderRadius: parseInt(e.target.value) })} className="w-full accent-primary" />
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                                <span className="text-xs font-bold text-gray-600">Khóa vị trí</span>
                                                <input type="checkbox" checked={shape.lockedPosition || false} onChange={e => updateShape({ lockedPosition: e.target.checked })} className="w-5 h-5 accent-primary" />
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        )}
                        
                        {selectedItemId.startsWith('item-') && (
                            <div className="space-y-6">
                                {(() => {
                                    const id = parseInt(selectedItemId.split('-')[1]);
                                    const item = config.draggableItems.find(i => i.id === id);
                                    if (!item) return null;
                                    const updateItem = (updates: Partial<DraggableItem>) => setConfigWithHistory(prev => ({ ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? { ...i, ...updates } : i) }));

                                    return (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cắt theo hình (Mask)</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {(['none', 'circle', 'rounded', 'heart', 'star'] as const).map(shape => (
                                                        <button 
                                                            key={shape} 
                                                            onClick={() => updateItem({ maskShape: shape })}
                                                            className={`py-2 border rounded-lg text-[8px] font-black uppercase transition-all ${item.maskShape === shape ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-500'}`}
                                                        >
                                                            {shape}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                                <span className="text-xs font-bold text-gray-600">Khóa vị trí</span>
                                                <input type="checkbox" checked={item.lockedPosition || false} onChange={e => updateItem({ lockedPosition: e.target.checked })} className="w-5 h-5 accent-primary" />
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                        <div className="text-5xl">🖱️</div>
                        <div className="space-y-1">
                            <p className="font-bold text-sm uppercase tracking-widest">Studio Design</p>
                            <p className="text-[10px] font-medium max-w-[200px]">Chọn một thành phần trên khung tranh để bắt đầu tùy chỉnh.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white">
                        <div className="p-8 sm:p-12 space-y-8">
                            <div className="text-center space-y-2">
                                <h3 className="text-3xl font-heading font-bold text-gray-900 italic">Xác nhận Lưu Mẫu</h3>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">THIẾT LẬP THÔNG TIN HIỂN THỊ CHO KHÁCH HÀNG</p>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tên mẫu thiết kế</label>
                                    <input value={bgName} onChange={e => setBgName(e.target.value)} className="w-full p-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 focus:bg-white focus:border-primary outline-none text-sm font-bold shadow-inner" placeholder="VD: Kỷ niệm 1 năm..." />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dịp (Danh mục)</label>
                                        <select value={bgCategory} onChange={e => setBgCategory(e.target.value)} className="w-full p-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 focus:bg-white focus:border-primary outline-none text-sm font-bold shadow-inner appearance-none">
                                            {BG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kích thước áp dụng</label>
                                        <select value={bgType} onChange={e => setBgType(e.target.value as any)} className="w-full p-4 border border-gray-100 rounded-[1.5rem] bg-gray-50 focus:bg-white focus:border-primary outline-none text-sm font-bold shadow-inner appearance-none">
                                            <option value="square">Vuông (Mặc định)</option>
                                            <option value="rectangle">Chữ nhật (A5)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-5 rounded-[1.5rem] border border-gray-100 text-gray-400 font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all">Hủy</button>
                                <button onClick={handleSaveTemplate} disabled={isSaving} className="flex-[2] py-5 rounded-[1.5rem] bg-gray-900 text-white font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                                    {isSaving ? 'ĐANG XỬ LÝ...' : (editingBgId ? 'CẬP NHẬT MẪU' : 'LƯU MẪU MỚI')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
