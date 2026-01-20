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

const TOOLS = [
    { id: 'templates', icon: '📂', label: 'Mẫu' }, 
    { id: 'background', icon: '🎨', label: 'Nền' },
    { id: 'shape', icon: '🟥', label: 'Khối' },
    { id: 'text', icon: 'abc', label: 'Chữ' },
    { id: 'upload', icon: '☁️', label: 'Upload' },
    { id: 'form', icon: '📝', label: 'Form' }, 
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const QUICK_COLORS = ['#333333', '#ffffff', '#efa3b5', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];

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
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white flex justify-between items-center shadow-sm">
                <span className="truncate font-medium" style={{ fontFamily: value }}>{value}</span>
                <span className="text-[10px]">▼</span>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto">
                    <input className="w-full p-2 text-xs border-b outline-none" placeholder="Tìm font..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClick={e => e.stopPropagation()} />
                    {filteredGroups.map(group => (
                        <div key={group.label}>
                            <div className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase bg-gray-50">{group.label}</div>
                            {group.fonts.map(font => (
                                <div key={font} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" style={{ fontFamily: font }} onClick={() => { onChange(font); setIsOpen(false); }}>{font}</div>
                            ))}
                        </div>
                    ))}
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
    const [zoom, setZoom] = useState(1);
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const previewRef = useRef<HTMLDivElement>(null);

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

    // Fix: Implemented handleItemTransform to handle dragging and resizing of elements in AdminDesign
    const handleItemTransform = useCallback((id: string, nTransform: any) => {
        const [type, ...rest] = id.split('-');
        const rawId = rest.join('-');
        const itemId = parseInt(rawId);
        
        setConfigWithHistory((prev: FrameConfig) => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            }
            if (type === 'character') return { ...prev, characters: prev.characters.map((item: any) => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map((item: any) => item.id === itemId ? { ...item, ...nTransform } : item) };
            if (type === 'shape') {
                return { ...prev, shapes: (prev.shapes || []).map(item => item.id === itemId ? { ...item, ...nTransform } : item) };
            }
            return prev;
        });
    }, [setConfigWithHistory]);

    // Fix: Implemented handleItemRemove to allow deleting objects in AdminDesign
    const handleItemRemove = useCallback((id: string) => {
        const [type, ...rest] = id.split('-');
        const rawId = rest.join('-');
        const itemId = parseInt(rawId);
        setSelectedItemId(null);
        setConfigWithHistory((prev: FrameConfig) => {
            if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== itemId) };
            if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== itemId) };
            if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== itemId) };
            return prev;
        });
    }, [setConfigWithHistory]);

    // Fix: Implemented handleTextUpdate to handle text content and formatting changes in AdminDesign
    const handleTextUpdate = useCallback((id: number, updates: Partial<TextConfig>) => {
        setConfigWithHistory((prev: FrameConfig) => ({
            ...prev,
            texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t)
        }));
    }, [setConfigWithHistory]);

    const selectedObject = useMemo(() => {
        if (!selectedItemId) return null;
        const [type, idStr] = selectedItemId.split('-');
        const id = parseInt(idStr);
        if (type === 'text') return config.texts.find(t => t.id === id);
        if (type === 'item') return config.draggableItems.find(i => i.id === id);
        if (type === 'shape') return config.shapes?.find(s => s.id === id);
        return null;
    }, [selectedItemId, config]);

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl overflow-hidden border shadow-lg relative">
            {/* TOOLBAR LEFT */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button key={tool.id} onClick={() => { setActiveTool(tool.id); setSelectedItemId(null); }} className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition-all ${activeTool === tool.id ? 'bg-white text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                        <span className="text-xl">{tool.icon}</span>
                        <span className="text-[9px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* PROPERTY PANEL */}
            <div className="w-80 bg-white border-r flex flex-col z-10">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest">{selectedObject ? 'Thuộc tính' : TOOLS.find(t => t.id === activeTool)?.label}</h3>
                    {selectedObject && <button onClick={() => setSelectedItemId(null)} className="text-[10px] bg-gray-200 px-2 py-1 rounded font-bold">X</button>}
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {selectedObject ? (
                        <div className="space-y-6">
                            {/* ALT TEXT - AI FEATURE */}
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2">Alt Text / Mô tả (AI)</label>
                                <textarea 
                                    className="w-full p-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500" 
                                    rows={2} 
                                    // @ts-ignore
                                    value={selectedObject.altText || ''} 
                                    onChange={e => updateSelected({ altText: e.target.value })}
                                    placeholder="Mô tả nội dung cho AI nhận diện..."
                                />
                            </div>

                            {/* TEXT SPECIFIC CONTROLS */}
                            {selectedItemId?.startsWith('text-') && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                                        <label className="block text-[10px] font-black text-orange-700 uppercase tracking-tight mb-2">🔗 KẾT NỐI DỮ LIỆU BƯỚC 2</label>
                                        <select 
                                            className="w-full p-2 border rounded-lg text-xs font-bold bg-white" 
                                            value={(selectedObject as TextConfig).linkedFieldId || ''} 
                                            onChange={e => updateSelected({ linkedFieldId: e.target.value })}
                                        >
                                            <option value="">-- Không kết nối --</option>
                                            {(config.formFields || []).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                        </select>
                                        <p className="text-[9px] text-orange-600 mt-2 italic">* Khi khách nhập ô này ở Bước 2, nội dung chữ sẽ tự nhảy theo.</p>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">Font chữ</label>
                                            <button onClick={() => updateSelected({ font: 'Montserrat' })} className="text-[9px] font-black text-blue-600 hover:underline uppercase">Reset Font</button>
                                        </div>
                                        <FontSelector value={(selectedObject as TextConfig).font} onChange={f => updateSelected({ font: f })} onPreview={() => {}} uploadedFonts={uploadedFonts} />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nội dung mặc định</label>
                                        <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={(selectedObject as TextConfig).content} onChange={e => updateSelected({ content: e.target.value })} />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="number" className="p-2 border rounded text-sm" value={(selectedObject as TextConfig).size} onChange={e => updateSelected({ size: Number(e.target.value) })} />
                                        <input type="color" className="w-full h-10 border rounded" value={(selectedObject as TextConfig).color} onChange={e => updateSelected({ color: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            <button onClick={() => setConfigWithHistory(prev => {
                                const [type, idStr] = selectedItemId!.split('-');
                                const id = parseInt(idStr);
                                if (type === 'text') return { ...prev, texts: prev.texts.filter(t => t.id !== id) };
                                if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.filter(i => i.id !== id) };
                                if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== id) };
                                return prev;
                            })} className="w-full py-2 bg-red-50 text-red-600 rounded-lg font-bold text-xs">Xóa đối tượng</button>
                        </div>
                    ) : (
                        <>
                            {activeTool === 'form' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase">Danh sách ô nhập liệu</h4>
                                        <button onClick={() => setConfigWithHistory(prev => ({ ...prev, formFields: [...(prev.formFields || []), { id: `f_${Date.now()}`, label: 'Trường mới', type: 'text', required: false }] }))} className="bg-blue-600 text-white w-6 h-6 rounded-full">+</button>
                                    </div>
                                    <div className="space-y-3">
                                        {(config.formFields || []).map((f, i) => (
                                            <div key={f.id} className="p-3 bg-gray-50 border rounded-xl relative group">
                                                <button onClick={() => setConfigWithHistory(prev => ({ ...prev, formFields: (prev.formFields || []).filter(field => field.id !== f.id) }))} className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100">×</button>
                                                <input className="w-full p-1.5 border rounded text-xs mb-2" value={f.label} onChange={e => setConfigWithHistory(prev => ({ ...prev, formFields: (prev.formFields || []).map(field => field.id === f.id ? { ...field, label: e.target.value } : field) }))} />
                                                <select className="w-full p-1 text-[10px] border rounded" value={f.type} onChange={e => setConfigWithHistory(prev => ({ ...prev, formFields: (prev.formFields || []).map(field => field.id === f.id ? { ...field, type: e.target.value as any } : field) }))}>
                                                    <option value="text">Chữ ngắn</option>
                                                    <option value="textarea">Chữ dài</option>
                                                    <option value="date">Ngày tháng</option>
                                                    <option value="image">Ảnh</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeTool === 'templates' && (
                                <div className="space-y-2">
                                    {existingBackgrounds.map(bg => (
                                        <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className="flex items-center gap-2 p-2 border rounded hover:bg-blue-50 cursor-pointer">
                                            <img src={bg.previewUrl || bg.url} className="w-10 h-10 object-cover rounded" />
                                            <span className="text-xs font-bold truncate">{bg.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* CANVAS MAIN */}
            <div className="flex-grow flex flex-col bg-[#f0f0f0] overflow-hidden">
                <div className="h-14 bg-white border-b flex items-center justify-between px-6">
                    <div className="flex gap-4">
                        <select className="border p-1 text-sm rounded font-bold" value={config.frameId} onChange={e => setConfigWithHistory(prev => ({ ...prev, frameId: e.target.value }))}>
                            {frames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowSaveModal(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-black">CẬP NHẬT MẪU</button>
                    </div>
                </div>

                <div className="flex-grow relative flex items-center justify-center p-8">
                    <div style={{ transform: `scale(${zoom})` }} className="bg-white shadow-2xl transition-transform duration-300">
                        <FramePreview 
                            ref={previewRef} config={config} containerWidth={500} onItemTransform={handleItemTransform} 
                            onItemRemove={handleItemRemove} onTextUpdate={handleTextUpdate} isInteractive={true} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} setIsEditingText={() => {}} allParts={{}} 
                        />
                    </div>
                </div>
            </div>

            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-3xl w-full max-w-md">
                        <h3 className="text-xl font-bold mb-6">Lưu mẫu thiết kế</h3>
                        <input className="w-full p-3 border rounded-xl mb-4" placeholder="Tên mẫu..." value={bgName} onChange={e => setBgName(e.target.value)} />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 font-bold text-gray-500">Hủy</button>
                            <button onClick={async () => {
                                const backgroundData: PresetBackground = {
                                    id: editingBgId || `bg_${Date.now()}`,
                                    name: bgName, category: bgCategory, type: bgType, url: config.background.value,
                                    overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes },
                                    formFields: config.formFields || []
                                };
                                const success = editingBgId ? await updateBackground(editingBgId, backgroundData) : await addBackground(backgroundData);
                                if (success) { alert("Thành công!"); setShowSaveModal(false); }
                            }} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Xác nhận Lưu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};