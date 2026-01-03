
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
        const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const groups = [ { label: 'Phông chữ cơ bản', fonts: DEFAULT_FONTS }, { label: 'Phông chữ tải lên', fonts: uploadedFonts.map(f => f.name) } ];
    return (
        <div className="relative" ref={dropdownRef} onMouseLeave={() => onPreview(null)}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex justify-between items-center"><span className="truncate">{value}</span><svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {groups.map((group) => group.fonts.length > 0 && (<div key={group.label}><div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase bg-gray-50">{group.label}</div>{group.fonts.map(font => (<div key={font} className={`px-3 py-2 text-sm cursor-pointer hover:bg-pink-50 transition-colors ${value === font ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700'}`} onMouseEnter={() => onPreview(font)} onClick={() => { onChange(font); setIsOpen(false); }}><span style={{ fontFamily: font }}>{font}</span></div>))}</div>))}
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
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [existingPreviewUrl, setExistingPreviewUrl] = useState<string>('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
    const [generatedThumbnailUrl, setGeneratedThumbnailUrl] = useState<string>('');
    const [uploadedFonts, setUploadedFonts] = useState<CustomFont[]>([]);
    const [previewFont, setPreviewFont] = useState<string | null>(null);
    const [quickFontName, setQuickFontName] = useState('');
    const [isUploadingFont, setIsUploadingFont] = useState(false);
    const [clipboard, setClipboard] = useState<{ type: 'text' | 'shape' | 'item'; data: any } | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

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
            const [framesData, configData, bgData, assetsData] = await Promise.all([ getAllFrames(), getStoreConfig(), getAllBackgrounds(), getAllAssets() ]);
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

    const handleAddField = () => {
        const newField: FormField = { id: `f_${Date.now()}`, label: 'Trường mới', type: 'text', required: false };
        setFormFields([...formFields, newField]);
    }

    const handleUpdateField = (id: string, updates: Partial<FormField>) => {
        setFormFields(formFields.map(f => f.id === id ? { ...f, ...updates } : f));
    }

    const handleRemoveField = (id: string) => {
        setFormFields(formFields.filter(f => f.id !== id));
    }

    const handleLoadTemplate = (bg: PresetBackground) => {
        if (confirm("Tải mẫu này sẽ thay thế thiết kế hiện tại?")) {
            setEditingBgId(bg.id);
            setBgName(bg.name);
            setBgCategory(bg.category);
            setBgType(bg.type);
            setFormFields(bg.formFields || []);
            setExistingPreviewUrl(bg.previewUrl || '');
            const isColor = bg.url.startsWith('#');
            let frameId = bg.type === 'rectangle' ? 'md' : 'lg';
            setConfigWithHistory({ frameId, background: { type: isColor ? 'color' : 'image', value: bg.url }, texts: bg.overlayConfig?.texts || [], draggableItems: bg.overlayConfig?.draggableItems || [], shapes: bg.overlayConfig?.shapes || [], characters: [] });
            setActiveTool('layers');
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
                const canvas = await html2canvas(previewRef.current, { useCORS: true, allowTaint: true, scale: 2, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0 });
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) { setGeneratedThumbnailBlob(blob); setGeneratedThumbnailUrl(URL.createObjectURL(blob)); }
            }
            // If starting fresh, set default fields
            if (!editingBgId && formFields.length === 0) {
                 setFormFields([
                    { id: 'names', label: 'Tên / Lời tựa', type: 'text', required: true },
                    { id: 'date', label: 'Ngày kỷ niệm', type: 'date', required: false },
                    { id: 'message', label: 'Lời nhắn', type: 'textarea', required: false }
                 ]);
            }
            setShowSaveModal(true);
        } catch (e) { console.error(e); setShowSaveModal(true); } finally { setIsSaving(false); setSelectedItemId(originalSelected); }
    };

    const handleConfirmSave = async () => {
        if (!bgName) return alert("Vui lòng nhập tên Mẫu");
        setIsSaving(true);
        try {
            let previewUrl = existingPreviewUrl || '';
            if (generatedThumbnailBlob) {
                const fileToUpload = generatedThumbnailBlob instanceof File ? generatedThumbnailBlob : new File([generatedThumbnailBlob], "thumbnail.png", { type: "image/png" });
                const uploaded = await uploadToCloudinary(fileToUpload);
                if (uploaded) previewUrl = uploaded;
                else throw new Error("Lỗi upload ảnh thumbnail");
            }
            if (!previewUrl) throw new Error("Chưa có ảnh thumbnail.");
            const newBackground: PresetBackground = {
                id: editingBgId || `bg_${Date.now()}`, name: bgName, url: config.background.value, previewUrl: previewUrl, category: bgCategory, type: bgType, orientation: 'portrait', 
                formFields: formFields,
                overlayConfig: { texts: config.texts, draggableItems: config.draggableItems, shapes: config.shapes || [] }
            };
            let success = false;
            if (editingBgId) {
                success = await updateBackground(editingBgId, newBackground);
                if (success) setExistingBackgrounds(prev => prev.map(b => b.id === editingBgId ? newBackground : b));
            } else {
                success = await addBackground(newBackground);
                if (success) setExistingBackgrounds(prev => [...prev, newBackground]);
            }
            if (success) { setShowSaveModal(false); if (!editingBgId) setBgName(''); setGeneratedThumbnailBlob(null); setGeneratedThumbnailUrl(''); setExistingPreviewUrl(''); alert("Đã lưu thành công!"); }
        } catch (e: any) { alert(e.message || "Lỗi khi lưu."); } finally { setIsSaving(false); }
    };

    // Fix: Added handleManualThumbnailUpload to handle user-uploaded thumbnails in save modal
    const handleManualThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setGeneratedThumbnailBlob(file);
            setGeneratedThumbnailUrl(URL.createObjectURL(file));
            setExistingPreviewUrl(''); // Clear existing preview URL if manual upload is used
        }
    };

    const handleFrameChange = (frameId: string) => { setConfigWithHistory(prev => ({ ...prev, frameId })); const frame = frames.find(f => f.id === frameId); if (frame) { setBgType(Math.abs(frame.frameWidthCm - frame.frameHeightCm) > 1 ? 'rectangle' : 'square'); } };
    const handleBackgroundChange = (type: 'color' | 'image', value: string) => { setConfigWithHistory(prev => ({ ...prev, background: { type, value } })); };
    const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { setIsSaving(true); try { const url = await uploadToCloudinary(e.target.files[0]); if (url) { handleBackgroundChange('image', url); const newAsset = await addAsset(url, 'background'); if (newAsset) setSavedAssets(prev => [newAsset, ...prev]); } } catch (err) { alert('Lỗi upload ảnh'); } finally { setIsSaving(false); } } };
    const handleDeleteAsset = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (confirm("Xóa ảnh này khỏi thư viện?")) { const success = await deleteAsset(id); if (success) setSavedAssets(prev => prev.filter(a => a.id !== id)); } }
    const handleAddText = () => { const newText: TextConfig = { id: Date.now(), content: 'Nhập nội dung', font: 'Playfair Display', size: 24, color: '#333333', x: 50, y: 50, rotation: 0, scale: 1, background: false, width: 40, lockedPosition: false, lockedContent: false }; setConfigWithHistory(prev => ({ ...prev, texts: [...prev.texts, newText] })); setSelectedItemId(`text-${newText.id}`); setActiveTool('text'); };
    const handleAddShape = () => { const newShape: ShapeConfig = { id: Date.now(), type: 'rect', x: 50, y: 50, rotation: 0, width: 20, height: 15, strokeColor: '#333333', fillColor: 'transparent', strokeWidth: 2, strokeType: 'dashed', borderRadius: 0, lockedPosition: false }; setConfigWithHistory(prev => ({ ...prev, shapes: [...(prev.shapes || []), newShape] })); setSelectedItemId(`shape-${newShape.id}`); setActiveTool('shape'); };
    const handleShapeUpdate = (id: number, updates: Partial<ShapeConfig>) => { setConfigWithHistory(prev => ({ ...prev, shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...updates } : s) })); };
    const handleAddUploadItem = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { setIsSaving(true); try { const url = await uploadToCloudinary(e.target.files[0]); if (url) { const newItem: DraggableItem = { id: Date.now(), partId: url, type: 'charm', x: 50, y: 50, rotation: 0, scale: 1 }; setConfigWithHistory(prev => ({ ...prev, draggableItems: [...prev.draggableItems, newItem] })); const newAsset = await addAsset(url, 'sticker'); if (newAsset) setSavedAssets(prev => [newAsset, ...prev]); } } catch (err) { alert('Lỗi upload ảnh'); } finally { setIsSaving(false); } } };
    const handleItemUpdate = (id: number | string, updates: Partial<DraggableItem>) => { let numericId: number; if (typeof id === 'string') { const parts = id.split('-'); numericId = parts.length > 1 ? parseInt(parts[1]) : parseInt(id); } else numericId = id; setConfigWithHistory(prev => ({ ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...updates } : i) })); };
    const handleTextUpdate = (id: number, updates: Partial<TextConfig>) => { setConfigWithHistory(prev => ({ ...prev, texts: prev.texts.map(t => t.id === id ? { ...t, ...updates } : t) })); };
    const handleItemTransform = (id: string, newTransform: any) => { const [type, idStr] = id.split('-'); const numericId = parseInt(idStr); setConfigWithHistory(prev => { if (type === 'text') return { ...prev, texts: prev.texts.map(t => t.id === numericId ? { ...t, ...newTransform } : t) }; if (type === 'item') return { ...prev, draggableItems: prev.draggableItems.map(i => i.id === numericId ? { ...i, ...newTransform } : i) }; if (type === 'shape') return { ...prev, shapes: (prev.shapes || []).map(s => s.id === numericId ? { ...s, ...newTransform } : s) }; return prev; }); };
    const handleDownloadImage = async () => { const originalSelected = selectedItemId; setSelectedItemId(null); setIsSaving(true); setTimeout(async () => { if (previewRef.current && typeof html2canvas !== 'undefined') { try { const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 2, backgroundColor: null }); const link = document.createElement('a'); link.download = `preview_${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click(); } catch (e) { console.error(e); } } setIsSaving(false); setSelectedItemId(originalSelected); }, 100); };
    const getSelectedText = () => { if (!selectedItemId || !selectedItemId.startsWith('text-')) return null; const id = parseInt(selectedItemId.split('-')[1]); return config.texts.find(t => t.id === id); };
    const getSelectedItem = () => { if (!selectedItemId || !selectedItemId.startsWith('item-')) return null; const id = parseInt(selectedItemId.split('-')[1]); return config.draggableItems.find(i => i.id === id); };
    const getSelectedShape = () => { if (!selectedItemId || !selectedItemId.startsWith('shape-')) return null; const id = parseInt(selectedItemId.split('-')[1]); return config.shapes?.find(s => s.id === id); };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-gray-100 rounded-xl border border-gray-300 overflow-hidden shadow-lg animate-fade-in relative">
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-4 z-20 overflow-y-auto no-scrollbar">
                {TOOLS.map(tool => (<button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`w-14 h-14 flex-shrink-0 flex flex-col items-center justify-center rounded-lg transition-all ${activeTool === tool.id ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}><span className="text-xl mb-1">{tool.icon}</span><span className="text-[10px] font-bold uppercase">{tool.label}</span></button>))}
            </div>
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm transition-all">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800 text-lg">{TOOLS.find(t => t.id === activeTool)?.label}</h3>{editingBgId && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Editing</span>}</div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {activeTool === 'templates' && (
                        <div className="space-y-4"><button onClick={() => { setConfigWithHistory(INITIAL_FRAME_CONFIG); setEditingBgId(null); setBgName(''); setFormFields([]); }} className="w-full border-2 border-dashed border-gray-300 py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50">+ Thiết kế mới</button>
                            <div className="space-y-2">{existingBackgrounds.map(bg => (<div key={bg.id} onClick={() => handleLoadTemplate(bg)} className={`flex items-center gap-3 p-2 rounded cursor-pointer border ${editingBgId === bg.id ? 'bg-blue-50 border-blue-300 ring-1' : 'bg-white'}`}><div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0 border"><img src={bg.previewUrl || bg.url} className="w-full h-full object-cover" /></div><div className="flex-grow min-w-0"><p className="text-sm font-bold text-gray-800 truncate">{bg.name}</p><p className="text-xs text-gray-500">{bg.category}</p></div></div>))}</div>
                        </div>
                    )}
                    {activeTool === 'background' && (
                        <div className="space-y-6">
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Màu sắc</label><div className="grid grid-cols-5 gap-2">{['#ffffff', '#f4eee8', '#e2e8f0', '#fed7aa', '#fbcfe8'].map(color => (<button key={color} onClick={() => handleBackgroundChange('color', color)} className="w-8 h-8 rounded-full border shadow-sm" style={{ backgroundColor: color }} />))}</div></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Tải nền mới</label><button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50"><span className="text-sm">Upload ảnh nền</span></button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadBackground} /></div>
                            {savedAssets.filter(a => a.type === 'background').length > 0 && (<div className="grid grid-cols-3 gap-2">{savedAssets.filter(a => a.type === 'background').map(a => (<div key={a.id} className="relative group aspect-square rounded overflow-hidden border cursor-pointer" onClick={() => handleBackgroundChange('image', a.url)}><img src={a.url} className="w-full h-full object-cover" /><button onClick={(e) => handleDeleteAsset(a.id, e)} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100">×</button></div>))}</div>)}
                        </div>
                    )}
                    {activeTool === 'text' && (
                        <div className="space-y-4"><button onClick={handleAddText} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold shadow-md hover:bg-black">+ Thêm văn bản</button>
                            {getSelectedText() && (
                                <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
                                    <FontSelector value={getSelectedText()?.font || 'Playfair Display'} onChange={(font) => handleTextUpdate(getSelectedText()!.id, { font })} onPreview={setPreviewFont} uploadedFonts={uploadedFonts} />
                                    <div className="flex gap-2">
                                        <input type="number" className="w-full p-2 border rounded text-sm" value={getSelectedText()?.size || 12} onChange={(e) => handleTextUpdate(getSelectedText()!.id, { size: parseInt(e.target.value) })} />
                                        <input type="color" className="w-10 h-10 border rounded cursor-pointer" value={getSelectedText()?.color || '#000000'} onChange={(e) => handleTextUpdate(getSelectedText()!.id, { color: e.target.value })} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTool === 'shape' && (
                        <div className="space-y-4"><button onClick={handleAddShape} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold shadow-md hover:bg-black">+ Thêm Hình Khối</button>
                            {getSelectedShape() && (
                                <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
                                    <select className="w-full p-2 border rounded text-sm" value={getSelectedShape()?.strokeType} onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { strokeType: e.target.value as any })}><option value="solid">Nét liền</option><option value="dashed">Nét đứt</option></select>
                                    <div className="flex gap-2">
                                        <input type="color" className="w-full h-8 rounded border" value={getSelectedShape()?.strokeColor} onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { strokeColor: e.target.value })} />
                                        <input type="color" className="w-full h-8 rounded border" value={getSelectedShape()?.fillColor === 'transparent' ? '#ffffff' : getSelectedShape()!.fillColor} onChange={(e) => handleShapeUpdate(getSelectedShape()!.id, { fillColor: e.target.value })} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTool === 'upload' && (
                        <div className="space-y-4"><label className="w-full border-2 border-dashed rounded-lg p-6 text-center block cursor-pointer"><input type="file" className="hidden" accept="image/*" onChange={handleAddUploadItem} /><span className="text-sm font-bold">Tải Sticker / Ảnh</span></label>
                            <div className="grid grid-cols-4 gap-2">{savedAssets.filter(a => a.type === 'sticker').map(a => (<div key={a.id} className="relative group aspect-square rounded border cursor-pointer p-1 bg-gray-50" onClick={() => handleItemUpdate(Date.now(), { partId: a.url, type: 'charm', x: 50, y: 50, scale: 1 })}><img src={a.url} className="w-full h-full object-contain" /><button onClick={(e) => handleDeleteAsset(a.id, e)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100">×</button></div>))}</div>
                        </div>
                    )}
                    {activeTool === 'layers' && (
                        <div className="space-y-2">{config.texts.map(t => (<div key={t.id} className="flex justify-between p-2 border rounded text-xs"><span>{t.content}</span><button onClick={() => handleItemRemove(`text-${t.id}`)} className="text-red-500">×</button></div>))}{config.draggableItems.map(i => (<div key={i.id} className="flex justify-between p-2 border rounded text-xs"><span>Sticker</span><button onClick={() => handleItemRemove(`item-${i.id}`)} className="text-red-500">×</button></div>))}</div>
                    )}
                </div>
            </div>
            <div className="flex-grow flex flex-col bg-gray-100 relative">
                <div className="h-14 bg-white border-b flex justify-between items-center px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4"><select value={config.frameId} onChange={(e) => handleFrameChange(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg p-2 font-bold">{frames.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}</select></div>
                    <div className="flex gap-3"><button onClick={handleDownloadImage} className="px-4 py-2 text-xs font-bold bg-white border rounded">Tải PNG</button><button onClick={handlePrepareSave} className={`px-4 py-2 text-xs font-bold text-white rounded shadow-sm ${editingBgId ? 'bg-orange-600' : 'bg-blue-600'}`}>{editingBgId ? 'Cập Nhật' : 'Lưu Mẫu'}</button></div>
                </div>
                <div className="flex-grow overflow-auto flex items-center justify-center p-8"><div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }} className="bg-white"><FramePreview ref={previewRef} config={config} containerWidth={500} onItemTransform={handleItemTransform} onItemRemove={handleItemRemove} onTextUpdate={handleTextUpdate} onItemUpdate={handleItemUpdate} isInteractive={true} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId} setIsEditingText={() => {}} allParts={{}} previewFont={previewFont} allowTextScaling={true} /></div></div>
            </div>
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center font-sans">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">{editingBgId ? 'Cập Nhật Mẫu' : 'Lưu Mẫu Mới'}</h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="w-20 h-24 bg-white border rounded overflow-hidden flex-shrink-0 flex items-center justify-center">{generatedThumbnailUrl ? <img src={generatedThumbnailUrl} className="w-full h-full object-cover" /> : <div className="text-[10px] text-gray-300">Thumbnail</div>}</div>
                                <div className="flex-grow">
                                    <p className="text-xs text-gray-500 mb-2">Thumbnail hiển thị cho khách hàng</p>
                                    <button onClick={() => thumbnailInputRef.current?.click()} className="px-3 py-1.5 bg-white border rounded text-[10px] font-bold">Đổi ảnh khác</button>
                                    <input type="file" ref={thumbnailInputRef} className="hidden" accept="image/*" onChange={handleManualThumbnailUpload} />
                                </div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Tên Hiển Thị</label><input type="text" className="w-full p-2.5 border rounded-lg" value={bgName} onChange={e => setBgName(e.target.value)} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Danh mục</label><select className="w-full p-2.5 border rounded-lg" value={bgCategory} onChange={e => setBgCategory(e.target.value)}>{BG_CATEGORIES.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Loại Khung</label><select className="w-full p-2.5 border rounded-lg" value={bgType} onChange={e => setBgType(e.target.value as any)}><option value="square">Vuông</option><option value="rectangle">Chữ nhật</option></select></div>
                            </div>
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-black text-blue-600 uppercase">Cấu hình Form Step 2</h4><button onClick={handleAddField} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold">+ Thêm trường</button></div>
                                <div className="space-y-2">{formFields.map(field => (
                                    <div key={field.id} className="p-2 border rounded-lg bg-gray-50 flex items-center gap-2 group">
                                        <input value={field.label} onChange={e => handleUpdateField(field.id, { label: e.target.value })} className="flex-1 p-1 text-xs border rounded" />
                                        <select value={field.type} onChange={e => handleUpdateField(field.id, { type: e.target.value as any })} className="p-1 text-xs border rounded bg-white"><option value="text">Chữ</option><option value="date">Ngày</option><option value="textarea">Đoạn văn</option><option value="image">Ảnh</option></select>
                                        <button onClick={() => handleRemoveField(field.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                    </div>
                                ))}</div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100">Hủy</button>
                            <button onClick={handleConfirmSave} disabled={isSaving} className="px-6 py-2 text-sm bg-blue-600 text-white font-bold rounded-lg shadow-md">{isSaving ? '...' : 'Xác nhận Lưu'}</button>
                        </div>
                    </div>
                </div>
            )}
            {isSaving && (<div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center"><div className="bg-white p-4 rounded-lg flex items-center gap-3 shadow-lg"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div><span className="font-bold text-sm">Đang lưu...</span></div></div>)}
        </div>
    );
};
