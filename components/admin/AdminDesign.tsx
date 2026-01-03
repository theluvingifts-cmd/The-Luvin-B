
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FrameConfig, TextConfig, DraggableItem, PresetBackground, FrameOption, CustomFont, SavedAsset, ShapeConfig, FormField } from '../../types';
import { FRAME_OPTIONS, INITIAL_FRAME_CONFIG } from '../../constants';
import FramePreview from '../FramePreview';
import { getAllFrames } from '../../services/frameService';
import { addBackground, updateBackground, getAllBackgrounds } from '../../services/backgroundService'; 
import { getAllAssets, addAsset, deleteAsset } from '../../services/assetService';
import { uploadToCloudinary } from '../../services/uploadService';
import { getStoreConfig, updateStoreConfig } from '../../services/configService';

declare var html2canvas: any;

// Defined Transform type used by handleItemTransform
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
    { id: 'form', icon: '📝', label: 'Form' }, // Tab quản lý ô nhập liệu
    { id: 'layers', icon: '📚', label: 'Lớp' },
];

const DEFAULT_FONTS = ['Playfair Display', 'Montserrat', 'Roboto', 'Open Sans', 'Merriweather', 'Dancing Script', 'Lora', 'Nunito', 'Pacifico'];
const BG_CATEGORIES = ['Tình yêu', 'Sinh nhật', 'Kỷ niệm', 'Gia đình', 'Giáng sinh', 'Doanh nghiệp', 'Khác'];

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
        { label: 'Cơ bản', fonts: DEFAULT_FONTS },
        { label: 'Tải lên', fonts: uploadedFonts.map(f => f.name) }
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
                    {groups.map((group) => group.fonts.length > 0 && (
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
    const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
    const [history, setHistory] = useState<FrameConfig[]>([INITIAL_FRAME_CONFIG]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [editingBgId, setEditingBgId] = useState<string | null>(null);
    const [bgName, setBgName] = useState('');
    const [bgCategory, setBgCategory] = useState('Tình yêu');
    const [bgType, setBgType] = useState<'square' | 'rectangle'>('square');
    const [existingPreviewUrl, setExistingPreviewUrl] = useState<string>('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
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

    const handleUndo = () => { if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); setConfig(history[newIndex]); } };
    const handleRedo = () => { if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); setConfig(history[newIndex]); } };

    useEffect(() => {
        const fetchInitialData = async () => {
            const [framesData, configData, bgData, assetsData] = await Promise.all([
                getAllFrames(), getStoreConfig(), getAllBackgrounds(), getAllAssets()
            ]);
            if (framesData.length > 0) setFrames(framesData);
            if (configData?.uploadedFonts) setUploadedFonts(configData.uploadedFonts);
            if (bgData) setExistingBackgrounds(bgData);
            if (assetsData) setSavedAssets(assetsData);
        };
        fetchInitialData();
    }, []);

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

    const handleFrameChange = (frameId: string) => {
        setConfigWithHistory(prev => ({ ...prev, frameId }));
        const frame = frames.find(f => f.id === frameId);
        if (frame) setBgType(Math.abs(frame.frameWidthCm - frame.frameHeightCm) > 1 ? 'rectangle' : 'square');
    };

    const handleBackgroundChange = (type: 'color' | 'image', value: string) => {
        setConfigWithHistory(prev => ({ ...prev, background: { type, value } }));
    };

    const handleLoadTemplate = (bg: PresetBackground) => {
        if (confirm("Tải mẫu này sẽ thay thế thiết kế hiện tại. Tiếp tục?")) {
            setEditingBgId(bg.id);
            setBgName(bg.name);
            setBgCategory(bg.category);
            setBgType(bg.type);
            setExistingPreviewUrl(bg.previewUrl || ''); 
            setConfigWithHistory({
                frameId: bg.type === 'rectangle' ? 'md' : 'lg',
                background: { type: bg.url.startsWith('#') ? 'color' : 'image', value: bg.url },
                texts: bg.overlayConfig?.texts || [],
                draggableItems: bg.overlayConfig?.draggableItems || [],
                shapes: bg.overlayConfig?.shapes || [],
                formFields: bg.formFields || [], // Load danh sách trường nhập liệu
                characters: []
            });
            setActiveTool('form');
        }
    };

    // Implemented missing handleUploadBackground function
    const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSaving(true);
            try {
                const url = await uploadToCloudinary(e.target.files[0]);
                if (url) {
                    if (activeTool === 'background') {
                        handleBackgroundChange('image', url);
                        await addAsset(url, 'background');
                    } else {
                        // Assuming upload tool handles stickers
                        const newItem: DraggableItem = {
                            id: Date.now(),
                            partId: url,
                            type: 'charm',
                            x: 50, y: 50, rotation: 0, scale: 0.5
                        };
                        setConfigWithHistory(prev => ({
                            ...prev,
                            draggableItems: [...prev.draggableItems, newItem]
                        }));
                        await addAsset(url, 'sticker');
                    }
                    const assets = await getAllAssets();
                    setSavedAssets(assets);
                }
            } catch (error) {
                console.error("Upload failed", error);
            } finally {
                setIsSaving(false);
            }
        }
    };

    // Implemented missing handleItemTransform function
    const handleItemTransform = (id: string, nTransform: Transform) => {
        const [type, idStr] = id.split('-');
        const numericId = parseInt(idStr);
        
        setConfigWithHistory(prev => {
            if (type === 'text') {
                return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, ...nTransform } : t) };
            }
            if (type === 'item') {
                return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...nTransform } : i) };
            }
            if (type === 'shape') {
                return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? { ...s, ...nTransform } : s) };
            }
            return prev;
        });
    };

    // QUẢN LÝ TRƯỜNG DỮ LIỆU (FORM)
    const handleAddField = () => {
        const newField: FormField = { id: `f_${Date.now()}`, label: 'Trường mới', type: 'text', required: false, placeholder: '' };
        setConfigWithHistory(prev => ({ ...prev, formFields: [...(prev.formFields || []), newField] }));
    };

    const handleUpdateField = (id: string, updates: Partial<FormField>) => {
        setConfigWithHistory(prev => ({ ...prev, formFields: (prev.formFields || []).map(f => f.id === id ? { ...f, ...updates } : f) }));
    };

    const handleRemoveField = (id: string) => {
        setConfigWithHistory(prev => ({ ...prev, formFields: (prev.formFields || []).filter(f => f.id !== id) }));
    };

    const handleLoadDefaultFields = () => {
        if (confirm("Thêm các trường mặc định (Tên, Ngày, Tin nhắn, Ảnh)?")) {
            const defaults: FormField[] = [
                { id: 'names', label: 'Tên / Lời tựa ngắn', type: 'text', required: true, placeholder: 'VD: Tú & Lan' },
                { id: 'date', label: 'Ngày kỷ niệm (nếu có)', type: 'date', required: false },
                { id: 'message', label: 'Thông điệp của bạn', type: 'textarea', required: false, placeholder: 'Nhập lời nhắn gửi...' },
                { id: 'photo', label: 'Đính kèm ảnh in thêm', type: 'image', required: false },
            ];
            setConfigWithHistory(prev => ({ ...prev, formFields: [...(prev.formFields || []), ...defaults] }));
        }
    };

    const handlePrepareSave = async () => {
        setIsSaving(true);
        const originalSelected = selectedItemId;
        setSelectedItemId(null); 
        try {
            await new Promise(resolve => setTimeout(resolve, 800)); 
            await document.fonts.ready;
            if (previewRef.current && typeof html2canvas !== 'undefined') {
                const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 2, backgroundColor: '#ffffff' });
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) { setGeneratedThumbnailBlob(blob); setGeneratedThumbnailUrl(URL.createObjectURL(blob)); }
            }
            setShowSaveModal(true);
        } catch (e) { setShowSaveModal(true); } finally { setIsSaving(false); setSelectedItemId(originalSelected); }
    };

    const handleConfirmSave = async () => {
        if (!bgName) return alert("Vui lòng nhập tên Mẫu nền");
        setIsSaving(true);
        try {
            let previewUrl = existingPreviewUrl || '';
            if (generatedThumbnailBlob) {
                const fileToUpload = new File([generatedThumbnailBlob], "thumbnail.png", { type: "image/png" });
                const uploaded = await uploadToCloudinary(fileToUpload);
                if (uploaded) previewUrl = uploaded;
                else throw new Error("Lỗi upload thumbnail.");
            }
            if (!previewUrl) throw new Error("Chưa có ảnh thumbnail.");

            const newBackground: PresetBackground = {
                id: editingBgId || `bg_${Date.now()}`,
                name: bgName,
                url: config.background.value,
                previewUrl: previewUrl, 
                category: bgCategory,
                type: bgType,
                orientation: 'portrait', 
                formFields: config.formFields || [], // LƯU CẤU HÌNH FORM VÀO ĐÂY
                overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes || [] }
            };

            let success = editingBgId ? await updateBackground(editingBgId, newBackground) : await addBackground(newBackground);
            if (success) {
                setExistingBackgrounds(prev => editingBgId ? prev.map(b => b.id === editingBgId ? newBackground : b) : [...prev, newBackground]);
                setShowSaveModal(false);
                alert("Đã lưu mẫu thành công!");
            }
        } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in relative">
            {/* Left Toolbar */}
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20">
                {TOOLS.map(tool => (
                    <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg transition-all ${activeTool === tool.id ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                        <span className="text-xl mb-1">{tool.icon}</span>
                        <span className="text-[10px] font-bold uppercase">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* Left Panel */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg uppercase tracking-tight text-sm">
                        {TOOLS.find(t => t.id === activeTool)?.label}
                    </h3>
                </div>
                <div className="flex-grow overflow-y-auto p-4">
                    {activeTool === 'templates' && (
                        <div className="space-y-4">
                            <button onClick={() => { setEditingBgId(null); setConfig(INITIAL_FRAME_CONFIG); }} className="w-full border-2 border-dashed border-gray-300 py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50">+ Thiết kế mới</button>
                            <div className="space-y-2">
                                {existingBackgrounds.map(bg => (
                                    <div key={bg.id} onClick={() => handleLoadTemplate(bg)} className={`flex items-center gap-3 p-2 rounded cursor-pointer border hover:shadow-sm transition-all ${editingBgId === bg.id ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
                                        <div className="w-10 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0 border">
                                            <img src={bg.previewUrl || bg.url} className="w-full h-full object-cover" alt={bg.name} />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs font-bold text-gray-800 truncate">{bg.name}</p>
                                            <p className="text-[10px] text-gray-400">{bg.category} • {bg.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTool === 'form' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                                <span className="text-[10px] font-bold text-blue-600 uppercase">Tùy chỉnh form khách nhập</span>
                                <div className="flex gap-2">
                                    <button onClick={handleLoadDefaultFields} className="text-[10px] font-bold text-gray-500 hover:underline">Mặc định</button>
                                    <button onClick={handleAddField} className="text-[10px] font-bold text-blue-700 hover:underline">+ Thêm ô</button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(config.formFields || []).map((field) => (
                                    <div key={field.id} className="p-3 bg-gray-50 border rounded-xl space-y-2 relative group">
                                        <button onClick={() => handleRemoveField(field.id)} className="absolute top-1 right-1 text-red-500 font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Tên trường (Label)</label>
                                            <input className="w-full p-1.5 border rounded text-xs" value={field.label} onChange={e => handleUpdateField(field.id, { label: e.target.value })} placeholder="VD: Tên của bạn..." />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Loại</label>
                                                <select className="w-full p-1.5 border rounded text-[10px] font-bold" value={field.type} onChange={e => handleUpdateField(field.id, { type: e.target.value as any })}>
                                                    <option value="text">Chữ ngắn</option>
                                                    <option value="textarea">Chữ dài</option>
                                                    <option value="date">Ngày</option>
                                                    <option value="image">Ảnh</option>
                                                </select>
                                            </div>
                                            <div className="flex items-end pb-1">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="checkbox" checked={field.required} onChange={e => handleUpdateField(field.id, { required: e.target.checked })} className="w-3 h-3 accent-blue-600" />
                                                    <span className="text-[10px] font-bold text-gray-600">Bắt buộc</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!config.formFields || config.formFields.length === 0) && (
                                    <p className="text-center py-10 text-xs text-gray-400 italic">Chưa có ô nhập liệu nào. Hãy bấm "Mặc định" hoặc "Thêm ô".</p>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {activeTool === 'background' && (
                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ảnh nền chính</label>
                            <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50">Upload Ảnh</button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Work Area */}
            <div className="flex-grow flex flex-col relative">
                <div className="h-14 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-10">
                    <select value={config.frameId} onChange={(e) => handleFrameChange(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2 font-bold">
                        {frames.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                    </select>
                    <div className="flex items-center gap-3">
                        <button onClick={handlePrepareSave} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700">{editingBgId ? 'Cập Nhật' : 'Lưu Mẫu'}</button>
                    </div>
                </div>

                <div className="flex-grow overflow-auto flex items-center justify-center p-8 bg-[url('https://res.cloudinary.com/dbdqd93km/image/upload/v1/transparent-bg.png')]">
                    <div style={{ transform: `scale(${zoom})` }} className="bg-white shadow-2xl">
                        <FramePreview 
                            ref={previewRef}
                            config={config}
                            containerWidth={500}
                            onItemTransform={handleItemTransform}
                            onItemRemove={handleItemRemove}
                            onTextUpdate={() => {}}
                            isInteractive={true}
                            selectedItemId={selectedItemId}
                            setSelectedItemId={setSelectedItemId}
                            setIsEditingText={() => {}} 
                            allParts={{}} 
                            allowTextScaling={true}
                        />
                    </div>
                </div>
            </div>

            {/* Modal Save */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-[500px]">
                        <h3 className="text-xl font-bold mb-4">{editingBgId ? 'Cập Nhật Mẫu' : 'Lưu Mẫu Mới'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên mẫu nền</label>
                                <input className="w-full p-2 border rounded-lg" value={bgName} onChange={e => setBgName(e.target.value)} placeholder="VD: Tốt nghiệp 2..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Danh mục</label>
                                    <select className="w-full p-2 border rounded-lg" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>{BG_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Khung</label>
                                    <select className="w-full p-2 border rounded-lg" value={bgType} onChange={e => setBgType(e.target.value as any)}><option value="square">Vuông</option><option value="rectangle">Chữ nhật</option></select>
                                </div>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-lg text-center">
                                <p className="text-[10px] text-gray-500 mb-2 uppercase font-bold">Ảnh xem trước (Thumbnail)</p>
                                {generatedThumbnailUrl && <img src={generatedThumbnailUrl} className="max-h-32 mx-auto rounded shadow" />}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm font-bold text-gray-400">Hủy</button>
                            <button onClick={handleConfirmSave} disabled={isSaving} className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700">{isSaving ? 'Đang lưu...' : 'Xác nhận lưu'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
