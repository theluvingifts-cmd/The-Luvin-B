
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, FormField, LegoPart, LegoCharacterConfig, OutfitColor } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG, LEGO_PARTS } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig } from '../../services/configService';
import { getAllParts } from '../../services/productService';

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
    const [history, setHistory] = useState<string[]>([JSON.stringify(INITIAL_FRAME_CONFIG)]);
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
    const [isUploading, setIsUploading] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const skipHistoryRef = useRef(false);

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

    // KEYBOARD SHORTCUTS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

            // Di chuyển bằng phím mũi tên
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedItemId && !isTyping) {
                if ((selectedObject as any)?.lockedPosition) return;
                e.preventDefault();
                const step = e.shiftKey ? 2.0 : 0.5; // Shift di chuyển xa hơn
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
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId && !isTyping) {
                e.preventDefault();
                handleItemRemove(selectedItemId);
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
    }, [selectedItemId, selectedObject, updateSelected, handleItemRemove, handleUndo, handleRedo]);

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

    const handleUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            const url = await uploadToCloudinary(e.target.files[0]);
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

                            {/* LIÊN KẾT FORM: HIỂN THỊ CHO TEXT VÀ STICKER */}
                            {(selectedItemId?.startsWith('text-') || (selectedItemId?.startsWith('item-') && (selectedObject as DraggableItem).type === 'charm')) && (
                                <div>
                                    <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">🔗 Liên kết Form {selectedItemId?.startsWith('text-') ? '(Nội dung)' : '(Hình ảnh)'}</label>
                                    <select 
                                        className="w-full p-2.5 border-2 border-blue-100 rounded-lg text-xs font-bold bg-blue-50 focus:border-blue-400 outline-none" 
                                        value={(selectedObject as any).linkedFieldId || ''} 
                                        onChange={e => updateSelected({ linkedFieldId: e.target.value })}
                                    >
                                        <option value="">-- Không kết nối --</option>
                                        {(config.formFields || [])
                                            .filter(f => selectedItemId?.startsWith('text-') ? f.type !== 'image' : f.type === 'image')
                                            .map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                    </select>
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

                            <button onClick={() => handleItemRemove(selectedItemId!)} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">🗑️ Xóa đối tượng</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeTool === 'templates' && (
                                <div className="grid grid-cols-1 gap-2">
                                    {existingBackgrounds.map(bg => (
                                        <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                            <img src={bg.previewUrl || bg.url} className="w-10 h-10 object-cover rounded" />
                                            <div className="min-w-0 flex-grow"><p className="text-xs font-bold truncate">{bg.name}</p></div>
                                        </div>
                                    ))}
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
                                                const url = await uploadToCloudinary(e.target.files[0]);
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
                                <button onClick={() => {
                                    const id = Date.now();
                                    setConfig(prev => ({ ...prev, texts: [...prev.texts, { id, content: 'Chữ mới', font: 'Montserrat', size: 14, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, textAlign: 'center', width: 40 }] }));
                                    setSelectedItemId(`text-${id}`);
                                }} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-xs font-black text-gray-400 hover:bg-gray-50 transition-all uppercase">+ Thêm văn bản</button>
                            )}
                            {activeTool === 'upload' && (
                                <div className="space-y-4">
                                    <div className="border-2 border-dashed border-gray-300 p-6 rounded-2xl text-center relative hover:bg-gray-50 transition-all">
                                        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadSticker} disabled={isUploading} />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isUploading ? 'ĐANG TẢI...' : '+ TẢI STICKER'}</p>
                                    </div>
                                </div>
                            )}
                            {activeTool === 'form' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh sách trường</h4>
                                        <button onClick={handleAddField} className="text-blue-600 font-bold text-xs">+ Thêm</button>
                                    </div>
                                    {(config.formFields || []).map((f) => (
                                        <div key={f.id} className="p-3 bg-gray-50 border rounded-xl space-y-2 relative group">
                                            <button onClick={() => removeField(f.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                            <input className="w-full p-1.5 border rounded text-xs font-bold" value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} placeholder="Tên trường..." />
                                            <div className="grid grid-cols-2 gap-2">
                                                <select className="p-1.5 border rounded text-[10px]" value={f.type} onChange={e => updateField(f.id, { type: e.target.value as any })}>
                                                    <option value="text">Chữ ngắn</option><option value="textarea">Chữ dài</option><option value="date">Ngày tháng</option><option value="image">Hình ảnh</option>
                                                </select>
                                                <label className="flex items-center gap-1 text-[10px] cursor-pointer font-bold text-gray-500 uppercase">
                                                    <input type="checkbox" checked={f.required} onChange={e => updateField(f.id, { required: e.target.checked })} /> Cần nhập
                                                </label>
                                            </div>
                                        </div>
                                    ))}
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
                        <FramePreview ref={previewRef} config={config} containerWidth={500} onItemTransform={handleItemTransform} onItemRemove={handleItemRemove} onTextUpdate={() => {}} isInteractive={true} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} setIsEditingText={() => {}} allParts={allKnownParts} previewFont={previewFont} allowTextScaling />
                    </div>
                </div>
            </div>

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSaveModal(false)}>
                    <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black mb-6 uppercase">Lưu thiết kế vào database</h3>
                        <div className="space-y-4">
                            <input className="w-full p-3 border rounded-xl font-bold" value={bgName} onChange={e => setBgName(e.target.value)} placeholder="Tên mẫu thiết kế..." />
                            <select className="w-full p-3 border rounded-xl font-bold" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowSaveModal(false)} className="px-6 py-3 font-bold text-gray-400 uppercase text-xs">Hủy</button>
                            <button onClick={async () => {
                                if (!bgName) return alert("Vui lòng nhập tên!");
                                const backgroundData: PresetBackground = {
                                    id: editingBgId || `bg_${Date.now()}`,
                                    name: bgName, category: bgCategory, type: bgType, url: config.background.value,
                                    overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes },
                                    formFields: config.formFields || []
                                };
                                const success = editingBgId ? await updateBackground(editingBgId, backgroundData) : await addBackground(backgroundData);
                                if (success) { alert("Đã lưu thiết kế thành công!"); setShowSaveModal(false); }
                            }} className="px-10 py-3 bg-gray-900 text-white rounded-xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all">Xác nhận Lưu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
