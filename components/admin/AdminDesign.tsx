
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, FormField, LegoPart, LegoCharacterConfig } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG, LEGO_PARTS } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';
import { dataURLToBlob } from '../../utils/helpers';
import { getAllParts } from '../../services/productService';

declare var html2canvas: any;

const TOOLS = [
    { id: 'templates', icon: '📂', label: 'Mẫu' }, 
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'shape', icon: '🟥', label: 'Khối' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'form', icon: '📝', label: 'Form' }, 
    { id: 'layers', icon: '📚', label: 'Lớp' },
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
    const [activeTool, setActiveTool] = useState('templates');
    const [config, setConfig] = useState<FrameConfig>(INITIAL_FRAME_CONFIG);
    const [frames, setFrames] = useState<FrameOption[]>(FRAME_OPTIONS);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [existingBackgrounds, setExistingBackgrounds] = useState<PresetBackground[]>([]);
    const [history, setHistory] = useState<FrameConfig[]>([INITIAL_FRAME_CONFIG]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const categories = useMemo(() => {
        const uniqueCats = Array.from(new Set(existingBackgrounds.map(bg => bg.category)));
        if (!uniqueCats.includes('Tình yêu')) uniqueCats.unshift('Tình yêu');
        if (!uniqueCats.includes('Sinh nhật')) uniqueCats.push('Sinh nhật');
        if (!uniqueCats.includes('Khác')) uniqueCats.push('Khác');
        return uniqueCats;
    }, [existingBackgrounds]);

    useEffect(() => {
        if (uploadedFonts.length > 0) {
            const styleId = 'admin-design-custom-fonts';
            let style = document.getElementById(styleId) as HTMLStyleElement;
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            let css = '';
            uploadedFonts.forEach(font => {
                const safeName = font.name.replace(/[^a-zA-Z0-9\s-]/g, '');
                css += `@font-face { font-family: '${safeName}'; src: url('${font.url}'); font-weight: normal; font-style: normal; font-display: swap; }`;
            });
            style.innerHTML = css;
        }
    }, [uploadedFonts]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, productsData] = await Promise.all([
                getAllFrames(), getStoreConfig(), getAllBackgrounds(), getAllParts()
            ]);
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
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

    const setConfigWithHistory = useCallback((newConfigOrFn: FrameConfig | ((prev: FrameConfig) => FrameConfig)) => {
        setConfig(prev => {
            const newConfig = typeof newConfigOrFn === 'function' ? newConfigOrFn(prev) : newConfigOrFn;
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(newConfig);
            if (newHistory.length > 30) newHistory.shift();
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            return newConfig;
        });
    }, [history, historyIndex]);

    const updateSelected = (updates: any) => {
        if (!selectedItemId) return;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        setConfigWithHistory(prev => {
            if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === id ? { ...i, ...updates } : i) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s) };
            if (type === 'character') return { ...prev, characters: prev.characters.map(c => c.id === id ? { ...c, ...updates } : c) };
            return prev;
        });
    };

    const handleLoadTemplate = (bg: PresetBackground) => {
        setEditingBgId(bg.id);
        setBgName(bg.name);
        setBgCategory(bg.category);
        setBgType(bg.type);
        setConfigWithHistory({
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
        setConfigWithHistory((prev: FrameConfig) => {
            if (type === 'text') return { ...prev, texts: prev.texts.map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map((item: any) => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'character') return { ...prev, characters: prev.characters.map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            return prev;
        });
    }, [setConfigWithHistory]);

    const handleItemRemove = useCallback((id: string) => {
        const [type, ...rest] = id.split('-');
        const rawId = rest.join('-');
        const itemId = parseInt(rawId);
        setSelectedItemId(null);
        setConfigWithHistory((prev: FrameConfig) => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== itemId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== itemId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== itemId) };
            if (type === 'character') return { ...prev, characters: prev.characters.filter(c => c.id !== itemId) };
            return prev;
        });
    }, [setConfigWithHistory]);

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
                    {selectedObject && <button onClick={() => setSelectedItemId(null)} className="text-[10px] bg-gray-200 px-2 py-1 rounded font-bold hover:bg-gray-300">Đóng X</button>}
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {selectedObject ? (
                        <div className="space-y-6 animate-fade-in">
                            {/* Khóa Vị Trí - Dùng cho mọi đối tượng */}
                            <div className="p-3 bg-gray-50 border rounded-xl flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">🔒 Khóa vị trí</label>
                                <button 
                                    onClick={() => updateSelected({ lockedPosition: !(selectedObject as any).lockedPosition })}
                                    className={`w-10 h-5 rounded-full p-1 transition-all ${(selectedObject as any).lockedPosition ? 'bg-red-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${(selectedObject as any).lockedPosition ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>

                            {selectedItemId?.startsWith('text-') && (
                                <div className="space-y-5">
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
                                        <label className="text-[10px] font-black text-red-700 uppercase tracking-widest">🚫 Khóa sửa chữ</label>
                                        <button 
                                            onClick={() => updateSelected({ lockedContent: !(selectedObject as any).lockedContent })}
                                            className={`w-10 h-5 rounded-full p-1 transition-all ${(selectedObject as any).lockedContent ? 'bg-red-600' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${(selectedObject as any).lockedContent ? 'translate-x-5' : ''}`}></div>
                                        </button>
                                    </div>
                                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl shadow-sm">
                                        <label className="block text-[10px] font-black text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-1"><span>🔗</span> KẾT NỐI FORM BƯỚC 2</label>
                                        <select className="w-full p-2.5 border border-orange-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-orange-400" value={(selectedObject as TextConfig).linkedFieldId || ''} onChange={e => updateSelected({ linkedFieldId: e.target.value })}>
                                            <option value="">-- Không kết nối --</option>
                                            {(config.formFields || []).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Phông chữ</label>
                                        <FontSelector value={(selectedObject as TextConfig).font} onChange={f => updateSelected({ font: f })} onPreview={setPreviewFont} uploadedFonts={uploadedFonts} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Cỡ chữ</label><input type="number" className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold" value={(selectedObject as TextConfig).size} onChange={e => updateSelected({ size: Number(e.target.value) })} /></div>
                                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Màu sắc</label><input type="color" className="w-full h-9 border border-gray-200 rounded-lg cursor-pointer" value={(selectedObject as TextConfig).color} onChange={e => updateSelected({ color: e.target.value })} /></div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Độ rộng khối (% khung)</label>
                                            <span className="text-[10px] font-bold text-blue-600">{(selectedObject as TextConfig).width || 30}%</span>
                                        </div>
                                        <input type="range" min="10" max="100" className="w-full accent-blue-600" value={(selectedObject as TextConfig).width || 30} onChange={e => updateSelected({ width: Number(e.target.value) })} />
                                        <p className="text-[9px] text-gray-400 italic mt-1">* Chữ sẽ tự động xuống dòng khi đạt giới hạn này.</p>
                                    </div>
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        {(['left', 'center', 'right'] as const).map(align => (
                                            <button key={align} onClick={() => updateSelected({ textAlign: align })} className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${(selectedObject as TextConfig).textAlign === align ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>{align}</button>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nội dung mẫu</label>
                                        <textarea className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={2} value={(selectedObject as TextConfig).content} onChange={e => updateSelected({ content: e.target.value })} />
                                    </div>
                                </div>
                            )}
                            <div className="pt-4 border-t border-gray-100"><button onClick={() => handleItemRemove(selectedItemId!)} className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors">🗑️ Xóa đối tượng</button></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeTool === 'text' && (
                                <button onClick={() => {
                                    const id = Date.now();
                                    setConfigWithHistory(prev => ({ ...prev, texts: [...prev.texts, { id, content: 'Chữ mới', font: 'Montserrat', size: 14, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, textAlign: 'center', width: 40 }] }));
                                    setSelectedItemId(`text-${id}`);
                                }} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-xs font-black text-gray-400 hover:bg-gray-50 transition-all uppercase">+ Thêm văn bản</button>
                            )}
                            {activeTool === 'templates' && (
                                <div className="grid grid-cols-1 gap-2">
                                    {existingBackgrounds.map(bg => (
                                        <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className={`flex items-center gap-3 p-2 border rounded-xl hover:shadow-md transition-all cursor-pointer ${editingBgId === bg.id ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}>
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0"><img src={bg.previewUrl || bg.url} className="w-full h-full object-cover" /></div>
                                            <div className="min-w-0 flex-grow"><p className="text-xs font-black text-gray-800 truncate">{bg.name}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{bg.category}</p></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-grow flex flex-col bg-[#f5f6f7] overflow-hidden" onMouseDown={() => setSelectedItemId(null)}>
                <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30 shadow-sm" onMouseDown={e => e.stopPropagation()}>
                    <div className="flex items-center gap-6">
                        <select className="border-0 p-0 text-sm rounded font-black text-gray-900 bg-transparent focus:ring-0 outline-none cursor-pointer" value={config.frameId} onChange={e => setConfigWithHistory(prev => ({ ...prev, frameId: e.target.value }))}>
                            {frames.map(f => <option key={f.id} value={f.id}>{f.name} (Tồn: {f.stock})</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                            <input type="range" min="0.2" max="2" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-24 accent-gray-900" />
                        </div>
                    </div>
                    <button onClick={() => setShowSaveModal(true)} className="px-8 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">
                        {editingBgId ? 'Cập nhật mẫu' : 'Lưu mẫu mới'}
                    </button>
                </div>

                <div className="flex-grow relative flex items-center justify-center p-8 overflow-auto custom-scrollbar">
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="bg-white shadow-2xl transition-transform duration-300 ring-1 ring-gray-200">
                        <FramePreview ref={previewRef} config={config} containerWidth={500} onItemTransform={handleItemTransform} onItemRemove={handleItemRemove} onTextUpdate={() => {}} isInteractive={true} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} setIsEditingText={() => {}} allParts={allKnownParts} previewFont={previewFont} allowTextScaling />
                    </div>
                </div>
            </div>

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSaveModal(false)}>
                    <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-black mb-6 text-gray-900 uppercase tracking-tighter">Xác nhận Lưu Mẫu</h3>
                        <div className="space-y-5 text-left">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tên mẫu thiết kế</label>
                                <input className="w-full p-3.5 border border-gray-200 rounded-2xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all" value={bgName} onChange={e => setBgName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Danh mục</label>
                                    <select className="w-full p-3 border border-gray-200 rounded-2xl bg-gray-50 font-bold" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Loại khung</label>
                                    <select className="w-full p-3 border border-gray-200 rounded-2xl bg-gray-50 font-bold" value={bgType} onChange={e => setBgType(e.target.value as any)}>
                                        <option value="square">Vuông</option>
                                        <option value="rectangle">Chữ nhật</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-10">
                            <button onClick={() => setShowSaveModal(false)} className="px-6 py-3 font-black text-gray-400 hover:text-gray-600 uppercase text-xs tracking-widest">Hủy</button>
                            <button onClick={async () => {
                                if (!bgName) return alert("Vui lòng nhập tên!");
                                const backgroundData: PresetBackground = {
                                    id: editingBgId || `bg_${Date.now()}`,
                                    name: bgName, category: bgCategory, type: bgType, url: config.background.value,
                                    overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes },
                                    formFields: config.formFields || []
                                };
                                const success = editingBgId ? await updateBackground(editingBgId, backgroundData) : await addBackground(backgroundData);
                                if (success) { alert("Lưu mẫu thành công!"); setShowSaveModal(false); }
                            }} className="px-10 py-3 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">Xác nhận Lưu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
